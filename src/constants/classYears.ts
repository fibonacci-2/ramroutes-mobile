export const CLASS_YEARS = ['First-year', 'Sophomore', 'Junior', 'Senior', 'Graduate'] as const;

export type ClassYear = (typeof CLASS_YEARS)[number];
