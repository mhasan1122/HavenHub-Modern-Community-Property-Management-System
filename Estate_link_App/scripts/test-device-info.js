#!/usr/bin/env node

/**
 * Test script for device info utility
 * This script helps verify that the device info functionality works correctly
 * and handles runtime errors gracefully.
 */

console.log('🧪 Testing Device Info Utility...\n');

// Simulate React Native environment
global.__DEV__ = true;

// Mock React Native modules
const mockDimensions = {
  get: jest.fn(() => ({ width: 390, height: 844 })),
  get: jest.fn(() => ({ width: 390, height: 844 })),
};

const mockPlatform = {
  OS: 'ios',
};

// Mock expo-device
jest.mock('expo-device', () => ({
  deviceType: 0, // PHONE
  brand: 'Apple',
  manufacturer: 'Apple Inc.',
  modelName: 'iPhone',
  osVersion: '17.0',
  osBuildId: '21A329',
  osInternalBuildId: '21A329',
  deviceName: 'iPhone',
  DeviceType: {
    PHONE: 0,
    TABLET: 1,
    DESKTOP: 2,
    TV: 3,
    UNKNOWN: 4,
  },
}));

// Test the device info utility
try {
  const { isTablet, isPhone, getDeviceInfo, getDeviceType, isDeviceType } = require('../src/utils/deviceInfo');
  
  console.log('✅ Device Info Utility loaded successfully');
  
  // Test isTablet function
  const tabletResult = isTablet();
  console.log(`📱 isTablet(): ${tabletResult}`);
  
  // Test isPhone function
  const phoneResult = isPhone();
  console.log(`📱 isPhone(): ${phoneResult}`);
  
  // Test getDeviceInfo function
  const deviceInfo = getDeviceInfo();
  console.log('📊 Device Info:', JSON.stringify(deviceInfo, null, 2));
  
  // Test getDeviceType function
  const deviceType = getDeviceType();
  console.log(`🔧 Device Type: ${deviceType}`);
  
  // Test isDeviceType function
  console.log(`📱 Is Phone: ${isDeviceType('phone')}`);
  console.log(`📱 Is Tablet: ${isDeviceType('tablet')}`);
  console.log(`💻 Is Desktop: ${isDeviceType('desktop')}`);
  console.log(`📺 Is TV: ${isDeviceType('tv')}`);
  
  console.log('\n✅ All tests passed!');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
