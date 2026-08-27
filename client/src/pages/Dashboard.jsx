import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import api from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Dashboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [history, setHistory] = useState([]);
  const [analysis, setAnalysis] = useState({});
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/dashboard/leaderboard").then((r) => setLeaderboard(r.data.leaderboard));
    api.get("/dashboard/history").then((r) => setHistory(r.data.history));
    api.get("/dashboard/analysis").then((r) => setAnalysis(r.data.byCategory));
  }, []);

  const chartData = Object.entries(analysis).map(([category, stats]) => ({
    category,
    accuracy: stats.total ? Math.round((stats.correct / stats.total) * 100) : 0,
  }));

  return (
    <div className="page">
      <header className="topbar">
        <h1>Welcome, {user?.username}</h1>
        <div>
          <button onClick={() => navigate("/quiz")}>Play Today's Quiz</button>
          <button className="link-btn" onClick={logout}>Log out</button>
        </div>
      </header>

      <section className="card">
        <h2>Your Category Accuracy</h2>
        {chartData.length === 0 ? (
          <p>No quizzes played yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <XAxis dataKey="category" hide />
              <YAxis unit="%" />
              <Tooltip />
              <Bar dataKey="accuracy" fill="#4f46e5" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <div className="grid-two">
        <section className="card">
          <h2>Leaderboard</h2>
          <ol>
            {leaderboard.map((u) => (
              <li key={u.username}>
                {u.username} — {u.totalScore} pts ({u.quizzesPlayed} quizzes)
              </li>
            ))}
          </ol>
        </section>

        <section className="card">
          <h2>Your History</h2>
          <ul>
            {history.map((s) => (
              <li key={s.date}>
                {s.date}: {s.status} — score {s.score}
                {s.violations > 0 ? ` (violations: ${s.violations})` : ""}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
