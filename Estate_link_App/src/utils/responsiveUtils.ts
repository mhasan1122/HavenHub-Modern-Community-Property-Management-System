import { Dimensions, PixelRatio, Platform } from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { isTablet, isPhone } from './deviceInfo';

// Get screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Design base dimensions (based on iPhone 12 Pro - 390x844)
const DESIGN_WIDTH = 390;
const DESIGN_HEIGHT = 844;

// Screen size categories
export const getScreenSize = () => {
  const width = SCREEN_WIDTH;
  if (width < 375) return 'small'; // iPhone SE, small phones
  if (width < 428) return 'medium'; // iPhone 12, 13, 14, 15 (regular and Plus)
  if (width < 768) return 'large'; // iPhone 12/13/14/15 Pro Max
  return 'tablet'; // iPad and larger tablets
};

// Responsive scaling functions
export const responsiveWidth = (width: number) => {
  return (width / DESIGN_WIDTH) * SCREEN_WIDTH;
};

export const responsiveHeight = (height: number) => {
  return (height / DESIGN_HEIGHT) * SCREEN_HEIGHT;
};

export const responsiveFontSize = (size: number) => {
  const scaleFactor = SCREEN_WIDTH / DESIGN_WIDTH;
  const newSize = size * scaleFactor;
  
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  }
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Enhanced scaling with device type consideration
export const scaleResponsive = (size: number, factor: number = 0.5) => {
  const deviceType = isTablet() ? 1.2 : 1;
  return scale(size * deviceType);
};

export const verticalScaleResponsive = (size: number, factor: number = 0.5) => {
  const deviceType = isTablet() ? 1.2 : 1;
  return verticalScale(size * deviceType);
};

export const moderateScaleResponsive = (size: number, factor: number = 0.5) => {
  const deviceType = isTablet() ? 1.2 : 1;
  return moderateScale(size * deviceType);
};

// Percentage-based dimensions
export const widthPercentage = (percentage: number) => wp(percentage);
export const heightPercentage = (percentage: number) => hp(percentage);

// Spacing utilities
export const spacing = {
  xs: moderateScaleResponsive(4),
  sm: moderateScaleResponsive(8),
  md: moderateScaleResponsive(16),
  lg: moderateScaleResponsive(24),
  xl: moderateScaleResponsive(32),
  xxl: moderateScaleResponsive(48),
};

// Font sizes
export const fontSizes = {
  xs: moderateScaleResponsive(12),
  sm: moderateScaleResponsive(14),
  base: moderateScaleResponsive(16),
  lg: moderateScaleResponsive(18),
  xl: moderateScaleResponsive(20),
  '2xl': moderateScaleResponsive(24),
  '3xl': moderateScaleResponsive(30),
  '4xl': moderateScaleResponsive(36),
};

// Icon sizes
export const iconSizes = {
  xs: moderateScaleResponsive(12),
  sm: moderateScaleResponsive(16),
  md: moderateScaleResponsive(20),
  lg: moderateScaleResponsive(24),
  xl: moderateScaleResponsive(32),
  '2xl': moderateScaleResponsive(48),
};

// Border radius
export const borderRadius = {
  sm: moderateScaleResponsive(4),
  md: moderateScaleResponsive(8),
  lg: moderateScaleResponsive(12),
  xl: moderateScaleResponsive(16),
  full: moderateScaleResponsive(9999),
};

// Grid utilities
export const getGridColumns = () => {
  const screenSize = getScreenSize();
  switch (screenSize) {
    case 'small':
      return 3; // iPhone SE - reduced to 3 columns for better text display
    case 'medium':
      return 4; // iPhone 12, 13, 14 (regular)
    case 'large':
      return 4; // iPhone 12/13/14 Pro Max
    case 'tablet':
      return 5; // iPad and larger tablets
    default:
      return 4; // Default to 4 columns for most iPhones
  }
};

export const getGridItemWidth = (columns: number = getGridColumns()) => {
  const padding = spacing.md * 2; // Left and right padding
  const gap = spacing.sm * (columns - 1); // Gaps between items
  const availableWidth = SCREEN_WIDTH - padding - gap;
  const itemWidth = availableWidth / columns;
  
  // Ensure minimum width for text readability
  const minWidth = 90; // Increased minimum width to prevent text wrapping
  return Math.max(itemWidth, minWidth);
};

// Responsive padding and margins
export const getResponsivePadding = () => {
  const screenSize = getScreenSize();
  switch (screenSize) {
    case 'small':
      return spacing.sm;
    case 'medium':
      return spacing.md;
    case 'large':
      return spacing.lg;
    case 'tablet':
      return spacing.xl;
    default:
      return spacing.md;
  }
};

