import React, { memo } from 'react';
import { IoIosNotificationsOutline } from "react-icons/io";
import { useBulletinUserCount } from '../../Announcements/hooks/useUserCount';

/**
 * UserCountDisplay Component for Bulletins
 * Displays dynamic user count for bulletins based on target units
 */
const UserCountDisplay = memo(({ bulletin, className = "", forceRefresh = false }) => {
  const { userCount, loading } = useBulletinUserCount(bulletin, { forceRefresh });

  // Determine what count to display
  const displayCount = () => {
    // If we have target units data, use the calculated count (even if it's 0)
    if (bulletin?.target_units_data !== undefined) {
      // Always return the calculated userCount, even if it's 0
      // The loading state will be handled by the loading indicator below
      return userCount;
    }

    // Fallback to static views count if no target units data available
    return bulletin?.views || 0;
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
        {loading && userCount === 0 && bulletin?.target_units_data !== undefined ? (
          <div className="flex items-center">
            <div className="w-2 h-2 border border-gray-400 border-t-transparent rounded-full animate-spin mr-1"></div>
            <span className="text-gray-500">0</span>
          </div>
        ) : (
          displayCount()
        )}
      </span>
    </div>
  );
});

UserCountDisplay.displayName = 'BulletinUserCountDisplay';

export default UserCountDisplay;
