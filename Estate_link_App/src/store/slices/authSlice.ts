import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { API_CONFIG, enhancedFetch, getNetworkErrorMessage, isNetworkError, checkNetworkConnectivity } from '../../utils/networkUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pushNotificationService } from '../../services/pushNotificationService';
import { notificationCache } from '../../services/notificationCache';

// Helper function to extract error messages from various error formats
const extractErrorMessage = (errorData: any, fallbackMessage: string = 'An error occurred'): string => {
  // If it's already a string, return it
  if (typeof errorData === 'string') {
    return errorData;
  }

  // If errorData is null or undefined
  if (!errorData) {
    return fallbackMessage;
  }

  // Handle Django REST Framework error formats
  if (typeof errorData === 'object') {
    // Check for 'detail' field (common in DRF)
    if (errorData.detail) {
      return typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
    }

    // Check for 'error' field
    if (errorData.error) {
      return typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
    }

    // Check for 'message' field
    if (errorData.message) {
      return typeof errorData.message === 'string' ? errorData.message : JSON.stringify(errorData.message);
    }

    // Check for 'messages' array (from token validation errors)
    if (Array.isArray(errorData.messages) && errorData.messages.length > 0) {
      const firstMessage = errorData.messages[0];
      if (typeof firstMessage === 'string') {
        return firstMessage;
      }
      if (firstMessage.message) {
        return firstMessage.message;
      }
    }

    // Check for 'code' field (error codes)
    if (errorData.code) {
      const codeMessage = errorData.code.replace(/_/g, ' ');
      return codeMessage.charAt(0).toUpperCase() + codeMessage.slice(1);
    }

    // Check for field-specific errors (validation errors)
    const fieldErrors = Object.keys(errorData)
      .filter(key => key !== 'code' && key !== 'detail' && key !== 'error')
      .map(key => {
        const value = errorData[key];
        if (Array.isArray(value)) {
          return `${key}: ${value.join(', ')}`;
        }
        return `${key}: ${value}`;
      });

    if (fieldErrors.length > 0) {
      return fieldErrors.join('\n');
    }

    // If object has no recognizable fields, try to stringify it nicely
    try {
      const jsonStr = JSON.stringify(errorData, null, 2);
      if (jsonStr !== '{}') {
        return jsonStr;
      }
    } catch (e) {
      // If stringify fails, fall through to fallback
    }
  }

  return fallbackMessage;
};

// Types
export interface AuthState {
  user: {
    id?: string;
    username?: string;
    email?: string;
    phone?: string;
    isFirstLogin?: boolean;
    termsAccepted?: boolean;
    full_name?: string;
    tower?: string;
    unit?: string;
    photo?: string;
  } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  otpData: {
    email?: string;
    phone?: string;
    method?: 'email' | 'phone' | 'whatsapp';
    attempts: number;
    lastAttempt?: Date;
  } | null;
}

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  accessToken: null,
  refreshToken: null,
  otpData: null,
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

// Async thunks
export const checkUserStatus = createAsyncThunk(
  'auth/checkUserStatus',
  async (authenticator: string) => {
    console.log('Making API call to:', `${API_CONFIG.BASE_URL}/user/check_status/`);
    console.log('Request payload:', { authenticator });
    
    // Make a single request - no retry for 404 errors
    const response = await enhancedFetch(
      `${API_CONFIG.BASE_URL}/user/check_status/`,
      {
        method: 'POST',
        body: JSON.stringify({ authenticator }),
      },
      API_CONFIG.TIMEOUT
    );
    
    console.log('Response received!');
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        // If response is not JSON, try to get text
        errorData = await response.text();
      }
      console.log('Error response:', errorData);

      // Handle 404 as a valid "user not found" response - NO RETRY for this
      if (response.status === 404) {
        const errorMessage = extractErrorMessage(errorData, 'User not found. Please check your credentials and try again.');
        throw new Error(errorMessage);
      }

      // For other errors, use retry logic only for network issues
      const errorMessage = extractErrorMessage(errorData, `Server error: ${response.status}`);
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log('Success response:', data);
    return data;
  }
);

