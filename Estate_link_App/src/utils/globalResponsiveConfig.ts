import { Dimensions } from 'react-native';

/**
 * Global Responsive Layout Configuration
 * Universal responsive settings that auto-detect screen size
 * Can be used anywhere in the app
 */

// Device screen width breakpoints
export const BREAKPOINTS = {
  XSMALL: 320,  // Very small phones
  SMALL: 375,   // iPhone SE, small Android phones
  MEDIUM: 414,  // iPhone 12/13/14, most Android phones
  LARGE: 768,   // iPhone Pro Max, large Android phones
  TABLET: 1024, // iPad, Android tablets
} as const;

// Screen dimensions
export const getScreenDimensions = () => {
  const { width, height } = Dimensions.get('window');
  return { width, height };
};

// Device type detection
export const getDeviceType = (screenWidth?: number) => {
  const width = screenWidth || getScreenDimensions().width;
  
  if (width < BREAKPOINTS.XSMALL) return 'xsmall';
  if (width < BREAKPOINTS.SMALL) return 'small';
  if (width < BREAKPOINTS.MEDIUM) return 'medium';
  if (width < BREAKPOINTS.LARGE) return 'large';
  if (width < BREAKPOINTS.TABLET) return 'xlarge';
  return 'tablet';
};

/**
 * Global Responsive Configuration Interface
 */
export interface ResponsiveConfig {
  // Screen info
  screenWidth: number;
  screenHeight: number;
  deviceType: string;
  isSmallDevice: boolean;
  isTablet: boolean;
  
  // Spacing
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  
  // Padding
  padding: {
    container: number;
    section: number;
    card: number;
    item: number;
  };
  
  // Font sizes
  fontSize: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  
  // Icon sizes
  iconSize: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  
  // Border radius
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };
  
  // Grid layout
  grid: {
    columns: number;
    gap: number;
    itemWidth: number;
  };
}

/**
 * Get Global Responsive Configuration
 * Auto-detects screen size and returns appropriate settings
 */
export const getResponsiveConfig = (): ResponsiveConfig => {
  const { width, height } = getScreenDimensions();
  const deviceType = getDeviceType(width);
  const isSmallDevice = width < BREAKPOINTS.MEDIUM;
  const isTablet = width >= BREAKPOINTS.TABLET;
  
  // Responsive spacing
  const spacing = {
    xs: width < BREAKPOINTS.SMALL ? 4 : width < BREAKPOINTS.MEDIUM ? 6 : 8,
    sm: width < BREAKPOINTS.SMALL ? 8 : width < BREAKPOINTS.MEDIUM ? 10 : 12,
    md: width < BREAKPOINTS.SMALL ? 12 : width < BREAKPOINTS.MEDIUM ? 16 : 20,
    lg: width < BREAKPOINTS.SMALL ? 16 : width < BREAKPOINTS.MEDIUM ? 20 : 24,
    xl: width < BREAKPOINTS.SMALL ? 20 : width < BREAKPOINTS.MEDIUM ? 24 : 32,
    xxl: width < BREAKPOINTS.SMALL ? 24 : width < BREAKPOINTS.MEDIUM ? 32 : 40,
  };
  
  // Responsive padding
  const padding = {
    container: width < BREAKPOINTS.SMALL ? 12 : width < BREAKPOINTS.MEDIUM ? 16 : width < BREAKPOINTS.LARGE ? 20 : 24,
    section: width < BREAKPOINTS.SMALL ? 16 : width < BREAKPOINTS.MEDIUM ? 20 : 24,
    card: width < BREAKPOINTS.SMALL ? 12 : width < BREAKPOINTS.MEDIUM ? 16 : 20,
    item: width < BREAKPOINTS.SMALL ? 8 : width < BREAKPOINTS.MEDIUM ? 12 : 16,
  };
  
  // Responsive font sizes
  const fontSize = {
    xs: width < BREAKPOINTS.SMALL ? 10 : width < BREAKPOINTS.MEDIUM ? 11 : 12,
    sm: width < BREAKPOINTS.SMALL ? 12 : width < BREAKPOINTS.MEDIUM ? 13 : 14,
    md: width < BREAKPOINTS.SMALL ? 14 : width < BREAKPOINTS.MEDIUM ? 15 : 16,
    lg: width < BREAKPOINTS.SMALL ? 16 : width < BREAKPOINTS.MEDIUM ? 18 : 20,
    xl: width < BREAKPOINTS.SMALL ? 20 : width < BREAKPOINTS.MEDIUM ? 22 : 24,
    xxl: width < BREAKPOINTS.SMALL ? 24 : width < BREAKPOINTS.MEDIUM ? 28 : 32,
  };
  
  // Responsive icon sizes
  const iconSize = {
    xs: width < BREAKPOINTS.SMALL ? 16 : width < BREAKPOINTS.MEDIUM ? 18 : 20,
    sm: width < BREAKPOINTS.SMALL ? 20 : width < BREAKPOINTS.MEDIUM ? 22 : 24,
    md: width < BREAKPOINTS.SMALL ? 24 : width < BREAKPOINTS.MEDIUM ? 28 : 32,
    lg: width < BREAKPOINTS.SMALL ? 32 : width < BREAKPOINTS.MEDIUM ? 40 : 48,
    xl: width < BREAKPOINTS.SMALL ? 48 : width < BREAKPOINTS.MEDIUM ? 56 : 64,
  };
  
  // Responsive border radius
  const borderRadius = {
    sm: width < BREAKPOINTS.SMALL ? 4 : width < BREAKPOINTS.MEDIUM ? 6 : 8,
    md: width < BREAKPOINTS.SMALL ? 8 : width < BREAKPOINTS.MEDIUM ? 10 : 12,
    lg: width < BREAKPOINTS.SMALL ? 12 : width < BREAKPOINTS.MEDIUM ? 14 : 16,
    xl: width < BREAKPOINTS.SMALL ? 16 : width < BREAKPOINTS.MEDIUM ? 20 : 24,
    full: 9999,
  };
  
  // Responsive grid layout
  const gridColumns = width < BREAKPOINTS.SMALL ? 3 : width < BREAKPOINTS.MEDIUM ? 4 : width < BREAKPOINTS.TABLET ? 4 : 5;
  const gridGap = width < BREAKPOINTS.SMALL ? 8 : width < BREAKPOINTS.MEDIUM ? 12 : width < BREAKPOINTS.LARGE ? 16 : 20;
  const availableWidth = width - (padding.container * 2);
  const gridItemWidth = (availableWidth - (gridGap * (gridColumns - 1))) / gridColumns;
  
  return {
    screenWidth: width,
    screenHeight: height,
    deviceType,
    isSmallDevice,
    isTablet,
    spacing,
    padding,
    fontSize,
    iconSize,
    borderRadius,
    grid: {
      columns: gridColumns,
      gap: gridGap,
      itemWidth: gridItemWidth,
    },
  };
};

