import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { primaryTagStyle } from '../constants/tagStyles';
import { EventWithLocation, hasLatLng } from '../hooks/useEvents';
import { UserLocation } from '../hooks/useUserLocation';
import { color, font, radius, shadow } from '../theme';
import { distanceMiles } from '../utils/distance';
import Icon from './Icon';
import TagPills from './TagPills';

type Props = {
  event: EventWithLocation | null;
  userLocation: UserLocation | null;
  saved: boolean;
  onClose: () => void;
  onToggleSave: () => void;
  onAskScout: (eventName: string) => void;
  onDirections: (event: EventWithLocation) => void;
};

export default function EventDetailSheet({
  event,
  userLocation,
  saved,
  onClose,
  onToggleSave,
  onAskScout,
  onDirections,
}: Props) {
  // Keyed by event id (not a plain boolean) so a broken image on one event
  // doesn't stick around and hide a working image on the next one opened.
  const [failedImageId, setFailedImageId] = useState<string | null>(null);

  if (!event) return null;

  const style = primaryTagStyle(event.tags);
  const dist = userLocation && hasLatLng(event) ? `${distanceMiles(userLocation, event).toFixed(1)} mi from you` : null;
  const primaryTag = event.tags?.[0];
  const showImage = !!event.imageUrl && failedImageId !== event.id;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={[styles.hero, { backgroundColor: style.tint }]}>
          {showImage ? (
            <Image
              source={{ uri: event.imageUrl }}
              style={styles.heroImage}
              resizeMode="cover"
              onError={() => setFailedImageId(event.id)}
            />
          ) : (
            <View style={styles.heroBlob}>
              <Icon name={style.icon} size={56} color={style.ink} strokeWidth={2} />
            </View>
          )}
          <Pressable style={styles.backBtn} onPress={onClose}>
            <Icon name="back" size={20} color={color.text} />
          </Pressable>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {primaryTag ? (
            <View style={[styles.categoryTag, { backgroundColor: style.tint }]}>
              <Text style={[styles.categoryTagText, { color: style.ink }]}>{primaryTag}</Text>
            </View>
          ) : null}

          <Text style={styles.title}>{event.eventName}</Text>

          {event.date ? (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Icon name="clock" size={18} color={color.accent700} />
              </View>
              <Text style={styles.detailText}>{event.date}</Text>
            </View>
          ) : null}

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Icon name="pin" size={18} color={color.accent700} />
            </View>
            <View style={styles.detailTextGroup}>
              <Text style={styles.detailText}>{event.buildingName}</Text>
              {dist ? <Text style={styles.detailSub}>{dist}</Text> : null}
            </View>
          </View>

          <TagPills tags={event.tags ?? []} />

          {event.description ? <Text style={styles.description}>{event.description}</Text> : null}

          <Pressable style={styles.askScout} onPress={() => onAskScout(event.eventName)}>
            <Icon name="spark" size={16} color={color.text} />
            <Text style={styles.askScoutText}>Ask Scout about this</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.actions}>
          {hasLatLng(event) && (
            <Pressable style={[styles.pill, styles.pillGhost]} onPress={() => onDirections(event)}>
              <Icon name="nav" size={16} color={color.text} />
              <Text style={styles.pillGhostText}>Directions</Text>
            </Pressable>
          )}
          <Pressable style={[styles.pill, styles.pillPrimary]} onPress={onToggleSave}>
            <Icon name="bookmark" size={16} color="white" />
            <Text style={styles.pillPrimaryText}>{saved ? 'Saved' : 'Save'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  hero: { height: 210, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  heroImage: StyleSheet.absoluteFill,
  backBtn: {
    position: 'absolute',
    top: 56,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  heroBlob: {
    width: 150,
    height: 150,
    borderRadius: 70,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  bodyContent: { padding: 22, paddingBottom: 40 },
  categoryTag: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11 },
  categoryTagText: { fontFamily: font.bodyBold, fontSize: 11.5 },
  title: { fontFamily: font.heading, fontSize: 30, color: color.text, marginTop: 10, marginBottom: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  detailIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md - 2,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Without flex:1 here, this View (a row sibling of the fixed-width icon)
  // sizes to its content instead of the remaining row width, so a long
  // building name just grows past the sheet edge and gets clipped instead
  // of wrapping.
  detailTextGroup: { flex: 1 },
  detailText: { fontFamily: font.bodySemibold, fontSize: 13.5, color: color.neutral800, flexShrink: 1 },
  detailSub: { fontFamily: font.bodySemibold, fontSize: 11, color: color.neutral600, marginTop: 2 },
  description: { fontFamily: font.body, fontSize: 14, lineHeight: 22, color: color.text, marginTop: 10 },
  askScout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.pill,
    paddingVertical: 15,
    marginTop: 18,
    backgroundColor: 'white',
    ...shadow.sm,
  },
  askScoutText: { fontFamily: font.heading, fontSize: 15, color: color.text },
  actions: { flexDirection: 'row', gap: 10, padding: 20, paddingBottom: 34, backgroundColor: color.bg },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.pill, paddingVertical: 15 },
  pillGhost: { backgroundColor: 'white', ...shadow.sm },
  pillGhostText: { fontFamily: font.heading, fontSize: 15, color: color.text },
  pillPrimary: { backgroundColor: color.accent },
  pillPrimaryText: { fontFamily: font.heading, fontSize: 15, color: 'white' },
});
