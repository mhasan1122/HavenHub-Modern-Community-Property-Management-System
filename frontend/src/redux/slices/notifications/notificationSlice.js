import { createSlice } from "@reduxjs/toolkit";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  loadMoreNotifications,
} from "../api/notificationApi";

const notificationSlice = createSlice({
  name: "notifications",
  initialState: {
    notifications: [],
    unreadCount: 0,
    loading: false,
    loadingMore: false,
    error: null,
    pagination: {
      count: 0,
      next: null,
      previous: null,
      currentPage: 1,
    },
    loadMetrics: {
      complexity: 'O(n)',
      loadTimeMs: 0,
      processedCount: 0,
      description: ''
    }
  },
  reducers: {
    clearNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },
    incrementUnreadCount: (state) => {
      state.unreadCount += 1;
    },
    decrementUnreadCount: (state) => {
      if (state.unreadCount > 0) {
        state.unreadCount -= 1;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Notifications
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        // Handle paginated response
        let notificationsList = [];
        if (action.payload.results) {
          notificationsList = action.payload.results;
          state.pagination = {
            count: action.payload.count || 0,
            next: action.payload.next,
            previous: action.payload.previous,
          };
        } else {
          // Handle array response
          notificationsList = Array.isArray(action.payload)
            ? action.payload
            : [];
        }
        // Deduplicate notifications by ID (keep the first occurrence)
        const uniqueNotificationsMap = new Map();
        notificationsList.forEach((notification) => {
          if (!uniqueNotificationsMap.has(notification.id)) {
            uniqueNotificationsMap.set(notification.id, notification);
          }
        });
        const deduplicatedNotifications = Array.from(uniqueNotificationsMap.values());

        // Check for role_assigned notifications specifically
        const roleAssignedNotifications = deduplicatedNotifications.filter(
          n => n.notification_type_code === 'role_assigned' || 
               (n.notification_type && n.notification_type.code === 'role_assigned')
        );
        
        // Log role_assigned notifications separately for debugging
        if (roleAssignedNotifications.length > 0) {
          console.log('[NotificationSlice] 🎭 ROLE_ASSIGNED NOTIFICATIONS FOUND:', roleAssignedNotifications.map(n => ({
            id: n.id,
            title: n.title,
            message: n.message,
            entity_type: n.entity_type,
            notification_type_code: n.notification_type_code || (n.notification_type && n.notification_type.code),
            is_read: n.is_read,
            created_at: n.created_at,
            recipient_id: n.recipient || 'N/A'
          })));
        } else {
          console.log('[NotificationSlice] ⚠️ No role_assigned notifications found in the list');
        }
        
        console.log('[NotificationSlice] Received notifications:', {
          total: notificationsList.length,
          unique: deduplicatedNotifications.length,
          duplicatesRemoved: notificationsList.length - deduplicatedNotifications.length,
          unread: deduplicatedNotifications.filter(n => !n.is_read).length,
          read: deduplicatedNotifications.filter(n => n.is_read).length,
          roleAssignedCount: roleAssignedNotifications.length,
          allNotificationTypes: [...new Set(deduplicatedNotifications.map(n => 
            n.notification_type_code || (n.notification_type && n.notification_type.code) || 'unknown'
          ))],
          allEntityTypes: [...new Set(deduplicatedNotifications.map(n => n.entity_type || 'unknown'))],
          recentNotifications: deduplicatedNotifications.slice(0, 5).map(n => ({
            id: n.id,
            title: n.title?.substring(0, 50),
            notification_type_code: n.notification_type_code || (n.notification_type && n.notification_type.code),
            entity_type: n.entity_type,
            is_read: n.is_read,
            created_at: n.created_at
          }))
        });

        // Sort notifications: unread first, then by created_at descending
        const sortedNotifications = deduplicatedNotifications.sort((a, b) => {
          // Unread notifications first
          if (a.is_read !== b.is_read) {
            return a.is_read ? 1 : -1;
          }
          // Then sort by created_at (newest first)
          return new Date(b.created_at) - new Date(a.created_at);
        });

        state.notifications = sortedNotifications;
        console.log('[NotificationSlice] Stored all notifications:', sortedNotifications.length);

        // Store load metrics if available
        if (action.payload.load_metrics) {
          state.loadMetrics = {
            complexity: action.payload.load_metrics.complexity || 'O(n)',
            loadTimeMs: action.payload.load_metrics.load_time_ms || 0,
            processedCount: action.payload.load_metrics.processed_count || 0,
            description: action.payload.load_metrics.description || ''
          };
        }

        // Note: Don't update count from list as it might be paginated
        // Always use the separate unread count API for accurate count
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch Unread Count
      .addCase(fetchUnreadCount.pending, (state) => {
        // Don't set loading for count fetch
      })
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload.unread_count || 0;
      })
      .addCase(fetchUnreadCount.rejected, (state) => {
        // Silently fail for count
      })
      // Mark Notification as Read
      .addCase(markNotificationAsRead.fulfilled, (state, action) => {
        // Update the notification's read status
        const notification = state.notifications.find(n => n.id === action.payload.id);
        if (notification) {
          notification.is_read = true;

          // Re-sort: move read notifications below unread ones
          state.notifications.sort((a, b) => {
            if (a.is_read !== b.is_read) {
              return a.is_read ? 1 : -1;
            }
            return new Date(b.created_at) - new Date(a.created_at);
          });
        }
        if (state.unreadCount > 0) {
          state.unreadCount -= 1;
        }
      })
      // Mark All as Read
      .addCase(markAllNotificationsAsRead.fulfilled, (state) => {
        state.notifications = state.notifications.map((n) => ({
          ...n,
          is_read: true,
        }));
        state.unreadCount = 0;
      })
      // Delete Notification
      .addCase(deleteNotification.fulfilled, (state, action) => {
        const deletedId = action.payload;
        const deletedNotification = state.notifications.find(
          (n) => n.id === deletedId
        );
        if (deletedNotification && !deletedNotification.is_read) {
          if (state.unreadCount > 0) {
            state.unreadCount -= 1;
          }
        }
        state.notifications = state.notifications.filter(
          (n) => n.id !== deletedId
        );
      })
      // Load More Notifications (Pagination)
      .addCase(loadMoreNotifications.pending, (state) => {
        state.loadingMore = true;
        state.error = null;
      })
      .addCase(loadMoreNotifications.fulfilled, (state, action) => {
        state.loadingMore = false;
        // Append new notifications to existing list
        let newNotifications = [];
        if (action.payload.results) {
          newNotifications = action.payload.results;
          state.pagination = {
            count: action.payload.count || 0,
            next: action.payload.next,
            previous: action.payload.previous,
            currentPage: state.pagination.currentPage + 1,
          };
        } else {
          newNotifications = Array.isArray(action.payload) ? action.payload : [];
        }
        
        // Deduplicate: filter out notifications that already exist
        const existingIds = new Set(state.notifications.map(n => n.id));
        const uniqueNewNotifications = newNotifications.filter(
          n => !existingIds.has(n.id)
        );
        
        console.log('[NotificationSlice] Loading more notifications:', {
          existing: state.notifications.length,
          new: newNotifications.length,
          unique: uniqueNewNotifications.length,
          duplicates: newNotifications.length - uniqueNewNotifications.length,
          hasNext: !!action.payload.next,
          totalCount: action.payload.count
        });
        
        // Append unique notifications
        state.notifications = [...state.notifications, ...uniqueNewNotifications];
      })
      .addCase(loadMoreNotifications.rejected, (state, action) => {
        state.loadingMore = false;
        state.error = action.payload;
      });
  },
});

export const { clearNotifications, incrementUnreadCount, decrementUnreadCount } =
  notificationSlice.actions;
export default notificationSlice.reducer;
