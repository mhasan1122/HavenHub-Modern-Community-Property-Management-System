import { useState, useEffect, useMemo, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { fetchResidents } from '../../../../redux/slices/residents/residentSlice';
import { fetchOwnerList } from '../../../../redux/slices/owner/ownerSlice';
import { fetchUnitStaff } from '../../../../redux/slices/unitStaff/unitStaffSlice';
import { fetchBulkUserCount } from '../../../../redux/slices/api/announcementApi';

// Global cache for user count data with TTL
const userCountCache = new Map();
const bulkUserCountCache = new Map();
const CACHE_TTL = 300000; // 5 minutes cache for better performance

// Global request deduplication map
const pendingRequests = new Map();

// Global bulk request deduplication map
const pendingBulkRequests = new Map();

/**
 * Cache invalidation functions
 */
export const clearUserCountCache = () => {
  userCountCache.clear();
  bulkUserCountCache.clear();
  console.log('User count cache cleared');
};

export const clearCacheForUnits = (unitIds) => {
  if (!unitIds || !Array.isArray(unitIds)) return;

  // Clear individual unit caches
  unitIds.forEach(unitId => {
    userCountCache.delete(getCacheKey(unitId, 'residents'));
    userCountCache.delete(getCacheKey(unitId, 'owners'));
    userCountCache.delete(getCacheKey(unitId, 'unitStaff'));
  });

  // Clear bulk caches that include these units
  const keysToDelete = [];
  bulkUserCountCache.forEach((value, key) => {
    const cacheUnitIds = key.split(',').map(id => parseInt(id));
    if (cacheUnitIds.some(id => unitIds.includes(id))) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => bulkUserCountCache.delete(key));
  console.log(`Cache cleared for units: ${unitIds.join(', ')}`);
};

/**
 * Helper function to get cache key for unit data
 */
const getCacheKey = (unitId, type) => `${type}_${unitId}`;

/**
 * Helper function to check if cache entry is valid
 */
const isCacheValid = (entry) => {
  return entry && (Date.now() - entry.timestamp) < CACHE_TTL;
};

/**
 * Helper function to fetch unit data with caching and deduplication
 */
const fetchUnitDataWithCache = async (dispatch, unitId, type) => {
  const cacheKey = getCacheKey(unitId, type);

  // Check cache first
  const cachedData = userCountCache.get(cacheKey);
  if (isCacheValid(cachedData)) {
    return cachedData.data;
  }

  // Check if request is already pending
  const requestKey = `${type}_${unitId}`;
  if (pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey);
  }

  // Create new request
  const requestPromise = (async () => {
    try {
      let result;
      if (type === 'residents') {
        result = await dispatch(fetchResidents(unitId)).unwrap();
        result = Array.isArray(result) ? result : [];
      } else if (type === 'owners') {
        result = await dispatch(fetchOwnerList(unitId)).unwrap();
        result = result?.owners || [];
      } else if (type === 'unitStaff') {
        result = await dispatch(fetchUnitStaff(unitId)).unwrap();
        result = Array.isArray(result) ? result : [];
      } else {
        result = [];
      }

      // Cache the result with longer TTL for better performance
      userCountCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.warn(`Failed to fetch ${type} for unit ${unitId}:`, error);
      // Cache empty result to avoid repeated failed requests
      userCountCache.set(cacheKey, {
        data: [],
        timestamp: Date.now()
      });
      return [];
    } finally {
      // Remove from pending requests
      pendingRequests.delete(requestKey);
    }
  })();

  // Store pending request
  pendingRequests.set(requestKey, requestPromise);

  return requestPromise;
};

/**
 * Optimized function to fetch user count using bulk API with request deduplication and caching
 */
const fetchUserCountBulk = async (dispatch, unitIds) => {
  // Create a cache key based on sorted unit IDs
  const cacheKey = unitIds.sort().join(',');

  // Check cache first
  const cached = bulkUserCountCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  // Check if there's already a pending request for these units
  if (pendingBulkRequests.has(cacheKey)) {
    return pendingBulkRequests.get(cacheKey);
  }

  // Create new request
  const requestPromise = (async () => {
    try {
      const result = await dispatch(fetchBulkUserCount(unitIds)).unwrap();

      // Cache the result
      if (result) {
        bulkUserCountCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
      }

      return result;
    } catch (error) {
      console.error('Error fetching bulk user count:', error);
      return null;
    } finally {
      // Remove from pending requests
      pendingBulkRequests.delete(cacheKey);
    }
  })();

  // Store pending request
  pendingBulkRequests.set(cacheKey, requestPromise);

  return requestPromise;
};

/**
 * Custom hook for calculating user count based on selected units
 * @param {Array} selectedUnits - Array of unit IDs
 * @param {Object} options - Options object with forceRefresh flag
 * @returns {Object} - { userCount, loading, error, refresh }
 */
export const useUserCount = (selectedUnits, options = {}) => {
  const dispatch = useDispatch();
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const abortControllerRef = useRef(null);

  const { forceRefresh = false } = options;

  // Memoize the selectedUnits array to prevent unnecessary re-renders
  // Use JSON.stringify for deep comparison to avoid unnecessary recalculations
  const memoizedSelectedUnits = useMemo(() => {
    // Filter out 'All' and sort for consistent order
    return selectedUnits ? [...selectedUnits].filter(id => id !== 'All').sort() : [];
  }, [selectedUnits ? JSON.stringify(selectedUnits.filter(id => id !== 'All').sort()) : '']);

  // Function to manually refresh user count
  const refresh = () => {
    if (memoizedSelectedUnits && memoizedSelectedUnits.length > 0) {
      clearCacheForUnits(memoizedSelectedUnits);
    }
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const currentController = abortControllerRef.current;

    // Check for immediate cached results first (skip if force refresh is requested)
    if (memoizedSelectedUnits && memoizedSelectedUnits.length > 0 && !forceRefresh) {
      // Try to get from bulk cache first (faster)
      const bulkCacheKey = memoizedSelectedUnits.sort().join(',');
      const bulkCached = bulkUserCountCache.get(bulkCacheKey);
      
      if (bulkCached && (Date.now() - bulkCached.timestamp) < CACHE_TTL) {
        // Use bulk cache data immediately
        const totalCount = Object.values(bulkCached.data).reduce((sum, count) => sum + count, 0);
        setUserCount(totalCount);
        setLoading(false);
        setError(null);
        return;
      }

      // Fallback to individual unit cache check
      let cachedTotal = 0;
      let allCached = true;

      // Check if all units have cached data
      for (const unitId of memoizedSelectedUnits) {
        const residentsCache = userCountCache.get(getCacheKey(unitId, 'residents'));
        const ownersCache = userCountCache.get(getCacheKey(unitId, 'owners'));
        const unitStaffCache = userCountCache.get(getCacheKey(unitId, 'unitStaff'));

        if (isCacheValid(residentsCache) && isCacheValid(ownersCache) && isCacheValid(unitStaffCache)) {
          const residentsCount = Array.isArray(residentsCache.data) ? residentsCache.data.length : 0;
          const ownersCount = Array.isArray(ownersCache.data) ? ownersCache.data.length : 0;
          const unitStaffCount = Array.isArray(unitStaffCache.data) ? unitStaffCache.data.length : 0;
          cachedTotal += residentsCount + ownersCount + unitStaffCount;
        } else {
          allCached = false;
          break;
        }
      }

      // If all data is cached, show it immediately and skip loading
      if (allCached) {
        setUserCount(cachedTotal);
        setLoading(false);
        setError(null);
        return;
      }

      // If we have some cached data, show it immediately and continue loading in background
      if (cachedTotal > 0) {
        setUserCount(cachedTotal);
        setLoading(true); // Show as loading in background
      } else {
        // No cached data, show loading state
        setLoading(true);
      }
      setError(null);
    }

    // Reduced debounce for instant response with cached data
    const timeoutId = setTimeout(async () => {
      if (currentController.signal.aborted) return;

      if (!memoizedSelectedUnits || memoizedSelectedUnits.length === 0) {
        setUserCount(0);
        setLoading(false);
        setError(null);
        return;
      }

      // Loading is already set above, just clear error
      setError(null);
      let totalCount = 0;

      try {
        // Try bulk API first for better performance
        const bulkResult = await fetchUserCountBulk(dispatch, memoizedSelectedUnits);

        if (bulkResult && !currentController.signal.aborted) {
          // Calculate total from bulk result
          totalCount = Object.values(bulkResult).reduce((sum, count) => sum + count, 0);
          setUserCount(totalCount);
        } else {
          // Fallback to individual API calls if bulk fails
          console.log('Bulk API failed, falling back to individual calls');

          // Process units in smaller batches for better performance
          const BATCH_SIZE = 5; // Process 5 units at a time
          const batches = [];

          for (let i = 0; i < memoizedSelectedUnits.length; i += BATCH_SIZE) {
            batches.push(memoizedSelectedUnits.slice(i, i + BATCH_SIZE));
          }

          // Process batches sequentially to avoid overwhelming the API
          for (const batch of batches) {
            if (currentController.signal.aborted) break;

            const batchPromises = batch.map(async (unitId) => {
              if (currentController.signal.aborted) return 0;

              try {
                // Use Promise.allSettled for better error handling
                const results = await Promise.allSettled([
                  fetchUnitDataWithCache(dispatch, unitId, 'residents'),
                  fetchUnitDataWithCache(dispatch, unitId, 'owners'),
                  fetchUnitDataWithCache(dispatch, unitId, 'unitStaff')
                ]);

                if (currentController.signal.aborted) return 0;

                const residentsCount = results[0].status === 'fulfilled' && Array.isArray(results[0].value) ? results[0].value.length : 0;
                const ownersCount = results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value.length : 0;
                const unitStaffCount = results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value.length : 0;

                return residentsCount + ownersCount + unitStaffCount;
              } catch (error) {
                if (!currentController.signal.aborted) {
                  console.warn(`Error processing unit ${unitId}:`, error);
                }
                return 0;
              }
            });

            const batchCounts = await Promise.all(batchPromises);
            totalCount += batchCounts.reduce((sum, count) => sum + count, 0);

            // Update count progressively for better UX
            if (!currentController.signal.aborted) {
              setUserCount(totalCount);
            }
          }
        }
      } catch (error) {
        if (!currentController.signal.aborted) {
          console.error('Error calculating user count:', error);
          setError(error);
          totalCount = 0;
        }
      }

      if (!currentController.signal.aborted) {
        setUserCount(totalCount);
        setLoading(false);
      }
    }, 50); // Minimal debounce - cached data shows instantly, fresh data loads quickly

    return () => {
      clearTimeout(timeoutId);
      if (currentController) {
        currentController.abort();
      }
    };
  }, [memoizedSelectedUnits, dispatch, forceRefresh, refreshTrigger]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { userCount, loading, error, refresh };
};

/**
 * Custom hook for calculating user count from announcement target units
 * @param {Object} announcement - Announcement object with target_units_data
 * @param {Object} options - Options object with forceRefresh flag
 * @returns {Object} - { userCount, loading, error, refresh }
 */
export const useAnnouncementUserCount = (announcement, options = {}) => {
  const targetUnitIds = announcement?.target_units_data?.map(unit => unit.id) || [];
  return useUserCount(targetUnitIds, options);
};

/**
 * Custom hook for calculating user count from bulletin target units
 * @param {Object} bulletin - Bulletin object with target_units_data
 * @param {Object} options - Options object with forceRefresh flag
 * @returns {Object} - { userCount, loading, error, refresh }
 */
export const useBulletinUserCount = (bulletin, options = {}) => {
  const targetUnitIds = bulletin?.target_units_data?.map(unit => unit.id) || [];
  return useUserCount(targetUnitIds, options);
};
