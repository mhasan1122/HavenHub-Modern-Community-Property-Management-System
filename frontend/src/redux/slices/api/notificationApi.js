import { createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../../../utils/axiosInstance";

// Fetch all notifications for the current user
export const fetchNotifications = createAsyncThunk(
  "notifications/fetchAll",
  async (params = {}, thunkAPI) => {
    try {
      console.log('[NotificationAPI] Fetching notifications with params:', params);
      // Add client_type=web for frontend requests
      const requestParams = { ...params, client_type: 'web' };
      const response = await axiosInstance.get('/api/notifications/', { params: requestParams });
      console.log('[NotificationAPI] Received response:', {
        hasResults: !!response.data.results,
        resultsCount: response.data.results?.length || response.data.length || 0,
        isArray: Array.isArray(response.data),
        data: response.data
      });
      return response.data;
    } catch (error) {
      console.error('[NotificationAPI] Error fetching notifications:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch unread notification count
export const fetchUnreadCount = createAsyncThunk(
  "notifications/fetchUnreadCount",
  async (_, thunkAPI) => {
    try {
      const response = await axiosInstance.get('/api/notifications/unread-count/', {
        params: { client_type: 'web' }
      });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Mark notification as read
export const markNotificationAsRead = createAsyncThunk(
  "notifications/markAsRead",
  async (notificationId, thunkAPI) => {
    try {
      const response = await axiosInstance.patch(`/api/notifications/${notificationId}/`, {
        is_read: true
      });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Mark all notifications as read
export const markAllNotificationsAsRead = createAsyncThunk(
  "notifications/markAllAsRead",
  async (_, thunkAPI) => {
    try {
      const response = await axiosInstance.post('/api/notifications/mark-all-read/', {}, {
        params: { client_type: 'web' }
      });
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Delete notification
export const deleteNotification = createAsyncThunk(
  "notifications/delete",
  async (notificationId, thunkAPI) => {
    try {
      await axiosInstance.delete(`/api/notifications/${notificationId}/`);
      return notificationId;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Load more notifications (for pagination)
export const loadMoreNotifications = createAsyncThunk(
  "notifications/loadMore",
  async (params = {}, thunkAPI) => {
    try {
      console.log('[NotificationAPI] Loading more notifications with params:', params);
      // Add client_type=web for frontend requests
      const requestParams = { ...params, client_type: 'web' };
      const response = await axiosInstance.get('/api/notifications/', { params: requestParams });
      console.log('[NotificationAPI] Loaded more notifications:', {
        resultsCount: response.data.results?.length || 0,
        next: response.data.next,
        count: response.data.count
      });
      return response.data;
    } catch (error) {
      console.error('[NotificationAPI] Error loading more notifications:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);
