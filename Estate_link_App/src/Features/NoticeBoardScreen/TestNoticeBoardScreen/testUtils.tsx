import React from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// Mock data for NoticeBoard testing
export const mockUser = {
  id: 1,
  username: 'johndoe',
  full_name: 'John Doe',
  tower: 'Tower A',
  unit: '101',
  photo: 'user-photo.jpg',
};

export const mockNotices = [
  {
    id: 1,
    internal_title: 'Test Notice 1',
    title: 'Test Notice 1 Title',
    description: 'Test notice description 1',
    creator_name: 'John Doe',
    status: 'ongoing',
    priority: 'normal',
    label: 'Important',
    start_date: '2024-01-15',
    end_date: '2024-01-20',
    attachments: [
      {
        id: 1,
        file_name: 'notice1.pdf',
        file_type: 'application/pdf',
        file: 'https://example.com/notice1.pdf',
        file_url: 'https://example.com/notice1.pdf'
      }
    ]
  },
  {
    id: 2,
    internal_title: 'Test Notice 2',
    title: 'Test Notice 2 Title',
    description: 'Test notice description 2',
    creator_name: 'Jane Smith',
    status: 'upcoming',
    priority: 'urgent',
    label: 'Critical',
    start_date: '2024-01-16',
    end_date: '2024-01-25',
    attachments: [
      {
        id: 2,
        file_name: 'notice2.jpg',
        file_type: 'image/jpeg',
        file: 'https://example.com/notice2.jpg',
        file_url: 'https://example.com/notice2.jpg'
      },
      {
        id: 3,
        file_name: 'notice2-2.png',
        file_type: 'image/png',
        file: 'https://example.com/notice2-2.png',
        file_url: 'https://example.com/notice2-2.png'
      }
    ]
  },
  {
    id: 3,
    internal_title: 'Text Only Notice',
    title: 'Text Only Notice Title',
    description: 'This is a text-only notice without attachments',
    creator_name: 'Bob Wilson',
    status: 'ongoing',
    priority: 'normal',
    label: 'Info',
    start_date: '2024-01-17',
    end_date: '2024-01-22',
    attachments: []
  }
];

export const mockShowNoticeBoardParams = {
  notice: mockNotices[0],
  allNotices: mockNotices,
  currentNoticeIndex: 0,
  selectedAttachmentIndex: 0,
  returnToScreen: 'NoticeBoard'
};

// Mock store creator
export const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: (state = { 
        user: mockUser, 
        isAuthenticated: true, 
        accessToken: 'mock-token-123',
        isLoading: false 
      }, action) => state,
      notices: (state = { 
        notices: mockNotices, 
        loading: false, 
        error: null, 
        hasLoadedOnce: true 
      }, action) => state,
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
export const mockGoBack = jest.fn();
export const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
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

// Mock route
export const mockRoute = {
  params: mockShowNoticeBoardParams,
  key: 'test-route-key',
  name: 'ShowNoticeBoard',
};

// Mock hooks return values
export const createMockUseNotices = (overrides = {}) => ({
  getNotices: jest.fn(),
  updateNoticeStatuses: jest.fn(),
  hasLoadedOnce: true,
  notices: mockNotices,
  loading: false,
  error: null,
  clearNoticeError: jest.fn(),
  ...overrides,
});

export const createMockUseFocusEffect = (callback: any) => {
  // Simulate focus effect by calling the callback immediately
  callback();
  return jest.fn();
};

// Test scenarios
export const testScenarios = {
  loading: {
    notices: { loading: true, hasLoadedOnce: false },
    auth: { isLoading: true },
  },
  error: {
    notices: { error: 'Failed to load notices' },
    auth: { error: 'Authentication failed' },
  },
  empty: {
    notices: { notices: [], hasLoadedOnce: true },
    auth: { user: null, isAuthenticated: false },
  },
  success: {
    notices: { notices: mockNotices, hasLoadedOnce: true },
    auth: { user: mockUser, isAuthenticated: true, accessToken: 'token-123' },
  },
  unauthenticated: {
    notices: { notices: [], hasLoadedOnce: false },
    auth: { user: null, isAuthenticated: false, accessToken: null },
  },
};

