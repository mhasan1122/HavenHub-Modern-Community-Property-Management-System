import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to ensure skeleton loading displays for a minimum duration
 * and until data is actually loaded. This prevents blank pages on slow servers.
 * 
 * @param {boolean} isLoading - Loading state from Redux/API
 * @param {any} data - The data that should be loaded (array, object, etc.)
 * @param {number} minDisplayTime - Minimum time in ms to show skeleton (default: 1000ms for testing)
 * @param {function} dataValidator - Optional function to validate if data is truly loaded
 * @returns {boolean} - Whether to show skeleton loading
 * 
 * @example
 * const showSkeleton = useSkeletonLoading(loading, members, 1000);
 * if (showSkeleton) return <TableSkeleton />;
 */
const useSkeletonLoading = (
  isLoading,
  data,
  minDisplayTime = 1000,
  dataValidator = null
) => {
  const [showSkeleton, setShowSkeleton] = useState(true);
  const startTimeRef = useRef(Date.now());
  const hasShownMinTimeRef = useRef(false);
  const hasDataBeenLoadedRef = useRef(false);

  useEffect(() => {
    // Reset timer when loading starts
    if (isLoading) {
      startTimeRef.current = Date.now();
      hasShownMinTimeRef.current = false;
      setShowSkeleton(true);
      return;
    }

    // Mark that data has been loaded at least once (loading finished)
    if (!isLoading && (data !== null && data !== undefined)) {
      hasDataBeenLoadedRef.current = true;
    }

    // Check if minimum display time has passed
    const elapsed = Date.now() - startTimeRef.current;
    const minTimePassed = elapsed >= minDisplayTime;

    // Validate data is actually loaded
    let isDataLoaded = false;
    
    if (dataValidator) {
      // Use custom validator if provided
      isDataLoaded = dataValidator(data);
    } else {
      // Default validation: check if data exists and has been loaded at least once
      if (data === null || data === undefined) {
        // Data hasn't been loaded yet
        isDataLoaded = false;
      } else if (Array.isArray(data)) {
        // For arrays, consider it loaded if:
        // 1. Data has been loaded at least once (loading finished), OR
        // 2. Array has items (definitely loaded)
        isDataLoaded = hasDataBeenLoadedRef.current || data.length > 0;
      } else if (typeof data === 'object') {
        // For objects, check if it has keys
        isDataLoaded = Object.keys(data).length > 0;
      } else {
        // For primitives, if it exists, it's loaded
        isDataLoaded = true;
      }
    }

    // Show skeleton if:
    // 1. Still loading, OR
    // 2. Minimum time hasn't passed, OR
    // 3. Data is not loaded yet
    const shouldShowSkeleton = isLoading || !minTimePassed || !isDataLoaded;

    if (shouldShowSkeleton) {
      setShowSkeleton(true);
      
      // If minimum time hasn't passed but data is loaded, set a timeout to hide it after min time
      if (!minTimePassed && !isLoading && isDataLoaded) {
        const remainingTime = minDisplayTime - elapsed;
        const timer = setTimeout(() => {
          hasShownMinTimeRef.current = true;
          setShowSkeleton(false);
        }, remainingTime);
        
        return () => clearTimeout(timer);
      }
    } else {
      // Both conditions met: min time passed and data loaded
      setShowSkeleton(false);
      hasShownMinTimeRef.current = true;
    }
  }, [isLoading, data, minDisplayTime, dataValidator]);

  return showSkeleton;
};

export default useSkeletonLoading;

