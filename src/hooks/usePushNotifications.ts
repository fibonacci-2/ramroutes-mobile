import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import {
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  subscribeToTopic,
  unsubscribeFromTopic,
} from '@react-native-firebase/messaging';
import { recordError, trackEvent } from '../services/analytics';
import { updateUserNotificationToken } from '../services/users';

// Same topics as the Unity app's FirebaseMessagingManager.SubscribeToTopics.
const TOPICS = ['general', 'updates'] as const;

// Firestore doc IDs (letters/digits/-/_) are always valid FCM topic names -
// see notifyNewBuildingEventV2 (Admin/new-functions/index.js) for the matching send side.
function schoolTopic(schoolId: string): string {
  return `school-${schoolId}`;
}

// RNFirebase only fires onMessage while the app is foregrounded and doesn't
// display anything itself - Android/iOS show FCM notification payloads
// automatically once backgrounded. This mirrors Unity's foreground-only
// ShowSystemNotification call in FirebaseManager.OnMessageReceived.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Mirrors FirebaseMessagingManager.cs: request notification permission, get an
// FCM token, save it to the user's profile, and subscribe to the same topics.
// Unity requests permission/token as soon as the app starts; here we wait for
// a signed-in userId (useAuth already grants one on launch) since the token
// is written straight to that user's profile rather than a separate device doc.
export function usePushNotifications(userId: string | null, schoolId: string | null) {
  const subscribedTopics = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const messaging = getMessaging();

    const registerToken = async (token: string) => {
      await updateUserNotificationToken(userId, token);
      if (subscribedTopics.current) return;
      try {
        await Promise.all(TOPICS.map((topic) => subscribeToTopic(messaging, topic)));
        subscribedTopics.current = true;
      } catch (error) {
        console.error('Topic subscription failed:', error);
        recordError(error, 'push-topic-subscription');
      }
    };

    (async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let status = existingStatus;
        let promptedThisSession = false;
        if (status !== 'granted') {
          ({ status } = await Notifications.requestPermissionsAsync());
          promptedThisSession = true;
        }
        // Only log when we actually showed the OS prompt this run, not on
        // every app open for a user who already answered previously -
        // otherwise "granted" would vastly outnumber real opt-in decisions.
        if (promptedThisSession) {
          trackEvent('notification_permission_resolved', { status });
        }
        if (status !== 'granted' || cancelled) return;

        await registerDeviceForRemoteMessages(messaging);
        const token = await getToken(messaging);
        if (!cancelled && token) {
          await registerToken(token);
        }
      } catch (error) {
        console.error('Error registering for push notifications:', error);
        recordError(error, 'push-registration');
      }
    })();

    const unsubscribeTokenRefresh = onTokenRefresh(messaging, (token) => {
      registerToken(token).catch((error) => {
        console.error('Failed to update refreshed FCM token:', error);
        recordError(error, 'push-token-refresh');
      });
    });

    const unsubscribeMessage = onMessage(messaging, async (remoteMessage) => {
      const notification = remoteMessage.notification;
      if (!notification) return;
      trackEvent('notification_received_foreground', { type: String(remoteMessage.data?.type ?? 'unknown') });
      await Notifications.scheduleNotificationAsync({
        content: { title: notification.title, body: notification.body, data: remoteMessage.data },
        trigger: null,
      });
    });

    // "Received" above only fires while foregrounded (see the comment on
    // setNotificationHandler); this covers the actual tap-to-open, which is
    // the metric that answers "did the notification bring someone back in"
    // - split by source since the same logical open can arrive via two
    // different SDKs depending on app state (see below).

    // App was backgrounded (not killed) and a system-shown FCM notification
    // was tapped.
    const unsubscribeOpenedApp = onNotificationOpenedApp(messaging, (remoteMessage) => {
      trackEvent('notification_opened', {
        source: 'background',
        type: String(remoteMessage.data?.type ?? 'unknown'),
      });
    });

    // App was killed and launched fresh by tapping a system-shown FCM
    // notification - only meaningful once, right after mount.
    getInitialNotification(messaging).then((remoteMessage) => {
      if (!remoteMessage || cancelled) return;
      trackEvent('notification_opened', {
        source: 'killed',
        type: String(remoteMessage.data?.type ?? 'unknown'),
      });
    });

    // Covers the other notification path: one we scheduled locally via
    // Notifications.scheduleNotificationAsync above, while foregrounded -
    // those are expo-notifications' own objects, not RNFB RemoteMessages,
    // so they need their own listener rather than onNotificationOpenedApp.
    const localResponseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      trackEvent('notification_opened', {
        source: 'local_foreground',
        type: String(data?.type ?? 'unknown'),
      });
    });
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response || cancelled) return;
      const data = response.notification.request.content.data;
      trackEvent('notification_opened', {
        source: 'local_cold_start',
        type: String(data?.type ?? 'unknown'),
      });
    });

    return () => {
      cancelled = true;
      unsubscribeTokenRefresh();
      unsubscribeMessage();
      unsubscribeOpenedApp();
      localResponseSub.remove();
    };
  }, [userId]);

  // Split from the effect above so switching schools (SchoolPickerScreen via
  // RootShell's onChangeSchool) just swaps the topic subscription instead of
  // re-running token registration.
  useEffect(() => {
    if (!schoolId) return;
    const messaging = getMessaging();
    const topic = schoolTopic(schoolId);
    subscribeToTopic(messaging, topic).catch((error) => {
      console.error('School topic subscription failed:', error);
      recordError(error, 'push-school-topic-subscribe');
    });
    return () => {
      unsubscribeFromTopic(messaging, topic).catch((error) => {
        console.error('School topic unsubscription failed:', error);
        recordError(error, 'push-school-topic-unsubscribe');
      });
    };
  }, [schoolId]);
}
