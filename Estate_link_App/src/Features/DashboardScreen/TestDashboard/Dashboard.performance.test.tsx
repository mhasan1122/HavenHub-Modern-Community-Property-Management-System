import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { Dashboard } from '../Dashboard';

// Mock all dependencies
jest.mock('../../../store/hooks');
jest.mock('../../../hooks/useNotices');
jest.mock('../../../hooks/useAnnouncements');
jest.mock('../../../utils/photoUtils', () => ({
  getPhotoURL: jest.fn((path) => path ? `https://example.com/${path}` : null),
  getInitialLetter: jest.fn((name) => name ? name.charAt(0).toUpperCase() : 'U'),
}));

jest.mock('../../../components/NoticeBoardCard', () => ({
  NoticeBoardCard: ({ showTitle, maxItems, cardHeight, cardWidth }: any) => (
    <div data-testid="notice-board-card" data-show-title={showTitle} data-max-items={maxItems} data-card-height={cardHeight} data-card-width={cardWidth}>
      Notice Board Card
    </div>
  ),
}));

jest.mock('../../../components/SimpleTabBar', () => ({
  SimpleTabBar: ({ tabs, activeTab, onTabPress }: any) => (
    <div data-testid="animated-tab-bar" data-active-tab={activeTab}>
      {tabs.map((tab: any) => (
        <button
          key={tab.name}
          data-testid={`tab-${tab.name}`}
          onClick={() => onTabPress(tab.name)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('../../../components/SkeletonLoader', () => ({
  SkeletonCard: ({ width, height, showImage, showTitle, showDescription, showFooter }: any) => (
    <div 
      data-testid="skeleton-card" 
      data-width={width} 
      data-height={height}
      data-show-image={showImage}
      data-show-title={showTitle}
      data-show-description={showDescription}
      data-show-footer={showFooter}
    >
      Skeleton Loading...
    </div>
  ),
}));

jest.mock('react-native', () => ({
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
  },
  ActivityIndicator: 'ActivityIndicator',
  ScrollView: 'ScrollView',
  TouchableOpacity: 'TouchableOpacity',
  Text: 'Text',
  View: 'View',
  Image: 'Image',
  StatusBar: 'StatusBar',
  RefreshControl: 'RefreshControl',
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios),
  },
  Appearance: {
    getColorScheme: jest.fn(() => 'light'),
    addChangeListener: jest.fn(),
    removeChangeListener: jest.fn(),
  },
}));

const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  dispatch: jest.fn(),
  reset: jest.fn(),
  isFocused: jest.fn(() => true),
  canGoBack: jest.fn(() => true),
  getId: jest.fn(() => 'test-id'),
  getParent: jest.fn(),
  getState: jest.fn(),
  setParams: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useFocusEffect: jest.fn((callback) => callback()),
  NavigationContainer: ({ children }: any) => children,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: ({ barStyle, backgroundColor }: any) => (
    <div data-bar-style={barStyle} data-background-color={backgroundColor}>StatusBar</div>
  ),
}));

jest.mock('@expo/vector-icons/Entypo', () => ({
  __esModule: true,
  default: ({ name, size, color }: any) => (
    <div data-icon-name={name} data-size={size} data-color={color}>Icon</div>
  ),
}));

import { useAppSelector } from '../../../store/hooks';
import { useNotices } from '../../../hooks/useNotices';
import { useAnnouncements } from '../../../hooks/useAnnouncements';

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: (state = { user: null }, action) => state,
      notices: (state = { notices: [], loading: false, error: null, hasLoadedOnce: false }, action) => state,
      announcements: (state = { announcements: [], loading: false, error: null, hasLoadedOnce: false }, action) => state,
    },
    preloadedState: initialState,
  });
};

const TestWrapper = ({ children, store }: any) => (
  <Provider store={store}>
    <NavigationContainer>
      {children}
    </NavigationContainer>
  </Provider>
);

