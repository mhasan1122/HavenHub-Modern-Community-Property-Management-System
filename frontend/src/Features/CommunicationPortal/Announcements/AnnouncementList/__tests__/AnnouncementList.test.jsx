import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AnnouncementList from '../AnnouncementList';
import { PERMISSIONS } from '../../../../../constants/permissions';
import { useAnnouncements } from '../../../../../hooks/useAnnouncements';
import { checkPermission } from '../../../../../utils/permissionUtils';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: null }),
  };
});

jest.mock('../../../../../hooks/useAnnouncements', () => ({
  useAnnouncements: jest.fn(),
}));
jest.mock('../../../../../utils/permissionUtils', () => ({
  checkPermission: jest.fn(),
}));
jest.mock('../../components/Calendar', () => () => <div data-testid="calendar" />);
jest.mock('../../components/AnnouncementHistoryModal', () => () => <div data-testid="history-modal" />);
jest.mock('../../components/PinPost', () => ({
  __esModule: true,
  default: () => ({
    handlePinPost: jest.fn(),
    handlePinIconClick: jest.fn(),
    sortAnnouncementsWithPinned: (list) => list,
  }),
  PinIcon: () => null,
}));
jest.mock('../../hooks/useUserCount', () => ({
  clearUserCountCache: jest.fn(),
}));
jest.mock('../AnnouncementListPreview', () => (props) => (
  <div data-testid="announcement-preview">{props.canEdit ? 'editable' : 'readonly'}</div>
));

const createAnnouncementsMockReturn = () => {
  const loadAnnouncements = jest.fn();
  return {
    state: {
      announcements: [],
      loading: false,
      deleteSuccess: false,
      message: null,
    },
    handlers: {
      loadAnnouncements,
      updateAllStatuses: jest.fn(),
      removeAnnouncement: jest.fn(),
      moveAnnouncementToExpired: jest.fn(),
      restoreExpiredAnnouncement: jest.fn(),
      loadAnnouncement: jest.fn(),
      clearAllSuccess: jest.fn(),
    },
  };
};

let announcementsMock;

beforeEach(() => {
  jest.clearAllMocks();
  announcementsMock = createAnnouncementsMockReturn();
  useAnnouncements.mockReturnValue({
    announcements: announcementsMock.state.announcements,
    loading: announcementsMock.state.loading,
    deleteSuccess: announcementsMock.state.deleteSuccess,
    message: announcementsMock.state.message,
    loadAnnouncements: announcementsMock.handlers.loadAnnouncements,
    updateAllStatuses: announcementsMock.handlers.updateAllStatuses,
    removeAnnouncement: announcementsMock.handlers.removeAnnouncement,
    moveAnnouncementToExpired: announcementsMock.handlers.moveAnnouncementToExpired,
    restoreExpiredAnnouncement: announcementsMock.handlers.restoreExpiredAnnouncement,
    loadAnnouncement: announcementsMock.handlers.loadAnnouncement,
    clearAllSuccess: announcementsMock.handlers.clearAllSuccess,
  });
  localStorage.setItem('access_token', 'test-token');
});

afterEach(() => {
  localStorage.clear();
});

describe('AnnouncementList permission handling', () => {
  const renderComponent = () =>
    render(
      <MemoryRouter>
        <AnnouncementList />
      </MemoryRouter>
    );

  it('shows the create button when add permission is granted', async () => {
    checkPermission
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    renderComponent();

    await waitFor(() => expect(checkPermission).toHaveBeenCalledTimes(3));

    expect(checkPermission).toHaveBeenNthCalledWith(1, 'org', PERMISSIONS.VIEW_ANNOUNCEMENTS);
    expect(checkPermission).toHaveBeenNthCalledWith(2, 'org', PERMISSIONS.ADD_ANNOUNCEMENTS);
    expect(checkPermission).toHaveBeenNthCalledWith(3, 'org', PERMISSIONS.EDIT_ANNOUNCEMENTS);

    await waitFor(() => {
      expect(screen.getByText('Create Announcements')).toBeInTheDocument();
    });

    await waitFor(() => expect(announcementsMock.handlers.loadAnnouncements).toHaveBeenCalled());
  });

  it('hides the create button when add permission is denied but view is allowed', async () => {
    checkPermission
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);

    renderComponent();

    await waitFor(() => expect(checkPermission).toHaveBeenCalledTimes(3));

    await waitFor(() => {
      expect(screen.queryByText('Create Announcements')).not.toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalledWith('/not-authorized');
  });
});
