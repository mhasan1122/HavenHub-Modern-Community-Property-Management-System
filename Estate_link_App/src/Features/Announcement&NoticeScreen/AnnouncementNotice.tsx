import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, RefreshControl, Alert, Dimensions, ActivityIndicator, Linking, Platform, TouchableWithoutFeedback } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSwipeToHome } from '../../hooks/useSwipeToHome';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RouteProp } from '@react-navigation/native';
import { useAppSelector } from '../../store/hooks';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import { useNotices } from '../../hooks/useNotices';
import Ionicons from '@expo/vector-icons/Ionicons';
import Entypo from '@expo/vector-icons/Entypo';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AttachmentViewer } from '../../components/AttachmentViewer';
import { NoticeBoardCard } from '../../components/NoticeBoardCard';
import { ProfileImage } from '../../components/ProfileImage';
// MediaViewer import removed since we don't use modal anymore
import { BulletinBoard } from '../BulletinScreen';


type RootStackParamList = {
    Login: undefined;
    Dashboard: undefined;
    AnnouncementNotice: { activeTab?: string; announcementId?: number; bulletinId?: number; noticeId?: number; showPendingBulletins?: boolean } | undefined;
    CreateBulletin: undefined;
    Info: undefined;
    Services: undefined;
    AllServices: undefined;
    Feed: undefined;
    Activity: undefined;
};

type AnnouncementNoticeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AnnouncementNotice'>;
type AnnouncementNoticeScreenRouteProp = RouteProp<RootStackParamList, 'AnnouncementNotice'>;

const PRIORITY_OPTIONS = [
    { value: 'urgent', color: 'text-red-500' },
    { value: 'high', color: 'text-yellow-500' },
    { value: 'normal', color: 'text-primary' },
    { value: 'low', color: 'text-gray-400' },
];

