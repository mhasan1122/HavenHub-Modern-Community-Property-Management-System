import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useIsFocused } from '@react-navigation/native';
import { useAppSelector, useAppDispatch } from '../src/store/hooks';
import { fetchProfile } from '../src/store/slices/profileSlice';
import { getPhotoURL, getInitialLetter } from '../src/utils/photoUtils';
import { useCompanyLogo } from '../src/hooks/useCompanyLogo';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

type RootStackParamList = {
  ProfileManagement: undefined;
  [key: string]: any;
};

type HeaderNavigationProp = StackNavigationProp<RootStackParamList>;

interface HeaderProps {
  /**
   * Whether to enable navigation to ProfileManagement on profile image/avatar tap
   * @default true
   */
  enableProfileNavigation?: boolean;
  /**
   * Whether to use advanced photo handling with cache busting and retry logic
   * @default true
   */
  useAdvancedPhotoHandling?: boolean;
  /**
   * Border color for the profile image
   * @default '#3C9D9B'
   */
  profileImageBorderColor?: string;
  /**
   * Fallback text to show when user data is loading
   * @default 'Loading...'
   */
  loadingText?: string;
}

export const Header = React.memo(function Header({
  enableProfileNavigation = true,
  useAdvancedPhotoHandling = true,
  profileImageBorderColor = '#3C9D9B',
  loadingText = 'Loading...'
}: HeaderProps) {
  const navigation = useNavigation<HeaderNavigationProp>();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { logoUrl, hasLogo } = useCompanyLogo();
  const profileHasLoaded = useAppSelector((state) => state.profile?.hasLoadedOnce);

  // Prefetch profile when Header mounts so Profile screen shows instantly on photo tap
  useEffect(() => {
    if (user?.id && !profileHasLoaded && enableProfileNavigation) {
      dispatch(fetchProfile());
    }
  }, [user?.id, profileHasLoaded, enableProfileNavigation, dispatch]);

  // Logo error handling state
  const [logoLoadError, setLogoLoadError] = useState(false);

  // Process logo URL to ensure it's a full URL (handle relative paths)
  const processedLogoUrl = React.useMemo(() => {
    if (!hasLogo || !logoUrl) return null;

    // If already a full URL, use it directly
    if (/^https?:\/\//i.test(logoUrl)) {
      return logoUrl;
    }

    // Otherwise, process through getPhotoURL to ensure it's a full URL
    return getPhotoURL(logoUrl, logoUrl);
  }, [hasLogo, logoUrl]);

  // Stable logo source - use company logo if available, fallback to local
  const logoSource = React.useMemo(() => {
    if (processedLogoUrl && !logoLoadError) {
      return { uri: processedLogoUrl };
    }
    return require('../assets/Logo.png');
  }, [processedLogoUrl, logoLoadError]);

  // Reset logo error when logo URL changes
  useEffect(() => {
    if (processedLogoUrl) {
      setLogoLoadError(false);
    }
  }, [processedLogoUrl]);

  // Handle logo load error
  const handleLogoError = () => {
    setLogoLoadError(true);
  };

  // Advanced photo handling states
  const [imageLoadError, setImageLoadError] = useState(false);
  const [photoKey, setPhotoKey] = useState(0);
  const lastPhotoPath = useRef<string | undefined>(undefined);
  const lastUserId = useRef<string | undefined>(undefined);

  // Advanced photo update logic - ONLY update when photo path or user ID actually changes
  useEffect(() => {
    if (useAdvancedPhotoHandling && user?.id) {
      const currentPhotoPath = user.photo;
      const currentUserId = user.id;

      const photoPathChanged = lastPhotoPath.current !== currentPhotoPath;
      const userIdChanged = lastUserId.current !== currentUserId;

      // Only update if photo path changed or user ID changed (not on every user object update)
      if (photoPathChanged || userIdChanged) {
        lastPhotoPath.current = currentPhotoPath;
        lastUserId.current = currentUserId;

        // Only increment photoKey when actually needed (stable cache busting)
        setPhotoKey(prev => prev + 1);
        setImageLoadError(false);
      }
    }
  }, [user?.id, user?.photo, useAdvancedPhotoHandling]);

  // Note: Photo refresh is handled automatically by the useEffect watching user?.photo
  // No need for manual focus-based refresh as it causes unnecessary reloads

  // Reset image error when user changes (for simple photo handling)
  useEffect(() => {
    if (!useAdvancedPhotoHandling) {
      setImageLoadError(false);
    }
  }, [user?.id, useAdvancedPhotoHandling]);

  // Generate photo URL with stable cache busting (for advanced handling)
  const getPhotoURLWithCacheBusting = (photoPath?: string): string | null => {
    if (!photoPath) return null;

    const baseURL = getPhotoURL(photoPath);
    if (!baseURL) return null;

    // Add stable cache busting parameter - only changes when photoKey changes
    // This prevents unnecessary reloads while still allowing cache refresh when needed
    const separator = baseURL.includes('?') ? '&' : '?';
    return `${baseURL}${separator}v=${photoKey}`;
  };

  // Function to handle photo loading failure (for advanced handling)
  const handlePhotoError = () => {
    // Silently fall back to initials avatar
    setImageLoadError(true);
  };

  // Function to handle successful photo load (for advanced handling)
  const handlePhotoLoad = () => {
    setImageLoadError(false);
  };

  // Simple photo error handler (for simple handling)
  const handleSimplePhotoError = () => {
    setImageLoadError(true);
  };

  // Handle profile navigation
  const handleProfilePress = () => {
    if (enableProfileNavigation) {
      navigation.navigate('ProfileManagement');
    }
  };

  // Determine which photo URL to use
  const photoSource = useAdvancedPhotoHandling && user?.photo && !imageLoadError
    ? { uri: getPhotoURLWithCacheBusting(user.photo)! }
    : !useAdvancedPhotoHandling && user?.photo && getPhotoURL(user.photo) && !imageLoadError
      ? { uri: getPhotoURL(user.photo)! }
      : null;

  // Removed debug logging for smoother user experience

  // Profile image/avatar component with stable dimensions
  const ProfileComponent = React.useMemo(() => {
    const content = photoSource ? (
      <Image
        key={useAdvancedPhotoHandling ? `user-photo-${photoKey}-${user?.photo}` : undefined}
        source={photoSource}
        resizeMode="cover"
        onError={useAdvancedPhotoHandling ? handlePhotoError : handleSimplePhotoError}
        onLoad={useAdvancedPhotoHandling ? handlePhotoLoad : undefined}
        className="w-10 h-10 rounded-full border-2"
        style={{
          borderColor: profileImageBorderColor,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4
        }}
      />
    ) : (
      <View className="w-10 h-10 rounded-full border-2 items-center justify-center bg-[#3C9D9B]"
        style={{
          borderColor: '#6B7280',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2
        }}
      >
        <Text className="font-oxanium-bold text-white text-xl">
          {getInitialLetter(user?.full_name) || 'U'}
        </Text>
      </View>
    );

    return enableProfileNavigation ? (
      <TouchableOpacity
        onPress={handleProfilePress}
        className="w-10 h-10"
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    ) : (
      <View className="w-10 h-10">
        {content}
      </View>
    );
  }, [photoSource, user?.full_name, enableProfileNavigation, photoKey, profileImageBorderColor]);

  return (
    <View className="flex-row items-center justify-between border-b border-gray-100 bg-white px-4 h-20 min-h-20 max-h-20">
      <View className="flex-row items-center">
        <Image
          source={logoSource}
          className="w-[100px] h-10"
          resizeMode="contain"
          defaultSource={require('../assets/Logo.png')}
          onError={handleLogoError}
        />
      </View>
      <View className="flex-row items-center flex-1 justify-end">
        <View className="mr-3 flex-1 min-h-[60px]">
          <Text
            className="text-right font-oxanium-bold text-lg text-black min-h-[22px]"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {user?.full_name || loadingText}
          </Text>
          <Text
            className="text-right font-oxanium text-base text-black min-h-[19px]"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Tower: {user?.tower || loadingText}
          </Text>
          <Text
            className="text-right font-oxanium text-base text-black min-h-[19px]"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Unit: {user?.unit || loadingText}
          </Text>
        </View>
        {ProfileComponent}
        {/* Notification Bell */}
        <NotificationBell />
      </View>
    </View>
  );
});

