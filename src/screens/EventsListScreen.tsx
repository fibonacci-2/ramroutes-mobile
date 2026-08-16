import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import CategoryChips from '../components/CategoryChips';
import EventRailCard, { RAIL_CARD_WIDTH } from '../components/EventRailCard';
import EventRow from '../components/EventRow';
import Icon from '../components/Icon';
import { Tag } from '../constants/tags';
import { EventWithLocation } from '../hooks/useEvents';
import { useInterests } from '../hooks/useInterests';
import { useUserLocation } from '../hooks/useUserLocation';
import { setInterested } from '../services/buildingEvents';
import { color, font, radius, shadow } from '../theme';
import { rankByTagOverlap } from '../utils/personalization';

type Props = {
  events: EventWithLocation[];
  userId: string;
  onOpenDetail: (eventId: string) => void;
};

export default function EventsListScreen({ events, userId, onOpenDetail }: Props) {
  const userLocation = useUserLocation();
  const { selected: interests } = useInterests();
  const [category, setCategory] = useState<Tag | 'all'>('all');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const filtered = events
    .filter((e) => category === 'all' || e.tags?.includes(category))
    .filter((e) => !q || `${e.eventName} ${e.buildingName} ${(e.tags ?? []).join(' ')}`.toLowerCase().includes(q));

  // Ranked purely by tag overlap with the student's picked interests - same
  // scoring Scout and Admin/scraper/recommend.js use. Independent of the
  // search/category filters above since it's a curated section, not a filter.
  const forYou = rankByTagOverlap(events, interests, 10);

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
        ListHeaderComponent={
          forYou.length > 0 ? (
            <View style={styles.forYouSection}>
              <Text style={styles.forYouTitle}>For you</Text>
              <FlatList
                horizontal
                data={forYou}
                keyExtractor={(e) => e.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.forYouRail}
                snapToInterval={RAIL_CARD_WIDTH + 10}
                decelerationRate="fast"
                renderItem={({ item }) => (
                  <EventRailCard event={item} userLocation={userLocation} selected={false} onPress={() => onOpenDetail(item.id)} />
                )}
              />
            </View>
          ) : null
        }
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
  forYouSection: { paddingTop: 10, paddingBottom: 6 },
  forYouTitle: { fontFamily: font.heading, fontSize: 18, color: color.text, paddingHorizontal: 20, marginBottom: 8 },
  forYouRail: { gap: 10, paddingHorizontal: 20, alignItems: 'center' },
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
