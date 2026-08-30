import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import User from "../models/User.js";
import QuizSession from "../models/QuizSession.js";
import { CATEGORIES } from "../config/categories.js";

const router = Router();

// GET /api/dashboard/leaderboard - overall (summed across all categories)
router.get("/leaderboard", requireAuth, async (req, res) => {
  const top = await User.find({ role: "user" })
    .sort({ totalScore: -1 })
    .limit(50)
    .select("username totalScore quizzesPlayed")
    .lean();

  res.json({ leaderboard: top });
});

// GET /api/dashboard/leaderboard/:category - top scorers for one specific
// category, today. Each category has its own independent leaderboard.
router.get("/leaderboard/:category", requireAuth, async (req, res) => {
  const { category } = req.params;
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: "Unknown category" });
  }
  const date = new Date().toISOString().slice(0, 10);

  const top = await QuizSession.find({ category, date, status: "completed" })
    .sort({ score: -1, completedAt: 1 })
    .limit(20)
    .populate("user", "username")
    .select("user score completedAt")
    .lean();

  res.json({
    category,
    date,
    leaderboard: top.map((s) => ({
      username: s.user?.username || "Unknown",
      score: s.score,
    })),
  });
});

// GET /api/dashboard/history
router.get("/history", requireAuth, async (req, res) => {
  const sessions = await QuizSession.find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .select("date category status score violations completedAt")
    .lean();

  res.json({ history: sessions });
});

// GET /api/dashboard/analysis - category-wise performance breakdown
router.get("/analysis", requireAuth, async (req, res) => {
  const sessions = await QuizSession.find({ user: req.user.id }).lean();

  const byCategory = {};
  for (const session of sessions) {
    const category = session.category;
    if (!category) continue;
    if (!byCategory[category]) byCategory[category] = { correct: 0, total: 0 };
    for (const ans of session.answers || []) {
      byCategory[category].total += 1;
      if (ans.correct) byCategory[category].correct += 1;
    }
  }

  res.json({ byCategory });
});

// GET /api/dashboard/daily-stats - score summed per day, most recent first,
// for a trend line of recent activity (today vs previous days).
router.get("/daily-stats", requireAuth, async (req, res) => {
  const sessions = await QuizSession.find({ user: req.user.id, status: "completed" })
    .select("date score")
    .lean();

  const byDate = {};
  for (const s of sessions) {
    byDate[s.date] = (byDate[s.date] || 0) + s.score;
  }

  const days = Object.entries(byDate)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-14) // last 14 days with activity
    .map(([date, score]) => ({ date, score }));

  res.json({ days });
});

export default router;
