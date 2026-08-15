import { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import CategoryChips from '../components/CategoryChips';
import EventRailCard, { RAIL_CARD_WIDTH } from '../components/EventRailCard';
import Icon from '../components/Icon';
import { Tag } from '../constants/tags';
import { primaryTagStyle } from '../constants/tagStyles';
import { EventWithLocation, useEvents } from '../hooks/useEvents';
import { useUserLocation } from '../hooks/useUserLocation';
import { mapStyle } from '../mapStyle';
import { color, font, radius, shadow } from '../theme';

// GWU campus, Foggy Bottom - matches the buildings seeded in Phase 0.
const INITIAL_REGION = {
  latitude: 38.899,
  longitude: -77.049,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

type Props = {
  onOpenDetail: (eventId: string) => void;
  onSearchPress: () => void;
};

export default function MapScreen({ onOpenDetail, onSearchPress }: Props) {
  const events = useEvents();
  const userLocation = useUserLocation();
  const [category, setCategory] = useState<Tag | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);
  const railRef = useRef<FlatList<EventWithLocation>>(null);

  const visibleEvents = category === 'all' ? events : events.filter((e) => e.tags?.includes(category));

  const panTo = (event: EventWithLocation) => {
    mapRef.current?.animateToRegion(
      { latitude: event.lat, longitude: event.lng, latitudeDelta: 0.006, longitudeDelta: 0.006 },
      300
    );
  };

  const selectEvent = (id: string) => {
    setSelectedId(id);
    const event = visibleEvents.find((e) => e.id === id);
    if (!event) return;
    panTo(event);
    const index = visibleEvents.findIndex((e) => e.id === id);
    if (index >= 0) {
      railRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    }
  };

  const onCategoryChange = (next: Tag | 'all') => {
    setCategory(next);
    setSelectedId(null);
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        customMapStyle={mapStyle}
        toolbarEnabled={false}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {visibleEvents.map((event) => {
          const style = primaryTagStyle(event.tags);
          const selected = event.id === selectedId;
          return (
            <Marker
              key={event.id}
              coordinate={{ latitude: event.lat, longitude: event.lng }}
              title={event.eventName}
              onPress={() => selectEvent(event.id)}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={[styles.pin, { backgroundColor: style.pinBg }, selected && styles.pinSelected]}>
                <Icon name={style.icon} size={15} color="white" strokeWidth={2.75} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.top}>
        <Pressable style={styles.searchPill} onPress={onSearchPress}>
          <Icon name="search" size={17} color={color.neutral600} />
          <Text style={styles.searchPillText}>Search events near campus…</Text>
        </Pressable>
        <CategoryChips selected={category} onSelect={onCategoryChange} />
      </View>

      {userLocation && (
        <Pressable
          style={styles.locateBtn}
          onPress={() =>
            mapRef.current?.animateToRegion(
              { latitude: userLocation.lat, longitude: userLocation.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
              300
            )
          }
        >
          <Icon name="locate" size={19} color={color.accent700} />
        </Pressable>
      )}

      <View style={styles.railWrap}>
        <FlatList
          ref={railRef}
          horizontal
          data={visibleEvents}
          keyExtractor={(e) => e.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          snapToInterval={RAIL_CARD_WIDTH + 10}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({ length: RAIL_CARD_WIDTH + 10, offset: (RAIL_CARD_WIDTH + 10) * index, index })}
          renderItem={({ item }) => (
            <EventRailCard
              event={item}
              userLocation={userLocation}
              selected={item.id === selectedId}
              onPress={() => (item.id === selectedId ? onOpenDetail(item.id) : selectEvent(item.id))}
            />
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  top: { position: 'absolute', top: 56, left: 14, right: 14, gap: 10 },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'white',
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 16,
    ...shadow.md,
  },
  searchPillText: { fontFamily: font.bodySemibold, fontSize: 14, color: color.neutral600 },
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  pinSelected: { transform: [{ scale: 1.25 }] },
  locateBtn: {
    position: 'absolute',
    right: 14,
    bottom: 196,
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  railWrap: { position: 'absolute', left: 0, right: 0, bottom: 12 },
  rail: { gap: 10, paddingHorizontal: 14, alignItems: 'center' },
});
