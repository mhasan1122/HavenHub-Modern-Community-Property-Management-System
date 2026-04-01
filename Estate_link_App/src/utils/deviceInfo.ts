import { Dimensions, Platform } from 'react-native';
import * as Device from 'expo-device';

// Device type detection using Expo APIs
export const isTablet = (): boolean => {
  try {
    // Use Expo's Device API if available
    if (Device.deviceType) {
      return Device.deviceType === Device.DeviceType.TABLET;
    }
  } catch (error) {
    console.warn('Expo Device API not available:', error);
  }
  
  // Fallback: Use screen dimensions to determine if it's a tablet
  const { width, height } = Dimensions.get('window');
  const aspectRatio = height / width;
  return aspectRatio <= 1.6 && width >= 768;
};

export const isPhone = (): boolean => !isTablet();

// Get device info with Expo APIs
export const getDeviceInfo = () => {
  const fallbackInfo = {
    isTablet: isTablet(),
    isPhone: isPhone(),
    platform: Platform.OS,
    screenWidth: Dimensions.get('window').width,
    screenHeight: Dimensions.get('window').height,
  };
  
  try {
    // Use Expo's Device API for additional info
    if (Device.deviceType) {
      return {
        ...fallbackInfo,
        deviceType: Device.deviceType,
        brand: Device.brand,
        manufacturer: Device.manufacturer,
        modelName: Device.modelName,
        osVersion: Device.osVersion,
        osBuildId: Device.osBuildId,
        osInternalBuildId: Device.osInternalBuildId,
        deviceName: Device.deviceName,
      };
    }
  } catch (error) {
    console.warn('Expo Device API not available:', error);
  }
  
  return fallbackInfo;
};

// Get device type as string
export const getDeviceType = (): string => {
  try {
    if (Device.deviceType) {
      switch (Device.deviceType) {
        case Device.DeviceType.PHONE:
          return 'phone';
        case Device.DeviceType.TABLET:
          return 'tablet';
        case Device.DeviceType.DESKTOP:
          return 'desktop';
        case Device.DeviceType.TV:
          return 'tv';
        default:
          return 'unknown';
      }
    }
  } catch (error) {
    console.warn('Expo Device API not available:', error);
  }
  
  // Fallback
  return isTablet() ? 'tablet' : 'phone';
};

// Check if device is a specific type
export const isDeviceType = (type: 'phone' | 'tablet' | 'desktop' | 'tv'): boolean => {
  try {
    if (Device.deviceType) {
      switch (type) {
        case 'phone':
          return Device.deviceType === Device.DeviceType.PHONE;
        case 'tablet':
          return Device.deviceType === Device.DeviceType.TABLET;
        case 'desktop':
          return Device.deviceType === Device.DeviceType.DESKTOP;
        case 'tv':
          return Device.deviceType === Device.DeviceType.TV;
        default:
          return false;
      }
    }
  } catch (error) {
    console.warn('Expo Device API not available:', error);
  }
  
  // Fallback
  if (type === 'phone') return isPhone();
  if (type === 'tablet') return isTablet();
  return false;
};
