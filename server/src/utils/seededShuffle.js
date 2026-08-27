import crypto from "crypto";
import { QUESTIONS_PER_ROUND, DIFFICULTY_SPLIT } from "../config/categories.js";

const SALT = process.env.SESSION_SALT || "change_me_in_env";

// Deterministic 32-bit seed from userId + date + category, salted server-side
// so seeds can't be guessed/predicted by comparing users' visible IDs.
function makeSeed(userId, date, category) {
  const hash = crypto
    .createHash("sha256")
    .update(`${userId}:${date}:${category}:${SALT}`)
    .digest();
  return hash.readUInt32BE(0);
}

// Mulberry32 - small deterministic PRNG seeded by a 32-bit int
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithRng(arr, rng) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickN(arr, n, rng) {
  return shuffleWithRng(arr, rng).slice(0, Math.min(n, arr.length));
}

/**
 * Given a category's full daily pool (e.g. 30 questions), deterministically
 * select this user's 20-question subset + order for that round.
 * Same user + same date + same category => identical result every time
 * (handles reconnects without re-rolling).
 */
export function selectUserQuestions(userId, date, category, poolQuestions) {
  const seed = makeSeed(userId, date, category);
  const rng = mulberry32(seed);

  const byDifficulty = {
    hard: poolQuestions.filter((q) => q.difficulty === "hard"),
    medium: poolQuestions.filter((q) => q.difficulty === "medium"),
    easy: poolQuestions.filter((q) => q.difficulty === "easy"),
  };

  let selected = [
    ...pickN(byDifficulty.hard, DIFFICULTY_SPLIT.hard, rng),
    ...pickN(byDifficulty.medium, DIFFICULTY_SPLIT.medium, rng),
    ...pickN(byDifficulty.easy, DIFFICULTY_SPLIT.easy, rng),
  ];

  // Backfill if a tier came up short (small pools / niche categories)
  if (selected.length < QUESTIONS_PER_ROUND) {
    const usedIds = new Set(selected.map((q) => q.qid));
    const remaining = poolQuestions.filter((q) => !usedIds.has(q.qid));
    selected = [
      ...selected,
      ...pickN(remaining, QUESTIONS_PER_ROUND - selected.length, rng),
    ];
  }

  return shuffleWithRng(selected, rng).slice(0, QUESTIONS_PER_ROUND);
}