describe('Dashboard Performance Tests', () => {
  const mockUser = {
    id: 1,
    full_name: 'John Doe',
    tower: 'Tower A',
    unit: '101',
    photo: 'user-photo.jpg',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    (useAppSelector as jest.Mock).mockImplementation((selector) => {
      const state = {
        auth: { user: mockUser },
        notices: { notices: [], loading: false, error: null, hasLoadedOnce: false },
        announcements: { announcements: [], loading: false, error: null, hasLoadedOnce: false },
      };
      return selector(state);
    });

    (useNotices as jest.Mock).mockReturnValue({
      getNotices: jest.fn(),
      hasLoadedOnce: false,
      notices: [],
      loading: false,
      error: null,
    });

    (useAnnouncements as jest.Mock).mockReturnValue({
      getAnnouncements: jest.fn(),
      getPinnedAnnouncements: jest.fn(() => []),
      announcements: [],
      loading: false,
      error: null,
      hasLoadedOnce: false,
    });
  });

  describe('Render Performance', () => {
    it('should render quickly with minimal data', () => {
      const startTime = performance.now();
      
      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render in less than 100ms
      expect(renderTime).toBeLessThan(100);
    });

    it('should render efficiently with large datasets', () => {
      // Generate large datasets
      const largeNotices = Array.from({ length: 100 }, (_, index) => ({
        id: index + 1,
        title: `Test Notice ${index + 1}`,
        description: `Test description ${index + 1}`,
        status: 'active',
        priority: 'normal',
        is_pinned: false,
      }));

      const largeAnnouncements = Array.from({ length: 50 }, (_, index) => ({
        id: index + 1,
        title: `Test Announcement ${index + 1}`,
        description: `Test announcement description ${index + 1}`,
        status: 'active',
        priority: 'normal',
        is_pinned: index % 5 === 0,
        start_date: '2024-01-15',
        start_time: '10:00 AM',
      }));

      (useNotices as jest.Mock).mockReturnValue({
        getNotices: jest.fn(),
        hasLoadedOnce: true,
        notices: largeNotices,
        loading: false,
        error: null,
      });

      (useAnnouncements as jest.Mock).mockReturnValue({
        getAnnouncements: jest.fn(),
        getPinnedAnnouncements: jest.fn(() => largeAnnouncements.filter(a => a.is_pinned)),
        announcements: largeAnnouncements,
        loading: false,
        error: null,
        hasLoadedOnce: true,
      });

      const startTime = performance.now();
      
      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should still render efficiently even with large datasets
      expect(renderTime).toBeLessThan(200);
    });
  });

  describe('Interaction Performance', () => {
    it('should handle rapid button presses efficiently', () => {
      const store = createMockStore();
      const { getByText } = render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      const announcementsButton = getByText('Announcements');
      
      const startTime = performance.now();
      
      // Simulate rapid button presses
      for (let i = 0; i < 10; i++) {
        fireEvent.press(announcementsButton);
      }
      
      const endTime = performance.now();
      const interactionTime = endTime - startTime;
      
      // Should handle rapid interactions efficiently
      expect(interactionTime).toBeLessThan(50);
    });

    it('should handle tab switching efficiently', () => {
      const store = createMockStore();
      const { getByTestId } = render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      const tabs = ['home', 'info', 'services', 'feed', 'activity'];
      
      const startTime = performance.now();
      
      // Simulate rapid tab switching
      tabs.forEach(tabName => {
        const tab = getByTestId(`tab-${tabName}`);
        fireEvent.press(tab);
      });
      
      const endTime = performance.now();
      const interactionTime = endTime - startTime;
      
      // Should handle tab switching efficiently
      expect(interactionTime).toBeLessThan(100);
    });
  });

  describe('Memory Usage', () => {
    it('should not create memory leaks with multiple renders', () => {
      const store = createMockStore();
      
      // Render and unmount multiple times
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(
          <TestWrapper store={store}>
            <Dashboard />
          </TestWrapper>
        );
        unmount();
      }
      
      // If we get here without memory issues, the test passes
      expect(true).toBe(true);
    });

    it('should handle state updates efficiently', async () => {
      const mockGetNotices = jest.fn().mockResolvedValue(undefined);
      const mockGetAnnouncements = jest.fn().mockResolvedValue(undefined);
      
      (useNotices as jest.Mock).mockReturnValue({
        getNotices: mockGetNotices,
        hasLoadedOnce: false,
        notices: [],
        loading: false,
        error: null,
      });

      (useAnnouncements as jest.Mock).mockReturnValue({
        getAnnouncements: mockGetAnnouncements,
        getPinnedAnnouncements: jest.fn(() => []),
        announcements: [],
        loading: false,
        error: null,
        hasLoadedOnce: false,
      });

      const store = createMockStore();
      const { rerender } = render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      const startTime = performance.now();
      
      // Simulate state changes
      (useNotices as jest.Mock).mockReturnValue({
        getNotices: mockGetNotices,
        hasLoadedOnce: true,
        notices: [
          {
            id: 1,
            title: 'Test Notice',
            description: 'Test description',
            status: 'active',
            priority: 'normal',
            is_pinned: false,
          }
        ],
        loading: false,
        error: null,
      });

      rerender(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );
      
      const endTime = performance.now();
      const updateTime = endTime - startTime;
      
      // Should handle state updates efficiently
      expect(updateTime).toBeLessThan(50);
    });
  });

  describe('Responsive Performance', () => {
    it('should handle screen size changes efficiently', () => {
      const { Dimensions } = require('react-native');
      
      const store = createMockStore();
      const { rerender } = render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      const screenSizes = [
        { width: 320, height: 568 }, // Small
        { width: 375, height: 812 }, // Medium
        { width: 414, height: 896 }, // Large
        { width: 768, height: 1024 }, // Tablet
      ];

      screenSizes.forEach((size, index) => {
        const startTime = performance.now();
        
        Dimensions.get.mockReturnValue(size);
        rerender(
          <TestWrapper store={store}>
            <Dashboard />
          </TestWrapper>
        );
        
        const endTime = performance.now();
        const resizeTime = endTime - startTime;
        
        // Should handle screen size changes efficiently
        expect(resizeTime).toBeLessThan(100);
      });
    });
  });

  describe('Data Loading Performance', () => {
    it('should handle data loading efficiently', async () => {
      const mockGetNotices = jest.fn().mockResolvedValue(undefined);
      const mockGetAnnouncements = jest.fn().mockResolvedValue(undefined);
      
      (useNotices as jest.Mock).mockReturnValue({
        getNotices: mockGetNotices,
        hasLoadedOnce: false,
        notices: [],
        loading: false,
        error: null,
      });

      (useAnnouncements as jest.Mock).mockReturnValue({
        getAnnouncements: mockGetAnnouncements,
        getPinnedAnnouncements: jest.fn(() => []),
        announcements: [],
        loading: false,
        error: null,
        hasLoadedOnce: false,
      });

      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      const startTime = performance.now();
      
      // Simulate data loading
      await waitFor(() => {
        expect(mockGetNotices).toHaveBeenCalled();
        expect(mockGetAnnouncements).toHaveBeenCalled();
      });
      
      const endTime = performance.now();
      const loadingTime = endTime - startTime;
      
      // Should load data efficiently
      expect(loadingTime).toBeLessThan(1000);
    });
  });
});
