import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { identifyUser, trackEvent } from '../services/analytics';
import { ensureUserProfile, getUserSchoolId, setUserSchoolId } from '../services/users';
import { color, font } from '../theme';
import { School } from '../types/School';
import RootShell from './RootShell';
import SchoolPickerScreen from './SchoolPickerScreen';

// Orchestrates the one-time flow before the app is usable: anonymous
// sign-in (useAuth) -> Firestore profile creation -> "what's your school"
// (only asked once, stored on the profile) -> the real app.
export default function AppGate() {
  const { userId, error } = useAuth();
  const [schoolId, setSchoolId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!userId) return;
    ensureUserProfile(userId).then(() => getUserSchoolId(userId)).then(setSchoolId);
  }, [userId]);

  // Attributes every analytics event and crash report to a user/school from
  // here on - fires again (harmlessly, same id) once schoolId resolves from
  // undefined to its real value or null.
  useEffect(() => {
    if (!userId || schoolId === undefined) return;
    identifyUser(userId, schoolId);
  }, [userId, schoolId]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Couldn't sign you in. Check your connection and reopen the app.</Text>
      </View>
    );
  }

  if (!userId || schoolId === undefined) {
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

  return <RootShell userId={userId} schoolId={schoolId} onChangeSchool={() => setSchoolId(null)} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', padding: 30 },
  errorText: { fontFamily: font.body, fontSize: 14, color: color.text, textAlign: 'center' },
});
