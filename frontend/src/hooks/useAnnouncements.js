import { useSelector, useDispatch } from 'react-redux';
import { useCallback, useEffect } from 'react';
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
  fetchLabels,
} from '../redux/slices/api/announcementApi';
import {
  clearErrors,
  clearSuccess,
  setActiveTab,
  clearSelectedAnnouncement,
  resetCreateState,
  resetUpdateState,
  clearAllStates,
} from '../redux/slices/announcements/announcementSlice';
import { 
  formatAnnouncementForApi, 
  validateAnnouncementData,
  filterAnnouncementsByStatus 
} from '../Features/CommunicationPortal/Announcements/utils/announcementUtils';

export const useAnnouncements = () => {
  const dispatch = useDispatch();
  
  // Selectors
  const {
    announcements,
    selectedAnnouncement,
    loading,
    creating,
    updating,
    deleting,
    error,
    createError,
    updateError,
    deleteError,
    message,
    createSuccess,
    updateSuccess,
    deleteSuccess,
    towers,
    units,
    towersLoading,
    unitsLoading,
    activeTab,
  } = useSelector((state) => state.announcements);

  // Actions
  const actions = {
    // Fetch announcements
    loadAnnouncements: useCallback(async (params = {}) => {
      return await dispatch(fetchAnnouncements(params));
    }, [dispatch]),

    // Fetch single announcement
    loadAnnouncement: useCallback(async (id) => {
      return await dispatch(fetchAnnouncementById(id));
    }, [dispatch]),

    // Create announcement
    createNewAnnouncement: useCallback(async (formData, attachments = []) => {
      try {
        // Validate form data
        const validation = validateAnnouncementData(formData);
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${Object.values(validation.errors).join(', ')}`);
        }

        // Format data for API
        const apiData = await formatAnnouncementForApi(formData, attachments);

        // Dispatch create action
        const result = await dispatch(createAnnouncement(apiData));

        if (createAnnouncement.fulfilled.match(result)) {
          return { success: true, data: result.payload };
        } else {
          return { success: false, error: result.payload };
        }
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, [dispatch]),

    // Update announcement
    updateExistingAnnouncement: useCallback(async (id, formData, attachments = []) => {
      try {
        // Validate form data
        const validation = validateAnnouncementData(formData);
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${Object.values(validation.errors).join(', ')}`);
        }

        // Format data for API
        const apiData = await formatAnnouncementForApi(formData, attachments);

        // Dispatch update action
        const result = await dispatch(updateAnnouncement({ id, data: apiData }));

        if (updateAnnouncement.fulfilled.match(result)) {
          return { success: true, data: result.payload };
        } else {
          return { success: false, error: result.payload };
        }
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, [dispatch]),

    // Delete announcement
    removeAnnouncement: useCallback(async (id) => {
      return await dispatch(deleteAnnouncement(id));
    }, [dispatch]),

    // Pin/Unpin announcement (legacy method)
    togglePin: useCallback(async (id, isPinned) => {
      if (isPinned) {
        return await dispatch(unpinAnnouncement(id));
      } else {
        return await dispatch(pinAnnouncement(id));
      }
    }, [dispatch]),

    // Toggle pin announcement (new method using backend toggle_pin endpoint)
    togglePinStatus: useCallback(async (id) => {
      return await dispatch(togglePinAnnouncement(id));
    }, [dispatch]),

    // Move to expired
    moveAnnouncementToExpired: useCallback(async (id) => {
      return await dispatch(moveToExpired(id));
    }, [dispatch]),

    // Increment views
    incrementAnnouncementViews: useCallback(async (id) => {
      return await dispatch(incrementViews(id));
    }, [dispatch]),

    // Restore announcement
    restoreExpiredAnnouncement: useCallback(async (id) => {
      return await dispatch(restoreAnnouncement(id));
    }, [dispatch]),

    // Update all statuses
    updateAllStatuses: useCallback(async () => {
      return await dispatch(updateAnnouncementStatuses());
    }, [dispatch]),

    // Load towers
    loadTowers: useCallback(async () => {
      return await dispatch(fetchTowers());
    }, [dispatch]),

    // Load units by tower
    loadUnitsByTower: useCallback(async (towerId) => {
      return await dispatch(fetchUnitsByTower(towerId));
    }, [dispatch]),

    // Load labels
    loadLabels: useCallback(async () => {
      return await dispatch(fetchLabels());
    }, [dispatch]),

    // UI actions
    clearAllErrors: useCallback(() => {
      dispatch(clearErrors());
    }, [dispatch]),

    clearAllSuccess: useCallback(() => {
      dispatch(clearSuccess());
    }, [dispatch]),

    changeActiveTab: useCallback((tab) => {
      dispatch(setActiveTab(tab));
    }, [dispatch]),

    clearSelected: useCallback(() => {
      dispatch(clearSelectedAnnouncement());
    }, [dispatch]),

    resetCreate: useCallback(() => {
      dispatch(resetCreateState());
    }, [dispatch]),

    resetUpdate: useCallback(() => {
      dispatch(resetUpdateState());
    }, [dispatch]),
  };

  // Computed values
  const computed = {
    // Filter announcements by status
    getFilteredAnnouncements: useCallback((status = null) => {
      if (!status) {
        // Return based on active tab
        const statusMap = { 1: 'ongoing', 2: 'upcoming', 3: 'expired' };
        status = statusMap[activeTab] || 'ongoing';
      }
      return filterAnnouncementsByStatus(announcements, status);
    }, [announcements, activeTab]),

    // Get ongoing announcements
    ongoingAnnouncements: filterAnnouncementsByStatus(announcements, 'ongoing'),

    // Get upcoming announcements
    upcomingAnnouncements: filterAnnouncementsByStatus(announcements, 'upcoming'),

    // Get expired announcements
    expiredAnnouncements: filterAnnouncementsByStatus(announcements, 'expired'),

    // Check if any operation is in progress
    isLoading: loading || creating || updating || deleting,

    // Check if there are any errors
    hasError: !!(error || createError || updateError || deleteError),

    // Get current error message
    currentError: error || createError || updateError || deleteError,

    // Check if there are any success states
    hasSuccess: !!(createSuccess || updateSuccess || deleteSuccess),

    // Get current success message
    currentMessage: message,
  };

  return {
    // State
    announcements,
    selectedAnnouncement,
    loading,
    creating,
    updating,
    deleting,
    error,
    createError,
    updateError,
    deleteError,
    message,
    createSuccess,
    updateSuccess,
    deleteSuccess,
    towers,
    units,
    towersLoading,
    unitsLoading,
    activeTab,

    // Actions
    ...actions,

    // Computed values
    ...computed,
  };
};

