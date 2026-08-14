# RamRoutes Mobile — Migration Plan

A React Native (Expo, prebuild/dev-client workflow — not Expo Go, since we
need native geofencing and FCM modules) companion/replacement for the Unity
app, focused purely on campus events: real Google Maps instead of modeled
buildings, no avatars/Rams, no game layer. Same Firebase project
(`trials-of-venus`) as the Unity app — same `buildings`, `building-events`,
and `users` Firestore collections, same Auth users, nothing duplicated on
the backend.

## Why this is feasible quickly

The Unity project already does almost everything this app needs, just in
Unity/native-plugin form instead of RN:

- Real per-building GPS coordinates already exist (`BuildingProximityDetector`
  in `Assets/Scenes/DCRPG.unity`), used for native iOS/Android geofencing.
- Firebase Auth + Firestore already back events, RSVPs, footprints
  (`BuildingEventService`, `UserService`, `FootprintService` in the Unity
  project — same schema, just re-implemented in TS).
- Push notifications already run on Firebase Cloud Messaging
  (`NotificationManager.cs`) — `@react-native-firebase/messaging` is the
  direct RN equivalent, same FCM project.

## Phase 0 — data foundation ✅ done

Migrated the 8 buildings with real GPS data out of Unity's
`BuildingProximityDetector` (Inspector-only data, not in Firestore before
this) onto the Firestore `buildings` docs as `lat`, `lng`,
`detectionRadiusMeters`, `closeProximityRadiusMeters`.

Script: `ramroutes/Admin/scraper/migrate-building-coords.js` (safe to
re-run). 8/29 buildings now have coordinates — the rest need real GPS data
added the same way (or geocoded) before they'll appear on the map.

## Phase 1 — map + events (in progress)

- `react-native-maps` (`PROVIDER_GOOGLE`) showing a marker per building with
  coordinates.
- Tap a marker → building detail screen listing its `building-events` (live
  Firestore listener, not a manual cache — this sidesteps the whole class of
  "stale popup" bugs the Unity version had with its shared-panel UI).
- RSVP button writing to `interestedUsers` — same field, same semantics as
  `EventInfoPanel.cs`.
- Auth: Firebase Auth, guest sign-in to start (parity with
  `GuestLoginManager.cs`).

**Current status**: `MapScreen.tsx` renders markers from a live Firestore
subscription (`src/services/buildings.ts`). Event list/detail screen and
Auth are not built yet.

## Phase 2 — geofencing + notifications

- `expo-location` + `expo-task-manager` background geofencing
  (`Location.startGeofencingAsync`) per building, radius from
  `detectionRadiusMeters`.
- On entering a building's geofence: check its upcoming/live events, fire a
  local notification (`expo-notifications`) or rely on a server-triggered
  FCM push via `@react-native-firebase/messaging`.
- If Expo's geofencing proves unreliable in the background (a known rough
  edge on Android), fall back to porting the existing native plugins
  (`com.edgoanalytics.ramroutes.plugin.UnityGeofencingInterface` on
  Android, the iOS native code behind `BackgroundLocationService.cs`'s
  `_RegisterGeofence`) as RN native modules — the logic already exists and
  is proven in production.

## Phase 3 — meta layer (optional, low risk either way)

Coins/knowledge points tied to check-ins, footprints — plain Firestore
reads/writes ported from `UserService`/`FootprintService`. No avatar
rendering involved, so this can land whenever, independent of Phases 1-2.

## Manual setup step required before this app can run on a device

`google-services.json` / `GoogleService-Info.plist` in this repo are
placeholders (`app.json` references them, but the files aren't present
yet). The existing ones in `Assets/google-services.json` /
`Assets/GoogleService-Info.plist` are registered to the Unity app's bundle
ID (`com.edgoanalytics.ramroutes`) and won't work for this app's bundle ID
(`com.edgoanalytics.ramroutesmobile`, chosen in `app.json` — change if you
want something else).

To fix: in the Firebase console, under the **same** `trials-of-venus`
project, register a new Android app (package
`com.edgoanalytics.ramroutesmobile`) and new iOS app (bundle id same),
download their config files, and drop them in this project's root as
`google-services.json` and `GoogleService-Info.plist`. Also needs a Google
Maps API key (`app.json` → `ios.config.googleMapsApiKey` /
`android.config.googleMaps.apiKey`) — reuse an existing one from the
Google Cloud project backing `trials-of-venus`, or create a new
Maps-restricted key.

Once those are in place: `npx expo prebuild` then `npx expo run:ios` /
`run:android` (needs a real device or simulator — not runnable in this
sandboxed dev environment).
