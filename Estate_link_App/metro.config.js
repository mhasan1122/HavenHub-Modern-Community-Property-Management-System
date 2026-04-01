const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Suppress warnings during bundling
const originalWarn = console.warn;
console.warn = (message, ...args) => {
  // Suppress SafeAreaView and Reanimated warnings
  if (
    typeof message === 'string' && (
      message.includes('SafeAreaView has been deprecated') ||
      message.includes('react-native-reanimated/plugin') ||
      message.includes('react-native-worklets')
    )
  ) {
    return; // Don't log these warnings
  }
  originalWarn(message, ...args);
};

// Add resolver alias for path mappings
config.resolver.alias = {
  components: path.resolve(__dirname, 'components'),
  'store': path.resolve(__dirname, 'src/store'),
  'hooks': path.resolve(__dirname, 'src/hooks'),
  'validation': path.resolve(__dirname, 'src/validation'),
  'types': path.resolve(__dirname, 'src/types'),
};

module.exports = withNativeWind(config, { input: './global.css' });
