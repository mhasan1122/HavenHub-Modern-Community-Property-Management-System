import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { getBulletins, createBulletin, updateBulletin, archiveBulletin, Bulletin } from '../../services/bulletinService';
import { RootState } from '../index';
import { logout } from './authSlice';

// Async thunks
export const fetchBulletins = createAsyncThunk(
  'bulletins/fetchBulletins',
  async (params: {
    status?: 'current' | 'pending' | 'archive';
    creator?: string;
    search?: string;
    priority?: string;
    labels?: string;
    my_posts?: boolean;
  }, { getState, rejectWithValue }) => {
    try {
      console.log('🔄 fetchBulletins thunk called with params:', params);
      
      const state = getState() as RootState;
      const authToken = state.auth.accessToken;
      
      if (!authToken) {
        console.error('❌ No auth token found');
        throw new Error('Authentication required');
      }

      console.log('🔑 Auth token found, calling getBulletins service...');
      const data = await getBulletins(params, authToken);
      console.log('✅ getBulletins service returned data:', data?.length || 0, 'items');
      
      return { data, params };
    } catch (error) {
      console.error('❌ fetchBulletins thunk error:', error);
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch bulletins');
    }
  }
);

export const createNewBulletin = createAsyncThunk(
  'bulletins/createBulletin',
  async (bulletinData: any, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const authToken = state.auth.accessToken;
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const newBulletin = await createBulletin(bulletinData, authToken);
      return newBulletin;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to create bulletin');
    }
  }
);

export const updateExistingBulletin = createAsyncThunk(
  'bulletins/updateBulletin',
  async ({ id, data }: { id: number; data: any }, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const authToken = state.auth.accessToken;
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const updatedBulletin = await updateBulletin(id, data, authToken);
      return updatedBulletin;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to update bulletin');
    }
  }
);

export const approveBulletin = createAsyncThunk(
  'bulletins/approveBulletin',
  async ({ id, comment }: { id: number; comment?: string }, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const authToken = state.auth.accessToken;
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      // Make API call to approve bulletin
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'}/api/bulletins/${id}/approve/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || 'Failed to approve bulletin');
      }

      const result = await response.json();
      return { id, comment, data: result };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to approve bulletin');
    }
  }
);

export const rejectBulletin = createAsyncThunk(
  'bulletins/rejectBulletin',
  async ({ id, comment }: { id: number; comment?: string }, { getState, rejectWithValue }) => {
    try {
      const state = getState() as RootState;
      const authToken = state.auth.accessToken;
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      // Make API call to reject bulletin
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000'}/api/bulletins/${id}/reject/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || 'Failed to reject bulletin');
      }

      const result = await response.json();
      return { id, comment, data: result };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to reject bulletin');
    }
  }
);

export const archiveBulletinThunk = createAsyncThunk(
  'bulletins/archiveBulletin',
  async ({ id, comment }: { id: number; comment?: string }, { getState, rejectWithValue, dispatch }) => {
    try {
      const state = getState() as RootState;
      const authToken = state.auth.accessToken;
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      console.log('📦 Redux thunk: Starting bulletin archive for ID:', id);
      
      // Use the proper service function instead of hardcoded fetch
      await archiveBulletin(id, authToken);
      
      console.log('✅ Redux thunk: Archive service call successful');
      
      // Update local state immediately
      dispatch(changeBulletinStatus({ id, newStatus: 'archive', comment }));
      
      return { id, comment };
    } catch (error) {
      console.error('❌ Redux thunk: Archive failed:', error);
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to archive bulletin');
    }
  }
);

// State interface
interface BulletinState {
  currentBulletins: Bulletin[];
  pendingBulletins: Bulletin[];
  archiveBulletins: Bulletin[];
  loading: boolean;
  error: string | null;
  lastFetched: {
    current: number | null;
    pending: number | null;
    archive: number | null;
  };
  filters: {
    status: 'current' | 'pending' | 'archive';
    my_posts: boolean;
    search: string;
    priority: string;
    labels: string;
  };
}

// Initial state
const initialState: BulletinState = {
  currentBulletins: [],
  pendingBulletins: [],
  archiveBulletins: [],
  loading: false,
  error: null,
  lastFetched: {
    current: null,
    pending: null,
    archive: null,
  },
  filters: {
    status: 'current',
    my_posts: false,
    search: '',
    priority: '',
    labels: '',
  },
};

