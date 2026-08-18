import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { primaryTagStyle } from '../constants/tagStyles';
import { EventWithLocation } from '../hooks/useEvents';
import { color, font } from '../theme';
import Icon from './Icon';

type Props = {
  events: EventWithLocation[]; // every event at this marker's building
  selectedEventId: string | null;
  // True once the map is zoomed in past MapScreen's break-apart threshold -
  // individual (non-cluster) markers switch from an icon-only teardrop pin
  // to a named capsule, since there's more screen room per pin at that zoom
  // and fewer markers competing for attention.
  zoomedIn: boolean;
};

// Matches desginv2/Quad Campus Events.dc.html's map marker design exactly:
// a rotated-square "teardrop" pin per event (icon only, no name label - the
// bottom rail already shows the name once selected), and for buildings with
// 2+ events, a single pulsing glow+ring badge sized by count instead of N
// overlapping identical pins.
function clusterSize(count: number): number {
  return Math.min(78, 46 + count * 5);
}

export default function EventMapCard({ events, selectedEventId, zoomedIn }: Props) {
  const selected = events.some((e) => e.id === selectedEventId);
  const isCluster = events.length > 1;
  const style = primaryTagStyle(events[0].tags);

  // Two driving values so the glow's symmetric breathe (up then back down)
  // and the ring's one-way expand-and-fade can loop independently, matching
  // the reference's pulseGlow/pulseRing keyframes (both 2.6s).
  const glow = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isCluster) return;
    // useNativeDriver: false, deliberately - react-native-maps snapshots
    // custom marker content into a native bitmap via tracksViewChanges, and
    // that snapshot mechanism only reliably re-fires on normal React render
    // commits. A native-driver animation updates the view directly on the
    // native UI thread without going through JS/React at all, so RNMaps
    // never sees a "new frame" to re-capture - the marker just looks frozen.
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1300, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: 1300, useNativeDriver: false }),
      ])
    );
    const ringLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ring, { toValue: 1, duration: 2600, useNativeDriver: false }),
        Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    );
    glowLoop.start();
    ringLoop.start();
    return () => {
      glowLoop.stop();
      ringLoop.stop();
    };
  }, [isCluster, glow, ring]);

  if (isCluster) {
    const size = clusterSize(events.length);
    const inner = Math.round(size * 0.46);
    const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.06] });
    const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.85] });
    const ringSize = size - 12; // inset ~6px from the edge on each side
    const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1.4] });
    const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0] });

    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[styles.glowWrap, { width: size, height: size, opacity: glowOpacity, transform: [{ scale: glowScale }] }]}>
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={color.accent} stopOpacity={0.85} />
                <Stop offset="62%" stopColor={color.accent} stopOpacity={0.3} />
                <Stop offset="100%" stopColor={color.accent} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#glow)" />
          </Svg>
        </Animated.View>
        <Animated.View
          style={[
            styles.ring,
            { width: ringSize, height: ringSize, borderRadius: ringSize / 2, opacity: ringOpacity, transform: [{ scale: ringScale }] },
          ]}
        />
        <View style={[styles.badge, { width: inner, height: inner, borderRadius: inner / 2 }]}>
          <Text style={[styles.badgeCount, { fontSize: inner > 34 ? 17 : 14 }]}>{events.length}</Text>
        </View>
      </View>
    );
  }

  if (zoomedIn) {
    return (
      <View style={[styles.capsule, selected && styles.capsuleSelected]}>
        <View style={[styles.capsuleIcon, { backgroundColor: style.pinBg }]}>
          <Icon name={style.icon} size={11} color="white" strokeWidth={2.75} />
        </View>
        <Text style={styles.capsuleLabel} numberOfLines={1}>
          {events[0].eventName}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.pin, { backgroundColor: style.pinBg }, selected && styles.pinSelected]}>
      <View style={styles.pinIconWrap}>
        <Icon name={style.icon} size={15} color="white" strokeWidth={2.75} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 36,
    height: 36,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
    borderBottomLeftRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'white',
    transform: [{ rotate: '-45deg' }],
    shadowColor: '#2e2b25',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  pinSelected: { transform: [{ rotate: '-45deg' }, { scale: 1.25 }] },
  pinIconWrap: { transform: [{ rotate: '45deg' }] },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 170,
    backgroundColor: 'white',
    borderRadius: 999,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 11,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#2e2b25',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 5,
  },
  capsuleSelected: { borderColor: color.accent },
  capsuleIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  capsuleLabel: { flexShrink: 1, fontFamily: font.bodyBold, fontSize: 11.5, color: color.text },
  glowWrap: { position: 'absolute' },
  // rgba(198,113,57,.55) = color.accent (#c67139) at 55% alpha, matching the
  // reference's `1.5px solid color-mix(in srgb, var(--color-accent) 55%, transparent)`
  // baked in - the animated opacity below (0.85->0) then multiplies on top of this,
  // same as CSS opacity does.
  ring: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(198,113,57,0.55)' },
  badge: {
    backgroundColor: color.accent,
    borderWidth: 2.5,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2e2b25',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 5,
  },
  badgeCount: { fontFamily: font.heading, color: 'white' },
});
