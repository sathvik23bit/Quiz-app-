import mongoose from "mongoose";

const evergreenSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    text: { type: String, required: true },
    answer: { type: String, required: true },
    acceptableAnswers: [{ type: String }],
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    hints: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.model("EvergreenQuestion", evergreenSchema);
