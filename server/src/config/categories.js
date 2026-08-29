export const CATEGORIES = [
  "GENERAL",
  "SCIENCES",
  "HISTORY",
  "FLORA AND FAUNA",
  "BUSINESS",
  "TECHNOLOGY",
  "AI",
  "SPACE",
  "SPIRITUALITY",
  "POLITICS",
  "SPORTS",
  "OLYMPICS AND PARALYMPICS",
  "AUTOMOBILES",
  "SAI WORLD",
  "ARCHITECTURE",
  "LANGUAGES",
  "MUSIC AND CULTURE",
  "COUNTRIES",
  "RAPIDFIRE",
];

// Per-round composition out of 20 questions: 70% hard, 20% medium, 10% easy
export const QUESTIONS_PER_ROUND = 20;
export const DIFFICULTY_SPLIT = {
  hard: 14,
  medium: 4,
  easy: 2,
};

// Pool size matches exactly what's needed per round (no buffer) — a bigger
// buffer would need a bigger Gemini prompt/response per category, and free
// tier daily quotas are now tight enough (as low as 20 requests/day on some
// models) that we generate exactly one 20-question set per category per
// day. Trade-off: all users see the same 20 questions per category, just in
// a different (deterministic, per-user) order — not a different subset.
export const POOL_SIZE_PER_CATEGORY = QUESTIONS_PER_ROUND;
export const POOL_DIFFICULTY_SPLIT = DIFFICULTY_SPLIT;

// Of the 20 questions per category, this many are image-based.
export const IMAGE_QUESTIONS_PER_CATEGORY = 2;
