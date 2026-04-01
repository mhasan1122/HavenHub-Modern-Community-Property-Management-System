import React, { memo } from 'react';
import { IoIosNotificationsOutline } from "react-icons/io";
import { useNoticeUserCount } from '../hooks/useUserCount';

/**
 * UserCountDisplay Component
 * Displays dynamic user count for notices based on target units
 */
const UserCountDisplay = memo(({ notice, className = "", forceRefresh = false }) => {
  const { userCount, loading } = useNoticeUserCount(notice, { forceRefresh });

  // Determine what count to display
  const displayCount = () => {
    // If we have target units data (even if empty array), use the calculated count
    if (notice?.target_units_data !== undefined && notice?.target_units_data !== null) {
      // Always return the calculated userCount, even if it's 0
      return userCount;
    }

    // Fallback to static views count if no target units data available
    return notice?.views || 0;
  };

  // Check if we should show loading (only if we have units but no cached count yet)
  const shouldShowLoading = loading && 
    userCount === 0 && 
    notice?.target_units_data !== undefined && 
    notice?.target_units_data !== null &&
    notice?.target_units_data.length > 0; // Only show loading if there are actually units

  return (
    <div 
      className={`flex items-center ${className}`}
      data-user-count="true"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <IoIosNotificationsOutline className="w-[18px] h-[18px] mr-1" />
      <span className="text-[12px]">
        {shouldShowLoading ? (
          <div className="flex items-center">
            <div className="w-2 h-2 border border-gray-400 border-t-transparent rounded-full animate-spin mr-1"></div>
            <span className="text-gray-500">...</span>
          </div>
        ) : (
          displayCount()
        )}
      </span>
    </div>
  );
});

UserCountDisplay.displayName = 'UserCountDisplay';

export default UserCountDisplay;
