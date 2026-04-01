import { createSlice } from "@reduxjs/toolkit";
import {
  fetchBulletins,
  fetchBulletinById,
  createBulletin,
  updateBulletin,
  deleteBulletin,
  pinBulletin,
  unpinBulletin,
  togglePinBulletin,
  moveToArchive,
  incrementViews,
  restoreBulletin,
  approveBulletin,
  rejectBulletin,
  addCommentToBulletin,
  fetchTowers,
  fetchUnitsByTower,
  uploadAttachment,
  deleteAttachment
} from "../api/bulletinApi";

const initialState = {
  // Bulletins data
  bulletins: [],
  selectedBulletin: null,
  
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
  activeTab: 1, // 1: Current, 2: Pending, 3: Archive
};

const bulletinSlice = createSlice({
  name: "bulletins",
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
    
    // Clear selected bulletin
    clearSelectedBulletin: (state) => {
      state.selectedBulletin = null;
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
    },
    
    // Clear all states
    clearAllStates: (state) => {
      return { ...initialState };
    },
  },
  extraReducers: (builder) => {
    // Fetch bulletins
    builder
      .addCase(fetchBulletins.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBulletins.fulfilled, (state, action) => {
        state.loading = false;
        state.bulletins = action.payload;
        state.error = null;
      })
      .addCase(fetchBulletins.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

    // Fetch bulletin by ID
    builder
      .addCase(fetchBulletinById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBulletinById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedBulletin = action.payload;
        state.error = null;
      })
      .addCase(fetchBulletinById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

    // Create bulletin
    builder
      .addCase(createBulletin.pending, (state) => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createBulletin.fulfilled, (state, action) => {
        state.creating = false;
        state.bulletins.unshift(action.payload);
        state.createSuccess = true;
        state.message = "Bulletin created successfully";
        state.createError = null;
      })
      .addCase(createBulletin.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload;
        state.createSuccess = false;
      })

    // Update bulletin
    builder
      .addCase(updateBulletin.pending, (state) => {
        state.updating = true;
        state.updateError = null;
      })
      .addCase(updateBulletin.fulfilled, (state, action) => {
        state.updating = false;
        const index = state.bulletins.findIndex(bulletin => bulletin.id === action.payload.id);
        if (index !== -1) {
          state.bulletins[index] = action.payload;
        }
        state.selectedBulletin = action.payload;
        state.updateSuccess = true;
        state.message = "Bulletin updated successfully and is now under admin review";
        state.updateError = null;
      })
      .addCase(updateBulletin.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload;
        state.updateSuccess = false;
      })

    // Delete bulletin
    builder
      .addCase(deleteBulletin.pending, (state) => {
        state.deleting = true;
        state.deleteError = null;
      })
      .addCase(deleteBulletin.fulfilled, (state, action) => {
        state.deleting = false;
        state.bulletins = state.bulletins.filter(bulletin => bulletin.id !== action.payload);
        state.deleteSuccess = true;
        state.message = "Bulletin deleted successfully";
        state.deleteError = null;
      })
      .addCase(deleteBulletin.rejected, (state, action) => {
        state.deleting = false;
        state.deleteError = action.payload;
        state.deleteSuccess = false;
      })

    // Pin/Unpin bulletin
    builder
      .addCase(pinBulletin.fulfilled, (state, action) => {
        const index = state.bulletins.findIndex(bulletin => bulletin.id === action.payload.id);
        if (index !== -1) {
          state.bulletins[index].is_pinned = action.payload.is_pinned;
        }
        state.message = action.payload.message;
      })
      .addCase(pinBulletin.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(unpinBulletin.fulfilled, (state, action) => {
        const index = state.bulletins.findIndex(bulletin => bulletin.id === action.payload.id);
        if (index !== -1) {
          state.bulletins[index].is_pinned = action.payload.is_pinned;
        }
        state.message = action.payload.message;
      })
      .addCase(unpinBulletin.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(togglePinBulletin.fulfilled, (state, action) => {
        const index = state.bulletins.findIndex(bulletin => bulletin.id === action.payload.id);
        if (index !== -1) {
          state.bulletins[index].is_pinned = action.payload.is_pinned;
        }
        state.message = action.payload.message;
      })
      .addCase(togglePinBulletin.rejected, (state, action) => {
        state.error = action.payload;
      })

    // Approve bulletin
    builder
      .addCase(approveBulletin.fulfilled, (state, action) => {
        const index = state.bulletins.findIndex(bulletin => bulletin.id === action.payload.id);
        if (index !== -1) {
          state.bulletins[index].status = action.payload.status;
        }
        state.message = action.payload.message;
      })

    // Reject bulletin
    builder
      .addCase(rejectBulletin.fulfilled, (state, action) => {
        const index = state.bulletins.findIndex(bulletin => bulletin.id === action.payload.id);
        if (index !== -1) {
          state.bulletins[index].status = action.payload.status;
        }
        state.message = action.payload.message;
      })

    // Add comment to bulletin
    builder
      .addCase(addCommentToBulletin.fulfilled, (state, action) => {
        // The comment is added to the backend, but we need to refresh the bulletin
        // to get the updated history. Since the API doesn't return the updated bulletin,
        // we just set a success message here. The actual refresh happens in the component.
        state.message = action.payload.message;
      })

    // Move to archive
    builder
      .addCase(moveToArchive.fulfilled, (state, action) => {
        const index = state.bulletins.findIndex(bulletin => bulletin.id === action.payload.id);
        if (index !== -1) {
          state.bulletins[index].status = action.payload.status;
        }
        state.message = action.payload.message;
      })

    // Restore bulletin
    builder
      .addCase(restoreBulletin.fulfilled, (state, action) => {
        const index = state.bulletins.findIndex(bulletin => bulletin.id === action.payload.id);
        if (index !== -1) {
          state.bulletins[index].status = action.payload.status;
        }
        state.message = action.payload.message;
      })

    // Increment views
    builder
      .addCase(incrementViews.fulfilled, (state, action) => {
        const index = state.bulletins.findIndex(bulletin => bulletin.id === action.payload.id);
        if (index !== -1) {
          state.bulletins[index].views = action.payload.views;
        }
      })

    // Fetch towers
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

    // Fetch units by tower
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

    // Upload attachment
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

    // Delete attachment
    builder
      .addCase(deleteAttachment.fulfilled, (state, action) => {
        state.attachments = state.attachments.filter(attachment => attachment.id !== action.payload);
      });
  },
});

export const {
  clearErrors,
  clearSuccess,
  setActiveTab,
  clearSelectedBulletin,
  resetCreateState,
  resetUpdateState,
  clearAllStates,
} = bulletinSlice.actions;

export default bulletinSlice.reducer;