// Event emitter for notification count refresh
const notificationCountRefreshListeners = new Set<() => void>();

export const triggerNotificationCountRefresh = () => {
  console.log('🔔 Triggering notification count refresh in Header');
  notificationCountRefreshListeners.forEach(listener => listener());
};

// Notification Bell Component
const NotificationBell: React.FC = () => {
  const navigation = useNavigation<HeaderNavigationProp>();
  const [unreadCount, setUnreadCount] = useState(0);
  const isFocused = useIsFocused();

  const fetchUnreadCount = React.useCallback(async () => {
    try {
      const { notificationAPI } = await import('../src/services/notificationApi');
      const count = await notificationAPI.getUnreadCount();
      setUnreadCount(count);
      console.log('🔔 Header unread count updated:', count);
    } catch (error) {
      console.error('❌ Error fetching unread count in Header:', error);
    }
  }, []);

  // Prefetch notifications when bell is visible so feed loads instantly on tap
  const prefetchNotifications = React.useCallback(async () => {
    try {
      const { notificationAPI } = await import('../src/services/notificationApi');
      const { notificationCache } = await import('../src/services/notificationCache');
      const response = await notificationAPI.fetchNotifications({ page: 1, page_size: 20 });
      const unread = response.totalUnread ?? 0;
      if (response.results.length > 0) {
        await notificationCache.set(response.results, unread);
      }
    } catch {
      // Silent fail - cache will be populated when user opens feed
    }
  }, []);

  useEffect(() => {
    // Fetch count on mount
    fetchUnreadCount();
    // Prefetch notifications in background for instant feed load when user taps bell
    const prefetchTimer = setTimeout(prefetchNotifications, 500);

    // Refresh count every 5 seconds for more real-time updates
    const interval = setInterval(fetchUnreadCount, 5000);
    
    // Listen for manual refresh triggers (e.g., from push notification service)
    const refreshHandler = () => {
      console.log('🔔 Manual refresh triggered, fetching notification count');
      // Small delay to ensure backend has processed the read status
      setTimeout(() => {
        fetchUnreadCount();
      }, 300);
    };
    notificationCountRefreshListeners.add(refreshHandler);
    
    // Listen for navigation state changes to refresh count when returning from notification screen
    const unsubscribeBlur = navigation.addListener('blur', () => {
      // When navigating away, we'll refresh on return
    });
    
    const unsubscribeFocus = navigation.addListener('focus', () => {
      // Refresh count when navigating back (user might have read notifications)
      console.log('🔔 Navigation focus event, refreshing notification count');
      setTimeout(() => {
        fetchUnreadCount();
        prefetchNotifications(); // Warm cache for instant feed load
      }, 300);
    });
    
    return () => {
      clearTimeout(prefetchTimer);
      clearInterval(interval);
      notificationCountRefreshListeners.delete(refreshHandler);
      unsubscribeBlur();
      unsubscribeFocus();
    };
  }, [fetchUnreadCount, prefetchNotifications, navigation]);

  // Refresh count when screen comes into focus (user might have read notifications)
  useEffect(() => {
    if (isFocused) {
      console.log('🔔 Header screen focused, refreshing notification count');
      // Small delay to ensure backend has processed the read status
      const timer = setTimeout(() => {
        fetchUnreadCount();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isFocused, fetchUnreadCount]);

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('NotificationFeed' as any)}
      className="ml-3 relative"
      activeOpacity={0.7}
    >
      <MaterialIcons name="notification-add" size={26} color="black" />
      {unreadCount > 0 && (
        <View className="absolute -top-1 -right-1 bg-[#FF3B30] rounded-[10px] min-w-5 h-5 items-center justify-center px-1">
          <Text className="text-white text-[11px] font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Set display name for better debugging
Header.displayName = 'Header';

// Default export for flexibility
export default Header;
