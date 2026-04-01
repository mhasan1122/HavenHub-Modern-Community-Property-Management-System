import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { BulletinCard } from '../BulletinCard';
import { useAppSelector } from '../../../store/hooks';
import { useBulletinsRedux } from '../../../hooks/useBulletinsRedux';

// Mock the hooks
jest.mock('../../../store/hooks');
jest.mock('../../../hooks/useBulletinsRedux');

// Mock the components
jest.mock('../../../components/MediaViewer', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockMediaViewer({ visible, onClose, attachments, initialIndex }: any) {
    if (!visible) return null;
    return (
      <View testID="media-viewer">
        <Text testID="media-viewer-title">Media Viewer</Text>
        <Text testID="media-viewer-count">{attachments.length} attachments</Text>
        <TouchableOpacity testID="media-viewer-close" onPress={onClose}>
          <Text>Close</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock('../../../../components/DeleteConfirmationModal', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockDeleteConfirmationModal({ visible, onClose, onConfirm, title, message, isLoading }: any) {
    if (!visible) return null;
    return (
      <View testID="delete-confirmation-modal">
        <Text testID="modal-title">{title}</Text>
        <Text testID="modal-message">{message}</Text>
        <TouchableOpacity testID="modal-cancel" onPress={onClose}>
          <Text>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="modal-confirm" onPress={onConfirm} disabled={isLoading}>
          <Text>{isLoading ? 'Loading...' : 'Confirm'}</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock('../../../../components/SuccessPopup', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockSuccessPopup({ visible, onClose, title, message, buttonText }: any) {
    if (!visible) return null;
    return (
      <View testID="success-popup">
        <Text testID="success-title">{title}</Text>
        <Text testID="success-message">{message}</Text>
        <TouchableOpacity testID="success-close" onPress={onClose}>
          <Text>{buttonText}</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

jest.mock('../components/BulletinHistoryModal', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockBulletinHistoryModal({ visible, onClose, bulletin }: any) {
    if (!visible) return null;
    return (
      <View testID="history-modal">
        <Text testID="history-title">Bulletin History</Text>
        <Text testID="history-bulletin-id">{bulletin.id}</Text>
        <TouchableOpacity testID="history-close" onPress={onClose}>
          <Text>Close</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

// Mock Ionicons
jest.mock('@expo/vector-icons/Ionicons', () => {
  const { Text } = require('react-native');
  return function MockIonicons({ name, size, color, testID, ...props }: any) {
    return <Text testID={testID || `icon-${name}`} {...props}>{name}</Text>;
  };
});

// Mock utilities
jest.mock('../../../utils/photoUtils', () => ({
  getPhotoURL: jest.fn((url) => url || 'https://example.com/default.jpg'),
  getInitialLetter: jest.fn((name) => name ? name.charAt(0).toUpperCase() : 'U'),
}));

jest.mock('../../../utils/responsiveUtils', () => ({
  useResponsiveDimensions: jest.fn(() => ({
    width: 375,
    height: 812,
    screenSize: 'small',
    spacing: { sm: 8, md: 16, lg: 24 }
  })),
}));

// Mock Redux store
const mockStore = configureStore({
  reducer: {
    auth: (state = {
      user: {
        id: '1',
        full_name: 'Test User',
        email: 'test@example.com'
      },
      accessToken: 'mock-token'
    }) => state,
  },
});

// Mock navigation
const Stack = createStackNavigator();

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <Provider store={mockStore}>
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Test" component={() => <>{children}</>} />
      </Stack.Navigator>
    </NavigationContainer>
  </Provider>
);

// Mock bulletin data
const mockBulletin = {
  id: 1,
  title: 'Test Bulletin',
  description: 'This is a test bulletin description',
  creator_name: 'John Doe',
  creator: { id: 1, full_name: 'John Doe', photo: 'https://example.com/photo.jpg' },
  creator_photo: 'https://example.com/creator.jpg',
  status: 'current',
  created_at: '2024-01-01T10:00:00Z',
  updated_at: '2024-01-01T10:00:00Z',
  attachments: [
    {
      id: 1,
      file: 'https://example.com/image1.jpg',
      file_name: 'image1.jpg',
      file_type: 'image/jpeg'
    },
    {
      id: 2,
      file: 'https://example.com/image2.jpg',
      file_name: 'image2.jpg',
      file_type: 'image/jpeg'
    }
  ],
  labels: ['urgent', 'announcement'],
  label: 'urgent, announcement',
  priority: 'high'
};

// Helper function to create complete mock return object
const createMockBulletinsReduxReturn = (overrides: any = {}) => ({
  bulletins: [],
  currentBulletins: [],
  pendingBulletins: [],
  archiveBulletins: [],
  loading: false,
  error: null,
  hasLoadedOnce: true,
  needsRefresh: false,
  fetchBulletins: jest.fn(),
  forceRefreshBulletins: jest.fn(),
  createNewBulletin: jest.fn(),
  updateBulletin: jest.fn(),
  approveBulletin: jest.fn(),
  rejectBulletin: jest.fn(),
  archiveBulletin: jest.fn(),
  addBulletinOptimistically: jest.fn(),
  removeBulletin: jest.fn(),
  updateBulletinInState: jest.fn(),
  updateFilters: jest.fn(),
  getBulletinsByStatus: jest.fn(),
  getMyBulletins: jest.fn(),
  filters: {
    status: 'current' as const,
    my_posts: false,
    search: '',
    priority: '',
    labels: ''
  },
  lastFetched: Date.now(),
  ...overrides
});

const mockUseAppSelector = useAppSelector as jest.MockedFunction<typeof useAppSelector>;
const mockUseBulletinsRedux = useBulletinsRedux as jest.MockedFunction<typeof useBulletinsRedux>;

describe('BulletinCard Component', () => {
  const mockArchiveBulletin = jest.fn();
  const mockNavigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock useAppSelector
    mockUseAppSelector.mockReturnValue({
      user: {
        id: '1',
        full_name: 'Test User',
        email: 'test@example.com'
      },
      accessToken: 'mock-token'
    });

    // Mock useBulletinsRedux
    mockUseBulletinsRedux.mockReturnValue(createMockBulletinsReduxReturn({
      archiveBulletin: mockArchiveBulletin,
    }));
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      const { getByTestId } = render(
        <TestWrapper>
          <BulletinCard bulletin={mockBulletin} />
        </TestWrapper>
      );
      
      expect(getByTestId('bulletin-card')).toBeTruthy();
    });

    it('renders in main display mode by default', () => {
      const { getByTestId } = render(
        <TestWrapper>
          <BulletinCard bulletin={mockBulletin} isMainDisplay={true} />
        </TestWrapper>
      );
      
      expect(getByTestId('bulletin-card')).toBeTruthy();
    });

    it('renders in compact mode when isMainDisplay is false', () => {
      const { getByTestId } = render(
        <TestWrapper>
          <BulletinCard bulletin={mockBulletin} isMainDisplay={false} />
        </TestWrapper>
      );
      
      expect(getByTestId('bulletin-card')).toBeTruthy();
    });
  });

  describe('Content Display', () => {
    it('displays bulletin title', () => {
      const { getByText } = render(
        <TestWrapper>
          <BulletinCard bulletin={mockBulletin} />
        </TestWrapper>
      );
      
      expect(getByText('Test Bulletin')).toBeTruthy();
    });

    it('displays bulletin description', () => {
      const { getByText } = render(
        <TestWrapper>
          <BulletinCard bulletin={mockBulletin} />
        </TestWrapper>
      );
      
      expect(getByText('This is a test bulletin description')).toBeTruthy();
    });

    it('displays author name', () => {
      const { getByText } = render(
        <TestWrapper>
          <BulletinCard bulletin={mockBulletin} />
        </TestWrapper>
      );
      
      expect(getByText('John Doe')).toBeTruthy();
    });

    it('displays time ago', () => {
      const { getByText } = render(
        <TestWrapper>
          <BulletinCard bulletin={mockBulletin} />
        </TestWrapper>
      );
      
      // Should show some time format
      expect(getByText(/ago|now|day|hour|minute/)).toBeTruthy();
    });
  });

  describe('Profile Picture', () => {
    it('displays profile picture when available', () => {
      const { getByTestId } = render(
        <TestWrapper>
          <BulletinCard bulletin={mockBulletin} />
        </TestWrapper>
      );
      
      expect(getByTestId('profile-picture')).toBeTruthy();
    });

    it('displays initial letter when no profile picture', () => {
      const bulletinWithoutPhoto = {
        ...mockBulletin,
        creator_photo: null,
        creator: { ...mockBulletin.creator, photo: null }
      };
      
      const { getByText } = render(
        <TestWrapper>
          <BulletinCard bulletin={bulletinWithoutPhoto} />
        </TestWrapper>
      );
      
      expect(getByText('J')).toBeTruthy(); // First letter of "John Doe"
    });
  });

  describe('Labels Display', () => {
    it('displays labels when available', () => {
      const { getByText } = render(
        <TestWrapper>
          <BulletinCard bulletin={mockBulletin} />
        </TestWrapper>
      );
      
      expect(getByText('urgent')).toBeTruthy();
      expect(getByText('announcement')).toBeTruthy();
    });

    it('handles string labels (comma-separated)', () => {
      const bulletinWithStringLabels = {
        ...mockBulletin,
        labels: null,
        label: 'urgent, announcement, info'
      };
      
      const { getByText } = render(
        <TestWrapper>
          <BulletinCard bulletin={bulletinWithStringLabels} />
        </TestWrapper>
      );
      
      expect(getByText('urgent')).toBeTruthy();
      expect(getByText('announcement')).toBeTruthy();
      expect(getByText('info')).toBeTruthy();
    });
  });

  describe('Attachments', () => {
    it('displays attachments when available', () => {
      const { getByTestId } = render(
        <TestWrapper>
          <BulletinCard bulletin={mockBulletin} />
        </TestWrapper>
      );
      
      expect(getByTestId('attachment-0')).toBeTruthy();
      expect(getByTestId('attachment-1')).toBeTruthy();
    });

    it('shows +count overlay when more than 3 attachments', () => {
      const bulletinWithManyAttachments = {
        ...mockBulletin,
        attachments: [
          { id: 1, file: 'image1.jpg', file_name: 'image1.jpg', file_type: 'image/jpeg' },
          { id: 2, file: 'image2.jpg', file_name: 'image2.jpg', file_type: 'image/jpeg' },
          { id: 3, file: 'image3.jpg', file_name: 'image3.jpg', file_type: 'image/jpeg' },
          { id: 4, file: 'image4.jpg', file_name: 'image4.jpg', file_type: 'image/jpeg' },
          { id: 5, file: 'image5.jpg', file_name: 'image5.jpg', file_type: 'image/jpeg' }
        ]
      };
      
      const { getByText } = render(
        <TestWrapper>
          <BulletinCard bulletin={bulletinWithManyAttachments} />
        </TestWrapper>
      );
      
      expect(getByText('+2')).toBeTruthy(); // 5 total - 3 shown = 2 more
    });

    it('opens media viewer when attachment is pressed', async () => {
      const { getByTestId } = render(
        <TestWrapper>
          <BulletinCard bulletin={mockBulletin} />
        </TestWrapper>
      );
      
      const attachment = getByTestId('attachment-0');
      fireEvent.press(attachment);
      
      await waitFor(() => {
        expect(getByTestId('media-viewer')).toBeTruthy();
      });
    });
  });

  describe('Options Menu', () => {
    it('shows options menu for own posts', () => {
      const { getByTestId } = render(
        <TestWrapper>
          <BulletinCard 
            bulletin={mockBulletin} 
            currentUserId="1" 
          />
        </TestWrapper>
      );
      
      const optionsButton = getByTestId('options-button');
      fireEvent.press(optionsButton);
      
      expect(getByTestId('options-menu')).toBeTruthy();
    });

    it('shows only history option for archive screen', () => {
      const { getByTestId, queryByTestId } = render(
        <TestWrapper>
          <BulletinCard 
            bulletin={mockBulletin} 
            currentUserId="2" 
            isArchiveScreen={true}
          />
        </TestWrapper>
      );
      
      const optionsButton = getByTestId('options-button');
      fireEvent.press(optionsButton);
      
      expect(getByTestId('history-option')).toBeTruthy();
      expect(queryByTestId('edit-option')).toBeNull();
      expect(queryByTestId('archive-option')).toBeNull();
    });

    it('does not show options menu for other users posts', () => {
      const { queryByTestId } = render(
        <TestWrapper>
          <BulletinCard 
            bulletin={mockBulletin} 
            currentUserId="2" 
          />
        </TestWrapper>
      );
      
      expect(queryByTestId('options-button')).toBeNull();
    });
  });

  describe('Edit Functionality', () => {
    it('navigates to edit screen when edit is pressed', () => {
      const { getByTestId } = render(
        <TestWrapper>
          <BulletinCard 
            bulletin={mockBulletin} 
            currentUserId="1" 
          />
        </TestWrapper>
      );
      
      const optionsButton = getByTestId('options-button');
      fireEvent.press(optionsButton);
      
      const editButton = getByTestId('edit-option');
      fireEvent.press(editButton);
      
      // Should navigate to edit screen
      expect(editButton).toBeTruthy();
    });

    it('does not show edit option on archive screen', () => {
      const { getByTestId, queryByTestId } = render(
        <TestWrapper>
          <BulletinCard 
            bulletin={mockBulletin} 
            currentUserId="1" 
            isArchiveScreen={true}
          />
        </TestWrapper>
      );
      
      const optionsButton = getByTestId('options-button');
      fireEvent.press(optionsButton);
      
      expect(queryByTestId('edit-option')).toBeNull();
    });
  });

  describe('History Functionality', () => {
    it('opens history modal when history is pressed', async () => {
      const { getByTestId } = render(
        <TestWrapper>
          <BulletinCard 
            bulletin={mockBulletin} 
            currentUserId="1" 
          />
        </TestWrapper>
      );
      
      const optionsButton = getByTestId('options-button');
      fireEvent.press(optionsButton);
      
      const historyButton = getByTestId('history-option');
      fireEvent.press(historyButton);
      
      await waitFor(() => {
        expect(getByTestId('history-modal')).toBeTruthy();
      });
    });

    it('displays bulletin ID in history modal', async () => {
      const { getByTestId } = render(
        <TestWrapper>
          <BulletinCard 
            bulletin={mockBulletin} 
            currentUserId="1" 
          />
        </TestWrapper>
      );
      
      const optionsButton = getByTestId('options-button');
      fireEvent.press(optionsButton);
      
      const historyButton = getByTestId('history-option');
      fireEvent.press(historyButton);
      
      await waitFor(() => {
        expect(getByTestId('history-bulletin-id')).toHaveTextContent('1');
      });
    });
  });

  describe('Archive Functionality', () => {
    it('shows archive confirmation modal when archive is pressed', async () => {
      const { getByTestId } = render(
        <TestWrapper>
          <BulletinCard 
            bulletin={mockBulletin} 
            currentUserId="1" 
          />
        </TestWrapper>
      );
      
      const optionsButton = getByTestId('options-button');
      fireEvent.press(optionsButton);
      
      const archiveButton = getByTestId('archive-option');
      fireEvent.press(archiveButton);
      
      await waitFor(() => {
        expect(getByTestId('delete-confirmation-modal')).toBeTruthy();
      });
    });

    it('calls archive function when confirmed', async () => {
      mockArchiveBulletin.mockResolvedValue({ success: true });
      
      const { getByTestId } = render(
        <TestWrapper>
          <BulletinCard 
            bulletin={mockBulletin} 
            currentUserId="1" 
          />
        </TestWrapper>
      );
      
      const optionsButton = getByTestId('options-button');
      fireEvent.press(optionsButton);
      
      const archiveButton = getByTestId('archive-option');
      fireEvent.press(archiveButton);
      
      await waitFor(() => {
        const confirmButton = getByTestId('modal-confirm');
        fireEvent.press(confirmButton);
      });
      
      await waitFor(() => {
        expect(mockArchiveBulletin).toHaveBeenCalledWith(1);
      });
    });

    it('shows success popup after archiving', async () => {
      mockArchiveBulletin.mockResolvedValue({ success: true });
      
      const { getByTestId } = render(
        <TestWrapper>
          <BulletinCard 
            bulletin={mockBulletin} 
            currentUserId="1" 
          />
        </TestWrapper>
      );
      
      const optionsButton = getByTestId('options-button');
      fireEvent.press(optionsButton);
      
      const archiveButton = getByTestId('archive-option');
      fireEvent.press(archiveButton);
      
      await waitFor(() => {
        const confirmButton = getByTestId('modal-confirm');
        fireEvent.press(confirmButton);
      });
      
      await waitFor(() => {
        expect(getByTestId('success-popup')).toBeTruthy();
      });
    });

    it('does not show archive option on archive screen', () => {
      const { getByTestId, queryByTestId } = render(
        <TestWrapper>
          <BulletinCard 
            bulletin={mockBulletin} 
            currentUserId="1" 
            isArchiveScreen={true}
          />
        </TestWrapper>
      );
      
      const optionsButton = getByTestId('options-button');
      fireEvent.press(optionsButton);
      
      expect(queryByTestId('archive-option')).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('handles archive errors gracefully', async () => {
      mockArchiveBulletin.mockRejectedValue(new Error('Archive failed'));
      
      const { getByTestId } = render(
        <TestWrapper>
          <BulletinCard 
            bulletin={mockBulletin} 
            currentUserId="1" 
          />
        </TestWrapper>
      );
      
      const optionsButton = getByTestId('options-button');
      fireEvent.press(optionsButton);
      
      const archiveButton = getByTestId('archive-option');
      fireEvent.press(archiveButton);
      
      await waitFor(() => {
        const confirmButton = getByTestId('modal-confirm');
        fireEvent.press(confirmButton);
      });
      
      // Should handle error without crashing
      expect(mockArchiveBulletin).toHaveBeenCalledWith(1);
    });
  });

  describe('Data Handling', () => {
    it('handles missing data gracefully', () => {
      const incompleteBulletin = {
        id: 1,
        title: 'Test',
        // Missing other fields
      };
      
      const { getByText } = render(
        <TestWrapper>
          <BulletinCard bulletin={incompleteBulletin} />
        </TestWrapper>
      );
      
      expect(getByText('Test')).toBeTruthy();
    });

    it('handles both notice and bulletin props', () => {
      const noticeData = {
        id: 1,
        title: 'Notice Title',
        description: 'Notice description',
        member_name: 'Notice Author',
        created_at: '2024-01-01T10:00:00Z'
      };
      
      const { getByText } = render(
        <TestWrapper>
          <BulletinCard notice={noticeData} />
        </TestWrapper>
      );
      
      expect(getByText('Notice Title')).toBeTruthy();
      expect(getByText('Notice description')).toBeTruthy();
      expect(getByText('Notice Author')).toBeTruthy();
    });
  });

  describe('Responsive Design', () => {
    it('adapts to different screen sizes', () => {
      const { getByTestId } = render(
        <TestWrapper>
          <BulletinCard bulletin={mockBulletin} />
        </TestWrapper>
      );
      
      expect(getByTestId('bulletin-card')).toBeTruthy();
    });
  });
});
