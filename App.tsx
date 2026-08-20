import { Caprasimo_400Regular } from '@expo-google-fonts/caprasimo';
import { Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold } from '@expo-google-fonts/figtree';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import AnimatedSplash from './src/components/AnimatedSplash';
import ErrorBoundary from './src/components/ErrorBoundary';
import AppGate from './src/screens/AppGate';
import { initAnalytics } from './src/services/analytics';

// Full entrance sequence (icon settle -> wordmark -> tagline) finishes by
// ~1450ms - see AnimatedSplash.tsx's timeline comment. This is a floor, not
// the actual hide trigger: the splash also waits on AppGate's onReady (see
// below), so a slow network extends the splash instead of it disappearing
// early into AppGate's own loading spinner. This floor just stops a fast,
// fully-cached load from cutting the entrance animation off mid-flight.
const MIN_SPLASH_MS = 1800;
const FADE_MS = 300;

export default function App() {
  const [fontsLoaded] = useFonts({
    Caprasimo_400Regular,
    Figtree_400Regular,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });
  const [showSplash, setShowSplash] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [appGateReady, setAppGateReady] = useState(false);
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;
    // Hands off from the native OS-level splash (static, shows before any
    // JS runs) to this animated one immediately once the app can actually
    // render - AnimatedSplash's own bg/logo match splash-icon.png/
    // app.json's splash backgroundColor exactly, so there's no visible
    // swap, just static handing off to animated.
    SplashScreen.hideAsync();
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  // Only fades once BOTH the entrance animation has had time to play AND
  // AppGate has real content ready - whichever finishes last. That's what
  // stops AppGate's ActivityIndicator from ever showing: the splash simply
  // stays up for as long as loading actually takes instead of a fixed
  // timer a slow connection could outlast.
  useEffect(() => {
    if (!minTimeElapsed || !appGateReady || !showSplash) return;
    Animated.timing(splashOpacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => {
      setShowSplash(false);
    });
  }, [minTimeElapsed, appGateReady, showSplash, splashOpacity]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <View style={styles.root}>
        <AppGate onReady={() => setAppGateReady(true)} />
        <StatusBar style="dark" />
        {showSplash && (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: splashOpacity }]}>
            <AnimatedSplash />
          </Animated.View>
        )}
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
