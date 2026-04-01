// src/redux/slices/roles/roleSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../../../utils/axiosInstance';
import qs from 'qs';
import { fetchHeadingData } from '../api/memberApi';

// Fetch all roles with optional filters.
export const fetchRoles = createAsyncThunk(
  'role/fetchRoles',
  async (filters, { rejectWithValue }) => {
    try {
      if (filters.search && filters.search.trim().length < 3) {
        filters.search = '';
      }
      const queryStr = qs.stringify(filters, { arrayFormat: 'repeat' });
      const url = queryStr ? `/group_role/role_list/?${queryStr}` : `/group_role/role_list/`;
      const response = await axiosInstance.get(url);
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response.data);
    }
  }
);

export const memberfetchRoles = createAsyncThunk(
  'role/memberfetchRoles',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/group_role/member_role_list/');
      // console.log('Backend Response data: ', response.data)
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response.data);
    }
  }
);

// Fetch the list of permissions.
export const fetchPermissions = createAsyncThunk(
  'role/fetchPermissions',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/group_role/permission_list/');
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response.data);
    }
  }
);

// Create a new role.
export const createRole = createAsyncThunk(
  'role/createRole',
  async (roleData, { dispatch, rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/group_role/create_role/', roleData);
      // refresh current user's permission_ids without importing auth slice (avoid circular deps)
      try {
        const res = await axiosInstance.get('/user/my_permissions/');
        dispatch({ type: 'auth/setUser', payload: { permission_ids: res.data?.permission_ids || [] }});
      } catch (e) {}
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response.data);
    }
  }
);

// Update an existing role.
export const updateRole = createAsyncThunk(
  'role/updateRole',
  async ({ id, roleData }, {dispatch, rejectWithValue }) => {
    try {
      const response = await axiosInstance.put(`/group_role/update_role/${id}/`, roleData);
      dispatch(fetchHeadingData());
      // refresh current user's permission_ids
      try {
        const res = await axiosInstance.get('/user/my_permissions/');
        dispatch({ type: 'auth/setUser', payload: { permission_ids: res.data?.permission_ids || [] }});
      } catch (e) {}
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response.data);
    }
  }
);

// Fetch details for a specific role.
export const fetchRoleDetails = createAsyncThunk(
  'role/fetchRoleDetails',
  async (roleId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/group_role/role_details/${roleId}/`);
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response.data);
    }
  }
);

// Toggle the status (active/inactive) for a role.
export const toggleRoleStatus = createAsyncThunk(
  'role/toggleRoleStatus',
  async (roleId, { dispatch, rejectWithValue }) => {
    try {
      const response = await axiosInstance.put(`/group_role/role_status/${roleId}/`);
      // refresh current user's permission_ids
      try {
        const res = await axiosInstance.get('/user/my_permissions/');
        dispatch({ type: 'auth/setUser', payload: { permission_ids: res.data?.permission_ids || [] }});
      } catch (e) {}
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response.data);
    }
  }
);

const roleSlice = createSlice({
  name: 'role',
  initialState: {
    roles: [],
    roleDetails: null,
    permissions: [],
    role: null,
    loading: false,
    error: null,
    successMessage: null,
    headingData: {
      full_name: "Member Name",
      roles: ["Member Role"],
      id: "N/A",
      photo_low_quality: "/admin.jpg",
    },
  },
  reducers: {
    clearMessages: (state) => {
      state.error = null;
      state.successMessage = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchPermissions reducers
      .addCase(fetchPermissions.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPermissions.fulfilled, (state, action) => {
        state.loading = false;
        state.permissions = action.payload;
      })
      .addCase(fetchPermissions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // fetchRoles reducers
      .addCase(fetchRoles.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.loading = false;
        state.roles = action.payload;
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(memberfetchRoles.pending, (state) => {
        state.loading = true;
      })
      .addCase(memberfetchRoles.fulfilled, (state, action) => {
        state.loading = false;
        state.roles = action.payload.filter(role => role.is_active);
      })
      .addCase(memberfetchRoles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // createRole reducers
      .addCase(createRole.pending, (state) => {
        state.loading = true;
      })
      .addCase(createRole.fulfilled, (state, action) => {
        state.loading = false;
        state.role = action.payload.data;
        state.successMessage = action.payload.message || 'Your new Role has been successfully added.';
      })
      .addCase(createRole.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // updateRole reducers
      .addCase(updateRole.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateRole.fulfilled, (state, action) => {
        state.loading = false;
        state.role = action.payload.data;
        state.successMessage = action.payload.message || 'Your Role has been successfully updated.';
      })
      .addCase(updateRole.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // fetchRoleDetails reducers
      .addCase(fetchRoleDetails.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchRoleDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.roleDetails = action.payload;
      })
      .addCase(fetchRoleDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // toggleRoleStatus reducers (Updated)
      .addCase(toggleRoleStatus.pending, (state) => {
        state.loading = true;
      })
      .addCase(toggleRoleStatus.fulfilled, (state, action) => {
        state.loading = false;
        // Update roleDetails directly with the response (since API returns serializer.data)
        state.roleDetails = action.payload;
        state.successMessage = 'Role status updated successfully';
      })
      .addCase(toggleRoleStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchHeadingData.fulfilled, (state, action) => {
        state.headingData = action.payload;
      });
  },
});

export const { clearMessages } = roleSlice.actions;
export default roleSlice.reducer;
