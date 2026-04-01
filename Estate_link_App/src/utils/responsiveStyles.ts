import { StyleSheet } from 'react-native';
import {
  spacing,
  fontSizes,
  iconSizes,
  borderRadius,
  getResponsivePadding,
  getGridColumns,
  getGridItemWidth,
  getScreenSize,
  useResponsiveValue,
} from './responsiveUtils';
import { isTablet } from './deviceInfo';

// Responsive StyleSheet creator
export const createResponsiveStyleSheet = (styles: any) => {
  return StyleSheet.create(styles);
};

// Common responsive styles
export const responsiveStyles = createResponsiveStyleSheet({
  // Container styles
  container: {
    flex: 1,
    paddingHorizontal: getResponsivePadding(),
  },
  
  containerCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: getResponsivePadding(),
  },
  
  // Header styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: getResponsivePadding(),
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  
  // Card styles
  card: {
    backgroundColor: 'white',
    borderRadius: borderRadius.lg,
    padding: getResponsivePadding(),
    marginVertical: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  // Button styles
  button: {
    height: isTablet() ? 56 : 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  
  buttonPrimary: {
    backgroundColor: '#3C9D9B',
  },
  
  buttonSecondary: {
    backgroundColor: '#f3f4f6',
  },
  
  // Text styles
  text: {
    fontSize: fontSizes.base,
    lineHeight: fontSizes.base * 1.4,
  },
  
  textSmall: {
    fontSize: fontSizes.sm,
    lineHeight: fontSizes.sm * 1.4,
  },
  
  textLarge: {
    fontSize: fontSizes.lg,
    lineHeight: fontSizes.lg * 1.4,
  },
  
  textXLarge: {
    fontSize: fontSizes.xl,
    lineHeight: fontSizes.xl * 1.4,
  },
  
  textBold: {
    fontWeight: 'bold',
  },
  
  // Dashboard item styles
  dashboardItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  dashboardItemText: {
    textAlign: 'center',
    numberOfLines: 1,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  
  // Input styles
  input: {
    height: isTablet() ? 56 : 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSizes.base,
  },
  
  // Grid styles
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  
  gridItem: {
    width: getGridItemWidth(),
    marginBottom: spacing.md,
  },
  
  // Image styles
  image: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
  },
  
  // Icon styles
  icon: {
    width: iconSizes.md,
    height: iconSizes.md,
  },
  
  iconSmall: {
    width: iconSizes.sm,
    height: iconSizes.sm,
  },
  
  iconLarge: {
    width: iconSizes.lg,
    height: iconSizes.lg,
  },
  
  // Avatar styles
  avatar: {
    width: isTablet() ? 60 : 40,
    height: isTablet() ? 60 : 40,
    borderRadius: isTablet() ? 30 : 20,
  },
  
  avatarLarge: {
    width: isTablet() ? 80 : 60,
    height: isTablet() ? 80 : 60,
    borderRadius: isTablet() ? 40 : 30,
  },
  
  // Spacing utilities
  margin: {
    margin: spacing.md,
  },
  
  marginSmall: {
    margin: spacing.sm,
  },
  
  marginLarge: {
    margin: spacing.lg,
  },
  
  padding: {
    padding: spacing.md,
  },
  
  paddingSmall: {
    padding: spacing.sm,
  },
  
  paddingLarge: {
    padding: spacing.lg,
  },
  
  // Flex utilities
  flex1: {
    flex: 1,
  },
  
  flexRow: {
    flexDirection: 'row',
  },
  
  flexColumn: {
    flexDirection: 'column',
  },
  
  justifyCenter: {
    justifyContent: 'center',
  },
  
  justifyBetween: {
    justifyContent: 'space-between',
  },
  
  itemsCenter: {
    alignItems: 'center',
  },
  
  itemsStart: {
    alignItems: 'flex-start',
  },
  
  itemsEnd: {
    alignItems: 'flex-end',
  },
  
  // Position utilities
  absolute: {
    position: 'absolute',
  },
  
  relative: {
    position: 'relative',
  },
  
  // Border utilities
  border: {
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  
  borderRounded: {
    borderRadius: borderRadius.md,
  },
  
  borderRoundedFull: {
    borderRadius: borderRadius.full,
  },
  
  // Shadow utilities
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  shadowLarge: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
});

// Responsive class generator
export const getResponsiveClass = (baseClass: string, variants: any = {}) => {
  const screenSize = getScreenSize();
  const variant = variants[screenSize] || variants.default || '';
  return `${baseClass} ${variant}`.trim();
};

// Responsive spacing classes
export const spacingClasses = {
  p: (size: keyof typeof spacing) => ({ padding: spacing[size] }),
  px: (size: keyof typeof spacing) => ({ 
    paddingHorizontal: spacing[size] 
  }),
  py: (size: keyof typeof spacing) => ({ 
    paddingVertical: spacing[size] 
  }),
  m: (size: keyof typeof spacing) => ({ margin: spacing[size] }),
  mx: (size: keyof typeof spacing) => ({ 
    marginHorizontal: spacing[size] 
  }),
  my: (size: keyof typeof spacing) => ({ 
    marginVertical: spacing[size] 
  }),
};

// Responsive font classes
export const fontClasses = {
  text: (size: keyof typeof fontSizes) => ({ 
    fontSize: fontSizes[size] 
  }),
  textBold: { fontWeight: 'bold' },
  textCenter: { textAlign: 'center' },
  textLeft: { textAlign: 'left' },
  textRight: { textAlign: 'right' },
};

// Responsive icon classes
export const iconClasses = {
  icon: (size: keyof typeof iconSizes) => ({
    width: iconSizes[size],
    height: iconSizes[size],
  }),
};

// Responsive border classes
export const borderClasses = {
  border: (size: keyof typeof borderRadius) => ({
    borderRadius: borderRadius[size],
  }),
  borderFull: { borderRadius: borderRadius.full },
};

// Utility function to combine multiple styles
export const combineStyles = (...styles: any[]) => {
  return styles.filter(Boolean);
};

// Responsive hook for dynamic styles
export const useResponsiveStyles = () => {
  return {
    styles: responsiveStyles,
    spacingClasses,
    fontClasses,
    iconClasses,
    borderClasses,
    getResponsiveClass,
    combineStyles,
  };
};

export default responsiveStyles;
