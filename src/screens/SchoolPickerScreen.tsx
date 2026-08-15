import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from '../components/Icon';
import { subscribeToSchools } from '../services/schools';
import { color, font, radius, shadow } from '../theme';
import { School } from '../types/School';

type Props = {
  onSelect: (school: School) => void;
};

export default function SchoolPickerScreen({ onSelect }: Props) {
  const [schools, setSchools] = useState<School[] | null>(null);

  useEffect(() => subscribeToSchools(setSchools), []);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Icon name="pin" size={28} color={color.accent700} />
        </View>
        <Text style={styles.title}>What's your school?</Text>
        <Text style={styles.subtitle}>We'll show you events and buildings on your campus.</Text>
      </View>

      {schools === null ? null : (
        <FlatList
          data={schools}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No schools are set up yet - check back soon.</Text>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => onSelect(item)}>
              <Text style={styles.rowText}>{item.schoolName}</Text>
              <View style={styles.rowChevron}>
                <Icon name="back" size={16} color={color.neutral500} />
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
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
  subtitle: { fontFamily: font.body, fontSize: 14, color: color.neutral600, textAlign: 'center' },
  list: { padding: 20, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: 18,
    ...shadow.sm,
  },
  rowText: { flex: 1, fontFamily: font.bodyBold, fontSize: 16, color: color.text },
  rowChevron: { transform: [{ rotate: '180deg' }] },
  emptyText: { fontFamily: font.body, fontSize: 14, color: color.neutral600, textAlign: 'center', marginTop: 20 },
});