// Component-specific responsive helpers
export const getHeaderHeight = () => {
  return isTablet() ? verticalScaleResponsive(80) : verticalScaleResponsive(60);
};

export const getCardPadding = () => {
  return isTablet() ? spacing.lg : spacing.md;
};

export const getButtonHeight = () => {
  return isTablet() ? verticalScaleResponsive(56) : verticalScaleResponsive(48);
};

// Media query-like functionality
export const useResponsiveValue = <T>(values: {
  small?: T;
  medium?: T;
  large?: T;
  tablet?: T;
  default: T;
}) => {
  const screenSize = getScreenSize();
  return values[screenSize] || values.default;
};

// Hook for responsive dimensions
export const useResponsiveDimensions = () => {
  return {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    isTablet: isTablet(),
    isPhone: isPhone(),
    screenSize: getScreenSize(),
    spacing,
    fontSizes,
    iconSizes,
    borderRadius,
  };
};

// Responsive image dimensions
export const getResponsiveImageSize = (baseWidth: number, baseHeight: number) => {
  const scaleFactor = SCREEN_WIDTH / DESIGN_WIDTH;
  return {
    width: baseWidth * scaleFactor,
    height: baseHeight * scaleFactor,
  };
};

// Responsive text line height
export const getResponsiveLineHeight = (fontSize: number) => {
  return fontSize * 1.4; // 140% of font size for good readability
};

// Ensure text stays on single line
export const getSingleLineTextStyle = (baseFontSize: number = 12) => {
  const fontSize = Math.max(baseFontSize, moderateScaleResponsive(baseFontSize));
  return {
    fontSize,
    lineHeight: fontSize * 1.2, // Tighter line height for single line
    numberOfLines: 1,
    flexWrap: 'nowrap' as const,
    textAlign: 'center' as const,
  };
};

// Modal-specific responsive utilities
export const getModalDimensions = () => {
  const screenSize = getScreenSize();
  
  // Fallback dimensions for safety
  const fallback = {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_HEIGHT * 0.8,
    contentPadding: spacing.md,
  };
  
  try {
    switch (screenSize) {
      case 'small':
        return {
          width: SCREEN_WIDTH * 0.95,
          height: SCREEN_HEIGHT * 0.85,
          contentPadding: spacing.sm,
        };
      case 'medium':
        return {
          width: SCREEN_WIDTH * 0.9,
          height: SCREEN_HEIGHT * 0.85,
          contentPadding: spacing.md,
        };
      case 'large':
        return {
          width: SCREEN_WIDTH * 0.85,
          height: SCREEN_HEIGHT * 0.85,
          contentPadding: spacing.md,
        };
      case 'tablet':
        return {
          width: SCREEN_WIDTH * 0.8,
          height: SCREEN_HEIGHT * 0.9,
          contentPadding: spacing.lg,
        };
      default:
        return fallback;
    }
  } catch (error) {
    console.warn('Error calculating modal dimensions, using fallback:', error);
    return fallback;
  }
};

export const getImageContainerSize = () => {
  const screenSize = getScreenSize();
  
  // Fallback dimensions
  const fallback = {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_HEIGHT * 0.7,
    maxWidth: SCREEN_WIDTH * 0.9,
    maxHeight: SCREEN_HEIGHT * 0.7,
  };
  
  try {
    switch (screenSize) {
      case 'small':
        return {
          width: SCREEN_WIDTH * 0.95,
          height: SCREEN_HEIGHT * 0.65,
          maxWidth: SCREEN_WIDTH * 0.95,
          maxHeight: SCREEN_HEIGHT * 0.65,
        };
      case 'medium':
        return {
          width: SCREEN_WIDTH * 0.9,
          height: SCREEN_HEIGHT * 0.7,
          maxWidth: SCREEN_WIDTH * 0.9,
          maxHeight: SCREEN_HEIGHT * 0.7,
        };
      case 'large':
        return {
          width: SCREEN_WIDTH * 0.85,
          height: SCREEN_HEIGHT * 0.75,
          maxWidth: SCREEN_WIDTH * 0.85,
          maxHeight: SCREEN_HEIGHT * 0.75,
        };
      case 'tablet':
        return {
          width: SCREEN_WIDTH * 0.8,
          height: SCREEN_HEIGHT * 0.8,
          maxWidth: SCREEN_WIDTH * 0.8,
          maxHeight: SCREEN_HEIGHT * 0.8,
        };
      default:
        return fallback;
    }
  } catch (error) {
    console.warn('Error calculating image container size, using fallback:', error);
    return fallback;
  }
};