export default function AnnouncementNotice() {
    console.log('🚀 AnnouncementNotice component is rendering');
    // Disable swipe-to-home on Bulletin tab so the bulletin list can scroll in full screen
    const panGesture = useSwipeToHome(activeContentTab !== 'bulletin');
    const navigation = useNavigation<AnnouncementNoticeScreenNavigationProp>();
    const route = useRoute<AnnouncementNoticeScreenRouteProp>();

    const { user } = useAppSelector((state) => state.auth);
    const { isAuthenticated, accessToken, isLoading: authLoading } = useAppSelector((state) => state.auth);
    // Get initial activeContentTab from route params to prevent layout jumps
    // Use useMemo to prevent unnecessary re-calculations
    const initialActiveContentTab = React.useMemo(() => {
        const params = route.params as { activeTab?: string } | undefined;
        console.log('🎯 Calculating initialActiveContentTab from route params:', params);
        if (params?.activeTab === 'bulletin' || params?.activeTab === 'bulletins') {
            console.log('🔄 Initial activeContentTab set to bulletin from route params');
            return 'bulletin';
        } else if (params?.activeTab === 'announcements') {
            console.log('🔄 Initial activeContentTab set to announcements from route params');
            return 'announcements';
        }
        console.log('🔄 Initial activeContentTab set to default: announcements');
        return 'announcements'; // default fallback
    }, [route.params]);

    // Get showPendingBulletins flag from route params
    const shouldShowPendingBulletins = React.useMemo(() => {
        const params = route.params as { showPendingBulletins?: boolean } | undefined;
        console.log('🎯 showPendingBulletins from route params:', params?.showPendingBulletins);
        return params?.showPendingBulletins || false;
    }, [route.params]);

    const [activeContentTab, setActiveContentTab] = useState(initialActiveContentTab);
    console.log('📊 Current activeContentTab state:', activeContentTab);

    // Add ref to prevent rapid successive tab changes with stronger debouncing
    const isTabChangingRef = useRef(false);
    const lastTabChangeTimeRef = useRef(0);

    // Remove route readiness check to prevent content flickering and scroll jumping
    const [refreshing, setRefreshing] = useState(false);
    // Removed unused modal states
    const [showFilter, setShowFilter] = useState(false);

    // State to track highlighted announcement from navigation
    const [highlightedAnnouncementId, setHighlightedAnnouncementId] = useState<number | null>(null);
    const announcementRefs = useRef<{ [key: number]: View | null }>({});
    const scrollViewRef = useRef<ScrollView | null>(null);

    // State to track highlighted bulletin from navigation
    const [highlightedBulletinId, setHighlightedBulletinId] = useState<number | null>(null);
    // Ref to track if we've already processed a bulletinId to prevent re-processing
    const processedBulletinIdRef = useRef<number | null>(null);

    // State to track highlighted notice from navigation
    const [highlightedNoticeId, setHighlightedNoticeId] = useState<number | null>(null);
    // Ref to track if we've already processed a noticeId to prevent re-processing
    const processedNoticeIdRef = useRef<number | null>(null);

    // Debug: Log when highlightedBulletinId state changes
    useEffect(() => {
        console.log('🔍 highlightedBulletinId state changed to:', highlightedBulletinId);
    }, [highlightedBulletinId]);

    // Debug: Log when highlightedNoticeId state changes
    useEffect(() => {
        console.log('🔍 highlightedNoticeId state changed to:', highlightedNoticeId);
    }, [highlightedNoticeId]);

    // Filter states
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [tempSelectedDate, setTempSelectedDate] = useState<Date>(() => new Date());
    const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
    const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showPriorityOptions, setShowPriorityOptions] = useState(false);
    const [showLabelOptions, setShowLabelOptions] = useState(false);


    // Use hooks for data fetching
    const { announcements, loading: announcementsLoading, getAnnouncements, getAnnouncementById, error: announcementsError, hasLoadedOnce: announcementsHasLoadedOnce } = useAnnouncements();
    const { notices, loading: noticesLoading, getNotices, error: noticesError, hasLoadedOnce: noticesHasLoadedOnce } = useNotices();


    // Debug authentication state
    useEffect(() => {
        console.log('🔐 Auth State Debug:', {
            isAuthenticated,
            hasAccessToken: !!accessToken,
            accessTokenLength: accessToken?.length || 0,
            user: user ? { id: user.id, username: user.username } : null,
            authLoading
        });
    }, [isAuthenticated, accessToken, user, authLoading]);

    // Fetch data when component mounts or tab changes
    useEffect(() => {
        console.log('🔄 useEffect triggered - activeContentTab:', activeContentTab);

        // Check authentication before making API calls
        if (authLoading) {
            console.log('⏳ Still loading authentication, skipping API calls');
            return;
        }

        if (!isAuthenticated || !accessToken) {
            console.log('❌ Not authenticated or no access token, skipping API calls');
            return;
        }

        // Only fetch if data hasn't been loaded before
        if (!announcementsHasLoadedOnce) {
            console.log('📢 Fetching announcements...');
            getAnnouncements();
        } else {
            console.log('📢 Announcements already loaded, skipping fetch');
        }

        if (!noticesHasLoadedOnce) {
            console.log('📋 Fetching notices...');
            // Explicitly request all notices regardless of status
            getNotices({ status: undefined });
        } else {
            console.log('📋 Notices already loaded, skipping fetch');
        }
    }, [isAuthenticated, accessToken, authLoading, announcementsHasLoadedOnce, noticesHasLoadedOnce]);

    // Debug logging for data changes
    useEffect(() => {
        console.log('📊 Announcements data updated:', {
            count: announcements.length,
            loading: announcementsLoading,
            error: announcementsError
        });
    }, [announcements, announcementsLoading, announcementsError]);

    // Scroll to highlighted announcement when it's loaded
    const scrollToAnnouncement = useCallback((announcementId: number, y: number) => {
        if (highlightedAnnouncementId === announcementId && scrollViewRef.current) {
            console.log('📍 Scrolling to announcement at position:', y);
            scrollViewRef.current.scrollTo({ y: Math.max(0, y - 20), animated: true });
        }
    }, [highlightedAnnouncementId]);

    useEffect(() => {
        console.log('📊 Notices data updated:', {
            count: notices.length,
            loading: noticesLoading,
            error: noticesError
        });

    }, [notices, noticesLoading, noticesError]);

    // Remove redundant useEffects that were causing multiple triggers on tab changes
    // The BulletinBoard component handles its own data loading efficiently

    // Route params are now handled in initial state, no need for this useEffect
    // This prevents the layout jump that was happening when switching tabs

    // Sync route params with active tab state when navigating from Dashboard or Services
    // This ensures that when clicking "Announcement" or "Bulletin Board" from Dashboard/Services,
    // the correct tab is displayed
    // FIXED: Remove activeContentTab from dependencies to prevent infinite loops
    useEffect(() => {
        const params = route.params as { activeTab?: string } | undefined;
        if (params?.activeTab) {
            const targetTab = params.activeTab === 'bulletin' ? 'bulletin' : 'announcements';
            console.log('🔄 Route params changed, updating activeContentTab to:', targetTab);
            // Reset debouncing refs to allow immediate navigation from route params
            isTabChangingRef.current = false;
            lastTabChangeTimeRef.current = 0;
            setActiveContentTab(targetTab);
        }
    }, [route.params]);

    // Handle route params when screen is focused (for cases where screen is already in stack)
    // FIXED: Remove activeContentTab from dependencies to prevent render issues
    useFocusEffect(
        useCallback(() => {
            const params = route.params as { activeTab?: string; announcementId?: number; bulletinId?: number; noticeId?: number; showPendingBulletins?: boolean } | undefined;
            if (params?.activeTab) {
                const targetTab = (params.activeTab === 'bulletin' || params.activeTab === 'bulletins') ? 'bulletin' : 'announcements';
                console.log('🔄 Screen focused with route params, updating activeContentTab to:', targetTab);
                // Reset debouncing refs to allow immediate navigation from route params
                isTabChangingRef.current = false;
                lastTabChangeTimeRef.current = 0;
                setActiveContentTab(targetTab);
            }
            // Handle announcementId parameter - fetch updated announcement and refresh list
            if (params?.announcementId) {
                const announcementId = params.announcementId;
                console.log('📌 Navigating to specific announcement:', announcementId);

                // Ensure we're on the announcements tab
                setActiveContentTab('announcements');

                // Fetch the updated announcement by ID to get latest data
                if (isAuthenticated && accessToken) {
                    console.log('🔄 Fetching updated announcement data for ID:', announcementId);
                    (async () => {
                        try {
                            await getAnnouncementById(announcementId);
                            console.log('✅ Announcement fetched successfully');
                        } catch (error) {
                            console.error('❌ Error fetching announcement:', error);
                        }
                    })();

                    // Also refresh the announcements list to ensure we have the latest data
                    console.log('🔄 Refreshing announcements list to get latest data');
                    getAnnouncements();
                }

                // Set highlighted announcement ID
                setHighlightedAnnouncementId(announcementId);

                // Clear highlight after 3 seconds
                setTimeout(() => {
                    setHighlightedAnnouncementId(null);
                }, 3000);

                // Clear the announcementId param after processing to prevent re-triggering
                setTimeout(() => {
                    navigation.setParams({ announcementId: undefined } as any);
                }, 100);
            }

            // Handle bulletinId parameter - navigate to specific bulletin in current bulletins
            if (params?.bulletinId && processedBulletinIdRef.current !== params.bulletinId) {
                const bulletinId = params.bulletinId;
                console.log('📌 Navigating to specific bulletin from notification:', bulletinId);

                // Mark as processed to prevent re-processing
                processedBulletinIdRef.current = bulletinId;

                // Ensure we're on the bulletins tab FIRST
                setActiveContentTab('bulletin');

                // Use a small delay to ensure tab switch completes before setting highlight
                // This ensures BulletinBoard is mounted and ready to receive the prop
                setTimeout(() => {
                    // Set highlighted bulletin ID (will be passed to BulletinBoard)
                    // This will trigger refresh in BulletinBoard component
                    console.log('✨ Setting highlightedBulletinId to:', bulletinId);
                    setHighlightedBulletinId(bulletinId);
                }, 100);

                // Clear highlight after 10 seconds (bulletin scrolling and refresh takes longer)
                // Give enough time for data refresh and scroll animation
                const highlightTimer = setTimeout(() => {
                    console.log('⏰ Clearing bulletin highlight after timeout');
                    setHighlightedBulletinId(null);
                    processedBulletinIdRef.current = null;
                }, 10000);

                // Clear the bulletinId param after a longer delay to ensure state is set
                // This prevents the useFocusEffect from re-triggering and clearing the state
                setTimeout(() => {
                    navigation.setParams({ bulletinId: undefined } as any);
                }, 1500);

                // Return cleanup function to clear timer if component unmounts
                return () => {
                    clearTimeout(highlightTimer);
                };
            }

            // Handle noticeId parameter - navigate to specific notice in notice board
            if (params?.noticeId && processedNoticeIdRef.current !== params.noticeId) {
                const noticeId = params.noticeId;
                console.log('📌 Navigating to specific notice from notification:', noticeId);

                // Mark as processed to prevent re-processing
                processedNoticeIdRef.current = noticeId;

                // Ensure we're on the announcements tab (where NoticeBoardCard is shown)
                setActiveContentTab('announcements');

                // Refresh notices list to ensure we have the latest data
                if (isAuthenticated && accessToken) {
                    console.log('🔄 Refreshing notices list to get latest data');
                    getNotices({ status: undefined });
                }

                // Use a small delay to ensure tab switch completes before setting highlight
                // This ensures NoticeBoardCard is mounted and ready to receive the prop
                setTimeout(() => {
                    // Set highlighted notice ID (will be passed to NoticeBoardCard)
                    console.log('✨ Setting highlightedNoticeId to:', noticeId);
                    setHighlightedNoticeId(noticeId);
                }, 100);

                // Clear highlight after 5 seconds (give enough time for scroll animation)
                const highlightTimer = setTimeout(() => {
                    console.log('⏰ Clearing notice highlight after timeout');
                    setHighlightedNoticeId(null);
                    processedNoticeIdRef.current = null;
                }, 5000);

                // Clear the noticeId param after a delay to ensure state is set
                // This prevents the useFocusEffect from re-triggering and clearing the state
                setTimeout(() => {
                    navigation.setParams({ noticeId: undefined } as any);
                }, 1500);

                // Return cleanup function to clear timer if component unmounts
                return () => {
                    clearTimeout(highlightTimer);
                };
            }

            // Clear showPendingBulletins param after it's been passed to BulletinBoard
            // Use setTimeout to ensure BulletinBoard receives the prop first
            if (params?.showPendingBulletins) {
                console.log('🔄 Clearing showPendingBulletins param after processing');
                setTimeout(() => {
                    navigation.setParams({ showPendingBulletins: undefined } as any);
                }, 100);
            }
        }, [route.params, navigation, isAuthenticated, accessToken, getAnnouncementById, getAnnouncements, getNotices, setHighlightedBulletinId])
    );

    // Log when component mounts
    useEffect(() => {
        console.log('🚀 AnnouncementNotice component mounted with activeContentTab:', activeContentTab);
        return () => {
            console.log('🔌 AnnouncementNotice component unmounting');
        };
    }, []);

    const handleContentTabChange = useCallback((tabName: string) => {
        const now = Date.now();

        // Prevent unnecessary state updates if already on the same tab
        if (activeContentTab === tabName) {
            console.log('🔄 Already on tab:', tabName, '- skipping state update');
            return;
        }

        // Lighter debouncing - prevent clicks within 200ms of each other (reduced from 300ms)
        if (now - lastTabChangeTimeRef.current < 200) {
            console.log('🔄 Tab change too rapid, skipping:', tabName, `(${now - lastTabChangeTimeRef.current}ms since last)`);
            return;
        }

        // Prevent rapid successive tab changes
        if (isTabChangingRef.current) {
            console.log('🔄 Tab change already in progress, skipping:', tabName);
            return;
        }

        console.log('🔄 Content tab changed to:', tabName);

        // Update last tab change time
        lastTabChangeTimeRef.current = now;

        // Mark tab change as in progress
        isTabChangingRef.current = true;

        // Immediate tab switching for stable navigation
        setActiveContentTab(tabName);

        // Force refresh data when switching to announcements tab
        if (tabName === 'announcements') {
            console.log('🔄 Switching to announcements - force refreshing to get latest data');
            getAnnouncements();
            getNotices({ status: undefined });
        }
        // Note: Bulletin tab handles its own refresh in BulletinBoard component

        // Reset the flag after a shorter delay to improve responsiveness
        setTimeout(() => {
            isTabChangingRef.current = false;
        }, 200);
    }, [activeContentTab, getAnnouncements, getNotices]);

    const handleManualRefresh = useCallback(async () => {
        console.log('🔄 Manual refresh triggered');
        setRefreshing(true);

        try {
            if (activeContentTab === 'bulletin') {
                // If bulletin tab is active, immediate refresh handling
                console.log('🔄 Bulletin tab is active - immediate refresh');
                // No delay needed for immediate operation
            } else {
                // Refresh announcements and notices for other tabs
                console.log('🔄 Refreshing announcements...');
                await getAnnouncements();

                console.log('🔄 Refreshing notices...');
                await getNotices({ status: undefined });
            }

            console.log('✅ All data refreshed successfully');
        } catch (error) {
            console.error('❌ Error during refresh:', error);
        } finally {
            setRefreshing(false);
        }
    }, [activeContentTab, getAnnouncements, getNotices]);

    // Stable callback for BulletinBoard component
    const handleCreateBulletin = useCallback(() => {
        navigation.navigate('CreateBulletin');
    }, [navigation]);

    const formatTimeAgo = (dateString: string) => {
        const now = new Date();
        const date = new Date(dateString);
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;

        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;

        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;

        return date.toLocaleDateString();
    };

    const getAuthorDisplayName = (announcement: any) => {
        if (announcement.post_as === 'group' && announcement.group_name) {
            return announcement.group_name;
        } else if (announcement.post_as === 'member' && announcement.member_name) {
            return announcement.member_name;
        } else {
            return announcement.creator_name || 'Unknown User';
        }
    };

    const getRoleDisplay = (announcement: any) => {
        if (announcement.post_as === 'group') {
            return 'Management';
        } else if (announcement.post_as === 'member') {
            return 'Member';
        } else {
            return 'Creator';
        }
    };

    // Filter announcements based on selected criteria
    const getFilteredAnnouncements = () => {
        if (!announcements || announcements.length === 0) return [];

        return announcements.filter(announcement => {
            // Only show ongoing announcements (exclude expired)
            if (announcement.status !== 'ongoing') return false;

            // Date filter
            if (selectedDate) {
                const announcementDate = new Date(announcement.created_at).toDateString();
                const filterDate = new Date(selectedDate).toDateString();
                if (announcementDate !== filterDate) return false;
            }

            // Priority filter
            if (selectedPriorities.length > 0) {
                if (!selectedPriorities.includes(announcement.priority)) return false;
            }

            // Label filter
            if (selectedLabels.length > 0) {
                if (!announcement.label) return false;

                const announcementLabels = announcement.label.split(',').map((label: string) => label.trim());
                const hasMatchingLabel = selectedLabels.some(selectedLabel =>
                    announcementLabels.includes(selectedLabel)
                );
                if (!hasMatchingLabel) return false;
            }

            return true;
        });
    };

    // Get unique labels from announcements
    const getUniqueLabels = () => {
        const labels = new Set<string>();
        announcements.forEach(announcement => {
            if (announcement.label) {
                announcement.label.split(',').forEach((label: string) => {
                    labels.add(label.trim());
                });
            }
        });
        return Array.from(labels);
    };

    // Handle priority selection
    const handlePriorityToggle = (priority: string) => {
        setSelectedPriorities(prev =>
            prev.includes(priority)
                ? prev.filter(p => p !== priority)
                : [...prev, priority]
        );
    };

    // Handle label selection
    const handleLabelToggle = (label: string) => {
        setSelectedLabels(prev =>
            prev.includes(label)
                ? prev.filter(l => l !== label)
                : [...prev, label]
        );
    };

    // Clear all filters
    const clearFilters = () => {
        setSelectedDate('');
        setSelectedPriorities([]);
        setSelectedLabels([]);
    };

    // Close all filter dropdowns
    const closeAllDropdowns = () => {
        setShowDatePicker(false);
        setShowPriorityOptions(false);
        setShowLabelOptions(false);
    };

    // Handle date picker
    const handleDateChange = (event: any, selectedDate?: Date) => {
        console.log('📅 Date picker event:', event);
        console.log('📅 Selected date:', selectedDate);

        // Handle Android
        if (Platform.OS === 'android') {
            if (event.type === 'set' && selectedDate) {
                console.log('📅 Android - Setting selected date:', selectedDate.toISOString());
                setSelectedDate(selectedDate.toISOString());
                setShowDatePicker(false);
            } else if (event.type === 'dismissed') {
                console.log('📅 Android - Date picker dismissed');
                setShowDatePicker(false);
            }
        }
        // Handle iOS
        else if (Platform.OS === 'ios') {
            console.log('📅 iOS - Event type:', event.type);
            if (selectedDate) {
                console.log('📅 iOS - Updating temp date:', selectedDate.toISOString());
                setTempSelectedDate(selectedDate);
            }
        }
    };

    // Handle today button press
    const handleTodayPress = () => {
        const today = new Date();
        console.log('📅 Setting today as selected date:', today.toISOString());
        setSelectedDate(today.toISOString());
        setShowDatePicker(false);
    };

    // Handle iOS date confirmation
    const handleIOSDateConfirm = () => {
        console.log('📅 iOS - Confirming date:', tempSelectedDate.toISOString());
        setSelectedDate(tempSelectedDate.toISOString());
        setShowDatePicker(false);
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent':
                return { bg: 'bg-red-100', text: 'text-red-600' };
            case 'high':
                return { bg: 'bg-orange-100', text: 'text-orange-600' };
            case 'normal':
                return { bg: 'bg-blue-100', text: 'text-blue-600' };
            case 'low':
                return { bg: 'bg-gray-100', text: 'text-gray-600' };
            default:
                return { bg: 'bg-gray-100', text: 'text-gray-600' };
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ongoing':
                return { bg: 'bg-green-100', text: 'text-green-600' };
            case 'upcoming':
                return { bg: 'bg-blue-100', text: 'text-blue-600' };
            case 'expired':
                return { bg: 'bg-gray-100', text: 'text-gray-600' };
            case 'draft':
                return { bg: 'bg-yellow-100', text: 'text-yellow-600' };
            default:
                return { bg: 'bg-gray-100', text: 'text-gray-600' };
        }
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
        <GestureDetector gesture={panGesture}>
        <View className="flex-1 bg-white">
            {/* Show loading state while checking authentication */}
            {authLoading && (
                <View className="flex-1 justify-center items-center bg-white">
                    <Text className="font-oxanium-bold text-lg text-text-primary mb-4">
                        Checking authentication...
                    </Text>
                    <ActivityIndicator size="large" color="#f97316" />
                </View>
            )}

            {/* Show message when not authenticated */}
            {!authLoading && (!isAuthenticated || !accessToken) && (
                <View className="flex-1 justify-center items-center bg-white">
                    <Text className="font-oxanium-bold text-lg text-text-primary mb-4">
                        Authentication required
                    </Text>
                    <Text className="font-oxanium text-base text-text-secondary text-center px-8">
                        Please log in to access this feature.
                    </Text>
                    <TouchableOpacity
                        className="mt-6 bg-primary px-6 py-3 rounded-lg"
                        onPress={() => navigation.navigate('Login')}>
                        <Text className="font-oxanium-bold text-white text-base">Go to Login</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Show main content only when not loading authentication */}
            {!authLoading && isAuthenticated && accessToken && (
                <View className="flex-1 bg-white">
                    {/* Content Tabs */}
                    <View className="flex-row border-b border-gray-100 bg-white">
                        <TouchableOpacity
                            className={`flex-1 py-4 ${activeContentTab === 'announcements' ? 'border-b-2 border-primary' : ''}`}
                            onPress={() => handleContentTabChange('announcements')}>
                            <Text className={`text-center font-lato-bold text-lg ${activeContentTab === 'announcements' ? 'text-primary' : 'text-text-secondary'}`}>
                                Announcements & Notice
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className={`flex-1 py-4 ${activeContentTab === 'bulletin' ? 'border-b-2 border-primary' : ''}`}
                            onPress={() => handleContentTabChange('bulletin')}>
                            <Text className={`text-center font-lato-bold text-lg ${activeContentTab === 'bulletin' ? 'text-primary' : 'text-text-secondary'}`}>
                                Bulletin Board
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Remove route readiness loading state to prevent scroll jumping */}



                    {/* Main Content - Conditional rendering to avoid ScrollView conflicts */}
                    {activeContentTab === 'announcements' ? (
                        /* Announcements Content with its own ScrollView */
                        <ScrollView
                            ref={scrollViewRef}
                            className="flex-1"
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 120 }}
                            onScrollBeginDrag={closeAllDropdowns}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={handleManualRefresh}
                                    colors={['#3C9D9B']}
                                    tintColor="#3C9D9B"
                                />
                            }>
                            {/* Notice Board Section */}
                            <View className="mb-2">
                                <NoticeBoardCard
                                    showTitle={true}
                                    maxItems={10}
                                    cardHeight={140}
                                    cardWidth={120}
                                    highlightedNoticeId={highlightedNoticeId || undefined}
                                />
                            </View>

                            {/* Announcements Section */}
                            <View className="bg-white px-4 py-4">
                                <View className="flex-row items-center justify-between mb-4">
                                    <View>
                                        <Text className="font-lato-bold text-2xl text-text-primary">Announcements</Text>

                                    </View>
                                    <TouchableOpacity
                                        className={`flex-row items-center px-3 py-2 rounded-lg border ${showFilter
                                            ? 'bg-primary border-primary'
                                            : 'bg-white border-primary'
                                            }`}
                                        onPress={() => setShowFilter(!showFilter)}>
                                        <Text className={`mr-2 font-lato-bold text-lg ${showFilter ? 'text-white' : 'text-primary'
                                            }`}>Filter</Text>
                                        <Ionicons
                                            name="filter-sharp"
                                            size={16}
                                            color={showFilter ? 'white' : '#3C9D9B'}
                                        />
                                    </TouchableOpacity>
                                </View>

                                {/* Filter Controls */}
                                {showFilter && (
                                    <View className="mb-4 relative">

                                        {/* Filter Row - Simple Dropdown Fields */}
                                        <View className="flex-row mb-8">
                                            {/* Date Filter - Commented out */}
                                            {/* <View className="flex-1 mr-6">
                                                <View className="flex-row">
                                                    <TouchableOpacity
                                                        className="flex-1 bg-white border border-primary rounded-lg p-3 flex-row items-center justify-between mr-2"
                                                        onPress={() => {
                                                            setShowDatePicker(true);
                                                            setShowPriorityOptions(false);
                                                            setShowLabelOptions(false);
                                                        }}>
                                                        <Text className="font-oxanium text-primary text-base font-bold">
                                                            {selectedDate ? new Date(selectedDate).toLocaleDateString() : 'Select Date'}
                                                        </Text>
                                                        <Ionicons name="calendar-outline" size={18} color="#3C9D9B" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View> */}

                                            {/* Priority Filter */}
                                            <View className="flex-1 mr-3">
                                                {/* <Text className="font-oxanium-bold text-primary text-sm mb-3">Select Priority</Text> */}
                                                <TouchableOpacity
                                                    className="bg-white border border-primary rounded-lg p-3 flex-row items-center justify-between"
                                                    onPress={() => {
                                                        setShowPriorityOptions(!showPriorityOptions);
                                                        setShowLabelOptions(false);
                                                        setShowDatePicker(false);
                                                    }}>
                                                    <Text className="font-lato-bold text-primary text-lg">
                                                        {selectedPriorities.length > 0
                                                            ? `${selectedPriorities.length} selected`
                                                            : 'Select Priority'
                                                        }
                                                    </Text>
                                                    <Ionicons name="chevron-down" size={16} color="#3C9D9B" />
                                                </TouchableOpacity>
                                            </View>

                                            {/* Label Filter */}
                                            <View className="flex-1">
                                                {/* <Text className="font-oxanium-bold text-primary text-sm mb-3">Select Label</Text> */}
                                                <TouchableOpacity
                                                    className="bg-white border border-primary rounded-lg p-3 flex-row items-center justify-between"
                                                    onPress={() => {
                                                        setShowLabelOptions(!showLabelOptions);
                                                        setShowPriorityOptions(false);
                                                        setShowDatePicker(false);
                                                    }}>
                                                    <Text className="font-lato-bold text-primary text-lg">
                                                        {selectedLabels.length > 0
                                                            ? `${selectedLabels.length} selected`
                                                            : 'Select Label'
                                                        }
                                                    </Text>
                                                    <Ionicons name="chevron-down" size={16} color="#3C9D9B" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {/* Priority Options */}
                                        {showPriorityOptions && (
                                            <View className="absolute top-16 left-0 right-0 bg-white border border-primary rounded-lg p-3 z-20">
                                                <View className="flex-row items-center justify-between mb-3">
                                                    <Text className="font-lato-bold text-primary text-lg">Select Priority</Text>
                                                    <TouchableOpacity
                                                        className="bg-primary px-3 py-1 rounded"
                                                        onPress={() => setSelectedPriorities([])}>
                                                        <Text className="font-lato-bold text-white text-lg">Clear</Text>
                                                    </TouchableOpacity>
                                                </View>
                                                {['urgent', 'high', 'normal', 'low'].map((priority) => (
                                                    <TouchableOpacity
                                                        key={priority}
                                                        className="flex-row items-center py-2"
                                                        onPress={() => {
                                                            setSelectedPriorities(prev =>
                                                                prev.includes(priority)
                                                                    ? prev.filter(p => p !== priority)
                                                                    : [...prev, priority]
                                                            );
                                                        }}>
                                                        <View className={`w-6 h-6 rounded border-2 mr-3 ${selectedPriorities.includes(priority)
                                                            ? 'bg-primary border-primary'
                                                            : 'border-gray-400'
                                                            }`}>
                                                            {selectedPriorities.includes(priority) && (
                                                                <Ionicons name="checkmark" size={16} color="white" />
                                                            )}
                                                        </View>
                                                        <Text className="font-lato-semibold text-text-primary text-lg capitalize">{priority}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}

                                        {/* Label Options */}
                                        {showLabelOptions && (
                                            <View className="absolute top-16 left-0 right-0 bg-white border border-primary rounded-lg p-3 z-20">
                                                <View className="flex-row items-center justify-between mb-3">
                                                    <Text className="font-lato-bold text-primary text-lg">Select Label</Text>
                                                    <TouchableOpacity
                                                        className="bg-primary px-3 py-1 rounded"
                                                        onPress={() => setSelectedLabels([])}>
                                                        <Text className="font-lato-bold text-white text-lg">Clear</Text>
                                                    </TouchableOpacity>
                                                </View>
                                                {getUniqueLabels().length > 0 ? (
                                                    <ScrollView
                                                        className="max-h-[200px]"
                                                        showsVerticalScrollIndicator
                                                        nestedScrollEnabled
                                                    >
                                                        {getUniqueLabels().map((label) => (
                                                            <TouchableOpacity
                                                                key={label}
                                                                className="flex-row items-center py-2"
                                                                onPress={() => {
                                                                    setSelectedLabels(prev =>
                                                                        prev.includes(label)
                                                                            ? prev.filter(l => l !== label)
                                                                            : [...prev, label]
                                                                    );
                                                                }}>
                                                                <View className={`w-6 h-6 rounded border-2 mr-3 ${selectedLabels.includes(label)
                                                                    ? 'bg-primary border-primary'
                                                                    : 'border-gray-400'
                                                                    }`}>
                                                                    {selectedLabels.includes(label) && (
                                                                        <Ionicons name="checkmark" size={16} color="white" />
                                                                    )}
                                                                </View>
                                                                <Text className="font-lato-semibold text-text-primary text-lg capitalize">{label}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </ScrollView>
                                                ) : (
                                                    <Text className="font-lato-bold text-text-secondary text-lg text-center py-4">
                                                        No labels available
                                                    </Text>
                                                )}
                                            </View>
                                        )}

                                        {/* Date Picker */}
                                        {showDatePicker && (
                                            <DateTimePicker
                                                value={tempSelectedDate}
                                                mode="date"
                                                display="default"
                                                onChange={(event, selectedDate) => {
                                                    setShowDatePicker(false);
                                                    if (selectedDate) {
                                                        setTempSelectedDate(selectedDate);
                                                        setSelectedDate(selectedDate.toISOString().split('T')[0]);
                                                    }
                                                }}
                                            />
                                        )}

                                        {/* Apply Filters Button */}
                                        {/* <TouchableOpacity 
                                            className="bg-primary px-6 py-3 rounded-lg mt-4"
                                            onPress={() => {
                                                setShowFilter(false);
                                                // Apply filters logic here
                                            }}>
                                            <Text className="font-oxanium-bold text-white text-center">Apply Filters</Text>
                                        </TouchableOpacity> */}
                                    </View>
                                )}

                                {/* Filtered Announcements */}
                                {getFilteredAnnouncements().length > 0 ? (
                                    getFilteredAnnouncements().map((announcement, index) => (
                                        <View
                                            key={announcement.id}
                                            ref={(ref) => { announcementRefs.current[announcement.id] = ref; }}
                                            onLayout={(event) => {
                                                if (highlightedAnnouncementId === announcement.id) {
                                                    const { y } = event.nativeEvent.layout;
                                                    scrollToAnnouncement(announcement.id, y);
                                                }
                                            }}
                                            className={`bg-white border-2 rounded-lg mb-6 overflow-hidden ${highlightedAnnouncementId === announcement.id
                                                    ? 'border-primary'
                                                    : 'border-gray-200'
                                                }`}
                                            style={highlightedAnnouncementId === announcement.id ? {
                                                shadowColor: '#3C9D9B',
                                                shadowOffset: { width: 0, height: 2 },
                                                shadowOpacity: 0.3,
                                                shadowRadius: 4,
                                                elevation: 5,
                                            } : undefined}
                                        >
                                            {/* Header */}
                                            <View className=" px-3 py-3 pt-4">
                                                <View className="flex-row items-center mb-1">
                                                    {/* Profile Picture or Group Icon - Optimized with loading state */}
                                                    <View className="mr-3">
                                                        <ProfileImage
                                                            postAs={announcement.post_as}
                                                            memberPhoto={announcement.member_photo || ''}
                                                            creatorPhoto={announcement.creator_photo || undefined}
                                                            size="small"
                                                            showBorder={true}
                                                        />
                                                    </View>

                                                    {/* Name and Icons - Same row as photo */}
                                                    <View className="flex-1">
                                                        <View className="flex-row items-center justify-between">
                                                            <Text className="font-lato-bold text-text-primary text-lg flex-1 mr-2">
                                                                {getAuthorDisplayName(announcement)}
                                                            </Text>

                                                            {/* Icons */}
                                                            <View className="flex-row items-center flex-shrink-0">
                                                                {/* Pin Icon */}
                                                                {announcement.is_pinned && (
                                                                    <Entypo name="pin" size={16} color="#f59e0b" style={{ marginRight: 8 }} />
                                                                )}

                                                                {/* Flag Icon */}
                                                                <FontAwesome6
                                                                    name="flag"
                                                                    size={16}
                                                                    color={
                                                                        announcement.priority === 'urgent' ? '#ef4444' :
                                                                            announcement.priority === 'high' ? '#eab308' :
                                                                                announcement.priority === 'normal' ? '#3C9D9B' :
                                                                                    '#9ca3af'
                                                                    }
                                                                    style={{ marginRight: 8 }}
                                                                />
                                                            </View>
                                                        </View>

                                                        {/* Date - Below the name */}
                                                        <View className="mb-2">
                                                            <Text className="font-lato text-base text-text-secondary">
                                                                {formatTimeAgo(announcement.created_at)}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </View>

                                                {/* Labels - Same position as Name and Date */}
                                                {announcement.label && announcement.label.trim() !== '' && (
                                                    <View className="flex-row flex-wrap items-center mb-2">
                                                        {announcement.label.split(',').map((labelPart, index) => (
                                                            <View
                                                                key={index}
                                                                className="bg-primary px-2 py-1 rounded-full mr-2 mb-1"
                                                            >
                                                                <Text className="font-lato-bold text-white text-base">
                                                                    {labelPart.trim()}
                                                                </Text>
                                                            </View>
                                                        ))}
                                                    </View>
                                                )}
                                            </View>

                                            {/* Content */}
                                            <View className="px-4 pb-3">
                                                <Text className="font-lato-bold text-text-primary text-xl mb-2">{announcement.title}</Text>
                                                {announcement.description && (
                                                    <Text className="font-lato text-text-secondary text-base mb-3">{announcement.description}</Text>
                                                )}
                                            </View>

                                            {/* Attachments */}
                                            <AttachmentViewer
                                                attachments={announcement.attachments}
                                                maxDisplay={3}
                                                announcement={announcement}
                                            />
                                        </View>
                                    ))
                                ) : (
                                    <View className="py-8 items-center">
                                        <Ionicons name="document-outline" size={64} color="#9CA3AF" />
                                        <Text className="mt-4 font-oxanium-bold text-lg text-text-secondary text-center">
                                            No announcements found
                                        </Text>
                                        <Text className="mt-2 font-oxanium text-text-secondary text-center px-8">
                                            Try adjusting your filters or check back later.
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </ScrollView>
                    ) : (
                        /* Bulletin Board Content with its own ScrollView - no nesting */
                        <BulletinBoard
                            onCreateBulletin={handleCreateBulletin}
                            isActive={activeContentTab === 'bulletin'}
                            parentRefreshing={refreshing}
                            initialShowPendingBulletins={shouldShowPendingBulletins}
                            highlightedBulletinId={highlightedBulletinId}
                        />
                    )}
                </View>
            )}
        </View>
        </GestureDetector>
        </GestureHandlerRootView>
    );
}
