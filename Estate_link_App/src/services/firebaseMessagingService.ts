import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getBackendURL } from '../config/environment';
import { getAuthHeaders } from '../utils/authUtils';
import { navigate } from '../utils/navigationRef';

/** Lazy-loaded Firebase messaging module; null if native module not available (e.g. Expo Go or needs rebuild). */
let _messaging: Awaited<ReturnType<typeof getMessaging>> = undefined;

/**
 * Get Firebase messaging module. Loads it on first use and returns null if the native module is not found.
 */
async function getMessaging(): Promise<typeof import('@react-native-firebase/messaging').default | null> {
  if (_messaging !== undefined) return _messaging;
  try {
    const mod = await import('@react-native-firebase/messaging');
    _messaging = mod.default;
    return _messaging;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.includes('RNFBAppModule') ||
      msg.includes('Native module') ||
      msg.includes('not found')
    ) {
      console.warn(
        '[Firebase] Native module not available. Run a development build (expo prebuild && pod install && rebuild). Push notifications disabled.'
      );
      _messaging = null;
      return null;
    }
    throw error;
  }
}

function isFirebaseUnavailableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('RNFBAppModule') ||
    msg.includes('Native module') ||
    msg.includes('not found')
  );
}

export class FirebaseMessagingService {
  /**
   * Request notification permissions and get FCM token
   */
  static async requestPermissionAndGetToken(): Promise<string | null> {
    try {
      const messaging = await getMessaging();
      if (!messaging) return null;

      console.log('🔔 Requesting FCM permission...');
      const authStatus = await messaging().requestPermission();
      console.log('🔔 Permission status:', authStatus);

      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('❌ Push notification permission denied');
        return null;
      }

      console.log('🔔 Getting FCM token...');
      const token = await messaging().getToken();
      console.log('✅ FCM Token obtained:', token);
      return token;
    } catch (error) {
      if (isFirebaseUnavailableError(error)) return null;
      console.error('❌ Error getting FCM token:', error);
      if (error instanceof Error) {
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
      }
      return null;
    }
  }

  /**
   * Register FCM token with backend
   */
  static async registerDeviceToken(token: string, authToken?: string): Promise<boolean> {
    try {
      const url = `${getBackendURL()}/api/notifications/register-device/`;

      console.log('📤 Registering FCM token with backend...');
      console.log('  - URL:', url);
      console.log('  - Token:', token.substring(0, 20) + '...');

      const headers = getAuthHeaders(authToken);
      const requestBody = {
        push_token: token,
        device_type: Platform.OS,
        device_id: Platform.OS === 'android' ? 'android-device' : 'ios-device',
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Failed to register token:', errorData);
        return false;
      }

      const responseData = await response.json();
      console.log('✅ FCM token registered with backend:', responseData);
      return true;
    } catch (error) {
      console.error('❌ Error registering FCM token:', error);
      return false;
    }
  }

  /**
   * Initialize Firebase messaging
   */
  static async initialize(authToken?: string): Promise<void> {
    try {
      console.log('🚀 Initializing Firebase Cloud Messaging...');
      console.log('🔑 Auth token provided:', !!authToken);

      const messaging = await getMessaging();
      if (!messaging) {
        console.warn('[Firebase] Skipping init: native module not available.');
        return;
      }

      // Request notification permissions from expo-notifications
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      console.log('🔔 Notification permission status:', finalStatus);

      // Set up notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });
        console.log('✅ Android notification channel created');
      }

      // Get FCM token
      const token = await this.requestPermissionAndGetToken();
      console.log('📱 FCM token result:', token ? 'Token received' : 'No token');

      if (token && authToken) {
        console.log('📤 Registering token with backend...');
        const registered = await this.registerDeviceToken(token, authToken);
        console.log('✅ Token registration result:', registered);
      } else if (token && !authToken) {
        console.log('⚠️ Token received but no auth token provided - will register after login');
      } else {
        console.log('⚠️ No FCM token received');
      }

      // Set up listeners
      console.log('🔔 Setting up FCM listeners...');
      await this.setupListeners();
      console.log('✅ Firebase messaging initialized successfully');
    } catch (error) {
      if (isFirebaseUnavailableError(error)) return;
      console.error('❌ Error initializing Firebase messaging:', error);
      if (error instanceof Error) {
        console.error('❌ Error details:', error.message);
      }
    }
  }

  /**
   * Setup message listeners
   */
  static async setupListeners(): Promise<void> {
    const messaging = await getMessaging();
    if (!messaging) return;

    // Configure how notifications are displayed
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldSetBadge: true,
      }),
    });

    // Handle foreground messages - DISPLAY IN NOTIFICATION BAR
    messaging().onMessage(async remoteMessage => {
      console.log('📱 Foreground message received:', remoteMessage);

      if (remoteMessage.notification) {
        console.log('📢 Showing notification in system tray:', remoteMessage.notification);

        await Notifications.scheduleNotificationAsync({
          content: {
            title: remoteMessage.notification.title || 'Estate Link',
            body: remoteMessage.notification.body || 'You have a new notification',
            data: remoteMessage.data,
            sound: true,
          },
          trigger: null, // Show immediately
        });
      }
    });

    // Handle background/quit state messages
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('📱 Background message received:', remoteMessage);
    });

    // Handle notification open (when user taps notification)
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('📱 Notification opened app:', remoteMessage);
      this.handleNotificationNavigation(remoteMessage);
    });

    // Check if app was opened from a notification (quit state)
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('📱 App opened from notification (quit state):', remoteMessage);
          this.handleNotificationNavigation(remoteMessage);
        }
      });

    // Handle token refresh
    messaging().onTokenRefresh(token => {
      console.log('🔄 FCM token refreshed:', token.substring(0, 20) + '...');
    });
  }

  /**
   * Handle navigation based on notification data
   */
  static handleNotificationNavigation(remoteMessage: any): void {
    const data = remoteMessage.data;

    if (!data) return;

    const entityType = data.entityType || data.entity_type;
    const entityId = data.entityId || data.entity_id;

    console.log('📱 Navigating from notification:', { entityType, entityId });

    navigate('NotificationFeed' as any);
  }

  /**
   * Unregister device token
   */
  static async unregisterDeviceToken(authToken?: string): Promise<boolean> {
    try {
      const messaging = await getMessaging();
      if (!messaging) return false;

      const token = await messaging().getToken();
      const url = `${getBackendURL()}/api/notifications/unregister-device/`;

      const headers = getAuthHeaders(authToken);
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ push_token: token }),
      });

      if (!response.ok) {
        console.error('❌ Failed to unregister token');
        return false;
      }

      console.log('✅ FCM token unregistered');
      return true;
    } catch (error) {
      if (isFirebaseUnavailableError(error)) return false;
      console.error('❌ Error unregistering FCM token:', error);
      return false;
    }
  }
}
