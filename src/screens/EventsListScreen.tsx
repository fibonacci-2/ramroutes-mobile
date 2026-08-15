import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import CategoryChips from '../components/CategoryChips';
import EventRow from '../components/EventRow';
import Icon from '../components/Icon';
import { Tag } from '../constants/tags';
import { EventWithLocation } from '../hooks/useEvents';
import { useUserLocation } from '../hooks/useUserLocation';
import { setInterested } from '../services/buildingEvents';
import { color, font, radius, shadow } from '../theme';

type Props = {
  events: EventWithLocation[];
  userId: string;
  onOpenDetail: (eventId: string) => void;
};

export default function EventsListScreen({ events, userId, onOpenDetail }: Props) {
  const userLocation = useUserLocation();
  const [category, setCategory] = useState<Tag | 'all'>('all');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const filtered = events
    .filter((e) => category === 'all' || e.tags?.includes(category))
    .filter((e) => !q || `${e.eventName} ${e.buildingName} ${(e.tags ?? []).join(' ')}`.toLowerCase().includes(q));

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Events near you</Text>
      </View>

      <View style={styles.searchBox}>
        <Icon name="search" size={17} color={color.neutral600} />
        <TextInput
          style={styles.searchInput}
          placeholder="Career fair, jazz, volleyball…"
          placeholderTextColor={color.neutral500}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={styles.chipsRow}>
        <CategoryChips selected={category} onSelect={setCategory} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        style={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyBlob}>
              <Icon name="search" size={34} color={color.accent600} />
            </View>
            <Text style={styles.emptyTitle}>Nothing matches</Text>
            <Text style={styles.emptyBody}>Try a different search or category.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <EventRow
            event={item}
            userLocation={userLocation}
            saved={!!item.interestedUsers?.includes(userId)}
            onPress={() => onOpenDetail(item.id)}
            onToggleSave={() => setInterested(item.id, userId, !item.interestedUsers?.includes(userId))}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 6 },
  headerTitle: { fontFamily: font.heading, fontSize: 27, color: color.text },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'white',
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 4,
    ...shadow.sm,
  },
  searchInput: { flex: 1, fontFamily: font.bodySemibold, fontSize: 14, color: color.text },
  chipsRow: { paddingHorizontal: 20, paddingVertical: 6 },
  list: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 40 },
  emptyBlob: {
    width: 96,
    height: 96,
    borderRadius: 40,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: { fontFamily: font.heading, fontSize: 18, color: color.text, marginBottom: 4 },
  emptyBody: { fontFamily: font.body, fontSize: 13, color: color.neutral600, textAlign: 'center' },
});
