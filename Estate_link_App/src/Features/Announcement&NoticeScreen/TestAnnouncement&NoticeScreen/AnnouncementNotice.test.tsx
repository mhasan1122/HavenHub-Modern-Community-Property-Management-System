// Mock React Native Appearance API for this test file
jest.mock('react-native/Libraries/Utilities/Appearance', () => ({
  getColorScheme: jest.fn(() => 'light'),
  addChangeListener: jest.fn(() => ({ remove: jest.fn() })),
  removeChangeListener: jest.fn(),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
}));

// Mock the hooks first
jest.mock('../../../hooks/useAnnouncements');
jest.mock('../../../hooks/useNotices');
jest.mock('../../../store/hooks', () => ({
  useAppSelector: jest.fn(),
}));

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AnnouncementNotice from '../AnnouncementNotice';
import { useAnnouncements } from '../../../hooks/useAnnouncements';
import { useNotices } from '../../../hooks/useNotices';

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
  useFocusEffect: jest.fn(),
  useRoute: () => ({
    params: {},
  }),
}));

// Mock components - use simple mocks without requiring react-native
jest.mock('../../../components/AttachmentViewer', () => {
  return function MockAttachmentViewer() {
    return null;
  };
});

jest.mock('../../../components/NoticeBoardCard', () => {
  return function MockNoticeBoardCard() {
    return null;
  };
});

jest.mock('../../../components/SimpleTabBar', () => {
  return function MockSimpleTabBar() {
    return null;
  };
});

jest.mock('../../BulletinScreen', () => {
  return {
    BulletinBoard: function MockBulletinBoard() {
      return null;
    },
  };
});

// Mock utilities
jest.mock('../../../utils/photoUtils', () => ({
  getPhotoURL: jest.fn(() => 'https://example.com/photo.jpg'),
  getInitialLetter: jest.fn(() => 'J'),
}));

// Mock DateTimePicker
jest.mock('@react-native-community/datetimepicker', () => {
  return function MockDateTimePicker() {
    return null;
  };
});

// Mock icons
jest.mock('@expo/vector-icons/Ionicons', () => {
  return {
    Ionicons: ({ name, testID, ...props }: any) => null
  };
});

jest.mock('@expo/vector-icons/Entypo', () => {
  return {
    Entypo: ({ name, testID, ...props }: any) => null
  };
});

jest.mock('@expo/vector-icons/FontAwesome6', () => {
  return {
    FontAwesome6: ({ name, testID, ...props }: any) => null
  };
});

// Mock SafeAreaView
jest.mock('react-native-safe-area-context', () => {
  return {
    SafeAreaView: ({ children, ...props }: any) => children,
  };
});

// Create mock store
const createMockStore = (initialState: any = {}) => {
  return configureStore({
    reducer: {
      auth: (state: any = {
        isAuthenticated: true,
        accessToken: 'mock-token',
        user: {
          id: 1,
          username: 'testuser',
          full_name: 'Test User',
          tower: 'Tower A',
          unit: '101',
          photo: 'test-photo.jpg',
        },
        isLoading: false,
        ...initialState.auth,
      }) => state,
    } as any,
    preloadedState: initialState,
  });
};

// Mock announcements data - simplified to avoid type issues
const mockAnnouncements = [
  {
    id: 1,
    title: 'Test Announcement 1',
    description: 'This is a test announcement',
    created_at: '2024-01-01T10:00:00Z',
    priority: 'high',
    label: 'important,urgent',
    is_pinned: true,
    post_as: 'group',
    group_name: 'Management',
    creator_name: 'Admin User',
    attachments: [
      { id: 1, file_name: 'test.pdf', file_url: 'https://example.com/test.pdf' },
    ],
  },
  {
    id: 2,
    title: 'Test Announcement 2',
    description: 'Another test announcement',
    created_at: '2024-01-02T10:00:00Z',
    priority: 'normal',
    label: 'general',
    is_pinned: false,
    post_as: 'member',
    member_name: 'John Doe',
    creator_name: 'John Doe',
    attachments: [],
  },
] as any[];

