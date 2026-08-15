import { getAuth } from '@react-native-firebase/auth';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import EventDetailSheet from '../components/EventDetailSheet';
import Icon, { IconName } from '../components/Icon';
import { useEvents } from '../hooks/useEvents';
import { useUserLocation } from '../hooks/useUserLocation';
import { setInterested } from '../services/buildingEvents';
import { color, font, radius } from '../theme';
import { byId } from '../utils/byId';
import EventsListScreen from './EventsListScreen';
import MapScreen from './MapScreen';
import SavedScreen from './SavedScreen';
import ScoutScreen from './ScoutScreen';

type Tab = 'map' | 'list' | 'chat' | 'saved';

const TABS: { id: Tab; icon: IconName; label: string }[] = [
  { id: 'map', icon: 'map', label: 'Map' },
  { id: 'list', icon: 'cal', label: 'Events' },
  { id: 'chat', icon: 'chat', label: 'Scout' },
  { id: 'saved', icon: 'bookmark', label: 'Saved' },
];

export default function RootShell() {
  const [tab, setTab] = useState<Tab>('map');
  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [chatSeed, setChatSeed] = useState<string | null>(null);

  const events = useEvents();
  const userLocation = useUserLocation();
  const userId = getAuth().currentUser?.uid;

  const detailEvent = detailEventId ? byId(events, detailEventId) ?? null : null;
  const detailSaved = !!userId && !!detailEvent?.interestedUsers?.includes(userId);

  const openDetail = (eventId: string) => setDetailEventId(eventId);
  const closeDetail = () => setDetailEventId(null);

  const askScout = (eventName: string) => {
    closeDetail();
    setTab('chat');
    setChatSeed(`Tell me about ${eventName}`);
  };

  return (
    <View style={styles.root}>
      <View style={styles.screen}>
        {tab === 'map' && <MapScreen onOpenDetail={openDetail} onSearchPress={() => setTab('list')} />}
        {tab === 'list' && <EventsListScreen userId={userId} onOpenDetail={openDetail} />}
        {tab === 'chat' && (
          <ScoutScreen
            userId={userId}
            seedMessage={chatSeed}
            onSeedConsumed={() => setChatSeed(null)}
            onOpenDetail={openDetail}
          />
        )}
        {tab === 'saved' && <SavedScreen userId={userId} onOpenDetail={openDetail} onBrowseEvents={() => setTab('list')} />}
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
        onToggleSave={() => userId && detailEvent && setInterested(detailEvent.id, userId, !detailSaved)}
        onAskScout={askScout}
      />
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
