import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

/**
 * Custom hook to get current user information
 * Reuses the same logic as announcements
 */
const useCurrentUser = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Get user from Redux store (assuming auth slice exists)
  const authUser = useSelector((state) => state.auth?.user);
  const memberData = useSelector((state) => state.member?.memberData);

  useEffect(() => {
    // Try to get user from auth state first, then from member data
    const user = authUser || memberData;
    
    if (user) {
      setCurrentUser({
        id: user.id,
        full_name: user.full_name || user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        email: user.email,
        ...user
      });
    }
    
    setLoading(false);
  }, [authUser, memberData]);

  // Manual refresh function
  const manualRefresh = () => {
    setLoading(true);
    // Trigger a re-evaluation of user data
    setTimeout(() => {
      const user = authUser || memberData;
      if (user) {
        setCurrentUser({
          id: user.id,
          full_name: user.full_name || user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          email: user.email,
          ...user
        });
      }
      setLoading(false);
    }, 100);
  };

  return {
    currentUser,
    loading,
    manualRefresh
  };
};

export default useCurrentUser;