// Hook specifically for announcement creation
export const useAnnouncementCreate = () => {
  const dispatch = useDispatch();
  const { creating, createError, createSuccess, message } = useSelector(
    (state) => state.announcements
  );

  const createAnnouncementAction = useCallback(async (formData, attachments = []) => {
    try {
      const validation = validateAnnouncementData(formData);
      if (!validation.isValid) {
        return { success: false, errors: validation.errors };
      }

      const apiData = await formatAnnouncementForApi(formData, attachments);
      const result = await dispatch(createAnnouncement(apiData));

      return {
        success: createAnnouncement.fulfilled.match(result),
        data: result.payload,
        error: createAnnouncement.rejected.match(result) ? result.payload : null
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [dispatch]);

  const resetState = useCallback(() => {
    dispatch(resetCreateState());
  }, [dispatch]);

  return {
    creating,
    createError,
    createSuccess,
    message,
    createAnnouncement: createAnnouncementAction,
    resetState,
  };
};

// Hook specifically for announcement editing
export const useAnnouncementEdit = () => {
  const dispatch = useDispatch();
  const {
    selectedAnnouncement,
    updating,
    updateError,
    updateSuccess,
    message,
    loading,
    error
  } = useSelector((state) => state.announcements);

  const loadAnnouncement = useCallback((id) => {
    return dispatch(fetchAnnouncementById(id));
  }, [dispatch]);

  const updateAnnouncementAction = useCallback(async (id, formData, attachments = []) => {
    try {
      const validation = validateAnnouncementData(formData);
      if (!validation.isValid) {
        return { success: false, errors: validation.errors };
      }

      const apiData = await formatAnnouncementForApi(formData, attachments);
      const result = await dispatch(updateAnnouncement({ id, data: apiData }));

      return {
        success: updateAnnouncement.fulfilled.match(result),
        data: result.payload,
        error: updateAnnouncement.rejected.match(result) ? result.payload : null
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [dispatch]);

  const resetState = useCallback(() => {
    dispatch(resetUpdateState());
  }, [dispatch]);

  const clearSelected = useCallback(() => {
    dispatch(clearSelectedAnnouncement());
  }, [dispatch]);

  const clearAllState = useCallback(() => {
    dispatch(clearAllStates());
  }, [dispatch]);

  return {
    selectedAnnouncement,
    loading,
    updating,
    updateError,
    updateSuccess,
    message,
    error,
    loadAnnouncement,
    updateAnnouncement: updateAnnouncementAction,
    resetState,
    clearSelected,
    clearAllState,
  };
};
