import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { Dashboard } from '../Dashboard';
import { useAppSelector } from '../../../store/hooks';
import { useNotices } from '../../../hooks/useNotices';
import { useAnnouncements } from '../../../hooks/useAnnouncements';

// Mock the hooks
jest.mock('../../../store/hooks');
jest.mock('../../../hooks/useNotices');
jest.mock('../../../hooks/useAnnouncements');
jest.mock('../../../utils/photoUtils', () => ({
  getPhotoURL: jest.fn((path) => path ? `https://example.com/${path}` : null),
  getInitialLetter: jest.fn((name) => name ? name.charAt(0).toUpperCase() : 'U'),
}));

// Mock the components
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

// Mock Dimensions
const mockDimensions = {
  get: jest.fn(() => ({ width: 375, height: 812 })),
};

jest.mock('react-native', () => ({
  Dimensions: mockDimensions,
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

// Mock navigation
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

// Mock useNavigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useFocusEffect: jest.fn((callback) => callback()),
  NavigationContainer: ({ children }: any) => children,
}));

// Mock SafeAreaView
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

// Mock StatusBar
jest.mock('expo-status-bar', () => ({
  StatusBar: ({ barStyle, backgroundColor }: any) => (
    <div data-bar-style={barStyle} data-background-color={backgroundColor}>StatusBar</div>
  ),
}));

// Mock Entypo icons
jest.mock('@expo/vector-icons/Entypo', () => ({
  __esModule: true,
  default: ({ name, size, color }: any) => (
    <div data-icon-name={name} data-size={size} data-color={color}>Icon</div>
  ),
}));

// Create a mock store
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

// Test wrapper component
const TestWrapper = ({ children, store }: any) => (
  <Provider store={store}>
    <NavigationContainer>
      {children}
    </NavigationContainer>
  </Provider>
);