export const requestOTP = createAsyncThunk(
  'auth/requestOTP',
  async ({ email, method }: { email: string; method: 'email' | 'phone' | 'whatsapp' }) => {
    return retryRequest(async () => {
      const response = await enhancedFetch(
        `${API_CONFIG.BASE_URL}/user/forgot_password/request_otp/`,
        {
          method: 'POST',
          body: JSON.stringify({ email, method }),
        },
        API_CONFIG.TIMEOUT
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = extractErrorMessage(errorData, 'Failed to request OTP');
        throw new Error(errorMessage);
      }
      
      return response.json();
    });
  }
);

export const verifyOTP = createAsyncThunk(
  'auth/verifyOTP',
  async ({ email, otp }: { email: string; otp: string }) => {
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
        const errorMessage = extractErrorMessage(errorData, 'Invalid OTP');
        throw new Error(errorMessage);
      }
      
      return response.json();
    });
  }
);

export const setNewPassword = createAsyncThunk(
  'auth/setNewPassword',
  async ({ email, newPassword }: { email: string; newPassword: string }) => {
    return retryRequest(async () => {
      const response = await enhancedFetch(
        `${API_CONFIG.BASE_URL}/user/forgot_password/set_new_password/`,
        {
          method: 'POST',
          body: JSON.stringify({ email, new_password: newPassword }),
        },
        API_CONFIG.TIMEOUT
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = extractErrorMessage(errorData, 'Failed to set new password');
        throw new Error(errorMessage);
      }
      
      return response.json();
    });
  }
);

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials: { username: string; password?: string }) => {
    console.log('Attempting login with credentials:', {
      authenticator: credentials.username,
      password: credentials.password ? '***' : 'not provided',
      login_type: 'org'
    });

    // Try org login first
    let response = await enhancedFetch(
      `${API_CONFIG.BASE_URL}/user/login/`,
      {
        method: 'POST',
        body: JSON.stringify({
          authenticator: credentials.username,
          password: credentials.password,
          login_type: 'org'
        }),
      },
      API_CONFIG.TIMEOUT
    );
    
    console.log('Org login response status:', response.status);
    
    // If org login fails, try comm login
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        // If response is not JSON, try to get text
        errorData = await response.text();
      }
      console.log('Org login error:', errorData);
      
      const errorMessage = extractErrorMessage(errorData, 'Login failed');
      
      if (errorMessage === 'You do not have access' || errorData === 'You do not have access') {
        console.log('Trying comm login...');
        // Try comm login
        response = await enhancedFetch(
          `${API_CONFIG.BASE_URL}/user/login/`,
          {
            method: 'POST',
            body: JSON.stringify({
              authenticator: credentials.username,
              password: credentials.password,
              login_type: 'comm'
            }),
          },
          API_CONFIG.TIMEOUT
        );
        console.log('Comm login response status:', response.status);
      } else {
        // If it's not an access issue, throw the error immediately
        throw new Error(errorMessage);
      }
    }
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        // If response is not JSON, try to get text
        errorData = await response.text();
      }
      console.log('Final login error:', errorData);
      
      // Extract error message using the helper function
      let errorMessage = extractErrorMessage(errorData, 'Login failed');
      
      // Handle specific error messages from backend
      if (errorMessage === 'Invalid credentials') {
        errorMessage = 'Invalid username or password. Please check your credentials and try again.';
      } else if (errorMessage === 'You do not have access') {
        errorMessage = 'You do not have access to this application.';
      } else if (errorMessage.includes('token') && errorMessage.includes('blacklist')) {
        errorMessage = 'Session expired. Please login again.';
      } else if (errorMessage.includes('Token is invalid or expired')) {
        errorMessage = 'Session expired. Please login again.';
      }
      
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    console.log('Login successful:', result);
    return result;
  }
);

