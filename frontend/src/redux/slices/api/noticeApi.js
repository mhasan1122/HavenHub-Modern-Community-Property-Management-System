import { createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../../../utils/axiosInstance";

// Get all notices with optional filters
export const fetchNotices = createAsyncThunk(
  "notices/fetchAll",
  async (params = {}, thunkAPI) => {
    try {
      const response = await axiosInstance.get('/api/noticeboard/notices/', { params });

      // Handle both paginated and direct array responses
      const noticesData = response.data.results || response.data;

      // Transform API response to match frontend structure if needed
      const transformedNotices = Array.isArray(noticesData)
        ? noticesData.map((notice) => ({
            id: notice.id,
            title: notice.title,
            description: notice.description,
            internalTitle: notice.internal_title,
            author: notice.post_as === "group"
              ? notice.group_name || "Unknown Group"
              : notice.post_as === "member"
              ? notice.member_name || "Unknown Member"
              : notice.creator_name || "Unknown Author",
            creatorName: notice.creator_name,
            priority: notice.priority,
            label: notice.label || "",
            startDate: notice.start_date,
            startTime: notice.start_time,
            endDate: notice.end_date,
            endTime: notice.end_time,
            status: notice.status,
            views: notice.views || 0,
            pinned: notice.is_pinned || false,
            isPinned: notice.is_pinned || false,
            manuallyExpired: notice.manually_expired || false,
            createdAt: notice.created_at,
            updatedAt: notice.updated_at,
            attachments: notice.attachments || [],
            postAs: notice.post_as || "creator",
            postedGroupName: notice.group_name,
            postedMemberName: notice.member_name,
            // Include target units and towers data for user count calculation
            target_units_data: notice.target_units_data || [],
            target_towers_data: notice.target_towers_data || [],
            editHistory: notice.history
              ? notice.history.map((historyEntry) => ({
                  editedBy: historyEntry.edited_by_name || "Unknown User",
                  timestamp: historyEntry.edited_at,
                  changes: historyEntry.changes || {}
                }))
              : []
          }))
        : [];

      return transformedNotices;
    } catch (error) {
      console.error('Error fetching notices:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Get single notice by ID
export const fetchNoticeById = createAsyncThunk(
  "notices/fetchById",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.get(`/api/noticeboard/notices/${id}/`);

      // Transform the response to match the same structure as fetchNotices
      const notice = response.data;
      const transformedNotice = {
        id: notice.id,
        title: notice.title,
        description: notice.description,
        internalTitle: notice.internal_title,
        author: notice.post_as === "group"
          ? notice.group_name || "Unknown Group"
          : notice.post_as === "member"
          ? notice.member_name || "Unknown Member"
          : notice.creator_name || "Unknown Author",
        creatorName: notice.creator_name,
        priority: notice.priority,
        label: notice.label || "",
        startDate: notice.start_date,
        startTime: notice.start_time,
        endDate: notice.end_date,
        endTime: notice.end_time,
        status: notice.status,
        views: notice.views || 0,
        pinned: notice.is_pinned || false,
        isPinned: notice.is_pinned || false,
        manuallyExpired: notice.manually_expired || false,
        createdAt: notice.created_at,
        updatedAt: notice.updated_at,
        attachments: notice.attachments || [],
        postAs: notice.post_as || "creator",
        postedGroupName: notice.group_name,
        postedMemberName: notice.member_name,
        editHistory: notice.history
          ? notice.history.map((historyEntry) => ({
              editedBy: historyEntry.edited_by_name || "Unknown User",
              timestamp: historyEntry.edited_at,
              changes: historyEntry.changes || {}
            }))
          : [],
        // Include additional fields that might be needed for editing
        creator_name: notice.creator_name,
        posted_member: notice.posted_member,
        member_name: notice.member_name,
        posted_group: notice.posted_group,
        group_name: notice.group_name,
        target_towers_data: notice.target_towers_data || [],
        target_units_data: notice.target_units_data || [],
        start_date: notice.start_date,
        start_time: notice.start_time,
        end_date: notice.end_date,
        end_time: notice.end_time,
        post_as: notice.post_as
      };

      return transformedNotice;
    } catch (error) {
      console.error('Error fetching notice:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Create new notice
export const createNotice = createAsyncThunk(
  "notices/create",
  async (data, thunkAPI) => {
    try {
      const response = await axiosInstance.post('/api/noticeboard/notices/', data);

      // Transform the response to match the same structure as fetchNotices
      const notice = response.data;
      const transformedNotice = {
        id: notice.id,
        title: notice.title,
        description: notice.description,
        internalTitle: notice.internal_title,
        author: notice.post_as === "group"
          ? notice.group_name || "Unknown Group"
          : notice.post_as === "member"
          ? notice.member_name || "Unknown Member"
          : notice.creator_name || "Unknown Author",
        creatorName: notice.creator_name,
        priority: notice.priority,
        label: notice.label || "",
        startDate: notice.start_date,
        startTime: notice.start_time,
        endDate: notice.end_date,
        endTime: notice.end_time,
        status: notice.status,
        views: notice.views || 0,
        pinned: notice.is_pinned || false,
        isPinned: notice.is_pinned || false,
        manuallyExpired: notice.manually_expired || false,
        createdAt: notice.created_at,
        updatedAt: notice.updated_at,
        attachments: notice.attachments || [],
        postAs: notice.post_as || "creator",
        postedGroupName: notice.group_name,
        postedMemberName: notice.member_name,
        // Include target units and towers data for user count calculation
        target_units_data: notice.target_units_data || [],
        target_towers_data: notice.target_towers_data || [],
        editHistory: notice.history
          ? notice.history.map((historyEntry) => ({
              editedBy: historyEntry.edited_by_name || "Unknown User",
              timestamp: historyEntry.edited_at,
              changes: historyEntry.changes || {}
            }))
          : []
      };

      return transformedNotice;
    } catch (error) {
      console.error('Error creating notice:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Update existing notice
export const updateNotice = createAsyncThunk(
  "notices/update",
  async ({ id, data }, thunkAPI) => {
    try {
      const response = await axiosInstance.patch(`/api/noticeboard/notices/${id}/`, data);

      // Transform the response to match the same structure as fetchNotices
      const notice = response.data;
      const transformedNotice = {
        id: notice.id,
        title: notice.title,
        description: notice.description,
        internalTitle: notice.internal_title,
        author: notice.post_as === "group"
          ? notice.group_name || "Unknown Group"
          : notice.post_as === "member"
          ? notice.member_name || "Unknown Member"
          : notice.creator_name || "Unknown Author",
        creatorName: notice.creator_name,
        priority: notice.priority,
        label: notice.label || "",
        startDate: notice.start_date,
        startTime: notice.start_time,
        endDate: notice.end_date,
        endTime: notice.end_time,
        status: notice.status,
        views: notice.views || 0,
        pinned: notice.is_pinned || false,
        isPinned: notice.is_pinned || false,
        manuallyExpired: notice.manually_expired || false,
        createdAt: notice.created_at,
        updatedAt: notice.updated_at,
        attachments: notice.attachments || [],
        postAs: notice.post_as || "creator",
        postedGroupName: notice.group_name,
        postedMemberName: notice.member_name,
        editHistory: notice.history
          ? notice.history.map((historyEntry) => ({
              editedBy: historyEntry.edited_by_name || "Unknown User",
              timestamp: historyEntry.edited_at,
              changes: historyEntry.changes || {}
            }))
          : [],
        // Include additional fields that might be needed for editing
        creator_name: notice.creator_name,
        posted_member: notice.posted_member,
        member_name: notice.member_name,
        posted_group: notice.posted_group,
        group_name: notice.group_name,
        target_towers_data: notice.target_towers_data || [],
        target_units_data: notice.target_units_data || [],
        start_date: notice.start_date,
        start_time: notice.start_time,
        end_date: notice.end_date,
        end_time: notice.end_time,
        post_as: notice.post_as
      };

      return transformedNotice;
    } catch (error) {
      console.error('Error updating notice:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Delete notice
export const deleteNotice = createAsyncThunk(
  "notices/delete",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.delete(`/api/noticeboard/notices/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error deleting notice:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Toggle pin notice
export const togglePinNotice = createAsyncThunk(
  "notices/togglePin",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/noticeboard/notices/${id}/toggle_pin/`);
      // Return the notice ID and new pin status for state update
      return {
        id: id,
        is_pinned: response.data.is_pinned,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error toggling pin notice:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Keep legacy pin/unpin functions for backward compatibility
export const pinNotice = createAsyncThunk(
  "notices/pin",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/noticeboard/notices/${id}/toggle_pin/`);
      return response.data;
    } catch (error) {
      console.error('Error pinning notice:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Unpin notice
export const unpinNotice = createAsyncThunk(
  "notices/unpin",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/noticeboard/notices/${id}/toggle_pin/`);
      return response.data;
    } catch (error) {
      console.error('Error unpinning notice:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Move notice to expired
export const moveToExpired = createAsyncThunk(
  "notices/moveToExpired",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/noticeboard/notices/${id}/force_expire/`);
      // Return the notice ID and new status for state update
      return {
        id: id,
        status: 'expired',
        manually_expired: true,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error moving notice to expired:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Increment views
export const incrementViews = createAsyncThunk(
  "notices/incrementViews",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/noticeboard/notices/${id}/increment_views/`);
      return response.data;
    } catch (error) {
      console.error('Error incrementing views:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Restore expired notice
export const restoreNotice = createAsyncThunk(
  "notices/restore",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/noticeboard/notices/${id}/restore/`);
      // Return the notice ID and new status for state update
      return {
        id: id,
        status: response.data.status,
        manually_expired: false,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error restoring notice:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Update all notice statuses
export const updateNoticeStatuses = createAsyncThunk(
  "notices/updateStatuses",
  async (_, thunkAPI) => {
    try {
      const response = await axiosInstance.post('/api/noticeboard/notices/update_statuses/');
      return response.data;
    } catch (error) {
      console.error('Error updating statuses:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch towers (reuse from announcements)
export const fetchTowers = createAsyncThunk(
  "towers/fetchAll",
  async (_, thunkAPI) => {
    try {
      const response = await axiosInstance.get('/api/noticeboard/towers/');
      // Always return a flat array
      const towersData = response.data.results || response.data;
      return towersData;
    } catch (error) {
      console.error('Error fetching towers:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch units by tower(s) - supports single tower ID, array of IDs, or comma-separated string
export const fetchUnitsByTower = createAsyncThunk(
  "units/fetchByTower",
  async (towerIds, thunkAPI) => {
    try {
      let queryParam = '';

      if (towerIds) {
        // Handle different input formats
        if (Array.isArray(towerIds)) {
          // Array of tower IDs
          queryParam = towerIds.filter(id => id && id !== 'All').join(',');
        } else if (typeof towerIds === 'string') {
          // Single tower ID or comma-separated string
          queryParam = towerIds;
        } else {
          // Single tower ID (number)
          queryParam = towerIds.toString();
        }
      }

      const url = queryParam ? `/api/noticeboard/units/?tower_ids=${queryParam}` : '/api/noticeboard/units/';
      const response = await axiosInstance.get(url);

      // Always return a flat array
      const unitsData = response.data.results || response.data;
      return unitsData;
    } catch (error) {
      console.error('Error fetching units:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Upload attachment
export const uploadAttachment = createAsyncThunk(
  "attachments/upload",
  async ({ noticeId, file }, thunkAPI) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('notice', noticeId);

      const response = await axiosInstance.post('/api/noticeboard/attachments/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading attachment:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Delete attachment
export const deleteAttachment = createAsyncThunk(
  "attachments/delete",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.delete(`/api/noticeboard/attachments/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error deleting attachment:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch labels
export const fetchLabels = createAsyncThunk(
  "labels/fetchAll",
  async (_, thunkAPI) => {
    try {
      const response = await axiosInstance.get('/api/noticeboard/notice-labels/');
      // Always return a flat array
      const labelsData = response.data.results || response.data;
      return labelsData;
    } catch (error) {
      console.error('Error fetching labels:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch bulk user counts for multiple units
export const fetchBulkUserCount = createAsyncThunk(
  "userCount/fetchBulk",
  async (unitIds, thunkAPI) => {
    try {
      const response = await axiosInstance.post('/api/noticeboard/bulk-user-count/', {
        unit_ids: unitIds
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching bulk user count:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);
