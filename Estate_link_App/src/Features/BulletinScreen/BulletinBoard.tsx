import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useAppSelector } from '../../store/hooks';
import { useBulletinsRedux } from '../../hooks/useBulletinsRedux';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BulletinCard } from './BulletinCard';

type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  AnnouncementNotice: undefined;
  NoticeBoard: undefined;
  CreateBulletin: undefined;
  EditBulletin: { bulletinId: string };
  PendingBulletin: undefined;
  Archive: undefined;
};

type BulletinBoardNavigationProp = StackNavigationProp<RootStackParamList>;

interface BulletinBoardProps {
  onCreateBulletin?: () => void;
  isActive?: boolean;
  parentRefreshing?: boolean;
  initialShowPendingBulletins?: boolean;
  highlightedBulletinId?: number | null;
}

function BulletinBoard({
  onCreateBulletin,
  isActive = true,
  parentRefreshing = false,
  initialShowPendingBulletins = false,
  highlightedBulletinId = null,
}: BulletinBoardProps) {
  // Debug: Log when highlightedBulletinId prop changes
  useEffect(() => {
    console.log('🚀 BulletinBoard component rendering, isActive:', isActive, 'highlightedBulletinId prop:', highlightedBulletinId);
    if (highlightedBulletinId) {
      console.log('✨ BulletinBoard received highlightedBulletinId:', highlightedBulletinId);
    }
  }, [highlightedBulletinId, isActive]);

  // Add ref to track if component is already stable
  const isStableRef = useRef(false);

  // Refs for scrolling to highlighted bulletin
  const bulletinRefs = useRef<{ [key: number]: View | null }>({});
  const flatListRef = useRef<FlatList | null>(null);
  const hasScrolledToHighlightedRef = useRef<number | null>(null);
  // Ref to track if we've already switched tabs for this highlighted bulletin
  const hasSwitchedTabForHighlightRef = useRef<number | null>(null);
  // Ref to skip tab-switch when user toggled "My Post" filter (avoid switching tab on filter change)
  const skipTabSwitchAfterFilterRef = useRef(false);

  const navigation = useNavigation<BulletinBoardNavigationProp>();

  const { user } = useAppSelector((state) => state.auth);

  const [refreshing, setRefreshing] = useState(false);
  const [myPostsOnly, setMyPostsOnly] = useState(false);
  const [showPendingBulletins, setShowPendingBulletins] = useState(initialShowPendingBulletins);
  // Remove displayPendingCount state as it causes synchronization issues
  // const [displayPendingCount, setDisplayPendingCount] = useState(0);

  // Use Redux-based hook for bulletins
  const {
    bulletins: currentBulletins,
    loading: currentLoading,
    error: currentError,
    hasLoadedOnce: currentHasLoadedOnce,
    forceRefreshBulletins: forceRefreshCurrentBulletins,
  } = useBulletinsRedux({ status: 'current', my_posts: myPostsOnly });

  // Debug: Log when current bulletins data changes (to track updates)
  useEffect(() => {
    if (highlightedBulletinId) {
      console.log('📊 Current bulletins data changed (with highlight):', {
        count: currentBulletins.length,
        hasLoadedOnce: currentHasLoadedOnce,
        loading: currentLoading,
        highlightedBulletinId: highlightedBulletinId,
        bulletinIds: currentBulletins.map(b => b.id)
      });
    }
  }, [currentBulletins.length, currentHasLoadedOnce, currentLoading, highlightedBulletinId]);

  const {
    bulletins: pendingBulletins,
    loading: pendingLoading,
    error: pendingError,
    hasLoadedOnce: pendingHasLoadedOnce,
    forceRefreshBulletins: forceRefreshPendingBulletins,
  } = useBulletinsRedux({ status: 'pending', my_posts: true }); // Always show only logged-in user's pending bulletins

  // Debug: Log when pending bulletins data changes (to track count updates)
  useEffect(() => {
    console.log('📊 Pending bulletins data changed:', {
      count: pendingBulletins.length,
      hasLoadedOnce: pendingHasLoadedOnce,
      loading: pendingLoading,
      highlightedBulletinId: highlightedBulletinId || 'none'
    });
  }, [pendingBulletins.length, pendingHasLoadedOnce, pendingLoading, highlightedBulletinId]);

  const {
    bulletins: archivedBulletins,
    loading: archivedLoading,
    hasLoadedOnce: archivedHasLoadedOnce,
    forceRefreshBulletins: forceRefreshArchivedBulletins,
  } = useBulletinsRedux({ status: 'archive', my_posts: true }); // Show only my archived bulletins count

  // Update showPendingBulletins when initialShowPendingBulletins prop changes
  useEffect(() => {
    if (initialShowPendingBulletins) {
      console.log('📋 Setting showPendingBulletins to true from prop');
      setShowPendingBulletins(true);

      // Force refresh pending bulletins to ensure latest data is shown
      console.log('🔄 Forcing refresh of pending bulletins due to navigation');
      forceRefreshPendingBulletins().then(() => {
        console.log('✅ Pending bulletins refreshed after navigation');
      }).catch((error) => {
        console.error('❌ Error refreshing pending bulletins:', error);
      });
    }
  }, [initialShowPendingBulletins, forceRefreshPendingBulletins]);

  // Force refresh both lists when highlightedBulletinId changes to ensure we have latest data
  // This is especially important when navigating from push notifications
  // This will update the pending count and current bulletins automatically
  useEffect(() => {
    if (highlightedBulletinId) {
      console.log('🔄 Highlighted bulletin ID changed (from push notification), refreshing both lists to get latest status');
      console.log('🔄 This will update pending count and current bulletins automatically');

      // Reset switch tracking when highlight changes
      hasSwitchedTabForHighlightRef.current = null;

      // Refresh both lists immediately to ensure we have the latest bulletin status
      // This ensures data is fresh when user clicks push notification
      // Use Promise.all to refresh both lists in parallel for faster updates
      Promise.all([
        forceRefreshCurrentBulletins(),
        forceRefreshPendingBulletins(),
        forceRefreshArchivedBulletins() // Also refresh archived to ensure counts are accurate
      ]).then(() => {
        console.log('✅ All bulletin lists refreshed successfully after notification navigation');
        console.log('✅ Pending count and current bulletins should now be updated');
      }).catch((error) => {
        console.error('❌ Error refreshing bulletin lists:', error);
      });
      // Reset scroll tracking
      hasScrolledToHighlightedRef.current = null;
    } else {
      // Clear switch tracking when highlight is cleared
      hasSwitchedTabForHighlightRef.current = null;
    }
  }, [highlightedBulletinId, forceRefreshCurrentBulletins, forceRefreshPendingBulletins, forceRefreshArchivedBulletins]);

  // DEBUG: Track refreshing state changes
  useEffect(() => {
    console.log('🔄 REFRESHING STATE CHANGED to:', refreshing);
  }, [refreshing]);

  // Handle immediate activation for stable display and prevent unnecessary operations
  useEffect(() => {
    if (isActive && !isStableRef.current) {
      console.log('📋 BulletinBoard becoming active and stable');
      isStableRef.current = true;
    } else if (!isActive) {
      isStableRef.current = false;
    }
  }, [isActive]);

  // Clear refresh state when switching tabs to prevent state confusion
  useEffect(() => {
    console.log('📋 Tab switched to:', showPendingBulletins ? 'pending' : 'current');
    // Clear refresh state when switching tabs
    if (refreshing) {
      console.log('🧹 Clearing refresh state due to tab switch');
      setRefreshing(false);
    }
  }, [showPendingBulletins]);

  // Remove the extra hook instance that was causing re-renders and infinite loops
  // Calculate status counts directly from the existing data
  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};

    // Count current bulletins
    if (currentBulletins.length > 0) {
      counts.current = currentBulletins.length;
    }

    // Count pending bulletins  
    if (pendingBulletins.length > 0) {
      counts.pending = pendingBulletins.length;
    }

    console.log('🔢 Calculating status counts directly:', {
      counts,
      currentBulletinsLength: currentBulletins.length,
      pendingBulletinsLength: pendingBulletins.length,
    });
    return counts;
  }, [currentBulletins.length, pendingBulletins.length]);

  // Calculate pending count directly from the pending bulletins data
  // This ensures the count is always accurate and stable
  // This will automatically update when bulletins are refreshed
  // pendingBulletins are already filtered by status via the Redux fetch (status='pending'),
  // so we use .length directly instead of re-filtering by bulletin.status which was broken
  // (the backend status field value doesn't match the literal 'pending' string).
  const pendingCount = React.useMemo(() => {
    const count = pendingBulletins.length;

    console.log('🔢 Pending count calculated:', {
      count,
      pendingBulletinsLength: pendingBulletins.length,
      pendingLoading,
      pendingHasLoadedOnce,
      highlightedBulletinId: highlightedBulletinId || 'none',
      pendingBulletinIds: pendingBulletins.map(b => b.id)
    });

    return count;
  }, [pendingBulletins, pendingHasLoadedOnce, pendingLoading, highlightedBulletinId]);

  // Calculate archived count directly from the archived bulletins data
  // archivedBulletins are already filtered by status via the Redux fetch (status='archive'),
  // so we use .length directly instead of re-filtering by bulletin.status.
  const archivedCount = React.useMemo(() => {
    const count = archivedBulletins.length;

    console.log('🔢 Archived count calculated:', {
      count,
      archivedBulletinsLength: archivedBulletins.length,
      archivedLoading,
      archivedHasLoadedOnce
    });

    return count;
  }, [archivedBulletins, archivedHasLoadedOnce]);

  // Remove the problematic displayPendingCount update effect
  // useEffect(() => {
  //   console.log('🔢 Updating display count from', displayPendingCount, 'to', pendingCount);
  //   setDisplayPendingCount(pendingCount);
  // }, [pendingCount]);

  // Removed force count recalculation effect - useMemo handles this automatically

  // Remove the automatic refresh when view changes to avoid loading states
  // useEffect(() => {
  //   console.log('🔄 View changed, forcing count recalculation');
  //   // This ensures count updates when switching between current and pending views
  //   
  //   // Immediately refresh the appropriate list when view changes
  //   if (showPendingBulletins) {
  //     console.log('🔄 Switched to pending view, refreshing pending bulletins');
  //     forceRefreshPendingBulletins();
  //   } else {
  //     console.log('🔄 Switched to current view, refreshing current bulletins');
  //     forceRefreshCurrentBulletins();
  //   }
  // }, [showPendingBulletins, forceRefreshPendingBulletins, forceRefreshCurrentBulletins]);

  // Always refresh when component mounts (e.g. tab switch to Bulletin) to ensure fresh data
  useEffect(() => {
    console.log('🚀 BulletinBoard mounted - refreshing to get latest data');

    // Always refetch to show updated values after tab changes or when returning to screen
    Promise.all([
      forceRefreshCurrentBulletins(),
      forceRefreshPendingBulletins(),
      forceRefreshArchivedBulletins()
    ]).then(() => {
      console.log('✅ BulletinBoard initial/refresh load completed');
    }).catch((error) => {
      console.error('❌ BulletinBoard refresh error:', error);
    });
  }, []); // Empty dependency array - only run on mount

  // Refetch when filters change (only myPostsOnly, not view changes)
  useEffect(() => {
    console.log('🔄 Filters changed - refreshing data');
    // Only refresh when myPostsOnly changes, not when switching views
    if (myPostsOnly !== undefined) {
      // Prevent scroll-to-highlight effect from switching tab when filter changes
      skipTabSwitchAfterFilterRef.current = true;
      if (showPendingBulletins) {
        forceRefreshPendingBulletins();
      } else {
        forceRefreshCurrentBulletins();
      }
    }
  }, [myPostsOnly]); // Remove showPendingBulletins from dependencies

  // Only refresh data when component becomes active if data is not already loaded
  useEffect(() => {
    // Skip if already stable to prevent scroll jumping on rapid clicks
    if (isStableRef.current) {
      console.log('🚫 BulletinBoard already stable, skipping active refresh');
      return;
    }

    if (isActive && (!currentHasLoadedOnce || !pendingHasLoadedOnce || !archivedHasLoadedOnce)) {
      console.log('🔄 BulletinBoard became active - refreshing missing data');
      if (!currentHasLoadedOnce) forceRefreshCurrentBulletins();
      if (!pendingHasLoadedOnce) forceRefreshPendingBulletins();
      if (!archivedHasLoadedOnce) forceRefreshArchivedBulletins();
    }
  }, [isActive, currentHasLoadedOnce, pendingHasLoadedOnce, archivedHasLoadedOnce]);

  // Handle parent refresh trigger
  useEffect(() => {
    if (parentRefreshing && isActive && !refreshing) {
      console.log('🔄 Parent refresh triggered for BulletinBoard');
      // Directly call the refresh functions instead of handleManualRefresh to avoid state conflicts
      Promise.all([
        forceRefreshCurrentBulletins(),
        forceRefreshPendingBulletins(),
        forceRefreshArchivedBulletins()
      ])
        .then(() => console.log('✅ BulletinBoard refresh completed'))
        .catch((error) => console.error('❌ BulletinBoard refresh error:', error));
    }
  }, [
    parentRefreshing,
    isActive,
    refreshing,
    forceRefreshCurrentBulletins,
    forceRefreshPendingBulletins,
    forceRefreshArchivedBulletins,
  ]);

  // Manual refresh handler
  const handleManualRefresh = async () => {
    console.log('🔄 Manual refresh button pressed');

    // Prevent double refresh
    if (refreshing || currentLoading || pendingLoading || archivedLoading) {
      console.log('⚠️ Refresh already in progress, skipping...');
      return;
    }

    setRefreshing(true);

    try {
      console.log('🔄 Starting force refresh of bulletin lists...');

      // Force refresh all lists
      await Promise.all([
        forceRefreshCurrentBulletins(),
        forceRefreshPendingBulletins(),
        forceRefreshArchivedBulletins()
      ]);

      console.log('✅ Manual refresh completed successfully');
    } catch (error) {
      console.error('❌ Manual refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateBulletin = () => {
    // Use callback if available, otherwise try direct navigation
    if (onCreateBulletin) {
      onCreateBulletin();
    } else {
      try {
        console.log('Attempting to navigate to CreateBulletin...');
        // Check if navigation is available before calling
        if (navigation && navigation.navigate) {
          navigation.navigate('CreateBulletin');
          console.log('Navigation successful');
        } else {
          console.warn('Navigation not available');
        }
      } catch (error) {
        console.error('Navigation error (component may have unmounted):', error);
      }
    }
  };

  // Status counts are now calculated above with useMemo

  // Removed excessive debug logging to prevent re-renders

  // Get the appropriate bulletins and loading state based on current view
  const currentBulletinsData = showPendingBulletins ? pendingBulletins : currentBulletins;

  // Prevent loading state changes when component is stable to avoid scroll jumping
  const originalLoadingState = showPendingBulletins ? pendingLoading : currentLoading;
  const currentLoadingState = isStableRef.current ? false : originalLoadingState;

  // Log when loading state is suppressed to help debug
  if (isStableRef.current && originalLoadingState) {
    console.log('🚫 BulletinBoard suppressing loading state to maintain scroll position');
  }

  const currentHasLoaded = showPendingBulletins ? pendingHasLoadedOnce : currentHasLoadedOnce;

  // Since backend now handles my_posts filtering, we can use the data directly
  const filteredBulletins = currentBulletinsData || [];

  // Removed excessive debug logging to prevent re-renders

  // Removed additional logging to prevent re-renders

  // Log when component mounts
  useEffect(() => {
    console.log('🚀 BulletinBoard component mounted');
    return () => {
      console.log('🔌 BulletinBoard component unmounting');
    };
  }, []);

  // Debug logging removed to prevent infinite loops
  // useEffect(() => {
  //     if (filteredBulletins.length > 0) {
  //         console.log('🔍 BulletinBoard - Debug Info:', {...});
  //     }
  // }, [filteredBulletins, user?.id]);

  // Debug logging (removed to prevent infinite loops)
  // console.log('🔍 Current bulletins data:', currentBulletinsData?.length || 0, 'items');

  // Refresh when screen gains focus (e.g. returning from CreateBulletin, EditBulletin) to show updated values
  useFocusEffect(
    useCallback(() => {
      if (!isActive) return;

      console.log('🔍 BulletinBoard focused - refreshing to get latest data');
      // Always refresh when bulletin tab is focused to ensure updates are visible
      Promise.all([
        forceRefreshCurrentBulletins(),
        forceRefreshPendingBulletins(),
        forceRefreshArchivedBulletins()
      ]).then(() => {
        console.log('✅ BulletinBoard focus refresh completed');
      }).catch((error) => {
        console.error('❌ BulletinBoard focus refresh error:', error);
      });
    }, [isActive, forceRefreshCurrentBulletins, forceRefreshPendingBulletins, forceRefreshArchivedBulletins])
  );

  // Toggle between current and pending bulletins
  const toggleBulletinView = () => {
    const newShowPending = !showPendingBulletins;
    setShowPendingBulletins(newShowPending);

    // Force refresh both lists to get latest data when switching tabs (e.g. newly approved bulletins)
    console.log('🔄 Tab switched - refreshing both lists to get latest data');
    Promise.all([
      forceRefreshCurrentBulletins(),
      forceRefreshPendingBulletins()
    ]).catch((error) => console.error('❌ Tab switch refresh error:', error));
  };

  // Scroll to highlighted bulletin when it's available
  // This effect handles automatic tab switching based on where the bulletin actually is
  useEffect(() => {
    // Only proceed if we have a highlighted bulletin
    if (!highlightedBulletinId) {
      // Reset switch tracking when highlight is cleared
      hasSwitchedTabForHighlightRef.current = null;
      skipTabSwitchAfterFilterRef.current = false;
      return;
    }

    // Wait for at least one list to be loaded before checking
    if (!currentHasLoadedOnce && !pendingHasLoadedOnce) {
      console.log('⏳ Waiting for bulletin lists to load before checking highlighted bulletin');
      return;
    }

    // Check both current and pending lists to find where the bulletin actually is
    const currentIndex = currentBulletins.findIndex(b => b.id === highlightedBulletinId);
    const pendingIndex = pendingBulletins.findIndex(b => b.id === highlightedBulletinId);

    // Determine which view the bulletin is actually in
    const isInCurrent = currentIndex !== -1;
    const isInPending = pendingIndex !== -1;

    // If bulletin is in current list but we're showing pending, switch to current
    // Only switch once per highlightedBulletinId to prevent infinite loops
    // Skip tab switch when user just toggled "My Post" filter so filter doesn't change the tab
    if (isInCurrent && showPendingBulletins && hasSwitchedTabForHighlightRef.current !== highlightedBulletinId && !skipTabSwitchAfterFilterRef.current) {
      console.log('📍 Highlighted bulletin is in current list, switching from pending to current view');
      hasSwitchedTabForHighlightRef.current = highlightedBulletinId; // Mark as switched
      setShowPendingBulletins(false);
      // Force refresh current bulletins to ensure we have the latest data
      forceRefreshCurrentBulletins();
      // Reset scroll tracking so we can scroll after tab switch
      hasScrolledToHighlightedRef.current = null;
      // Will re-trigger this effect after view switch, but hasSwitchedTabForHighlightRef will prevent loop
      return;
    }
    // If bulletin is in pending list but we're showing current, switch to pending
    // Only switch once per highlightedBulletinId to prevent infinite loops
    // Skip tab switch when user just toggled "My Post" filter so filter doesn't change the tab
    if (isInPending && !showPendingBulletins && hasSwitchedTabForHighlightRef.current !== highlightedBulletinId && !skipTabSwitchAfterFilterRef.current) {
      console.log('📍 Highlighted bulletin is in pending list, switching from current to pending view');
      hasSwitchedTabForHighlightRef.current = highlightedBulletinId; // Mark as switched
      setShowPendingBulletins(true);
      // Force refresh pending bulletins to ensure we have the latest data
      forceRefreshPendingBulletins();
      // Reset scroll tracking so we can scroll after tab switch
      hasScrolledToHighlightedRef.current = null;
      // Will re-trigger this effect after view switch, but hasSwitchedTabForHighlightRef will prevent loop
      return;
    }

    // Clear filter guard so future runs (e.g. notification navigation) can switch tab again
    skipTabSwitchAfterFilterRef.current = false;

    // If bulletin is not found in either list yet, wait for data to load or refresh
    if (!isInCurrent && !isInPending) {
      // If lists are loaded but bulletin not found, try refreshing
      if (currentHasLoadedOnce && pendingHasLoadedOnce && !currentLoadingState && !pendingLoading) {
        console.warn('⚠️ Highlighted bulletin not found in any list, refreshing lists:', highlightedBulletinId);
        // Refresh both lists to get latest data
        forceRefreshCurrentBulletins();
        forceRefreshPendingBulletins();
        return;
      }
      // Data still loading, wait
      return;
    }

    // Now check the filtered list (based on current view) and scroll to it
    // Wait a bit after tab switch to ensure the new view is rendered
    const bulletinIndex = filteredBulletins.findIndex(b => b.id === highlightedBulletinId);

    if (bulletinIndex !== -1 && hasScrolledToHighlightedRef.current !== highlightedBulletinId) {
      console.log('📍 Scrolling to highlighted bulletin:', highlightedBulletinId, 'at index:', bulletinIndex, 'in', showPendingBulletins ? 'pending' : 'current', 'view');

      // Wait for data to be fully loaded before scrolling
      // Use a longer delay when data was just refreshed to ensure FlatList is ready
      const delay = hasScrolledToHighlightedRef.current === null ? 1200 : 600;
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToIndex({
            index: bulletinIndex,
            animated: true,
            viewPosition: 0.1, // Scroll to near top
          });
          hasScrolledToHighlightedRef.current = highlightedBulletinId;
          console.log('✅ Successfully scrolled to highlighted bulletin at index:', bulletinIndex);
        } catch (error) {
          console.warn('⚠️ Error scrolling to index, using fallback:', error);
          // Fallback: scroll to offset
          setTimeout(() => {
            try {
              flatListRef.current?.scrollToOffset({
                offset: bulletinIndex * 400, // Approximate dynamic item height
                animated: true,
              });
              hasScrolledToHighlightedRef.current = highlightedBulletinId;
              console.log('✅ Successfully scrolled to highlighted bulletin using offset fallback');
            } catch (fallbackError) {
              console.error('❌ Fallback scroll also failed:', fallbackError);
            }
          }, 200);
        }
      }, delay);
    } else if (bulletinIndex === -1 && hasScrolledToHighlightedRef.current !== highlightedBulletinId) {
      // Bulletin not found in current filtered list, but we're still waiting for refresh
      console.log('⏳ Highlighted bulletin not yet in filtered list, waiting for refresh...');
    }
  }, [
    highlightedBulletinId,
    filteredBulletins,
    currentBulletins,
    pendingBulletins,
    currentLoadingState,
    pendingLoading,
    showPendingBulletins,
    currentHasLoadedOnce,
    pendingHasLoadedOnce,
    forceRefreshCurrentBulletins,
    forceRefreshPendingBulletins
  ]);

  // Clear highlight after 15 seconds (similar to announcements)
  useEffect(() => {
    if (highlightedBulletinId) {
      const clearTimer = setTimeout(() => {
        console.log('⏰ Clearing bulletin highlight after timeout');
        // Note: We can't directly clear highlightedBulletinId here since it comes from props
        // The parent component (AnnouncementNotice) should clear it after timeout
        // For now, we'll just log it - the highlight will remain until navigation changes
      }, 15000);
      return () => clearTimeout(clearTimer);
    }
  }, [highlightedBulletinId]);

  // Memoize the renderItem function to prevent unnecessary re-renders
  const renderBulletinItem = React.useCallback(({ item, index }: { item: any; index: number }) => {
    const isHighlighted = highlightedBulletinId === item.id;

    if (isHighlighted) {
      console.log('✨ Rendering HIGHLIGHTED bulletin item:', {
        id: item.id,
        highlightedBulletinId,
        title: item.title?.substring(0, 30)
      });
    }

    return (
      <View
        ref={(ref) => {
          if (isHighlighted) {
            bulletinRefs.current[item.id] = ref;
          }
        }}
        className={showPendingBulletins ? "mb-4" : "mb-6"}
        style={{
          marginBottom: index === filteredBulletins.length - 1
            ? (showPendingBulletins ? 24 : 32)
            : (showPendingBulletins ? 16 : 24),
          ...(isHighlighted ? {
            borderWidth: 4,
            borderColor: '#3C9D9B', // Primary color - bright teal
            borderRadius: 12,
            padding: 6,
            backgroundColor: '#E6F7F7', // Light highlight background
            shadowColor: '#3C9D9B',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8, // For Android
          } : {})
        }}
      >
        <BulletinCard
          bulletin={item}
          isMainDisplay={true}
          currentUserId={user?.id}
        />
      </View>
    );
  }, [showPendingBulletins, filteredBulletins.length, user?.id, highlightedBulletinId]);

  // Memoize key extractor for better performance
  const keyExtractor = React.useCallback((item: any) => `bulletin-${item.id}`, []);

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* No loading overlay - immediate stable display */}

      {/* Bulletin Board Controls */}
      <View className="border-b border-gray-100 bg-white px-4 py-4">
        <View className="mb-4 flex-row items-center justify-between">
          <TouchableOpacity
            className="flex-row items-center"
            onPress={() => {
              console.log('🔄 Checkbox pressed. Current state:', myPostsOnly);
              setMyPostsOnly(!myPostsOnly);
            }}>
            <View
              className={`mr-2 h-5 w-5 rounded border-2 ${myPostsOnly ? 'border-primary bg-primary' : 'border-gray-500'
                }`}>
              {myPostsOnly && <Ionicons name="checkmark" size={14} color="white" />}
            </View>
            <Text className="font-lato-bold text-text-primary">
              My Post
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center rounded-lg bg-primary px-6 py-3"
            onPress={handleCreateBulletin}>
            <Ionicons name="add" size={20} color="white" style={{ marginRight: 8 }} />
            <Text className="font-lato-bold text-white text-lg">Create Bulletin</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={toggleBulletinView}
            className="rounded-md border border-primary bg-white px-3 py-1.5 active:bg-primary/5">
            <Text className="font-lato-bold text-primary text-base">
              {showPendingBulletins
                ? 'Current Bulletins'
                : `Pending Bulletin (${pendingLoading && !pendingHasLoadedOnce ? '...' : pendingCount || 0})`
              }
            </Text>
          </TouchableOpacity>
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => {
                console.log('🔍 Archive button pressed');
                try {
                  navigation.navigate('Archive');
                  console.log('✅ Navigation successful');
                } catch (error) {
                  console.error('❌ Navigation error:', error);
                }
              }}
              className="rounded-md border border-primary bg-white px-3 py-1.5 active:bg-primary/5">
              <Text className="font-lato-bold text-primary text-base">
                Archive ({archivedLoading && !archivedHasLoadedOnce ? '...' : archivedCount || 0})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Gap between controls and content */}
      <View className="h-3" />

      {/* Wrapper with flex-1 so FlatList gets bounded height and can scroll */}
      <View style={{ flex: 1 }} collapsable={false}>
        <FlatList
          ref={flatListRef}
          data={filteredBulletins}
          extraData={filteredBulletins}
          keyExtractor={keyExtractor}
          renderItem={renderBulletinItem}
          style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 100,
          flexGrow: 1
        }}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        refreshing={refreshing}
        onRefresh={handleManualRefresh}
        onScrollToIndexFailed={(info) => {
          console.warn('⚠️ Scroll to index failed:', info);
          // Fallback: scroll to offset
          const wait = new Promise(resolve => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
          });
        }}
        ListEmptyComponent={
          currentLoadingState && !currentHasLoaded ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color="#3C9D9B" />
              <Text className="mt-2 font-lato text-text-secondary">
                {refreshing ? 'Force refreshing' : 'Loading'}{' '}
                {showPendingBulletins ? 'pending' : 'current'} bulletins...
              </Text>
            </View>
          ) : (
            <View className="items-center py-8">
              <Ionicons
                name={showPendingBulletins ? 'time-outline' : 'checkmark-circle-outline'}
                size={64}
                color="#9CA3AF"
              />
              <Text className="mt-4 text-center font-lato-bold text-lg text-text-secondary">
                No {showPendingBulletins ? 'pending' : 'current'} bulletins
              </Text>
              <Text className="mt-2 px-8 text-center font-lato text-text-secondary">
                {showPendingBulletins
                  ? 'No bulletins are waiting for approval.'
                  : 'No approved bulletins available at the moment.'}
              </Text>
            </View>
          )
        }
        removeClippedSubviews={false}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
        />
      </View>
    </View>
  );
}

