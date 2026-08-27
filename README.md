# Quiz App

Daily multi-category quiz web app. 19 categories × 20 questions/day, generated
via Gemini (grounded), with per-user randomized selection from a shared daily
pool, fuzzy + semantic answer checking, tab-switch anti-cheat, and a
leaderboard/dashboard.

## Stack
- **Backend**: Node.js, Express, MongoDB (Mongoose), Upstash Redis, Google
  Gemini API
- **Frontend**: React (Vite), React Router, Recharts

## Setup

### 1. Install dependencies
```bash
npm run install:all
```

### 2. Configure environment variables

**Server** — copy `server/.env.example` to `server/.env` and fill in:
- `MONGO_URI` — your MongoDB Atlas connection string
- `JWT_SECRET` / `SESSION_SALT` — any long random strings
- `GEMINI_API_KEY` — your Gemini API key
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — from Upstash

**Client** — copy `client/.env.example` to `client/.env` (default should work
for local dev).

### 3. Seed the evergreen fallback bank (optional but recommended)
```bash
cd server && npm run generate-pool  # or just run once manually
node src/scripts/seedEvergreen.js
```

### 4. Generate today's question pool
The pool auto-generates daily via cron (00:05 server time) once the server is
running. To generate it manually for testing:
```bash
cd server && npm run generate-pool
```

### 5. Run the app
```bash
# terminal 1
npm run server

# terminal 2
npm run client
```

Visit `http://localhost:5173`.

## How it works

- **Daily pool generation** (`server/src/scripts/generateDailyPool.js`):
  once a day, generates ~30 questions per category (across difficulty tiers)
  via Gemini, with grounding for up-to-date facts. Falls back to the
  evergreen bank if generation underperforms for a category.
- **Per-user randomization** (`server/src/utils/seededShuffle.js`): each
  user's 20-question subset and order per category is deterministically
  derived from `hash(userId + date + category + serverSalt)` — different
  per user, but stable across reconnects.
- **Answer checking** (`server/src/utils/answerCheck.js`): three layers —
  exact match → fuzzy (Levenshtein) match → Gemini semantic fallback (cached
  in Redis to avoid repeat calls).
- **Anti-cheat**: tab-switch/blur events reported to `/api/quiz/violation`;
  first instance warns, second ends the quiz.
- **Session state**: cached in Redis (survives server restarts), persisted
  incrementally in MongoDB (`QuizSession`).

## Admin

Manually promote a user to admin via MongoDB:
```js
db.users.updateOne({ username: "youradminuser" }, { $set: { role: "admin" } })
```

Admin endpoints (`/api/admin/*`):
- `GET /api/admin/pools` — view today's pool health per category
- `POST /api/admin/pools/:category/regenerate` — regenerate one category
- `DELETE /api/admin/pools/:category/questions/:qid` — remove a flagged question

## Notes / known limitations
- Free-tier Gemini rate limits are respected by spacing out category
  generation calls (~20s apart) — full daily generation takes a few minutes.
- Anti-cheat (tab/blur detection) is a deterrent, not foolproof — it can be
  bypassed with a second device or similar.
- Question quality depends on LLM grounding; the evergreen bank and admin
  regenerate/remove tools exist as the human-in-the-loop safety net.
