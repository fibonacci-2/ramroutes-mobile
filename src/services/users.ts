import { Platform } from 'react-native';
import { getFirestore, doc, getDoc, onSnapshot, setDoc, updateDoc, serverTimestamp } from '@react-native-firebase/firestore';
import { trackEvent } from './analytics';

// Anonymous sign-in (useAuth.ts) gives every install a uid but no Firestore
// doc - creates the minimal users/{uid} profile this app actually reads/
// writes (bio, interests, schoolId). Unlike Unity's UserService.CreateUser,
// this skips the game-layer fields (coins, knowledgePoints, rank) - PLAN.md
// explicitly scopes those out ("no avatars/Rams, no game layer").
export async function ensureUserProfile(userId: string): Promise<void> {
  const ref = doc(getFirestore(), 'users', userId);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) {
    await updateDoc(ref, { lastLoginAt: serverTimestamp() });
    return;
  }
  await setDoc(ref, {
    bio: '',
    interests: [],
    major: '',
    classYear: null,
    schoolId: null,
    profileHash: computeProfileHash('', '', []),
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  });
}

// Cheap non-cryptographic fingerprint (FNV-1a) of the fields that drive
// recommendations - not a security hash, just a short deterministic
// change-detector. functions/index.js's recomputeRecommendationsOnProfileChange
// trigger compares this single field instead of diffing bio/major/interests
// individually, and stays correct if more recommendation-relevant fields get
// added later. Interests are sorted first so toggling a tag off and back on
// doesn't spuriously change the hash depending on array order.
function computeProfileHash(bio: string, major: string, interests: string[]): string {
  const input = `${bio}|${major}|${[...interests].sort().join(',')}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

// Shared by updateUserBio/updateUserMajor/updateUserInterests below - each
// only knows its own new value, so this reads the current doc to fill in the
// other two fields before recomputing profileHash, then writes both the
// change and the new hash in one update.
async function updateProfileFields(
  userId: string,
  changes: Partial<{ bio: string; major: string; interests: string[] }>
): Promise<void> {
  const ref = doc(getFirestore(), 'users', userId);
  const snapshot = await getDoc(ref);
  const current = snapshot.data() ?? {};
  const bio = changes.bio ?? (typeof current.bio === 'string' ? current.bio : '');
  const major = changes.major ?? (typeof current.major === 'string' ? current.major : '');
  const interests = changes.interests ?? (Array.isArray(current.interests) ? current.interests : []);
  await updateDoc(ref, { ...changes, profileHash: computeProfileHash(bio, major, interests) });
}

export async function getUserSchoolId(userId: string): Promise<string | null> {
  const snapshot = await getDoc(doc(getFirestore(), 'users', userId));
  const schoolId = snapshot.data()?.schoolId;
  return typeof schoolId === 'string' ? schoolId : null;
}

export async function setUserSchoolId(userId: string, schoolId: string): Promise<void> {
  await updateDoc(doc(getFirestore(), 'users', userId), { schoolId });
}

// Same "users" collection / "interests" field the Unity app reads/writes
// (UserService.cs's RetrieveUserById / UpdateUserInterests) - no separate backend.
export async function getUserInterests(userId: string): Promise<string[]> {
  const snapshot = await getDoc(doc(getFirestore(), 'users', userId));
  const interests = snapshot.data()?.interests;
  return Array.isArray(interests) ? interests : [];
}

export async function updateUserInterests(userId: string, interests: string[]): Promise<void> {
  await updateProfileFields(userId, { interests });
  trackEvent('profile_field_updated', { field: 'interests' });
}

// Written both nightly (scraper/recommend.js) and reactively on every
// profile edit (functions/index.js's recomputeRecommendationsOnProfileChange)
// - read-only from the app, never written here, so client and server never
// race to update the same list. A live subscription rather than a one-shot
// read: since the Cloud Function updates this within seconds of a profile
// change, a one-shot fetch on mount would keep showing whatever list was
// there at launch until the next full app restart.
export function subscribeToUserRecommendedEvents(userId: string, onChange: (ids: string[]) => void): () => void {
  return onSnapshot(doc(getFirestore(), 'users', userId), (snapshot) => {
    const recommended = snapshot.data()?.recommendedEvents;
    onChange(Array.isArray(recommended) ? recommended : []);
  });
}

// Same "bio" field the Unity app reads/writes (UserService.cs's UpdateUserBio) -
// reused here as the free-text "what are you looking for" preference field
// rather than introducing a separate undocumented field.
export async function getUserBio(userId: string): Promise<string> {
  const snapshot = await getDoc(doc(getFirestore(), 'users', userId));
  const bio = snapshot.data()?.bio;
  return typeof bio === 'string' ? bio : '';
}

export async function updateUserBio(userId: string, bio: string): Promise<void> {
  await updateProfileFields(userId, { bio });
  trackEvent('profile_field_updated', { field: 'bio' });
}

// Explicit signal (declared major + class year) alongside the inferred one
// (tag interests, bio free text) - lets recommendations key off "I'm a
// political science major" even before the student has tagged/saved anything.
export async function getUserMajor(userId: string): Promise<string> {
  const snapshot = await getDoc(doc(getFirestore(), 'users', userId));
  const major = snapshot.data()?.major;
  return typeof major === 'string' ? major : '';
}

export async function updateUserMajor(userId: string, major: string): Promise<void> {
  await updateProfileFields(userId, { major });
  trackEvent('profile_field_updated', { field: 'major' });
}

export async function getUserClassYear(userId: string): Promise<string | null> {
  const snapshot = await getDoc(doc(getFirestore(), 'users', userId));
  const classYear = snapshot.data()?.classYear;
  return typeof classYear === 'string' ? classYear : null;
}

export async function updateUserClassYear(userId: string, classYear: string): Promise<void> {
  await updateDoc(doc(getFirestore(), 'users', userId), { classYear });
  trackEvent('profile_field_updated', { field: 'classYear' });
}

// Same notificationToken/tokenLastUpdated/platform fields the Unity app's
// FirebaseManager.UpdateUserProfileToken writes to users/{uid}. Unity also
// mirrors the token to a devices/{deviceId} collection, but useAuth's stable
// per-install uid already serves as that device key here, so one write covers it.
export async function updateUserNotificationToken(userId: string, token: string): Promise<void> {
  await updateDoc(doc(getFirestore(), 'users', userId), {
    notificationToken: token,
    tokenLastUpdated: serverTimestamp(),
    platform: Platform.OS,
  });
}
