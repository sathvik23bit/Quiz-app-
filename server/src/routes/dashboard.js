import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import User from "../models/User.js";
import QuizSession from "../models/QuizSession.js";

const router = Router();

// GET /api/dashboard/leaderboard
router.get("/leaderboard", requireAuth, async (req, res) => {
  const top = await User.find({ role: "user" })
    .sort({ totalScore: -1 })
    .limit(50)
    .select("username totalScore quizzesPlayed")
    .lean();

  res.json({ leaderboard: top });
});

// GET /api/dashboard/history
router.get("/history", requireAuth, async (req, res) => {
  const sessions = await QuizSession.find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .limit(30)
    .select("date status score violations completedAt")
    .lean();

  res.json({ history: sessions });
});

// GET /api/dashboard/analysis - category-wise performance breakdown
router.get("/analysis", requireAuth, async (req, res) => {
  const sessions = await QuizSession.find({ user: req.user.id }).lean();

  const byCategory = {};
  for (const session of sessions) {
    for (const ans of session.answers || []) {
      if (!byCategory[ans.category]) byCategory[ans.category] = { correct: 0, total: 0 };
      byCategory[ans.category].total += 1;
      if (ans.correct) byCategory[ans.category].correct += 1;
    }
  }

  res.json({ byCategory });
});

export default router;
