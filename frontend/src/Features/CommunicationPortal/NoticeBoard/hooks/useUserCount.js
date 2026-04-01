import { useState, useEffect, useCallback, useMemo } from 'react';
import axiosInstance from '../../../../utils/axiosInstance';

// Cache for user counts to avoid repeated API calls
const userCountCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Custom hook for managing user count calculations
 * Provides functionality to get user counts for units with caching
 */
export const useUserCount = (unitIds) => {
  const [userCount, setUserCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Memoize the unitIds array to prevent unnecessary re-renders
  const memoizedUnitIds = useMemo(() => {
    return Array.isArray(unitIds) ? [...unitIds].sort() : [];
  }, [JSON.stringify(unitIds)]);

  // Clear the cache
  const clearCache = useCallback(() => {
    userCountCache.clear();
  }, []);

  // Get cache key for unit IDs
  const getCacheKey = useCallback((unitIds) => {
    if (!Array.isArray(unitIds)) return null;
    return unitIds.sort((a, b) => a - b).join(',');
  }, []);

  // Check if cache entry is valid
  const isCacheValid = useCallback((cacheEntry) => {
    if (!cacheEntry) return false;
    return Date.now() - cacheEntry.timestamp < CACHE_DURATION;
  }, []);

  // Fetch user count from API
  const fetchUserCount = useCallback(async (unitIds) => {
    if (!unitIds || unitIds.length === 0) return 0;

    try {
      setIsLoading(true);
      setError(null);

      const response = await axiosInstance.post('/api/noticeboard/bulk-user-count/', {
        unit_ids: unitIds
      });

      // Response format: { "unitId": count, "unitId2": count, ... }
      // Calculate total by summing all unit counts
      const unitCounts = response.data || {};
      const count = unitIds.reduce((sum, unitId) => {
        return sum + (unitCounts[unitId] || 0);
      }, 0);

      // Cache the result
      const cacheKey = getCacheKey(unitIds);
      if (cacheKey) {
        userCountCache.set(cacheKey, {
          count,
          timestamp: Date.now()
        });
      }

      return count;
    } catch (error) {
      console.error('Error fetching user count:', error);
      setError(error.response?.data?.message || 'Failed to fetch user count');
      return 0;
    } finally {
      setIsLoading(false);
    }
  }, [getCacheKey]);

  // Effect to fetch user count when unitIds change
  useEffect(() => {
    const fetchCount = async () => {
      if (!memoizedUnitIds || memoizedUnitIds.length === 0) {
        setUserCount(0);
        setIsLoading(false);
        setError(null);
        return;
      }

      // Check cache first
      const cacheKey = getCacheKey(memoizedUnitIds);
      if (cacheKey) {
        const cacheEntry = userCountCache.get(cacheKey);
        if (cacheEntry && isCacheValid(cacheEntry)) {
          // Set cached value immediately without loading state
          setUserCount(cacheEntry.count);
          setIsLoading(false);
          setError(null);
          return;
        }
      }

      // Only set loading if we're actually going to fetch
      setIsLoading(true);
      
      // Fetch from API if not in cache
      const count = await fetchUserCount(memoizedUnitIds);
      setUserCount(count);
    };

    fetchCount();
  }, [memoizedUnitIds, fetchUserCount, getCacheKey, isCacheValid]);

  // Get user count with caching
  const getUserCount = useCallback((unitIds) => {
    if (!unitIds || unitIds.length === 0) return 0;

    const cacheKey = getCacheKey(unitIds);
    if (!cacheKey) return 0;

    const cacheEntry = userCountCache.get(cacheKey);
    
    if (cacheEntry && isCacheValid(cacheEntry)) {
      return cacheEntry.count;
    }

    // If not in cache or cache is invalid, fetch from API
    fetchUserCount(unitIds);
    
    // Return cached value if available (even if expired) or 0
    return cacheEntry ? cacheEntry.count : 0;
  }, [getCacheKey, isCacheValid, fetchUserCount]);

  // Get user count async (returns a promise)
  const getUserCountAsync = useCallback(async (unitIds) => {
    if (!unitIds || unitIds.length === 0) return 0;

    const cacheKey = getCacheKey(unitIds);
    if (!cacheKey) return 0;

    const cacheEntry = userCountCache.get(cacheKey);
    
    if (cacheEntry && isCacheValid(cacheEntry)) {
      return cacheEntry.count;
    }

    // Fetch from API
    return await fetchUserCount(unitIds);
  }, [getCacheKey, isCacheValid, fetchUserCount]);

  // Prefetch user counts for multiple unit arrays - OPTIMIZED VERSION
  const prefetchUserCounts = useCallback(async (unitIdArrays) => {
    if (!Array.isArray(unitIdArrays) || unitIdArrays.length === 0) return;

    // Collect all unique unit IDs across all notices
    const allUnitIds = new Set();
    const arraysToCache = [];

    unitIdArrays.forEach(unitIds => {
      if (Array.isArray(unitIds) && unitIds.length > 0) {
        const cacheKey = getCacheKey(unitIds);
        const cacheEntry = userCountCache.get(cacheKey);
        
        // Only process if not in cache or cache is invalid
        if (!cacheEntry || !isCacheValid(cacheEntry)) {
          arraysToCache.push(unitIds);
          unitIds.forEach(id => allUnitIds.add(id));
        }
      }
    });

    // If all data is already cached, no need to fetch
    if (allUnitIds.size === 0) return;

    try {
      // Make ONE bulk API call for all unique units
      const response = await axiosInstance.post('/api/noticeboard/bulk-user-count/', {
        unit_ids: Array.from(allUnitIds)
      });

      // Response is {unitId: count, ...}
      const unitCounts = response.data || {};

      // Now calculate and cache counts for each original unit array
      arraysToCache.forEach(unitIds => {
        const totalCount = unitIds.reduce((sum, unitId) => {
          return sum + (unitCounts[unitId] || 0);
        }, 0);

        const cacheKey = getCacheKey(unitIds);
        if (cacheKey) {
          userCountCache.set(cacheKey, {
            count: totalCount,
            timestamp: Date.now()
          });
        }
      });
    } catch (error) {
      console.error('Error prefetching user counts:', error);
    }
  }, [getCacheKey, isCacheValid]);

  // Get cached user count without triggering API call
  const getCachedUserCount = useCallback((unitIds) => {
    if (!unitIds || unitIds.length === 0) return 0;

    const cacheKey = getCacheKey(unitIds);
    if (!cacheKey) return 0;

    const cacheEntry = userCountCache.get(cacheKey);
    return cacheEntry ? cacheEntry.count : 0;
  }, [getCacheKey]);

  // Check if user count is cached
  const isUserCountCached = useCallback((unitIds) => {
    if (!unitIds || unitIds.length === 0) return false;

    const cacheKey = getCacheKey(unitIds);
    if (!cacheKey) return false;

    const cacheEntry = userCountCache.get(cacheKey);
    return cacheEntry && isCacheValid(cacheEntry);
  }, [getCacheKey, isCacheValid]);

  return {
    // State values (new pattern)
    userCount,
    loading: isLoading,
    error,

    // Legacy functions (for backward compatibility)
    getUserCount,
    getUserCountAsync,

    // Cache management
    clearCache,
    prefetchUserCounts,
    getCachedUserCount,
    isUserCountCached,

    // Legacy state (for backward compatibility)
    isLoading
  };
};

/**
 * Custom hook for calculating user count from notice target units
 * @param {Object} notice - Notice object with target_units_data or selectedUnits
 * @param {Object} options - Options object with forceRefresh flag
 * @returns {Object} - { userCount, loading, error }
 */
export const useNoticeUserCount = (notice, options = {}) => {
  const targetUnitIds = notice?.target_units_data?.map(unit => unit.id) || notice?.selectedUnits || [];
  return useUserCount(targetUnitIds, options);
};

// Export function to clear cache from outside the hook
export const clearUserCountCache = () => {
  userCountCache.clear();
};

export default useUserCount;
