import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from '../components/Icon';
import { AVAILABLE_TAGS } from '../constants/tags';
import { TAG_STYLES } from '../constants/tagStyles';
import { useInterests } from '../hooks/useInterests';
import { color, font, radius, shadow } from '../theme';

type Props = {
  onDone: () => void;
  // Lets a student who picked the wrong school back out of this step and
  // reselect it, before onDone locks the flow into RootShell - previously
  // there was no way back to SchoolPickerScreen once a school was chosen
  // until they were already inside the app and dug up the "School" row in
  // Preferences.
  onBack: () => void;
};

// Shown once, between school selection and the main app (see AppGate) -
// captures a first-pass interest signal before the student has saved or
// RSVP'd to anything, instead of leaving recommendations empty until they
// happen to visit Preferences on their own. Reuses useInterests (same
// debounced-write, module-level-cached hook PreferencesScreen uses), so
// tags picked here already show as selected if they open Preferences
// afterward - one Firestore-backed source of truth, not a separate
// onboarding-only draft.
export default function InterestsOnboardingScreen({ onDone, onBack }: Props) {
  const { selected, toggleTag } = useInterests();

  return (
    <View style={styles.screen}>
      <Pressable style={styles.backBtn} onPress={onBack} hitSlop={10}>
        <Icon name="back" size={20} color={color.text} />
      </Pressable>

      <View style={styles.header}>
        <View style={styles.icon}>
          <Icon name="heart" size={28} color={color.accent700} />
        </View>
        <Text style={styles.title}>What are you into?</Text>
        <Text style={styles.subtitle}>
          Pick a few - we'll use this to recommend events. You can always change these later in Preferences.
        </Text>
      </View>

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

      <View style={styles.footer}>
        <Pressable style={styles.continueBtn} onPress={onDone}>
          <Text style={styles.continueBtnText}>{selected.size > 0 ? 'Continue' : "Skip for now"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  backBtn: {
    position: 'absolute',
    top: 56,
    left: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    ...shadow.sm,
  },
  header: { alignItems: 'center', paddingTop: 90, paddingHorizontal: 30, paddingBottom: 20 },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 28,
    backgroundColor: color.accent200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontFamily: font.heading, fontSize: 26, color: color.text, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontFamily: font.body, fontSize: 14, color: color.neutral600, textAlign: 'center', lineHeight: 20 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingTop: 24 },
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
  footer: { flex: 1, justifyContent: 'flex-end', padding: 20, paddingBottom: 40 },
  continueBtn: {
    backgroundColor: color.accent,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadow.sm,
  },
  continueBtnText: { fontFamily: font.bodyBold, fontSize: 15, color: 'white' },
});
