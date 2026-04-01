import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Set the base URL for Axios
const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_API
  // baseURL: 'http://127.0.0.1:8000', // Your backend URL
});
// Helper to extract error message
const getErrorMessage = (error) =>
  error.response && error.response.data && error.response.data.error
    ? error.response.data.error
    : error.message;

// Define the async action for requesting an OTP
export const requestOtp = createAsyncThunk(
  'forgotPassword/requestOtp',
  async (email, { rejectWithValue }) => {
    try {
      const response = await api.post('/user/forgot_password/request_otp/', { email });
      return response.data;
    } catch (error) {
      return rejectWithValue({ error: getErrorMessage(error) });
    }
  }
);

// Define the async action for resending the OTP
export const resendOtp = createAsyncThunk(
  'forgotPassword/resendOtp',
  async (email, { rejectWithValue }) => {
    try {
      const response = await api.post('/user/forgot_password/resend_otp/', { email });
      return response.data;
    } catch (error) {
      return rejectWithValue({ error: getErrorMessage(error) });
    }
  }
);

// Define the async action for verifying the OTP
export const verifyOtp = createAsyncThunk(
  'forgotPassword/verifyOtp',
  async ({ email, otp }, { rejectWithValue }) => {
    try {
      const response = await api.post('/user/forgot_password/verify_otp/', { email, otp });
      return response.data;
    } catch (error) {
      return rejectWithValue({ error: getErrorMessage(error) });
    }
  }
);

// Define the async action for setting a new password
export const setNewPassword = createAsyncThunk(
  'forgotPassword/setNewPassword',
  async ({ email, new_password }, { rejectWithValue }) => {
    try {
      const response = await api.post('/user/forgot_password/set_new_password/', { email, new_password });
      return response.data;
    } catch (error) {
      return rejectWithValue({ error: getErrorMessage(error) });
    }
  }
);

// Create the slice
const forgotPasswordSlice = createSlice({
  name: 'forgotPassword',
  initialState: {
    message: '',
    error: '',
    loading: false,
    email: '', // Store email for further steps
  },
  reducers: {
    clearState: (state) => {
      state.message = '';
      state.error = '';
    },
    setEmail: (state, action) => {
      state.email = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Request OTP
      .addCase(requestOtp.pending, (state) => {
        state.loading = true;
      })
      .addCase(requestOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.message = action.payload.message;
      })
      .addCase(requestOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload.error;
      })
      // Resend OTP
      .addCase(resendOtp.pending, (state) => {
        state.loading = true;
      })
      .addCase(resendOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.message = action.payload.message;
      })
      .addCase(resendOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload.error;
      })
      // Verify OTP
      .addCase(verifyOtp.pending, (state) => {
        state.loading = true;
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.message = action.payload.message;
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload.error;
      })
      // Set New Password
      .addCase(setNewPassword.pending, (state) => {
        state.loading = true;
      })
      .addCase(setNewPassword.fulfilled, (state, action) => {
        state.loading = false;
        state.message = action.payload.message;
      })
      .addCase(setNewPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload.error;
      });
  },
});

export const { clearState, setEmail } = forgotPasswordSlice.actions;

export default forgotPasswordSlice.reducer;
