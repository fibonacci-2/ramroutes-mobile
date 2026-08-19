import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import CategoryChips from '../components/CategoryChips';
import EventRow from '../components/EventRow';
import ForYouCard, { FOR_YOU_CARD_WIDTH } from '../components/ForYouCard';
import Icon from '../components/Icon';
import { Tag } from '../constants/tags';
import { EventWithLocation } from '../hooks/useEvents';
import { useInterests } from '../hooks/useInterests';
import { useRecommendedEvents } from '../hooks/useRecommendedEvents';
import { useUserLocation } from '../hooks/useUserLocation';
import { trackEvent } from '../services/analytics';
import { setInterested } from '../services/buildingEvents';
import { color, font, radius, shadow } from '../theme';
import { rankRecommended } from '../utils/personalization';

type Props = {
  events: EventWithLocation[];
  userId: string;
  onOpenDetail: (eventId: string) => void;
};

export default function EventsListScreen({ events, userId, onOpenDetail }: Props) {
  const userLocation = useUserLocation();
  const { selected: interests } = useInterests();
  const recommendedEventIds = useRecommendedEvents(userId);
  const [category, setCategory] = useState<Tag | 'all'>('all');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const filtered = events
    .filter((e) => category === 'all' || e.tags?.includes(category))
    .filter((e) => !q || `${e.eventName} ${e.buildingName} ${(e.tags ?? []).join(' ')}`.toLowerCase().includes(q));

  // Debounced so this fires once after the user pauses typing, not once per
  // keystroke - and logs only metadata (length, result count), never the
  // raw query text, since search terms are free-form user input.
  useEffect(() => {
    if (!q) return;
    const timer = setTimeout(() => {
      trackEvent('app_search', { query_length: q.length, result_count: filtered.length });
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Prefers scraper/recommend.js's nightly tagOverlap + embedding-similarity
  // ranking; falls back to local tag overlap if that hasn't run for this
  // user yet. Independent of the search/category filters above since it's a
  // curated section, not a filter.
  const forYou = rankRecommended(events, recommendedEventIds, interests, 10);

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
        <CategoryChips
          selected={category}
          onSelect={(c) => {
            setCategory(c);
            trackEvent('category_filter_selected', { category: c, screen: 'list' });
          }}
        />
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
                snapToInterval={FOR_YOU_CARD_WIDTH + 12}
                decelerationRate="fast"
                renderItem={({ item }) => (
                  <ForYouCard event={item} userLocation={userLocation} onPress={() => onOpenDetail(item.id)} />
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
  // Tinted, elevated band instead of a plain header - makes the curated
  // section read as its own zone rather than blending into the screen
  // background like every other section here does.
  forYouSection: {
    marginTop: 10,
    marginHorizontal: 14,
    marginBottom: 12,
    paddingTop: 16,
    paddingBottom: 14,
    borderRadius: radius.lg,
    backgroundColor: color.accent100,
    ...shadow.sm,
  },
  forYouTitle: { fontFamily: font.heading, fontSize: 19, color: color.text, paddingHorizontal: 16, marginBottom: 10 },
  forYouRail: { gap: 12, paddingHorizontal: 16, alignItems: 'flex-start' },
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
