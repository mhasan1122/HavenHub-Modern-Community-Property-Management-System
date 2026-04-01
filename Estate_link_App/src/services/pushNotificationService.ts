import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getBackendURL } from '../config/environment';
import { getAuthHeaders } from '../utils/authUtils';
import { navigate } from '../utils/navigationRef';
import { triggerNotificationCountRefresh } from '../../components/Header';

// Configure notification handler (Expo docs)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function handleRegistrationError(errorMessage: string): never {
  console.error('❌ Push notification registration:', errorMessage);
  throw new Error(errorMessage);
}

export class PushNotificationService {
  /**
   * Request notification permissions and register for push notifications.
   * Uses projectId from app config (extra.eas.projectId) for token attribution.
   */
  static async registerForPushNotifications(): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        handleRegistrationError('Must use physical device for push notifications');
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        handleRegistrationError('Permission not granted to get push token for push notification!');
      }

      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      if (!projectId || projectId === 'YOUR_EAS_PROJECT_ID') {
        handleRegistrationError(
          'Project ID not found. Set extra.eas.projectId in app.json or run `eas project:info` to get it.'
        );
      }

      console.log('📱 Using EAS project ID for push notifications:', projectId);
      const pushTokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
      const pushTokenString = pushTokenResult.data;

      console.log('✅ Push notification token obtained:', pushTokenString);
      return pushTokenString;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('❌ Error registering for push notifications:', message);
      return null;
    }
  }

  /**
   * Register device token with backend
   */
  static async registerDeviceToken(token: string, authToken?: string): Promise<boolean> {
    try {
      const url = `${getBackendURL()}/api/notifications/register-device/`;

      console.log('📤 Registering device token with backend...');
      console.log('  - URL:', url);
      console.log('  - Token:', token.substring(0, 20) + '...');
      console.log('  - Device Type:', Platform.OS);
      console.log('  - Device Model:', Device.modelName || 'Unknown');
      console.log('  - Auth Token:', authToken ? `${authToken.substring(0, 20)}...` : 'NOT PROVIDED');

      const requestBody = {
        push_token: token,
        device_type: Platform.OS,
        device_id: Device.modelName || 'Unknown',
      };
      console.log('  - Request Body:', JSON.stringify(requestBody, null, 2));

      console.log('🌐 Making fetch request...');

      // Get auth headers (already includes Content-Type)
      const headers = getAuthHeaders(authToken);

      // Ensure Content-Type is set (getAuthHeaders already sets it, but be explicit)
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      console.log('  - Request Headers:', JSON.stringify(headers, null, 2));
      console.log('  - Request Body Stringified:', JSON.stringify(requestBody));

      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody),
      });

      console.log('📥 Response received:');
      console.log('  - Status:', response.status);
      console.log('  - Status Text:', response.statusText);
      console.log('  - OK:', response.ok);

      if (!response.ok) {
        let errorData = {};
        let errorText = '';
        try {
          errorText = await response.text();
          console.error('  - Response Text:', errorText);
          errorData = JSON.parse(errorText);
        } catch (e) {
          console.error('  - Could not parse error response as JSON');
          errorData = { raw_response: errorText };
        }

        console.error('❌ Failed to register device token with backend');
        console.error('  - Status:', response.status);
        console.error('  - Status Text:', response.statusText);
        console.error('  - Error Data:', JSON.stringify(errorData, null, 2));
        console.error('  - Response Headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
        return false;
      }

      const responseData = await response.json();
      console.log('✅ Device token registered with backend successfully');
      console.log('  - Full Response:', JSON.stringify(responseData, null, 2));
      console.log('  - Created:', responseData.created ? 'NEW' : 'UPDATED');
      console.log('  - Device Token ID:', responseData.device_token_id);
      return true;
    } catch (error) {
      console.error('❌ NETWORK ERROR registering device token with backend');
      console.error('  - Error Type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('  - Error Message:', error instanceof Error ? error.message : String(error));
      console.error('  - Full Error:', error);
      return false;
    }
  }

  /**
   * Initialize push notifications (call this on app startup)
   */
  static async initialize(authToken?: string): Promise<void> {
    try {
      // Register for push notifications
      const token = await this.registerForPushNotifications();

      if (token && authToken) {
        // Register token with backend
        await this.registerDeviceToken(token, authToken);
      }

      // Set up notification listeners
      this.setupNotificationListeners();
    } catch (error) {
      console.error('❌ Error initializing push notifications:', error);
    }
  }

  /**
   * Set up notification listeners for foreground and background notifications
   */
  static setupNotificationListeners(): void {
    // Handle notifications received while app is in foreground
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('📱 Notification received in foreground:', notification);
      // Refresh Header badge so unread count updates immediately
      triggerNotificationCountRefresh();
      // You can handle the notification here (e.g., show in-app notification)
      // The notification will use the unified format from backend:
      // - Title: "Important Announcement" for Urgent/High, "New Announcement" for Medium/Low
      // - Body: [Announcement Title]\nPosted by: [Admin/Group Name]\n#[Label]
    });

    // Handle notification taps
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('📱 Notification tapped:', response);
      // Refresh Header badge after user interacts with notification
      triggerNotificationCountRefresh();
      const data = response.notification.request.content.data;

      // Support both camelCase (from backend) and snake_case (legacy) formats
      const entityType = data?.entityType || data?.entity_type;
      const entityId = data?.entityId || data?.entity_id || data?.announcementId || data?.bulletinId || data?.noticeId || data?.serviceFeeId || data?.billId || data?.paymentId;

      // Navigate based on notification data
      if (entityType === 'announcement' && (entityId || data?.announcementId)) {
        const announcementId = entityId || data.announcementId;
        console.log('Navigate to announcement:', announcementId);

        // Navigate to AnnouncementNotice tab with the announcement ID
        // The AnnouncementNotice screen will handle highlighting the specific announcement
        navigate('AnnouncementNotice', {
          activeTab: 'announcements',
          announcementId: announcementId,
        });
      } else if (entityType === 'bulletin' && (entityId || data?.bulletinId)) {
        const bulletinId = entityId || data.bulletinId;
        console.log('Navigate to bulletin:', bulletinId);

        // Check for archive status in metadata
        const metadata = data?.metadata as any;
        const status = metadata?.bulletin_status || metadata?.status;
        
        if (status === 'archive' || status === 'rejected') {
             console.log('Navigate to Archive list for rejected/archived bulletin');
             navigate('Archive', {
                 bulletinId: bulletinId
             });
        } else {
            // Navigate to AnnouncementNotice tab with the bulletin ID
            // The AnnouncementNotice screen will handle highlighting the specific bulletin
            navigate('AnnouncementNotice', {
              activeTab: 'bulletins',
              bulletinId: bulletinId,
            });
        }
      } else if (entityType === 'notice' && (entityId || data?.noticeId)) {
        const noticeId = entityId || data.noticeId;
        console.log('Navigate to notice:', noticeId);

        // Navigate to AnnouncementNotice tab with the notice ID
        // NoticeBoardCard is shown in the announcements tab, so navigate there
        navigate('AnnouncementNotice', {
          activeTab: 'announcements',
          noticeId: noticeId,
        });
      } else if (entityType === 'service_fee' || entityType === 'bill' || entityType === 'payment') {
        // Navigate to Service Fee screen for bill/payment notifications
        console.log('Navigate to service fee from notification tap:', { entityType, data });
        
        // Navigate to ServiceFeePayment screen
        // The screen will handle displaying the appropriate bill/payment
        navigate('ServiceFeePayment');
      }
    });
  }

  /**
   * Get the current push token (wrapper for registerForPushNotifications)
   */
  static async getPushToken(): Promise<string | null> {
    return this.registerForPushNotifications();
  }

  /**
   * Unregister device token (call this on logout)
   */
  static async unregisterDeviceToken(authToken?: string, pushToken?: string): Promise<boolean> {
    try {
      const url = `${getBackendURL()}/api/notifications/unregister-device/`;

      const body: any = {};
      if (pushToken) {
        body.push_token = pushToken;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(authToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        console.error('❌ Failed to unregister device token');
        return false;
      }

      console.log('✅ Device token unregistered successfully');
      return true;
    } catch (error) {
      console.error('❌ Error unregistering device token:', error);
      return false;
    }
  }

  /**
   * Handle notification navigation based on entity type and ID
   * Supports both camelCase (entityType, entityId) and snake_case (entity_type, entity_id) formats
   */
  static async handleNotificationNavigation(data: {
    entityType?: string;
    entity_type?: string;
    entityId?: number;
    entity_id?: number;
    announcementId?: number;
    bulletinId?: number;
    noticeId?: number;
    serviceFeeId?: number;
    billId?: number;
    paymentId?: number;
    metadata?: any;
  }): Promise<void> {
    try {
      // Support both camelCase and snake_case formats
      const entityType = data.entityType || data.entity_type;
      const entityId = data.entityId || data.entity_id;
      const { announcementId, bulletinId, noticeId, serviceFeeId, billId, paymentId } = data;

      if (entityType === 'announcement' && (announcementId || entityId)) {
        const id = announcementId || entityId;
        console.log('Navigate to announcement:', id);
        navigate('AnnouncementNotice', {
          activeTab: 'announcements',
          announcementId: id,
        });
      } else if (entityType === 'bulletin' && (bulletinId || entityId)) {
        const id = bulletinId || entityId;
        console.log('Navigate to bulletin:', id);
        
        // Check for archive status in metadata
        const metadata = data?.metadata as any;
        const status = metadata?.bulletin_status || metadata?.status;

        if (status === 'archive' || status === 'rejected') {
             console.log('Navigate to Archive list for rejected/archived bulletin');
             navigate('Archive', {
                 bulletinId: id
             });
        } else {
            navigate('AnnouncementNotice', {
              activeTab: 'bulletins',
              bulletinId: id,
            });
        }
      } else if (entityType === 'notice' && (noticeId || entityId)) {
        const id = noticeId || entityId;
        console.log('Navigate to notice:', id);
        // NoticeBoardCard is shown in the announcements tab, so navigate there
        navigate('AnnouncementNotice', {
          activeTab: 'announcements',
          noticeId: id,
        });
      } else if (entityType === 'service_fee' || entityType === 'bill' || entityType === 'payment') {
        // Navigate to Service Fee screen for bill/payment notifications
        console.log('Navigate to service fee:', { entityType, metadata: data.metadata });
        
        // Navigate to ServiceFeePayment screen
        // The screen will handle displaying the appropriate bill/payment
        navigate('ServiceFeePayment');
      } else {
        console.warn('Unknown entity type or missing ID for navigation:', data);
      }
    } catch (error) {
      console.error('❌ Error handling notification navigation:', error);
    }
  }

  /**
   * Set badge count for notifications
   */
  static async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
      console.log(`✅ Badge count set to ${count}`);
    } catch (error) {
      console.error('❌ Error setting badge count:', error);
    }
  }

  /**
   * Set login status (for internal tracking)
   */
  static setLoginStatus(isAuthenticated: boolean): void {
    // This can be used for internal state tracking if needed
    console.log(`🔐 Login status updated: ${isAuthenticated ? 'LOGGED IN' : 'LOGGED OUT'}`);
  }

  /**
   * Update badge count from backend
   */
  static async updateBadgeCount(authToken?: string): Promise<void> {
    try {
      const url = `${getBackendURL()}/api/notifications/unread-count/?client_type=mobile`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...getAuthHeaders(authToken),
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const count = data.count || 0;
        await this.setBadgeCount(count);
        console.log(`✅ Badge count updated from backend: ${count}`);
      } else {
        console.warn('⚠️ Failed to fetch unread count from backend');
      }
    } catch (error) {
      console.error('❌ Error updating badge count:', error);
    }
  }
}

// Export an instance for convenience (all methods are static)
export const pushNotificationService = PushNotificationService;

