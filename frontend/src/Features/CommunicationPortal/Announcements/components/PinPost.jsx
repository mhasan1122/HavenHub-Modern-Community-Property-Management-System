import React from 'react';
import { FaThumbtack } from 'react-icons/fa';
import { useDispatch } from 'react-redux';
import { togglePinAnnouncement } from '../../../../redux/slices/api/announcementApi';

/**
 * usePinPost Hook
 * Handles pin/unpin functionality for announcements
 * Provides pin-related utilities and functions
 */
const usePinPost = ({
    announcements,
    setAnnouncements,
    onPinSuccess,
    onPinError,
    onMoveToExpired,
    currentTab
}) => {
    const dispatch = useDispatch();

    /**
     * Handle pin/unpin post functionality
     * @param {string} announcementId - The ID of the announcement to pin/unpin
     */
    const handlePinPost = async (announcementId) => {
        try {
            // Find the current announcement to check its pin status
            const currentAnnouncement = announcements.find(ann => ann.id === announcementId);
            const isPinned = currentAnnouncement?.isPinned || currentAnnouncement?.pinned || false;

            // Call Redux action to toggle pin status using the new toggle endpoint
            const result = await dispatch(togglePinAnnouncement(announcementId));

            // Check if the action was successful
            if (togglePinAnnouncement.fulfilled.match(result)) {
                // Show feedback message based on the result
                const newPinStatus = result.payload.is_pinned;
                if (newPinStatus) {
                    console.log('📌 Announcement pinned! It will appear first among pinned posts.');
                    if (onPinSuccess) {
                        onPinSuccess('Announcement pinned successfully! It will appear first among pinned posts.');
                    }
                } else {
                    console.log('📌 Announcement unpinned! It will return to normal position.');
                    if (onPinSuccess) {
                        onPinSuccess('Announcement unpinned successfully! It will return to normal position.');
                    }
                }
            } else {
                throw new Error(result.payload || 'Failed to toggle pin status');
            }
        } catch (error) {
            console.error('Error pinning/unpinning announcement:', error);
            if (onPinError) {
                onPinError('Failed to pin/unpin announcement. Please try again.');
            }
        }
    };

    /**
     * Sort announcements with pinned posts first (most recently pinned first)
     * @param {Array} announcementList - List of announcements to sort
     * @returns {Array} - Sorted announcements array
     */
    const sortAnnouncementsWithPinned = (announcementList) => {
        return announcementList.sort((a, b) => {
            // Pinned announcements come first
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;

            // If both are pinned, sort by most recent pin time first
            // If pinnedAt is not available, fall back to creation date
            if (a.pinned && b.pinned) {
                const aPinnedTime = new Date(a.pinnedAt || a.createdAt || a.startDate);
                const bPinnedTime = new Date(b.pinnedAt || b.createdAt || b.startDate);
                return bPinnedTime - aPinnedTime; // Most recently pinned first
            }

            // If both are not pinned, sort by most recent creation date first
            if (!a.pinned && !b.pinned) {
                const aDateTime = new Date(a.createdAt || `${a.startDate} ${a.startTime}`);
                const bDateTime = new Date(b.createdAt || `${b.startDate} ${b.startTime}`);
                return bDateTime - aDateTime; // Most recent first
            }

            return 0;
        });
    };

    /**
     * Get pinned announcements count
     * @returns {number} - Number of pinned announcements
     */
    const getPinnedCount = () => {
        return announcements.filter(announcement => announcement.pinned).length;
    };

    /**
     * Get the most recently pinned announcement
     * @returns {Object|null} - Most recently pinned announcement or null
     */
    const getMostRecentlyPinned = () => {
        const pinnedAnnouncements = announcements.filter(announcement => announcement.pinned);
        if (pinnedAnnouncements.length === 0) return null;

        return pinnedAnnouncements.reduce((mostRecent, current) => {
            const currentPinnedTime = new Date(current.pinnedAt || current.createdAt || current.startDate);
            const mostRecentPinnedTime = new Date(mostRecent.pinnedAt || mostRecent.createdAt || mostRecent.startDate);
            return currentPinnedTime > mostRecentPinnedTime ? current : mostRecent;
        });
    };

    /**
     * Get all pinned announcements sorted by pin time (most recent first)
     * @returns {Array} - Sorted pinned announcements
     */
    const getPinnedAnnouncementsSorted = () => {
        const pinnedAnnouncements = announcements.filter(announcement => announcement.pinned);
        return pinnedAnnouncements.sort((a, b) => {
            const aPinnedTime = new Date(a.pinnedAt || a.createdAt || a.startDate);
            const bPinnedTime = new Date(b.pinnedAt || b.createdAt || b.startDate);
            return bPinnedTime - aPinnedTime; // Most recently pinned first
        });
    };

    /**
     * Check if announcement is pinned
     * @param {string} announcementId - The ID of the announcement
     * @returns {boolean} - True if announcement is pinned
     */
    const isAnnouncementPinned = (announcementId) => {
        const announcement = announcements.find(ann => ann.id === announcementId);
        return announcement ? announcement.pinned : false;
    };

    /**
     * Handle pin icon click - disabled (no longer moves to expired)
     * @param {string} announcementId - The ID of the announcement
     * @param {Event} event - Click event
     */
    const handlePinIconClick = async (announcementId, event) => {
        // Click functionality disabled - pin icon is now display-only
        event.stopPropagation(); // Prevent event bubbling
        return;
    };

    /**
     * Render pin icon for announcement card
     * @param {Object} announcement - The announcement object
     * @returns {JSX.Element|null} - Pin icon component or null
     */
    const renderPinIcon = (announcement) => {
        if (!announcement.pinned) return null;

        // Don't show pin icons in expired tab (tab 3)
        if (currentTab === 3) return null;

        return (
            <FaThumbtack
                className="w-[16px] h-[16px] text-primary transform rotate-45"
                title="Pinned announcement"
            />
        );
    };

    /**
     * Get pin button text based on current state
     * @param {Object} announcement - The announcement object
     * @returns {string} - Button text
     */
    const getPinButtonText = (announcement) => {
        return announcement.pinned ? 'Unpin Post' : 'Pin Post';
    };

    /**
     * Get pin button icon class based on current state
     * @param {Object} announcement - The announcement object
     * @returns {string} - Icon class
     */
    const getPinButtonIconClass = (announcement) => {
        return announcement.pinned 
            ? 'text-primary hover:text-[#2A7A78]' 
            : 'text-black-600 hover:text-black-800';
    };

    // Return the functions and utilities that can be used by parent components
    return {
        handlePinPost,
        handlePinIconClick,
        sortAnnouncementsWithPinned,
        getPinnedCount,
        getMostRecentlyPinned,
        getPinnedAnnouncementsSorted,
        isAnnouncementPinned,
        renderPinIcon,
        getPinButtonText,
        getPinButtonIconClass
    };
};

/**
 * PinIcon Component
 * Renders the pin icon for pinned announcements (display-only, no click functionality)
 */
export const PinIcon = ({ announcement, onPinIconClick, currentTab, canEdit = true }) => {
    // Check both pinned and isPinned properties for compatibility
    const isPinned = announcement.pinned || announcement.isPinned;
    if (!isPinned) return null;

    // Don't show pin icons in expired tab (tab 3)
    if (currentTab === 3) return null;

    // Pin icon is now display-only, no click functionality
    const iconClass = "w-[16px] h-[16px] text-primary transform rotate-45";

    return (
        <FaThumbtack
            className={iconClass}
            title="Pinned announcement"
        />
    );
};

export default usePinPost;
