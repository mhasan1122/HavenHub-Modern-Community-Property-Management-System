
import { createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../utils/axiosInstance';

export const fetchAboutData = createAsyncThunk('about/fetchData', async (_, thunkAPI) => {
  try {
    const response = await axiosInstance.get('/user/read/');
    return response.data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data || error.message);
  }
});

export const createOrUpdateAbout = createAsyncThunk(
  'about/createOrUpdate',
  async (formData, thunkAPI) => {
    try {
      const { id } = formData;
      const method = id ? 'put' : 'post';
      const url = id ? `/user/update/${id}/` : '/user/create/';

      await axiosInstance[method](url, formData);
      thunkAPI.dispatch(fetchAboutData());
      return { message: id ? 'Updated successfully' : 'Created successfully' };
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const deleteAbout = createAsyncThunk('about/delete', async (id, thunkAPI) => {
  try {
    await axiosInstance.delete(`/user/delete/${id}/`);
    thunkAPI.dispatch(fetchAboutData()); 
    return { message: 'Deleted successfully' };
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data || error.message);
  }
});
