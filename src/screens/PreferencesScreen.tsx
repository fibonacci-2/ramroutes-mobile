import { useMemo } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon from '../components/Icon';
import ProfileCompletionRing from '../components/ProfileCompletionRing';
import { CLASS_YEARS } from '../constants/classYears';
import { AVAILABLE_TAGS } from '../constants/tags';
import { TAG_STYLES } from '../constants/tagStyles';
import { useInterests } from '../hooks/useInterests';
import { useSchools } from '../hooks/useSchools';
import { useStudentProfile } from '../hooks/useStudentProfile';
import { useUserBio } from '../hooks/useUserBio';
import { color, font, radius, shadow } from '../theme';
import { computeProfileCompletion } from '../utils/profileCompletion';

type Props = {
  schoolId: string;
  onOpenSaved: () => void;
  onChangeSchool: () => void;
};

export default function PreferencesScreen({ schoolId, onChangeSchool }: Props) {
  const { selected, toggleTag } = useInterests();
  const { bio, setBio, saveBio } = useUserBio();
  const { major, setMajor, saveMajor, classYear, setClassYear } = useStudentProfile();
  const schools = useSchools();

  const schoolName = schools.find((s) => s.id === schoolId)?.schoolName ?? 'Select a school';

  const completion = useMemo(
    () => computeProfileCompletion(bio, major, selected.size, classYear),
    [bio, major, selected, classYear]
  );

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.headerTitle}>Preferences</Text>

        <ProfileCompletionRing percent={completion} />

        <Pressable style={styles.menuRow} onPress={onChangeSchool}>
          <View style={styles.menuRowIcon}>
            <Icon name="pin" size={18} color={color.accent700} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuRowLabel}>School</Text>
            <Text style={styles.menuRowValue}>{schoolName}</Text>
          </View>
          <View style={styles.menuRowChevron}>
            <Icon name="back" size={16} color={color.neutral500} />
          </View>
        </Pressable>

        {/* Saved events row hidden for now - doesn't fit well alongside the
            About you / Interests sections added below. onOpenSaved stays in
            Props so RootShell's wiring (and the Saved modal itself) is
            untouched - re-add the row here to bring it back. */}

        <Text style={styles.sectionTitle}>About you</Text>
        <Text style={styles.sectionSubtitle}>Helps us point you toward the right resources and events.</Text>
        <TextInput
          style={styles.majorInput}
          placeholder="Major (e.g. Political Science)"
          placeholderTextColor={color.neutral500}
          value={major}
          onChangeText={setMajor}
          onBlur={() => saveMajor(major)}
        />
        <View style={styles.chipGrid}>
          {CLASS_YEARS.map((year) => {
            const active = classYear === year;
            return (
              <Pressable
                key={year}
                style={[styles.chip, active && { backgroundColor: color.accent200, borderColor: color.accent200 }]}
                onPress={() => setClassYear(year)}
              >
                <Text style={[styles.chipText, active && { color: color.accent800 }]}>{year}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Interests</Text>
        <Text style={styles.sectionSubtitle}>Pick what you're into - we'll use this to recommend events.</Text>
        <View style={styles.chipGrid}>
          {AVAILABLE_TAGS.map((tag) => {
            const active = selected.has(tag);
            const style = TAG_STYLES[tag];
            return (
              <Pressable
                key={tag}
                style={[styles.chip, active && { backgroundColor: style.tint, borderColor: style.tint }]}
                onPress={() => toggleTag(tag)}
              >
                <Icon name={style.icon} size={14} color={active ? style.ink : color.neutral600} />
                <Text style={[styles.chipText, active && { color: style.ink }]}>{tag}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>What are you looking for?</Text>
        <Text style={styles.sectionSubtitle}>
          Tell us what kind of events, clubs, or people you're hoping to find on campus.
        </Text>
        <TextInput
          style={styles.bioInput}
          multiline
          placeholder="e.g. I'm looking for a study group for orgo, and I'd love to find a pickup soccer game…"
          placeholderTextColor={color.neutral500}
          value={bio}
          onChangeText={setBio}
          onBlur={() => saveBio(bio)}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  headerTitle: { fontFamily: font.heading, fontSize: 27, color: color.text, marginBottom: 20 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'white',
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 24,
    ...shadow.sm,
  },
  menuRowIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md - 4,
    backgroundColor: color.accent200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRowLabel: { flex: 1, fontFamily: font.bodyBold, fontSize: 15, color: color.text },
  menuRowValue: { fontFamily: font.body, fontSize: 12.5, color: color.neutral600, marginTop: 1 },
  menuRowChevron: { transform: [{ rotate: '180deg' }] },
  sectionTitle: { fontFamily: font.heading, fontSize: 18, color: color.text, marginTop: 8, marginBottom: 4 },
  sectionSubtitle: { fontFamily: font.body, fontSize: 13, color: color.neutral600, marginBottom: 14, lineHeight: 18 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.divider,
    backgroundColor: 'white',
    ...shadow.sm,
  },
  chipText: { fontFamily: font.bodyBold, fontSize: 12.5, color: color.text },
  majorInput: {
    backgroundColor: 'white',
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: font.body,
    fontSize: 14,
    color: color.text,
    marginBottom: 12,
    ...shadow.sm,
  },
  bioInput: {
    backgroundColor: 'white',
    borderRadius: radius.md,
    padding: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    fontFamily: font.body,
    fontSize: 14,
    color: color.text,
    ...shadow.sm,
  },
});
