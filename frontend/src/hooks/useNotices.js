import { useDispatch, useSelector } from 'react-redux';
import { useCallback } from 'react';
import {
  fetchNotices,
  fetchNoticeById,
  createNotice,
  updateNotice,
  deleteNotice,
  togglePinNotice,
  moveToExpired,
  incrementViews,
  restoreNotice,
  updateNoticeStatuses
} from '../redux/slices/api/noticeApi';
import {
  clearErrors,
  clearSuccess,
  setActiveTab,
  clearSelectedNotice,
  resetCreateState,
  resetUpdateState,
  clearAllStates
} from '../redux/slices/notices/noticeSlice';

/**
 * Custom hook for managing notices
 * Provides a clean interface to the notices Redux state and actions
 */
export const useNotices = () => {
  const dispatch = useDispatch();
  
  // Select state from Redux store
  const {
    notices,
    selectedNotice,
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
    attachments,
    uploadingAttachment,
    attachmentError,
    activeTab
  } = useSelector((state) => state.notices);

  // Memoized action creators to prevent unnecessary re-renders
  const loadNotices = useCallback((params = {}) => dispatch(fetchNotices(params)), [dispatch]);
  const loadNotice = useCallback((id) => dispatch(fetchNoticeById(id)), [dispatch]);
  const createNoticeAction = useCallback((data) => dispatch(createNotice(data)), [dispatch]);
  const updateNoticeAction = useCallback(({ id, data }) => dispatch(updateNotice({ id, data })), [dispatch]);
  const removeNotice = useCallback((id) => dispatch(deleteNotice(id)), [dispatch]);
  const toggleNoticePin = useCallback((id) => dispatch(togglePinNotice(id)), [dispatch]);
  const moveNoticeToExpired = useCallback((id) => dispatch(moveToExpired(id)), [dispatch]);
  const restoreExpiredNotice = useCallback((id) => dispatch(restoreNotice(id)), [dispatch]);
  const incrementNoticeViews = useCallback((id) => dispatch(incrementViews(id)), [dispatch]);
  const updateAllStatuses = useCallback(() => dispatch(updateNoticeStatuses()), [dispatch]);
  const setActiveTabAction = useCallback((tab) => dispatch(setActiveTab(tab)), [dispatch]);
  const clearSelectedNoticeAction = useCallback(() => dispatch(clearSelectedNotice()), [dispatch]);
  const clearErrorsAction = useCallback(() => dispatch(clearErrors()), [dispatch]);
  const clearSuccessAction = useCallback(() => dispatch(clearSuccess()), [dispatch]);
  const resetCreateStateAction = useCallback(() => dispatch(resetCreateState()), [dispatch]);
  const resetUpdateStateAction = useCallback(() => dispatch(resetUpdateState()), [dispatch]);
  const clearAllStatesAction = useCallback(() => dispatch(clearAllStates()), [dispatch]);

  // Action creators object
  const actions = {
    // Load notices
    loadNotices,

    // Load single notice
    loadNotice,

    // Create notice
    createNotice: createNoticeAction,

    // Update notice
    updateNotice: updateNoticeAction,

    // Delete notice
    removeNotice,

    // Toggle pin status
    toggleNoticePin,

    // Move to expired
    moveNoticeToExpired,

    // Restore expired notice
    restoreExpiredNotice,

    // Increment views
    incrementNoticeViews,

    // Update all statuses
    updateAllStatuses,

    // UI actions
    setActiveTab: setActiveTabAction,
    clearSelectedNotice: clearSelectedNoticeAction,

    // Error and success management
    clearErrors: clearErrorsAction,
    clearSuccess: clearSuccessAction,
    clearAllSuccess: clearSuccessAction,
    resetCreateState: resetCreateStateAction,
    resetUpdateState: resetUpdateStateAction,
    clearAllStates: clearAllStatesAction
  };

  // Computed values
  const computed = {
    // Check if any operation is in progress
    isLoading: loading || creating || updating || deleting,
    
    // Check if there are any errors
    hasErrors: !!(error || createError || updateError || deleteError || attachmentError),
    
    // Check if there are any success states
    hasSuccess: !!(createSuccess || updateSuccess || deleteSuccess),
    
    // Get notices by status
    ongoingNotices: notices?.filter(notice => notice.status === 'ongoing') || [],
    upcomingNotices: notices?.filter(notice => notice.status === 'upcoming') || [],
    expiredNotices: notices?.filter(notice => notice.status === 'expired') || [],
    
    // Get pinned notices
    pinnedNotices: notices?.filter(notice => notice.isPinned) || [],
    
    // Get notices count by status
    statusCounts: {
      ongoing: notices?.filter(notice => notice.status === 'ongoing').length || 0,
      upcoming: notices?.filter(notice => notice.status === 'upcoming').length || 0,
      expired: notices?.filter(notice => notice.status === 'expired').length || 0,
      total: notices?.length || 0
    }
  };

  // Helper functions
  const helpers = {
    // Get notice by ID
    getNoticeById: (id) => notices?.find(notice => notice.id === parseInt(id)),
    
    // Check if notice is pinned
    isNoticePinned: (id) => {
      const notice = notices?.find(notice => notice.id === parseInt(id));
      return notice?.isPinned || false;
    },
    
    // Get notices by priority
    getNoticesByPriority: (priority) => 
      notices?.filter(notice => notice.priority === priority) || [],
    
    // Get notices by label
    getNoticesByLabel: (label) => 
      notices?.filter(notice => notice.label === label) || [],
    
    // Search notices
    searchNotices: (searchTerm) => {
      if (!searchTerm) return notices || [];
      const term = searchTerm.toLowerCase();
      return notices?.filter(notice => 
        (notice.internalTitle && notice.internalTitle.toLowerCase().includes(term)) ||
        (notice.author && notice.author.toLowerCase().includes(term)) ||
        (notice.label && notice.label.toLowerCase().includes(term))
      ) || [];
    },
    
    // Filter notices by date range
    filterNoticesByDateRange: (startDate, endDate) => {
      if (!startDate || !endDate) return notices || [];
      return notices?.filter(notice => {
        const noticeStart = new Date(notice.startDate);
        const noticeEnd = new Date(notice.endDate);
        const filterStart = new Date(startDate);
        const filterEnd = new Date(endDate);
        
        return (noticeStart >= filterStart && noticeStart <= filterEnd) ||
               (noticeEnd >= filterStart && noticeEnd <= filterEnd) ||
               (noticeStart <= filterStart && noticeEnd >= filterEnd);
      }) || [];
    }
  };

  return {
    // State
    notices,
    selectedNotice,
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
    attachments,
    uploadingAttachment,
    attachmentError,
    activeTab,
    
    // Actions
    ...actions,
    
    // Computed values
    ...computed,
    
    // Helper functions
    ...helpers
  };
};

export default useNotices;
