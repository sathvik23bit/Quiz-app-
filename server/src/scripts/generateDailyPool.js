import "dotenv/config";
import { connectDB } from "../config/db.js";
import QuestionPool from "../models/QuestionPool.js";
import EvergreenQuestion from "../models/EvergreenQuestion.js";
import { generateCategoryPool } from "../services/questionGenerator.js";
import { CATEGORIES, POOL_SIZE_PER_CATEGORY } from "../config/categories.js";

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function backfillFromEvergreen(category, shortfall) {
  const extras = await EvergreenQuestion.find({ category })
    .limit(shortfall)
    .lean();
  return extras.map((q, i) => ({
    qid: `${category}-evergreen-${Date.now()}-${i}`,
    text: q.text,
    answer: q.answer,
    acceptableAnswers: q.acceptableAnswers || [],
    difficulty: q.difficulty,
    hints: q.hints || [],
    source: "evergreen-fallback",
  }));
}

async function generateOneCategory(date, category) {
  try {
    let questions = await generateCategoryPool(category);
    let notes = "";

    if (questions.length !== POOL_SIZE_PER_CATEGORY) {
      const shortfall = POOL_SIZE_PER_CATEGORY - questions.length;
      if (shortfall > 0) {
        const backfill = await backfillFromEvergreen(category, shortfall);
        questions = [...questions, ...backfill];
        notes = `Backfilled ${backfill.length} from evergreen bank (Gemini returned ${questions.length - backfill.length}/${POOL_SIZE_PER_CATEGORY}).`;
        console.warn(`[pool] ${category}: ${notes}`);
      } else {
        // Gemini returned more than needed (shouldn't happen, but be safe)
        questions = questions.slice(0, POOL_SIZE_PER_CATEGORY);
      }
    }

    const status = questions.length > 0 ? "published" : "failed";

    await QuestionPool.findOneAndUpdate(
      { date, category },
      { date, category, questions, status, generationNotes: notes },
      { upsert: true, new: true }
    );

    console.log(`[pool] ${category}: ${questions.length} questions, status=${status}`);
  } catch (err) {
    console.error(`[pool] ${category} generation failed:`, err.message);
    await QuestionPool.findOneAndUpdate(
      { date, category },
      { date, category, questions: [], status: "failed", generationNotes: err.message },
      { upsert: true, new: true }
    );
  }
}

export async function runDailyGeneration() {
  const date = todayKey();
  console.log(`[pool] Starting daily generation for ${date}`);

  // Skip categories already published today — a mid-run deploy or restart
  // shouldn't force re-spending quota on categories that already succeeded.
  const alreadyPublished = await QuestionPool.find({ date, status: "published" })
    .distinct("category");
  const skipSet = new Set(alreadyPublished);
  const pending = CATEGORIES.filter((c) => !skipSet.has(c));

  if (skipSet.size > 0) {
    console.log(`[pool] Skipping ${skipSet.size} already-published categories: ${[...skipSet].join(", ")}`);
  }
  console.log(`[pool] ${pending.length} categories remaining: ${pending.join(", ")}`);

  // Run categories sequentially with a small delay to stay well within
  // Gemini free-tier RPM limits. One call per category now, so ~1 category
  // every ~20s keeps us safely under.
  for (const category of pending) {
    await generateOneCategory(date, category);
    await new Promise((r) => setTimeout(r, 20_000));
  }

  console.log(`[pool] Daily generation complete for ${date}`);
}

// Allow running directly: `npm run generate-pool`
if (import.meta.url === `file://${process.argv[1]}`) {
  connectDB()
    .then(runDailyGeneration)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
