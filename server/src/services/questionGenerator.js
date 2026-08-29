import { geminiFlashLite } from "../config/gemini.js";
import {
  QUESTIONS_PER_ROUND,
  DIFFICULTY_SPLIT,
  IMAGE_QUESTIONS_PER_CATEGORY,
} from "../config/categories.js";

// Single combined prompt per category (1 Gemini request instead of many) —
// Google's free-tier daily quota (RPD) is tight (as low as 20/day on some
// models), so 19 categories x 1 call = 19 requests/day total.
function buildPrompt(category) {
  return `Generate exactly ${QUESTIONS_PER_ROUND} quiz questions for the category "${category}".

Difficulty distribution (MUST be exact):
- Hard: ${DIFFICULTY_SPLIT.hard} questions
- Medium: ${DIFFICULTY_SPLIT.medium} questions
- Easy: ${DIFFICULTY_SPLIT.easy} questions

Image questions:
- Exactly ${IMAGE_QUESTIONS_PER_CATEGORY} of the ${QUESTIONS_PER_ROUND} questions must be "image questions" — a question that shows a picture and asks the player to identify/answer something about it (e.g. "Which country's flag is this?", "Name this animal", "Identify this landmark").
- For an image question, set "isImageQuestion": true and "imageQuery": a short (2-5 word) plain-English search phrase that would find a clear, appropriate photo for this question (e.g. "Japan flag", "Eiffel Tower Paris", "Bengal tiger").
- For all other questions, set "isImageQuestion": false and "imageQuery": null.

Rules:
- Each question must be a FILL-IN-THE-BLANK or ONE-WORD-ANSWER style question.
- Base every question on verifiable, up-to-date, real-world facts (as of today).
- Avoid ambiguous questions with multiple valid answers, unless you list all acceptable answers.
- Provide 3 short progressive hints per question (hint 1 = vague, hint 3 = strong clue), none of which give away the answer outright.
- Provide a short 1-2 sentence "explanation" for each question — the reasoning/context for why the answer is correct, shown to the player after they answer (right or wrong).
- Answers should be short (1-3 words).
- Do not repeat questions or ask the same fact in different wording.
- Difficulty must genuinely match the assigned level.
- Return exactly ${QUESTIONS_PER_ROUND} questions total: ${DIFFICULTY_SPLIT.hard} hard, ${DIFFICULTY_SPLIT.medium} medium, ${DIFFICULTY_SPLIT.easy} easy, and exactly ${IMAGE_QUESTIONS_PER_CATEGORY} marked as image questions.

Respond with ONLY a JSON array (no markdown fences, no commentary), each item shaped exactly as:
{
  "text": "question text with ____ for the blank",
  "answer": "the primary correct answer",
  "acceptableAnswers": ["alternate phrasing 1", "alternate phrasing 2"],
  "difficulty": "hard" | "medium" | "easy",
  "hints": ["hint1", "hint2", "hint3"],
  "explanation": "short reason/context for the correct answer",
  "isImageQuestion": true | false,
  "imageQuery": "short image search phrase" | null
}`;
}

function safeParseJsonArray(rawText) {
  const cleaned = rawText.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
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
    ["hard", "medium", "easy"].includes(q.difficulty) &&
    Array.isArray(q.hints)
  );
}

/**
 * Generates a full day's pool for one category in a single Gemini call,
 * mixing all three difficulty tiers and image/non-image questions in one
 * prompt/response.
 */
export async function generateCategoryPool(category) {
  const prompt = buildPrompt(category);

  const result = await geminiFlashLite.generateContent(prompt);
  const rawText = result.response.text();
  const parsed = safeParseJsonArray(rawText);

  return parsed
    .filter(isValidQuestion)
    .map((q, i) => ({
      qid: `${category}-${q.difficulty}-${Date.now()}-${i}`,
      text: q.text.trim(),
      answer: q.answer.trim(),
      acceptableAnswers: Array.isArray(q.acceptableAnswers) ? q.acceptableAnswers : [],
      difficulty: q.difficulty,
      hints: q.hints.slice(0, 3),
      explanation: typeof q.explanation === "string" ? q.explanation.trim() : "",
      isImageQuestion: !!q.isImageQuestion,
      imageQuery: q.isImageQuestion && typeof q.imageQuery === "string" ? q.imageQuery.trim() : null,
      source: "gemini-flash-lite-grounded",
    }));
}
