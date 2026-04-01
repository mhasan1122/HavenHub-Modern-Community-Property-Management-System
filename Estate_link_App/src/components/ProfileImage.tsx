import React from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { OptimizedImage } from './OptimizedImage';
import { getPhotoURL } from '../utils/photoUtils';

interface ProfileImageProps {
  postAs?: 'group' | 'member' | 'creator';
  memberPhoto?: string;
  creatorPhoto?: string;
  creatorObject?: { photo?: string };
  size?: 'small' | 'medium' | 'large';
  showBorder?: boolean;
}

/**
 * ProfileImage component for displaying user/group avatars with optimized loading
 * Handles different post types (group, member, creator) and provides consistent styling
 */
export const ProfileImage: React.FC<ProfileImageProps> = ({
  postAs,
  memberPhoto,
  creatorPhoto,
  creatorObject,
  size = 'medium',
  showBorder = true,
}) => {
  // Determine size classes
  const sizeClasses = {
    small: 'w-10 h-10',
    medium: 'w-12 h-12',
    large: 'w-16 h-16',
  };

  const iconSizes = {
    small: { group: 20, user: 16 },
    medium: { group: 24, user: 20 },
    large: { group: 32, user: 24 },
  };

  // Determine if photo exists
  const hasPhoto =
    (postAs === 'member' && memberPhoto && memberPhoto.trim() !== '') ||
    (creatorPhoto && creatorPhoto.trim() !== '') ||
    (creatorObject?.photo && creatorObject.photo.trim() !== '');

  // Determine border style
  const borderClass = showBorder
    ? hasPhoto || postAs === 'group'
      ? postAs === 'group'
        ? ''
        : 'border-2 border-primary'
      : 'border border-primary'
    : '';

  // Determine background style
  const bgClass = postAs === 'group' ? 'bg-gray-200' : '';

  return (
    <View className={`${sizeClasses[size]} rounded-full overflow-hidden ${borderClass} ${bgClass}`}>
      {postAs === 'group' ? (
        // Show icon for group posts
        <View className="w-full h-full items-center justify-center">
          <Ionicons name="people" size={iconSizes[size].group} color="#6B7280" />
        </View>
      ) : postAs === 'member' && memberPhoto && memberPhoto.trim() !== '' ? (
        // Show member photo for member posts
        <OptimizedImage
          source={{ uri: getPhotoURL(memberPhoto) || undefined }}
          resizeMode="cover"
          showLoadingIndicator={true}
          loadingIndicatorSize="small"
        />
      ) : creatorPhoto && creatorPhoto.trim() !== '' ? (
        // Show creator photo
        <OptimizedImage
          source={{ uri: getPhotoURL(creatorPhoto) || undefined }}
          resizeMode="cover"
          showLoadingIndicator={true}
          loadingIndicatorSize="small"
        />
      ) : creatorObject?.photo && creatorObject.photo.trim() !== '' ? (
        // Show creator photo from creator object
        <OptimizedImage
          source={{ uri: getPhotoURL(creatorObject.photo) || undefined }}
          resizeMode="cover"
          showLoadingIndicator={true}
          loadingIndicatorSize="small"
        />
      ) : (
        // Show default user icon
        <View className="w-full h-full items-center justify-center">
          <FontAwesome5 name="user" size={iconSizes[size].user} color="#3C9D9B" />
        </View>
      )}
    </View>
  );
};

