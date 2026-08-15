// Tag vocabulary mirrors Admin/scraper/tagger.js's TAGS keys (see PLAN.md's Tag
// Taxonomy table) - the scraper tags events with these same strings, and
// Admin/scraper/recommend.js scores events against this user field, so they
// must stay in sync with the Unity app's UserInterestsDropdown.cs.
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
] as const;

export type Tag = (typeof AVAILABLE_TAGS)[number];
