import "dotenv/config";
import express from "express";
import cors from "cors";
import cron from "node-cron";

import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import quizRoutes from "./routes/quiz.js";
import dashboardRoutes from "./routes/dashboard.js";
import adminRoutes from "./routes/admin.js";
import { runDailyGeneration } from "./scripts/generateDailyPool.js";

// Last-resort safety net: an error thrown inside an async route handler
// that isn't caught locally becomes an unhandled rejection, which by
// default crashes the whole Node process (as we saw with a MongoDB
// duplicate-key error taking down every user's session). Logging instead
// of exiting keeps the server up for everyone else while we fix the
// underlying bug.
process.on("unhandledRejection", (err) => {
  console.error("[server] Unhandled promise rejection:", err);
});

const app = express();

app.use(
  cors({
    // Trigger endpoint is protected by its own secret key and needs to be
    // callable from a local file:// page (no origin) during initial setup,
    // so it's allowed regardless of origin. Everything else stays locked
    // to CLIENT_ORIGIN.
    origin: (origin, callback) => {
      if (!origin || origin === "null") return callback(null, true); // file:// or curl/no-origin requests
      const allowed = process.env.CLIENT_ORIGIN || "http://localhost:5173";
      if (origin === allowed) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);

// Catches errors thrown/rejected inside any route handler above (e.g. an
// unexpected DB error) so a single bad request returns a 500 to the client
// instead of crashing the entire process and taking down every user's
// session. Must be registered after all routes.
app.use((err, req, res, next) => {
  console.error("[server] Unhandled route error:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`[server] listening on port ${PORT}`));

    // Runs once daily at 00:05 server time, ahead of user traffic.
    cron.schedule("5 0 * * *", () => {
      console.log("[cron] Triggering daily question pool generation");
      runDailyGeneration().catch((err) =>
        console.error("[cron] Daily generation failed:", err)
      );
    });
  })
  .catch((err) => {
    console.error("[server] Failed to start:", err);
    process.exit(1);
  });
