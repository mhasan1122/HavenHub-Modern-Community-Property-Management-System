import React, { useState, useEffect, useRef } from 'react';
import { Image, View, Text, ImageProps, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getPhotoURL } from '../utils/photoUtils';

// Global cache to track loaded images across all component instances
const globalImageCache = new Set<string>();

interface ImageWithFallbackProps extends Omit<ImageProps, 'source' | 'style'> {
  file?: string;
  file_url?: string;
  fileName?: string;
  fallbackIcon?: string;
  fallbackText?: string;
  debugName?: string;
  containerClassName?: string;
  fallbackTextClassName?: string;
  showDebugInfo?: boolean;
}

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  file,
  file_url,
  fileName,
  fallbackIcon = 'image-outline',
  fallbackText,
  debugName,
  containerClassName = '',
  fallbackTextClassName = '',
  showDebugInfo = __DEV__,
  onError,
  ...imageProps
}) => {
  const imageUrl = getPhotoURL(file, file_url, debugName);
  
  // Check if image is already cached
  const isImageCached = imageUrl ? globalImageCache.has(imageUrl) : false;
  
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(!isImageCached);
  const currentUrlRef = useRef<string | undefined>(undefined);

  // Monitor URL changes and check cache
  useEffect(() => {
    const urlChanged = currentUrlRef.current !== imageUrl;
    
    if (urlChanged && imageUrl) {
      currentUrlRef.current = imageUrl;
      
      // Check if this image was loaded before (in global cache)
      if (globalImageCache.has(imageUrl)) {
        // Image is cached, show immediately
        setIsLoading(false);
        setHasError(false);
      } else {
        // New image, show loading state
        setIsLoading(true);
        setHasError(false);
      }
    }
  }, [imageUrl]);

  const handleError = (error: any) => {
    setHasError(true);
    setIsLoading(false);
    
    if (showDebugInfo) {
      console.log('❌ ImageWithFallback error:', {
        fileName,
        file,
        file_url,
        imageUrl,
        error: error?.nativeEvent
      });
    }
    
    if (onError) {
      onError(error);
    }
  };

  const handleLoad = () => {
    // Add to cache when successfully loaded
    if (imageUrl) {
      globalImageCache.add(imageUrl);
    }
    setIsLoading(false);
    setHasError(false);
  };

  const handleLoadStart = () => {
    // Only show loading if this image hasn't been cached
    if (imageUrl && !globalImageCache.has(imageUrl)) {
      setIsLoading(true);
    }
    setHasError(false);
  };

  if (!imageUrl || hasError) {
    return (
      <View className={`justify-center items-center bg-gray-100 min-h-[100px] ${containerClassName}`}>
        <Ionicons 
          name={fallbackIcon as any} 
          size={32} 
          color="#9ca3af" 
          className="mb-2"
        />
        <Text className={`text-xs text-gray-500 text-center font-medium ${fallbackTextClassName}`}>
          {fallbackText || fileName || 'Image not available'}
        </Text>
        {showDebugInfo && (
          <Text className="text-[10px] text-[#3C9D9B] text-center mt-1">
            {!imageUrl ? 'No URL' : 'Load Error'}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View className={`relative overflow-hidden flex-1 bg-gray-50 ${containerClassName}`}>
      {/* Actual Image - Render first as base layer */}
      <Image
        {...imageProps}
        className="absolute inset-0"
        source={{ uri: imageUrl }}
        onError={handleError}
        onLoad={handleLoad}
        onLoadStart={handleLoadStart}
        progressiveRenderingEnabled={true}
        fadeDuration={300}
      />

      {/* Shimmer Loading Effect - Only show if actively loading */}
      {isLoading && (
        <View className="absolute inset-0 bg-gray-100 z-[1]">
          <ShimmerPlaceholder />
        </View>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <View className="absolute inset-0 justify-center items-center z-[2]">
          <ActivityIndicator size="small" color="#3C9D9B" />
        </View>
      )}
    </View>
  );
};

/**
 * Shimmer placeholder effect for loading state
 */
const ShimmerPlaceholder: React.FC = () => {
  const shimmerTranslate = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.timing(shimmerTranslate, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    );
    shimmerAnimation.start();

    return () => shimmerAnimation.stop();
  }, [shimmerTranslate]);

  const translateX = shimmerTranslate.interpolate({
    inputRange: [-1, 1],
    outputRange: [-350, 350],
  });

  return (
    <View className="absolute inset-0 overflow-hidden">
      <Animated.View
        className="absolute inset-0"
        style={{ transform: [{ translateX }] }}
      >
        <LinearGradient
          colors={['#f3f4f6', '#e5e7eb', '#f3f4f6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="absolute inset-0"
        />
      </Animated.View>
    </View>
  );
};
