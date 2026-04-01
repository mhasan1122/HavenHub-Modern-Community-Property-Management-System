import { createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../../../utils/axiosInstance";

// Get all announcements with optional filters
export const fetchAnnouncements = createAsyncThunk(
  "announcements/fetchAll",
  async (params = {}, thunkAPI) => {
    try {
      const response = await axiosInstance.get('/api/announcements/', { params });

      // Handle both paginated and direct array responses
      const announcementsData = response.data.results || response.data;

      // Transform API response to match frontend structure if needed
      const transformedAnnouncements = Array.isArray(announcementsData)
        ? announcementsData.map((announcement) => ({
            id: announcement.id,
            title: announcement.title,
            description: announcement.description,
            author: announcement.post_as === "group"
              ? announcement.group_name || "Unknown Group"
              : announcement.post_as === "member"
              ? announcement.member_name || "Unknown Member"
              : announcement.creator_name || "Unknown Author",
            creatorName: announcement.creator_name,
            priority: announcement.priority,
            label: announcement.label || "",
            startDate: announcement.start_date,
            startTime: announcement.start_time,
            endDate: announcement.end_date,
            endTime: announcement.end_time,
            status: announcement.status,
            views: announcement.views || 0,
            pinned: announcement.is_pinned || false,
            isPinned: announcement.is_pinned || false,
            manuallyExpired: announcement.manually_expired || false,
            createdAt: announcement.created_at,
            updatedAt: announcement.updated_at,
            attachments: announcement.attachments || [],
            postAs: announcement.post_as || "creator",
            postedGroupName: announcement.group_name,
            postedMemberName: announcement.member_name,
            // Include target units and towers data for user count calculation
            target_units_data: announcement.target_units_data || [],
            target_towers_data: announcement.target_towers_data || [],
            editHistory: announcement.history
              ? announcement.history.map((historyEntry) => ({
                  editedBy: historyEntry.edited_by_name || "Unknown User",
                  timestamp: historyEntry.edited_at,
                  changes: historyEntry.changes || {}
                }))
              : []
          }))
        : [];

      return transformedAnnouncements;
    } catch (error) {
      console.error('Error fetching announcements:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Get single announcement by ID
export const fetchAnnouncementById = createAsyncThunk(
  "announcements/fetchById",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.get(`/api/announcements/${id}/`);

      // Transform the response to match the same structure as fetchAnnouncements
      const announcement = response.data;
      const transformedAnnouncement = {
        id: announcement.id,
        title: announcement.title,
        description: announcement.description,
        author: announcement.post_as === "group"
          ? announcement.group_name || "Unknown Group"
          : announcement.post_as === "member"
          ? announcement.member_name || "Unknown Member"
          : announcement.creator_name || "Unknown Author",
        creatorName: announcement.creator_name,
        priority: announcement.priority,
        label: announcement.label || "",
        startDate: announcement.start_date,
        startTime: announcement.start_time,
        endDate: announcement.end_date,
        endTime: announcement.end_time,
        status: announcement.status,
        views: announcement.views || 0,
        pinned: announcement.is_pinned || false,
        isPinned: announcement.is_pinned || false,
        manuallyExpired: announcement.manually_expired || false,
        createdAt: announcement.created_at,
        updatedAt: announcement.updated_at,
        attachments: announcement.attachments || [],
        postAs: announcement.post_as || "creator",
        postedGroupName: announcement.group_name,
        postedMemberName: announcement.member_name,
        editHistory: announcement.history
          ? announcement.history.map((historyEntry) => ({
              editedBy: historyEntry.edited_by_name || "Unknown User",
              timestamp: historyEntry.edited_at,
              changes: historyEntry.changes || {}
            }))
          : [],
        // Include additional fields that might be needed for editing
        creator_name: announcement.creator_name,
        posted_member: announcement.posted_member,
        member_name: announcement.member_name,
        posted_group: announcement.posted_group,
        group_name: announcement.group_name,
        target_towers_data: announcement.target_towers_data || [],
        target_units_data: announcement.target_units_data || [],
        start_date: announcement.start_date,
        start_time: announcement.start_time,
        end_date: announcement.end_date,
        end_time: announcement.end_time,
        post_as: announcement.post_as
      };

      return transformedAnnouncement;
    } catch (error) {
      console.error('Error fetching announcement:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Create new announcement
export const createAnnouncement = createAsyncThunk(
  "announcements/create",
  async (data, thunkAPI) => {
    try {
      const response = await axiosInstance.post('/api/announcements/', data);

      // Transform the response to match the same structure as fetchAnnouncements
      const announcement = response.data;
      const transformedAnnouncement = {
        id: announcement.id,
        title: announcement.title,
        description: announcement.description,
        author: announcement.post_as === "group"
          ? announcement.group_name || "Unknown Group"
          : announcement.post_as === "member"
          ? announcement.member_name || "Unknown Member"
          : announcement.creator_name || "Unknown Author",
        creatorName: announcement.creator_name,
        priority: announcement.priority,
        label: announcement.label || "",
        startDate: announcement.start_date,
        startTime: announcement.start_time,
        endDate: announcement.end_date,
        endTime: announcement.end_time,
        status: announcement.status,
        views: announcement.views || 0,
        pinned: announcement.is_pinned || false,
        isPinned: announcement.is_pinned || false,
        manuallyExpired: announcement.manually_expired || false,
        createdAt: announcement.created_at,
        updatedAt: announcement.updated_at,
        attachments: announcement.attachments || [],
        postAs: announcement.post_as || "creator",
        postedGroupName: announcement.group_name,
        postedMemberName: announcement.member_name,
        // Include target units and towers data for user count calculation
        target_units_data: announcement.target_units_data || [],
        target_towers_data: announcement.target_towers_data || [],
        editHistory: announcement.history
          ? announcement.history.map((historyEntry) => ({
              editedBy: historyEntry.edited_by_name || "Unknown User",
              timestamp: historyEntry.edited_at,
              changes: historyEntry.changes || {}
            }))
          : []
      };

      return transformedAnnouncement;
    } catch (error) {
      console.error('Error creating announcement:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Update existing announcement
export const updateAnnouncement = createAsyncThunk(
  "announcements/update",
  async ({ id, data }, thunkAPI) => {
    try {
      const response = await axiosInstance.patch(`/api/announcements/${id}/`, data);

      // Transform the response to match the same structure as fetchAnnouncements
      const announcement = response.data;
      const transformedAnnouncement = {
        id: announcement.id,
        title: announcement.title,
        description: announcement.description,
        author: announcement.post_as === "group"
          ? announcement.group_name || "Unknown Group"
          : announcement.post_as === "member"
          ? announcement.member_name || "Unknown Member"
          : announcement.creator_name || "Unknown Author",
        creatorName: announcement.creator_name,
        priority: announcement.priority,
        label: announcement.label || "",
        startDate: announcement.start_date,
        startTime: announcement.start_time,
        endDate: announcement.end_date,
        endTime: announcement.end_time,
        status: announcement.status,
        views: announcement.views || 0,
        pinned: announcement.is_pinned || false,
        isPinned: announcement.is_pinned || false,
        manuallyExpired: announcement.manually_expired || false,
        createdAt: announcement.created_at,
        updatedAt: announcement.updated_at,
        attachments: announcement.attachments || [],
        postAs: announcement.post_as || "creator",
        postedGroupName: announcement.group_name,
        postedMemberName: announcement.member_name,
        editHistory: announcement.history
          ? announcement.history.map((historyEntry) => ({
              editedBy: historyEntry.edited_by_name || "Unknown User",
              timestamp: historyEntry.edited_at,
              changes: historyEntry.changes || {}
            }))
          : [],
        // Include additional fields that might be needed for editing
        creator_name: announcement.creator_name,
        posted_member: announcement.posted_member,
        member_name: announcement.member_name,
        posted_group: announcement.posted_group,
        group_name: announcement.group_name,
        target_towers_data: announcement.target_towers_data || [],
        target_units_data: announcement.target_units_data || [],
        start_date: announcement.start_date,
        start_time: announcement.start_time,
        end_date: announcement.end_date,
        end_time: announcement.end_time,
        post_as: announcement.post_as
      };

      return transformedAnnouncement;
    } catch (error) {
      console.error('Error updating announcement:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Delete announcement
export const deleteAnnouncement = createAsyncThunk(
  "announcements/delete",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.delete(`/api/announcements/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error deleting announcement:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Toggle pin announcement (replaces separate pin/unpin)
export const togglePinAnnouncement = createAsyncThunk(
  "announcements/togglePin",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/announcements/${id}/toggle_pin/`);
      // Return the announcement ID and new pin status for state update
      return {
        id: id,
        is_pinned: response.data.is_pinned,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error toggling pin announcement:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Keep legacy pin/unpin functions for backward compatibility
export const pinAnnouncement = createAsyncThunk(
  "announcements/pin",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/announcements/${id}/toggle_pin/`);
      return response.data;
    } catch (error) {
      console.error('Error pinning announcement:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Unpin announcement
export const unpinAnnouncement = createAsyncThunk(
  "announcements/unpin",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/announcements/${id}/toggle_pin/`);
      return response.data;
    } catch (error) {
      console.error('Error unpinning announcement:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Move announcement to expired
export const moveToExpired = createAsyncThunk(
  "announcements/moveToExpired",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/announcements/${id}/force_expire/`);
      // Return the announcement ID and new status for state update
      return {
        id: id,
        status: 'expired',
        manually_expired: true,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error moving announcement to expired:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Increment views
export const incrementViews = createAsyncThunk(
  "announcements/incrementViews",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/announcements/${id}/increment_views/`);
      return response.data;
    } catch (error) {
      console.error('Error incrementing views:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Restore expired announcement
export const restoreAnnouncement = createAsyncThunk(
  "announcements/restore",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/announcements/${id}/restore/`);
      // Return the announcement ID and new status for state update
      return {
        id: id,
        status: response.data.status,
        manually_expired: false,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error restoring announcement:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Update all announcement statuses
export const updateAnnouncementStatuses = createAsyncThunk(
  "announcements/updateStatuses",
  async (_, thunkAPI) => {
    try {
      const response = await axiosInstance.post('/api/announcements/update_statuses/');
      return response.data;
    } catch (error) {
      console.error('Error updating statuses:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch towers
export const fetchTowers = createAsyncThunk(
  "towers/fetchAll",
  async (_, thunkAPI) => {
    try {
      const response = await axiosInstance.get('/api/towers/');
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

      const url = queryParam ? `/api/units/?tower_ids=${queryParam}` : '/api/units/';
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
  async ({ announcementId, file }, thunkAPI) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('announcement', announcementId);

      const response = await axiosInstance.post('/api/attachments/', formData, {
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
      const response = await axiosInstance.delete(`/api/attachments/${id}/`);
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
      const response = await axiosInstance.get('/api/announcements/labels/');
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
      const response = await axiosInstance.post('/api/bulk-user-count/', {
        unit_ids: unitIds
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching bulk user count:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);
