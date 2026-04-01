// Simple test for deviceInfo utility
describe('DeviceInfo Utility', () => {
  // Mock expo-device before importing
  jest.mock('expo-device', () => ({
    deviceType: 1, // TABLET
    brand: 'Apple',
    manufacturer: 'Apple Inc.',
    modelName: 'iPad',
    osVersion: '17.0',
    osBuildId: '21A329',
    osInternalBuildId: '21A329',
    deviceName: 'iPad',
    DeviceType: {
      PHONE: 0,
      TABLET: 1,
      DESKTOP: 2,
      TV: 3,
      UNKNOWN: 4,
    },
  }));

  // Mock react-native
  jest.mock('react-native', () => ({
    Dimensions: {
      get: jest.fn(() => ({ width: 390, height: 844 })),
    },
    Platform: {
      OS: 'ios',
    },
  }));

  let deviceInfo: any;

  beforeAll(() => {
    // Import after mocks are set up
    deviceInfo = require('../deviceInfo');
  });

  describe('isTablet', () => {
    it('should return a boolean value', () => {
      const result = deviceInfo.isTablet();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isPhone', () => {
    it('should return the opposite of isTablet', () => {
      const tabletResult = deviceInfo.isTablet();
      const phoneResult = deviceInfo.isPhone();
      expect(phoneResult).toBe(!tabletResult);
    });
  });

  describe('getDeviceInfo', () => {
    it('should return device information object', () => {
      const info = deviceInfo.getDeviceInfo();
      
      expect(info).toHaveProperty('isTablet');
      expect(info).toHaveProperty('isPhone');
      expect(info).toHaveProperty('platform');
      expect(info).toHaveProperty('screenWidth');
      expect(info).toHaveProperty('screenHeight');
      
      expect(typeof info.isTablet).toBe('boolean');
      expect(typeof info.isPhone).toBe('boolean');
      expect(typeof info.platform).toBe('string');
      expect(typeof info.screenWidth).toBe('number');
      expect(typeof info.screenHeight).toBe('number');
    });
  });

  describe('getDeviceType', () => {
    it('should return device type as string', () => {
      const deviceType = deviceInfo.getDeviceType();
      expect(typeof deviceType).toBe('string');
      expect(['phone', 'tablet', 'desktop', 'tv', 'unknown']).toContain(deviceType);
    });
  });

  describe('isDeviceType', () => {
    it('should check if device is a specific type', () => {
      expect(deviceInfo.isDeviceType('tablet')).toBe(true);
      expect(deviceInfo.isDeviceType('phone')).toBe(false);
      expect(deviceInfo.isDeviceType('desktop')).toBe(false);
      expect(deviceInfo.isDeviceType('tv')).toBe(false);
    });

    it('should handle unknown device types', () => {
      expect(deviceInfo.isDeviceType('unknown' as any)).toBe(false);
    });
  });
});
