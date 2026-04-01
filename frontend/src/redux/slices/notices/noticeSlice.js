import { createSlice } from "@reduxjs/toolkit";
import {
  fetchNotices,
  fetchNoticeById,
  createNotice,
  updateNotice,
  deleteNotice,
  pinNotice,
  unpinNotice,
  togglePinNotice,
  moveToExpired,
  incrementViews,
  restoreNotice,
  updateNoticeStatuses,
  fetchTowers,
  fetchUnitsByTower,
  uploadAttachment,
  deleteAttachment
} from "../api/noticeApi";

const initialState = {
  // Notices data
  notices: [],
  selectedNotice: null,
  
  // Loading states
  loading: false,
  creating: false,
  updating: false,
  deleting: false,
  
  // Error states
  error: null,
  createError: null,
  updateError: null,
  deleteError: null,
  
  // Success states
  message: null,
  createSuccess: false,
  updateSuccess: false,
  deleteSuccess: false,
  
  // Related data
  towers: [],
  units: [],
  towersLoading: false,
  unitsLoading: false,
  
  // Attachments
  attachments: [],
  uploadingAttachment: false,
  attachmentError: null,
  
  // UI state
  activeTab: 1, // 1: Ongoing, 2: Upcoming, 3: Expired
};

const noticeSlice = createSlice({
  name: "notices",
  initialState,
  reducers: {
    // Clear error states
    clearErrors: (state) => {
      state.error = null;
      state.createError = null;
      state.updateError = null;
      state.deleteError = null;
      state.attachmentError = null;
    },
    
    // Clear success states
    clearSuccess: (state) => {
      state.message = null;
      state.createSuccess = false;
      state.updateSuccess = false;
      state.deleteSuccess = false;
    },
    
    // Set active tab
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
    
    // Clear selected notice
    clearSelectedNotice: (state) => {
      state.selectedNotice = null;
    },
    
    // Reset create state
    resetCreateState: (state) => {
      state.creating = false;
      state.createError = null;
      state.createSuccess = false;
    },
    
    // Reset update state
    resetUpdateState: (state) => {
      state.updating = false;
      state.updateError = null;
      state.updateSuccess = false;
      state.message = null;
    },

    // Clear all states (for complete reset)
    clearAllStates: (state) => {
      state.error = null;
      state.createError = null;
      state.updateError = null;
      state.deleteError = null;
      state.attachmentError = null;
      state.message = null;
      state.createSuccess = false;
      state.updateSuccess = false;
      state.deleteSuccess = false;
      state.selectedNotice = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch Notices
    builder
      .addCase(fetchNotices.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotices.fulfilled, (state, action) => {
        state.loading = false;
        state.notices = action.payload;
        state.error = null;
      })
      .addCase(fetchNotices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

    // Fetch Notice by ID
    builder
      .addCase(fetchNoticeById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNoticeById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedNotice = action.payload;
        state.error = null;
      })
      .addCase(fetchNoticeById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

    // Create Notice
    builder
      .addCase(createNotice.pending, (state) => {
        state.creating = true;
        state.createError = null;
        state.createSuccess = false;
      })
      .addCase(createNotice.fulfilled, (state, action) => {
        state.creating = false;
        state.createSuccess = true;
        state.message = "Notice has been successfully created.";
        state.notices.unshift(action.payload); // Add to beginning of list
        state.createError = null;
      })
      .addCase(createNotice.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload;
        state.createSuccess = false;
      })

    // Update Notice
    builder
      .addCase(updateNotice.pending, (state) => {
        state.updating = true;
        state.updateError = null;
        state.updateSuccess = false;
      })
      .addCase(updateNotice.fulfilled, (state, action) => {
        state.updating = false;
        state.updateSuccess = true;
        state.message = "Notice has been successfully updated.";

        // Update the notice in the list
        const index = state.notices.findIndex(
          (notice) => notice.id === action.payload.id
        );
        if (index !== -1) {
          state.notices[index] = action.payload;
        }

        // Always update selected notice with the latest data
        // This ensures target_units_data is properly updated
        state.selectedNotice = action.payload;

        state.updateError = null;
      })
      .addCase(updateNotice.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload;
        state.updateSuccess = false;
      })

    // Delete Notice
    builder
      .addCase(deleteNotice.pending, (state) => {
        state.deleting = true;
        state.deleteError = null;
      })
      .addCase(deleteNotice.fulfilled, (state, action) => {
        state.deleting = false;
        state.deleteSuccess = true;
        state.message = "Notice has been successfully deleted.";
        
        // Remove from notices list
        state.notices = state.notices.filter(
          (notice) => notice.id !== action.meta.arg
        );
        
        state.deleteError = null;
      })
      .addCase(deleteNotice.rejected, (state, action) => {
        state.deleting = false;
        state.deleteError = action.payload;
      })

    // Pin/Unpin Notice
    builder
      .addCase(pinNotice.fulfilled, (state, action) => {
        const index = state.notices.findIndex(
          (notice) => notice.id === action.payload.id
        );
        if (index !== -1) {
          state.notices[index] = action.payload;
        }
      })
      .addCase(unpinNotice.fulfilled, (state, action) => {
        const index = state.notices.findIndex(
          (notice) => notice.id === action.payload.id
        );
        if (index !== -1) {
          state.notices[index] = action.payload;
        }
      })
      .addCase(togglePinNotice.fulfilled, (state, action) => {
        const index = state.notices.findIndex(
          (notice) => notice.id === action.payload.id
        );
        if (index !== -1) {
          // Update only the pin status, keep other notice data
          state.notices[index].pinned = action.payload.is_pinned;
          state.notices[index].isPinned = action.payload.is_pinned;
          state.notices[index].is_pinned = action.payload.is_pinned;
        }
      })

    // Move to Expired
    builder
      .addCase(moveToExpired.fulfilled, (state, action) => {
        const index = state.notices.findIndex(
          (notice) => notice.id === action.payload.id
        );
        if (index !== -1) {
          // Update only the status and manually_expired fields, keep other notice data
          state.notices[index].status = action.payload.status;
          state.notices[index].manuallyExpired = action.payload.manually_expired;
        }
      })

    // Increment Views
    builder
      .addCase(incrementViews.fulfilled, (state, action) => {
        const index = state.notices.findIndex(
          (notice) => notice.id === action.payload.id
        );
        if (index !== -1) {
          state.notices[index].views = action.payload.views;
        }
      })

    // Restore Notice
    builder
      .addCase(restoreNotice.fulfilled, (state, action) => {
        const index = state.notices.findIndex(
          (notice) => notice.id === action.payload.id
        );
        if (index !== -1) {
          // Update only the status and manually_expired fields, keep other notice data
          state.notices[index].status = action.payload.status;
          state.notices[index].manuallyExpired = action.payload.manually_expired;
        }
      })

    // Update Notice Statuses
    builder
      .addCase(updateNoticeStatuses.fulfilled, (state, action) => {
        // The API returns a message about updated count, but we need to reload notices
        // This is handled in the component by calling loadNotices() after this action
        console.log('Status update completed:', action.payload);
      })

    // Fetch Towers
    builder
      .addCase(fetchTowers.pending, (state) => {
        state.towersLoading = true;
      })
      .addCase(fetchTowers.fulfilled, (state, action) => {
        state.towersLoading = false;
        state.towers = action.payload;
      })
      .addCase(fetchTowers.rejected, (state, action) => {
        state.towersLoading = false;
        state.error = action.payload;
      })

    // Fetch Units by Tower
    builder
      .addCase(fetchUnitsByTower.pending, (state) => {
        state.unitsLoading = true;
      })
      .addCase(fetchUnitsByTower.fulfilled, (state, action) => {
        state.unitsLoading = false;
        state.units = action.payload;
      })
      .addCase(fetchUnitsByTower.rejected, (state, action) => {
        state.unitsLoading = false;
        state.error = action.payload;
      })

    // Upload Attachment
    builder
      .addCase(uploadAttachment.pending, (state) => {
        state.uploadingAttachment = true;
        state.attachmentError = null;
      })
      .addCase(uploadAttachment.fulfilled, (state, action) => {
        state.uploadingAttachment = false;
        state.attachments.push(action.payload);
      })
      .addCase(uploadAttachment.rejected, (state, action) => {
        state.uploadingAttachment = false;
        state.attachmentError = action.payload;
      })

    // Delete Attachment
    builder
      .addCase(deleteAttachment.fulfilled, (state, action) => {
        state.attachments = state.attachments.filter(
          (attachment) => attachment.id !== action.meta.arg
        );
      });
  },
});

export const {
  clearErrors,
  clearSuccess,
  setActiveTab,
  clearSelectedNotice,
  resetCreateState,
  resetUpdateState,
  clearAllStates,
} = noticeSlice.actions;

export default noticeSlice.reducer;
