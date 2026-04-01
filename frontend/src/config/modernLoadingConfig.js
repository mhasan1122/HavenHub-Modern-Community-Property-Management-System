/**
 * Modern Loading Animation Configuration
 * 
 * Controls the minimum display time for ModernLoadingAnimation component.
 * Set to 0 to disable minimum display time (for production).
 * Set to a positive number (in milliseconds) to enable minimum display time (for testing).
 * 
 * Usage:
 *   import { MODERN_LOADING_MIN_DISPLAY_TIME } from '../config/modernLoadingConfig';
 *   const showModernLoading = useModernLoading(loading, data, MODERN_LOADING_MIN_DISPLAY_TIME);
 */

// Toggle this value to enable/disable minimum display time
// 0 = disabled (for production/live server)
// 1000 = 1 second minimum (for local testing)
export const MODERN_LOADING_MIN_DISPLAY_TIME = 100;

// Alternative: Use environment variable (uncomment to use)
// export const MODERN_LOADING_MIN_DISPLAY_TIME = 
//   process.env.REACT_APP_MODERN_LOADING_MIN_DISPLAY_TIME 
//     ? parseInt(process.env.REACT_APP_MODERN_LOADING_MIN_DISPLAY_TIME, 10) 
//     : 0;
