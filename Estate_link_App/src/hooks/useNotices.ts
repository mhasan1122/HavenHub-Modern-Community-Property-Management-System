import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  fetchNotices,
  fetchNoticeById,
  createNotice,
  updateNotice,
  deleteNotice,
  togglePin,
  incrementViews,
  forceExpire,
  restoreNotice,
  fetchTowers,
  fetchUnits,
  fetchLabels,
  setFilters,
  clearFilters,
  clearError,
  setSelectedNotice,
} from '../store/slices/noticeSlice';
import { NoticeFilters, CreateNoticeData, UpdateNoticeData } from '../types/notice';
import { NoticeService } from '../services/noticeService';

export const useNotices = () => {
  const dispatch = useAppDispatch();
  const {
    notices,
    loading,
    error,
    selectedNotice,
    filters,
    totalCount,
    hasLoadedOnce, // Add this property
  } = useAppSelector((state) => state.notices);

  // Fetch all notices
  const getNotices = useCallback(
    (filters?: NoticeFilters) => {
      dispatch(fetchNotices(filters));
    },
    [dispatch]
  );

  // Fetch notice by ID
  const getNoticeById = useCallback(
    (id: number) => {
      dispatch(fetchNoticeById(id));
    },
    [dispatch]
  );

  // Create new notice
  const createNewNotice = useCallback(
    (data: CreateNoticeData) => {
      return dispatch(createNotice(data));
    },
    [dispatch]
  );

  // Update notice
  const updateExistingNotice = useCallback(
    (id: number, data: UpdateNoticeData) => {
      return dispatch(updateNotice({ id, data }));
    },
    [dispatch]
  );

  // Delete notice
  const deleteExistingNotice = useCallback(
    (id: number) => {
      return dispatch(deleteNotice(id));
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

  // Force expire notice
  const forceExpireNotice = useCallback(
    (id: number) => {
      return dispatch(forceExpire(id));
    },
    [dispatch]
  );

  // Restore expired notice
  const restoreExpiredNotice = useCallback(
    (id: number) => {
      return dispatch(restoreNotice(id));
    },
    [dispatch]
  );

  // Update all notice statuses
  const updateNoticeStatuses = useCallback(() => {
    // This would need to be added to the slice if we want to dispatch it
    // For now, we'll call the service directly
    return NoticeService.updateNoticeStatuses();
  }, []);

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
  const setNoticeFilters = useCallback(
    (newFilters: NoticeFilters) => {
      dispatch(setFilters(newFilters));
    },
    [dispatch]
  );

  // Clear filters
  const clearNoticeFilters = useCallback(() => {
    dispatch(clearFilters());
  }, [dispatch]);

  // Clear error
  const clearNoticeError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  // Set selected notice
  const setSelectedNoticeData = useCallback(
    (notice: any) => {
      dispatch(setSelectedNotice(notice));
    },
    [dispatch]
  );

  // Get filtered notices
  const getFilteredNotices = useCallback(() => {
    let filtered = [...notices];

    if (filters.status) {
      filtered = filtered.filter(n => n.status === filters.status);
    }

    if (filters.priority) {
      filtered = filtered.filter(n => n.priority === filters.priority);
    }

    if (filters.label) {
      filtered = filtered.filter(n => n.label === filters.label);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(n => 
        n.internal_title.toLowerCase().includes(searchLower)
      );
    }

    if (filters.my_posts) {
      // Assuming you have user ID in auth state
      // filtered = filtered.filter(n => n.creator === userId);
    }

    return filtered;
  }, [notices, filters]);

  // Get notices by status
  const getNoticesByStatus = useCallback(() => {
    const statusCounts: Record<string, number> = {};
    notices.forEach(notice => {
      statusCounts[notice.status] = (statusCounts[notice.status] || 0) + 1;
    });
    return statusCounts;
  }, [notices]);

  // Get pinned notices
  const getPinnedNotices = useCallback(() => {
    return notices.filter(n => n.is_pinned);
  }, [notices]);

  // Get urgent notices
  const getUrgentNotices = useCallback(() => {
    return notices.filter(n => n.priority === 'urgent');
  }, [notices]);

  // Get active notices (ongoing + upcoming)
  const getActiveNotices = useCallback(() => {
    return notices.filter(n => 
      n.status === 'ongoing' || n.status === 'upcoming'
    );
  }, [notices]);

  return {
    // State
    notices,
    loading,
    error,
    selectedNotice,
    filters,
    totalCount,
    hasLoadedOnce,
    
    // Actions
    getNotices,
    getNoticeById,
    createNewNotice,
    updateExistingNotice,
    deleteExistingNotice,
    togglePinStatus,
    incrementViewCount,
    forceExpireNotice,
    restoreExpiredNotice,
    updateNoticeStatuses,
    getTowers,
    getUnits,
    getLabels,
    setNoticeFilters,
    clearNoticeFilters,
    clearNoticeError,
    setSelectedNoticeData,
    
    // Computed values
    getFilteredNotices,
    getNoticesByStatus,
    getPinnedNotices,
    getUrgentNotices,
    getActiveNotices,
  };
};
