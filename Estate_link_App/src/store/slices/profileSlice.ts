import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { getAuthToken } from '../../utils/authUtils';
import { ProfileService, ProfileData, UpdateProfileData, MemberType, ProfileResponse, UnitRelationship } from '../../services/profileService';
import { logout } from './authSlice';

// Types
export interface ProfileState {
  profile: ProfileData | null;
  owners: UnitRelationship[];
  residents: UnitRelationship[];
  staff: UnitRelationship[];
  memberTypes: MemberType[];
  loading: boolean;
  error: string | null;
  updateLoading: boolean;
  updateError: string | null;
  hasLoadedOnce: boolean;
}

// Initial state
const initialState: ProfileState = {
  profile: null,
  owners: [],
  residents: [],
  staff: [],
  memberTypes: [],
  loading: false,
  error: null,
  updateLoading: false,
  updateError: null,
  hasLoadedOnce: false,
};

// Helper function to get token from store state with AsyncStorage fallback
const getTokenFromState = async (getState: () => any): Promise<string | undefined> => {
  const state = getState();
  const tokenFromState = state.auth?.accessToken;
  const isAuthenticated = state.auth?.isAuthenticated;
  
  console.log('🔑 getTokenFromState - Redux state token:', tokenFromState ? 'present' : 'missing');
  console.log('🔑 getTokenFromState - Auth state:', {
    hasAuth: !!state.auth,
    isAuthenticated: isAuthenticated,
    hasUser: !!state.auth?.user,
    accessToken: tokenFromState ? `${tokenFromState.substring(0, 20)}...` : 'null/undefined'
  });
  
  // If user is authenticated and token exists in Redux state, use it
  if (isAuthenticated && tokenFromState && tokenFromState !== 'null' && tokenFromState !== 'undefined') {
    return tokenFromState;
  }
  
  // Only check AsyncStorage if user is authenticated but token is missing from Redux
  // This handles the case where Redux state hasn't been rehydrated yet
  if (isAuthenticated && !tokenFromState) {
    console.log('🔑 getTokenFromState - User authenticated but token missing from Redux, checking AsyncStorage...');
    const tokenFromStorage = await getAuthToken();
    console.log('🔑 getTokenFromState - AsyncStorage token:', tokenFromStorage ? 'present' : 'missing');
    
    if (tokenFromStorage && tokenFromStorage !== 'null' && tokenFromStorage !== 'undefined') {
      return tokenFromStorage;
    }
  }
  
  // If user is not authenticated, don't check AsyncStorage - just return undefined
  console.log('🔑 getTokenFromState - No valid token found');
  return undefined;
};

// Async thunks
export const fetchProfile = createAsyncThunk(
  'profile/fetchProfile',
  async (_, { getState, rejectWithValue }: { getState: () => any; rejectWithValue: (value: any) => any } = {} as any) => {
    const state = getState();
    const isAuthenticated = state.auth?.isAuthenticated;
    const hasToken = state.auth?.accessToken;
    
    console.log('🔄 fetchProfile - Auth state:', {
      isAuthenticated,
      hasUser: !!state.auth?.user,
      userId: state.auth?.user?.id,
      hasToken: !!hasToken
    });
    
    // Only fetch if user is authenticated
    if (!isAuthenticated) {
      console.warn('⚠️ fetchProfile - User not authenticated, skipping fetch');
      return rejectWithValue('User not authenticated');
    }
    
    const token = await getTokenFromState(getState);
    console.log('🔄 Fetching profile with token:', token ? 'present' : 'missing');
    
    if (!token) {
      const errorMsg = 'Authentication token not available. Please log in again.';
      console.error('❌', errorMsg);
      return rejectWithValue(errorMsg);
    }
    
    const response = await ProfileService.getProfile(token);
    console.log('✅ Profile fetch successful:', response);
    return response;
  }
);

