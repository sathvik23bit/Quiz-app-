import mongoose from "mongoose";

const answerSchema = new mongoose.Schema(
  {
    category: String,
    qid: String,
    userAnswer: String,
    correct: Boolean,
    hintsUsed: { type: Number, default: 0 },
    timeTakenSec: Number,
  },
  { _id: false }
);

const quizSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true }, // snapshot date, locks which pool this session uses
    status: {
      type: String,
      enum: ["in_progress", "completed", "terminated_violation"],
      default: "in_progress",
    },
    currentCategoryIndex: { type: Number, default: 0 },
    currentQuestionIndex: { type: Number, default: 0 },
    answers: [answerSchema],
    score: { type: Number, default: 0 },
    violations: { type: Number, default: 0 }, // tab-switch / blur warnings
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

quizSessionSchema.index({ user: 1, date: 1 }, { unique: true });

export default mongoose.model("QuizSession", quizSessionSchema);