// Custom memo comparison to prevent unnecessary re-renders
export default React.memo(BulletinBoard, (prevProps, nextProps) => {
  // IMPORTANT: Always allow re-render if highlightedBulletinId changes
  // This is critical for notification navigation to work
  if (prevProps.highlightedBulletinId !== nextProps.highlightedBulletinId) {
    console.log('✨ BulletinBoard - highlightedBulletinId changed, allowing re-render:', {
      prev: prevProps.highlightedBulletinId,
      next: nextProps.highlightedBulletinId
    });
    return false; // Allow re-render
  }

  // Special case: if both are active (bulletin tab), never re-render
  // This prevents re-renders when clicking the same tab multiple times
  // BUT only if highlightedBulletinId hasn't changed (checked above)
  if (prevProps.isActive && nextProps.isActive) {
    console.log('🚫 BulletinBoard - Both active, preventing re-render');
    return true; // Don't re-render
  }

  // More strict comparison - only re-render when absolutely necessary
  // Include highlightedBulletinId in comparison to ensure re-render when it changes
  const shouldNotRerender = (
    prevProps.isActive === nextProps.isActive &&
    prevProps.parentRefreshing === nextProps.parentRefreshing &&
    prevProps.onCreateBulletin === nextProps.onCreateBulletin &&
    prevProps.highlightedBulletinId === nextProps.highlightedBulletinId &&
    prevProps.initialShowPendingBulletins === nextProps.initialShowPendingBulletins
  );

  // Log when component would re-render to help debug
  if (!shouldNotRerender) {
    console.log('🔄 BulletinBoard re-render triggered:', {
      isActiveChanged: prevProps.isActive !== nextProps.isActive,
      parentRefreshingChanged: prevProps.parentRefreshing !== nextProps.parentRefreshing,
      onCreateBulletinChanged: prevProps.onCreateBulletin !== nextProps.onCreateBulletin,
      highlightedBulletinIdChanged: prevProps.highlightedBulletinId !== nextProps.highlightedBulletinId,
      initialShowPendingBulletinsChanged: prevProps.initialShowPendingBulletins !== nextProps.initialShowPendingBulletins,
    });
  }

  return shouldNotRerender;
});
