import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api.js";

export default function Quiz() {
  const { category } = useParams();
  const [session, setSession] = useState(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null); // { correct, correctAnswer, explanation }
  const [timeLeft, setTimeLeft] = useState(15);
  const [hintsRemaining, setHintsRemaining] = useState(3);
  const [hintText, setHintText] = useState("");
  const [error, setError] = useState("");
  const [finished, setFinished] = useState(false);
  const [finalScore, setFinalScore] = useState(null);
  const [warning, setWarning] = useState("");

  const timerRef = useRef(null);
  const startedAtRef = useRef(Date.now());
  const navigate = useNavigate();

  useEffect(() => {
    api
      .post("/quiz/start", { category })
      .then(({ data }) => {
        setSession(data);
        setTimeLeft(data.timeLimitSec);
        setHintsRemaining(data.hintsRemaining);
        startedAtRef.current = Date.now();
      })
      .catch((err) => setError(err.response?.data?.error || "Could not start quiz"));
  }, [category]);

  const submitAnswer = useCallback(
    async (submittedAnswer) => {
      if (!session || finished || feedback) return;
      clearInterval(timerRef.current);

      const timeTakenSec = Math.round((Date.now() - startedAtRef.current) / 1000);
      try {
        const { data } = await api.post("/quiz/answer", {
          category,
          answer: submittedAnswer,
          timeTakenSec,
        });
        setFeedback({
          correct: data.correct,
          correctAnswer: data.correctAnswer,
          explanation: data.explanation,
        });

        // Give the player time to read the answer + explanation before
        // advancing (longer than a plain correct/incorrect flash).
        setTimeout(() => {
          if (data.finished) {
            setFinished(true);
            setFinalScore(data.score);
            return;
          }
          setFeedback(null);
          setAnswer("");
          setHintText("");
          setHintsRemaining(3);
          setSession((prev) => ({
            ...prev,
            question: data.question,
            questionIndex: data.questionIndex,
          }));
          setTimeLeft(15);
          startedAtRef.current = Date.now();
        }, 3500);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to submit answer");
      }
    },
    [session, finished, feedback, category]
  );

  // Countdown timer — auto-submits empty answer at 0
  useEffect(() => {
    if (!session || finished || feedback) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          submitAnswer(answer || "");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.questionIndex, feedback]);

  // Anti-cheat: tab switch / window blur detection
  useEffect(() => {
    async function reportViolation() {
      if (finished) return;
      try {
        const { data } = await api.post("/quiz/violation", { category });
        if (data.terminated) {
          setFinished(true);
          setError("Quiz ended due to repeated tab-switching.");
        } else {
          setWarning(
            `Warning ${data.violations}/3: switching tabs again ${
              data.violations >= 2 ? "one more time" : "too often"
            } will end your quiz.`
          );
          setTimeout(() => setWarning(""), 4000);
        }
      } catch {
        // ignore
      }
    }

    function handleVisibility() {
      if (document.hidden) reportViolation();
    }
    function handleBlur() {
      reportViolation();
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }, [finished, category]);

  async function useHint() {
    if (hintsRemaining <= 0) return;
    try {
      const { data } = await api.post("/quiz/hint", { category });
      setHintText(data.hint);
      setHintsRemaining(data.hintsRemaining);
    } catch (err) {
      setError(err.response?.data?.error || "No hint available");
    }
  }

  if (error && !session) {
    return (
      <div className="centered-page">
        <p className="error">{error}</p>
        <button onClick={() => navigate("/categories")}>Back to Categories</button>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="centered-page">
        <div className="card">
          <h1>{category} Complete</h1>
          {finalScore !== null && <p>Your score: {finalScore} / 20</p>}
          {error && <p className="error">{error}</p>}
          <button onClick={() => navigate("/categories")}>Back to Categories</button>
        </div>
      </div>
    );
  }

  if (!session) return <div className="centered-page">Loading quiz...</div>;

  const q = session.question;
  const imageUrl =
    q?.isImageQuestion && q?.imageQuery
      ? `https://source.unsplash.com/500x300/?${encodeURIComponent(q.imageQuery)}`
      : null;

  return (
    <div className="centered-page">
      <div className="card quiz-card">
        <p className="integrity-notice">
          ⚠️ Do not use AI tools, search engines, or any other website for
          help during this quiz. Switching tabs or windows is monitored.
        </p>
        {warning && <p className="warning">{warning}</p>}
        <div className="quiz-meta">
          <span>{category}</span>
          <span>Question {session.questionIndex + 1} / {session.questionsPerRound}</span>
          <span className={timeLeft <= 5 ? "timer danger" : "timer"}>{timeLeft}s</span>
        </div>

        {imageUrl && (
          <img src={imageUrl} alt="Quiz visual" className="question-image" />
        )}

        <p className="question-text">{q?.text}</p>

        <input
          autoFocus
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitAnswer(answer)}
          placeholder="Your answer"
          disabled={!!feedback}
        />

        <div className="quiz-actions">
          <button onClick={() => submitAnswer(answer)} disabled={!!feedback}>
            Submit
          </button>
          <button onClick={useHint} disabled={hintsRemaining <= 0 || !!feedback}>
            Hint ({hintsRemaining} left)
          </button>
        </div>

        {hintText && !feedback && <p className="hint">💡 {hintText}</p>}

        {feedback && (
          <div className={feedback.correct ? "feedback-box correct-box" : "feedback-box incorrect-box"}>
            <p className="feedback-verdict">
              {feedback.correct ? "✅ Correct!" : "❌ Incorrect"}
            </p>
            <p className="feedback-answer">
              Correct answer: <strong>{feedback.correctAnswer}</strong>
            </p>
            {feedback.explanation && (
              <p className="feedback-explanation">{feedback.explanation}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
