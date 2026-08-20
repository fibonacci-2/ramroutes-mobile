import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { identifyUser, trackEvent } from '../services/analytics';
import { ensureUserProfile, getOnboardingStatus, markInterestsOnboarded, setUserSchoolId } from '../services/users';
import { color, font } from '../theme';
import { School } from '../types/School';
import InterestsOnboardingScreen from './InterestsOnboardingScreen';
import RootShell from './RootShell';
import SchoolPickerScreen from './SchoolPickerScreen';

type Props = {
  // Fires once, the first moment AppGate has something real to show
  // (any of the error/SchoolPicker/InterestsOnboarding/RootShell branches
  // below) instead of the loading spinner. App.tsx uses this to hold the
  // animated splash up for exactly as long as loading actually takes,
  // instead of a fixed timer that a slow network can outlast - the whole
  // point being that the plain ActivityIndicator branch here should never
  // actually be seen.
  onReady?: () => void;
};

// Orchestrates the one-time flow before the app is usable: anonymous
// sign-in (useAuth) -> Firestore profile creation -> "what's your school"
// -> "what are you into" (only asked once each, stored on the profile) ->
// the real app.
export default function AppGate({ onReady }: Props) {
  const { userId, error } = useAuth();
  const [schoolId, setSchoolId] = useState<string | null | undefined>(undefined);
  const [interestsOnboarded, setInterestsOnboarded] = useState<boolean | undefined>(undefined);

  const isLoading = !error && (!userId || schoolId === undefined || interestsOnboarded === undefined);

  useEffect(() => {
    if (!userId) return;
    ensureUserProfile(userId)
      .then(() => getOnboardingStatus(userId))
      .then((status) => {
        setSchoolId(status.schoolId);
        setInterestsOnboarded(status.interestsOnboarded);
      });
  }, [userId]);

  // Attributes every analytics event and crash report to a user/school from
  // here on - fires again (harmlessly, same id) once schoolId resolves from
  // undefined to its real value or null.
  useEffect(() => {
    if (!userId || schoolId === undefined) return;
    identifyUser(userId, schoolId);
  }, [userId, schoolId]);

  useEffect(() => {
    if (!isLoading) onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Couldn't sign you in. Check your connection and reopen the app.</Text>
      </View>
    );
  }

  if (!userId || schoolId === undefined || interestsOnboarded === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={color.accent} size="large" />
      </View>
    );
  }

  if (schoolId === null) {
    return (
      <SchoolPickerScreen
        onSelect={(school: School) => {
          setUserSchoolId(userId, school.id);
          setSchoolId(school.id);
          trackEvent('school_selected', { school_id: school.id });
        }}
      />
    );
  }

  // interestsOnboarded, once true, isn't reset by a later school change
  // (onChangeSchool below only touches schoolId) - picking interests is a
  // one-time ask, not something a school switch should force redoing.
  if (!interestsOnboarded) {
    return (
      <InterestsOnboardingScreen
        onDone={() => {
          markInterestsOnboarded(userId);
          setInterestsOnboarded(true);
          trackEvent('interests_onboarding_completed');
        }}
        onBack={() => {
          setSchoolId(null);
          trackEvent('onboarding_school_back');
        }}
      />
    );
  }

  return <RootShell userId={userId} schoolId={schoolId} onChangeSchool={() => setSchoolId(null)} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', padding: 30 },
  errorText: { fontFamily: font.body, fontSize: 14, color: color.text, textAlign: 'center' },
});
