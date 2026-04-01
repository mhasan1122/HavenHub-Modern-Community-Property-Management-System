import React, { useState, useEffect, useCallback, useLayoutEffect, useMemo } from 'react';
import { View, Text, Pressable, VirtualizedList, ScrollView, RefreshControl, ActivityIndicator, BackHandler, Platform } from 'react-native';
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAppSelector, useAppDispatch } from 'store/hooks';

import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { NoticeBoardCard } from '../../components/NoticeBoardCard';
import { QuickActionButton } from '../../components/QuickActionButton';
import { useNotices } from '../../hooks/useNotices';
import { useAnnouncements } from '../../hooks/useAnnouncements';

import { useResponsive } from '../../utils/globalResponsiveConfig';
import { getBackendURL } from '../../config/environment';
import { enhancedFetch } from '../../utils/networkUtils';
import { updateUserData } from '../../store/slices/authSlice';
// UPCOMING - Commented out
// import { UpcomingFeatureModal } from '../../components/UpcomingFeatureModal';

type RootStackParamList = {
  Login: undefined;
  Dashboard: { noticeId?: number } | undefined;
  Home: undefined;
  AnnouncementNotice: { activeTab?: string; announcementId?: number } | undefined;
  NoticeBoard: undefined;
  CreateBulletin: undefined;
  Info: undefined;
  Services: undefined;
  AllServices: undefined;
  ServiceFeePayment: undefined;
  Feed: undefined;
  Activity: undefined;
  ProfileManagement: undefined;
  TermsAndPrivacy: undefined;
};

type DashboardScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Dashboard'>;

// Section types for VirtualizedList
type SectionType =
  | 'dashboardGrid'
  | 'noticeError'
  | 'announcementError'
  | 'noticeBoard'
  | 'pinnedAnnouncements';

interface DashboardSection {
  id: string;
  type: SectionType;
}

