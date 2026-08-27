import levenshtein from "fast-levenshtein";
import { geminiFlashLite } from "../config/gemini.js";
import { redis } from "../config/redis.js";

function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

// Layer 1: exact match against answer + any acceptable alternates
function exactMatch(userAnswer, question) {
  const norm = normalize(userAnswer);
  const candidates = [question.answer, ...(question.acceptableAnswers || [])].map(normalize);
  return candidates.includes(norm);
}

// Layer 2: fuzzy match - allow small edit distance relative to word length
function fuzzyMatch(userAnswer, question) {
  const norm = normalize(userAnswer);
  const candidates = [question.answer, ...(question.acceptableAnswers || [])].map(normalize);
  return candidates.some((c) => {
    const maxDist = c.length <= 4 ? 0 : c.length <= 8 ? 1 : 2;
    return levenshtein.get(norm, c) <= maxDist;
  });
}

// Layer 3: LLM semantic fallback, only for ambiguous cases, with Redis caching
async function semanticMatch(userAnswer, question) {
  const cacheKey = `eval:${question.qid}:${normalize(userAnswer)}`;
  const cached = await redis.get(cacheKey).catch(() => null);
  if (cached !== null && cached !== undefined) return cached === true || cached === "true";

  const prompt = `Question: "${question.text}"
Correct answer: "${question.answer}"
User's answer: "${userAnswer}"

Is the user's answer semantically correct (allowing for synonyms, minor spelling variation, or equivalent phrasing)? Reply with only "true" or "false".`;

  try {
    const result = await geminiFlashLite.generateContent(prompt);
    const text = result.response.text().trim().toLowerCase();
    const verdict = text.startsWith("true");
    await redis.set(cacheKey, verdict, { ex: 60 * 60 * 24 }).catch(() => {});
    return verdict;
  } catch (err) {
    console.error("[answerCheck] Gemini fallback failed:", err.message);
    return false; // fail safe: don't award credit if we can't verify
  }
}

/**
 * Returns { correct: boolean, layer: 'exact'|'fuzzy'|'semantic' }
 */
export async function checkAnswer(userAnswer, question) {
  if (!userAnswer || !userAnswer.trim()) return { correct: false, layer: "empty" };

  if (exactMatch(userAnswer, question)) return { correct: true, layer: "exact" };
  if (fuzzyMatch(userAnswer, question)) return { correct: true, layer: "fuzzy" };

  const semantic = await semanticMatch(userAnswer, question);
  return { correct: semantic, layer: "semantic" };
}