/**
 * Get responsive value based on device type
 * @param values - Object with values for different device types
 */
export const getResponsiveValue = <T>(values: {
  xsmall?: T;
  small?: T;
  medium?: T;
  large?: T;
  xlarge?: T;
  tablet?: T;
  default: T;
}): T => {
  const deviceType = getDeviceType();
  return values[deviceType as keyof typeof values] || values.default;
};

/**
 * Get responsive spacing
 */
export const getResponsiveSpacing = (size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'): number => {
  const config = getResponsiveConfig();
  return config.spacing[size];
};

/**
 * Get responsive padding
 */
export const getResponsivePadding = (type: 'container' | 'section' | 'card' | 'item'): number => {
  const config = getResponsiveConfig();
  return config.padding[type];
};

/**
 * Get responsive font size
 */
export const getResponsiveFontSize = (size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'): number => {
  const config = getResponsiveConfig();
  return config.fontSize[size];
};

/**
 * Get responsive icon size
 */
export const getResponsiveIconSize = (size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'): number => {
  const config = getResponsiveConfig();
  return config.iconSize[size];
};

/**
 * React Hook - Auto-updates on screen dimension changes
 */
export const useResponsive = () => {
  const config = getResponsiveConfig();
  
  return {
    ...config,
    // Helper functions
    getSpacing: (size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl') => config.spacing[size],
    getPadding: (type: 'container' | 'section' | 'card' | 'item') => config.padding[type],
    getFontSize: (size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl') => config.fontSize[size],
    getIconSize: (size: 'xs' | 'sm' | 'md' | 'lg' | 'xl') => config.iconSize[size],
    getBorderRadius: (size: 'sm' | 'md' | 'lg' | 'xl' | 'full') => config.borderRadius[size],
  };
};

/**
 * Debug information
 */
export const getResponsiveDebugInfo = () => {
  const config = getResponsiveConfig();
  return {
    '📱 Screen': `${config.screenWidth} × ${config.screenHeight}`,
    '📦 Device Type': config.deviceType,
    '📏 Is Small Device': config.isSmallDevice,
    '📱 Is Tablet': config.isTablet,
    '🔢 Grid Columns': config.grid.columns,
    '📊 Grid Gap': `${config.grid.gap}px`,
    '📦 Container Padding': `${config.padding.container}px`,
  };
};

// Export everything
export default {
  getResponsiveConfig,
  getResponsiveValue,
  getResponsiveSpacing,
  getResponsivePadding,
  getResponsiveFontSize,
  getResponsiveIconSize,
  useResponsive,
  getScreenDimensions,
  getDeviceType,
  getResponsiveDebugInfo,
  BREAKPOINTS,
};