describe('Dashboard Component', () => {
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
    {
      id: 2,
      title: 'Test Notice 2',
      description: 'Test description 2',
      status: 'active',
      priority: 'urgent',
      is_pinned: true,
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
    {
      id: 2,
      title: 'Test Announcement 2',
      description: 'Test announcement description 2',
      status: 'active',
      priority: 'urgent',
      is_pinned: false,
      start_date: '2024-01-16',
      start_time: '2:00 PM',
    },
  ];

  const mockUseNotices = {
    getNotices: jest.fn(),
    hasLoadedOnce: false,
    notices: mockNotices,
    loading: false,
    error: null,
  };

  const mockUseAnnouncements = {
    getAnnouncements: jest.fn(),
    getPinnedAnnouncements: jest.fn(() => mockAnnouncements.filter(a => a.is_pinned)),
    announcements: mockAnnouncements,
    loading: false,
    error: null,
    hasLoadedOnce: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset Dimensions mock
    mockDimensions.get.mockReturnValue({ width: 375, height: 812 });
    
    // Mock useAppSelector
    (useAppSelector as jest.Mock).mockImplementation((selector) => {
      const state = {
        auth: { user: mockUser },
        notices: { notices: mockNotices, loading: false, error: null, hasLoadedOnce: false },
        announcements: { announcements: mockAnnouncements, loading: false, error: null, hasLoadedOnce: false },
      };
      return selector(state);
    });

    // Mock useNotices
    (useNotices as jest.Mock).mockReturnValue(mockUseNotices);

    // Mock useAnnouncements
    (useAnnouncements as jest.Mock).mockReturnValue(mockUseAnnouncements);
  });

  describe('Rendering', () => {
    it('should render dashboard with user information', () => {
      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByText('John Doe')).toBeTruthy();
      expect(screen.getByText('Tower: Tower A • Unit: 101')).toBeTruthy();
    });

    it('should render dashboard items grid', () => {
      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      // Check for main dashboard items
      expect(screen.getByText('Announcements')).toBeTruthy();
      expect(screen.getByText('Complaints')).toBeTruthy();
      expect(screen.getByText('Bulletin Board')).toBeTruthy();
      expect(screen.getByText('Suggestions')).toBeTruthy();
      expect(screen.getByText('Amenities')).toBeTruthy();
      expect(screen.getByText('Event Calendar')).toBeTruthy();
      expect(screen.getByText('Surveys')).toBeTruthy();
      expect(screen.getByText('Noticeboard')).toBeTruthy();
    });

    it('should render notice board card', () => {
      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      const noticeBoardCard = screen.getByTestId('notice-board-card');
      expect(noticeBoardCard).toBeTruthy();
      expect(noticeBoardCard.props['data-show-title']).toBe(true);
      expect(noticeBoardCard.props['data-max-items']).toBe(5);
    });

    it('should render pinned announcements section', () => {
      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByText('Pinned Announcements')).toBeTruthy();
      expect(screen.getByText('Test Announcement 1')).toBeTruthy();
    });

    it('should render upcoming events section', () => {
      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByText('Upcoming Event')).toBeTruthy();
      expect(screen.getByText('BBQ Party')).toBeTruthy();
    });

    it('should render animated tab bar', () => {
      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      const tabBar = screen.getByTestId('animated-tab-bar');
      expect(tabBar).toBeTruthy();
      expect(tabBar.props['data-active-tab']).toBe('home');
    });
  });

  describe('User Photo Display', () => {
    it('should display user photo when available', () => {
      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      // Check if photo is displayed (mocked as Image component)
      const photoElements = screen.queryAllByTestId('user-photo');
      expect(photoElements.length).toBeGreaterThan(0);
    });

    it('should display initials when photo is not available', () => {
      const userWithoutPhoto = { ...mockUser, photo: null };
      (useAppSelector as jest.Mock).mockImplementation((selector) => {
        const state = {
          auth: { user: userWithoutPhoto },
          notices: { notices: mockNotices, loading: false, error: null, hasLoadedOnce: false },
          announcements: { announcements: mockAnnouncements, loading: false, error: null, hasLoadedOnce: false },
        };
        return selector(state);
      });

      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByText('J')).toBeTruthy(); // Initial of "John Doe"
    });

    it('should display fallback initial when user name is not available', () => {
      const userWithoutName = { ...mockUser, full_name: null };
      (useAppSelector as jest.Mock).mockImplementation((selector) => {
        const state = {
          auth: { user: userWithoutName },
          notices: { notices: mockNotices, loading: false, error: null, hasLoadedOnce: false },
          announcements: { announcements: mockAnnouncements, loading: false, error: null, hasLoadedOnce: false },
        };
        return selector(state);
      });

      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByText('U')).toBeTruthy(); // Fallback initial
    });
  });

  describe('Navigation', () => {
    it('should navigate to AnnouncementNotice when Announcements is pressed', () => {
      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      const announcementsButton = screen.getByText('Announcements');
      fireEvent.press(announcementsButton);

      expect(mockNavigate).toHaveBeenCalledWith('AnnouncementNotice', { activeTab: 'announcements' });
    });

    it('should navigate to AnnouncementNotice when Bulletin Board is pressed', () => {
      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      const bulletinButton = screen.getByText('Bulletin Board');
      fireEvent.press(bulletinButton);

      expect(mockNavigate).toHaveBeenCalledWith('AnnouncementNotice', { activeTab: 'bulletin' });
    });

    it('should navigate to AnnouncementNotice when Feed tab is pressed', () => {
      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      const feedTab = screen.getByTestId('tab-feed');
      fireEvent.press(feedTab);

      expect(mockNavigate).toHaveBeenCalledWith('AnnouncementNotice');
    });

    it('should navigate to AnnouncementNotice when See More is pressed in pinned announcements', () => {
      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      const seeMoreButton = screen.getByText('See More');
      fireEvent.press(seeMoreButton);

      expect(mockNavigate).toHaveBeenCalledWith('AnnouncementNotice');
    });
  });

  describe('Loading States', () => {
    it('should show loading indicator when notices are loading', () => {
      (useNotices as jest.Mock).mockReturnValue({
        ...mockUseNotices,
        loading: true,
        hasLoadedOnce: true,
      });

      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByText('Updating notices...')).toBeTruthy();
    });

    it('should show loading indicator when announcements are loading', () => {
      (useAnnouncements as jest.Mock).mockReturnValue({
        ...mockUseAnnouncements,
        loading: true,
        hasLoadedOnce: true,
      });

      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByText('Updating announcements...')).toBeTruthy();
    });

    it('should show skeleton loading for pinned announcements when loading for first time', () => {
      (useAnnouncements as jest.Mock).mockReturnValue({
        ...mockUseAnnouncements,
        loading: true,
        hasLoadedOnce: false,
        announcements: [],
      });

      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByText('Loading pinned announcements...')).toBeTruthy();
      expect(screen.getByTestId('skeleton-card')).toBeTruthy();
    });
  });

  describe('Error States', () => {
    it('should show error message when notices fail to load', () => {
      (useNotices as jest.Mock).mockReturnValue({
        ...mockUseNotices,
        error: 'Failed to load notices',
      });

      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByText('Notice Loading Error')).toBeTruthy();
      expect(screen.getByText('Failed to load notices')).toBeTruthy();
      expect(screen.getByText('Retry')).toBeTruthy();
    });

    it('should show error message when announcements fail to load', () => {
      (useAnnouncements as jest.Mock).mockReturnValue({
        ...mockUseAnnouncements,
        error: 'Failed to load announcements',
      });

      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByText('Announcements Loading Error')).toBeTruthy();
      expect(screen.getByText('Failed to load announcements')).toBeTruthy();
      expect(screen.getByText('Retry')).toBeTruthy();
    });

    it('should call getNotices when retry button is pressed for notices error', () => {
      const mockGetNotices = jest.fn();
      (useNotices as jest.Mock).mockReturnValue({
        ...mockUseNotices,
        error: 'Failed to load notices',
        getNotices: mockGetNotices,
      });

      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      const retryButton = screen.getByText('Retry');
      fireEvent.press(retryButton);

      expect(mockGetNotices).toHaveBeenCalled();
    });

    it('should call getAnnouncements when retry button is pressed for announcements error', () => {
      const mockGetAnnouncements = jest.fn();
      (useAnnouncements as jest.Mock).mockReturnValue({
        ...mockUseAnnouncements,
        error: 'Failed to load announcements',
        getAnnouncements: mockGetAnnouncements,
      });

      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      const retryButton = screen.getByText('Retry');
      fireEvent.press(retryButton);

      expect(mockGetAnnouncements).toHaveBeenCalled();
    });
  });

  describe('Refresh Functionality', () => {
    it('should call getNotices and getAnnouncements on refresh', async () => {
      const mockGetNotices = jest.fn().mockResolvedValue(undefined);
      const mockGetAnnouncements = jest.fn().mockResolvedValue(undefined);
      
      (useNotices as jest.Mock).mockReturnValue({
        ...mockUseNotices,
        getNotices: mockGetNotices,
      });

      (useAnnouncements as jest.Mock).mockReturnValue({
        ...mockUseAnnouncements,
        getAnnouncements: mockGetAnnouncements,
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

  describe('Responsive Layout', () => {
    it('should adjust layout for small screens', () => {
      mockDimensions.get.mockReturnValue({ width: 320, height: 568 }); // Small screen

      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      // The component should still render without errors
      expect(screen.getByText('John Doe')).toBeTruthy();
    });

    it('should adjust layout for large screens', () => {
      mockDimensions.get.mockReturnValue({ width: 414, height: 896 }); // Large screen

      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      // The component should still render without errors
      expect(screen.getByText('John Doe')).toBeTruthy();
    });
  });

  describe('Empty States', () => {
    it('should show empty state when no pinned announcements are available', () => {
      (useAnnouncements as jest.Mock).mockReturnValue({
        ...mockUseAnnouncements,
        announcements: [],
        getPinnedAnnouncements: jest.fn(() => []),
      });

      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByText('No pinned announcements available')).toBeTruthy();
    });
  });

  describe('Tab Navigation', () => {
    it('should handle tab press for different tabs', () => {
      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      // Test home tab (should not navigate)
      const homeTab = screen.getByTestId('tab-home');
      fireEvent.press(homeTab);
      expect(mockNavigate).not.toHaveBeenCalled();

      // Test feed tab (should navigate)
      const feedTab = screen.getByTestId('tab-feed');
      fireEvent.press(feedTab);
      expect(mockNavigate).toHaveBeenCalledWith('AnnouncementNotice');
    });
  });

  describe('Data Initialization', () => {
    it('should initialize data when user is available and not initialized', () => {
      const mockGetNotices = jest.fn();
      const mockGetAnnouncements = jest.fn();
      
      (useNotices as jest.Mock).mockReturnValue({
        ...mockUseNotices,
        hasLoadedOnce: false,
        getNotices: mockGetNotices,
      });

      (useAnnouncements as jest.Mock).mockReturnValue({
        ...mockUseAnnouncements,
        hasLoadedOnce: false,
        getAnnouncements: mockGetAnnouncements,
      });

      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      // Data should be fetched on initial render
      expect(mockGetNotices).toHaveBeenCalled();
      expect(mockGetAnnouncements).toHaveBeenCalled();
    });

    it('should not re-fetch data if already loaded', () => {
      const mockGetNotices = jest.fn();
      const mockGetAnnouncements = jest.fn();
      
      (useNotices as jest.Mock).mockReturnValue({
        ...mockUseNotices,
        hasLoadedOnce: true,
        getNotices: mockGetNotices,
      });

      (useAnnouncements as jest.Mock).mockReturnValue({
        ...mockUseAnnouncements,
        hasLoadedOnce: true,
        getAnnouncements: mockGetAnnouncements,
      });

      const store = createMockStore();
      render(
        <TestWrapper store={store}>
          <Dashboard />
        </TestWrapper>
      );

      // Data should not be re-fetched if already loaded
      expect(mockGetNotices).not.toHaveBeenCalled();
      expect(mockGetAnnouncements).not.toHaveBeenCalled();
    });
  });
});
