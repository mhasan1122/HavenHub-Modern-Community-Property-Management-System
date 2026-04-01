import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { NoticeService } from '../../services/noticeService';
import { 
  Notice, 
  CreateNoticeData, 
  UpdateNoticeData, 
  NoticeFilters,
  NoticeState,
  Tower,
  Unit
} from '../../types/notice';
import { logout } from './authSlice';

const initialState: NoticeState = {
  notices: [],
  loading: false,
  error: null,
  selectedNotice: null,
  filters: {},
  totalCount: 0,
  hasLoadedOnce: false, // Add this new property
};

// Helper function to get token from store state
const getTokenFromState = (getState: () => any): string | undefined => {
  const state = getState();
  return state.auth?.accessToken || undefined;
};

// Async thunks
export const fetchNotices = createAsyncThunk(
  'notices/fetchNotices',
  async (filters?: NoticeFilters, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await NoticeService.getNotices(filters, token);
    return response;
  }
);

export const fetchNoticeById = createAsyncThunk(
  'notices/fetchNoticeById',
  async (id: number, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await NoticeService.getNotice(id, token);
    return response;
  }
);

export const createNotice = createAsyncThunk(
  'notices/createNotice',
  async (data: CreateNoticeData, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await NoticeService.createNotice(data, token);
    return response;
  }
);

export const updateNotice = createAsyncThunk(
  'notices/updateNotice',
  async ({ id, data }: { id: number; data: UpdateNoticeData }, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await NoticeService.updateNotice(id, data, token);
    return response;
  }
);

export const deleteNotice = createAsyncThunk(
  'notices/deleteNotice',
  async (id: number, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    await NoticeService.deleteNotice(id, token);
    return id;
  }
);

export const togglePin = createAsyncThunk(
  'notices/togglePin',
  async (id: number, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await NoticeService.togglePin(id, token);
    return response;
  }
);

export const incrementViews = createAsyncThunk(
  'notices/incrementViews',
  async (id: number, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    await NoticeService.incrementViews(id, token);
    return id;
  }
);

export const forceExpire = createAsyncThunk(
  'notices/forceExpire',
  async (id: number, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await NoticeService.forceExpire(id, token);
    return response;
  }
);

export const restoreNotice = createAsyncThunk(
  'notices/restoreNotice',
  async (id: number, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await NoticeService.restore(id, token);
    return response;
  }
);

export const fetchTowers = createAsyncThunk(
  'notices/fetchTowers',
  async (_, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await NoticeService.getTowers(token);
    return response;
  }
);

export const fetchUnits = createAsyncThunk(
  'notices/fetchUnits',
  async (towerIds?: number[], { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await NoticeService.getUnits(towerIds, token);
    return response;
  }
);

export const fetchLabels = createAsyncThunk(
  'notices/fetchLabels',
  async (_, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await NoticeService.getLabels(token);
    return response;
  }
);

const noticeSlice = createSlice({
  name: 'notices',
  initialState,
  reducers: {
    setSelectedNotice: (state, action: PayloadAction<Notice | null>) => {
      state.selectedNotice = action.payload;
    },
    setFilters: (state, action: PayloadAction<NoticeFilters>) => {
      state.filters = action.payload;
    },
    clearFilters: (state) => {
      state.filters = {};
    },
    clearError: (state) => {
      state.error = null;
    },
    clearNotices: (state) => {
      state.notices = [];
      state.selectedNotice = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch notices
    builder
      .addCase(fetchNotices.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotices.fulfilled, (state, action) => {
        state.loading = false;
        state.notices = action.payload;
        state.totalCount = action.payload.length;
        state.hasLoadedOnce = true; // Set hasLoadedOnce to true after successful fetch
      })
      .addCase(fetchNotices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch notices';
      });

    // Fetch notice by ID
    builder
      .addCase(fetchNoticeById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNoticeById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedNotice = action.payload;
      })
      .addCase(fetchNoticeById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch notice';
      });

    // Create notice
    builder
      .addCase(createNotice.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createNotice.fulfilled, (state, action) => {
        state.loading = false;
        state.notices.unshift(action.payload);
        state.totalCount += 1;
      })
      .addCase(createNotice.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to create notice';
      });

    // Update notice
    builder
      .addCase(updateNotice.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateNotice.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.notices.findIndex(n => n.id === action.payload.id);
        if (index !== -1) {
          state.notices[index] = action.payload;
        }
        if (state.selectedNotice?.id === action.payload.id) {
          state.selectedNotice = action.payload;
        }
      })
      .addCase(updateNotice.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update notice';
      });

    // Delete notice
    builder
      .addCase(deleteNotice.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteNotice.fulfilled, (state, action) => {
        state.loading = false;
        state.notices = state.notices.filter(n => n.id !== action.payload);
        state.totalCount -= 1;
        if (state.selectedNotice?.id === action.payload) {
          state.selectedNotice = null;
        }
      })
      .addCase(deleteNotice.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to delete notice';
      });

    // Toggle pin
    builder
      .addCase(togglePin.fulfilled, (state, action) => {
        const index = state.notices.findIndex(n => n.id === action.payload.id);
        if (index !== -1) {
          state.notices[index] = action.payload;
        }
        if (state.selectedNotice?.id === action.payload.id) {
          state.selectedNotice = action.payload;
        }
      });

    // Increment views
    builder
      .addCase(incrementViews.fulfilled, (state, action) => {
        const notice = state.notices.find(n => n.id === action.payload);
        if (notice) {
          notice.views += 1;
        }
        if (state.selectedNotice?.id === action.payload) {
          state.selectedNotice.views += 1;
        }
      });

    // Force expire
    builder
      .addCase(forceExpire.fulfilled, (state, action) => {
        const index = state.notices.findIndex(n => n.id === action.payload.id);
        if (index !== -1) {
          state.notices[index] = action.payload;
        }
        if (state.selectedNotice?.id === action.payload.id) {
          state.selectedNotice = action.payload;
        }
      });

    // Restore notice
    builder
      .addCase(restoreNotice.fulfilled, (state, action) => {
        const index = state.notices.findIndex(n => n.id === action.payload.id);
        if (index !== -1) {
          state.notices[index] = action.payload;
        }
        if (state.selectedNotice?.id === action.payload.id) {
          state.selectedNotice = action.payload;
        }
      })
      
      // Clear notices when user logs out
      .addCase(logout, (state) => {
        console.log('🧹 Clearing notice data on logout');
        state.notices = [];
        state.selectedNotice = null;
        state.hasLoadedOnce = false;
        state.error = null;
        state.loading = false;
        state.filters = {};
        state.totalCount = 0;
      });
  },
});

export const {
  setSelectedNotice,
  setFilters,
  clearFilters,
  clearError,
  clearNotices,
} = noticeSlice.actions;

export default noticeSlice.reducer;
