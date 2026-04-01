import { useEffect, useRef, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { fetchProfile, fetchMemberDetails, updateProfile, clearError, clearUpdateError } from '../store/slices/profileSlice';
import { ProfileData, UpdateProfileData, UnitRelationship } from '../types/profile';

export interface UseProfileReturn {
  profile: ProfileData | null;
  owners: UnitRelationship[];
  residents: UnitRelationship[];
  staff: UnitRelationship[];
  loading: boolean;
  error: string | null;
  updateLoading: boolean;
  updateError: string | null;
  hasLoadedOnce: boolean;
  refetchProfile: () => Promise<ProfileData | null>;
  updateUserProfile: (data: UpdateProfileData) => Promise<void>;
  clearErrors: () => void;
}

export const useProfile = (userId?: string | number): UseProfileReturn => {
  const dispatch = useAppDispatch();
  const profileState = useAppSelector((state) => state.profile);
  const currentUserId = useAppSelector((state) => state.auth.user?.id);
  const isAuthenticated = useAppSelector((state) => state.auth?.isAuthenticated);
  const hasToken = useAppSelector((state) => !!state.auth?.accessToken);
  const prevUserIdRef = useRef<string | undefined>(currentUserId);
  
  // Debug logging
  console.log('🔍 useProfile state:', profileState);
  console.log('🔍 useProfile state type:', typeof profileState);
  console.log('🔍 useProfile state keys:', profileState ? Object.keys(profileState) : 'null/undefined');
  
  // Defensive programming - provide default values if state is not initialized
  let profile: ProfileData | null;
  let owners: UnitRelationship[];
  let residents: UnitRelationship[];
  let staff: UnitRelationship[];
  let loading: boolean;
  let error: string | null;
  let updateLoading: boolean;
  let updateError: string | null;
  let hasLoadedOnce: boolean;
  
  try {
    ({ 
      profile = null,
      owners = [],
      residents = [],
      staff = [],
      loading = false, 
      error = null, 
      updateLoading = false, 
      updateError = null, 
      hasLoadedOnce = false 
    } = profileState || {});
  } catch (destructuringError) {
    console.error('❌ Error destructuring profile state:', destructuringError);
    // Fallback to default values
    profile = null;
    owners = [];
    residents = [];
    staff = [];
    loading = false;
    error = null;
    updateLoading = false;
    updateError = null;
    hasLoadedOnce = false;
  }

  // Load profile data - memoized to avoid unnecessary re-renders
  const refetchProfile = useCallback(async (): Promise<ProfileData | null> => {
    console.log('🔍 useProfile refetchProfile called - fetching current user\'s profile');
    // For profile management, always fetch the current user's own profile
    // No need for member details by ID - use the my_profile endpoint
    const result = await dispatch(fetchProfile());
    
    if (fetchProfile.fulfilled.match(result)) {
      console.log('✅ useProfile refetchProfile successful, returning profile data');
      return result.payload.member;
    } else {
      console.error('❌ useProfile refetchProfile failed');
      return null;
    }
  }, [dispatch]);

  // Update profile
  const updateUserProfile = async (data: UpdateProfileData): Promise<void> => {
    if (!profile?.id) {
      throw new Error('Profile ID not available');
    }
    
    console.log('🔄 useProfile updateUserProfile called with data:', data);
    
    try {
      const result = await dispatch(updateProfile({ id: profile.id, data }));
      
      console.log('🔄 useProfile updateProfile result:', result);
      
      if (updateProfile.rejected.match(result)) {
        const errorMessage = result.payload as string || 'Unknown error occurred';
        console.error('❌ useProfile updateProfile rejected:', errorMessage);
        throw new Error(errorMessage);
      }
      
      console.log('✅ useProfile updateProfile successful');
    } catch (error) {
      console.error('❌ useProfile updateUserProfile error:', error);
      throw error;
    }
  };

  // Clear errors
  const clearErrors = () => {
    dispatch(clearError());
    dispatch(clearUpdateError());
  };

  // Auto-load profile on hook initialization or when user changes
  useEffect(() => {
    const userIdChanged = prevUserIdRef.current !== currentUserId;
    
    console.log('🔄 useProfile useEffect triggered:', {
      hasLoadedOnce,
      loading,
      currentUserId,
      prevUserId: prevUserIdRef.current,
      userIdChanged,
      isAuthenticated,
      hasToken,
      error
    });
    
    // Don't attempt to fetch if user is not authenticated or token is missing
    if (!isAuthenticated || !hasToken) {
      console.log('⚠️ useProfile - Not authenticated or token missing, skipping auto-fetch');
      prevUserIdRef.current = currentUserId;
      return;
    }
    
    // Don't retry if there's already an authentication error
    if (error && (error.includes('not authenticated') || error.includes('not available'))) {
      console.log('⚠️ useProfile - Authentication error detected, skipping auto-fetch');
      prevUserIdRef.current = currentUserId;
      return;
    }
    
    // If user ID changed (new login), always refetch regardless of hasLoadedOnce
    // This ensures new user's data is loaded even if previous user's data was cached
    if (userIdChanged && currentUserId && !loading) {
      console.log('🔄 User ID changed, refetching profile for new user');
      prevUserIdRef.current = currentUserId;
      // Call refetchProfile asynchronously (no need to await in useEffect)
      refetchProfile().catch(error => {
        console.error('❌ useProfile auto-load failed:', error);
      });
    } else if (!hasLoadedOnce && !loading && currentUserId) {
      // Initial load for current user
      prevUserIdRef.current = currentUserId;
      refetchProfile().catch(error => {
        console.error('❌ useProfile auto-load failed:', error);
      });
    } else {
      // Update the ref even if we don't refetch
      prevUserIdRef.current = currentUserId;
    }
  }, [hasLoadedOnce, loading, currentUserId, isAuthenticated, hasToken, error, refetchProfile]);

  return {
    profile,
    owners,
    residents,
    staff,
    loading,
    error,
    updateLoading,
    updateError,
    hasLoadedOnce,
    refetchProfile,
    updateUserProfile,
    clearErrors,
  };
};