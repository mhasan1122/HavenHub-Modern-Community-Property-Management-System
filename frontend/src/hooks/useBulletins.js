import { useSelector, useDispatch } from 'react-redux';
import { useCallback, useEffect } from 'react';
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
} from '../redux/slices/api/bulletinApi';
import {
  clearErrors,
  clearSuccess,
  setActiveTab,
  clearSelectedBulletin,
  resetCreateState,
  resetUpdateState,
  clearAllStates,
} from '../redux/slices/bulletins/bulletinSlice';
import { 
  formatBulletinForApi, 
  validateBulletinData,
  filterBulletinsByStatus 
} from '../Features/CommunicationPortal/Bulletins/utils/bulletinUtils';

/**
 * Custom hook for bulletin management
 * Provides all bulletin-related functionality and state management
 */
const useBulletins = () => {
  const dispatch = useDispatch();
  
  // Get bulletin state from Redux store
  const {
    bulletins,
    selectedBulletin,
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
  } = useSelector((state) => state.bulletins);

  // Load bulletins
  const loadBulletins = useCallback((params = {}) => {
    return dispatch(fetchBulletins(params));
  }, [dispatch]);

  // Load bulletin by ID
  const loadBulletin = useCallback((id) => {
    return dispatch(fetchBulletinById(id));
  }, [dispatch]);

  // Create new bulletin
  const createNewBulletin = useCallback((bulletinData) => {
    const formattedData = formatBulletinForApi(bulletinData);
    return dispatch(createBulletin(formattedData));
  }, [dispatch]);

  // Update existing bulletin
  const updateExistingBulletin = useCallback((id, bulletinData) => {
    const formattedData = formatBulletinForApi(bulletinData);
    return dispatch(updateBulletin({ id, data: formattedData }));
  }, [dispatch]);

  // Delete bulletin
  const removeBulletin = useCallback((id) => {
    return dispatch(deleteBulletin(id));
  }, [dispatch]);

  // Pin/Unpin bulletin
  const pinBulletinPost = useCallback((id) => {
    return dispatch(pinBulletin(id));
  }, [dispatch]);

  const unpinBulletinPost = useCallback((id) => {
    return dispatch(unpinBulletin(id));
  }, [dispatch]);

  const toggleBulletinPin = useCallback((id) => {
    return dispatch(togglePinBulletin(id));
  }, [dispatch]);

  // Approve bulletin
  const approveBulletinPost = useCallback((id, comment = '') => {
    return dispatch(approveBulletin({ id, comment }));
  }, [dispatch]);

  // Reject bulletin
  const rejectBulletinPost = useCallback((id, comment = '') => {
    return dispatch(rejectBulletin({ id, comment }));
  }, [dispatch]);

  // Add comment to bulletin
  const addCommentToBulletinPost = useCallback((id, comment) => {
    return dispatch(addCommentToBulletin({ id, comment }));
  }, [dispatch]);

  // Move bulletin to archive
  const moveBulletinToArchive = useCallback((id) => {
    return dispatch(moveToArchive(id));
  }, [dispatch]);

  // Restore archived bulletin
  const restoreArchivedBulletin = useCallback((id) => {
    return dispatch(restoreBulletin(id));
  }, [dispatch]);

  // Increment bulletin views
  const incrementBulletinViews = useCallback((id) => {
    return dispatch(incrementViews(id));
  }, [dispatch]);

  // Load towers
  const loadTowers = useCallback(() => {
    return dispatch(fetchTowers());
  }, [dispatch]);

  // Load units by tower
  const loadUnitsByTower = useCallback((towerIds) => {
    return dispatch(fetchUnitsByTower(towerIds));
  }, [dispatch]);

  // Clear error states
  const clearAllErrors = useCallback(() => {
    dispatch(clearErrors());
  }, [dispatch]);

  // Clear success states
  const clearAllSuccess = useCallback(() => {
    dispatch(clearSuccess());
  }, [dispatch]);

  // Set active tab
  const updateActiveTab = useCallback((tab) => {
    dispatch(setActiveTab(tab));
  }, [dispatch]);

  // Clear selected bulletin
  const clearBulletin = useCallback(() => {
    dispatch(clearSelectedBulletin());
  }, [dispatch]);

  // Reset create state
  const resetCreate = useCallback(() => {
    dispatch(resetCreateState());
  }, [dispatch]);

  // Reset update state
  const resetUpdate = useCallback(() => {
    dispatch(resetUpdateState());
  }, [dispatch]);

  // Clear all states
  const clearAll = useCallback(() => {
    dispatch(clearAllStates());
  }, [dispatch]);

  // Filter bulletins by status
  const getBulletinsByStatus = useCallback((status) => {
    return filterBulletinsByStatus(bulletins, status);
  }, [bulletins]);

  // Get current bulletins
  const getCurrentBulletins = useCallback(() => {
    return getBulletinsByStatus('current');
  }, [getBulletinsByStatus]);

  // Get pending bulletins
  const getPendingBulletins = useCallback(() => {
    return getBulletinsByStatus('pending');
  }, [getBulletinsByStatus]);

  // Get archived bulletins
  const getArchivedBulletins = useCallback(() => {
    return getBulletinsByStatus('archive');
  }, [getBulletinsByStatus]);

  // Validate bulletin data
  const validateBulletin = useCallback((bulletinData) => {
    return validateBulletinData(bulletinData);
  }, []);

  return {
    // State
    bulletins,
    selectedBulletin,
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
    loadBulletins,
    loadBulletin,
    createNewBulletin,
    updateExistingBulletin,
    removeBulletin,
    pinBulletinPost,
    unpinBulletinPost,
    toggleBulletinPin,
    approveBulletinPost,
    rejectBulletinPost,
    addCommentToBulletinPost,
    moveBulletinToArchive,
    restoreArchivedBulletin,
    incrementBulletinViews,
    loadTowers,
    loadUnitsByTower,

    // Utility functions
    clearAllErrors,
    clearAllSuccess,
    updateActiveTab,
    clearBulletin,
    resetCreate,
    resetUpdate,
    clearAll,
    getBulletinsByStatus,
    getCurrentBulletins,
    getPendingBulletins,
    getArchivedBulletins,
    validateBulletin,
  };
};

/**
 * Hook specifically for bulletin editing
 */
export const useBulletinEdit = (bulletinId) => {
  const {
    selectedBulletin,
    loading,
    updating,
    updateError,
    updateSuccess,
    loadBulletin,
    updateExistingBulletin,
    clearBulletin,
    resetUpdate,
  } = useBulletins();

  // Load bulletin on mount
  useEffect(() => {
    if (bulletinId) {
      loadBulletin(bulletinId);
    }
    
    // Cleanup on unmount
    return () => {
      clearBulletin();
      resetUpdate();
    };
  }, [bulletinId, loadBulletin, clearBulletin, resetUpdate]);

  return {
    bulletin: selectedBulletin,
    loading,
    updating,
    updateError,
    updateSuccess,
    updateBulletin: updateExistingBulletin,
    resetUpdate,
  };
};

export default useBulletins;
