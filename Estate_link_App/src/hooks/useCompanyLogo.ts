import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchCompanySettings } from '../store/slices/companySettingsSlice';

/**
 * Hook to get company logo with stable loading behavior
 * Ensures logo is loaded once and remains stable without auto-reloads
 */
export const useCompanyLogo = () => {
  const dispatch = useAppDispatch();
  const { settings, isLoading, hasLoadedOnce } = useAppSelector(
    (state) => state.companySettings
  );
  const hasInitialized = useRef(false);

  // Load company settings once on mount (only if not already loaded)
  useEffect(() => {
    if (!hasInitialized.current && !hasLoadedOnce) {
      hasInitialized.current = true;
      dispatch(fetchCompanySettings());
    }
  }, [dispatch, hasLoadedOnce]);

  // Return logo URL or null, and loading state
  return {
    logoUrl: settings?.logo_url || null,
    isLoading: isLoading && !hasLoadedOnce,
    hasLogo: !!settings?.logo_url,
  };
};

