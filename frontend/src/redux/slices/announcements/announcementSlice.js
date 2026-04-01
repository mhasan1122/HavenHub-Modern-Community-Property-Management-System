import { createSlice } from "@reduxjs/toolkit";
import {
  fetchAnnouncements,
  fetchAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  pinAnnouncement,
  unpinAnnouncement,
  togglePinAnnouncement,
  moveToExpired,
  incrementViews,
  restoreAnnouncement,
  updateAnnouncementStatuses,
  fetchTowers,
  fetchUnitsByTower,
  uploadAttachment,
  deleteAttachment
} from "../api/announcementApi";
import { fetchUnreadCount, fetchNotifications } from "../api/notificationApi";

const initialState = {
  // Announcements data
  announcements: [],
  selectedAnnouncement: null,
  
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

const announcementSlice = createSlice({
  name: "announcements",
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
    
    // Clear selected announcement
    clearSelectedAnnouncement: (state) => {
      state.selectedAnnouncement = null;
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
      state.selectedAnnouncement = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch Announcements
    builder
      .addCase(fetchAnnouncements.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAnnouncements.fulfilled, (state, action) => {
        state.loading = false;
        state.announcements = action.payload;
        state.error = null;
      })
      .addCase(fetchAnnouncements.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

    // Fetch Announcement by ID
    builder
      .addCase(fetchAnnouncementById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAnnouncementById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedAnnouncement = action.payload;
        
        // Also update the announcement in the list if it exists
        const index = state.announcements.findIndex(
          (announcement) => announcement.id === action.payload.id
        );
        if (index !== -1) {
          state.announcements[index] = action.payload;
        }
        
        state.error = null;
      })
      .addCase(fetchAnnouncementById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

    // Create Announcement
    builder
      .addCase(createAnnouncement.pending, (state) => {
        state.creating = true;
        state.createError = null;
        state.createSuccess = false;
      })
      .addCase(createAnnouncement.fulfilled, (state, action) => {
        state.creating = false;
        state.createSuccess = true;
        state.message = "Announcement has been successfully created.";
        state.announcements.unshift(action.payload); // Add to beginning of list
        state.createError = null;
        
        // Trigger notification refresh after announcement creation
        // This ensures the notification bell icon updates immediately
      })
      .addCase(createAnnouncement.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload;
        state.createSuccess = false;
      })

    // Update Announcement
    builder
      .addCase(updateAnnouncement.pending, (state) => {
        state.updating = true;
        state.updateError = null;
        state.updateSuccess = false;
      })
      .addCase(updateAnnouncement.fulfilled, (state, action) => {
        state.updating = false;
        state.updateSuccess = true;
        state.message = "Announcement has been successfully updated.";

        // Update the announcement in the list
        const index = state.announcements.findIndex(
          (announcement) => announcement.id === action.payload.id
        );
        if (index !== -1) {
          state.announcements[index] = action.payload;
        }

        // Always update selected announcement with the latest data
        // This ensures target_units_data is properly updated
        state.selectedAnnouncement = action.payload;

        state.updateError = null;
      })
      .addCase(updateAnnouncement.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload;
        state.updateSuccess = false;
      })

    // Delete Announcement
    builder
      .addCase(deleteAnnouncement.pending, (state) => {
        state.deleting = true;
        state.deleteError = null;
      })
      .addCase(deleteAnnouncement.fulfilled, (state, action) => {
        state.deleting = false;
        state.deleteSuccess = true;
        state.message = "Announcement has been successfully deleted.";
        
        // Remove from announcements list
        state.announcements = state.announcements.filter(
          (announcement) => announcement.id !== action.meta.arg
        );
        
        state.deleteError = null;
      })
      .addCase(deleteAnnouncement.rejected, (state, action) => {
        state.deleting = false;
        state.deleteError = action.payload;
      })

    // Pin/Unpin Announcement
    builder
      .addCase(pinAnnouncement.fulfilled, (state, action) => {
        const index = state.announcements.findIndex(
          (announcement) => announcement.id === action.payload.id
        );
        if (index !== -1) {
          state.announcements[index] = action.payload;
        }
      })
      .addCase(unpinAnnouncement.fulfilled, (state, action) => {
        const index = state.announcements.findIndex(
          (announcement) => announcement.id === action.payload.id
        );
        if (index !== -1) {
          state.announcements[index] = action.payload;
        }
      })
      .addCase(togglePinAnnouncement.fulfilled, (state, action) => {
        const index = state.announcements.findIndex(
          (announcement) => announcement.id === action.payload.id
        );
        if (index !== -1) {
          // Update only the pin status, keep other announcement data
          state.announcements[index].pinned = action.payload.is_pinned;
          state.announcements[index].isPinned = action.payload.is_pinned;
        }
      })

    // Move to Expired
    builder
      .addCase(moveToExpired.pending, (state) => {
        state.updating = true;
      })
      .addCase(moveToExpired.fulfilled, (state, action) => {
        state.updating = false;
        const index = state.announcements.findIndex(
          (announcement) => announcement.id === action.payload.id
        );
        if (index !== -1) {
          // Update the status and manually_expired fields
          state.announcements[index].status = 'expired';
          state.announcements[index].manuallyExpired = true;
        }
      })
      .addCase(moveToExpired.rejected, (state, action) => {
        state.updating = false;
        state.error = action.payload;
      })

    // Increment Views
    builder
      .addCase(incrementViews.fulfilled, (state, action) => {
        const index = state.announcements.findIndex(
          (announcement) => announcement.id === action.payload.id
        );
        if (index !== -1) {
          state.announcements[index].views = action.payload.views;
        }
      })

    // Restore Announcement
    builder
      .addCase(restoreAnnouncement.pending, (state) => {
        state.updating = true;
      })
      .addCase(restoreAnnouncement.fulfilled, (state, action) => {
        state.updating = false;
        const index = state.announcements.findIndex(
          (announcement) => announcement.id === action.payload.id
        );
        if (index !== -1) {
          // Update the status and manually_expired fields
          state.announcements[index].status = action.payload.status;
          state.announcements[index].manuallyExpired = false;
        }
      })
      .addCase(restoreAnnouncement.rejected, (state, action) => {
        state.updating = false;
        state.error = action.payload;
      })

    // Update Announcement Statuses
    builder
      .addCase(updateAnnouncementStatuses.fulfilled, (state, action) => {
        // The API returns a message about updated count, but we need to reload announcements
        // This is handled in the component by calling loadAnnouncements() after this action
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
  clearSelectedAnnouncement,
  resetCreateState,
  resetUpdateState,
  clearAllStates,
} = announcementSlice.actions;

export default announcementSlice.reducer;
