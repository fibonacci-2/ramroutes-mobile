import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import EventDetailSheet from '../components/EventDetailSheet';
import Icon, { IconName } from '../components/Icon';
import { EventWithLocation, hasLatLng, useEvents } from '../hooks/useEvents';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useUserLocation } from '../hooks/useUserLocation';
import { trackEvent, trackScreenView } from '../services/analytics';
import { setInterested } from '../services/buildingEvents';
import { color, font, radius } from '../theme';
import { byId } from '../utils/byId';
import EventsListScreen from './EventsListScreen';
import MapScreen from './MapScreen';
import PreferencesScreen from './PreferencesScreen';
import SavedScreen from './SavedScreen';
import ScoutScreen, { Message as ScoutMessage } from './ScoutScreen';

type Tab = 'map' | 'list' | 'chat' | 'profile';

const TABS: { id: Tab; icon: IconName; label: string }[] = [
  { id: 'map', icon: 'map', label: 'Map' },
  { id: 'list', icon: 'cal', label: 'Events' },
  { id: 'chat', icon: 'chat', label: 'Scout' },
  { id: 'profile', icon: 'user', label: 'You' },
];

type Props = {
  userId: string;
  schoolId: string;
  onChangeSchool: () => void;
};

export default function RootShell({ userId, schoolId, onChangeSchool }: Props) {
  const [tab, setTab] = useState<Tab>('map');
  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [chatSeed, setChatSeed] = useState<string | null>(null);
  // Owned here, not inside ScoutScreen, so the conversation survives
  // switching tabs instead of resetting every time ScoutScreen unmounts.
  const [scoutMessages, setScoutMessages] = useState<ScoutMessage[]>([]);
  const [directionsEventId, setDirectionsEventId] = useState<string | null>(null);
  const [savedVisible, setSavedVisible] = useState(false);

  const events = useEvents(schoolId);
  const userLocation = useUserLocation();
  usePushNotifications(userId, schoolId);

  // Covers every path that changes `tab` (the tab bar, askScout's jump to
  // chat, showDirections' jump to map, the search shortcut, Saved's browse
  // button) from one place instead of instrumenting each setTab call site.
  useEffect(() => {
    trackScreenView(tab);
  }, [tab]);

  const detailEvent = detailEventId ? byId(events, detailEventId) ?? null : null;
  const detailSaved = !!detailEvent?.interestedUsers?.includes(userId);
  // Directions is only ever requested for a located event - EventDetailSheet
  // hides the "Directions" button otherwise - but MapScreen's directionsTo
  // prop requires real coordinates, so narrow here too.
  const directionsCandidate = directionsEventId ? byId(events, directionsEventId) ?? null : null;
  const directionsToEvent = directionsCandidate && hasLatLng(directionsCandidate) ? directionsCandidate : null;

  const openDetail = (eventId: string) => {
    setDetailEventId(eventId);
    trackEvent('event_detail_opened', { event_id: eventId });
  };
  const closeDetail = () => setDetailEventId(null);

  const askScout = (eventName: string) => {
    closeDetail();
    setTab('chat');
    setChatSeed(`Tell me about ${eventName}`);
    trackEvent('ask_scout_about_event');
  };

  const showDirections = (event: EventWithLocation) => {
    closeDetail();
    setTab('map');
    setDirectionsEventId(event.id);
    trackEvent('event_directions_requested', { event_id: event.id });
  };

  return (
    <View style={styles.root}>
      <View style={styles.screen}>
        {tab === 'map' && (
          <MapScreen
            events={events}
            onOpenDetail={openDetail}
            onSearchPress={() => setTab('list')}
            directionsTo={directionsToEvent}
            onClearDirections={() => setDirectionsEventId(null)}
          />
        )}
        {tab === 'list' && <EventsListScreen events={events} userId={userId} onOpenDetail={openDetail} />}
        {tab === 'chat' && (
          <ScoutScreen
            events={events}
            messages={scoutMessages}
            setMessages={setScoutMessages}
            seedMessage={chatSeed}
            onSeedConsumed={() => setChatSeed(null)}
            onOpenDetail={openDetail}
          />
        )}
        {tab === 'profile' && (
          <PreferencesScreen
            schoolId={schoolId}
            onOpenSaved={() => {
              setSavedVisible(true);
              trackScreenView('saved');
            }}
            onChangeSchool={() => {
              trackEvent('change_school_requested');
              onChangeSchool();
            }}
          />
        )}
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <Pressable key={t.id} style={styles.tab} onPress={() => setTab(t.id)}>
              <View style={[styles.tabIcon, active && styles.tabIconActive]}>
                <Icon name={t.icon} size={19} color={active ? color.accent700 : color.neutral600} />
              </View>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <EventDetailSheet
        event={detailEvent}
        userLocation={userLocation}
        saved={detailSaved}
        onClose={closeDetail}
        onToggleSave={() => {
          if (!detailEvent) return;
          const nextSaved = !detailSaved;
          setInterested(detailEvent.id, userId, nextSaved);
          trackEvent('event_rsvp_toggled', { event_id: detailEvent.id, saved: nextSaved });
        }}
        onAskScout={askScout}
        onDirections={showDirections}
      />

      {savedVisible && (
        <Modal visible animationType="slide" onRequestClose={() => setSavedVisible(false)}>
          <SavedScreen
            events={events}
            userId={userId}
            onOpenDetail={(eventId) => {
              setSavedVisible(false);
              openDetail(eventId);
            }}
            onBrowseEvents={() => {
              setSavedVisible(false);
              setTab('list');
            }}
            onClose={() => setSavedVisible(false)}
          />
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  screen: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(245,234,216,0.94)',
    borderTopWidth: 1,
    borderTopColor: color.divider,
  },
  tab: { alignItems: 'center', gap: 3, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16 },
  tabIcon: { width: 44, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabIconActive: { backgroundColor: color.accent200 },
  tabLabel: { fontFamily: font.bodyBold, fontSize: 10.5, color: color.neutral600 },
  tabLabelActive: { color: color.accent700 },
});
