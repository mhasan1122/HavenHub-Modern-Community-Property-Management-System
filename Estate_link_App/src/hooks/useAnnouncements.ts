import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  fetchAnnouncements,
  fetchAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  togglePin,
  incrementViews,
  forceExpire,
  restoreAnnouncement,
  fetchTowers,
  fetchUnits,
  fetchLabels,
  setFilters,
  clearFilters,
  clearError,
  setSelectedAnnouncement,
} from '../store/slices/announcementSlice';
import { AnnouncementFilters, CreateAnnouncementData, UpdateAnnouncementData } from '../types/announcement';

export const useAnnouncements = () => {
  const dispatch = useAppDispatch();
  const {
    announcements,
    loading,
    error,
    selectedAnnouncement,
    filters,
    totalCount,
    hasLoadedOnce, // Add this property
  } = useAppSelector((state) => state.announcements);

  // Fetch all announcements
  const getAnnouncements = useCallback(
    (filters?: AnnouncementFilters) => {
      dispatch(fetchAnnouncements(filters));
    },
    [dispatch]
  );

  // Fetch announcement by ID
  const getAnnouncementById = useCallback(
    (id: number) => {
      return dispatch(fetchAnnouncementById(id));
    },
    [dispatch]
  );

  // Create new announcement
  const createNewAnnouncement = useCallback(
    (data: CreateAnnouncementData) => {
      return dispatch(createAnnouncement(data));
    },
    [dispatch]
  );

  // Update announcement
  const updateExistingAnnouncement = useCallback(
    (id: number, data: UpdateAnnouncementData) => {
      return dispatch(updateAnnouncement({ id, data }));
    },
    [dispatch]
  );

  // Delete announcement
  const deleteExistingAnnouncement = useCallback(
    (id: number) => {
      return dispatch(deleteAnnouncement(id));
    },
    [dispatch]
  );

  // Toggle pin status
  const togglePinStatus = useCallback(
    (id: number) => {
      return dispatch(togglePin(id));
    },
    [dispatch]
  );

  // Increment views
  const incrementViewCount = useCallback(
    (id: number) => {
      dispatch(incrementViews(id));
    },
    [dispatch]
  );

  // Force expire announcement
  const forceExpireAnnouncement = useCallback(
    (id: number) => {
      return dispatch(forceExpire(id));
    },
    [dispatch]
  );

  // Restore expired announcement
  const restoreExpiredAnnouncement = useCallback(
    (id: number) => {
      return dispatch(restoreAnnouncement(id));
    },
    [dispatch]
  );

  // Fetch towers
  const getTowers = useCallback(() => {
    dispatch(fetchTowers());
  }, [dispatch]);

  // Fetch units
  const getUnits = useCallback(
    (towerIds?: number[]) => {
      dispatch(fetchUnits(towerIds));
    },
    [dispatch]
  );

  // Fetch labels
  const getLabels = useCallback(() => {
    dispatch(fetchLabels());
  }, [dispatch]);

  // Set filters
  const setAnnouncementFilters = useCallback(
    (newFilters: AnnouncementFilters) => {
      dispatch(setFilters(newFilters));
    },
    [dispatch]
  );

  // Clear filters
  const clearAnnouncementFilters = useCallback(() => {
    dispatch(clearFilters());
  }, [dispatch]);

  // Clear error
  const clearAnnouncementError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  // Set selected announcement
  const setSelectedAnnouncementData = useCallback(
    (announcement: any) => {
      dispatch(setSelectedAnnouncement(announcement));
    },
    [dispatch]
  );

  // Get filtered announcements
  const getFilteredAnnouncements = useCallback(() => {
    let filtered = [...announcements];

    if (filters.status) {
      filtered = filtered.filter(a => a.status === filters.status);
    }

    if (filters.priority) {
      filtered = filtered.filter(a => a.priority === filters.priority);
    }

    if (filters.label) {
      filtered = filtered.filter(a => a.label === filters.label);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(a => 
        a.title.toLowerCase().includes(searchLower) ||
        (a.description && a.description.toLowerCase().includes(searchLower))
      );
    }

    if (filters.my_posts) {
      // Assuming you have user ID in auth state
      // filtered = filtered.filter(a => a.creator === userId);
    }

    return filtered;
  }, [announcements, filters]);

  // Get announcements by status
  const getAnnouncementsByStatus = useCallback(() => {
    const statusCounts: Record<string, number> = {};
    announcements.forEach(announcement => {
      statusCounts[announcement.status] = (statusCounts[announcement.status] || 0) + 1;
    });
    return statusCounts;
  }, [announcements]);

  // Get pinned announcements (only active ones: ongoing or upcoming)
  const getPinnedAnnouncements = useCallback(() => {
    return announcements.filter(a => 
      a.is_pinned && (a.status === 'ongoing' || a.status === 'upcoming')
    );
  }, [announcements]);

  // Get urgent announcements
  const getUrgentAnnouncements = useCallback(() => {
    return announcements.filter(a => a.priority === 'urgent');
  }, [announcements]);

  // Get active announcements (ongoing + upcoming)
  const getActiveAnnouncements = useCallback(() => {
    return announcements.filter(a => 
      a.status === 'ongoing' || a.status === 'upcoming'
    );
  }, [announcements]);

  return {
    // State
    announcements,
    loading,
    error,
    selectedAnnouncement,
    filters,
    totalCount,
    hasLoadedOnce,
    
    // Actions
    getAnnouncements,
    getAnnouncementById,
    createNewAnnouncement,
    updateExistingAnnouncement,
    deleteExistingAnnouncement,
    togglePinStatus,
    incrementViewCount,
    forceExpireAnnouncement,
    restoreExpiredAnnouncement,
    getTowers,
    getUnits,
    getLabels,
    setAnnouncementFilters,
    clearAnnouncementFilters,
    clearAnnouncementError,
    setSelectedAnnouncementData,
    
    // Computed values
    getFilteredAnnouncements,
    getAnnouncementsByStatus,
    getPinnedAnnouncements,
    getUrgentAnnouncements,
    getActiveAnnouncements,
  };
};
