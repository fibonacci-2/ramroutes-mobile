import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import {
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  subscribeToTopic,
  unsubscribeFromTopic,
} from '@react-native-firebase/messaging';
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
      }
    };

    (async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let status = existingStatus;
        if (status !== 'granted') {
          ({ status } = await Notifications.requestPermissionsAsync());
        }
        if (status !== 'granted' || cancelled) return;

        await registerDeviceForRemoteMessages(messaging);
        const token = await getToken(messaging);
        if (!cancelled && token) {
          await registerToken(token);
        }
      } catch (error) {
        console.error('Error registering for push notifications:', error);
      }
    })();

    const unsubscribeTokenRefresh = onTokenRefresh(messaging, (token) => {
      registerToken(token).catch((error) => console.error('Failed to update refreshed FCM token:', error));
    });

    const unsubscribeMessage = onMessage(messaging, async (remoteMessage) => {
      const notification = remoteMessage.notification;
      if (!notification) return;
      await Notifications.scheduleNotificationAsync({
        content: { title: notification.title, body: notification.body, data: remoteMessage.data },
        trigger: null,
      });
    });

    return () => {
      cancelled = true;
      unsubscribeTokenRefresh();
      unsubscribeMessage();
    };
  }, [userId]);

  // Split from the effect above so switching schools (SchoolPickerScreen via
  // RootShell's onChangeSchool) just swaps the topic subscription instead of
  // re-running token registration.
  useEffect(() => {
    if (!schoolId) return;
    const messaging = getMessaging();
    const topic = schoolTopic(schoolId);
    subscribeToTopic(messaging, topic).catch((error) =>
      console.error('School topic subscription failed:', error),
    );
    return () => {
      unsubscribeFromTopic(messaging, topic).catch((error) =>
        console.error('School topic unsubscription failed:', error),
      );
    };
  }, [schoolId]);
}
