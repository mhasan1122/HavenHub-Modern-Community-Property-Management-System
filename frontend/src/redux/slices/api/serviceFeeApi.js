import { createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../../../utils/axiosInstance";

// Get all service fees with optional filters
export const fetchServiceFees = createAsyncThunk(
  "serviceFees/fetchAll",
  async (params = {}, thunkAPI) => {
    try {
      const response = await axiosInstance.get('/api/service-fees/', { params });

      // Handle both paginated and direct array responses
      const serviceFeesData = response.data.data || response.data.results || response.data;
      return serviceFeesData;
    } catch (error) {
      console.error('Error fetching service fees:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Get single service fee by ID
export const fetchServiceFeeById = createAsyncThunk(
  "serviceFees/fetchById",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.get(`/api/service-fees/${id}/`);
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error fetching service fee:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Create new service fee
export const createServiceFee = createAsyncThunk(
  "serviceFees/create",
  async (serviceFeeData, thunkAPI) => {
    try {
      console.log('Sending service fee data:', serviceFeeData); // Debug log
      const response = await axiosInstance.post('/api/service-fees/', serviceFeeData);
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error creating service fee:', error);
      console.error('Error response:', error.response?.data); // Debug log
      console.error('Error status:', error.response?.status);
      console.error('Full error response:', error.response);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Update service fee
export const updateServiceFee = createAsyncThunk(
  "serviceFees/update",
  async ({ id, serviceFeeData }, thunkAPI) => {
    try {
      console.log('DEBUG: Updating service fee with ID:', id);
      console.log('DEBUG: Service fee data payload:', JSON.stringify(serviceFeeData, null, 2));
      const response = await axiosInstance.patch(`/api/service-fees/${id}/`, serviceFeeData);
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error updating service fee:', error);
      console.error('Full error response:', error.response);
      console.error('Error response data:', error.response?.data);
      console.error('Error response status:', error.response?.status);
      console.error('Error response headers:', error.response?.headers);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Delete service fee (soft delete)
export const deleteServiceFee = createAsyncThunk(
  "serviceFees/delete",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.delete(`/api/service-fees/${id}/`);
      return { id, message: response.data.message };
    } catch (error) {
      console.error('Error deleting service fee:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Permanently delete service fee from database (only for archived/cancelled service fees)
export const permanentlyDeleteServiceFee = createAsyncThunk(
  "serviceFees/permanentDelete",
  async (id, thunkAPI) => {
    try {
      const response = await axiosInstance.delete(`/api/service-fees/${id}/permanent-delete/`);
      return { id, message: response.data.message };
    } catch (error) {
      console.error('Error permanently deleting service fee:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Validate service fee data
export const validateServiceFee = createAsyncThunk(
  "serviceFees/validate",
  async (serviceFeeData, thunkAPI) => {
    try {
      const response = await axiosInstance.post('/api/service-fees/validate/', serviceFeeData);
      return response.data;
    } catch (error) {
      console.error('Error validating service fee:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch towers
export const fetchTowers = createAsyncThunk(
  "serviceFees/fetchTowers",
  async (_, thunkAPI) => {
    try {
      // Use service fee towers endpoint with proper permission checking
      // This endpoint supports both org and comm members with service fee view permission
      const response = await axiosInstance.get('/api/service-fees/towers/');
      // Handle response format - check for success wrapper
      const towersData = response.data.data || response.data.results || response.data;
      return Array.isArray(towersData) ? towersData : [];
    } catch (error) {
      console.error('Error fetching towers:', error);
      // Fallback: try community towers endpoint for backward compatibility
      try {
        const fallbackResponse = await axiosInstance.get('/towers/community_towers/');
        const towersData = fallbackResponse.data.results || fallbackResponse.data;
        return Array.isArray(towersData) ? towersData : [];
      } catch (fallbackError) {
        console.error('Fallback tower fetch also failed:', fallbackError);
        return thunkAPI.rejectWithValue(error.response?.data || error.message);
      }
    }
  }
);

// Fetch units by tower(s) - supports single tower ID, array of IDs, or comma-separated string
export const fetchUnitsByTower = createAsyncThunk(
  "serviceFees/fetchUnitsByTower",
  async (params, thunkAPI) => {
    try {
      let queryParam = '';
      let excludeServiceFeeId = null;
      let towerIds;

      // Handle different parameter formats
      if (typeof params === 'object' && params.towerIds !== undefined) {
        // Object format: { towerIds, excludeServiceFeeId }
        towerIds = params.towerIds;
        excludeServiceFeeId = params.excludeServiceFeeId;
      } else {
        // Legacy format: just towerIds
        towerIds = params;
      }

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

      // Prefer service-fees helper when specific towers are given; otherwise use community units
      let url = queryParam ? `/api/service-fees/tower-units/?tower_ids=${queryParam}` : '/towers/community_units/';

      // Add exclude_service_fee_id parameter if provided (for edit mode)
      if (excludeServiceFeeId) {
        url += url.includes('?') ? '&' : '?';
        url += `exclude_service_fee_id=${excludeServiceFeeId}`;
      }

      const response = await axiosInstance.get(url);

      // Always return a flat array
      const unitsData = response.data.data || response.data.results || response.data;
      return unitsData;
    } catch (error) {
      console.error('Error fetching units:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch all units
export const fetchAllUnits = createAsyncThunk(
  "serviceFees/fetchAllUnits",
  async (_, thunkAPI) => {
    try {
      // Use community units endpoint (auth-only)
      const response = await axiosInstance.get('/towers/community_units/');
      const unitsData = response.data.results || response.data;
      return unitsData;
    } catch (error) {
      console.error('Error fetching all units:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Get tower units for service fee helper endpoint
export const getTowerUnits = createAsyncThunk(
  "serviceFees/getTowerUnits",
  async (towerIds, thunkAPI) => {
    try {
      const towerIdsParam = Array.isArray(towerIds) ? towerIds.join(',') : towerIds;
      const response = await axiosInstance.get(`/api/service-fees/tower-units/?tower_ids=${towerIdsParam}`);
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error fetching tower units:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Fetch service fee history
export const fetchServiceFeeHistory = createAsyncThunk(
  "serviceFees/fetchHistory",
  async (serviceFeeId, thunkAPI) => {
    try {
      const response = await axiosInstance.get(`/api/service-fees/${serviceFeeId}/history/`);
      console.log('Service fee history response:', response.data); // Debug log
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error fetching service fee history:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);
