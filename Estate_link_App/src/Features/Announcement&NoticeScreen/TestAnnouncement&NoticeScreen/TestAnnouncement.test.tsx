import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import TestAnnouncement from '../TestAnnouncement';
import { getCurrentConfig, getBackendURL, getFallbackURLs } from '../../../config/environment';
import { performHealthCheck, performEnhancedHealthCheck } from '../../../utils/healthCheck';

// Mock the environment config
jest.mock('../../../config/environment', () => ({
  getCurrentConfig: jest.fn(),
  getBackendURL: jest.fn(),
  getFallbackURLs: jest.fn(),
}));

// Mock the health check utilities
jest.mock('../../../utils/healthCheck', () => ({
  performHealthCheck: jest.fn(),
  performEnhancedHealthCheck: jest.fn(),
}));

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// Mock fetch globally
global.fetch = jest.fn();

const Stack = createStackNavigator();

const renderWithNavigation = (component: React.ReactElement) => {
  return render(
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="TestAnnouncement" component={() => component} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

describe('TestAnnouncement Component', () => {
  const mockGetCurrentConfig = getCurrentConfig as jest.MockedFunction<typeof getCurrentConfig>;
  const mockGetBackendURL = getBackendURL as jest.MockedFunction<typeof getBackendURL>;
  const mockGetFallbackURLs = getFallbackURLs as jest.MockedFunction<typeof getFallbackURLs>;
  const mockPerformHealthCheck = performHealthCheck as jest.MockedFunction<typeof performHealthCheck>;
  const mockPerformEnhancedHealthCheck = performEnhancedHealthCheck as jest.MockedFunction<typeof performEnhancedHealthCheck>;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockGetCurrentConfig.mockReturnValue({
      BACKEND_URL: 'http://localhost:8000',
      API_TIMEOUT: 5000,
      AUTO_DISCOVERY: true,
      RETRY_ATTEMPTS: 3,
      RETRY_DELAY: 1000,
      NETWORK_CHECK_INTERVAL: 5000,
    });
    
    mockGetBackendURL.mockReturnValue('http://localhost:8000');
    mockGetFallbackURLs.mockReturnValue([
      'http://192.168.1.100:8000',
      'http://10.0.0.1:8000',
    ]);
    
    mockPerformHealthCheck.mockResolvedValue({
      isHealthy: true,
      message: 'Service is healthy',
      responseTime: 150,
    });
    
    mockPerformEnhancedHealthCheck.mockResolvedValue({
      isHealthy: true,
      message: 'Enhanced health check passed',
      responseTime: 200,
    });
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      renderWithNavigation(<TestAnnouncement />);
      expect(screen.getByText('🔧 Network Test & Debug')).toBeTruthy();
    });

    it('displays current configuration when available', () => {
      renderWithNavigation(<TestAnnouncement />);
      expect(screen.getByText('📱 Current Configuration')).toBeTruthy();
      expect(screen.getByText('Environment: DEV')).toBeTruthy();
      expect(screen.getByText('Primary URL: http://localhost:8000')).toBeTruthy();
      expect(screen.getByText('Timeout: 5000ms')).toBeTruthy();
      expect(screen.getByText('Auto-discovery: Enabled')).toBeTruthy();
    });

    it('shows test buttons', () => {
      renderWithNavigation(<TestAnnouncement />);
      expect(screen.getByText('🧪 Test All URLs')).toBeTruthy();
      expect(screen.getByText('🏥 Basic Health Check')).toBeTruthy();
      expect(screen.getByText('🔍 Enhanced Health Check')).toBeTruthy();
    });

    it('shows back button', () => {
      renderWithNavigation(<TestAnnouncement />);
      expect(screen.getByText('← Go Back to Dashboard')).toBeTruthy();
    });
  });

  describe('Configuration Display', () => {
    it('handles array BACKEND_URL correctly', () => {
      mockGetCurrentConfig.mockReturnValue({
        BACKEND_URL: ['http://localhost:8000', 'http://localhost:8001'],
        API_TIMEOUT: 10000,
        AUTO_DISCOVERY: false,
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000,
        NETWORK_CHECK_INTERVAL: 5000,
      });

      renderWithNavigation(<TestAnnouncement />);
      expect(screen.getByText('Primary URL: http://localhost:8000')).toBeTruthy();
      expect(screen.getByText('Timeout: 10000ms')).toBeTruthy();
      expect(screen.getByText('Auto-discovery: Disabled')).toBeTruthy();
    });

    it('handles missing configuration gracefully', () => {
      mockGetCurrentConfig.mockReturnValue(null as any);

      renderWithNavigation(<TestAnnouncement />);
      // Should still render without crashing
      expect(screen.getByText('🔧 Network Test & Debug')).toBeTruthy();
    });
  });

  describe('URL Testing', () => {
    it('tests all URLs when Test All URLs button is pressed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      renderWithNavigation(<TestAnnouncement />);
      
      const testButton = screen.getByText('🧪 Test All URLs');
      fireEvent.press(testButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/', {
          method: 'HEAD',
          signal: expect.any(AbortSignal),
          headers: {
            'Accept': 'application/json',
          },
        });
      });
    });

    it('shows testing state while tests are running', async () => {
      mockFetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderWithNavigation(<TestAnnouncement />);
      
      const testButton = screen.getByText('🧪 Test All URLs');
      fireEvent.press(testButton);

      expect(screen.getByText('🧪 Testing...')).toBeTruthy();
    });

    it('displays test results after completion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      renderWithNavigation(<TestAnnouncement />);
      
      const testButton = screen.getByText('🧪 Test All URLs');
      fireEvent.press(testButton);

      await waitFor(() => {
        expect(screen.getByText('📊 Test Results')).toBeTruthy();
        expect(screen.getByText('http://localhost:8000')).toBeTruthy();
      });
    });

    it('handles successful URL test', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      renderWithNavigation(<TestAnnouncement />);
      
      const testButton = screen.getByText('🧪 Test All URLs');
      fireEvent.press(testButton);

      await waitFor(() => {
        expect(screen.getByText('✅ Connected (200)')).toBeTruthy();
      });
    });

    it('handles failed URL test', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

      renderWithNavigation(<TestAnnouncement />);
      
      const testButton = screen.getByText('🧪 Test All URLs');
      fireEvent.press(testButton);

      await waitFor(() => {
        expect(screen.getByText('❌ Network error')).toBeTruthy();
      });
    });

    it('handles timeout error', async () => {
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AbortError')), 100);
        })
      );

      renderWithNavigation(<TestAnnouncement />);
      
      const testButton = screen.getByText('🧪 Test All URLs');
      fireEvent.press(testButton);

      await waitFor(() => {
        expect(screen.getByText('⏰ Timeout (>5s)')).toBeTruthy();
      });
    });

    it('handles HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      renderWithNavigation(<TestAnnouncement />);
      
      const testButton = screen.getByText('🧪 Test All URLs');
      fireEvent.press(testButton);

      await waitFor(() => {
        expect(screen.getByText('❌ HTTP Error: 500')).toBeTruthy();
      });
    });

    it('shows success alert when at least one URL works', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      renderWithNavigation(<TestAnnouncement />);
      
      const testButton = screen.getByText('🧪 Test All URLs');
      fireEvent.press(testButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '✅ Connection Test Complete',
          expect.stringContaining('Found 1 working backend URL(s)!'),
          [{ text: 'OK' }]
        );
      });
    });

    it('shows failure alert when no URLs work', async () => {
      mockFetch.mockRejectedValue(new Error('Network request failed'));

      renderWithNavigation(<TestAnnouncement />);
      
      const testButton = screen.getByText('🧪 Test All URLs');
      fireEvent.press(testButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '❌ Connection Test Failed',
          expect.stringContaining('No backend URLs are accessible'),
          [{ text: 'OK' }]
        );
      });
    });
  });

  describe('Health Check Tests', () => {
    it('performs basic health check when button is pressed', async () => {
      renderWithNavigation(<TestAnnouncement />);
      
      const healthCheckButton = screen.getByText('🏥 Basic Health Check');
      fireEvent.press(healthCheckButton);

      await waitFor(() => {
        expect(mockPerformHealthCheck).toHaveBeenCalled();
      });
    });

    it('shows health check result alert', async () => {
      renderWithNavigation(<TestAnnouncement />);
      
      const healthCheckButton = screen.getByText('🏥 Basic Health Check');
      fireEvent.press(healthCheckButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '🏥 Health Check Result',
          'Status: ✅ Healthy\n\nMessage: Service is healthy\n\nResponse Time: 150ms',
          [{ text: 'OK' }]
        );
      });
    });

    it('handles health check failure', async () => {
      mockPerformHealthCheck.mockRejectedValueOnce(new Error('Health check failed'));

      renderWithNavigation(<TestAnnouncement />);
      
      const healthCheckButton = screen.getByText('🏥 Basic Health Check');
      fireEvent.press(healthCheckButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '❌ Health Check Failed',
          'Health check failed'
        );
      });
    });

    it('performs enhanced health check when button is pressed', async () => {
      renderWithNavigation(<TestAnnouncement />);
      
      const enhancedHealthCheckButton = screen.getByText('🔍 Enhanced Health Check');
      fireEvent.press(enhancedHealthCheckButton);

      await waitFor(() => {
        expect(mockPerformEnhancedHealthCheck).toHaveBeenCalled();
      });
    });

    it('shows enhanced health check result alert', async () => {
      renderWithNavigation(<TestAnnouncement />);
      
      const enhancedHealthCheckButton = screen.getByText('🔍 Enhanced Health Check');
      fireEvent.press(enhancedHealthCheckButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '🔍 Enhanced Health Check Result',
          'Status: ✅ Healthy\n\nMessage: Enhanced health check passed\n\nResponse Time: 200ms',
          [{ text: 'OK' }]
        );
      });
    });

    it('handles enhanced health check failure', async () => {
      mockPerformEnhancedHealthCheck.mockRejectedValueOnce(new Error('Enhanced health check failed'));

      renderWithNavigation(<TestAnnouncement />);
      
      const enhancedHealthCheckButton = screen.getByText('🔍 Enhanced Health Check');
      fireEvent.press(enhancedHealthCheckButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '❌ Enhanced Health Check Failed',
          'Enhanced health check failed'
        );
      });
    });
  });

  describe('Test Results Display', () => {
    it('shows pending state initially', async () => {
      mockFetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      renderWithNavigation(<TestAnnouncement />);
      
      const testButton = screen.getByText('🧪 Test All URLs');
      fireEvent.press(testButton);

      expect(screen.getByText('⏳ Testing...')).toBeTruthy();
    });

    it('displays response time in results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      renderWithNavigation(<TestAnnouncement />);
      
      const testButton = screen.getByText('🧪 Test All URLs');
      fireEvent.press(testButton);

      await waitFor(() => {
        expect(screen.getByText(/Response time: \d+ms/)).toBeTruthy();
      });
    });

    it('shows different colors for different statuses', async () => {
      // Mock one success and one failure
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        } as Response)
        .mockRejectedValueOnce(new Error('Network request failed'));

      renderWithNavigation(<TestAnnouncement />);
      
      const testButton = screen.getByText('🧪 Test All URLs');
      fireEvent.press(testButton);

      await waitFor(() => {
        expect(screen.getByText('✅ Connected (200)')).toBeTruthy();
        expect(screen.getByText('❌ Network error')).toBeTruthy();
      });
    });
  });

  describe('Navigation', () => {
    it('calls goBack when back button is pressed', () => {
      const mockGoBack = jest.fn();
      jest.mocked(require('@react-navigation/native').useNavigation).mockReturnValue({
        navigate: jest.fn(),
        goBack: mockGoBack,
      });

      renderWithNavigation(<TestAnnouncement />);
      
      const backButton = screen.getByText('← Go Back to Dashboard');
      fireEvent.press(backButton);

      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles fetch errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Fetch failed'));

      renderWithNavigation(<TestAnnouncement />);
      
      const testButton = screen.getByText('🧪 Test All URLs');
      fireEvent.press(testButton);

      await waitFor(() => {
        expect(screen.getByText('❌ Fetch error')).toBeTruthy();
      });
    });

    it('handles AbortError specifically', async () => {
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      renderWithNavigation(<TestAnnouncement />);
      
      const testButton = screen.getByText('🧪 Test All URLs');
      fireEvent.press(testButton);

      await waitFor(() => {
        expect(screen.getByText('⏰ Timeout (>5s)')).toBeTruthy();
      });
    });
  });

  describe('Component Lifecycle', () => {
    it('loads configuration on mount', () => {
      renderWithNavigation(<TestAnnouncement />);
      expect(mockGetCurrentConfig).toHaveBeenCalled();
    });

    it('logs component rendering', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      renderWithNavigation(<TestAnnouncement />);
      expect(consoleSpy).toHaveBeenCalledWith('TestAnnouncement component is rendering');
      consoleSpy.mockRestore();
    });
  });

  describe('Multiple URL Testing', () => {
    it('tests all URLs including fallbacks', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      renderWithNavigation(<TestAnnouncement />);
      
      const testButton = screen.getByText('🧪 Test All URLs');
      fireEvent.press(testButton);

      await waitFor(() => {
        // Should test primary URL and all fallback URLs
        expect(mockFetch).toHaveBeenCalledTimes(3); // 1 primary + 2 fallbacks
      });
    });

    it('adds delay between tests', async () => {
      const startTime = Date.now();
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      renderWithNavigation(<TestAnnouncement />);
      
      const testButton = screen.getByText('🧪 Test All URLs');
      fireEvent.press(testButton);

      await waitFor(() => {
        const endTime = Date.now();
        // Should take at least 1000ms (500ms delay * 2 tests)
        expect(endTime - startTime).toBeGreaterThanOrEqual(1000);
      });
    });
  });
});
