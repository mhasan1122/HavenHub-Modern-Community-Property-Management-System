import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { notificationAPI, Notification } from '../services/notificationApi';
import { pushNotificationService } from '../services/pushNotificationService';
import { triggerNotificationCountRefresh } from '../../components/Header';
import { notificationCache } from '../services/notificationCache';

const PAGE_SIZE = 20;

const NotificationFeedScreen = () => {
    const navigation = useNavigation();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [markingAllRead, setMarkingAllRead] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const flatListRef = useRef<FlatList>(null);
    const isLoadingRef = useRef(false); // Prevent multiple simultaneous loads

    // Fetch notifications from backend with pagination
    const fetchNotifications = useCallback(async (page: number = 1, isRefresh: boolean = false, silent: boolean = false) => {
        // Prevent multiple simultaneous requests
        if (isLoadingRef.current && !isRefresh) {
            return;
        }

        try {
            isLoadingRef.current = true;
            setError(null);

            if (!silent) {
                if (isRefresh) {
                    setRefreshing(true);
                } else if (page === 1) {
                    setInitialLoading(true);
                } else {
                    setLoadingMore(true);
                }
            }

            const response = await notificationAPI.fetchNotifications({
                page,
                page_size: PAGE_SIZE,
            });

            // Update pagination state
            setHasMore(response.hasMore);
            setCurrentPage(response.currentPage);

            // Update notifications - append for pagination, replace for refresh
            if (isRefresh || page === 1) {
                setNotifications(response.results);
            } else {
                // Append new notifications, avoiding duplicates
                setNotifications((prev) => {
                    const existingIds = new Set(prev.map((n) => n.id));
                    const newNotifications = response.results.filter((n) => !existingIds.has(n.id));
                    return [...prev, ...newNotifications];
                });
            }

            // Update unread count from response if available, otherwise fetch separately
            let finalUnreadCount: number;
            if (response.totalUnread !== null && response.totalUnread !== undefined) {
                finalUnreadCount = response.totalUnread;
            } else {
                finalUnreadCount = await notificationAPI.getUnreadCount();
            }
            setUnreadCount(finalUnreadCount);
            await pushNotificationService.setBadgeCount(finalUnreadCount);

            // Cache first page for instant load on next open
            if ((isRefresh || page === 1) && response.results.length > 0) {
                notificationCache.set(response.results, finalUnreadCount);
            }

            console.log(`✅ Fetched page ${page}: ${response.results.length} notifications (hasMore: ${response.hasMore})`);
        } catch (error: any) {
            console.error('❌ Error fetching notifications:', error);
            setError(error.message || 'Failed to load notifications');
            
            // Show error alert for initial load or refresh
            if (page === 1 || isRefresh) {
                Alert.alert(
                    'Error',
                    'Failed to load notifications. Please try again.',
                    [
                        {
                            text: 'Retry',
                            onPress: () => fetchNotifications(page, isRefresh),
                        },
                        {
                            text: 'OK',
                            style: 'cancel',
                        },
                    ]
                );
            }
        } finally {
            isLoadingRef.current = false;
            setRefreshing(false);
            setInitialLoading(false);
            setLoadingMore(false);
        }
    }, []);

    // Load more notifications (pagination)
    const loadMoreNotifications = useCallback(() => {
        if (!hasMore || loadingMore || initialLoading || isLoadingRef.current) {
            return;
        }

        const nextPage = currentPage + 1;
        fetchNotifications(nextPage, false);
    }, [hasMore, loadingMore, initialLoading, currentPage, fetchNotifications]);

    // Initial load: show cached data instantly, then fetch fresh in background
    useEffect(() => {
        let mounted = true;

        const loadWithCache = async () => {
            // 1. Load from cache first for instant display
            const cached = await notificationCache.get();
            const hasCache = mounted && cached && cached.notifications.length > 0;
            if (hasCache) {
                setNotifications(cached.notifications);
                setUnreadCount(cached.unreadCount);
                setInitialLoading(false);
            }

            // 2. Always fetch fresh data in background (silent if we showed cache)
            await fetchNotifications(1, false, !!hasCache);
        };

        loadWithCache();
        return () => {
            mounted = false;
        };
    }, []); // Only run on mount

    // Auto-refresh every 60 seconds (only refresh first page)
    useEffect(() => {
        const interval = setInterval(() => {
            if (!initialLoading && !refreshing) {
                fetchNotifications(1, false);
            }
        }, 60000);

        return () => clearInterval(interval);
    }, [initialLoading, refreshing, fetchNotifications]);

    // Pull to refresh
    const onRefresh = useCallback(() => {
        setCurrentPage(1);
        setHasMore(true);
        fetchNotifications(1, true);
    }, [fetchNotifications]);

    // Mark all notifications as read
    const handleMarkAllAsRead = useCallback(async () => {
        if (unreadCount === 0 || markingAllRead) return;

        try {
            setMarkingAllRead(true);
            const updatedCount = await notificationAPI.markAllAsRead();
            
            // Update local state - mark all notifications as read
            setNotifications((prev) =>
                prev.map((n) => ({ ...n, is_read: true }))
            );
            setUnreadCount(0);
            await pushNotificationService.setBadgeCount(0);
            triggerNotificationCountRefresh();
            
            console.log(`✅ Marked ${updatedCount} notifications as read`);
        } catch (error) {
            console.error('❌ Error marking all notifications as read:', error);
            Alert.alert('Error', 'Failed to mark all notifications as read. Please try again.');
        } finally {
            setMarkingAllRead(false);
        }
    }, [unreadCount, markingAllRead]);

    // Group notifications by time
    const groupedNotifications = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const thisWeek = new Date(today);
        thisWeek.setDate(thisWeek.getDate() - 7);

        const groups: { [key: string]: Notification[] } = {
            Today: [],
            Yesterday: [],
            'This Week': [],
            Older: [],
        };

        notifications.forEach((notification) => {
            const createdAt = new Date(notification.created_at);

            if (createdAt >= today) {
                groups.Today.push(notification);
            } else if (createdAt >= yesterday) {
                groups.Yesterday.push(notification);
            } else if (createdAt >= thisWeek) {
                groups['This Week'].push(notification);
            } else {
                groups.Older.push(notification);
            }
        });

        return groups;
    }, [notifications]);

    // Handle notification tap
    const handleNotificationTap = async (notification: Notification) => {
        try {
            // Mark as read
            if (!notification.is_read) {
                await notificationAPI.markAsRead(notification.id);
                // Update local state
                setNotifications((prev) =>
                    prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
                );
                setUnreadCount((prev) => Math.max(0, prev - 1));
                await pushNotificationService.setBadgeCount(Math.max(0, unreadCount - 1));
                triggerNotificationCountRefresh();
            }

            // Navigate based on entity type
            const data = {
                entityType: notification.entity_type,
                entityId: notification.entity_id,
                announcementId: notification.entity_type === 'announcement' ? notification.entity_id : undefined,
                bulletinId: notification.entity_type === 'bulletin' ? notification.entity_id : undefined,
                noticeId: notification.entity_type === 'notice' ? notification.entity_id : undefined,
                serviceFeeId: notification.entity_type === 'service_fee' ? notification.entity_id : undefined,
                billId: notification.entity_type === 'bill' ? notification.entity_id : undefined,
                paymentId: notification.entity_type === 'payment' ? notification.entity_id : undefined,
                // Pass metadata for announcement status-based navigation
                metadata: notification.metadata || {},
            };

            await pushNotificationService.handleNotificationNavigation(data);
        } catch (error) {
            console.error('❌ Error handling notification tap:', error);
        }
    };

    // Render notification item
    const renderNotificationItem = ({ item }: { item: Notification }) => {
        // For notice notifications, use mobile-friendly format from metadata if available
        // Web app shows full context (poster name), mobile shows minimal (priority-based title + labels)
        const isNotice = item.entity_type === 'notice';
        const isServiceFee = item.entity_type === 'service_fee' || item.entity_type === 'bill' || item.entity_type === 'payment';
        
        const displayTitle = isNotice && item.metadata?.mobile_title 
            ? item.metadata.mobile_title 
            : item.title;
        const displayMessage = isNotice && item.metadata?.short_message !== undefined
            ? item.metadata.short_message
            : item.message;
        
        // No icon for payment received and service fee bill issued; only overdue shows icon
        const isOverdue = isServiceFee && (item.notification_type_code?.includes('overdue') || item.title?.toLowerCase().includes('overdue'));
        
        return (
            <TouchableOpacity
                className={`bg-white py-3 px-4 border-b border-gray-200 ${!item.is_read ? 'bg-blue-50' : ''}`}
                onPress={() => handleNotificationTap(item)}
                activeOpacity={0.7}
            >
                <View className="flex-row items-start">
                    {!item.is_read && <View className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 mr-3" />}
                    {isOverdue && (
                        <View className="mr-3 mt-0.5">
                            <Ionicons name="alert-circle" size={20} color="#EF4444" />
                        </View>
                    )}
                    <View className="flex-1">
                        <Text className={`text-base text-gray-900 mb-1 ${!item.is_read ? 'font-bold' : ''}`}>
                            {displayTitle}
                        </Text>
                        {displayMessage && (
                            <Text className="text-sm text-gray-600 mb-1" numberOfLines={2}>
                                {displayMessage}
                            </Text>
                        )}
                        <Text className="text-xs text-gray-400">
                            {new Date(item.created_at).toLocaleString()}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // Render group section
    const renderSection = (groupName: string, items: Notification[]) => {
        if (items.length === 0) return null;

        return (
            <View key={groupName} className="mt-4">
                <Text className="text-sm font-semibold text-gray-600 px-4 py-2 bg-gray-100">
                    {groupName}
                </Text>
                {items.map((item) => (
                    <View key={item.id}>{renderNotificationItem({ item })}</View>
                ))}
            </View>
        );
    };

    // Render footer with loading indicator or "No more" message
    const renderFooter = () => {
        if (loadingMore) {
            return (
                <View className="py-4 items-center">
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text className="text-sm text-gray-500 mt-2">Loading more notifications...</Text>
                </View>
            );
        }

        if (!hasMore && notifications.length > 0) {
            return (
                <View className="py-4 items-center">
                    <Text className="text-sm text-gray-400">No more notifications</Text>
                </View>
            );
        }

        return null;
    };

    // Render empty state
    const renderEmpty = () => {
        if (initialLoading) {
            return (
                <View className="flex-1 justify-center items-center pt-24">
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text className="text-base text-gray-400 mt-4">Loading notifications...</Text>
                </View>
            );
        }

        if (error) {
            return (
                <View className="flex-1 justify-center items-center pt-24 px-4">
                    <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
                    <Text className="text-base text-gray-900 mt-4 font-semibold">Failed to load notifications</Text>
                    <Text className="text-sm text-gray-500 mt-2 text-center">{error}</Text>
                    <TouchableOpacity
                        onPress={() => fetchNotifications(1, true)}
                        className="mt-4 bg-blue-500 px-6 py-3 rounded-lg"
                    >
                        <Text className="text-white font-semibold">Retry</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View className="flex-1 justify-center items-center pt-24">
                <Text className="text-base text-gray-400">No notifications</Text>
            </View>
        );
    };

    // Flatten grouped notifications for FlatList
    const flatListData = useMemo(() => {
        return Object.entries(groupedNotifications).filter(([_, items]) => items.length > 0);
    }, [groupedNotifications]);

    return (
        <SafeAreaView className="flex-1" edges={['top']}>
            <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="flex-row items-center flex-1"
                    activeOpacity={0.7}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                    <Ionicons name="arrow-back" size={24} color="#333" />
                    <Text className="text-2xl text-gray-900 font-oxanium-bold ml-3">Notification</Text>
                </TouchableOpacity>
                <View className="flex-row items-center">
                    {unreadCount > 0 && (
                        <View className="bg-blue-500 rounded-xl px-2 py-1 min-w-[24px] items-center mr-3">
                            <Text className="text-white text-xs font-bold">{unreadCount}</Text>
                        </View>
                    )}
                    {unreadCount > 0 && (
                        <TouchableOpacity
                            onPress={handleMarkAllAsRead}
                            disabled={markingAllRead}
                            className="px-3 py-1.5 mr-3"
                            activeOpacity={0.7}
                        >
                            {markingAllRead ? (
                                <ActivityIndicator size="small" color="#007AFF" />
                            ) : (
                                <Text className="text-sm text-blue-500 font-semibold">Mark all as read</Text>
                            )}
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="close" size={24} color="#333" />
                    </TouchableOpacity>
                </View>
            </View>

            {initialLoading && notifications.length === 0 ? (
                renderEmpty()
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={flatListData}
                    keyExtractor={([groupName]) => groupName}
                    renderItem={({ item: [groupName, items] }) => renderSection(groupName, items)}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    onEndReached={loadMoreNotifications}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={renderFooter}
                    ListEmptyComponent={renderEmpty}
                    contentContainerStyle={
                        notifications.length === 0 ? { flex: 1 } : { paddingBottom: 20 }
                    }
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={10}
                />
            )}
        </SafeAreaView>
    );
};

export default NotificationFeedScreen;
