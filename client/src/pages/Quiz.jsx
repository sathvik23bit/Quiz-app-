import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api.js";

export default function Quiz() {
  const [session, setSession] = useState(null); // { category, question, categoryIndex, ... }
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null); // { correct, matchLayer }
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
      .post("/quiz/start")
      .then(({ data }) => {
        setSession(data);
        setTimeLeft(data.timeLimitSec);
        setHintsRemaining(data.hintsRemaining);
        startedAtRef.current = Date.now();
      })
      .catch((err) => setError(err.response?.data?.error || "Could not start quiz"));
  }, []);

  const submitAnswer = useCallback(
    async (submittedAnswer) => {
      if (!session || finished) return;
      clearInterval(timerRef.current);

      const timeTakenSec = Math.round((Date.now() - startedAtRef.current) / 1000);
      try {
        const { data } = await api.post("/quiz/answer", {
          answer: submittedAnswer,
          timeTakenSec,
        });
        setFeedback({ correct: data.correct, layer: data.matchLayer });

        if (data.finished) {
          setFinished(true);
          setFinalScore(data.score);
          return;
        }

        setTimeout(() => {
          setFeedback(null);
          setAnswer("");
          setHintText("");
          setHintsRemaining(3);
          setSession((prev) => ({
            ...prev,
            category: data.category,
            question: data.question,
            categoryIndex: data.categoryIndex,
            questionIndex: data.questionIndex,
          }));
          setTimeLeft(15);
          startedAtRef.current = Date.now();
        }, 1200);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to submit answer");
      }
    },
    [session, finished]
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
  }, [session?.questionIndex, session?.categoryIndex, feedback]);

  // Anti-cheat: tab switch / window blur detection
  useEffect(() => {
    async function reportViolation() {
      if (finished) return;
      try {
        const { data } = await api.post("/quiz/violation");
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
  }, [finished]);

  async function useHint() {
    if (hintsRemaining <= 0) return;
    try {
      const { data } = await api.post("/quiz/hint");
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
        <button onClick={() => navigate("/")}>Back to Dashboard</button>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="centered-page">
        <div className="card">
          <h1>Quiz Complete</h1>
          {finalScore !== null && <p>Your score: {finalScore} / 380</p>}
          {error && <p className="error">{error}</p>}
          <button onClick={() => navigate("/")}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  if (!session) return <div className="centered-page">Loading quiz...</div>;

  return (
    <div className="centered-page">
      <div className="card quiz-card">
        {warning && <p className="warning">{warning}</p>}
        <div className="quiz-meta">
          <span>Round {session.categoryIndex + 1} / {session.totalCategories}</span>
          <span>Question {session.questionIndex + 1} / {session.questionsPerRound}</span>
          <span className={timeLeft <= 5 ? "timer danger" : "timer"}>{timeLeft}s</span>
        </div>
        <h2>{session.category}</h2>
        <p className="question-text">{session.question?.text}</p>

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

        {hintText && <p className="hint">💡 {hintText}</p>}
        {feedback && (
          <p className={feedback.correct ? "correct" : "incorrect"}>
            {feedback.correct ? "Correct!" : "Incorrect"}
          </p>
        )}
      </div>
    </div>
  );
}
