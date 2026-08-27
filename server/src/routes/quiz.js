import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import QuestionPool from "../models/QuestionPool.js";
import QuizSession from "../models/QuizSession.js";
import User from "../models/User.js";
import { redis } from "../config/redis.js";
import { selectUserQuestions } from "../utils/seededShuffle.js";
import { checkAnswer } from "../utils/answerCheck.js";
import { CATEGORIES, QUESTIONS_PER_ROUND } from "../config/categories.js";

const router = Router();

const QUESTION_TIME_LIMIT_SEC = 15;
const HINTS_PER_CATEGORY = 3;
const MAX_VIOLATIONS = 1; // 1 warning allowed, 2nd violation ends quiz

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function redisKey(userId, date) {
  return `session:${userId}:${date}`;
}

// Build (or resume) the user's full ordered set of questions across all
// 19 categories for a given date, without exposing answers to the client.
async function buildUserQuizPlan(userId, date) {
  const pools = await QuestionPool.find({ date, status: "published" }).lean();
  const poolByCategory = Object.fromEntries(pools.map((p) => [p.category, p.questions]));

  const plan = CATEGORIES.map((category) => {
    const poolQuestions = poolByCategory[category] || [];
    const userQuestions = selectUserQuestions(userId, date, category, poolQuestions);
    return { category, questions: userQuestions };
  });

  return plan;
}

function stripAnswer(q) {
  const { answer, acceptableAnswers, ...safe } = q;
  return safe;
}

// POST /api/quiz/start - creates or resumes today's session
router.post("/start", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const date = todayKey();

  let session = await QuizSession.findOne({ user: userId, date });

  if (session && session.status !== "in_progress") {
    return res.status(409).json({ error: "You've already completed today's quiz." });
  }

  if (!session) {
    session = await QuizSession.create({ user: userId, date, status: "in_progress" });
  }

  const plan = await buildUserQuizPlan(userId, date);
  if (plan.every((round) => round.questions.length === 0)) {
    return res.status(503).json({ error: "Today's quiz isn't ready yet. Try again shortly." });
  }

  // Cache plan + hint counters in Redis for fast reads during the quiz
  await redis.set(
    redisKey(userId, date),
    JSON.stringify({
      plan,
      hintsUsedByCategory: {},
      currentCategoryIndex: session.currentCategoryIndex,
      currentQuestionIndex: session.currentQuestionIndex,
      violations: session.violations,
    }),
    { ex: 60 * 60 * 6 } // 6h TTL safety net
  );

  const currentRound = plan[session.currentCategoryIndex];
  const currentQuestion = currentRound?.questions[session.currentQuestionIndex];

  res.json({
    sessionId: session._id,
    categoryIndex: session.currentCategoryIndex,
    questionIndex: session.currentQuestionIndex,
    category: currentRound?.category,
    question: currentQuestion ? stripAnswer(currentQuestion) : null,
    timeLimitSec: QUESTION_TIME_LIMIT_SEC,
    hintsRemaining: HINTS_PER_CATEGORY,
    totalCategories: CATEGORIES.length,
    questionsPerRound: QUESTIONS_PER_ROUND,
  });
});

// POST /api/quiz/answer - submit an answer for the current question
router.post("/answer", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const date = todayKey();
  const { answer, timeTakenSec } = req.body;

  const session = await QuizSession.findOne({ user: userId, date });
  if (!session || session.status !== "in_progress") {
    return res.status(409).json({ error: "No active quiz session." });
  }

  const cached = await redis.get(redisKey(userId, date));
  const state = typeof cached === "string" ? JSON.parse(cached) : cached;
  if (!state) return res.status(410).json({ error: "Session expired, please restart." });

  const round = state.plan[session.currentCategoryIndex];
  const question = round?.questions[session.currentQuestionIndex];
  if (!question) return res.status(400).json({ error: "No current question." });

  const { correct, layer } = await checkAnswer(answer, question);

  session.answers.push({
    category: round.category,
    qid: question.qid,
    userAnswer: answer,
    correct,
    timeTakenSec,
  });
  if (correct) session.score += 1;

  // Advance pointer
  let { currentCategoryIndex, currentQuestionIndex } = session;
  currentQuestionIndex += 1;
  if (currentQuestionIndex >= round.questions.length) {
    currentQuestionIndex = 0;
    currentCategoryIndex += 1;
  }

  const finished = currentCategoryIndex >= CATEGORIES.length;

  session.currentCategoryIndex = currentCategoryIndex;
  session.currentQuestionIndex = currentQuestionIndex;
  if (finished) {
    session.status = "completed";
    session.completedAt = new Date();
    await User.findByIdAndUpdate(userId, {
      $inc: { totalScore: session.score, quizzesPlayed: 1 },
    });
  }
  await session.save();

  let nextQuestion = null;
  let nextCategory = null;
  if (!finished) {
    nextCategory = state.plan[currentCategoryIndex].category;
    nextQuestion = stripAnswer(state.plan[currentCategoryIndex].questions[currentQuestionIndex]);
    state.currentCategoryIndex = currentCategoryIndex;
    state.currentQuestionIndex = currentQuestionIndex;
    await redis.set(redisKey(userId, date), JSON.stringify(state), { ex: 60 * 60 * 6 });
  } else {
    await redis.del(redisKey(userId, date));
  }

  res.json({
    correct,
    matchLayer: layer,
    finished,
    score: session.score,
    category: nextCategory,
    question: nextQuestion,
    categoryIndex: currentCategoryIndex,
    questionIndex: currentQuestionIndex,
  });
});

// POST /api/quiz/hint - use one of 3 hints available per category
router.post("/hint", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const date = todayKey();

  const session = await QuizSession.findOne({ user: userId, date });
  if (!session || session.status !== "in_progress") {
    return res.status(409).json({ error: "No active quiz session." });
  }

  const cached = await redis.get(redisKey(userId, date));
  const state = typeof cached === "string" ? JSON.parse(cached) : cached;
  if (!state) return res.status(410).json({ error: "Session expired, please restart." });

  const round = state.plan[session.currentCategoryIndex];
  const question = round?.questions[session.currentQuestionIndex];
  if (!question) return res.status(400).json({ error: "No current question." });

  const used = state.hintsUsedByCategory[round.category] || 0;
  if (used >= HINTS_PER_CATEGORY) {
    return res.status(403).json({ error: "No hints remaining for this category." });
  }

  const hint = question.hints?.[used] || "No more hints available.";
  state.hintsUsedByCategory[round.category] = used + 1;
  await redis.set(redisKey(userId, date), JSON.stringify(state), { ex: 60 * 60 * 6 });

  res.json({ hint, hintsRemaining: HINTS_PER_CATEGORY - (used + 1) });
});

// POST /api/quiz/violation - tab-switch/blur detected on the client
router.post("/violation", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const date = todayKey();

  const session = await QuizSession.findOne({ user: userId, date });
  if (!session || session.status !== "in_progress") {
    return res.status(409).json({ error: "No active quiz session." });
  }

  session.violations += 1;

  if (session.violations > MAX_VIOLATIONS) {
    session.status = "terminated_violation";
    session.completedAt = new Date();
    await session.save();
    await redis.del(redisKey(userId, date));
    return res.json({ terminated: true, violations: session.violations });
  }

  await session.save();
  res.json({ terminated: false, violations: session.violations, warning: true });
});

export default router;
