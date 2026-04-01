import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AnnouncementActionMenu from '../AnnouncementActionMenu';

const baseAnnouncement = {
  id: 1,
  status: 'upcoming',
  pinned: false,
  manuallyExpired: false,
};

const noop = () => {};

const defaultHandlers = {
  onEdit: jest.fn(),
  onHistory: jest.fn(),
  onMoveToExpired: jest.fn(),
  onReminder: jest.fn(),
  onPinPost: jest.fn(),
  onDirectCommunication: jest.fn(),
  onDelete: jest.fn(),
  onRestore: jest.fn(),
  onClose: jest.fn(),
};

describe('AnnouncementActionMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders only history action when edit permissions are absent', () => {
    render(
      <AnnouncementActionMenu
        announcement={baseAnnouncement}
        {...defaultHandlers}
        canEdit={false}
      />
    );

    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Move Expired')).not.toBeInTheDocument();
  });

  it('renders all actions when edit permissions are granted', () => {
    render(
      <AnnouncementActionMenu
        announcement={baseAnnouncement}
        {...defaultHandlers}
        canEdit
      />
    );

    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Move Expired')).toBeInTheDocument();
  });

  it('triggers the corresponding handler and closes when an action is clicked', () => {
    const handlers = {
      ...defaultHandlers,
      onHistory: jest.fn(),
      onClose: jest.fn(),
    };

    render(
      <AnnouncementActionMenu
        announcement={baseAnnouncement}
        {...handlers}
        canEdit={false}
      />
    );

    fireEvent.click(screen.getByText('History'));

    expect(handlers.onHistory).toHaveBeenCalledWith(baseAnnouncement.id);
    expect(handlers.onClose).toHaveBeenCalled();
  });
});
