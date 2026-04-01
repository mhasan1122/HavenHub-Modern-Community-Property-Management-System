/**
 * Notification cache for instant load - stores last fetched notifications
 * so the feed appears immediately while fresh data loads in background.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Notification } from './notificationApi';

const CACHE_KEY = 'notification_feed_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes - cache considered stale after this

export interface NotificationCache {
    notifications: Notification[];
    unreadCount: number;
    cachedAt: number;
}

export const notificationCache = {
    async get(): Promise<NotificationCache | null> {
        try {
            const raw = await AsyncStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const data: NotificationCache = JSON.parse(raw);
            // Return cache even if stale - we'll refresh in background
            return data;
        } catch {
            return null;
        }
    },

    async set(notifications: Notification[], unreadCount: number): Promise<void> {
        try {
            const data: NotificationCache = {
                notifications,
                unreadCount,
                cachedAt: Date.now(),
            };
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to cache notifications:', e);
        }
    },

    async clear(): Promise<void> {
        try {
            await AsyncStorage.removeItem(CACHE_KEY);
        } catch {
            // ignore
        }
    },

    isStale(cachedAt: number): boolean {
        return Date.now() - cachedAt > CACHE_TTL_MS;
    },
};
