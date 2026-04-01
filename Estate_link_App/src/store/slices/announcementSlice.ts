import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AnnouncementService } from '../../services/announcementService';
import { 
  Announcement, 
  CreateAnnouncementData, 
  UpdateAnnouncementData, 
  AnnouncementFilters,
  AnnouncementState,
  Tower,
  Unit
} from '../../types/announcement';
import { logout } from './authSlice';

const initialState: AnnouncementState = {
  announcements: [],
  loading: false,
  error: null,
  selectedAnnouncement: null,
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
export const fetchAnnouncements = createAsyncThunk(
  'announcements/fetchAnnouncements',
  async (filters?: AnnouncementFilters, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await AnnouncementService.getAnnouncements(filters, token);
    return response;
  }
);

export const fetchAnnouncementById = createAsyncThunk(
  'announcements/fetchAnnouncementById',
  async (id: number, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await AnnouncementService.getAnnouncement(id, token);
    return response;
  }
);

export const createAnnouncement = createAsyncThunk(
  'announcements/createAnnouncement',
  async (data: CreateAnnouncementData, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await AnnouncementService.createAnnouncement(data, token);
    return response;
  }
);

export const updateAnnouncement = createAsyncThunk(
  'announcements/updateAnnouncement',
  async ({ id, data }: { id: number; data: UpdateAnnouncementData }, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await AnnouncementService.updateAnnouncement(id, data, token);
    return response;
  }
);

export const deleteAnnouncement = createAsyncThunk(
  'announcements/deleteAnnouncement',
  async (id: number, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    await AnnouncementService.deleteAnnouncement(id, token);
    return id;
  }
);

export const togglePin = createAsyncThunk(
  'announcements/togglePin',
  async (id: number, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await AnnouncementService.togglePin(id, token);
    return response;
  }
);

export const incrementViews = createAsyncThunk(
  'announcements/incrementViews',
  async (id: number, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    await AnnouncementService.incrementViews(id, token);
    return id;
  }
);

export const forceExpire = createAsyncThunk(
  'announcements/forceExpire',
  async (id: number, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await AnnouncementService.forceExpire(id, token);
    return response;
  }
);

export const restoreAnnouncement = createAsyncThunk(
  'announcements/restoreAnnouncement',
  async (id: number, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await AnnouncementService.restore(id, token);
    return response;
  }
);

export const fetchTowers = createAsyncThunk(
  'announcements/fetchTowers',
  async (_, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await AnnouncementService.getTowers(token);
    return response;
  }
);

export const fetchUnits = createAsyncThunk(
  'announcements/fetchUnits',
  async (towerIds?: number[], { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await AnnouncementService.getUnits(towerIds, token);
    return response;
  }
);

export const fetchLabels = createAsyncThunk(
  'announcements/fetchLabels',
  async (_, { getState }: { getState: () => any } = {} as any) => {
    const token = getTokenFromState(getState);
    const response = await AnnouncementService.getLabels(token);
    return response;
  }
);

const announcementSlice = createSlice({
  name: 'announcements',
  initialState,
  reducers: {
    setSelectedAnnouncement: (state, action: PayloadAction<Announcement | null>) => {
      state.selectedAnnouncement = action.payload;
    },
    setFilters: (state, action: PayloadAction<AnnouncementFilters>) => {
      state.filters = action.payload;
    },
    clearFilters: (state) => {
      state.filters = {};
    },
    clearError: (state) => {
      state.error = null;
    },
    clearAnnouncements: (state) => {
      state.announcements = [];
      state.selectedAnnouncement = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch announcements
    builder
      .addCase(fetchAnnouncements.pending, (state) => {
        // Only show loading if we don't have data yet (first load)
        // This prevents loading spinner when refreshing with existing data
        if (state.announcements.length === 0) {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchAnnouncements.fulfilled, (state, action) => {
        state.loading = false;
        state.announcements = action.payload;
        state.totalCount = action.payload.length;
        state.hasLoadedOnce = true; // Set hasLoadedOnce to true on successful fetch
      })
      .addCase(fetchAnnouncements.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch announcements';
      });

    // Fetch announcement by ID
    builder
      .addCase(fetchAnnouncementById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAnnouncementById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedAnnouncement = action.payload;
        
        // Also update the announcement in the list if it exists
        const index = state.announcements.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.announcements[index] = action.payload;
        } else {
          // If announcement is not in the list (e.g., it's new or was filtered out), add it
          // Only add if it's ongoing or upcoming (active announcements)
          if (action.payload.status === 'ongoing' || action.payload.status === 'upcoming') {
            state.announcements.unshift(action.payload);
            state.totalCount += 1;
          }
        }
      })
      .addCase(fetchAnnouncementById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch announcement';
      });

    // Create announcement
    builder
      .addCase(createAnnouncement.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createAnnouncement.fulfilled, (state, action) => {
        state.loading = false;
        state.announcements.unshift(action.payload);
        state.totalCount += 1;
      })
      .addCase(createAnnouncement.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to create announcement';
      });

    // Update announcement
    builder
      .addCase(updateAnnouncement.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateAnnouncement.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.announcements.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.announcements[index] = action.payload;
        }
        if (state.selectedAnnouncement?.id === action.payload.id) {
          state.selectedAnnouncement = action.payload;
        }
      })
      .addCase(updateAnnouncement.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update announcement';
      });

    // Delete announcement
    builder
      .addCase(deleteAnnouncement.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteAnnouncement.fulfilled, (state, action) => {
        state.loading = false;
        state.announcements = state.announcements.filter(a => a.id !== action.payload);
        state.totalCount -= 1;
        if (state.selectedAnnouncement?.id === action.payload) {
          state.selectedAnnouncement = null;
        }
      })
      .addCase(deleteAnnouncement.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to delete announcement';
      });

    // Toggle pin
    builder
      .addCase(togglePin.fulfilled, (state, action) => {
        const index = state.announcements.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.announcements[index] = action.payload;
        }
        if (state.selectedAnnouncement?.id === action.payload.id) {
          state.selectedAnnouncement = action.payload;
        }
      });

    // Increment views
    builder
      .addCase(incrementViews.fulfilled, (state, action) => {
        const announcement = state.announcements.find(a => a.id === action.payload);
        if (announcement) {
          announcement.views += 1;
        }
        if (state.selectedAnnouncement?.id === action.payload) {
          state.selectedAnnouncement.views += 1;
        }
      });

    // Force expire
    builder
      .addCase(forceExpire.fulfilled, (state, action) => {
        const index = state.announcements.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.announcements[index] = action.payload;
        }
        if (state.selectedAnnouncement?.id === action.payload.id) {
          state.selectedAnnouncement = action.payload;
        }
      });

    // Restore announcement
    builder
      .addCase(restoreAnnouncement.fulfilled, (state, action) => {
        const index = state.announcements.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.announcements[index] = action.payload;
        }
        if (state.selectedAnnouncement?.id === action.payload.id) {
          state.selectedAnnouncement = action.payload;
        }
      })
      
      // Clear announcements when user logs out
      .addCase(logout, (state) => {
        console.log('🧹 Clearing announcement data on logout');
        state.announcements = [];
        state.selectedAnnouncement = null;
        state.hasLoadedOnce = false;
        state.error = null;
        state.loading = false;
        state.filters = {};
        state.totalCount = 0;
      });
  },
});

export const {
  setSelectedAnnouncement,
  setFilters,
  clearFilters,
  clearError,
  clearAnnouncements,
} = announcementSlice.actions;

export default announcementSlice.reducer;
