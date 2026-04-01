import { createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../../../utils/axiosInstance";

export const fetchRoleData = createAsyncThunk('role/fetchData', async (_, thunkAPI) => {
    try {
      const response = await axiosInstance.get('/group_role/role_list/')
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  });

