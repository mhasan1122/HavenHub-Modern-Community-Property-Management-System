import {  createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from './../../utils/axiosInstance';


export const fetchroleData = createAsyncThunk('role/fetchData', async (_, thunkAPI) => {
  try {
    const response = await axiosInstance.get('/group_role/role_list/')
    return response.data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data || error.message);
  }
});

export const Createrole = createAsyncThunk(
  'role/create',
  async (formData, thunkAPI) => {
    try {
      console.log(formData);
      const url = '/user/register/';
      const headers = { 
        'Content-Type': 'multipart/form-data' 
      };
      // Send the FormData to the backend using axios
      await axiosInstance.post(url, formData, { headers });
      thunkAPI.dispatch(fetchroleData());
      return 'Created successfully';
    } catch (error) {
      console.log('Error:', error);
      return thunkAPI.rejectWithValue(error.response?.data || error.message);
    }
  }
);


// export const deleterole = createAsyncThunk('role/delete', async (id, thunkAPI) => {
//   try {
//     await axiosInstance.delete(`/user/delete/${id}/`);
//     thunkAPI.dispatch(fetchroleData()); 
//     return { message: 'Deleted successfully' };
//   } catch (error) {
//     return thunkAPI.rejectWithValue(error.response?.data || error.message);
//   }
// });