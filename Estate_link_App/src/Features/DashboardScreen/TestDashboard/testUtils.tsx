import React from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// Mock data for testing
export const mockUser = {
  id: 1,
  full_name: 'John Doe',
  tower: 'Tower A',
  unit: '101',
  photo: 'user-photo.jpg',
};

export const mockNotices = [
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

export const mockAnnouncements = [
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

// Mock store creator
export const createMockStore = (initialState = {}) => {
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
interface TestWrapperProps {
  children: React.ReactNode;
  store?: any;
}

export const TestWrapper: React.FC<TestWrapperProps> = ({ children, store }) => (
  <Provider store={store || createMockStore()}>
    <NavigationContainer>
      {children}
    </NavigationContainer>
  </Provider>
);

// Custom render function
export const renderWithProviders = (
  ui: React.ReactElement,
  {
    store = createMockStore(),
    ...renderOptions
  }: RenderOptions & { store?: any } = {}
) => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <TestWrapper store={store}>{children}</TestWrapper>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Mock navigation
export const mockNavigate = jest.fn();
export const mockNavigation = {
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

// Mock hooks return values
export const createMockUseNotices = (overrides = {}) => ({
  getNotices: jest.fn(),
  hasLoadedOnce: false,
  notices: mockNotices,
  loading: false,
  error: null,
  ...overrides,
});

export const createMockUseAnnouncements = (overrides = {}) => ({
  getAnnouncements: jest.fn(),
  getPinnedAnnouncements: jest.fn(() => mockAnnouncements.filter(a => a.is_pinned)),
  announcements: mockAnnouncements,
  loading: false,
  error: null,
  hasLoadedOnce: false,
  ...overrides,
});

// Test scenarios
export const testScenarios = {
  loading: {
    notices: { loading: true, hasLoadedOnce: true },
    announcements: { loading: true, hasLoadedOnce: true },
  },
  error: {
    notices: { error: 'Failed to load notices' },
    announcements: { error: 'Failed to load announcements' },
  },
  empty: {
    notices: { notices: [] },
    announcements: { announcements: [], getPinnedAnnouncements: jest.fn(() => []) },
  },
  success: {
    notices: { notices: mockNotices, hasLoadedOnce: true },
    announcements: { announcements: mockAnnouncements, hasLoadedOnce: true },
  },
};

// Helper functions for common test operations
export const testHelpers = {
  // Simulate user interaction with dashboard items
  clickDashboardItem: (screen: any, itemName: string) => {
    const item = screen.getByText(itemName);
    fireEvent.press(item);
  },

  // Simulate tab navigation
  clickTab: (screen: any, tabName: string) => {
    const tab = screen.getByTestId(`tab-${tabName}`);
    fireEvent.press(tab);
  },

  // Simulate pull-to-refresh
  pullToRefresh: (screen: any) => {
    const scrollView = screen.getByTestId('scroll-view');
    fireEvent.scroll(scrollView, { nativeEvent: { contentOffset: { y: -100 } } });
  },

  // Check if element exists
  elementExists: (screen: any, text: string) => {
    try {
      screen.getByText(text);
      return true;
    } catch {
      return false;
    }
  },
};

// Mock dimensions for responsive testing
export const mockDimensions = {
  small: { width: 320, height: 568 },
  medium: { width: 375, height: 812 },
  large: { width: 414, height: 896 },
  tablet: { width: 768, height: 1024 },
};

// Test data generators
export const generateMockNotices = (count: number) => {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    title: `Test Notice ${index + 1}`,
    description: `Test description ${index + 1}`,
    status: 'active',
    priority: index % 2 === 0 ? 'normal' : 'urgent',
    is_pinned: index % 3 === 0,
  }));
};

export const generateMockAnnouncements = (count: number) => {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    title: `Test Announcement ${index + 1}`,
    description: `Test announcement description ${index + 1}`,
    status: 'active',
    priority: index % 2 === 0 ? 'normal' : 'urgent',
    is_pinned: index % 3 === 0,
    start_date: `2024-01-${15 + index}`,
    start_time: `${10 + index}:00 AM`,
  }));
};

// Assertion helpers
export const assertions = {
  // Check if navigation was called correctly
  expectNavigation: (mockNavigate: jest.Mock, route: string, params?: any) => {
    if (params) {
      expect(mockNavigate).toHaveBeenCalledWith(route, params);
    } else {
      expect(mockNavigate).toHaveBeenCalledWith(route);
    }
  },

  // Check if loading state is shown
  expectLoadingState: (screen: any, loadingText: string) => {
    expect(screen.getByText(loadingText)).toBeTruthy();
  },

  // Check if error state is shown
  expectErrorState: (screen: any, errorTitle: string, errorMessage: string) => {
    expect(screen.getByText(errorTitle)).toBeTruthy();
    expect(screen.getByText(errorMessage)).toBeTruthy();
    expect(screen.getByText('Retry')).toBeTruthy();
  },

  // Check if data is displayed
  expectDataDisplayed: (screen: any, dataItems: string[]) => {
    dataItems.forEach(item => {
      expect(screen.getByText(item)).toBeTruthy();
    });
  },
};

// Import fireEvent for use in helpers
import { fireEvent } from '@testing-library/react-native';
