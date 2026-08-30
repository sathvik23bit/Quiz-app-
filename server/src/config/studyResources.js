// Static, curated study resources per category. Deliberately not
// AI-generated — keeps this free of extra Gemini calls (quota is tight) and
// gives consistent, vetted links rather than something the model invents.
export const STUDY_RESOURCES = {
  GENERAL: {
    tip: "Build broad awareness with daily news and general-knowledge digests rather than cramming facts.",
    url: "https://en.wikipedia.org/wiki/Portal:Current_events",
  },
  SCIENCES: {
    tip: "Focus on core concepts and recent discoveries — short explainer videos help more than memorizing terms.",
    url: "https://www.khanacademy.org/science",
  },
  HISTORY: {
    tip: "Build a timeline in your head — connecting events chronologically makes facts stick better than isolated dates.",
    url: "https://www.khanacademy.org/humanities/world-history",
  },
  "FLORA AND FAUNA": {
    tip: "Picture-based learning works best here — look at species alongside their names and habitats.",
    url: "https://www.nationalgeographic.com/animals",
  },
  BUSINESS: {
    tip: "Follow business news headlines regularly — most questions here track recent, real events.",
    url: "https://www.investopedia.com",
  },
  TECHNOLOGY: {
    tip: "Stay current with major tech releases and companies — a weekly tech news roundup covers most bases.",
    url: "https://techcrunch.com",
  },
  AI: {
    tip: "Track major model releases and AI news — this field moves fast, so recency matters more than depth.",
    url: "https://www.anthropic.com/news",
  },
  SPACE: {
    tip: "Follow major space agencies' updates — missions, launches, and discoveries are common question sources.",
    url: "https://www.nasa.gov",
  },
  SPIRITUALITY: {
    tip: "Read summaries of major world religions and philosophies rather than deep texts, for breadth.",
    url: "https://en.wikipedia.org/wiki/Portal:Religion",
  },
  POLITICS: {
    tip: "Follow current events and know key global leaders/positions — questions often track the news cycle.",
    url: "https://www.bbc.com/news/world",
  },
  SPORTS: {
    tip: "Keep up with recent tournament results and records across major sports, not just one favorite.",
    url: "https://www.espn.com",
  },
  "OLYMPICS AND PARALYMPICS": {
    tip: "Review recent Games' medal tallies and standout athletes — recency is key here.",
    url: "https://olympics.com",
  },
  AUTOMOBILES: {
    tip: "Follow major manufacturer announcements and new model releases for the most testable facts.",
    url: "https://www.caranddriver.com",
  },
  "SAI WORLD": {
    tip: "Review SSSIHL and Sathya Sai Organization publications for institution-specific facts and events.",
    url: "https://www.sssihl.edu.in",
  },
  ARCHITECTURE: {
    tip: "Learn landmark buildings by image and architect — visual recognition beats pure text memorization.",
    url: "https://www.archdaily.com",
  },
  LANGUAGES: {
    tip: "Learn language families and basic facts (script, speaker count, origin) rather than vocabulary.",
    url: "https://www.ethnologue.com",
  },
  "MUSIC AND CULTURE": {
    tip: "Cover a broad mix of eras and genres — questions often span classical to contemporary and across cultures.",
    url: "https://en.wikipedia.org/wiki/Portal:Arts",
  },
  COUNTRIES: {
    tip: "Study flags, capitals, and key facts together — visual + factual pairing aids recall.",
    url: "https://www.cia.gov/the-world-factbook",
  },
  RAPIDFIRE: {
    tip: "Practice quick recall across all topics — speed drills help more than deep study here.",
    url: "https://www.sporcle.com",
  },
};

export function getStudyResource(category) {
  return STUDY_RESOURCES[category] || {
    tip: "Review the topic broadly and revisit questions you got wrong to reinforce the correct facts.",
    url: "https://en.wikipedia.org",
  };
}
