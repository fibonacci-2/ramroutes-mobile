// Discipline-level tags (political-science/social-sciences/humanities/stem/
// business) were tried in place of "academic", then dropped - the app's
// PreferencesScreen now collects a free-text "major" field directly (see
// ramroutes-mobile/src/constants/tags.ts for the full rationale). "tech" and
// "fitness" stay dropped. Keep this vocabulary in sync with that file, and
// with openrouterTagger.js's prompt (which reads TAGS directly, so it stays
// in sync automatically) and modelTagger.js's TAGGER_URL fallback model,
// which is the actual tagger used at upload time and needs its own prompt
// updated separately.
const TAGS = {
  academic:  ["study", "research", "lecture", "workshop", "seminar", "tutoring", "thesis", "gre", "lsat", "academic", "exam", "quiz"],
  sports:    ["game", "match", "tournament", "intramural", "practice", "volleyball", "soccer", "basketball", "lacrosse", "tennis", "swim", "sport", "athlete"],
  arts:      ["concert", "performance", "dance", "art", "exhibit", "theater", "tango", "music", "gallery", "recital", "show", "play", "improv", "choir", "orchestra"],
  social:    ["mixer", "social", "hangout", "networking", "party", "welcome", "gathering", "meetup", "happy hour", "bonding", "celebration", "reunion"],
  food:      ["food", "tasting", "dining", "cook", "bake", "cuisine", "restaurant", "eat", "meal", "snack", "potluck", "brunch"],
  career:    ["career", "internship", "job", "resume", "interview", "professional", "employer", "recruiting", "hiring", "industry"],
  cultural:  ["culture", "heritage", "international", "diversity", "identity", "pride", "tradition", "multicultural", "global", "awareness"],
  spiritual: ["prayer", "faith", "chapel", "meditation", "spiritual", "mass", "worship", "religious", "interfaith", "dharma"],
  "mental-health": ["mental health", "counseling", "counselling", "therapy", "self-care", "self care", "stress relief", "anxiety", "depression", "mindfulness", "meditation", "wellbeing", "well-being", "support group", "crisis support", "resilience"],
  sustainability: ["sustainability", "sustainable", "climate", "environment", "environmental", "recycle", "recycling", "compost", "composting", "green", "eco", "renewable", "conservation", "zero waste", "carbon"],
};

// Returns array of matching tag strings for a given event
function tagEvent({ eventName = "", description = "" }) {
  const text = `${eventName} ${description}`.toLowerCase();
  return Object.entries(TAGS)
    .filter(([, keywords]) => keywords.some((kw) => text.includes(kw)))
    .map(([tag]) => tag);
}

module.exports = { tagEvent, TAGS };
