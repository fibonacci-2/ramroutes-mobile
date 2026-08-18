import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { primaryTagStyle } from '../constants/tagStyles';
import { EventWithLocation, hasLatLng } from '../hooks/useEvents';
import { UserLocation } from '../hooks/useUserLocation';
import { color, font, radius, shadow } from '../theme';
import { distanceMiles } from '../utils/distance';
import Icon from './Icon';

export const FOR_YOU_CARD_WIDTH = 240;

type Props = {
  event: EventWithLocation;
  userLocation: UserLocation | null;
  onPress: () => void;
};

// Image-forward card used only in EventsListScreen's "For you" rail - unlike
// the plain icon-only EventRailCard (shared with MapScreen's own rail), this
// leans on the event's photo so the curated section actually *looks*
// different from the plain rows below it, not just differently positioned.
// Falls back to the category icon blob if there's no image or it fails to
// load, same pattern as EventDetailSheet's hero image.
export default function ForYouCard({ event, userLocation, onPress }: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const style = primaryTagStyle(event.tags);
  const dist = userLocation && hasLatLng(event) ? `${distanceMiles(userLocation, event).toFixed(1)} mi` : null;
  const showImage = !!event.imageUrl && !imageFailed;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.imageWrap, { backgroundColor: style.tint }]}>
        {showImage ? (
          <Image
            source={{ uri: event.imageUrl }}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Icon name={style.icon} size={30} color={style.ink} strokeWidth={2} />
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {event.eventName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[event.date, event.buildingName, dist].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: FOR_YOU_CARD_WIDTH,
    backgroundColor: 'white',
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.md,
  },
  imageWrap: { height: 108, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  body: { padding: 12 },
  title: { fontFamily: font.bodyBold, fontSize: 14.5, color: color.text, marginBottom: 3 },
  meta: { fontFamily: font.bodySemibold, fontSize: 11, color: color.neutral600 },
});
