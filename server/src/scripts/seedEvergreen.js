import "dotenv/config";
import { connectDB } from "../config/db.js";
import EvergreenQuestion from "../models/EvergreenQuestion.js";

// A small starter bank per category. Expand this over time — this is the
// safety net used only when live generation falls short for a category.
const SEED_QUESTIONS = [
  {
    category: "GENERAL",
    text: "The currency of Japan is the ____.",
    answer: "Yen",
    difficulty: "easy",
    hints: ["It's an East Asian currency", "Symbol is ¥", "Starts with Y"],
  },
  {
    category: "SCIENCES",
    text: "The chemical symbol for gold is ____.",
    answer: "Au",
    difficulty: "easy",
    hints: ["Latin name Aurum", "Two letters", "Starts with A"],
  },
  {
    category: "SPACE",
    text: "The closest planet to the Sun is ____.",
    answer: "Mercury",
    difficulty: "easy",
    hints: ["Named after a Roman god", "Smallest planet", "Starts with M"],
  },
  // Add more per category as needed — this file is meant to grow over time.
];

async function run() {
  await connectDB();
  for (const q of SEED_QUESTIONS) {
    await EvergreenQuestion.updateOne(
      { category: q.category, text: q.text },
      q,
      { upsert: true }
    );
  }
  console.log(`Seeded ${SEED_QUESTIONS.length} evergreen questions.`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
