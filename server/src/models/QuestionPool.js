import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    qid: { type: String, required: true }, // stable short id within the pool
    text: { type: String, required: true },
    answer: { type: String, required: true },
    acceptableAnswers: [{ type: String }], // alt phrasings for fuzzy/exact matching
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    hints: [{ type: String }],
    source: { type: String }, // where it was grounded from, if available
  },
  { _id: false }
);

const questionPoolSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // YYYY-MM-DD, snapshot key
    category: { type: String, required: true },
    questions: [questionSchema],
    status: { type: String, enum: ["pending", "published", "failed"], default: "pending" },
    generationNotes: { type: String }, // e.g. "backfilled 3 from evergreen bank"
  },
  { timestamps: true }
);

questionPoolSchema.index({ date: 1, category: 1 }, { unique: true });

export default mongoose.model("QuestionPool", questionPoolSchema);
