import { geminiFlash } from "../config/gemini.js";
import { POOL_DIFFICULTY_SPLIT } from "../config/categories.js";

function buildPrompt(category, difficulty, count) {
  return `Generate ${count} quiz questions for the category "${category}" at "${difficulty}" difficulty.

Rules:
- Each question must be a FILL-IN-THE-BLANK or ONE-WORD-ANSWER style question.
- Base every question on verifiable, up-to-date, real-world facts (as of today).
- Avoid ambiguous questions with multiple valid answers, unless you list all acceptable answers.
- Provide 3 short progressive hints per question (hint 1 = vague, hint 3 = strong clue), none of which give away the answer outright.
- Answers should be short (1-3 words).

Respond with ONLY a JSON array (no markdown fences, no commentary), each item shaped exactly as:
{
  "text": "question text with ____ for the blank",
  "answer": "the primary correct answer",
  "acceptableAnswers": ["alternate phrasing 1", "alternate phrasing 2"],
  "hints": ["hint1", "hint2", "hint3"]
}`;
}

function safeParseJsonArray(rawText) {
  const cleaned = rawText.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // try to salvage a JSON array substring
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return [];
      }
    }
    return [];
  }
}

function isValidQuestion(q) {
  return (
    q &&
    typeof q.text === "string" &&
    q.text.trim().length > 0 &&
    typeof q.answer === "string" &&
    q.answer.trim().length > 0 &&
    Array.isArray(q.hints)
  );
}

/**
 * Generates questions for one category at one difficulty tier.
 * Returns an array of validated question objects (may be shorter than
 * requested `count` if generation/validation drops some).
 */
export async function generateQuestionsForTier(category, difficulty, count) {
  const prompt = buildPrompt(category, difficulty, count);

  const result = await geminiFlash.generateContent(prompt);
  const rawText = result.response.text();
  const parsed = safeParseJsonArray(rawText);

  return parsed
    .filter(isValidQuestion)
    .map((q, i) => ({
      qid: `${category}-${difficulty}-${Date.now()}-${i}`,
      text: q.text.trim(),
      answer: q.answer.trim(),
      acceptableAnswers: Array.isArray(q.acceptableAnswers) ? q.acceptableAnswers : [],
      difficulty,
      hints: q.hints.slice(0, 3),
      source: "gemini-flash-grounded",
    }));
}

/**
 * Generates a full day's pool for one category across all three difficulty
 * tiers, per POOL_DIFFICULTY_SPLIT.
 */
export async function generateCategoryPool(category) {
  const [hard, medium, easy] = await Promise.all([
    generateQuestionsForTier(category, "hard", POOL_DIFFICULTY_SPLIT.hard),
    generateQuestionsForTier(category, "medium", POOL_DIFFICULTY_SPLIT.medium),
    generateQuestionsForTier(category, "easy", POOL_DIFFICULTY_SPLIT.easy),
  ]);

  return [...hard, ...medium, ...easy];
}
