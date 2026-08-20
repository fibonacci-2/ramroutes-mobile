// Weighted so the fields that matter most to recommendation quality count
// for the most: interests feed scoreEvent's tagOverlap term directly
// (functions/index.js/scraper/recommend.js), bio and major both feed the
// embedded profile text (profileText in functions/index.js), class year is
// metadata only, no recommendation signal. Weights sum to 100 and are
// strictly descending, per the requested priority: tags > bio > major >
// classYear.
const WEIGHTS = {
  tags: 40,
  bio: 30,
  major: 20,
  classYear: 10,
} as const;

// Each field is all-or-nothing (its full weight, or none) rather than
// partial credit for e.g. "how many tags" - simpler to reason about as a
// completion checklist, and there's no natural partial-credit scale for a
// free-text bio anyway.
export function computeProfileCompletion(
  bio: string,
  major: string,
  interestCount: number,
  classYear: string | null
): number {
  let total = 0;
  if (bio.trim()) total += WEIGHTS.bio;
  if (major.trim()) total += WEIGHTS.major;
  if (interestCount > 0) total += WEIGHTS.tags;
  if (classYear) total += WEIGHTS.classYear;
  return total;
}
