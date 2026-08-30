import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

const CATEGORIES = [
  "GENERAL", "SCIENCES", "HISTORY", "FLORA AND FAUNA", "BUSINESS", "TECHNOLOGY",
  "AI", "SPACE", "SPIRITUALITY", "POLITICS", "SPORTS", "OLYMPICS AND PARALYMPICS",
  "AUTOMOBILES", "SAI WORLD", "ARCHITECTURE", "LANGUAGES", "MUSIC AND CULTURE",
  "COUNTRIES", "RAPIDFIRE",
];

const STUDY_LINKS = [
  { title: "Wikipedia — Current Events", url: "https://en.wikipedia.org/wiki/Portal:Current_events" },
  { title: "Khan Academy", url: "https://www.khanacademy.org" },
  { title: "NASA", url: "https://www.nasa.gov" },
  { title: "BBC News", url: "https://www.bbc.com/news" },
  { title: "CIA World Factbook", url: "https://www.cia.gov/the-world-factbook" },
  { title: "National Geographic", url: "https://www.nationalgeographic.com" },
];

export default function Dashboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [history, setHistory] = useState([]);
  const [analysis, setAnalysis] = useState({});
  const [dailyStats, setDailyStats] = useState([]);
  const [catLeaderCategory, setCatLeaderCategory] = useState(CATEGORIES[0]);
  const [catLeaderboard, setCatLeaderboard] = useState([]);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/dashboard/leaderboard").then((r) => setLeaderboard(r.data.leaderboard));
    api.get("/dashboard/history").then((r) => setHistory(r.data.history));
    api.get("/dashboard/analysis").then((r) => setAnalysis(r.data.byCategory));
    api.get("/dashboard/daily-stats").then((r) => setDailyStats(r.data.days));
  }, []);

  useEffect(() => {
    api
      .get(`/dashboard/leaderboard/${encodeURIComponent(catLeaderCategory)}`)
      .then((r) => setCatLeaderboard(r.data.leaderboard))
      .catch(() => setCatLeaderboard([]));
  }, [catLeaderCategory]);

  const chartData = Object.entries(analysis).map(([category, stats]) => ({
    category,
    accuracy: stats.total ? Math.round((stats.correct / stats.total) * 100) : 0,
  }));

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const todayScore = dailyStats.find((d) => d.date === today)?.score ?? 0;
  const yesterdayScore = dailyStats.find((d) => d.date === yesterday)?.score ?? 0;
  const delta = todayScore - yesterdayScore;

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>Welcome back, {user?.username}</h1>
          <p className="subtle">Ready for today's challenge?</p>
        </div>
        <div>
          <button className="primary-btn" onClick={() => navigate("/categories")}>
            Play Today's Quiz
          </button>
          <button className="link-btn" onClick={logout}>Log out</button>
        </div>
      </header>

      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-label">Today's Score</span>
          <span className="stat-value">{todayScore}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Yesterday</span>
          <span className="stat-value">{yesterdayScore}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Change</span>
          <span className={`stat-value ${delta >= 0 ? "stat-up" : "stat-down"}`}>
            {delta >= 0 ? "+" : ""}{delta}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">All-Time Total</span>
          <span className="stat-value">{user ? leaderboard.find((u) => u.username === user.username)?.totalScore ?? "—" : "—"}</span>
        </div>
      </div>

      <section className="card">
        <h2>Score Trend</h2>
        {dailyStats.length === 0 ? (
          <p className="subtle">Play a few days to see your trend here.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyStats}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="card">
        <h2>Your Category Accuracy</h2>
        {chartData.length === 0 ? (
          <p className="subtle">No quizzes played yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <XAxis dataKey="category" hide />
              <YAxis unit="%" />
              <Tooltip />
              <Bar dataKey="accuracy" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <div className="grid-two">
        <section className="card">
          <h2>Overall Leaderboard</h2>
          <ol className="leaderboard-list">
            {leaderboard.map((u) => (
              <li key={u.username}>
                <span>{u.username}</span>
                <span className="lb-score">{u.totalScore} pts</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="card">
          <h2>Category Leaderboard</h2>
          <select
            className="category-select"
            value={catLeaderCategory}
            onChange={(e) => setCatLeaderCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <ol className="leaderboard-list">
            {catLeaderboard.length === 0 ? (
              <p className="subtle">No one has completed this category today yet.</p>
            ) : (
              catLeaderboard.map((u, i) => (
                <li key={`${u.username}-${i}`}>
                  <span>{u.username}</span>
                  <span className="lb-score">{u.score}/20</span>
                </li>
              ))
            )}
          </ol>
        </section>
      </div>

      <section className="card">
        <h2>Your History</h2>
        <ul className="history-list">
          {history.map((s) => (
            <li key={`${s.date}-${s.category}`}>
              <span className="history-date">{s.date}</span>
              <span>{s.category}</span>
              <span className={`history-status status-${s.status}`}>{s.status}</span>
              <span className="lb-score">{s.score}/20</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>📚 Study Resources</h2>
        <p className="subtle">General resources to build broad knowledge across categories.</p>
        <div className="resource-links">
          {STUDY_LINKS.map((r) => (
            <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="resource-chip">
              {r.title}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
