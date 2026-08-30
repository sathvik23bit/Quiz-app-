import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import QuestionPool from "../models/QuestionPool.js";
import QuizSession from "../models/QuizSession.js";
import User from "../models/User.js";
import { redis } from "../config/redis.js";
import { selectUserQuestions } from "../utils/seededShuffle.js";
import { checkAnswer } from "../utils/answerCheck.js";
import { CATEGORIES, QUESTIONS_PER_ROUND } from "../config/categories.js";
import { getStudyResource } from "../config/studyResources.js";

const router = Router();

const QUESTION_TIME_LIMIT_SEC = 15;
const HINTS_PER_CATEGORY = 3;
const MAX_VIOLATIONS = 2; // 2 warnings allowed, 3rd violation ends quiz

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function redisKey(userId, date, category) {
  return `session:${userId}:${date}:${category}`;
}

function stripAnswer(q) {
  const { answer, acceptableAnswers, ...safe } = q;
  return safe;
}

// GET /api/quiz/categories - list all 19 categories with today's status for
// this user, so the frontend can render one button per category.
router.get("/categories", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const date = todayKey();

  const [pools, sessions] = await Promise.all([
    QuestionPool.find({ date, status: "published" }).select("category").lean(),
    QuizSession.find({ user: userId, date }).select("category status score").lean(),
  ]);

  const readyCategories = new Set(pools.map((p) => p.category));
  const sessionByCategory = Object.fromEntries(sessions.map((s) => [s.category, s]));

  const categories = CATEGORIES.map((category) => {
    const session = sessionByCategory[category];
    return {
      category,
      ready: readyCategories.has(category),
      status: session?.status || "not_started",
      score: session?.score ?? null,
    };
  });

  res.json({ categories });
});

// POST /api/quiz/start - body: { category }. Creates or resumes today's
// attempt for that single category.
router.post("/start", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const date = todayKey();
  const { category } = req.body;

  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: "Unknown category" });
  }

  const pool = await QuestionPool.findOne({ date, category, status: "published" }).lean();
  if (!pool || !pool.questions?.length) {
    return res.status(503).json({ error: "This category isn't ready yet. Try again shortly." });
  }

  // Atomic upsert avoids a race condition where two concurrent "start"
  // requests both see no existing session and both try to create one.
  let session;
  try {
    session = await QuizSession.findOneAndUpdate(
      { user: userId, date, category },
      { $setOnInsert: { user: userId, date, category, status: "in_progress" } },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err.code === 11000) {
      session = await QuizSession.findOne({ user: userId, date, category });
    } else {
      throw err;
    }
  }

  if (session.status !== "in_progress") {
    return res.status(409).json({ error: "You've already completed this category today." });
  }

  const questions = selectUserQuestions(userId, date, category, pool.questions);

  await redis.set(
    redisKey(userId, date, category),
    JSON.stringify({ questions, hintsUsed: 0, currentQuestionIndex: session.currentQuestionIndex }),
    { ex: 60 * 60 * 6 }
  );

  const currentQuestion = questions[session.currentQuestionIndex];

  res.json({
    sessionId: session._id,
    category,
    questionIndex: session.currentQuestionIndex,
    question: currentQuestion ? stripAnswer(currentQuestion) : null,
    timeLimitSec: QUESTION_TIME_LIMIT_SEC,
    hintsRemaining: HINTS_PER_CATEGORY,
    questionsPerRound: QUESTIONS_PER_ROUND,
  });
});

// POST /api/quiz/answer - body: { category, answer, timeTakenSec }
router.post("/answer", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const date = todayKey();
  const { category, answer, timeTakenSec } = req.body;

  const session = await QuizSession.findOne({ user: userId, date, category });
  if (!session || session.status !== "in_progress") {
    return res.status(409).json({ error: "No active quiz session for this category." });
  }

  const cached = await redis.get(redisKey(userId, date, category));
  const state = typeof cached === "string" ? JSON.parse(cached) : cached;
  if (!state) return res.status(410).json({ error: "Session expired, please restart." });

  const question = state.questions[session.currentQuestionIndex];
  if (!question) return res.status(400).json({ error: "No current question." });

  const { correct, layer } = await checkAnswer(answer, question);

  session.answers.push({
    qid: question.qid,
    userAnswer: answer,
    correct,
    timeTakenSec,
  });
  if (correct) session.score += 1;

  const nextIndex = session.currentQuestionIndex + 1;
  const finished = nextIndex >= state.questions.length;

  session.currentQuestionIndex = nextIndex;
  if (finished) {
    session.status = "completed";
    session.completedAt = new Date();
    await User.findByIdAndUpdate(userId, {
      $inc: { totalScore: session.score, quizzesPlayed: 1 },
    });
  }
  await session.save();

  let nextQuestion = null;
  if (!finished) {
    nextQuestion = stripAnswer(state.questions[nextIndex]);
    state.currentQuestionIndex = nextIndex;
    await redis.set(redisKey(userId, date, category), JSON.stringify(state), { ex: 60 * 60 * 6 });
  } else {
    await redis.del(redisKey(userId, date, category));
  }

  res.json({
    correct,
    matchLayer: layer,
    finished,
    score: session.score,
    correctAnswer: question.answer,
    explanation: question.explanation || "",
    studyTip: correct ? null : getStudyResource(category),
    question: nextQuestion,
    questionIndex: nextIndex,
  });
});

// POST /api/quiz/hint - body: { category }
router.post("/hint", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const date = todayKey();
  const { category } = req.body;

  const session = await QuizSession.findOne({ user: userId, date, category });
  if (!session || session.status !== "in_progress") {
    return res.status(409).json({ error: "No active quiz session for this category." });
  }

  const cached = await redis.get(redisKey(userId, date, category));
  const state = typeof cached === "string" ? JSON.parse(cached) : cached;
  if (!state) return res.status(410).json({ error: "Session expired, please restart." });

  const question = state.questions[session.currentQuestionIndex];
  if (!question) return res.status(400).json({ error: "No current question." });

  if (state.hintsUsed >= HINTS_PER_CATEGORY) {
    return res.status(403).json({ error: "No hints remaining for this category." });
  }

  const hint = question.hints?.[state.hintsUsed] || "No more hints available.";
  state.hintsUsed += 1;
  await redis.set(redisKey(userId, date, category), JSON.stringify(state), { ex: 60 * 60 * 6 });

  res.json({ hint, hintsRemaining: HINTS_PER_CATEGORY - state.hintsUsed });
});

// POST /api/quiz/violation - body: { category }
router.post("/violation", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const date = todayKey();
  const { category } = req.body;

  const session = await QuizSession.findOne({ user: userId, date, category });
  if (!session || session.status !== "in_progress") {
    return res.status(409).json({ error: "No active quiz session for this category." });
  }

  session.violations += 1;

  if (session.violations > MAX_VIOLATIONS) {
    session.status = "terminated_violation";
    session.completedAt = new Date();
    await session.save();
    await redis.del(redisKey(userId, date, category));
    return res.json({ terminated: true, violations: session.violations });
  }

  await session.save();
  res.json({ terminated: false, violations: session.violations, warning: true });
});

export default router;
