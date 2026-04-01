import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PinIcon } from '../PinPost';

jest.mock('../../../../../redux/slices/api/announcementApi', () => ({
  togglePinAnnouncement: jest.fn(),
  moveToExpired: jest.fn(),
  pinAnnouncement: jest.fn(),
  unpinAnnouncement: jest.fn(),
}));

describe('PinIcon', () => {
  const pinnedAnnouncement = {
    id: 42,
    pinned: true,
    isPinned: true,
  };

  it('returns null for non-pinned announcements', () => {
    const { container } = render(
      <PinIcon
        announcement={{ id: 1, pinned: false }}
        onPinIconClick={() => {}}
        currentTab={1}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('triggers callback when editable', () => {
    const handleClick = jest.fn();
    render(
      <PinIcon
        announcement={pinnedAnnouncement}
        onPinIconClick={handleClick}
        currentTab={1}
        canEdit
      />
    );

    fireEvent.click(screen.getByTitle(/Click to move/i));
    expect(handleClick).toHaveBeenCalledWith(pinnedAnnouncement.id, expect.any(Object));
  });

  it('is not clickable when edit permission is missing', () => {
    const handleClick = jest.fn();
    render(
      <PinIcon
        announcement={pinnedAnnouncement}
        onPinIconClick={handleClick}
        currentTab={1}
        canEdit={false}
      />
    );

    const titleNode = screen.getByTitle(/do not have permission/i);
    const svgIcon = titleNode.closest('svg');
    expect(svgIcon).not.toBeNull();

    fireEvent.click(svgIcon);

    expect(handleClick).not.toHaveBeenCalled();
    expect(svgIcon?.getAttribute('class') || '').toContain('cursor-not-allowed');
  });

  it('does not render when viewing expired tab even if pinned', () => {
    const { container } = render(
      <PinIcon
        announcement={pinnedAnnouncement}
        onPinIconClick={() => {}}
        currentTab={3}
        canEdit
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