export const fetchMemberDetails = createAsyncThunk(
  'profile/fetchMemberDetails',
  async (id: number, { getState }: { getState: () => any } = {} as any) => {
    const token = await getTokenFromState(getState);
    console.log('🔄 Fetching member details for ID:', id, 'with token:', token ? 'present' : 'missing');
    
    if (!token) {
      throw new Error('Authentication token not available. Please log in again.');
    }
    
    const response = await ProfileService.getMemberDetails(id, token);
    console.log('✅ Member details fetch successful:', response);
    return response;
  }
);

export const updateProfile = createAsyncThunk(
  'profile/updateProfile',
  async ({ id, data }: { id: number; data: UpdateProfileData }, { getState, rejectWithValue }: { getState: () => any; rejectWithValue: (value: any) => any } = {} as any) => {
    try {
      const token = await getTokenFromState(getState);
      console.log('🔄 updateProfile thunk - calling ProfileService.updateProfile');
      
      if (!token) {
        return rejectWithValue('Authentication token not available. Please log in again.');
      }
      
      const response = await ProfileService.updateProfile(id, data, token);
      console.log('✅ updateProfile thunk - ProfileService response:', response);
      return response;
    } catch (error) {
      console.error('❌ updateProfile thunk - error caught:', error);
      
      // Extract meaningful error message
      let errorMessage = 'Unknown error occurred';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Try to extract validation errors from the message
        if (errorMessage.includes('Failed to update profile:')) {
          const jsonMatch = errorMessage.match(/\{.*\}/);
          if (jsonMatch) {
            try {
              const errorObj = JSON.parse(jsonMatch[0]);
              // Get the first validation error
              const firstKey = Object.keys(errorObj)[0];
              if (firstKey && errorObj[firstKey]) {
                const firstError = Array.isArray(errorObj[firstKey]) ? errorObj[firstKey][0] : errorObj[firstKey];
                errorMessage = firstError;
              }
            } catch (parseError) {
              console.error('Failed to parse error JSON:', parseError);
            }
          }
        }
      }
      
      console.error('❌ updateProfile thunk - final error message:', errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchMemberTypes = createAsyncThunk(
  'profile/fetchMemberTypes',
  async (_, { getState }: { getState: () => any } = {} as any) => {
    const token = await getTokenFromState(getState);
    
    if (!token) {
      throw new Error('Authentication token not available. Please log in again.');
    }
    
    const response = await ProfileService.getMemberTypes(token);
    return response;
  }
);

export const fetchUserTowerUnit = createAsyncThunk(
  'profile/fetchUserTowerUnit',
  async (_, { getState }: { getState: () => any } = {} as any) => {
    const token = await getTokenFromState(getState);
    
    if (!token) {
      throw new Error('Authentication token not available. Please log in again.');
    }
    
    const response = await ProfileService.getUserTowerUnit(token);
    return response;
  }
);

export const changeMemberStatus = createAsyncThunk(
  'profile/changeMemberStatus',
  async (
    { id, statusChange, memberType }: { id: number; statusChange: number; memberType: 'org' | 'comm' },
    { getState }: { getState: () => any } = {} as any
  ) => {
    const token = await getTokenFromState(getState);
    
    if (!token) {
      throw new Error('Authentication token not available. Please log in again.');
    }
    
    const response = await ProfileService.changeMemberStatus(id, statusChange, memberType, token);
    return response;
  }
);

// Slice
const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    setProfile: (state, action: PayloadAction<ProfileData | null>) => {
      state.profile = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearUpdateError: (state) => {
      state.updateError = null;
    },
    clearProfile: (state) => {
      state.profile = null;
      state.owners = [];
      state.residents = [];
      state.staff = [];
      state.hasLoadedOnce = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setUpdateLoading: (state, action: PayloadAction<boolean>) => {
      state.updateLoading = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Fetch profile
    builder
      .addCase(fetchProfile.pending, (state) => {
        console.log('📡 fetchProfile.pending');
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        console.log('✅ fetchProfile.fulfilled with data:', action.payload);
        state.loading = false;
        state.profile = action.payload.member;
        state.owners = action.payload.owners || [];
        state.residents = action.payload.residents || [];
        state.staff = action.payload.staff || [];
        state.hasLoadedOnce = true;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        console.error('❌ fetchProfile.rejected:', action.error.message);
        state.loading = false;
        
        // Extract error message from action payload or error
        let errorMessage = 'Failed to fetch profile';
        if (action.payload) {
          errorMessage = action.payload as string;
        } else if (action.error.message) {
          errorMessage = action.error.message;
        }
        
        // Only set error if it's not an authentication issue (user might not be logged in)
        // Don't show error for "User not authenticated" as that's expected when not logged in
        if (!errorMessage.includes('not authenticated') && !errorMessage.includes('not available')) {
          state.error = errorMessage;
        } else {
          // Clear error for auth issues - these are expected when user is not logged in
          state.error = null;
        }
      });

    // Fetch member details
    builder
      .addCase(fetchMemberDetails.pending, (state) => {
        console.log('📡 fetchMemberDetails.pending');
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMemberDetails.fulfilled, (state, action) => {
        console.log('✅ fetchMemberDetails.fulfilled with data:', action.payload);
        state.loading = false;
        state.profile = action.payload;
        state.hasLoadedOnce = true;
      })
      .addCase(fetchMemberDetails.rejected, (state, action) => {
        console.error('❌ fetchMemberDetails.rejected:', action.error.message);
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch member details';
      });

    // Update profile
    builder
      .addCase(updateProfile.pending, (state) => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.updateLoading = false;
        console.log('📝 updateProfile.fulfilled - action.payload:', action.payload);
        console.log('📝 updateProfile.fulfilled - NID in payload:', action.payload.nid_number);
        // Update the profile data with the returned data
        if (state.profile) {
          console.log('📝 updateProfile.fulfilled - before merge, profile NID:', state.profile.nid_number);
          // Ensure NID number is properly handled - convert null to empty string for consistency
          const updatedProfile = { 
            ...state.profile, 
            ...action.payload,
            nid_number: action.payload.nid_number !== null && action.payload.nid_number !== undefined ? 
              String(action.payload.nid_number) : ''
          };
          state.profile = updatedProfile;
          console.log('📝 updateProfile.fulfilled - after merge, profile NID:', updatedProfile.nid_number);
        }
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.updateLoading = false;
        // Use payload from rejectWithValue if available, otherwise fallback to error message
        state.updateError = (action.payload as string) || action.error.message || 'Failed to update profile';
        console.error('❌ updateProfile.rejected - error:', state.updateError);
      });

    // Fetch member types
    builder
      .addCase(fetchMemberTypes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMemberTypes.fulfilled, (state, action) => {
        state.loading = false;
        state.memberTypes = action.payload;
      })
      .addCase(fetchMemberTypes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch member types';
      });

    // Fetch user tower unit
    builder
      .addCase(fetchUserTowerUnit.fulfilled, (state, action) => {
        if (state.profile) {
          state.profile = { ...state.profile, ...action.payload };
        }
      });

    // Change member status
    builder
      .addCase(changeMemberStatus.fulfilled, (state, action) => {
        // Update loading can be handled by the calling component
        console.log('Member status changed successfully:', action.payload.message);
      })
      .addCase(changeMemberStatus.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to change member status';
      });

    // Clear profile when user logs out
    builder
      .addCase(logout, (state) => {
        console.log('🧹 Clearing profile data on logout');
        state.profile = null;
        state.owners = [];
        state.residents = [];
        state.staff = [];
        state.hasLoadedOnce = false;
        state.error = null;
        state.updateError = null;
      });
  },
});

export const {
  setProfile,
  clearError,
  clearUpdateError,
  clearProfile,
  setLoading,
  setUpdateLoading,
} = profileSlice.actions;

export default profileSlice.reducer;