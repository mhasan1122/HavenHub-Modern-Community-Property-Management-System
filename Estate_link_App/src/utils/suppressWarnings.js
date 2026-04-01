/**
 * Comprehensive warning suppression utility
 * This suppresses all known deprecation warnings from React Native and third-party packages
 */

import { LogBox } from 'react-native';

// List of warning patterns to suppress
const WARNING_PATTERNS = [
  // SafeAreaView deprecation warnings
  'SafeAreaView has been deprecated',
  'SafeAreaView',
  'Please use \'react-native-safe-area-context\' instead',
  
  // React Native Reanimated warnings
  'react-native-reanimated/plugin',
  'react-native-worklets/plugin',
  'react-native-worklets',
  'Reanimated 2',
  '[Reanimated]',
  'Seems like you are using a Babel plugin',
  'it was moved to `react-native-worklets` package',
  'Please use `react-native-worklets/plugin` instead',
  'Reanimated',
  
  // React Native core warnings
  'Warning: componentWillReceiveProps',
  'Warning: componentWillMount',
  'Warning: componentWillUpdate',
  'VirtualizedLists should never be nested',
  
  // Third-party package warnings
  'react-native-modal',
  'react-native-pdf',
  'react-native-image-viewing',
  
  // Development warnings
  'Remote debugger',
  'LogBox.setDisabled',
  'runtime not ready',
];

/**
 * Initialize warning suppression
 */
export const suppressWarnings = () => {
  // Suppress LogBox warnings
  LogBox.ignoreLogs(WARNING_PATTERNS);
  
  // In development, suppress all logs
  if (__DEV__) {
    LogBox.ignoreAllLogs();
  }
  
  // Override console methods to filter warnings
  const originalWarn = console.warn;
  const originalError = console.error;
  
  console.warn = (...args) => {
    const message = args.join(' ');
    if (WARNING_PATTERNS.some(pattern => message.includes(pattern))) {
      return; // Suppress this warning
    }
    originalWarn(...args);
  };
  
  console.error = (...args) => {
    const message = args.join(' ');
    if (WARNING_PATTERNS.some(pattern => message.includes(pattern))) {
      return; // Suppress this error
    }
    originalError(...args);
  };
};

// Auto-initialize when imported
suppressWarnings();
