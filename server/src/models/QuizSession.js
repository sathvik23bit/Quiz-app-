import mongoose from "mongoose";

const answerSchema = new mongoose.Schema(
  {
    qid: String,
    userAnswer: String,
    correct: Boolean,
    hintsUsed: { type: Number, default: 0 },
    timeTakenSec: Number,
  },
  { _id: false }
);

// One session = one category attempt for one user on one day. Categories
// are played independently (player picks any category via buttons), each
// with its own one-shot-per-day attempt — not one combined 19-category
// session anymore.
const quizSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true }, // snapshot date, locks which pool this session uses
    category: { type: String, required: true },
    status: {
      type: String,
      enum: ["in_progress", "completed", "terminated_violation"],
      default: "in_progress",
    },
    currentQuestionIndex: { type: Number, default: 0 },
    answers: [answerSchema],
    score: { type: Number, default: 0 },
    violations: { type: Number, default: 0 }, // tab-switch / blur warnings
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

quizSessionSchema.index({ user: 1, date: 1, category: 1 }, { unique: true });

export default mongoose.model("QuizSession", quizSessionSchema);
