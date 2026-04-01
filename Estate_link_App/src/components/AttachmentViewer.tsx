import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MediaViewer } from './MediaViewer';
import { ImageWithFallback } from './ImageWithFallback';

// Generic attachment interface that works for both notices and announcements
interface GenericAttachment {
  id: number;
  file: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

interface AttachmentViewerProps {
  attachments: GenericAttachment[];
  maxDisplay?: number;
  notice?: any; // For notices
  announcement?: any; // For announcements
}

export const AttachmentViewer: React.FC<AttachmentViewerProps> = ({ 
  attachments, 
  maxDisplay = 5,
  notice,
  announcement
}) => {
  // Modal state for viewing attachments
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [selectedAttachmentIndex, setSelectedAttachmentIndex] = useState(0);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const displayAttachments = attachments.slice(0, maxDisplay);
  const remainingImages = attachments.slice(maxDisplay).filter(att => att.file_type?.startsWith('image/')).length;

  const handleImageError = (attachment: GenericAttachment) => {
    console.log('❌ Image load error for attachment:', {
      id: attachment.id,
      file_name: attachment.file_name,
      file_url: attachment.file_url,
      file_type: attachment.file_type
    });
  };

  const handleAttachmentPress = (attachment: GenericAttachment, index: number) => {
    // If it's an image or PDF, open the MediaViewer modal
    if (attachment.file_type?.startsWith('image/') || attachment.file_type === 'application/pdf') {
      console.log('🖼️ Opening MediaViewer for attachment:', attachment.file_name);
      setSelectedAttachmentIndex(index);
      setMediaViewerVisible(true);
    } else {
      // For other file types, show details (existing behavior)
      Alert.alert(
        'Attachment Details',
        `File: ${attachment.file_name}\nType: ${attachment.file_type}\nSize: ${attachment.file_size} bytes\nURL: ${attachment.file_url?.substring(0, 50)}...`
      );
    }
  };

  const handleMediaViewerClose = () => {
    setMediaViewerVisible(false);
  };

  return (
    <View className="px-4 pb-3">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
        {displayAttachments.map((attachment, index) => (
          <TouchableOpacity
            key={attachment.id}
            onPress={() => handleAttachmentPress(attachment, index)}
            activeOpacity={0.8}
            className="mr-3 h-40 w-32 overflow-hidden rounded-lg shadow-sm bg-white"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
            }}
          >
            {attachment.file_type?.startsWith('image/') ? (
              <View className="relative h-full w-full">
                <ImageWithFallback
                  file={attachment.file}
                  file_url={attachment.file_url}
                  fileName={attachment.file_name}
                  debugName={`AttachmentViewer-${attachment.id}`}
                  className="h-full w-full"
                  resizeMode="cover"
                  onError={() => handleImageError(attachment)}
                  style={{ borderRadius: 8 }}
                  containerStyle={{ borderRadius: 8 }}
                />
                
                {/* Show +X overlay on the last displayed image when there are more images */}
                {index === maxDisplay - 1 && remainingImages > 0 && (
                  <View className="absolute inset-0 bg-primary/60 items-center justify-center rounded-lg">
                    <Text className="text-white font-oxanium-bold text-lg">
                      +{remainingImages}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View className="h-full w-full bg-primaryLight items-center justify-center rounded-lg">
                {attachment.file_type === 'application/pdf' ? (
                  <Ionicons name="document-text" size={32} color="#3C9D9B" />
                ) : (
                  <Ionicons name="document" size={32} color="#6b7280" />
                )}
                <Text className="font-oxanium-bold text-primary text-center px-2 mt-1 text-xs">
                  {attachment.file_name || 'Attachment'}
                </Text>
                <Text className="font-oxanium-bold text-xs text-white mt-1 bg-primary px-2 py-1 rounded-lg">
                  {attachment.file_type === 'application/pdf' ? 'PDF' : 'File'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* MediaViewer Modal for viewing attachments with swiping */}
      <MediaViewer
        visible={mediaViewerVisible}
        onClose={handleMediaViewerClose}
        attachments={attachments}
        initialIndex={selectedAttachmentIndex}
      />
    </View>
  );
};
