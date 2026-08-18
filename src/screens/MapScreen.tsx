import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import CategoryChips from '../components/CategoryChips';
import EventMapCard from '../components/EventMapCard';
import EventRailCard, { RAIL_CARD_WIDTH } from '../components/EventRailCard';
import Icon from '../components/Icon';
import { Tag } from '../constants/tags';
import { EventWithLocation, hasLatLng } from '../hooks/useEvents';
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

// desginv2/Quad Campus Events.dc.html's reference clusters purely by
// screen-space proximity every zoom/pan, so any group of 2+ pulses - there's
// no "busy enough" threshold there. It gets away with that because its demo
// events each have distinct coordinates, which naturally spread apart as you
// zoom in. Our real events share their building's exact coordinate
// (useEvents.ts has no per-event lat/lng), so a same-building group would
// otherwise never separate at any zoom - CLUSTER_BREAK_APART_DELTA +
// jitterOffset below are the compensating mechanism for that, not a
// departure from the reference's behavior.
//
// latitudeDelta below which a zoomed-in cluster breaks apart into its
// individual events instead of staying one collapsed badge. Tighter than
// panTo's 0.006 (used just for selecting one event) so a normal selection
// pan doesn't accidentally trigger it.
const CLUSTER_BREAK_APART_DELTA = 0.004;
// Degrees of synthetic spread applied to events inside a broken-apart
// cluster, arranging them in a small circle around the building's true
// point purely for on-map legibility.
const CLUSTER_SPREAD_DEGREES = 0.00008;

// Most-RSVPed events win a marker when a building has more than this many -
// keeps a building's badge count (and, once broken apart, its jittered pins)
// legible instead of scaling unbounded with however many events got scraped
// there, and surfaces the events students are actually most likely to want.
const EVENTS_PER_BUILDING_CAP = 10;

function jitterOffset(index: number, count: number): { dLat: number; dLng: number } {
  const angle = (2 * Math.PI * index) / count;
  return { dLat: Math.sin(angle) * CLUSTER_SPREAD_DEGREES, dLng: Math.cos(angle) * CLUSTER_SPREAD_DEGREES };
}

// Matches the reference's iconAnchor: solo/zoomed-out pins are teardrop-
// shaped (a 36px rotated square whose visual tip sits near the bottom, not
// dead center); cluster badges are plain circles anchored at their true
// center; zoomed-in capsules are a name pill anchored at its bottom edge.
const PIN_ANCHOR = { x: 0.5, y: 32 / 36 };
const CLUSTER_ANCHOR = { x: 0.5, y: 0.5 };
const CAPSULE_ANCHOR = { x: 0.5, y: 1 };

type LocatedEvent = EventWithLocation & { lat: number; lng: number };

type Props = {
  events: EventWithLocation[];
  onOpenDetail: (eventId: string) => void;
  onSearchPress: () => void;
  directionsTo: LocatedEvent | null;
  onClearDirections: () => void;
};

