import { useAutoTokenRefresh } from '../hooks/useAutoTokenRefresh';

/**
 * Component that sets up automatic token refresh
 * This should be placed inside the Redux Provider
 */
export const TokenRefreshManager = () => {
  // Set up automatic token refresh
  useAutoTokenRefresh();

  // This component doesn't render anything
  return null;
};