// Mock notices data - simplified to avoid type issues
const mockNotices = [
  {
    id: 1,
    title: 'Test Notice 1',
    content: 'This is a test notice',
    created_at: '2024-01-01T10:00:00Z',
    status: 'ongoing',
  },
] as any[];

const Stack = createStackNavigator();

const renderWithProviders = (component: React.ReactElement, initialState = {}) => {
  const store = createMockStore(initialState);
  
  return render(
    <Provider store={store}>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="AnnouncementNotice" component={() => component} />
        </Stack.Navigator>
      </NavigationContainer>
    </Provider>
  );
};

describe('AnnouncementNotice Component', () => {
  const mockUseAnnouncements = useAnnouncements as jest.MockedFunction<typeof useAnnouncements>;
  const mockUseNotices = useNotices as jest.MockedFunction<typeof useNotices>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockUseAnnouncements.mockReturnValue({
      announcements: mockAnnouncements,
      loading: false,
      error: null,
      hasLoadedOnce: true,
      getAnnouncements: jest.fn(),
      selectedAnnouncement: null,
      filters: {},
      totalCount: 0,
      getAnnouncementById: jest.fn(),
      createAnnouncement: jest.fn(),
      updateAnnouncement: jest.fn(),
      deleteAnnouncement: jest.fn(),
      pinAnnouncement: jest.fn(),
      unpinAnnouncement: jest.fn(),
      setSelectedAnnouncement: jest.fn(),
      setFilters: jest.fn(),
      clearFilters: jest.fn(),
      refreshAnnouncements: jest.fn(),
      getActiveAnnouncements: jest.fn(() => mockAnnouncements),
    } as any);

    mockUseNotices.mockReturnValue({
      notices: mockNotices,
      loading: false,
      error: null,
      hasLoadedOnce: true,
      getNotices: jest.fn(),
      selectedNotice: null,
      filters: {},
      totalCount: 0,
      getNoticeById: jest.fn(),
      createNotice: jest.fn(),
      updateNotice: jest.fn(),
      deleteNotice: jest.fn(),
      setSelectedNotice: jest.fn(),
      setFilters: jest.fn(),
      clearFilters: jest.fn(),
      refreshNotices: jest.fn(),
      getActiveNotices: jest.fn(() => mockNotices),
    } as any);
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      renderWithProviders(<AnnouncementNotice />);
      expect(screen.getByTestId('notice-board-card')).toBeTruthy();
    });

    it('displays user information in header', () => {
      renderWithProviders(<AnnouncementNotice />);
      expect(screen.getByText('Test User')).toBeTruthy();
      expect(screen.getByText('Tower: Tower A • Unit: 101')).toBeTruthy();
    });

    it('shows content tabs', () => {
      renderWithProviders(<AnnouncementNotice />);
      expect(screen.getByText('Announcements & Notice')).toBeTruthy();
      expect(screen.getByText('Bulletin Board')).toBeTruthy();
    });

    it('displays announcements when announcements tab is active', () => {
      renderWithProviders(<AnnouncementNotice />);
      expect(screen.getByText('Test Announcement 1')).toBeTruthy();
      expect(screen.getByText('Test Announcement 2')).toBeTruthy();
    });
  });

  describe('Authentication States', () => {
    it('shows loading state when authentication is loading', () => {
      renderWithProviders(<AnnouncementNotice />, {
        auth: { isLoading: true },
      });
      expect(screen.getByText('Checking authentication...')).toBeTruthy();
    });

    it('shows authentication required message when not authenticated', () => {
      renderWithProviders(<AnnouncementNotice />, {
        auth: { isAuthenticated: false, accessToken: null },
      });
      expect(screen.getByText('Authentication required')).toBeTruthy();
      expect(screen.getByText('Please log in to access this feature.')).toBeTruthy();
    });

    it('shows login button when not authenticated', () => {
      renderWithProviders(<AnnouncementNotice />, {
        auth: { isAuthenticated: false, accessToken: null },
      });
      expect(screen.getByText('Go to Login')).toBeTruthy();
    });
  });

  describe('Tab Navigation', () => {
    it('switches to bulletin board tab when clicked', async () => {
      renderWithProviders(<AnnouncementNotice />);
      
      const bulletinTab = screen.getByText('Bulletin Board');
      fireEvent.press(bulletinTab);
      
      await waitFor(() => {
        expect(screen.getByTestId('bulletin-board')).toBeTruthy();
      });
    });

    it('switches back to announcements tab when clicked', async () => {
      renderWithProviders(<AnnouncementNotice />);
      
      // First switch to bulletin
      const bulletinTab = screen.getByText('Bulletin Board');
      fireEvent.press(bulletinTab);
      
      await waitFor(() => {
        expect(screen.getByTestId('bulletin-board')).toBeTruthy();
      });
      
      // Then switch back to announcements
      const announcementsTab = screen.getByText('Announcements & Notice');
      fireEvent.press(announcementsTab);
      
      await waitFor(() => {
        expect(screen.getByText('Test Announcement 1')).toBeTruthy();
      });
    });
  });

  describe('Filter Functionality', () => {
    it('shows filter button', () => {
      renderWithProviders(<AnnouncementNotice />);
      expect(screen.getByText('Filter')).toBeTruthy();
    });

    it('toggles filter panel when filter button is pressed', () => {
      renderWithProviders(<AnnouncementNotice />);
      
      const filterButton = screen.getByText('Filter');
      fireEvent.press(filterButton);
      
      expect(screen.getByText('Select Date')).toBeTruthy();
      expect(screen.getByText('Select Priority')).toBeTruthy();
      expect(screen.getByText('Select Label')).toBeTruthy();
    });

    it('shows date picker when date filter is pressed', () => {
      renderWithProviders(<AnnouncementNotice />);
      
      // Open filter panel
      const filterButton = screen.getByText('Filter');
      fireEvent.press(filterButton);
      
      // Click date filter
      const dateFilter = screen.getByText('Select Date');
      fireEvent.press(dateFilter);
      
      expect(screen.getByTestId('date-time-picker')).toBeTruthy();
    });

    it('shows priority options when priority filter is pressed', () => {
      renderWithProviders(<AnnouncementNotice />);
      
      // Open filter panel
      const filterButton = screen.getByText('Filter');
      fireEvent.press(filterButton);
      
      // Click priority filter
      const priorityFilter = screen.getByText('Select Priority');
      fireEvent.press(priorityFilter);
      
      expect(screen.getByText('urgent')).toBeTruthy();
      expect(screen.getByText('high')).toBeTruthy();
      expect(screen.getByText('normal')).toBeTruthy();
      expect(screen.getByText('low')).toBeTruthy();
    });

    it('shows label options when label filter is pressed', () => {
      renderWithProviders(<AnnouncementNotice />);
      
      // Open filter panel
      const filterButton = screen.getByText('Filter');
      fireEvent.press(filterButton);
      
      // Click label filter
      const labelFilter = screen.getByText('Select Label');
      fireEvent.press(labelFilter);
      
      expect(screen.getByText('important')).toBeTruthy();
      expect(screen.getByText('urgent')).toBeTruthy();
      expect(screen.getByText('general')).toBeTruthy();
    });
  });

  describe('Announcement Display', () => {
    it('displays announcement title and description', () => {
      renderWithProviders(<AnnouncementNotice />);
      expect(screen.getByText('Test Announcement 1')).toBeTruthy();
      expect(screen.getByText('This is a test announcement')).toBeTruthy();
    });

    it('displays author information correctly', () => {
      renderWithProviders(<AnnouncementNotice />);
      expect(screen.getByText('Management')).toBeTruthy();
      expect(screen.getByText('John Doe')).toBeTruthy();
    });

    it('displays priority flags with correct colors', () => {
      renderWithProviders(<AnnouncementNotice />);
      // The priority flags should be displayed as icons
      expect(screen.getByTestId('icon-flag')).toBeTruthy();
    });

    it('displays pinned announcements with pin icon', () => {
      renderWithProviders(<AnnouncementNotice />);
      expect(screen.getByTestId('icon-pin')).toBeTruthy();
    });

    it('displays labels correctly', () => {
      renderWithProviders(<AnnouncementNotice />);
      expect(screen.getByText('important')).toBeTruthy();
      expect(screen.getByText('urgent')).toBeTruthy();
      expect(screen.getByText('general')).toBeTruthy();
    });

    it('displays attachments when present', () => {
      renderWithProviders(<AnnouncementNotice />);
      expect(screen.getByTestId('attachment-viewer')).toBeTruthy();
    });
  });

  describe('Empty States', () => {
    it('shows empty state when no announcements are available', () => {
      mockUseAnnouncements.mockReturnValue({
        announcements: [],
        loading: false,
        error: null,
        hasLoadedOnce: true,
        getAnnouncements: jest.fn(),
        selectedAnnouncement: null,
        filters: {},
        totalCount: 0,
        getAnnouncementById: jest.fn(),
        createAnnouncement: jest.fn(),
        updateAnnouncement: jest.fn(),
        deleteAnnouncement: jest.fn(),
        pinAnnouncement: jest.fn(),
        unpinAnnouncement: jest.fn(),
        setSelectedAnnouncement: jest.fn(),
        setFilters: jest.fn(),
        clearFilters: jest.fn(),
        refreshAnnouncements: jest.fn(),
        getActiveAnnouncements: jest.fn(() => []),
      } as any);

      renderWithProviders(<AnnouncementNotice />);
      expect(screen.getByText('No announcements found')).toBeTruthy();
    });

    it('shows loading state when announcements are loading', () => {
      mockUseAnnouncements.mockReturnValue({
        announcements: [],
        loading: true,
        error: null,
        hasLoadedOnce: false,
        getAnnouncements: jest.fn(),
        selectedAnnouncement: null,
        filters: {},
        totalCount: 0,
        getAnnouncementById: jest.fn(),
        createAnnouncement: jest.fn(),
        updateAnnouncement: jest.fn(),
        deleteAnnouncement: jest.fn(),
        pinAnnouncement: jest.fn(),
        unpinAnnouncement: jest.fn(),
        setSelectedAnnouncement: jest.fn(),
        setFilters: jest.fn(),
        clearFilters: jest.fn(),
        refreshAnnouncements: jest.fn(),
        getActiveAnnouncements: jest.fn(() => []),
      } as any);

      renderWithProviders(<AnnouncementNotice />);
      // Loading state should be handled by the component
    });
  });

  describe('Error Handling', () => {
    it('handles announcements error gracefully', () => {
      mockUseAnnouncements.mockReturnValue({
        announcements: [],
        loading: false,
        error: 'Failed to fetch announcements',
        hasLoadedOnce: true,
        getAnnouncements: jest.fn(),
        selectedAnnouncement: null,
        filters: {},
        totalCount: 0,
        getAnnouncementById: jest.fn(),
        createAnnouncement: jest.fn(),
        updateAnnouncement: jest.fn(),
        deleteAnnouncement: jest.fn(),
        pinAnnouncement: jest.fn(),
        unpinAnnouncement: jest.fn(),
        setSelectedAnnouncement: jest.fn(),
        setFilters: jest.fn(),
        clearFilters: jest.fn(),
        refreshAnnouncements: jest.fn(),
        getActiveAnnouncements: jest.fn(() => []),
      } as any);

      renderWithProviders(<AnnouncementNotice />);
      // Component should still render without crashing
      expect(screen.getByTestId('notice-board-card')).toBeTruthy();
    });

    it('handles notices error gracefully', () => {
      mockUseNotices.mockReturnValue({
        notices: [],
        loading: false,
        error: 'Failed to fetch notices',
        hasLoadedOnce: true,
        getNotices: jest.fn(),
        selectedNotice: null,
        filters: {},
        totalCount: 0,
        getNoticeById: jest.fn(),
        createNotice: jest.fn(),
        updateNotice: jest.fn(),
        deleteNotice: jest.fn(),
        setSelectedNotice: jest.fn(),
        setFilters: jest.fn(),
        clearFilters: jest.fn(),
        refreshNotices: jest.fn(),
        getActiveNotices: jest.fn(() => []),
      } as any);

      renderWithProviders(<AnnouncementNotice />);
      // Component should still render without crashing
      expect(screen.getByTestId('notice-board-card')).toBeTruthy();
    });
  });

  describe('Data Fetching', () => {
    it('calls getAnnouncements when component mounts', () => {
      const mockGetAnnouncements = jest.fn();
      mockUseAnnouncements.mockReturnValue({
        announcements: [],
        loading: false,
        error: null,
        hasLoadedOnce: false,
        getAnnouncements: mockGetAnnouncements,
        selectedAnnouncement: null,
        filters: {},
        totalCount: 0,
        getAnnouncementById: jest.fn(),
        createAnnouncement: jest.fn(),
        updateAnnouncement: jest.fn(),
        deleteAnnouncement: jest.fn(),
        pinAnnouncement: jest.fn(),
        unpinAnnouncement: jest.fn(),
        setSelectedAnnouncement: jest.fn(),
        setFilters: jest.fn(),
        clearFilters: jest.fn(),
        refreshAnnouncements: jest.fn(),
        getActiveAnnouncements: jest.fn(() => []),
      } as any);

      renderWithProviders(<AnnouncementNotice />);
      expect(mockGetAnnouncements).toHaveBeenCalled();
    });

    it('calls getNotices when component mounts', () => {
      const mockGetNotices = jest.fn();
      mockUseNotices.mockReturnValue({
        notices: [],
        loading: false,
        error: null,
        hasLoadedOnce: false,
        getNotices: mockGetNotices,
        selectedNotice: null,
        filters: {},
        totalCount: 0,
        getNoticeById: jest.fn(),
        createNotice: jest.fn(),
        updateNotice: jest.fn(),
        deleteNotice: jest.fn(),
        setSelectedNotice: jest.fn(),
        setFilters: jest.fn(),
        clearFilters: jest.fn(),
        refreshNotices: jest.fn(),
        getActiveNotices: jest.fn(() => []),
      } as any);

      renderWithProviders(<AnnouncementNotice />);
      expect(mockGetNotices).toHaveBeenCalledWith({ status: undefined });
    });
  });

  describe('Time Formatting', () => {
    it('formats time ago correctly for recent announcements', () => {
      const recentAnnouncement = {
        ...mockAnnouncements[0],
        created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
      };

      mockUseAnnouncements.mockReturnValue({
        announcements: [recentAnnouncement],
        loading: false,
        error: null,
        hasLoadedOnce: true,
        getAnnouncements: jest.fn(),
        selectedAnnouncement: null,
        filters: {},
        totalCount: 0,
        getAnnouncementById: jest.fn(),
        createAnnouncement: jest.fn(),
        updateAnnouncement: jest.fn(),
        deleteAnnouncement: jest.fn(),
        pinAnnouncement: jest.fn(),
        unpinAnnouncement: jest.fn(),
        setSelectedAnnouncement: jest.fn(),
        setFilters: jest.fn(),
        clearFilters: jest.fn(),
        refreshAnnouncements: jest.fn(),
        getActiveAnnouncements: jest.fn(() => [recentAnnouncement]),
      } as any);

      renderWithProviders(<AnnouncementNotice />);
      expect(screen.getByText('5 minutes ago')).toBeTruthy();
    });
  });

  describe('Bulletin Board Integration', () => {
    it('passes correct props to BulletinBoard component', async () => {
      renderWithProviders(<AnnouncementNotice />);
      
      // Switch to bulletin tab
      const bulletinTab = screen.getByText('Bulletin Board');
      fireEvent.press(bulletinTab);
      
      await waitFor(() => {
        const bulletinBoard = screen.getByTestId('bulletin-board');
        expect(bulletinBoard).toBeTruthy();
        expect(bulletinBoard.props['data-active']).toBe(true);
      });
    });

    it('handles create bulletin navigation', async () => {
      const mockNavigate = jest.fn();
      jest.mocked(require('@react-navigation/native').useNavigation).mockReturnValue({
        navigate: mockNavigate,
        goBack: jest.fn(),
      });

      renderWithProviders(<AnnouncementNotice />);
      
      // Switch to bulletin tab
      const bulletinTab = screen.getByText('Bulletin Board');
      fireEvent.press(bulletinTab);
      
      await waitFor(() => {
        const createBulletinBtn = screen.getByTestId('create-bulletin-btn');
        fireEvent.press(createBulletinBtn);
        expect(mockNavigate).toHaveBeenCalledWith('CreateBulletin');
      });
    });
  });
});
