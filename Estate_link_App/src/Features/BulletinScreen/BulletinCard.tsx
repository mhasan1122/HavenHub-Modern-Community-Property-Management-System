import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { getPhotoURL } from '../../utils/photoUtils';
import { getBackendURL } from '../../config/environment';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { BulletinHistoryModal, BlockUserModal, BlockUnblockSuccessPopup } from './components';
import DeleteConfirmationModal from '../../../components/DeleteConfirmationModal';
import SuccessPopup from '../../../components/SuccessPopup';
import { MediaViewer } from '../../components/MediaViewer';
import { ProfileImage, OptimizedImage } from '../../components';

import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useBulletinsRedux } from '../../hooks/useBulletinsRedux';

// Global state to track which menu is currently open
let currentOpenMenuId: string | null = null;
const menuStateListeners: Set<(openId: string | null) => void> = new Set();

const notifyMenuStateChange = (openId: string | null) => {
  currentOpenMenuId = openId;
  menuStateListeners.forEach(listener => listener(openId));
};

type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  AnnouncementNotice: undefined;
  NoticeBoard: undefined;
  CreateBulletin: undefined;
  EditBulletin: { bulletinId: string };
  PendingBulletin: undefined;
  Archive: undefined;
  ReportBulletin: { bulletinId: string };
};

type BulletinCardNavigationProp = StackNavigationProp<RootStackParamList>;

interface BulletinCardProps {
  notice?: any;
  bulletin?: any;
  isMainDisplay?: boolean;
  currentUserId?: string; // Add current user ID for permission checks
  isArchiveScreen?: boolean; // Add flag to identify if we're on archive screen
}

