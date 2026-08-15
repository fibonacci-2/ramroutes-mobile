import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import EventRow from '../components/EventRow';
import Icon from '../components/Icon';
import { useEvents } from '../hooks/useEvents';
import { useUserLocation } from '../hooks/useUserLocation';
import { setInterested } from '../services/buildingEvents';
import { color, font, radius, shadow } from '../theme';

type Props = {
  userId: string | undefined;
  onOpenDetail: (eventId: string) => void;
  onBrowseEvents: () => void;
};

export default function SavedScreen({ userId, onOpenDetail, onBrowseEvents }: Props) {
  const events = useEvents();
  const userLocation = useUserLocation();
  const saved = userId ? events.filter((e) => e.interestedUsers?.includes(userId)) : [];

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Saved</Text>
      </View>

      <FlatList
        data={saved}
        keyExtractor={(e) => e.id}
        style={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyBlob}>
              <Icon name="bookmark" size={34} color={color.accent600} />
            </View>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyBody}>Tap the bookmark on any event and it lands here.</Text>
            <Pressable style={styles.browseBtn} onPress={onBrowseEvents}>
              <Text style={styles.browseBtnText}>Browse events</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <EventRow
            event={item}
            userLocation={userLocation}
            saved
            onPress={() => onOpenDetail(item.id)}
            onToggleSave={() => userId && setInterested(item.id, userId, false)}
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
  emptyBody: { fontFamily: font.body, fontSize: 13, color: color.neutral600, textAlign: 'center', marginBottom: 18 },
  browseBtn: { backgroundColor: color.accent, borderRadius: radius.pill, paddingVertical: 13, paddingHorizontal: 26, ...shadow.sm },
  browseBtnText: { fontFamily: font.heading, fontSize: 15, color: 'white' },
});
