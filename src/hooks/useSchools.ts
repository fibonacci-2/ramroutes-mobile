import { useEffect, useState } from 'react';
import { subscribeToSchools } from '../services/schools';
import { School } from '../types/School';

// Global (not per-user) list, so no keying needed - just one cached array.
// Both PreferencesScreen and SchoolPickerScreen unmount on navigation away
// (RootShell's tab switching / AppGate's school-selection flow), which
// reset this back to [] and resubscribed from scratch each time -
// PreferencesScreen's School row visibly flashed "Select a school" before
// the name repopulated on every revisit. Read synchronously as the initial
// state so every mount after the first shows the real list immediately.
let schoolsCache: School[] = [];

export function useSchools(): School[] {
  const [schools, setSchools] = useState<School[]>(schoolsCache);

  useEffect(
    () =>
      subscribeToSchools((next) => {
        schoolsCache = next;
        setSchools(next);
      }),
    []
  );

  return schools;
}
