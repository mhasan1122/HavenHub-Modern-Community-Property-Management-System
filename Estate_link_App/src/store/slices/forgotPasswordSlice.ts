import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { API_CONFIG, enhancedFetch, getNetworkErrorMessage, isNetworkError, checkNetworkConnectivity } from '../../utils/networkUtils';
import { logout } from './authSlice';

// Types
export interface ForgotPasswordState {
  message: string;
  error: string;
  loading: boolean;
  email: string;
  passwordResetCompleted: boolean; // New field to track if password was successfully reset
}

// Error payload type for better type safety
interface ErrorPayload {
  error?: string;
}

// Initial state
const initialState: ForgotPasswordState = {
  message: '',
  error: '',
  loading: false,
  email: '',
  passwordResetCompleted: false,
};

// Helper function to retry failed requests
const retryRequest = async <T>(
  requestFn: () => Promise<T>,
  maxRetries = API_CONFIG.RETRY_ATTEMPTS,
  delay = API_CONFIG.RETRY_DELAY
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error as Error;
      console.log(`Request attempt ${attempt} failed:`, lastError.message);

      if (attempt === maxRetries) {
        break;
      }

      // Check network connectivity before retrying
      console.log('Checking network connectivity before retry...');
      const isConnected = await checkNetworkConnectivity();
      if (!isConnected) {
        console.log('Network connectivity check failed, aborting retries');
        throw new Error('No internet connection. Please check your network and try again.');
      }

      // Wait before retrying with exponential backoff
      const retryDelay = delay * Math.pow(2, attempt - 1); // Exponential backoff
      console.log(`Waiting ${retryDelay}ms before retry ${attempt + 1}...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  throw lastError!;
};

// Helper to extract error message with better type safety
const getErrorMessage = (error: any): string => {
  if (error?.response?.data?.error) {
    return error.response.data.error;
  }
  if (error?.message) {
    return error.message;
  }
  return 'An error occurred';
};

// Helper to safely extract error from payload
const extractErrorFromPayload = (payload: unknown): string => {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const errorPayload = payload as ErrorPayload;
    return errorPayload.error || 'An error occurred';
  }
  return 'An error occurred';
};

// Define the async action for requesting an OTP
export const requestOtp = createAsyncThunk(
  'forgotPassword/requestOtp',
  async (email: string, { rejectWithValue }) => {
    try {
      return retryRequest(async () => {
        const response = await enhancedFetch(
          `${API_CONFIG.BASE_URL}/user/forgot_password/request_otp/`,
          {
            method: 'POST',
            body: JSON.stringify({ email }),
          },
          API_CONFIG.TIMEOUT
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to request OTP');
        }
        
        return response.json();
      });
    } catch (error) {
      return rejectWithValue({ error: getErrorMessage(error) });
    }
  }
);

// Define the async action for resending the OTP
export const resendOtp = createAsyncThunk(
  'forgotPassword/resendOtp',
  async (email: string, { rejectWithValue }) => {
    try {
      return retryRequest(async () => {
        const response = await enhancedFetch(
          `${API_CONFIG.BASE_URL}/user/forgot_password/resend_otp/`,
          {
            method: 'POST',
            body: JSON.stringify({ email }),
          },
          API_CONFIG.TIMEOUT
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to resend OTP');
        }
        
        return response.json();
      });
    } catch (error) {
      return rejectWithValue({ error: getErrorMessage(error) });
    }
  }
);

// Define the async action for verifying the OTP
export const verifyOtp = createAsyncThunk(
  'forgotPassword/verifyOtp',
  async ({ email, otp }: { email: string; otp: string }, { rejectWithValue }) => {
    try {
      return retryRequest(async () => {
        const response = await enhancedFetch(
          `${API_CONFIG.BASE_URL}/user/forgot_password/verify_otp/`,
          {
            method: 'POST',
            body: JSON.stringify({ email, otp }),
          },
          API_CONFIG.TIMEOUT
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Invalid OTP');
        }
        
        return response.json();
      });
    } catch (error) {
      return rejectWithValue({ error: getErrorMessage(error) });
    }
  }
);

// Define the async action for setting a new password
export const setNewPassword = createAsyncThunk(
  'forgotPassword/setNewPassword',
  async ({ email, new_password }: { email: string; new_password: string }, { rejectWithValue }) => {
    try {
      return retryRequest(async () => {
        const response = await enhancedFetch(
          `${API_CONFIG.BASE_URL}/user/forgot_password/set_new_password/`,
          {
            method: 'POST',
            body: JSON.stringify({ email, new_password }),
          },
          API_CONFIG.TIMEOUT
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to set new password');
        }
        
        return response.json();
      });
    } catch (error) {
      return rejectWithValue({ error: getErrorMessage(error) });
    }
  }
);

// Create the slice
const forgotPasswordSlice = createSlice({
  name: 'forgotPassword',
  initialState,
  reducers: {
    clearState: (state) => {
      console.log('Redux: clearState action - clearing message and error');
      state.message = '';
      state.error = '';
      // Don't clear email or passwordResetCompleted here
    },
    clearAllState: (state) => {
      console.log('Redux: clearAllState action - clearing all state including email and passwordResetCompleted');
      state.message = '';
      state.error = '';
      state.email = '';
      state.passwordResetCompleted = false;
    },
    setEmail: (state, action: PayloadAction<string>) => {
      console.log('Redux: setEmail action - setting email to:', action.payload);
      state.email = action.payload;
    },
    clearError: (state) => {
      console.log('Redux: clearError action - clearing error');
      state.error = '';
    },
    clearMessage: (state) => {
      console.log('Redux: clearMessage action - clearing message');
      state.message = '';
    },
    setPasswordResetCompleted: (state, action: PayloadAction<boolean>) => {
      console.log('Redux: setPasswordResetCompleted action - setting to:', action.payload);
      state.passwordResetCompleted = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Request OTP
      .addCase(requestOtp.pending, (state) => {
        console.log('Redux: requestOtp.pending - starting OTP request');
        state.loading = true;
        state.error = '';
        state.message = '';
      })
      .addCase(requestOtp.fulfilled, (state, action) => {
        console.log('Redux: requestOtp.fulfilled - OTP request successful:', action.payload);
        state.loading = false;
        state.message = action.payload.message || 'OTP sent to your email';
        state.error = '';
      })
      .addCase(requestOtp.rejected, (state, action) => {
        console.log('Redux: requestOtp.rejected - OTP request failed:', action.payload);
        state.loading = false;
        state.error = extractErrorFromPayload(action.payload);
        state.message = '';
      })
      // Resend OTP
      .addCase(resendOtp.pending, (state) => {
        console.log('Redux: resendOtp.pending - starting OTP resend');
        state.loading = true;
        state.error = '';
        state.message = '';
      })
      .addCase(resendOtp.fulfilled, (state, action) => {
        console.log('Redux: resendOtp.fulfilled - OTP resend successful:', action.payload);
        state.loading = false;
        state.message = action.payload.message || 'OTP resent successfully';
        state.error = '';
      })
      .addCase(resendOtp.rejected, (state, action) => {
        console.log('Redux: resendOtp.rejected - OTP resend failed:', action.payload);
        state.loading = false;
        state.error = extractErrorFromPayload(action.payload);
        state.message = '';
      })
      // Verify OTP
      .addCase(verifyOtp.pending, (state) => {
        console.log('Redux: verifyOtp.pending - starting OTP verification');
        state.loading = true;
        state.error = '';
        state.message = '';
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        console.log('Redux: verifyOtp.fulfilled - OTP verification successful:', action.payload);
        state.loading = false;
        state.message = action.payload.message || 'OTP verified successfully';
        state.error = '';
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        console.log('Redux: verifyOtp.rejected - OTP verification failed:', action.payload);
        state.loading = false;
        state.error = extractErrorFromPayload(action.payload);
        state.message = '';
      })
      // Set New Password
      .addCase(setNewPassword.pending, (state) => {
        console.log('Redux: setNewPassword.pending - starting password reset');
        state.loading = true;
        state.error = '';
        state.message = '';
      })
      .addCase(setNewPassword.fulfilled, (state, action) => {
        console.log('Redux: setNewPassword.fulfilled - password reset successful:', action.payload);
        state.loading = false;
        state.message = action.payload.message || 'Password updated successfully';
        state.error = '';
        // Mark password reset as completed
        state.passwordResetCompleted = true;
        console.log('Redux: passwordResetCompleted set to true');
      })
      .addCase(setNewPassword.rejected, (state, action) => {
        console.log('Redux: setNewPassword.rejected - password reset failed:', action.payload);
        state.loading = false;
        state.error = extractErrorFromPayload(action.payload);
        state.message = '';
      })
      
      // Clear forgot password data when user logs out (security)
      .addCase(logout, (state) => {
        console.log('🧹 Clearing forgot password data on logout');
        return initialState;
      });
  },
});

export const { clearState, clearAllState, setEmail, clearError, clearMessage, setPasswordResetCompleted } = forgotPasswordSlice.actions;

export default forgotPasswordSlice.reducer; 