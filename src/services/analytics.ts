import {
  getAnalytics,
  logEvent as fbLogEvent,
  logScreenView,
  setAnalyticsCollectionEnabled,
  setUserId as setAnalyticsUserId,
  setUserProperty,
} from '@react-native-firebase/analytics';
import {
  getCrashlytics,
  log as crashlyticsLog,
  recordError as crashlyticsRecordError,
  setCrashlyticsCollectionEnabled,
  setUserId as setCrashlyticsUserId,
} from '@react-native-firebase/crashlytics';

// Both are safe to call before init() - the modular getters lazily grab the
// default app, same pattern as getFirestore()/getAuth() elsewhere in this
// codebase. init() just makes collection explicit instead of relying on
// each SDK's own default (Analytics defaults on; Crashlytics defaults on
// in release builds but is worth being explicit about for dev builds too).
export function initAnalytics(): void {
  setAnalyticsCollectionEnabled(getAnalytics(), true);
  setCrashlyticsCollectionEnabled(getCrashlytics(), true);
}

// Screen name should match RootShell's Tab ids / a short static label -
// keep these low-cardinality (no ids, no free text) so Firebase's
// screen_view breakdown stays meaningful instead of exploding into one row
// per event/user.
export function trackScreenView(screenName: string): void {
  if (__DEV__) console.log('[analytics] screen_view', screenName);
  logScreenView(getAnalytics(), { screen_name: screenName, screen_class: screenName }).catch(() => {});
}

// Generic custom event logger - params must stay low-cardinality (ids are
// fine, free text like search queries or event descriptions is not; GA4
// silently drops params past its per-event limits and high-cardinality
// string params make the Firebase console's breakdowns useless).
//
// The __DEV__ console.log is the fastest way to see these fire while
// developing - Metro/logcat shows them instantly, whereas Firebase's own
// DebugView needs a device flag enabled and the standard dashboard is
// delayed up to ~24h. It only confirms the call happened locally, not that
// it reached Firebase - see DebugView for that.
export function trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
  if (__DEV__) console.log('[analytics] event', name, params ?? {});
  fbLogEvent(getAnalytics(), name, params);
}

// Called once from AppGate as soon as both are known, so every event and
// crash from here on is attributable to a user/school without needing to
// pass userId through every call site.
export function identifyUser(userId: string, schoolId: string | null): void {
  setAnalyticsUserId(getAnalytics(), userId).catch(() => {});
  setCrashlyticsUserId(getCrashlytics(), userId).catch(() => {});
  if (schoolId) {
    setUserProperty(getAnalytics(), 'school_id', schoolId).catch(() => {});
  }
}

// Non-fatal error reporting - use in catch blocks that already show the
// user a friendly fallback (Scout's reply failure, etc.) so the underlying
// cause still shows up in Crashlytics instead of vanishing. `context`
// becomes the grouping key in the Crashlytics console (jsErrorName), so
// pass a short stable label like 'scout-reply', not the dynamic message.
export function recordError(error: unknown, context: string): void {
  const err = error instanceof Error ? error : new Error(String(error));
  if (__DEV__) console.log('[analytics] recordError', context, err.message);
  crashlyticsRecordError(getCrashlytics(), err, context);
}

// Crashlytics breadcrumb - shows up in the crash/error report's log
// leading up to the event, not as its own analytics event. Cheap enough to
// sprinkle at major state transitions if a specific bug needs tracing.
export function logBreadcrumb(message: string): void {
  crashlyticsLog(getCrashlytics(), message);
}
