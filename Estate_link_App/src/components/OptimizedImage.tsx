import React, { useState, useEffect, useRef } from 'react';
import { View, Image, ActivityIndicator, ImageProps, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';

// Global cache to track loaded images across all component instances
const globalLoadedImagesCache = new Set<string>();

interface OptimizedImageProps extends Omit<ImageProps, 'source' | 'style'> {
  source: { uri?: string } | number;
  className?: string;
  containerClassName?: string;
  showLoadingIndicator?: boolean;
  loadingIndicatorSize?: 'small' | 'large';
  loadingIndicatorColor?: string;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

/**
 * OptimizedImage component with loading states and error handling
 * Features:
 * - Shows shimmer loading effect while image loads
 * - Displays activity indicator during loading
 * - Shows error icon if image fails to load
 * - Smooth fade-in animation when image loads
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  source,
  className = '',
  containerClassName = '',
  showLoadingIndicator = true,
  loadingIndicatorSize = 'small',
  loadingIndicatorColor = '#3C9D9B',
  resizeMode = 'cover',
  ...imageProps
}) => {
  // Check initial state based on cache
  const initialUri = typeof source === 'object' ? source.uri : undefined;
  const isInitiallyCached = initialUri ? globalLoadedImagesCache.has(initialUri) : false;
  
  // Track if image is likely cached to skip loading state
  const [isLoading, setIsLoading] = useState(!isInitiallyCached);
  const [hasError, setHasError] = useState(false);
  const [opacity, setOpacity] = useState(isInitiallyCached ? 1 : 0);
  const currentSourceRef = useRef<string | undefined>(undefined);
  
  // Check if source changed to determine if we should reset state
  const currentSourceUri = typeof source === 'object' ? source.uri : undefined;
  
  useEffect(() => {
    const sourceChanged = currentSourceRef.current !== currentSourceUri;
    
    if (sourceChanged && currentSourceUri) {
      currentSourceRef.current = currentSourceUri;
      
      // Check if this image was loaded before (in global cache)
      if (globalLoadedImagesCache.has(currentSourceUri)) {
        // Image is cached, show immediately
        setIsLoading(false);
        setOpacity(1);
        setHasError(false);
      } else {
        // New image, show loading state
        setIsLoading(true);
        setOpacity(0);
        setHasError(false);
      }
    }
  }, [currentSourceUri]);

  // Handle image load start
  const handleLoadStart = () => {
    const uri = typeof source === 'object' ? source.uri : undefined;
    // Only show loading if this image hasn't been cached
    if (uri && !globalLoadedImagesCache.has(uri)) {
      setIsLoading(true);
      setOpacity(0);
    }
    // If cached, keep current state (don't reset)
    setHasError(false);
  };

  // Handle successful image load
  const handleLoadEnd = () => {
    const uri = typeof source === 'object' ? source.uri : undefined;
    if (uri) {
      globalLoadedImagesCache.add(uri);
    }
    setIsLoading(false);
    setOpacity(1);
  };

  // Handle image load error
  const handleError = (error: any) => {
    console.log('Image load error:', error?.nativeEvent?.error);
    setIsLoading(false);
    setHasError(true);
    setOpacity(1);
  };

  // Check if source is valid
  const isValidSource = source && (
    (typeof source === 'object' && source.uri && source.uri.trim() !== '') ||
    typeof source === 'number'
  );

  return (
    <View className={`overflow-hidden bg-gray-50 ${containerClassName}`}>
      {/* Actual Image - Render first so it's behind loading states */}
      {isValidSource && !hasError && (
        <Image
          {...imageProps}
          source={source}
          resizeMode={resizeMode}
          className={`w-full h-full ${className}`}
          style={{ opacity }}
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          progressiveRenderingEnabled={true}
          fadeDuration={300}
        />
      )}

      {/* Shimmer Loading Background - Only show on top if loading */}
      {isLoading && !hasError && opacity < 1 && (
        <View className="absolute inset-0 bg-gray-100">
          <ShimmerPlaceholder />
        </View>
      )}

      {/* Loading Indicator */}
      {isLoading && showLoadingIndicator && !hasError && opacity < 1 && (
        <View className="absolute inset-0 justify-center items-center z-10">
          <ActivityIndicator size={loadingIndicatorSize} color={loadingIndicatorColor} />
        </View>
      )}

      {/* Error State */}
      {hasError && (
        <View className="absolute inset-0 justify-center items-center z-10 bg-gray-100">
          <Ionicons name="image-outline" size={32} color="#9ca3af" />
        </View>
      )}

      {/* Fallback for invalid source */}
      {!isValidSource && (
        <View className="absolute inset-0 justify-center items-center z-10 bg-gray-100">
          <Ionicons name="image-outline" size={32} color="#9ca3af" />
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