export default function MapScreen({ events, onOpenDetail, onSearchPress, directionsTo, onClearDirections }: Props) {
  const userLocation = useUserLocation();
  const [category, setCategory] = useState<Tag | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoomDelta, setZoomDelta] = useState(FALLBACK_REGION.latitudeDelta);
  const mapRef = useRef<MapView>(null);
  const railRef = useRef<FlatList<LocatedEvent>>(null);
  const hasAutoCentered = useRef(false);

  // Events without a mappable building (see useEvents.ts) still exist
  // everywhere else in the app (list, saved, recommendations) - only the map
  // itself needs to drop them, since a pin can't be placed without a location.
  const locatedEvents = useMemo(() => events.filter(hasLatLng), [events]);

  const visibleEvents = category === 'all' ? locatedEvents : locatedEvents.filter((e) => e.tags?.includes(category));

  // One marker per building instead of one per event - events share their
  // building's lat/lng (useEvents.ts), so without this every event at a busy
  // building stacked an identical pill on the exact same coordinate and only
  // the topmost was even tappable.
  const clusters = useMemo(() => {
    const byBuilding = new Map<string, LocatedEvent[]>();
    for (const event of visibleEvents) {
      const list = byBuilding.get(event.buildingName);
      if (list) {
        list.push(event);
      } else {
        byBuilding.set(event.buildingName, [event]);
      }
    }
    return Array.from(byBuilding.entries()).map(([buildingName, clusterEvents]) => {
      const top = clusterEvents
        .slice()
        .sort((a, b) => (b.interestedUsers?.length ?? 0) - (a.interestedUsers?.length ?? 0))
        .slice(0, EVENTS_PER_BUILDING_CAP);
      return { key: buildingName, lat: top[0].lat, lng: top[0].lng, events: top };
    });
  }, [visibleEvents]);

  // Individual (non-cluster) markers switch from an icon-only teardrop pin
  // to a named capsule once zoomed in past the same threshold clusters break
  // apart at - there's more room per pin and fewer markers competing for
  // attention at that zoom.
  const zoomedIn = zoomDelta < CLUSTER_BREAK_APART_DELTA;

  // Flattens clusters into what actually gets a Marker this render: a solo
  // event stays one marker; a 2+ event building either renders as one
  // pulsing badge (zoomed out) or "breaks apart" into one marker per event,
  // spread around the building's point (zoomed in past CLUSTER_BREAK_APART_DELTA).
  const markers = useMemo(() => {
    const items: { key: string; lat: number; lng: number; events: LocatedEvent[]; isCluster: boolean }[] = [];

    for (const cluster of clusters) {
      const count = cluster.events.length;
      const isCluster = count > 1;
      const brokenApart = isCluster && zoomDelta < CLUSTER_BREAK_APART_DELTA;

      if (!brokenApart) {
        items.push({ key: cluster.key, lat: cluster.lat, lng: cluster.lng, events: cluster.events, isCluster });
        continue;
      }

      cluster.events.forEach((event, index) => {
        const { dLat, dLng } = jitterOffset(index, count);
        items.push({ key: event.id, lat: cluster.lat + dLat, lng: cluster.lng + dLng, events: [event], isCluster: false });
      });
    }

    return items;
  }, [clusters, zoomDelta]);

  const panTo = (event: LocatedEvent) => {
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

  // Matches the reference: clicking a cluster computes bounds and zooms in
  // on it (here, since our clusters don't have per-event coordinates to
  // bound, zooming enough to cross CLUSTER_BREAK_APART_DELTA is what makes
  // its events appear); clicking a lone pin just selects it.
  const onMarkerPress = (lat: number, lng: number, events: LocatedEvent[], isCluster: boolean) => {
    if (isCluster) {
      mapRef.current?.animateToRegion(
        { latitude: lat, longitude: lng, latitudeDelta: CLUSTER_BREAK_APART_DELTA * 0.7, longitudeDelta: CLUSTER_BREAK_APART_DELTA * 0.7 },
        350
      );
      return;
    }
    selectEvent(events[0].id);
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
    if (hasAutoCentered.current || locatedEvents.length === 0) return;
    hasAutoCentered.current = true;
    const avgLat = locatedEvents.reduce((sum, e) => sum + e.lat, 0) / locatedEvents.length;
    const avgLng = locatedEvents.reduce((sum, e) => sum + e.lng, 0) / locatedEvents.length;
    mapRef.current?.animateToRegion({ latitude: avgLat, longitude: avgLng, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 400);
  }, [locatedEvents]);

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
        onRegionChangeComplete={(region: Region) => setZoomDelta(region.latitudeDelta)}
      >
        {markers.map((marker) => {
          const selected = marker.events.some((e) => e.id === selectedId);
          const title = marker.isCluster
            ? `${marker.key} (${marker.events.length} events)`
            : marker.events[0].eventName;
          return (
            <Marker
              key={marker.key}
              coordinate={{ latitude: marker.lat, longitude: marker.lng }}
              title={title}
              onPress={() => onMarkerPress(marker.lat, marker.lng, marker.events, marker.isCluster)}
              anchor={marker.isCluster ? CLUSTER_ANCHOR : zoomedIn ? CAPSULE_ANCHOR : PIN_ANCHOR}
              tracksViewChanges={selected || marker.isCluster || zoomedIn}
            >
              <EventMapCard events={marker.events} selectedEventId={selectedId} zoomedIn={zoomedIn} />
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
