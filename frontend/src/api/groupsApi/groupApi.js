// src/redux/groupApi.js
import { createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../../utils/axiosInstance';

// Thunk to fetch roles from the backend
export const fetchRoles = createAsyncThunk(
    'group/fetchRoles',
    async (_, thunkAPI) => {
        try {
            const response = await axiosInstance.get('/group_role/role_list/');
            console.log('Fetched Roles:', response.data); // Print fetched roles data
            // Expected response: an array of role objects [{ id, role_name, role_description }, ...]
            return response.data;
        } catch (error) {
            console.error('Error fetching roles:', error.response?.data || error.message);
            return thunkAPI.rejectWithValue(error.response?.data || error.message);
        }
    }
);

// Thunk to create a group along with its RoleGroup entries.
// The backend expects { group_name, group_description, role_ids: [1,2,3,...] }
export const createGroup = createAsyncThunk(
    'group/createGroup',
    async (formData, thunkAPI) => {
        // console.log(formData); // Print created group data from API response
        try {
            const response = await axiosInstance.post('/group_role/create_group/', formData);
            // console.log('Created Group:'); // Print created group data from API response
            // console.log('Created Group:', response.data); // Print created group data from API response
            return response.data;
        } catch (error) {
            console.error('Error creating group:', error.response?.data || error.message);
            return thunkAPI.rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const fetchGroupMembers = createAsyncThunk(
    'group/fetchGroupMembers',
    async (_, thunkAPI) => {
        try {
            const response = await axiosInstance.get('/group_role/group_member_add_list/?type=org');
            console.log('Fetched Group Members:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error fetching group members:', error.response?.data || error.message);
            return thunkAPI.rejectWithValue(error.response?.data || error.message);
        }
    }
);
export const fetchGroupList = createAsyncThunk(
    'group/fetchGroupList',
    async (_, thunkAPI) => {
      try {
        const response = await axiosInstance.get('/group_role/group_list/');
        console.log('Fetched Group List:', response.data); // prints group list data
        return response.data;
      } catch (error) {
        console.error('Error fetching group list:', error.response?.data || error.message);
        return thunkAPI.rejectWithValue(error.response?.data || error.message);
      }
    }
  );

  export const fetchGroupDetail = createAsyncThunk(
    'group/fetchGroupDetail',
    async (groupId, thunkAPI) => {
      try {
        // Updated to match your backend URL pattern
        const response = await axiosInstance.get(`/group_role/group_details/${groupId}/`);
        console.log('Fetched Group Detail:', response.data);
        return response.data;
      } catch (error) {
        console.error('Error fetching group detail:', error.response?.data || error.message);
        return thunkAPI.rejectWithValue(error.response?.data || error.message);
      }
    }
  );