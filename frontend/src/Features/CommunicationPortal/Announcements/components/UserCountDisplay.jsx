import React, { memo } from 'react';
import { IoIosNotificationsOutline } from "react-icons/io";
import { useAnnouncementUserCount } from '../hooks/useUserCount';

/**
 * UserCountDisplay Component
 * Displays dynamic user count for announcements based on target units
 * Optimized to show cached data immediately without loading state
 */
const UserCountDisplay = memo(({ announcement, className = "", forceRefresh = false }) => {
  const { userCount, loading } = useAnnouncementUserCount(announcement, { forceRefresh });

  // Determine what count to display
  const displayCount = () => {
    // If we have target units data, use the calculated count (even if it's 0)
    if (announcement?.target_units_data !== undefined) {
      // Always return the calculated userCount, even if it's 0
      return userCount;
    }

    // Fallback to static views count if no target units data available
    return announcement?.views || 0;
  };

  return (
    <div 
      className={`flex items-center ${className}`}
      data-user-count="true"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <IoIosNotificationsOutline className="w-[18px] h-[18px] mr-1 text-gray-700" />
      <span className="text-[12px]">
        {/* Show count immediately, only show spinner if loading AND count is 0 */}
        {loading && userCount === 0 && announcement?.target_units_data?.length > 0 ? (
          <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        ) : (
          <span className={loading && userCount > 0 ? 'opacity-70' : ''}>{displayCount()}</span>
        )}
      </span>
    </div>
  );
});

UserCountDisplay.displayName = 'UserCountDisplay';

export default UserCountDisplay;
