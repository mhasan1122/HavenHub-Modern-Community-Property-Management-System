import { createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../../../utils/axiosInstance";

// Get all bulletins with optional filters
export const fetchBulletins = createAsyncThunk(
  "bulletins/fetchAll",
  async (params = {}, thunkAPI) => {
    try {
      const response = await axiosInstance.get('/api/bulletins/', { params });

      // Handle both paginated and direct array responses
      const bulletinsData = response.data.results || response.data;
      
      // Transform bulletins to match frontend structure
      const transformedBulletins = bulletinsData.map(bulletin => ({
        ...bulletin,
        // Set author field based on post_as value (same logic as announcements)
        author: bulletin.post_as === "group"
          ? bulletin.group_name || "Unknown Group"
          : bulletin.post_as === "member"
          ? bulletin.member_name || "Unknown Member"
          : bulletin.creator_name || "Unknown Author",
        creatorName: bulletin.creator_name,
        // Explicitly pass through group_name and member_name
        group_name: bulletin.group_name,
        member_name: bulletin.member_name,
        // Add camelCase postAs field for frontend compatibility
        postAs: bulletin.post_as,
        attachments: bulletin.attachments?.map(attachment => ({
          ...attachment,
          file_url: attachment.file_url || attachment.file,
          type: attachment.file_type || attachment.type,
          name: attachment.file_name || attachment.name,
          url: attachment.file_url || attachment.url || attachment.file
        })) || []
      }));

      return transformedBulletins;
    } catch (error) {
      console.error('Error fetching bulletins:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Get bulletin by ID
export const fetchBulletinById = createAsyncThunk(
  "bulletins/fetchById",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.get(`/api/bulletins/${id}/`);
      
      // Transform the bulletin data
      const transformedBulletin = {
        ...response.data,
        // Set author field based on post_as value (same logic as announcements)
        author: response.data.post_as === "group"
          ? response.data.group_name || "Unknown Group"
          : response.data.post_as === "member"
          ? response.data.member_name || "Unknown Member"
          : response.data.creator_name || "Unknown Author",
        creatorName: response.data.creator_name,
        // Explicitly pass through group_name and member_name
        group_name: response.data.group_name,
        member_name: response.data.member_name,
        // Add camelCase postAs field for frontend compatibility
        postAs: response.data.post_as,
        attachments: response.data.attachments?.map(attachment => ({
          ...attachment,
          file_url: attachment.file_url || attachment.file,
          type: attachment.file_type || attachment.type,
          name: attachment.file_name || attachment.name,
          url: attachment.file_url || attachment.url || attachment.file
        })) || [],
        history: response.data.history?.map(historyEntry => ({
          ...historyEntry,
          changes: historyEntry.changes || {}
        })) || [],
        editHistory: response.data.history?.map(historyEntry => ({
          editedBy: historyEntry.edited_by_name || "Unknown User",
          timestamp: historyEntry.edited_at,
          changes: historyEntry.changes || {}
        })) || []
      };

      return transformedBulletin;
    } catch (error) {
      console.error('Error fetching bulletin:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Create new bulletin
export const createBulletin = createAsyncThunk(
  "bulletins/create",
  async (data, thunkAPI) => {
    try {
      const response = await axiosInstance.post('/api/bulletins/', data);
      
      // Transform the response data
      const transformedBulletin = {
        ...response.data,
        // Set author field based on post_as value (same logic as announcements)
        author: response.data.post_as === "group"
          ? response.data.group_name || "Unknown Group"
          : response.data.post_as === "member"
          ? response.data.member_name || "Unknown Member"
          : response.data.creator_name || "Unknown Author",
        creatorName: response.data.creator_name,
        // Add camelCase postAs field for frontend compatibility
        postAs: response.data.post_as,
        attachments: response.data.attachments?.map(attachment => ({
          ...attachment,
          file_url: attachment.file_url || attachment.file,
          type: attachment.file_type || attachment.type,
          name: attachment.file_name || attachment.name,
          url: attachment.file_url || attachment.url || attachment.file
        })) || [],
        history: response.data.history?.map(historyEntry => ({
          ...historyEntry,
          changes: historyEntry.changes || {}
        })) || [],
        editHistory: response.data.history?.map(historyEntry => ({
          editedBy: historyEntry.edited_by_name || "Unknown User",
          timestamp: historyEntry.edited_at,
          changes: historyEntry.changes || {}
        })) || []
      };

      return transformedBulletin;
    } catch (error) {
      console.error('Error creating bulletin:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Update existing bulletin
export const updateBulletin = createAsyncThunk(
  "bulletins/update",
  async ({ id, data }, thunkAPI) => {
    try {
      const response = await axiosInstance.patch(`/api/bulletins/${id}/`, data);
      
      // Transform the response data
      const transformedBulletin = {
        ...response.data,
        // Set author field based on post_as value (same logic as announcements)
        author: response.data.post_as === "group"
          ? response.data.group_name || "Unknown Group"
          : response.data.post_as === "member"
          ? response.data.member_name || "Unknown Member"
          : response.data.creator_name || "Unknown Author",
        creatorName: response.data.creator_name,
        // Add camelCase postAs field for frontend compatibility
        postAs: response.data.post_as,
        attachments: response.data.attachments?.map(attachment => ({
          ...attachment,
          file_url: attachment.file_url || attachment.file,
          type: attachment.file_type || attachment.type,
          name: attachment.file_name || attachment.name,
          url: attachment.file_url || attachment.url || attachment.file
        })) || [],
        history: response.data.history?.map(historyEntry => ({
          ...historyEntry,
          changes: historyEntry.changes || {}
        })) || [],
        editHistory: response.data.history?.map(historyEntry => ({
          editedBy: historyEntry.edited_by_name || "Unknown User",
          timestamp: historyEntry.edited_at,
          changes: historyEntry.changes || {}
        })) || []
      };

      return transformedBulletin;
    } catch (error) {
      console.error('Error updating bulletin:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Delete bulletin
export const deleteBulletin = createAsyncThunk(
  "bulletins/delete",
  async (id, thunkAPI) => {
    try {
      await axiosInstance.delete(`/api/bulletins/${id}/`);
      return id;
    } catch (error) {
      console.error('Error deleting bulletin:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Pin/Unpin bulletin
export const pinBulletin = createAsyncThunk(
  "bulletins/pin",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/bulletins/${id}/toggle_pin/`);
      return {
        id: id,
        is_pinned: response.data.is_pinned,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error pinning bulletin:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const unpinBulletin = createAsyncThunk(
  "bulletins/unpin",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/bulletins/${id}/toggle_pin/`);
      return {
        id: id,
        is_pinned: response.data.is_pinned,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error unpinning bulletin:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const togglePinBulletin = createAsyncThunk(
  "bulletins/togglePin",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/bulletins/${id}/toggle_pin/`);
      return {
        id: id,
        is_pinned: response.data.is_pinned,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error toggling pin bulletin:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Approve bulletin
export const approveBulletin = createAsyncThunk(
  "bulletins/approve",
  async ({ id, comment }, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/bulletins/${id}/approve/`, { comment });
      return {
        id: id,
        status: response.data.status,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error approving bulletin:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Reject bulletin
export const rejectBulletin = createAsyncThunk(
  "bulletins/reject",
  async ({ id, comment }, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/bulletins/${id}/reject/`, { comment });
      return {
        id: id,
        status: response.data.status,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error rejecting bulletin:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Add comment to bulletin
export const addCommentToBulletin = createAsyncThunk(
  "bulletins/addComment",
  async ({ id, comment }, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/bulletins/${id}/add_comment/`, { comment });
      return {
        id: id,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error adding comment to bulletin:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Move bulletin to archive
export const moveToArchive = createAsyncThunk(
  "bulletins/moveToArchive",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/bulletins/${id}/move_to_archive/`);
      return {
        id: id,
        status: response.data.status,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error moving bulletin to archive:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Increment views
export const incrementViews = createAsyncThunk(
  "bulletins/incrementViews",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/bulletins/${id}/increment_views/`);
      return response.data;
    } catch (error) {
      console.error('Error incrementing views:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Restore archived bulletin
export const restoreBulletin = createAsyncThunk(
  "bulletins/restore",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.post(`/api/bulletins/${id}/restore/`);
      return {
        id: id,
        status: response.data.status,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error restoring bulletin:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch towers (reuse from announcements)
export const fetchTowers = createAsyncThunk(
  "bulletins/fetchTowers",
  async (_, thunkAPI) => {
    try {
      const response = await axiosInstance.get('/api/towers/');
      return response.data;
    } catch (error) {
      console.error('Error fetching towers:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch units by tower
export const fetchUnitsByTower = createAsyncThunk(
  "bulletins/fetchUnitsByTower",
  async (towerIds, thunkAPI) => {
    try {
      const towerIdsParam = Array.isArray(towerIds) ? towerIds.join(',') : towerIds;
      const response = await axiosInstance.get(`/api/units/?tower_ids=${towerIdsParam}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching units:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Upload attachment
export const uploadAttachment = createAsyncThunk(
  "bulletins/uploadAttachment",
  async (data, thunkAPI) => {
    try {
      const response = await axiosInstance.post('/api/bulletin-attachments/', data);
      return response.data;
    } catch (error) {
      console.error('Error uploading attachment:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Delete attachment
export const deleteAttachment = createAsyncThunk(
  "bulletins/deleteAttachment",
  async (id, thunkAPI) => {
    try {
      await axiosInstance.delete(`/api/bulletin-attachments/${id}/`);
      return id;
    } catch (error) {
      console.error('Error deleting attachment:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch bulletin labels
export const fetchBulletinLabels = createAsyncThunk(
  "bulletinLabels/fetchAll",
  async (_, thunkAPI) => {
    try {
      const response = await axiosInstance.get('/api/bulletins/labels/');
      // Always return a flat array
      const labelsData = response.data.results || response.data;
      return labelsData;
    } catch (error) {
      console.error('Error fetching bulletin labels:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);
