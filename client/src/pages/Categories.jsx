import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api.js";

// Simple emoji icon per category so buttons feel visual without needing a
// backend image pipeline for the category-select screen itself (per-question
// images inside the quiz are separate, fetched via search phrase).
const CATEGORY_ICONS = {
  GENERAL: "🧠",
  SCIENCES: "🔬",
  HISTORY: "📜",
  "FLORA AND FAUNA": "🌿",
  BUSINESS: "💼",
  TECHNOLOGY: "💻",
  AI: "🤖",
  SPACE: "🚀",
  SPIRITUALITY: "🕉️",
  POLITICS: "🏛️",
  SPORTS: "⚽",
  "OLYMPICS AND PARALYMPICS": "🏅",
  AUTOMOBILES: "🚗",
  "SAI WORLD": "🙏",
  ARCHITECTURE: "🏗️",
  LANGUAGES: "🗣️",
  "MUSIC AND CULTURE": "🎵",
  COUNTRIES: "🌍",
  RAPIDFIRE: "⚡",
};

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get("/quiz/categories")
      .then(({ data }) => setCategories(data.categories))
      .catch((err) => setError(err.response?.data?.error || "Could not load categories"))
      .finally(() => setLoading(false));
  }, []);

  function statusLabel(status) {
    if (status === "completed") return "Completed";
    if (status === "terminated_violation") return "Ended (violation)";
    if (status === "in_progress") return "In progress";
    return "Not started";
  }

  function handleSelect(cat) {
    if (!cat.ready) return;
    if (cat.status === "completed" || cat.status === "terminated_violation") return;
    navigate(`/quiz/${encodeURIComponent(cat.category)}`);
  }

  if (loading) return <div className="centered-page">Loading categories...</div>;

  const completedCount = categories.filter((c) => c.status === "completed").length;
  const progressPct = categories.length ? Math.round((completedCount / categories.length) * 100) : 0;

  return (
    <div className="page">
      <h1>Choose a Category</h1>
      <div className="progress-wrap">
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="progress-label">{completedCount}/{categories.length} categories completed today</span>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="category-grid">
        {categories.map((cat) => {
          const locked =
            !cat.ready || cat.status === "completed" || cat.status === "terminated_violation";
          return (
            <button
              key={cat.category}
              className={`category-tile ${locked ? "locked" : ""}`}
              onClick={() => handleSelect(cat)}
              disabled={locked}
            >
              <span className="category-icon">{CATEGORY_ICONS[cat.category] || "❓"}</span>
              <span className="category-name">{cat.category}</span>
              <span className={`category-status status-${cat.status}`}>
                {statusLabel(cat.status)}
                {cat.score !== null ? ` · ${cat.score}/20` : ""}
              </span>
              {!cat.ready && <span className="category-status">Not ready yet</span>}
            </button>
          );
        })}
      </div>
      <button className="link-btn" onClick={() => navigate("/")}>
        Back to Dashboard
      </button>
    </div>
  );
}
