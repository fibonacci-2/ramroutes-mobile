import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import CategoryChips from '../components/CategoryChips';
import EventRailCard, { RAIL_CARD_WIDTH } from '../components/EventRailCard';
import Icon from '../components/Icon';
import { Tag } from '../constants/tags';
import { primaryTagStyle } from '../constants/tagStyles';
import { EventWithLocation } from '../hooks/useEvents';
import { useUserLocation } from '../hooks/useUserLocation';
import { mapStyle } from '../mapStyle';
import { color, font, radius, shadow } from '../theme';

// GWU campus, Foggy Bottom - used until we know the signed-in student's
// school has any events to center on. The "schools" collection has no
// lat/lng of its own (Admin/src/components/SchoolForm.js only tracks
// schoolId/schoolName), so schools with no buildings yet just stay here.
const FALLBACK_REGION = {
  latitude: 38.899,
  longitude: -77.049,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

type Props = {
  events: EventWithLocation[];
  onOpenDetail: (eventId: string) => void;
  onSearchPress: () => void;
  directionsTo: EventWithLocation | null;
  onClearDirections: () => void;
};

export default function MapScreen({ events, onOpenDetail, onSearchPress, directionsTo, onClearDirections }: Props) {
  const userLocation = useUserLocation();
  const [category, setCategory] = useState<Tag | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);
  const railRef = useRef<FlatList<EventWithLocation>>(null);
  const hasAutoCentered = useRef(false);

  const visibleEvents = category === 'all' ? events : events.filter((e) => e.tags?.includes(category));

  const panTo = (event: EventWithLocation) => {
    mapRef.current?.animateToRegion(
      { latitude: event.lat, longitude: event.lng, latitudeDelta: 0.006, longitudeDelta: 0.006 },
      300
    );
  };

  const selectEvent = (id: string) => {
    setSelectedId(id);
    if (directionsTo && id !== directionsTo.id) {
      onClearDirections();
    }
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

  // Draws the route in-app (react-native-maps Polyline) instead of handing off
  // to an external maps app - fits the camera to both the student's location
  // and the event, falling back to just panning to the event if we don't have
  // a location fix yet.
  useEffect(() => {
    if (!directionsTo) return;
    setSelectedId(directionsTo.id);
    if (userLocation) {
      mapRef.current?.fitToCoordinates(
        [
          { latitude: userLocation.lat, longitude: userLocation.lng },
          { latitude: directionsTo.lat, longitude: directionsTo.lng },
        ],
        { edgePadding: { top: 220, right: 60, bottom: 260, left: 60 }, animated: true }
      );
    } else {
      panTo(directionsTo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directionsTo]);

  // Recenters on the student's campus the first time their school's events
  // load, since FALLBACK_REGION is GWU-specific and initialRegion only takes
  // effect on the MapView's first mount, before this data has arrived.
  useEffect(() => {
    if (hasAutoCentered.current || events.length === 0) return;
    hasAutoCentered.current = true;
    const avgLat = events.reduce((sum, e) => sum + e.lat, 0) / events.length;
    const avgLng = events.reduce((sum, e) => sum + e.lng, 0) / events.length;
    mapRef.current?.animateToRegion({ latitude: avgLat, longitude: avgLng, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 400);
  }, [events]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={FALLBACK_REGION}
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

        {directionsTo && userLocation && (
          <Polyline
            coordinates={[
              { latitude: userLocation.lat, longitude: userLocation.lng },
              { latitude: directionsTo.lat, longitude: directionsTo.lng },
            ]}
            strokeColor={color.accent}
            strokeWidth={4}
            lineDashPattern={[1, 8]}
            lineCap="round"
          />
        )}
      </MapView>

      <View style={styles.top}>
        {directionsTo ? (
          <View style={styles.directionsBanner}>
            <Icon name="nav" size={16} color={color.accent700} />
            <Text style={styles.directionsBannerText} numberOfLines={1}>
              Directions to {directionsTo.eventName}
            </Text>
            <Pressable onPress={onClearDirections} hitSlop={10}>
              <Icon name="close" size={16} color={color.neutral600} />
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable style={styles.searchPill} onPress={onSearchPress}>
              <Icon name="search" size={17} color={color.neutral600} />
              <Text style={styles.searchPillText}>Search events near campus…</Text>
            </Pressable>
            <CategoryChips selected={category} onSelect={onCategoryChange} />
          </>
        )}
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
  directionsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'white',
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 16,
    ...shadow.md,
  },
  directionsBannerText: { flex: 1, fontFamily: font.bodyBold, fontSize: 14, color: color.text },
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
