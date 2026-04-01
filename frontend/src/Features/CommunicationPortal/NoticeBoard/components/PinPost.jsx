import { useDispatch } from 'react-redux';
import { FaThumbtack } from 'react-icons/fa';
import { togglePinNotice } from '../../../../redux/slices/api/noticeApi';

/**
 * Custom hook for pin/unpin functionality
 */
const usePinPost = () => {
  const dispatch = useDispatch();

  const pinPost = async (noticeId) => {
    try {
      await dispatch(togglePinNotice(noticeId)).unwrap();
      return { success: true };
    } catch (error) {
      console.error('Error pinning notice:', error);
      return { success: false, error };
    }
  };

  const unpinPost = async (noticeId) => {
    try {
      await dispatch(togglePinNotice(noticeId)).unwrap();
      return { success: true };
    } catch (error) {
      console.error('Error unpinning notice:', error);
      return { success: false, error };
    }
  };

  const togglePin = async (noticeId) => {
    try {
      await dispatch(togglePinNotice(noticeId)).unwrap();
      return { success: true };
    } catch (error) {
      console.error('Error toggling pin status:', error);
      return { success: false, error };
    }
  };

  return {
    pinPost,
    unpinPost,
    togglePin
  };
};

/**
 * PinIcon Component
 * Renders the pin icon for pinned notices (display only, non-clickable)
 */
export const PinIcon = ({ notice, currentTab, isPinned, className = "" }) => {
  // Support both new interface (notice) and legacy interface (isPinned)
  const pinned = notice ? (notice.is_pinned || notice.pinned || notice.isPinned) : isPinned;
  if (!pinned) return null;

  // Don't show pin icons in expired tab (tab 3)
  if (currentTab === 3) return null;

  return (
    <FaThumbtack
      className={`w-[16px] h-[16px] text-primary transform rotate-45 pointer-events-none ${className}`}
      title="Pinned notice"
      data-pin-icon="true"
    />
  );
};

export default usePinPost;
