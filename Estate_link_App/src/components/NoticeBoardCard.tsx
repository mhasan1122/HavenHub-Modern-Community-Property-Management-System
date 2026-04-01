import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useNotices } from '../hooks/useNotices';
import { ImageWithFallback } from './ImageWithFallback';
import Entypo from '@expo/vector-icons/Entypo';
import { Ionicons } from '@expo/vector-icons';
// Remove MediaViewer import since we don't want modal anymore
// import { MediaViewer } from './MediaViewer';

interface NoticeBoardCardProps {
  showTitle?: boolean;
  maxItems?: number;
  cardHeight?: number;
  cardWidth?: number;
  highlightedNoticeId?: number;
}

export const NoticeBoardCard: React.FC<NoticeBoardCardProps> = ({
  showTitle = true,
  maxItems = 5,
  cardHeight = 113.6181640625,
  cardWidth = 108,
  highlightedNoticeId
}) => {
  const navigation = useNavigation();
  const { notices, loading: noticesLoading, getNotices, error: noticesError } = useNotices();
  // Remove modal state since we don't need it anymore
  // const [viewerVisible, setViewerVisible] = useState(false);
  // const [viewerIndex, setViewerIndex] = useState(0);

  // Debug: Log notices data for troubleshooting
  console.log('🔍 NoticeBoardCard - Debug Info:', {
    totalNotices: notices?.length || 0,
    loading: noticesLoading,
    error: noticesError,
    hasNotices: notices && notices.length > 0,
    firstNotice: notices?.[0] ? {
      id: notices[0].id,
      title: notices[0].internal_title,
      hasAttachments: notices[0].attachments && notices[0].attachments.length > 0,
      attachmentsCount: notices[0].attachments?.length || 0
    } : null
  });

  // Debug: Log detailed information about all notices
  console.log('🔍 NoticeBoardCard - All notices breakdown:');
  notices?.forEach((notice, index) => {
    console.log(`  Notice ${index + 1}:`, {
      id: notice.id,
      title: notice.internal_title,
      status: notice.status,
      attachments_count: notice.attachments?.length || 0,
      has_attachments: notice.attachments && notice.attachments.length > 0
    });
  });

  // Filter notices that have attachments and are ongoing
  const noticesWithAttachments = notices.filter(notice =>
    notice.attachments && notice.attachments.length > 0 && notice.status === 'ongoing'
  ).slice(0, maxItems); // Limit the number of notices, not attachments

  console.log('🔍 NoticeBoardCard - Filtered notices:', {
    noticesWithAttachments: noticesWithAttachments.length,
    totalNotices: notices?.length || 0,
    filteredNoticesDetails: noticesWithAttachments.map(notice => ({
      id: notice.id,
      title: notice.internal_title,
      status: notice.status,
      attachments_count: notice.attachments?.length || 0
    }))
  });

  const scrollViewRef = useRef<ScrollView>(null);

  const handleNoticePress = (notice: any, attachmentIndex: number = 0, noticeIndex?: number) => {
    console.log('🖼️ Navigating to ShowNoticeBoard with notice data (FB-style: swipe through all)');

    const currentIndex =
      noticeIndex ?? noticesWithAttachments.findIndex((n) => n.id === notice.id);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;

    try {
      navigation.navigate('ShowNoticeBoard', {
        notice,
        selectedAttachmentIndex: attachmentIndex,
        allNotices: noticesWithAttachments,
        currentNoticeIndex: safeIndex,
      });
      console.log('🖼️ Navigation to ShowNoticeBoard successful with notice:', notice.internal_title, `(${safeIndex + 1} of ${noticesWithAttachments.length})`);
    } catch (error) {
      console.error('🖼️ Navigation error:', error);
    }
  };

  // Auto-scroll to highlighted notice when it becomes available
  useEffect(() => {
    if (highlightedNoticeId && noticesWithAttachments.length > 0) {
      const highlightedIndex = noticesWithAttachments.findIndex(
        notice => notice.id === highlightedNoticeId
      );
      
      if (highlightedIndex !== -1 && scrollViewRef.current) {
        // Scroll to the highlighted notice after a short delay to ensure layout is complete
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            x: highlightedIndex * (cardWidth + 12), // cardWidth + margin (mr-3 = 12px)
            animated: true,
          });
          console.log('📍 Scrolled to highlighted notice:', highlightedNoticeId, 'at index:', highlightedIndex);
        }, 300);
      }
    }
  }, [highlightedNoticeId, noticesWithAttachments, cardWidth]);

  // Create card dimensions style object for dynamic sizing
  const cardDimensions = {
    width: cardWidth,
    height: cardHeight,
  };

  return (
    <View className="bg-white px-4 py-4">
      {showTitle && (
        <View className="mb-4">
          <Text className="font-lato-bold text-2xl text-black">Notice Board</Text>
        </View>
      )}

      {/* Error Display */}
      {noticesError && (
        <View className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <View className="flex-row items-center mb-2">
            <Ionicons name="alert-circle" size={20} color="#dc2626" />
            <Text className="ml-2 font-lato-bold text-red-700 text-base">
              {noticesError.includes('permission') || noticesError.includes('403')
                ? 'Permission Error'
                : 'Error Loading Notices'}
            </Text>
          </View>
          <Text className="font-lato text-red-600 text-sm">
            {noticesError}
          </Text>
        </View>
      )}

      {/* Loading State - Only show when there's no data yet */}
      {noticesLoading && notices.length === 0 ? (
        <View className="py-4 items-center">
          <ActivityIndicator size="small" color="#3C9D9B" />
          <Text className="mt-2 font-lato text-gray-700 text-base">Loading notices...</Text>
        </View>
      ) : noticesWithAttachments.length === 0 ? (
        <View className="py-4 items-center">
          {notices && notices.length > 0 ? (
            <View className="items-center">
              <Text className="font-lato text-gray-700 text-center px-2 mb-2 text-base">
                No ongoing notices with attachments available
              </Text>
              <Text className="font-lato text-gray-600 text-center px-2 text-sm">
                Only ongoing notices with attachments are displayed here
              </Text>
            </View>
          ) : (
            <Text className="font-lato text-gray-700 text-center px-2 text-base">No ongoing notices available</Text>
          )}
        </View>
      ) : (
        /* Horizontal Scrollable Cards - Grouped by Notice */
        <ScrollView 
          ref={scrollViewRef}
          horizontal 
          showsHorizontalScrollIndicator={false}>
          {noticesWithAttachments.map((notice, index) => {
            const isHighlighted = highlightedNoticeId === notice.id;
            return (
              <View
                key={`notice-${notice.id}`}
                className="mr-3"
                style={cardDimensions}>
                <TouchableOpacity
                  className={`overflow-hidden bg-white rounded-xl w-full h-full ${
                    isHighlighted 
                      ? 'border-4 border-primary' 
                      : 'border-2 border-primary'
                  }`}
                  style={isHighlighted ? {
                    shadowColor: '#3C9D9B',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.5,
                    shadowRadius: 8,
                    elevation: 10,
                  } : {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                  activeOpacity={0.8}
                  onPress={() => handleNoticePress(notice, 0, index)}>

                {/* Image/PDF Preview - First Attachment */}
                <View className="relative flex-1">
                  {notice.attachments[0].file_type === 'application/pdf' ? (
                    /* PDF Preview */
                    <View className="flex-1 bg-primaryLight items-center justify-center">
                      <Ionicons name="document-text" size={40} color="#3C9D9B" />
                      <Text className="font-lato-bold text-black text-sm text-center px-2 mt-2" numberOfLines={2}>
                        {notice.attachments[0].file_name || 'PDF Document'}
                      </Text>
                      <View className="bg-primary px-2 py-1 rounded mt-1">
                        <Text className="font-lato-bold text-white text-xs">PDF</Text>
                      </View>
                    </View>
                  ) : (
                    /* Image Preview */
                    <ImageWithFallback
                      file={notice.attachments[0].file}
                      file_url={notice.attachments[0].file_url}
                      fileName={notice.attachments[0].file_name}
                      debugName={`NoticeBoardCard-${notice.id}-0`}
                      className="flex-1 w-full h-full"
                      resizeMode="cover"
                      fallbackIcon="image-outline"
                      fallbackText="Image not available"
                    />
                  )}

                  {/* Multiple Attachments Indicator */}
                  {notice.attachments.length > 1 && (
                    <View className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded-full flex-row items-center">
                      <Ionicons name="images" size={12} color="white" />
                      <Text className="font-lato-bold text-white text-xs ml-1">
                        {notice.attachments.length}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
            );
          })}
        </ScrollView>
      )}

      {/* Remove MediaViewer Modal since we don't need it anymore */}
      {/* <MediaViewer
        key={`media-viewer-${viewerIndex}`}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
        attachments={allAttachments}
        initialIndex={viewerIndex}
      /> */}
    </View>
  );
};