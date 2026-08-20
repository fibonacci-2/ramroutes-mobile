import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { color, font } from '../theme';

// Faithful port of desginv2/logo/Appa Icon Animated.dc.html's CSS keyframe
// timeline to react-native's Animated API - same sequence, same relative
// delays/durations, standard RN Easing curves standing in for the
// reference's exact cubic-beziers (not worth chasing frame-perfect
// matching on transforms this small/brief).
//
// Timeline (ms, from mount):
//   0    icon container starts entering (scale/translateY/opacity, 850ms,
//        overshoots past 1 then settles - see iconScale below)
//   550  inner dot starts its elastic "settle" bounce (600ms)
//   750  "Appa" wordmark rises in (500ms)
//   850  icon entrance finishes; ambient glow pulse + both expanding rings
//        start looping (glow 2400ms breathe; rings 2400ms expand-and-fade,
//        ring2 offset a further 1000ms behind ring1, matching the
//        reference's staggered "sonar ping" pair)
//   950  tagline rises in (500ms)
export default function AnimatedSplash() {
  const iconScale = useRef(new Animated.Value(0.3)).current;
  const iconTranslateY = useRef(new Animated.Value(10)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(10)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const tagTranslateY = useRef(new Animated.Value(8)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // iconEnter: scale 0.3 -> 1.12 (overshoot, 55% of 850ms) -> 0.96
    // (undershoot, 75%) -> 1 (settle, 100%); translateY/opacity reach their
    // final values at the same 55% mark as the scale overshoot peak.
    Animated.sequence([
      Animated.timing(iconScale, { toValue: 1.12, duration: 468, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(iconScale, { toValue: 0.96, duration: 170, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(iconScale, { toValue: 1, duration: 212, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]).start();
    Animated.timing(iconTranslateY, { toValue: 0, duration: 468, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(iconOpacity, { toValue: 1, duration: 468, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

    // dotSettle: 0 -> 1.3 (overshoot, 60% of 600ms) -> 1 (settle), starting
    // once the icon shell itself has mostly landed.
    Animated.sequence([
      Animated.delay(550),
      Animated.timing(dotScale, { toValue: 1.3, duration: 360, easing: Easing.out(Easing.back(1.8)), useNativeDriver: true }),
      Animated.timing(dotScale, { toValue: 1, duration: 240, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]).start();

    // textRise / tagRise: simple rise-and-fade-in, staggered.
    Animated.sequence([
      Animated.delay(750),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(textTranslateY, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
    Animated.sequence([
      Animated.delay(950),
      Animated.parallel([
        Animated.timing(tagOpacity, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(tagTranslateY, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    // Ambient loops start once the entrance settles, not before - starting
    // them immediately would have the glow/rings pulsing underneath an
    // icon that's still visibly flying in.
    const entranceTimer = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();

      // ringOut: expands/fades over the first 75% of each 2400ms cycle,
      // then holds at its faded-out end state for the remaining 25%
      // (matches the reference's "75%,100%" keyframe holding flat) before
      // Animated.loop's automatic reset snaps it back to the start.
      Animated.loop(
        Animated.sequence([
          Animated.timing(ring1, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.delay(600),
        ])
      ).start();
    }, 850);

    const ring2Timer = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(ring2, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.delay(600),
        ])
      ).start();
    }, 1850);

    return () => {
      clearTimeout(entranceTimer);
      clearTimeout(ring2Timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.8] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.1] });
  const ring1Opacity = ring1.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] });
  const ring1Scale = ring1.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.7] });
  const ring2Opacity = ring2.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });
  const ring2Scale = ring2.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.7] });

  return (
    <View style={styles.screen}>
      <Animated.View
        style={[
          styles.iconWrap,
          { opacity: iconOpacity, transform: [{ translateY: iconTranslateY }, { scale: iconScale }] },
        ]}
      >
        <View style={styles.iconBg} />

        <Animated.View style={[styles.glowWrap, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}>
          <Svg width={220} height={220}>
            <Defs>
              <RadialGradient id="splashGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={color.accent} stopOpacity={0.9} />
                <Stop offset="60%" stopColor={color.accent} stopOpacity={0.35} />
                <Stop offset="100%" stopColor={color.accent} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={110} cy={110} r={110} fill="url(#splashGlow)" />
          </Svg>
        </Animated.View>

        <Animated.View style={[styles.ring, { opacity: ring1Opacity, transform: [{ scale: ring1Scale }] }]} />
        <Animated.View style={[styles.ring, { opacity: ring2Opacity, transform: [{ scale: ring2Scale }] }]} />

        <View style={styles.innerCircle}>
          <Animated.View style={[styles.dot, { transform: [{ scale: dotScale }] }]} />
        </View>
      </Animated.View>

      <Animated.Text style={[styles.wordmark, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}>
        Appa
      </Animated.Text>
      <Animated.Text style={[styles.tagline, { opacity: tagOpacity, transform: [{ translateY: tagTranslateY }] }]}>
        Personalize your campus experience
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', gap: 22 },
  iconWrap: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  iconBg: { ...StyleSheet.absoluteFill, borderRadius: 110, backgroundColor: color.accent },
  glowWrap: { position: 'absolute', width: 220, height: 220 },
  ring: {
    position: 'absolute',
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  innerCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2e2b25',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 26,
    elevation: 8,
  },
  dot: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.accent },
  wordmark: { fontFamily: font.heading, fontSize: 34, color: '#402310' },
  tagline: { fontFamily: font.bodySemibold, fontSize: 13, color: color.neutral600, letterSpacing: 0.3 },
});
