import React from 'react';
import { FaThumbtack } from 'react-icons/fa';
import { useDispatch } from 'react-redux';
import { pinBulletin, unpinBulletin, togglePinBulletin, moveToArchive, restoreBulletin } from '../../../../redux/slices/api/bulletinApi';

/**
 * usePinPost Hook
 * Handles pin/unpin functionality for bulletins
 * Provides pin-related utilities and functions
 */
const usePinPost = ({
    bulletins,
    setBulletins,
    onPinSuccess,
    onPinError,
    onMoveToArchive,
    currentTab
}) => {
    const dispatch = useDispatch();

    /**
     * Handle pin/unpin toggle for a bulletin
     */
    const handlePinToggle = async (bulletinId) => {
        try {
            const bulletin = bulletins.find(b => b.id === bulletinId);
            if (!bulletin) return;

            // Check pin limit before making API call
            if (!bulletin.is_pinned) {
                const currentPinnedCount = bulletins.filter(b =>
                    b.is_pinned && b.status === 'current'
                ).length;

                if (currentPinnedCount >= 3) {
                    // Show error message for pin limit
                    if (onPinError) {
                        onPinError('Maximum 3 bulletins can be pinned at a time. Please unpin another bulletin first.');
                    }
                    return;
                }
            }

            const result = await dispatch(togglePinBulletin(bulletinId)).unwrap();

            // Redux automatically updates the state via extraReducers
            // No need for manual state update

            if (onPinSuccess) {
                onPinSuccess(result.message);
            }
        } catch (error) {
            console.error('Error toggling pin:', error);

            // Extract error message from various possible structures
            let errorMessage = 'Failed to toggle pin';

            if (error.error) {
                errorMessage = error.error;
            } else if (error.message) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }

            if (onPinError) {
                onPinError(errorMessage);
            }
        }
    };

    /**
     * Handle moving bulletin to archive
     */
    const handleMoveToArchive = async (bulletinId) => {
        try {
            await dispatch(moveToArchive(bulletinId)).unwrap();
            
            // Remove from current list if not on archive tab
            if (currentTab !== 3) {
                setBulletins(prevBulletins => 
                    prevBulletins.filter(b => b.id !== bulletinId)
                );
            }

            if (onPinSuccess) {
                onPinSuccess('Bulletin moved to archive successfully');
            }
        } catch (error) {
            console.error('Error moving to archive:', error);
            if (onPinError) {
                onPinError(error.message || 'Failed to move bulletin to archive');
            }
        }
    };

    /**
     * Handle restoring bulletin from archive
     */
    const handleRestore = async (bulletinId) => {
        try {
            const result = await dispatch(restoreBulletin(bulletinId)).unwrap();

            // Redux automatically updates the state via extraReducers
            // No need for manual state update

            if (onPinSuccess) {
                onPinSuccess(result.message);
            }
        } catch (error) {
            console.error('Error restoring bulletin:', error);
            if (onPinError) {
                onPinError(error.message || 'Failed to restore bulletin');
            }
        }
    };

    /**
     * Get pin status for a bulletin
     */
    const isPinned = (bulletinId) => {
        const bulletin = bulletins.find(b => b.id === bulletinId);
        return bulletin?.is_pinned || false;
    };

    /**
     * Get pinned bulletins count
     */
    const getPinnedCount = () => {
        return bulletins.filter(b => b.is_pinned).length;
    };

    /**
     * Sort bulletins by pin status (pinned first)
     */
    const sortByPinStatus = (bulletinsToSort) => {
        return [...bulletinsToSort].sort((a, b) => {
            if (a.is_pinned && !b.is_pinned) return -1;
            if (!a.is_pinned && b.is_pinned) return 1;
            return new Date(b.created_at) - new Date(a.created_at);
        });
    };

    /**
     * Handle pin icon click - moves pinned bulletin to archive (forcefully)
     * @param {string} bulletinId - The ID of the bulletin
     * @param {Event} event - Click event
     */
    const handlePinIconClick = async (bulletinId, event) => {
        event.stopPropagation(); // Prevent event bubbling

        try {
            // Forcefully move the pinned bulletin to archive
            // This will set manually_archived = true, allowing it to show in archive tab with pin
            if (onMoveToArchive) {
                onMoveToArchive(bulletinId);
            }
        } catch (error) {
            console.error('Error moving pinned bulletin to archive:', error);
        }
    };

    /**
     * Handle pin post toggle
     * @param {string} bulletinId - The ID of the bulletin to pin/unpin
     */
    const handlePinPost = async (bulletinId) => {
        try {
            await handlePinToggle(bulletinId);
        } catch (error) {
            console.error('Error toggling pin:', error);
        }
    };

    /**
     * Sort bulletins with pinned ones first
     * @param {Array} bulletinsToSort - Array of bulletins to sort
     * @returns {Array} Sorted bulletins with pinned ones first
     */
    const sortAnnouncementsWithPinned = (bulletinsToSort) => {
        return [...bulletinsToSort].sort((a, b) => {
            const aIsPinned = a.pinned || a.isPinned || a.is_pinned;
            const bIsPinned = b.pinned || b.isPinned || b.is_pinned;

            if (aIsPinned && !bIsPinned) return -1;
            if (!aIsPinned && bIsPinned) return 1;

            // If both are pinned or both are not pinned, sort by creation date
            return new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt);
        });
    };

    return {
        handlePinToggle,
        handlePinPost,
        handlePinIconClick,
        handleMoveToArchive,
        handleRestore,
        isPinned,
        getPinnedCount,
        sortByPinStatus,
        sortAnnouncementsWithPinned
    };
};

/**
 * PinIcon Component
 * Renders the pin icon for pinned bulletins (display only, non-clickable)
 */
export const PinIcon = ({ announcement, currentTab }) => {
    // Check both pinned and is_pinned properties for compatibility
    const isPinned = announcement.pinned || announcement.isPinned || announcement.is_pinned;
    if (!isPinned) return null;

    // Don't show pin icons in archive tab (tab 3)
    if (currentTab === 3) return null;

    return (
        <FaThumbtack
            className="w-[16px] h-[16px] text-primary transform rotate-45 pointer-events-none"
            title="Pinned bulletin"
            data-pin-icon="true"
        />
    );
};

export default usePinPost;
