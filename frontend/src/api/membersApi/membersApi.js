import { createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../../utils/axiosInstance';

// Fetch Members
export const fetchmemberData = createAsyncThunk('member/fetchData', async (_, thunkAPI) => {
  try {
    const response = await axiosInstance.get('/user/member_list/', { 
      params: { type: 'org' } 
    });
    return response.data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data || error.message);
  }
});

// Fetch Member by ID
export const fetchMemberById = createAsyncThunk('member/fetchById', async (id, thunkAPI) => {
  try {
    const response = await axiosInstance.get(`/user/member_details/${id}/`);
    return response.data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data || 'Error fetching member details');
  }
});

// Fetch Member Types
export const fetchmemberTypeData = createAsyncThunk('member_type/fetchData', async (_, thunkAPI) => {
  try {
    const response = await axiosInstance.get('/user/member_type_list/');
    return response.data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data || error.message);
  }
});

// Create Member
export const Createmember = createAsyncThunk('member/create', async (formData, thunkAPI) => {
  try {
    await axiosInstance.post('/user/create_member/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    thunkAPI.dispatch(fetchmemberData()); // Refresh the members list
    return 'Created successfully';
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data || error.message);
  }
});