export const setPassword = createAsyncThunk(
  'auth/setPassword',
  async ({ userId, oldPassword, newPassword, confirmPassword }: { 
    userId: string; 
    oldPassword: string; 
    newPassword: string; 
    confirmPassword: string;
  }) => {
    return retryRequest(async () => {
      const response = await enhancedFetch(
        `${API_CONFIG.BASE_URL}/user/set_password/`,
        {
          method: 'POST',
          body: JSON.stringify({ 
            user_id: userId, 
            old_password: oldPassword, 
            new_password: newPassword,
            confirm_password: confirmPassword
          }),
        },
        API_CONFIG.TIMEOUT
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle field-specific validation errors
        if (errorData.old_password) {
          throw new Error(`old_password: ${errorData.old_password.join(', ')}`);
        }
        if (errorData.new_password) {
          throw new Error(`new_password: ${errorData.new_password.join(', ')}`);
        }
        if (errorData.confirm_password) {
          throw new Error(`confirm_password: ${errorData.confirm_password.join(', ')}`);
        }
        
        // Handle other errors
        throw new Error(errorData.error || 'Failed to set password');
      }
      
      return response.json();
    });
  }
);

export const resendOTP = createAsyncThunk(
  'auth/resendOTP',
  async ({ email, method }: { email: string; method: 'email' | 'phone' | 'whatsapp' }) => {
    return retryRequest(async () => {
      const response = await enhancedFetch(
        `${API_CONFIG.BASE_URL}/user/forgot_password/resend_otp/`,
        {
          method: 'POST',
          body: JSON.stringify({ email, method }),
        },
        API_CONFIG.TIMEOUT
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = extractErrorMessage(errorData, 'Failed to resend OTP');
        throw new Error(errorMessage);
      }
      
      return response.json();
    });
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { getState, dispatch }) => {
    const state = getState() as { auth: AuthState };
    const { accessToken, refreshToken } = state.auth;
    
    // Get push token first (best effort)
    let pushToken: string | null = null;
    try {
      pushToken = await pushNotificationService.getPushToken();
      console.log('📱 Got push token for logout:', pushToken);
    } catch (e) {
      console.error('Failed to get push token for logout:', e);
    }
    
    // 1. Unregister device token (fire and forget, or await)
    if (accessToken) {
      try {
        console.log('🔕 Unregistering device token...');
        await pushNotificationService.unregisterDeviceToken(accessToken, pushToken || undefined);
      } catch (e) {
        console.error('Failed to unregister device token:', e);
      }
    }
    
    // 2. Call backend logout to blacklist refresh token
    if (refreshToken) {
      try {
        console.log('🚪 Calling backend logout...');
        const body: any = { refresh_token: refreshToken };
        if (pushToken) {
          body.push_token = pushToken;
        }

        await enhancedFetch(
          `${API_CONFIG.BASE_URL}/user/logout/`,
          {
            method: 'POST',
            body: JSON.stringify(body),
          },
          API_CONFIG.TIMEOUT
        );
      } catch (e) {
        console.error('Failed to logout from backend:', e);
      }
    }
    
    // 3. Clear local state
    dispatch(logout());
    
    // 4. Clear AsyncStorage and notification cache
    try {
      await AsyncStorage.removeItem('persist:root');
      await notificationCache.clear();
      console.log('✅ Cleared persisted auth data');
    } catch (e) {
      console.error('Failed to clear AsyncStorage:', e);
    }
    
    return true;
  }
);

// Slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    setOTPData: (state, action: PayloadAction<AuthState['otpData']>) => {
      state.otpData = action.payload;
    },
    incrementOTPAttempts: (state) => {
      if (state.otpData) {
        state.otpData.attempts += 1;
        state.otpData.lastAttempt = new Date();
      }
    },
    resetOTPData: (state) => {
      state.otpData = null;
    },
    logout: (state) => {
      console.log('🚪 Logging out - clearing all auth data');
      state.user = null;
      state.isAuthenticated = false;
      state.accessToken = null;
      state.refreshToken = null;
      state.error = null;
      state.otpData = null;
      // Clear persisted data - this needs to happen synchronously to avoid race conditions
      // The persist middleware will handle clearing the persisted state
    },
    updateUserPhoto: (state, action: PayloadAction<string>) => {
      if (state.user) {
        state.user.photo = action.payload;
      }
    },
    updateUserData: (state, action: PayloadAction<Partial<AuthState['user']>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    updateTokens: (state, action: PayloadAction<{ accessToken: string; refreshToken?: string }>) => {
      console.log('🔄 Updating tokens in Redux store');
      state.accessToken = action.payload.accessToken;
      if (action.payload.refreshToken) {
        state.refreshToken = action.payload.refreshToken;
      }
      // Keep user authenticated
      state.isAuthenticated = true;
    },
  },
  extraReducers: (builder) => {
    // Check user status
    builder
      .addCase(checkUserStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(checkUserStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        // Store the user data and also preserve the username/authenticator that was used
        state.user = {
          id: action.payload.user_id, // Map user_id to id
          username: action.meta.arg, // Store the authenticator used for login
          isFirstLogin: action.payload.is_first_login,
        };
        state.isAuthenticated = true;
      })
      .addCase(checkUserStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to check user status';
      });

    // Request OTP
    builder
      .addCase(requestOTP.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(requestOTP.fulfilled, (state, action) => {
        state.isLoading = false;
        state.otpData = {
          email: action.meta.arg.email,
          method: action.meta.arg.method,
          attempts: 0,
          lastAttempt: new Date(),
        };
      })
      .addCase(requestOTP.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to request OTP';
      });

    // Verify OTP
    builder
      .addCase(verifyOTP.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(verifyOTP.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(verifyOTP.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Invalid OTP';
      });

    // Set new password
    builder
      .addCase(setNewPassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(setNewPassword.fulfilled, (state) => {
        state.isLoading = false;
        state.otpData = null;
      })
      .addCase(setNewPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to set new password';
      });

    // Login user
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        // Store the access and refresh tokens
        state.accessToken = action.payload.access_token || null;
        state.refreshToken = action.payload.refresh_token || null;
        
        // The backend returns member data, not user data
        if (action.payload.member) {
          state.user = {
            id: action.payload.member.id,
            username: action.payload.member.user?.username || action.payload.member.login_email || action.payload.member.login_contact,
            email: action.payload.member.login_email,
            phone: action.payload.member.login_contact,
            isFirstLogin: action.payload.member.is_first_login,
            termsAccepted: action.payload.member.terms_accepted,
            full_name: action.payload.member.full_name,
            tower: action.payload.member.tower,
            unit: action.payload.member.unit,
            photo: action.payload.member.photo
          };
        } else if (action.payload.user) {
          state.user = action.payload.user;
        }
        state.isAuthenticated = true;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Login failed';
      });

    // Set password
    builder
      .addCase(setPassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(setPassword.fulfilled, (state, action) => {
        state.isLoading = false;
        if (state.user) {
          state.user.isFirstLogin = false;
        }
      })
      .addCase(setPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to set password';
      });

    // Resend OTP
    builder
      .addCase(resendOTP.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(resendOTP.fulfilled, (state, action) => {
        state.isLoading = false;
        if (state.otpData) {
          state.otpData.attempts = 0;
          state.otpData.lastAttempt = new Date();
        }
      })
      .addCase(resendOTP.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to resend OTP';
      });
  },
});

export const {
  setLoading,
  setError,
  clearError,
  setOTPData,
  incrementOTPAttempts,
  resetOTPData,
  logout,
  updateUserPhoto,
  updateUserData,
  updateTokens,
} = authSlice.actions;

export default authSlice.reducer; 