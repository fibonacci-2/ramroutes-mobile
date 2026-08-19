import { Component, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { recordError } from '../services/analytics';
import { color, font } from '../theme';

type Props = { children: ReactNode };
type State = { hasError: boolean };

// React error boundaries only catch render/lifecycle errors thrown by
// components beneath them, not errors in event handlers, async code, or
// promise rejections (those are reported via recordError at their own
// catch sites - e.g. ScoutScreen's askScout().catch()). This is strictly
// the "the app would otherwise render a blank white screen" backstop.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    recordError(error, 'react-render');
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.center}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>Try closing and reopening the app. We've been notified.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 8 },
  title: { fontFamily: font.heading, fontSize: 20, color: color.text, textAlign: 'center' },
  body: { fontFamily: font.body, fontSize: 14, color: color.neutral600, textAlign: 'center' },
});