// Slice
const bulletinSlice = createSlice({
  name: 'bulletins',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setFilters: (state, action: PayloadAction<Partial<BulletinState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearBulletins: (state) => {
      console.log('🧹 clearBulletins action called - clearing all bulletin data');
      state.currentBulletins = [];
      state.pendingBulletins = [];
      state.archiveBulletins = [];
      state.lastFetched = { current: null, pending: null, archive: null };
      console.log('✅ Bulletin data cleared successfully');
    },
    addBulletinOptimistically: (state, action: PayloadAction<Bulletin>) => {
      const bulletin = action.payload;
      if (bulletin.status === 'pending') {
        state.pendingBulletins.unshift(bulletin);
      } else if (bulletin.status === 'current') {
        state.currentBulletins.unshift(bulletin);
      }
    },
    removeBulletin: (state, action: PayloadAction<number>) => {
      const id = action.payload;
      state.currentBulletins = state.currentBulletins.filter(b => b.id !== id);
      state.pendingBulletins = state.pendingBulletins.filter(b => b.id !== id);
      state.archiveBulletins = state.archiveBulletins.filter(b => b.id !== id);
    },
    /** Remove all bulletins by a given creator (e.g. after blocking that user). */
    removeBulletinsByCreatorId: (state, action: PayloadAction<number>) => {
      const creatorId = action.payload;
      const matchCreator = (b: Bulletin) => {
        const c = (b as any).creator;
        const id = typeof c === 'object' && c != null && 'id' in c ? c.id : c;
        return id != null && Number(id) === Number(creatorId);
      };
      state.currentBulletins = state.currentBulletins.filter(b => !matchCreator(b));
      state.pendingBulletins = state.pendingBulletins.filter(b => !matchCreator(b));
      state.archiveBulletins = state.archiveBulletins.filter(b => !matchCreator(b));
    },
    updateBulletinInState: (state, action: PayloadAction<Bulletin>) => {
      const updatedBulletin = action.payload;
      
      // Remove from all arrays first
      state.currentBulletins = state.currentBulletins.filter(b => b.id !== updatedBulletin.id);
      state.pendingBulletins = state.pendingBulletins.filter(b => b.id !== updatedBulletin.id);
      state.archiveBulletins = state.archiveBulletins.filter(b => b.id !== updatedBulletin.id);
      
      // Add to the appropriate array based on new status
      if (updatedBulletin.status === 'current') {
        state.currentBulletins.unshift(updatedBulletin);
      } else if (updatedBulletin.status === 'pending') {
        state.pendingBulletins.unshift(updatedBulletin);
      } else if (updatedBulletin.status === 'archive') {
        state.archiveBulletins.unshift(updatedBulletin);
      }
    },
    
    // Handle bulletin status change (approve/reject)
    changeBulletinStatus: (state, action: PayloadAction<{ id: number; newStatus: string; comment?: string }>) => {
      const { id, newStatus, comment } = action.payload;
      
      // Find the bulletin in any of the arrays
      let bulletin: Bulletin | undefined;
      let sourceArray: 'currentBulletins' | 'pendingBulletins' | 'archiveBulletins' | null = null;
      
      // Search in current bulletins
      const currentIndex = state.currentBulletins.findIndex(b => b.id === id);
      if (currentIndex !== -1) {
        bulletin = state.currentBulletins[currentIndex];
        sourceArray = 'currentBulletins';
      }
      
      // Search in pending bulletins
      const pendingIndex = state.pendingBulletins.findIndex(b => b.id === id);
      if (pendingIndex !== -1) {
        bulletin = state.pendingBulletins[pendingIndex];
        sourceArray = 'pendingBulletins';
      }
      
      // Search in archive bulletins
      const archiveIndex = state.archiveBulletins.findIndex(b => b.id === id);
      if (archiveIndex !== -1) {
        bulletin = state.archiveBulletins[archiveIndex];
        sourceArray = 'archiveBulletins';
      }
      
      if (bulletin && sourceArray) {
        // Remove from source array
        state[sourceArray] = state[sourceArray].filter(b => b.id !== id);
        
        // Update bulletin status
        const updatedBulletin = { ...bulletin, status: newStatus };
        
        // Add to appropriate array based on new status
        if (newStatus === 'current') {
          state.currentBulletins.unshift(updatedBulletin);
        } else if (newStatus === 'pending') {
          state.pendingBulletins.unshift(updatedBulletin);
        } else if (newStatus === 'archive') {
          state.archiveBulletins.unshift(updatedBulletin);
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch bulletins
      .addCase(fetchBulletins.pending, (state) => {
        console.log('🔄 fetchBulletins.pending - setting loading to true');
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBulletins.fulfilled, (state, action) => {
        console.log('✅ fetchBulletins.fulfilled - setting loading to false, updating data');
        state.loading = false;
        const { data, params } = action.payload;
        const status = params.status || 'current';
        
        console.log('📊 Updating bulletins for status:', status, 'with', data?.length || 0, 'items');
        
        if (status === 'current') {
          state.currentBulletins = data;
          state.lastFetched.current = Date.now();
          // Keep pending list in sync: remove any bulletin that is now in current
          // (avoids showing approved bulletins in pending when pending fetch fails)
          const currentIds = new Set((data || []).map((b: Bulletin) => b.id));
          const beforeCount = state.pendingBulletins.length;
          state.pendingBulletins = state.pendingBulletins.filter(p => !currentIds.has(p.id));
          if (state.pendingBulletins.length !== beforeCount) {
            console.log('✅ Synced pending: removed', beforeCount - state.pendingBulletins.length, 'item(s) now in current');
          }
        } else if (status === 'pending') {
          state.pendingBulletins = data;
          state.lastFetched.pending = Date.now();
        } else if (status === 'archive') {
          state.archiveBulletins = data;
          state.lastFetched.archive = Date.now();
        }
        
        console.log('✅ State updated successfully');
      })
      .addCase(fetchBulletins.rejected, (state, action) => {
        console.error('❌ fetchBulletins.rejected - setting loading to false, setting error');
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Create bulletin
      .addCase(createNewBulletin.fulfilled, (state, action) => {
        const newBulletin = action.payload;
        if (newBulletin.status === 'pending') {
          state.pendingBulletins.unshift(newBulletin);
        } else if (newBulletin.status === 'current') {
          state.currentBulletins.unshift(newBulletin);
        }
      })
      
      // Update bulletin
      .addCase(updateExistingBulletin.fulfilled, (state, action) => {
        const updatedBulletin = action.payload;
        // Remove from all arrays first
        state.currentBulletins = state.currentBulletins.filter(b => b.id !== updatedBulletin.id);
        state.pendingBulletins = state.pendingBulletins.filter(b => b.id !== updatedBulletin.id);
        state.archiveBulletins = state.archiveBulletins.filter(b => b.id !== updatedBulletin.id);
        
        // Add to the appropriate array based on new status
        if (updatedBulletin.status === 'current') {
          state.currentBulletins.unshift(updatedBulletin);
        } else if (updatedBulletin.status === 'pending') {
          state.pendingBulletins.unshift(updatedBulletin);
        } else if (updatedBulletin.status === 'archive') {
          state.archiveBulletins.unshift(updatedBulletin);
        }
      })
      
      // Approve bulletin
      .addCase(approveBulletin.fulfilled, (state, action) => {
        const { id } = action.payload;
        const pendingIndex = state.pendingBulletins.findIndex(b => b.id === id);
        if (pendingIndex !== -1) {
          const bulletin = { ...state.pendingBulletins[pendingIndex], status: 'current' as const };
          state.pendingBulletins.splice(pendingIndex, 1);
          state.currentBulletins.unshift(bulletin);
        }
        console.log('✅ Bulletin approved - moved from pending to current');
      })
      .addCase(approveBulletin.rejected, (state, action) => {
        console.error('❌ Failed to approve bulletin:', action.payload);
      })
      
      // Reject bulletin
      .addCase(rejectBulletin.fulfilled, (state, action) => {
        const { id } = action.payload;
        const pendingIndex = state.pendingBulletins.findIndex(b => b.id === id);
        if (pendingIndex !== -1) {
          const bulletin = { ...state.pendingBulletins[pendingIndex], status: 'archive' as const };
          state.pendingBulletins.splice(pendingIndex, 1);
          state.archiveBulletins.unshift(bulletin);
        }
        console.log('✅ Bulletin rejected - moved from pending to archive');
      })
      .addCase(rejectBulletin.rejected, (state, action) => {
        console.error('❌ Failed to reject bulletin:', action.payload);
      })
      
      // Archive bulletin
      .addCase(archiveBulletinThunk.fulfilled, (state, action) => {
        // State is already updated by the thunk
        console.log('✅ Bulletin archived successfully');
      })
      .addCase(archiveBulletinThunk.rejected, (state, action) => {
        console.error('❌ Failed to archive bulletin:', action.payload);
      })
      
      // Clear bulletins when user logs out
      .addCase(logout, (state) => {
        console.log('🧹 Clearing bulletin data on logout');
        state.currentBulletins = [];
        state.pendingBulletins = [];
        state.archiveBulletins = [];
        state.lastFetched = { current: null, pending: null, archive: null };
        state.error = null;
        state.loading = false;
      });
  },
});

// Export actions
export const {
  clearError,
  setFilters,
  clearBulletins,
  addBulletinOptimistically,
  removeBulletin,
  removeBulletinsByCreatorId,
  updateBulletinInState,
  changeBulletinStatus,
} = bulletinSlice.actions;

// Export thunks
export { archiveBulletinThunk as archiveBulletin };

// Export selectors
export const selectCurrentBulletins = (state: RootState) => state.bulletins.currentBulletins;
export const selectPendingBulletins = (state: RootState) => state.bulletins.pendingBulletins;
export const selectArchiveBulletins = (state: RootState) => state.bulletins.archiveBulletins;
export const selectBulletinsLoading = (state: RootState) => state.bulletins.loading;
export const selectBulletinsError = (state: RootState) => state.bulletins.error;
export const selectBulletinsFilters = (state: RootState) => state.bulletins.filters;
export const selectLastFetched = (state: RootState) => state.bulletins.lastFetched;

// Export reducer
export default bulletinSlice.reducer;