export const BulletinCard = React.memo(function BulletinCard({
  notice,
  bulletin,
  isMainDisplay = false,
  currentUserId,
  isArchiveScreen = false,
}: BulletinCardProps) {
  // Use bulletin if provided, otherwise fall back to notice
  const data = bulletin || notice;
  
  // Memoize attachment URIs to prevent image reloading on re-renders
  const attachmentURIs = React.useMemo(() => {
    if (!data?.attachments || data.attachments.length === 0) return [];
    return data.attachments.map((attachment: any) => ({
      id: attachment.id,
      uri: getPhotoURL(attachment.file) || undefined,
      file: attachment.file,
      file_name: attachment.file_name
    }));
  }, [data?.attachments]);
  
  // Debug: Log bulletin data to check member_photo
  console.log('🔍 BulletinCard Data:', {
    id: data?.id,
    title: data?.title,
    post_as: data?.post_as,
    member_name: data?.member_name,
    member_photo: data?.member_photo,
    creator_name: data?.creator_name,
    creator_photo: data?.creator_photo,
    posted_member: data?.posted_member,
  });
  
  const [showOptions, setShowOptions] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showBlockSuccessPopup, setShowBlockSuccessPopup] = useState(false);
  const [blockSuccessAuthorName, setBlockSuccessAuthorName] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  // Create unique ID for this card
  const cardId = `bulletin-${data?.id || Math.random().toString()}`;
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [selectedAttachmentIndex, setSelectedAttachmentIndex] = useState(0);
  const [historyData, setHistoryData] = useState<Array<{
    id: string;
    action: string;
    comment?: string;
    created_at: string;
    user_name: string;
  }>>([]);
  const navigation = useNavigation<BulletinCardNavigationProp>();
  const { width: screenWidth } = useWindowDimensions();
  
  // Get auth token and Redux actions from Redux
  const dispatch = useAppDispatch();
  const { accessToken } = useAppSelector((state) => state.auth);
  
  // Get the archiveBulletin action, removeBulletinsByCreatorId (to hide all posts by that member after block), and archived bulletins count
  const { archiveBulletin: archiveBulletinRedux, bulletins: archivedBulletins, removeBulletinsByCreatorId } = useBulletinsRedux({ status: 'archive' });

  // Listen for global menu state changes
  useEffect(() => {
    const listener = (openId: string | null) => {
      if (openId !== cardId) {
        setShowOptions(false);
      }
    };
    
    menuStateListeners.add(listener);
    
    return () => {
      menuStateListeners.delete(listener);
    };
  }, [cardId]);

  // Check if current user is the creator of this post
  // Handle both backend format (creator as number) and frontend format (creator.id as number)
  const creatorId = typeof data?.creator === 'object' ? data?.creator?.id : data?.creator;
  const isOwnPost = currentUserId && creatorId && currentUserId.toString() === creatorId.toString();

  // Debug logging to help troubleshoot the permission issue
  console.log('🔍 BulletinCard Permission Check:', {
    currentUserId: currentUserId,
    creatorId: creatorId,
    originalCreator: data?.creator,
    currentUserIdType: typeof currentUserId,
    creatorIdType: typeof creatorId,
    isOwnPost: isOwnPost,
    bulletinId: data?.id,
    creatorName: typeof data?.creator === 'object' ? data?.creator?.full_name : data?.creator_name,
  });

  if (!data) {
    return null;
  }

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
  };

  const getAuthorDisplayName = (notice: any) => {
    // Match announcement logic: prioritize group name, then member name, then creator name
    if (notice.post_as === 'group' && notice.group_name) {
      return notice.group_name;
    } else if (notice.post_as === 'member' && notice.member_name) {
      return notice.member_name;
    } else if (notice.creator && typeof notice.creator === 'object' && notice.creator.full_name) {
      return notice.creator.full_name;
    } else if (notice.creator_name) {
      return notice.creator_name;
    } else {
      return 'Unknown User';
    }
  };

  const handleAttachmentPress = (attachment: any, index: number) => {
    console.log('🖼️ Opening attachment:', attachment.file_name);
    setSelectedAttachmentIndex(index);
    setMediaViewerVisible(true);
  };



  const handleEdit = () => {
    setShowOptions(false);
    notifyMenuStateChange(null);
    // Don't allow editing on archive screen
    if (isArchiveScreen) {
      return;
    }
    console.log('Edit bulletin:', data.id);
    // Navigate to edit screen with bulletin ID
    try {
      if (navigation && navigation.navigate) {
        navigation.navigate('EditBulletin', { bulletinId: data.id.toString() });
      }
    } catch (error) {
      console.error('❌ Navigation error (component may have unmounted):', error);
    }
  };

  const handleHistory = () => {
    setShowOptions(false);
    notifyMenuStateChange(null);
    setShowHistoryModal(true);
    
    // Debug: Log the data structure
    console.log('🔍 Bulletin data for history:', {
      id: data.id,
      created_at: data.created_at,
      createdAt: data.createdAt,
      history: data.history,
      historyType: typeof data.history,
      isArray: Array.isArray(data.history)
    });
    
    // Start with creation entry
    const historyEntries = [{
      id: 'creation',
      action: 'created',
      comment: undefined,
      created_at: data.created_at || data.createdAt || new Date().toISOString(),
      user_name: getAuthorDisplayName(data)
    }];
    
    // Add backend history data if available
    if (data.history && Array.isArray(data.history)) {
      console.log('🔍 Processing history entries:', data.history.length);
      // Map backend history data to frontend format
      const mappedHistory = data.history.map((item: any) => {
        console.log('🔍 History item:', item);
        return {
          id: item.id?.toString() || '',
          action: item.action || '',
          comment: item.comment || undefined,
          created_at: item.edited_at || item.created_at || '',
          user_name: item.edited_by_name || item.user_name || 'Unknown User'
        };
      });
      historyEntries.push(...mappedHistory);
    }
    
    console.log('🔍 Final history entries:', historyEntries);
    setHistoryData(historyEntries);
  };

  const handleArchive = () => {
    setShowOptions(false);
    notifyMenuStateChange(null);
    // Don't allow archiving on archive screen
    if (isArchiveScreen) {
      return;
    }
    setShowArchiveModal(true);
  };

  const handleReport = () => {
    setShowOptions(false);
    notifyMenuStateChange(null);
    console.log('Report bulletin:', data.id);
    try {
      if (navigation && navigation.navigate) {
        navigation.navigate('ReportBulletin', { bulletinId: data.id.toString() });
      }
    } catch (error) {
      console.error('❌ Navigation error (component may have unmounted):', error);
    }
  };

  const handleBlockUser = () => {
    setShowOptions(false);
    notifyMenuStateChange(null);
    setShowBlockModal(true);
  };

  const handleBlockConfirm = async () => {
    const authorName = getAuthorDisplayName(data);
    setIsBlocking(true);
    try {
      const response = await fetch(
        `${getBackendURL()}/user/block/${creatorId}/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'X-App-Source': 'mobile',
          },
        }
      );
      const result = await response.json();
      if (response.ok) {
        setShowBlockModal(false);
        setBlockSuccessAuthorName(authorName);
        setShowBlockSuccessPopup(true);
      } else {
        setShowBlockModal(false);
        Alert.alert('Error', result.error || 'Failed to block user.');
      }
    } catch (error) {
      console.error('❌ Error blocking user:', error);
      setShowBlockModal(false);
      Alert.alert('Error', 'Failed to block user. Please try again.');
    } finally {
      setIsBlocking(false);
    }
  };

  const handleBlockSuccessClose = () => {
    setShowBlockSuccessPopup(false);
    // Remove all bulletins by this member so every post from them disappears at once
    dispatch(removeBulletinsByCreatorId(Number(creatorId)));
  };

  const handleArchiveConfirm = async () => {
    if (isArchiving) return; // Prevent double archiving
    
    setIsArchiving(true);
    
    try {
      console.log('📦 Archiving bulletin:', data.id);
      console.log('📦 Bulletin data:', { id: data.id, title: data.title, status: data.status });
      
      // Use Redux action to archive bulletin (this automatically updates the state)
      const result = await archiveBulletinRedux(data.id);
      console.log('📦 Archive result:', result);
      
      console.log('✅ Bulletin archived successfully');
      
      // Show success popup after archiving
      setShowSuccessPopup(true);
      
    } catch (error) {
      console.error('❌ Error archiving bulletin:', error);
      console.error('❌ Error details:', { 
        message: error instanceof Error ? error.message : String(error), 
        stack: error instanceof Error ? error.stack : undefined 
      });
      
      // Show error alert
      Alert.alert(
        'Archive Failed',
        error instanceof Error ? error.message : 'Failed to archive bulletin. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsArchiving(false);
    }
  };

  const handleSuccessPopupClose = () => {
    setShowSuccessPopup(false);
    
    // Navigate to Archive page only if not already there
    if (!isArchiveScreen) {
      try {
        console.log('🔄 Navigating to Archive screen after successful archiving');
        // Check if navigation is available before calling
        if (navigation && navigation.navigate) {
          navigation.navigate('Archive');
        }
      } catch (error) {
        console.log('⚠️ Navigation to Archive failed (component may have unmounted):', error);
      }
    } else {
      console.log('🔄 Already on Archive screen, closing popup');
    }
  };

  const renderCard = () => {
    if (isMainDisplay) {
      // Main display format - dynamic card with full content, photos show fully
      const listPadding = 32; // FlatList paddingHorizontal 16 * 2
      const cardPadding = 48; // px-6 (24) * 2
      const photoSectionWidth = screenWidth - listPadding - cardPadding;
      const singlePhotoHeight = Math.min(280, photoSectionWidth * 0.75);
      const multiPhotoSize = attachmentURIs.length === 2
        ? (photoSectionWidth - 8) / 2
        : (photoSectionWidth - 16) / 3;

      return (
        <View className="relative rounded-lg border border-gray-300 bg-white overflow-visible">
          {/* Header Section with Profile, Name, Time, and Options */}
          <View className="p-6 pb-6">
            <View className="flex-row items-start">
              {/* Profile Picture or Group Icon - Optimized with loading state */}
              <View className="mr-3">
                <ProfileImage
                  postAs={data.post_as}
                  memberPhoto={data.member_photo}
                  creatorPhoto={data.creator_photo}
                  creatorObject={data.creator && typeof data.creator === 'object' ? data.creator : undefined}
                  size="medium"
                  showBorder={true}
                />
              </View>

              {/* Name, Time, Label and Options */}
              <View className="flex-1">
                <View className="mb-1 flex-row items-center justify-between">
                  <Text className="flex-1 font-lato-bold text-lg ">
                    {getAuthorDisplayName(data)}
                  </Text>

                  {/* Options Menu - Show for all users */}
                  <View className="relative">
                    <TouchableOpacity 
                      onPress={() => {
                        // Check if this is the currently open menu
                        const isCurrentMenuOpen = showOptions && currentOpenMenuId === cardId;
                        
                        if (isCurrentMenuOpen) {
                          // Close current menu if clicking on the same 3-dot
                          setShowOptions(false);
                          notifyMenuStateChange(null);
                        } else {
                          // Always open this menu (will auto-close others)
                          setShowOptions(true);
                          notifyMenuStateChange(cardId);
                        }
                      }}
                      className="p-2 -m-2"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="ellipsis-vertical" size={20} color="#6b7280" />
                    </TouchableOpacity>

                    {/* Options Popup Menu */}
                    {showOptions && (
                      <>
                        {/* Full Screen Backdrop to close menu */}
                        <TouchableOpacity 
                          className="absolute z-10"
                          style={{
                            position: 'absolute',
                            top: -1000,
                            left: -1000,
                            right: -1000,
                            bottom: -1000,
                          }}
                          onPress={() => {
                            setShowOptions(false);
                            notifyMenuStateChange(null);
                          }}
                          activeOpacity={1}
                        />
                        
                        {/* Menu Content */}
                        <View className="absolute right-0 top-10 z-20 min-w-[160px] rounded-lg border border-gray-200 bg-white p-2 shadow-lg" style={{ elevation: 8 }}>
                          {/* Report option - visible only for other users' posts */}
                          {!isOwnPost && (
                            <TouchableOpacity
                              className="flex-row items-center rounded-lg px-3 py-2 active:bg-gray-100"
                              onPress={handleReport}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="flag-outline" size={18} color="#374151" />
                              <Text className="ml-3 font-lato">Report</Text>
                            </TouchableOpacity>
                          )}

                          {/* Block User option - visible only for other users' posts */}
                          {!isOwnPost && (
                            <TouchableOpacity
                              className="flex-row items-center rounded-lg px-3 py-2 active:bg-gray-100"
                              onPress={handleBlockUser}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
                              <Text className="ml-3 font-lato text-red-500">Block User</Text>
                            </TouchableOpacity>
                          )}

                          {/* Show Edit option only for own posts and not on archive screen */}
                          {isOwnPost && !isArchiveScreen && (
                            <TouchableOpacity
                              className="flex-row items-center rounded-lg px-3 py-2 active:bg-gray-100"
                              onPress={handleEdit}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="create-outline" size={18} color="#374151" />
                              <Text className="ml-3 font-lato">Edit</Text>
                            </TouchableOpacity>
                          )}

                          {/* History option - visible only for own posts */}
                          {isOwnPost && (
                            <TouchableOpacity
                              className="flex-row items-center rounded-lg px-3 py-3 active:bg-gray-100"
                              onPress={handleHistory}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="document-text-outline" size={18} color="#374151" />
                              <Text className="ml-3 font-lato">History</Text>
                            </TouchableOpacity>
                          )}

                          {/* Show Archive option only for own posts and not on archive screen */}
                          {isOwnPost && !isArchiveScreen && (
                            <TouchableOpacity
                              className="flex-row items-center rounded-lg px-3 py-3 active:bg-gray-100"
                              onPress={handleArchive}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="archive-outline" size={18} color="#ef4444" />
                              <Text className="ml-3 font-lato text-red-500">Archive</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </>
                    )}
                  </View>
                </View>

                <View className="mb-2 flex-row items-center">
                  <MaterialIcons name="watch-later" size={16} color="#6b7280" />
                  <Text className="ml-1 font-lato text-base text-text-secondary">
                    {formatTimeAgo(data.created_at)}
                  </Text>
                </View>
                
                {/* Labels - Separate row for better organization (same as announcements) */}
                {((data.labels && Array.isArray(data.labels) && data.labels.length > 0) || (!data.labels && data.label && data.label.trim() !== '')) && (
                  <View className="mb-2 flex-row flex-wrap items-center">
                    {data.labels && Array.isArray(data.labels) && data.labels.length > 0 && 
                      data.labels.map((label: string, index: number) => (
                        <View key={index} className="mb-1 mr-2 rounded-full bg-primary px-3 py-1.5">
                          <Text className="font-lato-bold text-base text-white">{label}</Text>
                        </View>
                      ))
                    }
                    {/* Handle string labels (comma-separated like announcements) */}
                    {!data.labels && data.label && data.label.trim() !== '' && 
                      data.label.split(',').map((labelPart: string, index: number) => (
                        <View key={index} className="mb-1 mr-2 rounded-full bg-primary px-3 py-1.5">
                          <Text className="font-lato-bold text-base text-white">{labelPart.trim()}</Text>
                        </View>
                      ))
                    }
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Content */}
          <View className="px-6 pb-6">
            {data.title && (
              <Text className="mb-3 font-lato-bold text-xl" numberOfLines={3}>
                {data.title}
              </Text>
            )}
            {data.description && (
              <View>
                <Text
                  className="mb-1 font-lato text-base text-text-secondary"
                  numberOfLines={descriptionExpanded ? undefined : 4}
                >
                  {data.description}
                </Text>
                {data.description.length > 150 && (
                  <TouchableOpacity
                    onPress={() => setDescriptionExpanded(!descriptionExpanded)}
                    className="self-start"
                    activeOpacity={0.7}
                  >
                    <Text className="font-lato-bold text-base text-primary">
                      {descriptionExpanded ? 'See less' : 'See more'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Attachments - Dynamic sizing, photos show fully (contain) */}
          {attachmentURIs.length > 0 && (
            <View className="px-6 pb-6">
              <View
                className="flex-row flex-wrap"
                style={{ gap: 8 }}
              >
                {attachmentURIs.slice(0, 3).map((attachment: any, index: number) => {
                  const attachmentCount = Math.min(attachmentURIs.length, 3);
                  const isSingle = attachmentCount === 1;
                  const itemWidth = isSingle ? photoSectionWidth : multiPhotoSize;
                  const itemHeight = isSingle ? singlePhotoHeight : multiPhotoSize;

                  return (
                    <View
                      key={`${data.id}-${attachment.id}-${index}`}
                      style={{
                        width: itemWidth,
                        height: itemHeight,
                        minWidth: itemWidth,
                        minHeight: itemHeight,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => handleAttachmentPress(data.attachments[index], index)}
                        activeOpacity={0.8}
                        className="relative flex-1 rounded-lg border border-primary overflow-hidden bg-gray-50"
                        style={{ width: itemWidth, height: itemHeight }}
                      >
                        <OptimizedImage
                          source={{ uri: attachment.uri }}
                          className="w-full h-full rounded-lg"
                          resizeMode="contain"
                          showLoadingIndicator={true}
                          loadingIndicatorSize="small"
                        />
                        {/* Show +count overlay on the 3rd image if there are more than 3 */}
                        {index === 2 && attachmentURIs.length > 3 && (
                          <View className="absolute inset-0 items-center justify-center rounded-lg bg-primary/60" pointerEvents="none">
                            <Text className="font-lato-bold text-2xl text-white">
                              +{attachmentURIs.length - 3}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      );
    } else {
      // Compact card format - smaller card for vertical list display
      return (
        <View className="min-h-[80px] rounded-lg border border-gray-100 bg-white px-3">
          {/* Header Section */}
          <View className="p-3 pb-1">
            <View className="flex-row items-start">
              {/* Profile Picture or Group Icon - Optimized with loading state */}
              <View className="mr-3">
                <ProfileImage
                  postAs={data.post_as}
                  memberPhoto={data.member_photo}
                  creatorPhoto={data.creator_photo}
                  creatorObject={data.creator && typeof data.creator === 'object' ? data.creator : undefined}
                  size="small"
                  showBorder={true}
                />
              </View>

              {/* Name, Time, Label and Options */}
              <View className="flex-1">
                <View className="mb-1 flex-row items-center justify-between">
                  <Text className="mr-2 flex-1 font-lato-bold text-lg">
                    {getAuthorDisplayName(data)}
                  </Text>

                  {/* Options Menu - Show for all users */}
                  <View className="relative">
                    <TouchableOpacity 
                      onPress={() => {
                        // Check if this is the currently open menu
                        const isCurrentMenuOpen = showOptions && currentOpenMenuId === cardId;
                        
                        if (isCurrentMenuOpen) {
                          // Close current menu if clicking on the same 3-dot
                          setShowOptions(false);
                          notifyMenuStateChange(null);
                        } else {
                          // Always open this menu (will auto-close others)
                          setShowOptions(true);
                          notifyMenuStateChange(cardId);
                        }
                      }}
                      className="p-2 -m-2"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="ellipsis-vertical" size={18} color="#6b7280" />
                    </TouchableOpacity>

                    {/* Options Popup Menu */}
                    {showOptions && (
                      <>
                        {/* Full Screen Backdrop to close menu */}
                        <TouchableOpacity 
                          className="absolute z-10"
                          style={{
                            position: 'absolute',
                            top: -1000,
                            left: -1000,
                            right: -1000,
                            bottom: -1000,
                          }}
                          onPress={() => {
                            setShowOptions(false);
                            notifyMenuStateChange(null);
                          }}
                          activeOpacity={1}
                        />
                        
                        {/* Menu Content */}
                        <View className="absolute right-0 top-10 z-20 min-w-[160px] rounded-lg border border-gray-200 bg-white p-2 shadow-lg" style={{ elevation: 8 }}>
                          {/* Report option - visible only for other users' posts */}
                          {!isOwnPost && (
                            <TouchableOpacity
                              className="flex-row items-center rounded-lg px-3 py-2 active:bg-gray-100"
                              onPress={handleReport}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="flag-outline" size={18} color="#374151" />
                              <Text className="ml-3 font-lato">Report</Text>
                            </TouchableOpacity>
                          )}

                          {/* Block User option - visible only for other users' posts */}
                          {!isOwnPost && (
                            <TouchableOpacity
                              className="flex-row items-center rounded-lg px-3 py-2 active:bg-gray-100"
                              onPress={handleBlockUser}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
                              <Text className="ml-3 font-lato text-red-500">Block User</Text>
                            </TouchableOpacity>
                          )}

                          {/* Show Edit option only for own posts and not on archive screen */}
                          {isOwnPost && !isArchiveScreen && (
                            <TouchableOpacity
                              className="flex-row items-center rounded-lg px-3 py-3 active:bg-gray-100"
                              onPress={handleEdit}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="create-outline" size={18} color="#374151" />
                              <Text className="ml-3 font-lato">Edit</Text>
                            </TouchableOpacity>
                          )}

                          {/* History option - visible only for own posts */}
                          {isOwnPost && (
                            <TouchableOpacity
                              className="flex-row items-center rounded-lg px-3 py-3 active:bg-gray-100"
                              onPress={handleHistory}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="document-text-outline" size={18} color="#374151" />
                              <Text className="ml-3 font-lato">History</Text>
                            </TouchableOpacity>
                          )}

                          {/* Show Archive option only for own posts and not on archive screen */}
                          {isOwnPost && !isArchiveScreen && (
                            <TouchableOpacity
                              className="flex-row items-center rounded-lg px-3 py-3 active:bg-gray-100"
                              onPress={handleArchive}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="archive-outline" size={18} color="#ef4444" />
                              <Text className="ml-3 font-lato text-red-500">Archive</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </>
                    )}
                  </View>
                </View>

                <View className="mb-2 flex-row items-center">
                  <MaterialIcons name="watch-later" size={14} color="#6b7280" />
                  <Text className="ml-1 font-lato text-sm text-text-secondary">
                    {formatTimeAgo(data.created_at)}
                  </Text>
                </View>
                
                {/* Labels - Separate row for better organization (same as announcements) */}
                {((data.labels && Array.isArray(data.labels) && data.labels.length > 0) || (!data.labels && data.label && data.label.trim() !== '')) && (
                  <View className="mb-2 flex-row flex-wrap items-center">
                    {data.labels && Array.isArray(data.labels) && data.labels.length > 0 && 
                      data.labels.map((label: string, index: number) => (
                        <View key={index} className="mb-1 mr-2 rounded-full bg-primary px-3 py-1.5">
                          <Text className="font-lato-bold text-sm text-white">{label}</Text>
                        </View>
                      ))
                    }
                    {/* Handle string labels (comma-separated like announcements) */}
                    {!data.labels && data.label && data.label.trim() !== '' && 
                      data.label.split(',').map((labelPart: string, index: number) => (
                        <View key={index} className="mb-1 mr-2 rounded-full bg-primary px-3 py-1.5">
                          <Text className="font-lato-bold text-sm text-white">{labelPart.trim()}</Text>
                        </View>
                      ))
                    }
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Content */}
          <View className="px-3 pb-3">
            {data.title && (
              <Text className="mb-2 font-lato-bold text-lg" numberOfLines={2}>
                {data.title}
              </Text>
            )}
            {data.description && (
              <View>
                <Text
                  className="mb-1 font-lato text-base text-text-secondary"
                  numberOfLines={descriptionExpanded ? undefined : 3}
                >
                  {data.description}
                </Text>
                {data.description.length > 120 && (
                  <TouchableOpacity
                    onPress={() => setDescriptionExpanded(!descriptionExpanded)}
                    className="self-start"
                    activeOpacity={0.7}
                  >
                    <Text className="font-lato-bold text-base text-primary">
                      {descriptionExpanded ? 'See less' : 'See more'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Attachments - Dynamic sizing, photos show fully (contain) */}
          {attachmentURIs.length > 0 && (
            <View className="px-3 pb-3">
              <View className="flex-row flex-wrap" style={{ gap: 4 }}>
                {attachmentURIs.slice(0, 3).map((attachment: any, index: number) => {
                  const attachmentCount = Math.min(attachmentURIs.length, 3);
                  const compactWidth = (screenWidth - 32 - 24 - 8) / attachmentCount - 4;
                  const compactHeight = Math.min(120, compactWidth);

                  return (
                    <View
                      key={`${data.id}-compact-${attachment.id}-${index}`}
                      style={{ width: compactWidth, height: compactHeight }}
                    >
                      <TouchableOpacity
                        onPress={() => handleAttachmentPress(data.attachments[index], index)}
                        activeOpacity={0.8}
                        className="relative flex-1 rounded-md border border-primary overflow-hidden bg-gray-50"
                        style={{ width: compactWidth, height: compactHeight }}
                      >
                        <OptimizedImage
                          source={{ uri: attachment.uri }}
                          className="w-full h-full rounded-md"
                          resizeMode="contain"
                          showLoadingIndicator={true}
                          loadingIndicatorSize="small"
                        />
                        {index === 2 && attachmentURIs.length > 3 && (
                          <View className="absolute inset-0 items-center justify-center rounded-md bg-primary/60" pointerEvents="none">
                            <Text className="font-lato-bold text-xl text-white">
                              +{attachmentURIs.length - 3}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      );
    }
  };

  return (
    <>
      {renderCard()}
      <BulletinHistoryModal
        visible={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        bulletin={data}
      />
      
      {/* Archive Confirmation Modal */}
      <DeleteConfirmationModal
        visible={showArchiveModal}
        onClose={() => !isArchiving && setShowArchiveModal(false)}
        onConfirm={handleArchiveConfirm}
        title="Archive Bulletin"
        message="Are you sure you want to archive this bulletin? It will be moved to the archive section."
        cancelText="Cancel"
        confirmText={isArchiving ? "Archiving..." : "Archive"}
        isLoading={isArchiving}
      />

      {/* Success Popup */}
      <SuccessPopup
        visible={showSuccessPopup}
        onClose={handleSuccessPopupClose}
        title="Bulletin Archived!"
        message={`Your bulletin has been successfully archived. You now have ${(archivedBulletins?.length || 0) + 1} archived bulletin${(archivedBulletins?.length || 0) + 1 !== 1 ? 's' : ''}.`}
        buttonText={isArchiveScreen ? "OK" : "View Archive"}
      />

      {/* Block User confirmation modal */}
      <BlockUserModal
        visible={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        onConfirm={handleBlockConfirm}
        authorName={getAuthorDisplayName(data)}
        confirmText={isBlocking ? 'Blocking...' : 'Block'}
        isLoading={isBlocking}
      />

      {/* Block success popup */}
      <BlockUnblockSuccessPopup
        visible={showBlockSuccessPopup}
        onClose={handleBlockSuccessClose}
        title="Blocked"
        message={`${blockSuccessAuthorName} has been blocked successfully.`}
        buttonText="OK"
        variant="block"
      />

      {/* MediaViewer Modal for viewing attachments */}
      <MediaViewer
        visible={mediaViewerVisible}
        onClose={() => setMediaViewerVisible(false)}
        attachments={data.attachments || []}
        initialIndex={selectedAttachmentIndex}
      />
    </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent re-renders when props haven't meaningfully changed
  const prevData = prevProps.bulletin || prevProps.notice;
  const nextData = nextProps.bulletin || nextProps.notice;
  
  return (
    prevData?.id === nextData?.id &&
    prevProps.isMainDisplay === nextProps.isMainDisplay &&
    prevProps.currentUserId === nextProps.currentUserId &&
    prevProps.isArchiveScreen === nextProps.isArchiveScreen &&
    prevData?.status === nextData?.status &&
    prevData?.attachments?.length === nextData?.attachments?.length
  );
});
