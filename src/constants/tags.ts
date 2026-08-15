// Tag vocabulary mirrors Admin/scraper/tagger.js's TAGS keys (see PLAN.md's Tag
// Taxonomy table) - the scraper tags events with these same strings, and
// Admin/scraper/recommend.js scores events against this user field, so they
// must stay in sync with the Unity app's UserInterestsDropdown.cs.
// "greek life" isn't in that documented list, but real building-events docs
// use it, so it's added here to match the data layer.
export const AVAILABLE_TAGS = [
  'academic',
  'sports',
  'arts',
  'social',
  'food',
  'career',
  'cultural',
  'spiritual',
  'tech',
  'fitness',
  'mental-health',
  'greek life',
] as const;

export type Tag = (typeof AVAILABLE_TAGS)[number];
