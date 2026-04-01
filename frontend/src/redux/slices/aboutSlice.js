// import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
// import axiosInstance from '../../utils/axiosInstance';

import { createSlice } from "@reduxjs/toolkit";
import { createOrUpdateAbout, deleteAbout, fetchAboutData } from "./api/aboutApi";



// export const fetchAboutData = createAsyncThunk('about/fetchData', async (_, thunkAPI) => {
//   try {
//     const response = await axiosInstance.get('/user/read/');
//     return response.data;
//   } catch (error) {
//     return thunkAPI.rejectWithValue(error.response?.data || error.message);
//   }
// });


// export const createOrUpdateAbout = createAsyncThunk(
//   'about/createOrUpdate',
//   async (formData, thunkAPI) => {
//     try {
//       const { id } = formData;
//       const method = id ? 'put' : 'post';
//       const url = id ? `/user/update/${id}/` : '/user/create/';

//       await axiosInstance[method](url, formData);
//       thunkAPI.dispatch(fetchAboutData()); 
//       return { message: id ? 'Updated successfully' : 'Created successfully' };
//     } catch (error) {
//       return thunkAPI.rejectWithValue(error.response?.data || error.message);
//     }
//   }
// );


// export const deleteAbout = createAsyncThunk('about/delete', async (id, thunkAPI) => {
//   try {
//     await axiosInstance.delete(`/user/delete/${id}/`);
//     thunkAPI.dispatch(fetchAboutData()); 
//     return { message: 'Deleted successfully' };
//   } catch (error) {
//     return thunkAPI.rejectWithValue(error.response?.data || error.message);
//   }
// });

const aboutSlice = createSlice({
  name: 'about',
  initialState: {
    data: [],
    loading: false,
    error: null,
    message: null,
  },
  reducers: {
    clearMessage(state) {
      state.message = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAboutData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAboutData.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchAboutData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createOrUpdateAbout.fulfilled, (state, action) => {
        state.message = action.payload.message;
      })
      .addCase(createOrUpdateAbout.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(deleteAbout.fulfilled, (state, action) => {
        state.message = action.payload.message;
      })
      .addCase(deleteAbout.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});


export const { clearMessage } = aboutSlice.actions;
export default aboutSlice.reducer;