export const getControlButtonSize = () => {
  const screenSize = getScreenSize();
  const minTouchTarget = 44; // Minimum touch target size for accessibility
  
  // Fallback button size
  const fallback = {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: borderRadius.lg,
  };
  
  try {
    const baseSize = useResponsiveValue({
      small: 40,
      medium: 44,
      large: 48,
      tablet: 52,
      default: minTouchTarget,
    });
    
    return {
      width: Math.max(baseSize, minTouchTarget),
      height: Math.max(baseSize, minTouchTarget),
      borderRadius: borderRadius.lg,
    };
  } catch (error) {
    console.warn('Error calculating control button size, using fallback:', error);
    return fallback;
  }
};

export const getModalHeaderHeight = () => {
  const screenSize = getScreenSize();
  
  try {
    return useResponsiveValue({
      small: heightPercentage(8),
      medium: heightPercentage(9),
      large: heightPercentage(10),
      tablet: heightPercentage(8),
      default: heightPercentage(9),
    });
  } catch (error) {
    console.warn('Error calculating modal header height, using fallback');
    return heightPercentage(9);
  }
};

export const getModalFooterHeight = () => {
  const screenSize = getScreenSize();
  
  try {
    return useResponsiveValue({
      small: heightPercentage(12),
      medium: heightPercentage(14),
      large: heightPercentage(15),
      tablet: heightPercentage(12),
      default: heightPercentage(14),
    });
  } catch (error) {
    console.warn('Error calculating modal footer height, using fallback');
    return heightPercentage(14);
  }
};

export const getModalSpacing = () => {
  const screenSize = getScreenSize();
  
  try {
    return {
      horizontal: useResponsiveValue({
        small: widthPercentage(4),
        medium: widthPercentage(5),
        large: widthPercentage(6),
        tablet: widthPercentage(8),
        default: widthPercentage(5),
      }),
      vertical: useResponsiveValue({
        small: heightPercentage(2),
        medium: heightPercentage(2.5),
        large: heightPercentage(3),
        tablet: heightPercentage(2),
        default: heightPercentage(2.5),
      }),
    };
  } catch (error) {
    console.warn('Error calculating modal spacing, using fallback');
    return {
      horizontal: widthPercentage(5),
      vertical: heightPercentage(2.5),
    };
  }
};

export const getResponsiveModalStyles = () => {
  const modalDimensions = getModalDimensions();
  const imageContainer = getImageContainerSize();
  const buttonSize = getControlButtonSize();
  const headerHeight = getModalHeaderHeight();
  const footerHeight = getModalFooterHeight();
  const modalSpacing = getModalSpacing();
  
  return {
    modal: {
      width: modalDimensions.width,
      height: modalDimensions.height,
      padding: modalDimensions.contentPadding,
    },
    imageContainer: {
      width: imageContainer.width,
      height: imageContainer.height,
      maxWidth: imageContainer.maxWidth,
      maxHeight: imageContainer.maxHeight,
    },
    controlButton: {
      width: buttonSize.width,
      height: buttonSize.height,
      borderRadius: buttonSize.borderRadius,
    },
    header: {
      height: headerHeight,
      paddingHorizontal: modalSpacing.horizontal,
      paddingVertical: modalSpacing.vertical,
    },
    footer: {
      height: footerHeight,
      paddingHorizontal: modalSpacing.horizontal,
      paddingVertical: modalSpacing.vertical,
    },
    spacing: modalSpacing,
  };
};

// Export all utilities for easy import
export default {
  // Core functions
  responsiveWidth,
  responsiveHeight,
  responsiveFontSize,
  scaleResponsive,
  verticalScaleResponsive,
  moderateScaleResponsive,
  widthPercentage,
  heightPercentage,
  
  // Device detection
  isTablet,
  isPhone,
  getScreenSize,
  
  // Design tokens
  spacing,
  fontSizes,
  iconSizes,
  borderRadius,
  
  // Grid utilities
  getGridColumns,
  getGridItemWidth,
  getResponsivePadding,
  
  // Component helpers
  getHeaderHeight,
  getCardPadding,
  getButtonHeight,
  
  // Hooks
  useResponsiveValue,
  useResponsiveDimensions,
  
  // Image helpers
  getResponsiveImageSize,
  getResponsiveLineHeight,
  
  // Modal helpers
  getModalDimensions,
  getImageContainerSize,
  getControlButtonSize,
  getModalHeaderHeight,
  getModalFooterHeight,
  getModalSpacing,
  getResponsiveModalStyles,
};
