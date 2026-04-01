import {  createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from './../../utils/axiosInstance';



export const fetchmemberData = createAsyncThunk('member/fetchData', async (_, thunkAPI) => {
  try {
    const response = await axiosInstance.get('/user/read/');
    return response.data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data || error.message);
  }
});

export const Createmember = createAsyncThunk(
    'member/create',
    async (formData, thunkAPI) => {
      try {
        console.log('1');
        const method = 'post';
        const url =  'http://127.0.0.1:8000/user/register/';
  
        await axiosInstance[method](url, formData);
      thunkAPI.dispatch(fetchmemberData()); 
        return 'Created successfully' ;
      } catch (error) {
          console.log('2');
  
        return thunkAPI.rejectWithValue(error.response?.data || error.message);
      }
    }
);
// export const createOrUpdatemember = createAsyncThunk(
//   'member/createOrUpdate',
//   async (formData, thunkAPI) => {
//     try {
//       const { id } = formData;
//       const method = id ? 'put' : 'post';
//       const url = id ? `/user/update/${id}/` : '/user/register/';

//       await axiosInstance[method](url, formData);
//     thunkAPI.dispatch(fetchmemberData()); 
//       return { message: id ? 'Updated successfully' : 'Created successfully' };
//     } catch (error) {
//       return thunkAPI.rejectWithValue(error.response?.data || error.message);
//     }
//   }
// );


export const deletemember = createAsyncThunk('member/delete', async (id, thunkAPI) => {
  try {
    await axiosInstance.delete(`/user/delete/${id}/`);
    thunkAPI.dispatch(fetchmemberData()); 
    return { message: 'Deleted successfully' };
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data || error.message);
  }
});