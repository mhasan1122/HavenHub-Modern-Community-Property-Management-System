import { useSelector } from 'react-redux';

/**
 * Custom hook for getting current user information
 * Provides a clean interface to access current user data from Redux store
 */
export const useCurrentUser = () => {
  // Get user data from auth slice
  const authUser = useSelector((state) => state.auth?.user);
  const isAuthenticated = useSelector((state) => state.auth?.isAuthenticated);
  const authLoading = useSelector((state) => state.auth?.loading);

  // Get member data from member slice if available
  const memberData = useSelector((state) => state.member?.currentMember);
  const memberLoading = useSelector((state) => state.member?.loading);

  // Combine user data from different sources
  const currentUser = {
    // Basic auth info
    id: authUser?.id || authUser?.user_id,
    email: authUser?.email,
    username: authUser?.username,
    
    // Member info (if available)
    memberId: memberData?.id || authUser?.member_id,
    full_name: memberData?.full_name || authUser?.full_name || authUser?.name,
    fullName: memberData?.full_name || authUser?.full_name || authUser?.name,
    first_name: memberData?.first_name || authUser?.first_name,
    last_name: memberData?.last_name || authUser?.last_name,
    phone: memberData?.phone || authUser?.phone,
    
    // Role and permissions
    role: authUser?.role || memberData?.role,
    permissions: authUser?.permissions || [],
    
    // Profile info
    profile_picture: memberData?.profile_picture || authUser?.profile_picture,
    avatar: memberData?.profile_picture || authUser?.profile_picture || authUser?.avatar,
    
    // Additional member data
    member_type: memberData?.member_type,
    status: memberData?.status,
    
    // Raw data for fallback
    authUser,
    memberData
  };

  // Helper functions
  const helpers = {
    // Get display name
    getDisplayName: () => {
      return currentUser.full_name || 
             currentUser.fullName || 
             `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() ||
             currentUser.username ||
             currentUser.email ||
             'Unknown User';
    },

    // Get initials
    getInitials: () => {
      const name = helpers.getDisplayName();
      return name
        .split(' ')
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2);
    },

    // Check if user has permission
    hasPermission: (permission) => {
      if (!currentUser.permissions || !Array.isArray(currentUser.permissions)) {
        return false;
      }
      return currentUser.permissions.includes(permission);
    },

    // Check if user has any of the given permissions
    hasAnyPermission: (permissions) => {
      if (!Array.isArray(permissions)) return false;
      return permissions.some(permission => helpers.hasPermission(permission));
    },

    // Check if user has all of the given permissions
    hasAllPermissions: (permissions) => {
      if (!Array.isArray(permissions)) return false;
      return permissions.every(permission => helpers.hasPermission(permission));
    },

    // Check if user has a specific role
    hasRole: (role) => {
      return currentUser.role === role;
    },

    // Check if user has any of the given roles
    hasAnyRole: (roles) => {
      if (!Array.isArray(roles)) return false;
      return roles.includes(currentUser.role);
    },

    // Get profile picture URL
    getProfilePictureUrl: () => {
      return currentUser.profile_picture || 
             currentUser.avatar || 
             null;
    },

    // Check if user data is complete
    isProfileComplete: () => {
      return !!(currentUser.full_name && currentUser.email);
    }
  };

  return {
    // User data
    currentUser: isAuthenticated ? currentUser : null,
    
    // State
    isAuthenticated,
    isLoading: authLoading || memberLoading,
    
    // Helper functions
    ...helpers
  };
};

export default useCurrentUser;
