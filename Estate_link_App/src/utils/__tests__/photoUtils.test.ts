import { getPhotoURL, getInitialLetter } from '../photoUtils';

// Mock the environment config
jest.mock('../../config/environment', () => ({
  getBackendURL: () => 'http://192.168.0.185:8000',
  getCurrentConfig: jest.fn(),
  getFallbackURLs: jest.fn(() => []),
}));

describe('photoUtils', () => {
  describe('getPhotoURL', () => {
    it('should return full URL for valid photo path', () => {
      const photoPath = 'members/470_MirzaHasan/player-7902240_1280.jpg';
      const result = getPhotoURL(photoPath);
      expect(result).toContain('/media/members/470_MirzaHasan/player-7902240_1280.jpg');
    });

    it('should return null for empty photo path', () => {
      const result = getPhotoURL('');
      expect(result).toBeNull();
    });

    it('should return null for null photo path', () => {
      const result = getPhotoURL(null as any);
      expect(result).toBeNull();
    });

    it('should return null for undefined photo path', () => {
      const result = getPhotoURL(undefined as any);
      expect(result).toBeNull();
    });

    it('should return null for "null" string', () => {
      const result = getPhotoURL('null');
      expect(result).toBeNull();
    });

    it('should return null for "undefined" string', () => {
      const result = getPhotoURL('undefined');
      expect(result).toBeNull();
    });
  });

  describe('getInitialLetter', () => {
    it('should return first letter for valid name', () => {
      const result = getInitialLetter('MirzaHasan');
      expect(result).toBe('M');
    });

    it('should return uppercase letter', () => {
      const result = getInitialLetter('mirzahasan');
      expect(result).toBe('M');
    });

    it('should return "U" for empty name', () => {
      const result = getInitialLetter('');
      expect(result).toBe('U');
    });

    it('should return "U" for null name', () => {
      const result = getInitialLetter(null as any);
      expect(result).toBe('U');
    });

    it('should return "U" for undefined name', () => {
      const result = getInitialLetter(undefined);
      expect(result).toBe('U');
    });

    it('should return "U" for "null" string', () => {
      const result = getInitialLetter('null');
      expect(result).toBe('U');
    });

    it('should return "U" for "undefined" string', () => {
      const result = getInitialLetter('undefined');
      expect(result).toBe('U');
    });

    it('should handle names with leading/trailing spaces', () => {
      const result = getInitialLetter('  MirzaHasan  ');
      expect(result).toBe('M');
    });
  });
});
