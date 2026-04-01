import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { 
  fetchBulletins, 
  createNewBulletin, 
  updateExistingBulletin,
  approveBulletin,
  rejectBulletin,
  archiveBulletin,
  selectCurrentBulletins,
  selectPendingBulletins,
  selectArchiveBulletins,
  selectBulletinsLoading,
  selectBulletinsError,
  selectBulletinsFilters,
  selectLastFetched,
  setFilters,
  clearBulletins,
  addBulletinOptimistically,
  removeBulletin,
  removeBulletinsByCreatorId,
  updateBulletinInState
} from '../store/slices/bulletinSlice';

interface UseBulletinsReduxProps {
  status?: 'current' | 'pending' | 'archive';
  creator?: string;
  search?: string;
  priority?: string;
  labels?: string;
  my_posts?: boolean;
}

export const useBulletinsRedux = (props: UseBulletinsReduxProps = {}) => {
  const dispatch = useAppDispatch();
  
  // Selectors
  const currentBulletins = useAppSelector(selectCurrentBulletins);
  const pendingBulletins = useAppSelector(selectPendingBulletins);
  const archiveBulletins = useAppSelector(selectArchiveBulletins);
  const loading = useAppSelector(selectBulletinsLoading);
  const error = useAppSelector(selectBulletinsError);
  const filters = useAppSelector(selectBulletinsFilters);
  const lastFetched = useAppSelector(selectLastFetched);

  // Get the appropriate bulletins based on status
  const getBulletinsByStatus = useCallback(() => {
    switch (props.status) {
      case 'pending':
        return pendingBulletins;
      case 'archive':
        return archiveBulletins;
      default:
        return currentBulletins;
    }
  }, [props.status, currentBulletins, pendingBulletins, archiveBulletins]);

  // Get the appropriate loading state
  const getLoadingState = useCallback(() => {
    return loading;
  }, [loading]);

  // Get the appropriate last fetched timestamp
  const getLastFetched = useCallback(() => {
    switch (props.status) {
      case 'pending':
        return lastFetched.pending;
      case 'archive':
        return lastFetched.archive;
      default:
        return lastFetched.current;
    }
  }, [props.status, lastFetched]);

  // Fetch bulletins
  const fetchBulletinsData = useCallback(async () => {
    console.log('🔄 Fetching bulletins with params:', props);
    
    const params = {
      status: props.status,
      creator: props.creator,
      search: props.search,
      priority: props.priority,
      labels: props.labels,
      my_posts: props.my_posts,
    };
    
    console.log('🔄 Fetch params:', params);
    
    try {
      const result = await dispatch(fetchBulletins(params));
      console.log('✅ Bulletins fetched successfully for status:', props.status, 'Result:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to fetch bulletins for status:', props.status, 'Error:', error);
      throw error;
    }
  }, [dispatch, props.status, props.creator, props.search, props.priority, props.labels, props.my_posts]);

  // Force refresh bulletins (ignores cache) - do NOT clear all data
  const forceRefreshBulletins = useCallback(async () => {
    console.log('🔄 Force refreshing bulletins for status:', props.status);
    
    // DO NOT clear all bulletins - this was causing the infinite loop
    // The Redux store will handle updating the specific status data
    
    const params = {
      status: props.status,
      creator: props.creator,
      search: props.search,
      priority: props.priority,
      labels: props.labels,
      my_posts: props.my_posts,
    };
    
    console.log('🔄 Force refresh params:', params);
    
    try {
      const result = await dispatch(fetchBulletins(params));
      console.log('✅ Force refresh completed for status:', props.status, 'Result:', result);
      return result;
    } catch (error) {
      console.error('❌ Force refresh failed for status:', props.status, 'Error:', error);
      throw error;
    }
  }, [dispatch, props.status, props.creator, props.search, props.priority, props.labels, props.my_posts]);

  // Create new bulletin
  const createBulletinData = useCallback(async (bulletinData: any) => {
    const result = await dispatch(createNewBulletin(bulletinData));
    return result.payload;
  }, [dispatch]);

  // Update existing bulletin
  const updateBulletinData = useCallback(async (id: number, data: any) => {
    const result = await dispatch(updateExistingBulletin({ id, data }));
    return result.payload;
  }, [dispatch]);

  // Approve bulletin
  const approveBulletinData = useCallback(async (id: number, comment?: string) => {
    const result = await dispatch(approveBulletin({ id, comment }));
    return result.unwrap();
  }, [dispatch]);

  // Reject bulletin
  const rejectBulletinData = useCallback(async (id: number, comment?: string) => {
    const result = await dispatch(rejectBulletin({ id, comment }));
    return result.unwrap();
  }, [dispatch]);

  // Archive bulletin
  const archiveBulletinData = useCallback(async (id: number, comment?: string) => {
    const result = await dispatch(archiveBulletin({ id, comment }));
    return result.payload;
  }, [dispatch]);

  // Get bulletins by status for counting
  const getBulletinsByStatusCount = useCallback(() => {
    const statusCounts: Record<string, number> = {};
    
    const allBulletins = [...currentBulletins, ...pendingBulletins, ...archiveBulletins];
    allBulletins.forEach(bulletin => {
      const status = bulletin.status;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    return statusCounts;
  }, [currentBulletins, pendingBulletins, archiveBulletins]);

  // Filter bulletins by current user
  const getMyBulletins = useCallback(() => {
    const { user } = useAppSelector((state) => state.auth);
    if (!user?.id) return [];
    
    const allBulletins = [...currentBulletins, ...pendingBulletins, ...archiveBulletins];
    return allBulletins.filter(bulletin => bulletin.creator.id === Number(user.id));
  }, [currentBulletins, pendingBulletins, archiveBulletins]);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<typeof filters>) => {
    dispatch(setFilters(newFilters));
  }, [dispatch]);

  // Check if data needs refresh (older than 5 minutes)
  const needsRefresh = useCallback(() => {
    const lastFetchedTime = getLastFetched();
    if (!lastFetchedTime) return true;
    
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    return Date.now() - lastFetchedTime > fiveMinutes;
  }, [getLastFetched]);

  return {
    // Data
    bulletins: getBulletinsByStatus(),
    currentBulletins,
    pendingBulletins,
    archiveBulletins,
    
    // State
    loading: getLoadingState(),
    error,
    hasLoadedOnce: !!getLastFetched(),
    needsRefresh: needsRefresh(),
    
    // Actions
    fetchBulletins: fetchBulletinsData,
    forceRefreshBulletins,
    createNewBulletin: createBulletinData,
    updateBulletin: updateBulletinData,
    approveBulletin: approveBulletinData,
    rejectBulletin: rejectBulletinData,
    archiveBulletin: archiveBulletinData,
    addBulletinOptimistically,
    removeBulletin,
    removeBulletinsByCreatorId,
    updateBulletinInState,
    updateFilters,
    
    // Utilities
    getBulletinsByStatus: getBulletinsByStatusCount,
    getMyBulletins,
    filters,
    lastFetched: getLastFetched(),
  };
};
