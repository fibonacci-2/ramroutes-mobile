import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { color, font } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 84;
const STROKE = 9;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type Props = {
  percent: number; // 0-100
};

export default function ProfileCompletionRing({ percent }: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: percent / 100,
      duration: 500,
      useNativeDriver: false, // strokeDashoffset isn't supported by the native driver
    }).start();
  }, [percent, progress]);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
  });

  return (
    <View style={styles.row}>
      <View style={styles.ringWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={color.neutral200} strokeWidth={STROKE} fill="none" />
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={color.accent}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            rotation="-90"
            origin={`${SIZE / 2}, ${SIZE / 2}`}
          />
        </Svg>
        <View style={styles.center}>
          <Text style={styles.percentText}>{percent}%</Text>
        </View>
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title}>{percent === 100 ? 'Profile complete' : 'Complete your profile'}</Text>
        <Text style={styles.subtitle}>
          {percent === 100
            ? "You're all set - we've got everything we need to find your events."
            : 'Add a bio, major, interests, and class year to improve your recommendations.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  ringWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  percentText: { fontFamily: font.heading, fontSize: 16, color: color.accent700 },
  textCol: { flex: 1 },
  title: { fontFamily: font.bodyBold, fontSize: 14.5, color: color.text, marginBottom: 3 },
  subtitle: { fontFamily: font.body, fontSize: 12, color: color.neutral600, lineHeight: 16 },
});
