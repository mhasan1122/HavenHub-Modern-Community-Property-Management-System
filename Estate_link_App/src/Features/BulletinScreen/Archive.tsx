import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  Archive: { bulletinId?: number } | undefined;
};

type ArchiveNavigationProp = StackNavigationProp<RootStackParamList>;
type ArchiveRouteProp = RouteProp<RootStackParamList, 'Archive'>;

// Get screen dimensions for responsive design
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function Archive() {
  const navigation = useNavigation<ArchiveNavigationProp>();
  const route = useRoute<ArchiveRouteProp>();
  console.log('🗄️ Archive component is rendering');

  const { user } = useAppSelector((state) => state.auth);

  const [refreshing, setRefreshing] = useState(false);
  const [highlightedBulletinId, setHighlightedBulletinId] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Use Redux-based hook for archived bulletins - show only current user's posts
  const {
    bulletins: archivedBulletins,
    loading: archivedLoading,
    error: archivedError,
    hasLoadedOnce: archivedHasLoadedOnce,
    forceRefreshBulletins: forceRefreshArchivedBulletins,
    getBulletinsByStatus: getArchivedStatusCounts,
  } = useBulletinsRedux({ status: 'archive', my_posts: true });

  // Handle route params for highlighting
  useFocusEffect(
    useCallback(() => {
        if (route.params?.bulletinId) {
            console.log('📌 Archive: Highlighting bulletin:', route.params.bulletinId);
            setHighlightedBulletinId(route.params.bulletinId);
            
            // Clear param to avoid re-highlighting on subsequent focus
            navigation.setParams({ bulletinId: undefined });
            
            // Clear highlight after delay
            setTimeout(() => {
                setHighlightedBulletinId(null);
            }, 10000);
        }
    }, [route.params?.bulletinId])
  );

  // Initial data load when component mounts (only if data hasn't been loaded before)
  useEffect(() => {
    console.log('🗄️ Archive component mounted - checking if data needs to be loaded');
    console.log('🗄️ Current state:', { archivedHasLoadedOnce, archivedLoading, archivedBulletinsCount: archivedBulletins?.length || 0 });
    // Only load if data hasn't been loaded before to prevent unnecessary refresh
    if (!archivedHasLoadedOnce && !archivedLoading) {
      console.log('🗄️ Loading initial archived bulletins data');
      forceRefreshArchivedBulletins();
    } else {
      console.log('🗄️ Archived bulletins data already available, skipping initial load');
    }
  }, []); // Keep empty dependency array to only run on mount

  // Manual refresh handler (only for pull-to-refresh)
  const handleManualRefresh = async () => {
    console.log('🔄 Archive manual refresh triggered by pull-to-refresh');

    // Prevent multiple simultaneous refreshes
    if (refreshing || archivedLoading) {
      console.log('⚠️ Archive refresh already in progress, skipping...');
      return;
    }

    setRefreshing(true);

    try {
      console.log('🔄 Starting manual refresh of archived bulletins...');
      await forceRefreshArchivedBulletins();
      console.log('✅ Archive manual refresh completed successfully');
    } catch (error) {
      console.error('❌ Archive manual refresh error:', error);
    } finally {
      // Ensure refresh state is cleared
      setRefreshing(false);
    }
  };

  // Refresh data when screen comes into focus (e.g., after archiving a bulletin)
  useFocusEffect(
    useCallback(() => {
      console.log('🔍 Archive screen focused - force refreshing to get latest data');
      // Always refresh to ensure we show the latest data, not cached values
      console.log('🔄 Refreshing archived bulletins data on focus');
      forceRefreshArchivedBulletins();
    }, [forceRefreshArchivedBulletins])
  );

  const filteredBulletins = archivedBulletins || [];

  // Responsive dimensions
  const headerHeight = Platform.OS === 'ios' ? 44 : 56;
  const paddingHorizontal = screenWidth > 400 ? 20 : 16;
  const cardSpacing = screenWidth > 400 ? 20 : 16;

  return (
    <SafeAreaView className="flex-1 bg-white" style={{ backgroundColor: 'white' }}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="white"
        translucent={false}
      />

      {/* Header */}
      <View
        className="border-b border-gray-100 bg-white"
        style={{
          paddingHorizontal: paddingHorizontal,
          paddingVertical: 22,
        }}
      >
        <View
          className="flex-row items-center justify-between"
          style={{ minHeight: headerHeight }}
        >
          <TouchableOpacity
            className="flex-row items-center"
            onPress={() => navigation.goBack()}
            style={{ paddingVertical: 8, paddingHorizontal: 4 }}
          >
            <Ionicons
              name="arrow-back"
              size={Platform.OS === 'ios' ? 24 : 28}
              color="#3C9D9B"
            />
            <Text
              className="font-oxanium-bold text-text-primary"
              style={{
                fontSize: Platform.OS === 'ios' ? 18 : 20,
                marginLeft: 8,
                fontWeight: '700'
              }}
            >
              Archive
            </Text>
          </TouchableOpacity>

          {/* Archive Count */}
          <Text
            className="font-lato-bold text-primary"
            style={{
              fontSize: Platform.OS === 'ios' ? 13 : 15,
              fontWeight: '500'
            }}
          >
            {/* {filteredBulletins.length} my archived bulletin{filteredBulletins.length !== 1 ? 's' : ''} */}
          </Text>
        </View>
      </View>

      {/* Main Content with Pull-to-Refresh */}
      <ScrollView
        ref={scrollViewRef}
        style={{
          flex: 1,
          paddingHorizontal: paddingHorizontal
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: Platform.OS === 'ios' ? 100 : 120, // Account for bottom navigation
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleManualRefresh}
            colors={['#3C9D9B']}
            tintColor="#3C9D9B"
            progressViewOffset={Platform.OS === 'ios' ? 0 : 20}
          />
        }
      >
        {/* Loading State */}
        {archivedLoading && !archivedHasLoadedOnce ? (
          <View
            className="items-center py-8"
            style={{ paddingVertical: screenHeight * 0.1 }}
          >
            <ActivityIndicator
              size={Platform.OS === 'ios' ? 'large' : 48}
              color="#3C9D9B"
            />
            <Text
              className="mt-4 font-lato text-text-secondary"
              style={{
                fontSize: Platform.OS === 'ios' ? 15 : 17,
                marginTop: 16,
                textAlign: 'center'
              }}
            >
              Loading archived bulletins...
            </Text>
          </View>
        ) : filteredBulletins.length === 0 ? (
          <View
            className="items-center py-8"
            style={{ paddingVertical: screenHeight * 0.15 }}
          >
            <Ionicons
              name="archive-outline"
              size={screenWidth > 400 ? 80 : 64}
              color="#9CA3AF"
            />
            <Text
              className="mt-4 text-center font-lato-bold text-lg text-text-secondary"
              style={{
                fontSize: Platform.OS === 'ios' ? 18 : 20,
                marginTop: 16,
                textAlign: 'center',
                fontWeight: '700'
              }}
            >
              No archived bulletins
            </Text>
            <Text
              className="mt-2 px-8 text-center font-lato text-text-secondary"
              style={{
                fontSize: Platform.OS === 'ios' ? 14 : 16,
                marginTop: 8,
                paddingHorizontal: screenWidth * 0.1,
                textAlign: 'center',
                lineHeight: Platform.OS === 'ios' ? 20 : 22
              }}
            >
              You haven't archived any bulletins yet.
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 16, paddingBottom: 100 }}>
            {filteredBulletins.map((bulletin, index) => (
              <View
                key={bulletin.id}
                className="mb-4"
                onLayout={(event) => {
                    if (highlightedBulletinId === bulletin.id) {
                        const { y } = event.nativeEvent.layout;
                        console.log('📌 Archive: Scrolling to bulletin at y:', y);
                        // Add a small delay to ensure ScrollView is ready
                        setTimeout(() => {
                            scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 20), animated: true });
                        }, 500);
                    }
                }}
                style={{
                  marginBottom: index === filteredBulletins.length - 1 ? 32 : cardSpacing,
                  marginTop: index === 0 ? 0 : cardSpacing / 2,
                  ...(highlightedBulletinId === bulletin.id ? {
                      borderWidth: 3,
                      borderColor: '#3C9D9B',
                      borderRadius: 12,
                      padding: 6,
                      backgroundColor: '#E6F7F7',
                      shadowColor: '#3C9D9B',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 8,
                  } : {})
                }}
              >
                <BulletinCard
                  bulletin={bulletin}
                  isMainDisplay={true}
                  currentUserId={user?.id}
                  isArchiveScreen={true}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
} 