export function Dashboard() {
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'Dashboard'>>();
  const dispatch = useAppDispatch();
  const { user, accessToken } = useAppSelector((state) => state.auth);
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCheckingTerms, setIsCheckingTerms] = useState(false);
  const [highlightedNoticeId, setHighlightedNoticeId] = useState<number | undefined>(undefined);
  // UPCOMING - Commented out
  // const [upcomingModalVisible, setUpcomingModalVisible] = useState(false);

  // Function to check terms acceptance status from backend
  const checkTermsAcceptance = useCallback(async () => {
    if (!accessToken || !user?.id) {
      console.log('⚠️ No access token or user ID, skipping terms check');
      return;
    }

    try {
      setIsCheckingTerms(true);
      const baseUrl = getBackendURL();
      const response = await enhancedFetch(
        `${baseUrl}/user/check_terms_status/`,
        {
          method: 'GET',
        },
        10000,
        accessToken
      );

      if (response.ok) {
        const data = await response.json();
        console.log('📋 Terms status from backend:', data);

        // Update Redux state with latest terms_accepted status
        if (data.terms_accepted !== undefined) {
          dispatch(updateUserData({ termsAccepted: data.terms_accepted }));

          // If terms not accepted, navigate to Terms screen
          if (!data.terms_accepted) {
            console.log('⚠️ Terms not accepted, redirecting to TermsAndPrivacy');
            navigation.navigate('TermsAndPrivacy');
          }
        }
      } else {
        console.error('❌ Failed to check terms status:', response.status);
      }
    } catch (error) {
      console.error('❌ Error checking terms acceptance:', error);
    } finally {
      setIsCheckingTerms(false);
    }
  }, [accessToken, user?.id, dispatch, navigation]);

  // Check terms acceptance on dashboard focus
  useFocusEffect(
    useCallback(() => {
      console.log('🔍 Dashboard focused - checking terms acceptance status');
      checkTermsAcceptance();
    }, [checkTermsAcceptance])
  );

  // Get noticeboard data for refresh functionality
  const { getNotices, hasLoadedOnce, notices, loading: noticesLoading, error: noticesError } = useNotices();

  // Get announcements data for pinned announcements
  const {
    getAnnouncements,
    getPinnedAnnouncements,
    announcements,
    loading: announcementsLoading,
    error: announcementsError,
    hasLoadedOnce: announcementsLoadedOnce
  } = useAnnouncements();

  // Handle noticeId from route params (when navigating from push notification)
  useEffect(() => {
    const params = route.params as { noticeId?: number } | undefined;
    if (params?.noticeId) {
      console.log('📌 Setting highlighted notice from route params:', params.noticeId);
      setHighlightedNoticeId(params.noticeId);

      // Force refresh notices to ensure we have the latest data when navigating from push notification
      // Use setTimeout to ensure this happens after component is fully mounted
      if (user?.id && accessToken) {
        console.log('🔄 Forcing refresh of notices to get latest data from push notification');
        setTimeout(() => {
          console.log('🔄 Executing delayed refresh for notices from push notification');
          getNotices();
          getAnnouncements(); // Also refresh announcements
        }, 100);
      }

      // Clear the highlight after 5 seconds
      const timer = setTimeout(() => {
        setHighlightedNoticeId(undefined);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [route.params, user?.id, accessToken, getNotices, getAnnouncements]);

  // Disable iOS swipe-back gesture to prevent going back to login screen
  // Access parent Stack Navigator to set options (Dashboard is inside Tab Navigator)
  useLayoutEffect(() => {
    if (Platform.OS === 'ios') {
      const parent = navigation.getParent();
      if (parent) {
        parent.setOptions({
          gestureEnabled: false,
        } as any);
      } else {
        // Fallback: try setting on current navigator
        navigation.setOptions({
          gestureEnabled: false,
        } as any);
      }
    }
  }, [navigation]);

  // Get responsive configuration - auto-detects screen size
  const responsive = useResponsive();

  // Extract commonly used values for easier access
  const screenWidth = responsive.screenWidth;
  const screenHeight = responsive.screenHeight;
  const containerPadding = responsive.padding.container;
  const gridGap = responsive.grid.gap;
  const itemWidth = responsive.grid.itemWidth;
  const iconSize = responsive.iconSize.lg;
  const fontSize = responsive.fontSize.sm;
  const itemMarginBottom = responsive.spacing.xl;

  // Debug: Log layout dimensions
  useEffect(() => {
    console.log('📱 Dashboard Responsive Config:', {
      screen: `${screenWidth} × ${screenHeight}`,
      deviceType: responsive.deviceType,
      columns: responsive.grid.columns,
      itemWidth: itemWidth.toFixed(1),
      iconSize,
      fontSize,
      containerPadding,
      gridGap,
    });
  }, [screenWidth, screenHeight]);

  // Handle Android hardware back button - block navigation back to password/login screens
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        console.log('🔙 Back button pressed on Dashboard');
        const state = navigation.getState();
        const routes = state?.routes || [];
        const currentIndex = state?.index ?? 0;
        const currentRoute = routes[currentIndex]?.name;

        console.log('📍 Navigation state:', {
          totalRoutes: routes.length,
          currentIndex,
          currentRoute: currentRoute,
          previousRoute: currentIndex > 0 ? routes[currentIndex - 1]?.name : 'none',
          allRoutes: routes.map(r => r.name)
        });

        // List of authentication/password-related screens that should not be navigable back to
        const passwordRelatedScreens = ['Login', 'SetPassword', 'VerifyCode', 'ForgotPassword', 'PasswordReset', 'WelcomeBack', 'InitialScreen'];

        // Check if there's any password-related screen in the navigation history
        for (let i = 0; i < routes.length; i++) {
          const routeName = routes[i]?.name;
          if (routeName && passwordRelatedScreens.includes(routeName as string)) {
            console.log('🚫 Back button blocked - Found auth screen in history:', routeName);
            console.log('🚪 Exiting app instead of navigating back to auth screen');
            BackHandler.exitApp(); // Exit the app instead of going back to auth screens
            return true;
          }
        }

        // If we're on Dashboard/Home and it's the first screen (index 0), exit the app
        // This prevents going back after successful login when auth screens are cleared from stack
        if (currentIndex === 0) {
          console.log('🚫 Back button pressed on root screen (index 0):', currentRoute);
          console.log('🚪 Exiting app');
          BackHandler.exitApp(); // Exit the app
          return true;
        }

        // If we're on Dashboard and it's the only screen, exit the app
        if (routes.length <= 1) {
          console.log('🚫 Back button pressed - Dashboard is the only screen');
          console.log('🚪 Exiting app');
          BackHandler.exitApp(); // Exit the app
          return true;
        }

        // Allow normal back navigation for other screens
        console.log('✅ Back button allowed - navigating back');
        return false;
      };

      console.log('🔧 Setting up back button handler for Dashboard');
      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        console.log('🔧 Removing back button handler for Dashboard');
        backHandler.remove();
      };
    }, [navigation])
  );

  // Check if we're navigating from push notification
  const isFromPushNotification = useMemo(() => {
    const params = route.params as { noticeId?: number } | undefined;
    return !!params?.noticeId;
  }, [route.params]);

  // Use useFocusEffect to fetch data only on initial load
  // Data persists in Redux store, so no need to reload on every tab change
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 Dashboard screen focused', 'isFromPushNotification:', isFromPushNotification);

      if (user?.id) {
        // If coming from push notification, always refresh to get latest data
        if (isFromPushNotification) {
          console.log('📱 Coming from push notification - forcing refresh of all data');
          getNotices();
          getAnnouncements();
          setIsInitialized(true);
          return;
        }

        // Only fetch if data hasn't been loaded yet (initial load)
        // This prevents unnecessary reloads when switching tabs or returning from other screens
        if (!hasLoadedOnce && notices.length === 0) {
          console.log('🔄 Initial load - Fetching notices...');
          getNotices();
        } else {
          console.log('✅ Notices already loaded, using cached data');
        }

        if (!announcementsLoadedOnce && announcements.length === 0) {
          console.log('🔄 Initial load - Fetching announcements...');
          getAnnouncements();
        } else {
          console.log('✅ Announcements already loaded, using cached data');
        }

        setIsInitialized(true);
      }
    }, [user?.id, hasLoadedOnce, announcementsLoadedOnce, notices.length, announcements.length, getNotices, getAnnouncements, isFromPushNotification])
  );

  // Debug: Log when announcements change
  useEffect(() => {
    console.log('📊 Dashboard - Announcements state changed:', {
      announcementsCount: announcements?.length || 0,
      hasLoadedOnce: announcementsLoadedOnce,
      loading: announcementsLoading,
      error: announcementsError,
      pinnedCount: getPinnedAnnouncements().length,
      announcements: announcements?.slice(0, 2).map(a => ({
        id: a.id,
        title: a.title,
        is_pinned: a.is_pinned,
        status: a.status,
        relative_time: a.relative_time,
        start_time: a.start_time,
        start_date: a.start_date
      }))
    });
  }, [announcements, announcementsLoadedOnce, announcementsLoading, announcementsError, getPinnedAnnouncements]);

  // Debug: Log when notices change
  useEffect(() => {
    console.log('📊 Dashboard - Notices state changed:', {
      noticesCount: notices?.length || 0,
      hasLoadedOnce,
      loading: noticesLoading,
      error: noticesError,
      notices: notices?.slice(0, 2) // Log first 2 notices for debugging
    });
  }, [notices, hasLoadedOnce, noticesLoading, noticesError]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      console.log('🔄 Dashboard refresh triggered');

      // Check terms acceptance status first
      console.log('🔄 Checking terms acceptance status...');
      await checkTermsAcceptance();

      // Refresh noticeboard data
      console.log('🔄 Refreshing noticeboard data...');
      getNotices();

      // Refresh announcements data
      console.log('🔄 Refreshing announcements data...');
      getAnnouncements();


      console.log('✅ Dashboard data refreshed successfully');

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('❌ Error during dashboard refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };



  const dashboardItems = [
    {
      id: 1,
      title: 'Announcement',
      iconName: 'bullhorn' as keyof typeof MaterialCommunityIcons.glyphMap,
    },
    // UPCOMING - Commented out
    // {
    //   id: 2,
    //   title: 'Complaints',
    //   iconName: 'message-alert' as keyof typeof MaterialCommunityIcons.glyphMap,
    // },
    {
      id: 3,
      title: 'Bulletin Board',
      iconName: 'clipboard-text' as keyof typeof MaterialCommunityIcons.glyphMap,
    },
    {
      id: 4,
      title: 'Service Fee',
      iconName: 'cash' as keyof typeof MaterialCommunityIcons.glyphMap,
    },
    // UPCOMING - Commented out
    // {
    //   id: 5,
    //   title: 'Suggestions',
    //   iconName: 'lightbulb-on' as keyof typeof MaterialCommunityIcons.glyphMap,
    // },
    // {
    //   id: 5,
    //   title: 'Amenities',
    //   iconName: 'home-group' as keyof typeof MaterialCommunityIcons.glyphMap,
    // },
    // {
    //   id: 6,
    //   title: 'Event Calendar',
    //   iconName: 'calendar-month' as keyof typeof MaterialCommunityIcons.glyphMap,
    // },
    // {
    //   id: 7,
    //   title: 'Surveys',
    //   iconName: 'clipboard-check' as keyof typeof MaterialCommunityIcons.glyphMap,
    // },
    {
      id: 9,
      title: 'Noticeboard',
      iconName: 'newspaper-variant' as keyof typeof MaterialCommunityIcons.glyphMap,
    },
  ];

  // Get priority configuration for styling
  const getPriorityConfig = useCallback((priority: string) => {
    switch (priority) {
      case 'urgent':
        return { bg: 'bg-red-100', text: 'text-red-600', label: 'Urgent' };
      case 'high':
        return { bg: 'bg-orange-100', text: 'text-orange-600', label: 'High' };
      case 'normal':
        return { bg: 'bg-blue-100', text: 'text-blue-600', label: 'Normal' };
      case 'low':
        return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Low' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Normal' };
    }
  }, []);

  // Format time from 24-hour to 12-hour with AM/PM
  const formatTime = useCallback((time24: string) => {
    if (!time24) return 'Time not specified';

    try {
      // Parse the time (format: HH:MM:SS or HH:MM)
      const [hours, minutes] = time24.split(':').map(Number);

      // Convert to 12-hour format
      const period = hours >= 12 ? 'PM' : 'AM';
      const hours12 = hours % 12 || 12; // Convert 0 to 12 for midnight
      const minutesStr = minutes.toString().padStart(2, '0');

      return `${hours12}:${minutesStr} ${period}`;
    } catch (error) {
      console.error('Error formatting time:', error);
      return time24;
    }
  }, []);

  const formatDay = useCallback((dateStr: string) => {
    if (!dateStr) return '';
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    } catch (error) {
      return dateStr;
    }
  }, []);

  const formatTimeShort = useCallback((time24: string) => {
    if (!time24) return '';
    try {
      const [hours, minutes] = time24.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const hours12 = hours % 12 || 12;
      if (minutes === 0) return `${hours12} ${period}`;
      return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch (error) {
      return time24;
    }
  }, []);

  // Memoize pinned announcements to prevent unnecessary recalculations
  // This ensures stable rendering and prevents reload flickering
  // Only recalculates when announcements array actually changes
  const pinnedAnnouncements = useMemo(() => {
    return getPinnedAnnouncements();
  }, [announcements, getPinnedAnnouncements]);

  // Build sections data for VirtualizedList
  const sections: DashboardSection[] = [
    { id: 'dashboardGrid', type: 'dashboardGrid' },
    ...(noticesError ? [{ id: 'noticeError', type: 'noticeError' as SectionType }] : []),
    ...(announcementsError ? [{ id: 'announcementError', type: 'announcementError' as SectionType }] : []),
    { id: 'noticeBoard', type: 'noticeBoard' },
    // Always show pinned announcements section
    { id: 'pinnedAnnouncements', type: 'pinnedAnnouncements' },
  ];

  // VirtualizedList helper functions
  const getItem = (_data: DashboardSection[], index: number) => sections[index];
  const getItemCount = () => sections.length;
  const keyExtractor = (item: DashboardSection) => item.id;

  // Render item based on section type
  const renderItem = ({ item }: { item: DashboardSection }) => {
    switch (item.type) {
      case 'dashboardGrid':
        return renderDashboardGrid();
      case 'noticeError':
        return renderNoticeError();
      case 'announcementError':
        return renderAnnouncementError();
      case 'noticeBoard':
        return renderNoticeBoard();
      case 'pinnedAnnouncements':
        return renderPinnedAnnouncements();
      default:
        return null;
    }
  };

  // Render functions for each section
  const renderDashboardGrid = () => {
    const columns = responsive.grid.columns;
    const totalGaps = gridGap * (columns - 1);
    const availableWidth = screenWidth - (containerPadding * 2);
    // Use Math.floor to ensure pixel-perfect alignment and prevent sub-pixel issues
    const calculatedItemWidth = Math.floor((availableWidth - totalGaps) / columns);

    return (
      <View className="bg-white py-6" style={{ paddingHorizontal: containerPadding }}>
        <View className="w-full">
          <View className="w-full flex-row flex-wrap">
            {dashboardItems.map((item, index) => {
              const isLastInRow = (index + 1) % columns === 0;
              const isLastRow = index >= dashboardItems.length - (dashboardItems.length % columns || columns);

              return (
                <View
                  key={item.id}
                  className={isLastInRow ? '' : ''}
                  style={{
                    width: calculatedItemWidth,
                    marginRight: isLastInRow ? 0 : gridGap,
                    marginBottom: isLastRow ? 0 : 20,
                  }}>
                  <QuickActionButton
                    title={item.title}
                    iconName={item.iconName}
                    containerWidth={calculatedItemWidth}
                    onPress={() => {
                      if (item.title === 'Announcement') {
                        navigation.navigate('AnnouncementNotice', { activeTab: 'announcements' });
                      } else if (item.title === 'Bulletin Board') {
                        navigation.navigate('AnnouncementNotice', { activeTab: 'bulletin' });
                      } else if (item.title === 'Service Fee') {
                        navigation.navigate('ServiceFeePayment');
                      } else if (item.title === 'Noticeboard') {
                        navigation.navigate('AnnouncementNotice', { activeTab: 'announcements' });
                      }
                      // UPCOMING - Commented out (upcoming features removed from grid)
                      // else {
                      //   setUpcomingModalVisible(true);
                      // }
                    }}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const renderNoticeError = () => {
    const isPermissionError = noticesError?.includes('permission') || noticesError?.includes('403');
    return (
      <View className="bg-red-50 border-[1px] border-red-200 rounded-xl mb-4 p-4 shadow-sm" style={{ marginHorizontal: containerPadding }}>
        <View className="flex-row items-center mb-2">
          <Ionicons name="alert-circle" size={20} color="#dc2626" />
          <Text className="ml-2 font-lato-bold text-red-700 text-base">
            {isPermissionError ? 'Permission Error' : 'Notice Loading Error'}
          </Text>
        </View>
        <Text className="font-lato text-red-600 text-sm mb-3">
          {noticesError}
        </Text>
        {!isPermissionError && (
          <Pressable
            className="bg-red-600 px-4 py-2 rounded-lg self-start"
            onPress={() => getNotices()}
            android_ripple={{ color: '#dc2626', borderless: false }}>
            <Text className="font-lato-bold text-white">Retry</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const renderAnnouncementError = () => {
    const isPermissionError = announcementsError?.includes('permission') || announcementsError?.includes('403');
    return (
      <View className="bg-red-50 border-[1px] border-red-200 rounded-xl mb-4 p-4 shadow-sm" style={{ marginHorizontal: containerPadding }}>
        <View className="flex-row items-center mb-2">
          <Ionicons name="alert-circle" size={20} color="#dc2626" />
          <Text className="ml-2 font-lato-bold text-red-700 text-base">
            {isPermissionError ? 'Permission Error' : 'Announcements Loading Error'}
          </Text>
        </View>
        <Text className="font-lato text-red-600 text-sm mb-3">
          {announcementsError}
        </Text>
        {!isPermissionError && (
          <Pressable
            className="bg-red-600 px-4 py-2 rounded-lg self-start"
            onPress={() => getAnnouncements()}
            android_ripple={{ color: '#dc2626', borderless: false }}>
            <Text className="font-lato-bold text-white">Retry</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const renderNoticeBoard = () => (
    <View style={{ paddingHorizontal: containerPadding }}>
      <NoticeBoardCard
        showTitle={true}
        maxItems={5}
        cardHeight={160}
        cardWidth={128}
        highlightedNoticeId={highlightedNoticeId}
      />
    </View>
  );

  const renderPinnedAnnouncements = () => {
    // Determine if we should show loading: only when actively loading AND no data exists
    const shouldShowLoading = announcementsLoading && announcements.length === 0 && !announcementsLoadedOnce;

    return (
      <View className="bg-white py-5" style={{ paddingHorizontal: containerPadding }}>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="font-lato-bold text-2xl text-black">
            Pinned Announcements
          </Text>
          <Pressable
            className="flex-row items-center"
            onPress={() => navigation.navigate('AnnouncementNotice')}
            android_ripple={{ color: '#3C9D9B1A', borderless: true }}>
            <Text className="mr-1 font-lato text-lg text-black">See More</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#3C9D9B" />
          </Pressable>
        </View>

        {/* Show loading only on very first load when no data exists */}
        {shouldShowLoading ? (
          <View className="bg-gray-50 p-6 rounded-xl items-center border-[1px] border-gray-200">
            <ActivityIndicator size="small" color="#3C9D9B" />
            <Text className="mt-2 font-lato text-black text-center">
              Loading announcements...
            </Text>
          </View>
        ) : pinnedAnnouncements.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: containerPadding }}>
            {pinnedAnnouncements.map((announcement) => (
              <Pressable
                key={announcement.id}
                onPress={() => {
                  console.log('📌 Navigating to specific announcement:', announcement.id);
                  navigation.navigate('AnnouncementNotice', {
                    activeTab: 'announcements',
                    announcementId: announcement.id
                  });
                }}
                android_ripple={{ color: '#3C9D9B1A', borderless: false }}
                className="mr-3 w-80 rounded-xl border-[1px] border-gray-200 bg-primaryLight p-4 shadow-sm">
                <View className="mb-2 flex-row items-start justify-between">
                  <Text className="flex-1 font-lato-bold text-xl text-black" numberOfLines={2}>
                    {announcement.title}
                  </Text>
                  {announcement.priority && (() => {
                    const priorityConfig = getPriorityConfig(announcement.priority);
                    return (
                      <View className={`rounded-lg ${priorityConfig.bg} px-2 py-1 ml-2`}>
                        <Text className={`font-lato-bold text-xs ${priorityConfig.text}`}>
                          {priorityConfig.label}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
                <Text className="mb-2 font-lato text-base text-black" numberOfLines={2}>
                  {announcement.description || 'No description available'}
                </Text>
                <Text className="mb-1 font-lato text-lg text-gray-600">
                  {announcement.start_date === announcement.end_date
                    ? `${formatDay(announcement.start_date)}, ${formatTimeShort(announcement.start_time)} - ${formatTimeShort(announcement.end_time)}`
                    : `${formatDay(announcement.start_date)} ${formatTimeShort(announcement.start_time)} – ${formatDay(announcement.end_date)} ${formatTimeShort(announcement.end_time)}`
                  }
                </Text>
                <View className="flex-row items-center">
                  <MaterialCommunityIcons name="clock-time-three-outline" size={18} color="#666" />
                  <Text className="ml-1 font-lato text-base text-gray-600">
                    {announcement.relative_time || 'Upcoming'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View className="bg-gray-50 p-6 rounded-xl items-center border-[1px] border-gray-200">
            <MaterialCommunityIcons name="bullhorn-outline" size={32} color="#000000" />
            <Text className="mt-2 font-lato text-black text-center">
              No pinned announcements available
            </Text>
          </View>
        )}
      </View>
    );
  };


  // Always render the main structure to prevent layout shifts
  return (
    <View className="flex-1 bg-white">
      {/* Main Content - VirtualizedList for better performance */}
      <VirtualizedList
        data={sections}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemCount={getItemCount}
        getItem={getItem}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3C9D9B']}
            tintColor="#3C9D9B"
          />
        }
      />

      {/* UPCOMING - Commented out */}
      {/* <UpcomingFeatureModal
        visible={upcomingModalVisible}
        onClose={() => setUpcomingModalVisible(false)}
      /> */}
    </View>
  );
}

