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

// Pool generated per category per day (buffer above the 20 a user needs,
// so different users can get different subsets/order).
export const POOL_SIZE_PER_CATEGORY = 30;
export const POOL_DIFFICULTY_SPLIT = {
  hard: 21,
  medium: 6,
  easy: 3,
};
