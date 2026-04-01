import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../../../utils/axiosInstance';

/**
 * Custom hook to manage current user data with real-time updates
 * Listens for member updates in Redux and refreshes localStorage when current user is updated
 */
export const useCurrentUser = () => {
  const [currentUser, setCurrentUser] = useState(null);
  
  // Listen to member slice for updates
  const memberMessage = useSelector((state) => state.member.message);
  const memberLoading = useSelector((state) => state.member.loading);
  const selectedMember = useSelector((state) => state.member.selectedMember);
  
  // Function to get current user from localStorage
  const getCurrentUserFromStorage = () => {
    try {
      const member = localStorage.getItem('member');
      return member ? JSON.parse(member) : null;
    } catch (error) {
      console.error('Error getting current user from localStorage:', error);
      return null;
    }
  };

  // Function to refresh current user data from API
  const refreshCurrentUserData = async (userId) => {
    try {
      const response = await axiosInstance.get(`/user/member_details/${userId}/`);
      if (response.data && response.data.member) {
        localStorage.setItem('member', JSON.stringify(response.data.member));
        setCurrentUser(response.data.member);
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('memberUpdated', {
          detail: { updatedMember: response.data.member }
        }));
        
        console.log('Current user data refreshed successfully');
        return response.data.member;
      }
    } catch (error) {
      console.error('Error refreshing current user data:', error);
    }
    return null;
  };

  // Initialize current user on mount
  useEffect(() => {
    const user = getCurrentUserFromStorage();
    if (user) {
      setCurrentUser(user);
    }
  }, []);

  // Listen for member updates in Redux - multiple detection methods
  useEffect(() => {
    // When a member update is successful and not loading
    if (memberMessage === "Member updated successfully!" && !memberLoading) {
      console.log('Detected member update success message');
      const user = getCurrentUserFromStorage();
      if (user && user.id) {
        // Add a small delay to ensure the backend has processed the update
        setTimeout(() => {
          refreshCurrentUserData(user.id);
        }, 500);
      }
    }
  }, [memberMessage, memberLoading]);

  // Additional listener for selectedMember changes (when viewing member details)
  useEffect(() => {
    if (selectedMember && selectedMember.member) {
      const user = getCurrentUserFromStorage();
      // Check if the selected member is the current user
      if (user && user.id && selectedMember.member.id === user.id) {
        console.log('Detected current user update in selectedMember');
        // Update localStorage with the fresh data
        localStorage.setItem('member', JSON.stringify(selectedMember.member));
        setCurrentUser(selectedMember.member);

        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('memberUpdated', {
          detail: { updatedMember: selectedMember.member }
        }));
      }
    }
  }, [selectedMember]);

  // Listen for storage changes from other tabs/windows and visibility changes
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'member' && e.newValue) {
        try {
          const updatedUser = JSON.parse(e.newValue);
          setCurrentUser(updatedUser);
        } catch (error) {
          console.error('Error parsing updated user from storage:', error);
        }
      }
    };

    // Listen for custom memberUpdated events
    const handleMemberUpdate = (event) => {
      const updatedMember = event.detail?.updatedMember;
      if (updatedMember) {
        setCurrentUser(updatedMember);
      }
    };

    // Listen for visibility change (when user switches back to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Tab became visible, refreshing user data...');
        const user = getCurrentUserFromStorage();
        if (user && user.id) {
          setTimeout(() => {
            refreshCurrentUserData(user.id);
          }, 1000); // Small delay to ensure any updates have been processed
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('memberUpdated', handleMemberUpdate);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('memberUpdated', handleMemberUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Manual refresh function that can be called from components
  const manualRefresh = async () => {
    const user = getCurrentUserFromStorage();
    if (user && user.id) {
      console.log('Manual refresh triggered for user:', user.id);
      return await refreshCurrentUserData(user.id);
    }
    return null;
  };

  // Periodic check for updates (as fallback) - check every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const user = getCurrentUserFromStorage();
      if (user && user.id) {
        try {
          const response = await axiosInstance.get(`/user/member_details/${user.id}/`);
          if (response.data && response.data.member) {
            const freshData = response.data.member;
            // Check if the data has changed
            if (JSON.stringify(freshData) !== JSON.stringify(user)) {
              console.log('Detected user data change via periodic check');
              localStorage.setItem('member', JSON.stringify(freshData));
              setCurrentUser(freshData);

              // Dispatch custom event to notify other components
              window.dispatchEvent(new CustomEvent('memberUpdated', {
                detail: { updatedMember: freshData }
              }));
            }
          }
        } catch (error) {
          // Silently fail for periodic checks
          console.debug('Periodic user data check failed:', error);
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return {
    currentUser,
    refreshCurrentUserData,
    getCurrentUserFromStorage,
    manualRefresh
  };
};

export default useCurrentUser;