// Helper functions for common test operations
export const testHelpers = {
  // Simulate user interaction with notice cards
  clickNoticeCard: (screen: any, noticeTitle: string) => {
    const card = screen.getByText(noticeTitle);
    fireEvent.press(card);
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

  // Simulate touch interactions for ShowNoticeBoard
  simulateSwipeLeft: (screen: any) => {
    const content = screen.getByTestId('story-content');
    fireEvent(content, 'touchStart', {
      nativeEvent: { touches: [{ pageX: 200, pageY: 300 }] }
    });
    fireEvent(content, 'touchEnd', {
      nativeEvent: { changedTouches: [{ pageX: 50, pageY: 300 }] }
    });
  },

  simulateSwipeRight: (screen: any) => {
    const content = screen.getByTestId('story-content');
    fireEvent(content, 'touchStart', {
      nativeEvent: { touches: [{ pageX: 50, pageY: 300 }] }
    });
    fireEvent(content, 'touchEnd', {
      nativeEvent: { changedTouches: [{ pageX: 200, pageY: 300 }] }
    });
  },

  simulateSwipeDown: (screen: any) => {
    const content = screen.getByTestId('story-content');
    fireEvent(content, 'touchStart', {
      nativeEvent: { touches: [{ pageX: 200, pageY: 100 }] }
    });
    fireEvent(content, 'touchEnd', {
      nativeEvent: { changedTouches: [{ pageX: 200, pageY: 300 }] }
    });
  },

  simulateTap: (screen: any, x: number, y: number) => {
    const content = screen.getByTestId('story-content');
    fireEvent(content, 'touchStart', {
      nativeEvent: { touches: [{ pageX: x, pageY: y }] }
    });
    fireEvent(content, 'touchEnd', {
      nativeEvent: { changedTouches: [{ pageX: x, pageY: y }] }
    });
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

  // Check if element exists by testID
  elementExistsByTestId: (screen: any, testId: string) => {
    try {
      screen.getByTestId(testId);
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
    internal_title: `Test Notice ${index + 1}`,
    title: `Test Notice ${index + 1} Title`,
    description: `Test notice description ${index + 1}`,
    creator_name: `Creator ${index + 1}`,
    status: index % 3 === 0 ? 'ongoing' : index % 3 === 1 ? 'upcoming' : 'expired',
    priority: index % 2 === 0 ? 'normal' : 'urgent',
    label: index % 4 === 0 ? 'Important' : index % 4 === 1 ? 'Critical' : index % 4 === 2 ? 'Info' : 'Update',
    start_date: `2024-01-${15 + index}`,
    end_date: `2024-01-${20 + index}`,
    attachments: index % 3 === 0 ? [
      {
        id: index + 1,
        file_name: `notice${index + 1}.pdf`,
        file_type: 'application/pdf',
        file: `https://example.com/notice${index + 1}.pdf`,
        file_url: `https://example.com/notice${index + 1}.pdf`
      }
    ] : index % 3 === 1 ? [
      {
        id: index + 1,
        file_name: `notice${index + 1}.jpg`,
        file_type: 'image/jpeg',
        file: `https://example.com/notice${index + 1}.jpg`,
        file_url: `https://example.com/notice${index + 1}.jpg`
      }
    ] : []
  }));
};

export const generateMockAttachments = (count: number, fileType: string = 'application/pdf') => {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    file_name: `attachment${index + 1}.${fileType === 'application/pdf' ? 'pdf' : 'jpg'}`,
    file_type: fileType,
    file: `https://example.com/attachment${index + 1}.${fileType === 'application/pdf' ? 'pdf' : 'jpg'}`,
    file_url: `https://example.com/attachment${index + 1}.${fileType === 'application/pdf' ? 'pdf' : 'jpg'}`
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

  // Check if goBack was called
  expectGoBack: (mockGoBack: jest.Mock) => {
    expect(mockGoBack).toHaveBeenCalled();
  },

  // Check if loading state is shown
  expectLoadingState: (screen: any, loadingText: string) => {
    expect(screen.getByText(loadingText)).toBeTruthy();
  },

  // Check if error state is shown
  expectErrorState: (screen: any, errorTitle: string, errorMessage: string) => {
    expect(screen.getByText(errorTitle)).toBeTruthy();
    expect(screen.getByText(errorMessage)).toBeTruthy();
  },

  // Check if data is displayed
  expectDataDisplayed: (screen: any, dataItems: string[]) => {
    dataItems.forEach(item => {
      expect(screen.getByText(item)).toBeTruthy();
    });
  },

  // Check if notice card is displayed
  expectNoticeCard: (screen: any, noticeTitle: string, creatorName: string) => {
    expect(screen.getByText(noticeTitle)).toBeTruthy();
    expect(screen.getByText(`By ${creatorName}`)).toBeTruthy();
  },

  // Check if status indicator is displayed
  expectStatusIndicator: (screen: any, status: string) => {
    const statusText = status.charAt(0).toUpperCase() + status.slice(1);
    expect(screen.getByText(statusText)).toBeTruthy();
  },

  // Check if progress indicators are displayed
  expectProgressIndicators: (screen: any, totalSegments: number) => {
    const progressBars = screen.getAllByTestId(/progress-bar-/);
    expect(progressBars).toHaveLength(totalSegments);
  },

  // Check if attachment type is displayed correctly
  expectAttachmentType: (screen: any, fileType: string) => {
    if (fileType === 'application/pdf') {
      expect(screen.getByText('PDF Document')).toBeTruthy();
    } else if (fileType.startsWith('image/')) {
      // Image should be displayed, no specific text
      expect(screen.getByTestId('image-attachment')).toBeTruthy();
    }
  },
};

// Mock timers for testing
export const mockTimers = {
  setup: () => {
    jest.useFakeTimers();
  },
  
  teardown: () => {
    jest.useRealTimers();
  },
  
  advanceBy: (ms: number) => {
    jest.advanceTimersByTime(ms);
  },
  
  runAll: () => {
    jest.runAllTimers();
  },
  
  runOnlyPendingTimers: () => {
    jest.runOnlyPendingTimers();
  },
};

// Mock animations
export const mockAnimations = {
  createAnimatedValue: (value: number) => {
    const animatedValue = {
      _value: value,
      setValue: jest.fn((newValue: number) => { animatedValue._value = newValue; }),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      stopAnimation: jest.fn(),
      interpolate: jest.fn((config: any) => config.outputRange[0]),
    };
    return animatedValue;
  },
  
  createAnimatedTiming: jest.fn(() => ({
    start: jest.fn((callback?: (finished: boolean) => void) => {
      if (callback) callback(true);
    }),
    stop: jest.fn(),
  })),
};

// Import fireEvent for use in helpers
import { fireEvent } from '@testing-library/react-native';
