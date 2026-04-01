import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// Mock all dependencies
jest.mock('../../../store/hooks', () => ({
  useAppSelector: jest.fn(),
}));

jest.mock('../../../hooks/useNotices', () => ({
  useNotices: jest.fn(),
}));

jest.mock('../../../hooks/useAnnouncements', () => ({
  useAnnouncements: jest.fn(),
}));

jest.mock('../../../utils/photoUtils', () => ({
  getPhotoURL: jest.fn((path) => path ? `https://example.com/${path}` : null),
  getInitialLetter: jest.fn((name) => name ? name.charAt(0).toUpperCase() : 'U'),
}));

jest.mock('../../../components/NoticeBoardCard', () => ({
  NoticeBoardCard: () => <div data-testid="notice-board-card">Notice Board Card</div>,
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
  SkeletonCard: () => <div data-testid="skeleton-card">Skeleton Loading...</div>,
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
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
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
  }),
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

import { Dashboard } from '../Dashboard';
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

describe('Dashboard Component - Simple Tests', () => {
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

  it('should display user initials when photo is not available', () => {
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

  it('should show loading state when notices are loading', () => {
    (useNotices as jest.Mock).mockReturnValue({
      getNotices: jest.fn(),
      hasLoadedOnce: true,
      notices: [],
      loading: true,
      error: null,
    });

    const store = createMockStore();
    render(
      <TestWrapper store={store}>
        <Dashboard />
      </TestWrapper>
    );

    expect(screen.getByText('Updating notices...')).toBeTruthy();
  });

  it('should show error state when notices fail to load', () => {
    (useNotices as jest.Mock).mockReturnValue({
      getNotices: jest.fn(),
      hasLoadedOnce: true,
      notices: [],
      loading: false,
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

  it('should show empty state when no pinned announcements are available', () => {
    (useAnnouncements as jest.Mock).mockReturnValue({
      getAnnouncements: jest.fn(),
      getPinnedAnnouncements: jest.fn(() => []),
      announcements: [],
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

    expect(screen.getByText('No pinned announcements available')).toBeTruthy();
  });
});
