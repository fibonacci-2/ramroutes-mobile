// Tag vocabulary mirrors Admin/scraper/tagger.js's TAGS keys (see
// Admin/personal-v1.md's Tag Taxonomy table) - the scraper tags events with
// these same strings, and Admin/scraper/recommend.js scores events against
// this user field, so they must stay in sync with the Unity app's
// UserInterestsDropdown.cs, and with the externally-hosted tagging model
// (Admin/scraper/modelTagger.js's TAGGER_URL) that actually tags events at
// upload time - that service's prompt lives outside this repo and needs its
// own update to match. "greek life" isn't in that documented list, but real
// building-events docs use it, so it's added here to match the data layer.
//
// Discipline-level tags (political-science/social-sciences/humanities/stem/
// business) were tried in place of the generic "academic" tag, then dropped -
// PreferencesScreen's free-text "major" field (useStudentProfile) captures
// that signal directly and more precisely than a fixed tag list ever could.
// "tech" and "fitness" stay dropped: tech's scope (hackathons, coding, AI)
// is covered by "academic"; fitness had no interest signal and mostly
// duplicated "sports".
export const AVAILABLE_TAGS = [
  'academic',
  'sports',
  'arts',
  'social',
  'food',
  'career',
  'cultural',
  'spiritual',
  'mental-health',
  'greek life',
  'sustainability',
] as const;

export type Tag = (typeof AVAILABLE_TAGS)[number];
