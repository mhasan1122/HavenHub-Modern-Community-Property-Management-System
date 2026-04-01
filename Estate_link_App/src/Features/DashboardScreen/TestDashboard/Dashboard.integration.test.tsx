import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { Dashboard } from '../Dashboard';

// Mock all the same dependencies as the unit tests
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

describe('Dashboard Integration Tests', () => {
  const mockUser = {
    id: 1,
    full_name: 'John Doe',
    tower: 'Tower A',
    unit: '101',
    photo: 'user-photo.jpg',
  };

  const mockNotices = [
    {
      id: 1,
      title: 'Test Notice 1',
      description: 'Test description',
      status: 'active',
      priority: 'normal',
      is_pinned: false,
    },
  ];

  const mockAnnouncements = [
    {
      id: 1,
      title: 'Test Announcement 1',
      description: 'Test announcement description',
      status: 'active',
      priority: 'normal',
      is_pinned: true,
      start_date: '2024-01-15',
      start_time: '10:00 AM',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    (useAppSelector as jest.Mock).mockImplementation((selector) => {
      const state = {
        auth: { user: mockUser },
        notices: { notices: mockNotices, loading: false, error: null, hasLoadedOnce: false },
        announcements: { announcements: mockAnnouncements, loading: false, error: null, hasLoadedOnce: false },
      };
      return selector(state);
    });

    (useNotices as jest.Mock).mockReturnValue({
      getNotices: jest.fn(),
      hasLoadedOnce: false,
      notices: mockNotices,
      loading: false,
      error: null,
    });

    (useAnnouncements as jest.Mock).mockReturnValue({
      getAnnouncements: jest.fn(),
      getPinnedAnnouncements: jest.fn(() => mockAnnouncements.filter(a => a.is_pinned)),
      announcements: mockAnnouncements,
      loading: false,
      error: null,
      hasLoadedOnce: false,
    });
  });

  describe('Complete User Flow', () => {
    it('should handle complete user interaction flow', async () => {
      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      // 1. User sees dashboard with their information
      expect(screen.getByText('John Doe')).toBeTruthy();
      expect(screen.getByText('Tower: Tower A • Unit: 101')).toBeTruthy();

      // 2. User sees all dashboard items
      expect(screen.getByText('Announcements')).toBeTruthy();
      expect(screen.getByText('Bulletin Board')).toBeTruthy();

      // 3. User taps on Announcements
      const announcementsButton = screen.getByText('Announcements');
      fireEvent.press(announcementsButton);
      expect(mockNavigate).toHaveBeenCalledWith('AnnouncementNotice', { activeTab: 'announcements' });

      // 4. User sees pinned announcements
      expect(screen.getByText('Pinned Announcements')).toBeTruthy();
      expect(screen.getByText('Test Announcement 1')).toBeTruthy();

      // 5. User taps "See More" in pinned announcements
      const seeMoreButton = screen.getByText('See More');
      fireEvent.press(seeMoreButton);
      expect(mockNavigate).toHaveBeenCalledWith('AnnouncementNotice');

      // 6. User sees upcoming events
      expect(screen.getByText('Upcoming Event')).toBeTruthy();
      expect(screen.getByText('BBQ Party')).toBeTruthy();

      // 7. User uses bottom navigation
      const feedTab = screen.getByTestId('tab-feed');
      fireEvent.press(feedTab);
      expect(mockNavigate).toHaveBeenCalledWith('AnnouncementNotice');
    });

    it('should handle data loading and error states in sequence', async () => {
      const mockGetNotices = jest.fn();
      const mockGetAnnouncements = jest.fn();
      
      // Start with loading state
      (useNotices as jest.Mock).mockReturnValue({
        getNotices: mockGetNotices,
        hasLoadedOnce: false,
        notices: [],
        loading: true,
        error: null,
      });

      (useAnnouncements as jest.Mock).mockReturnValue({
        getAnnouncements: mockGetAnnouncements,
        getPinnedAnnouncements: jest.fn(() => []),
        announcements: [],
        loading: true,
        error: null,
        hasLoadedOnce: false,
      });

      const store = createMockStore();
      const { rerender } = render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      // Should show loading states
      expect(screen.getByText('Loading pinned announcements...')).toBeTruthy();

      // Simulate error state
      (useNotices as jest.Mock).mockReturnValue({
        getNotices: mockGetNotices,
        hasLoadedOnce: true,
        notices: [],
        loading: false,
        error: 'Network error',
      });

      rerender(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      // Should show error state
      expect(screen.getByText('Notice Loading Error')).toBeTruthy();
      expect(screen.getByText('Network error')).toBeTruthy();

      // Simulate successful data load
      (useNotices as jest.Mock).mockReturnValue({
        getNotices: mockGetNotices,
        hasLoadedOnce: true,
        notices: mockNotices,
        loading: false,
        error: null,
      });

      (useAnnouncements as jest.Mock).mockReturnValue({
        getAnnouncements: mockGetAnnouncements,
        getPinnedAnnouncements: jest.fn(() => mockAnnouncements.filter(a => a.is_pinned)),
        announcements: mockAnnouncements,
        loading: false,
        error: null,
        hasLoadedOnce: true,
      });

      rerender(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      // Should show data
      expect(screen.getByText('Test Notice 1')).toBeTruthy();
      expect(screen.getByText('Test Announcement 1')).toBeTruthy();
    });
  });

  describe('Responsive Behavior', () => {
    it('should adapt to different screen sizes', () => {
      const { Dimensions } = require('react-native');
      
      // Test small screen
      Dimensions.get.mockReturnValue({ width: 320, height: 568 });
      
      const store = createMockStore();
      const { rerender } = render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByText('John Doe')).toBeTruthy();

      // Test large screen
      Dimensions.get.mockReturnValue({ width: 414, height: 896 });
      
      rerender(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByText('John Doe')).toBeTruthy();
    });
  });

  describe('Photo Loading States', () => {
    it('should handle photo loading and error states', () => {
      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      // Should display user photo initially
      expect(screen.getByText('John Doe')).toBeTruthy();

      // Test with user without photo
      const userWithoutPhoto = { ...mockUser, photo: null };
      (useAppSelector as jest.Mock).mockImplementation((selector) => {
        const state = {
          auth: { user: userWithoutPhoto },
          notices: { notices: mockNotices, loading: false, error: null, hasLoadedOnce: false },
          announcements: { announcements: mockAnnouncements, loading: false, error: null, hasLoadedOnce: false },
        };
        return selector(state);
      });

      const { rerender } = render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      // Should show initials instead of photo
      expect(screen.getByText('J')).toBeTruthy();
    });
  });

  describe('Tab Navigation Flow', () => {
    it('should handle tab navigation correctly', () => {
      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      // Test all tab interactions
      const tabs = ['home', 'info', 'services', 'feed', 'activity'];
      
      tabs.forEach(tabName => {
        const tab = screen.getByTestId(`tab-${tabName}`);
        fireEvent.press(tab);
        
        if (tabName === 'feed') {
          expect(mockNavigate).toHaveBeenCalledWith('AnnouncementNotice');
        } else {
          // Other tabs should not navigate (as per current implementation)
          expect(mockNavigate).not.toHaveBeenCalledWith();
        }
      });
    });
  });

  describe('Refresh Flow', () => {
    it('should handle pull-to-refresh correctly', async () => {
      const mockGetNotices = jest.fn().mockResolvedValue(undefined);
      const mockGetAnnouncements = jest.fn().mockResolvedValue(undefined);
      
      (useNotices as jest.Mock).mockReturnValue({
        getNotices: mockGetNotices,
        hasLoadedOnce: true,
        notices: mockNotices,
        loading: false,
        error: null,
      });

      (useAnnouncements as jest.Mock).mockReturnValue({
        getAnnouncements: mockGetAnnouncements,
        getPinnedAnnouncements: jest.fn(() => mockAnnouncements.filter(a => a.is_pinned)),
        announcements: mockAnnouncements,
        loading: false,
        error: null,
        hasLoadedOnce: true,
      });

      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      // Simulate pull-to-refresh
      const scrollView = screen.getByTestId('scroll-view');
      fireEvent.scroll(scrollView, { nativeEvent: { contentOffset: { y: -100 } } });

      await waitFor(() => {
        expect(mockGetNotices).toHaveBeenCalled();
        expect(mockGetAnnouncements).toHaveBeenCalled();
      });
    });
  });
});
