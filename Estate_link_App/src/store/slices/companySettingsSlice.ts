import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { API_CONFIG, enhancedFetch } from '../../utils/networkUtils';

// Types
export interface CompanySettings {
  id: number;
  logo_url: string | null;
  login_page_image_url: string | null;
  company_name: string;
  company_phone: string | null;
  company_email: string | null;
  company_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanySettingsState {
  settings: CompanySettings | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null; // Timestamp of last successful fetch
  hasLoadedOnce: boolean;
}

// Initial state
const initialState: CompanySettingsState = {
  settings: null,
  isLoading: false,
  error: null,
  lastFetched: null,
  hasLoadedOnce: false,
};

// Cache duration: 5 minutes (300000 ms)
const CACHE_DURATION = 5 * 60 * 1000;

// Async thunk to fetch company settings (public endpoint, no auth required)
export const fetchCompanySettings = createAsyncThunk(
  'companySettings/fetchCompanySettings',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { companySettings: CompanySettingsState };
      const { lastFetched, settings } = state.companySettings;

      // Return cached data if still valid
      if (settings && lastFetched && Date.now() - lastFetched < CACHE_DURATION) {
        console.log('📦 Using cached company settings');
        return settings;
      }

      console.log('📡 Fetching company settings from API...');
      const response = await enhancedFetch(
        `${API_CONFIG.BASE_URL}/api/company-settings/public/`,
        {
          method: 'GET',
        },
        API_CONFIG.TIMEOUT
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || 'Failed to fetch company settings');
      }

      const data = await response.json();
      console.log('✅ Company settings fetched successfully');
      return data;
    } catch (error: any) {
      console.error('❌ Error fetching company settings:', error);
      
      // Return cached data if available, even if expired
      const state = getState() as { companySettings: CompanySettingsState };
      if (state.companySettings.settings) {
        console.log('📦 Using expired cache as fallback');
        return state.companySettings.settings;
      }
      
      return rejectWithValue(error.message || 'Failed to fetch company settings');
    }
  }
);

// Slice
const companySettingsSlice = createSlice({
  name: 'companySettings',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSettings: (state) => {
      state.settings = null;
      state.lastFetched = null;
      state.hasLoadedOnce = false;
    },
    // Force refresh (bypass cache)
    forceRefresh: (state) => {
      state.lastFetched = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompanySettings.pending, (state) => {
        // Only set loading if we don't have cached data
        if (!state.settings || !state.lastFetched || Date.now() - state.lastFetched >= CACHE_DURATION) {
          state.isLoading = true;
        }
        state.error = null;
      })
      .addCase(fetchCompanySettings.fulfilled, (state, action) => {
        state.isLoading = false;
        state.settings = action.payload;
        state.lastFetched = Date.now();
        state.hasLoadedOnce = true;
        state.error = null;
      })
      .addCase(fetchCompanySettings.rejected, (state, action) => {
        // Only set error if we don't have cached data
        if (!state.settings) {
          state.isLoading = false;
          state.error = action.payload as string || 'Failed to fetch company settings';
        } else {
          // Keep existing settings and just log the error
          state.isLoading = false;
          console.log('⚠️ Failed to refresh company settings, using cached data');
        }
      });
  },
});

export const { clearError, clearSettings, forceRefresh } = companySettingsSlice.actions;
export default companySettingsSlice.reducer;

