import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OptimizedImage } from '../components/OptimizedImage';
import { ProfileImage } from '../components/ProfileImage';
import { ImageWithFallback } from '../components/ImageWithFallback';

/**
 * Test screen to demonstrate image loading optimization
 * This screen shows different image loading scenarios and optimizations
 */
export default function TestImageLoading() {
  // Sample image URLs (replace with your actual URLs for testing)
  const sampleImages = [
    'https://picsum.photos/400/300?random=1',
    'https://picsum.photos/400/300?random=2',
    'https://picsum.photos/400/300?random=3',
    'https://picsum.photos/400/300?random=4',
  ];

  const sampleProfilePhoto = 'https://picsum.photos/200/200?random=profile';

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 py-6">
          {/* Header */}
          <Text className="font-lato-bold text-3xl text-text-primary mb-2">
            Image Loading Test
          </Text>
          <Text className="font-lato text-base text-text-secondary mb-6">
            Test different image loading scenarios with optimized components
          </Text>

          {/* OptimizedImage Examples */}
          <View className="mb-8">
            <Text className="font-lato-bold text-xl text-text-primary mb-4">
              1. OptimizedImage Component
            </Text>
            <Text className="font-lato text-sm text-text-secondary mb-4">
              Shows shimmer loading effect and smooth fade-in
            </Text>

            <View className="flex-row flex-wrap gap-2">
              {sampleImages.map((url, index) => (
                <View key={index} className="w-[48%] h-40">
                  <OptimizedImage
                    source={{ uri: url }}
                    resizeMode="cover"
                    showLoadingIndicator={true}
                    loadingIndicatorSize="small"
                    borderRadius={8}
                    className="w-full h-full"
                  />
                </View>
              ))}
            </View>
          </View>

          {/* ProfileImage Examples */}
          <View className="mb-8">
            <Text className="font-lato-bold text-xl text-text-primary mb-4">
              2. ProfileImage Component
            </Text>
            <Text className="font-lato text-sm text-text-secondary mb-4">
              Optimized profile photos with different sizes
            </Text>

            <View className="space-y-4">
              {/* Group Icon */}
              <View className="flex-row items-center mb-4">
                <ProfileImage postAs="group" size="small" showBorder={true} />
                <View className="ml-3">
                  <Text className="font-lato-bold text-base">Group Post</Text>
                  <Text className="font-lato text-sm text-text-secondary">
                    Shows group icon (no loading needed)
                  </Text>
                </View>
              </View>

              {/* Member Photo - Small */}
              <View className="flex-row items-center mb-4">
                <ProfileImage
                  postAs="member"
                  memberPhoto={sampleProfilePhoto}
                  size="small"
                  showBorder={true}
                />
                <View className="ml-3">
                  <Text className="font-lato-bold text-base">Small Profile</Text>
                  <Text className="font-lato text-sm text-text-secondary">
                    40x40px with loading animation
                  </Text>
                </View>
              </View>

              {/* Member Photo - Medium */}
              <View className="flex-row items-center mb-4">
                <ProfileImage
                  postAs="member"
                  memberPhoto={sampleProfilePhoto + '&t=2'}
                  size="medium"
                  showBorder={true}
                />
                <View className="ml-3">
                  <Text className="font-lato-bold text-base">Medium Profile</Text>
                  <Text className="font-lato text-sm text-text-secondary">
                    48x48px with loading animation
                  </Text>
                </View>
              </View>

              {/* Member Photo - Large */}
              <View className="flex-row items-center mb-4">
                <ProfileImage
                  postAs="member"
                  memberPhoto={sampleProfilePhoto + '&t=3'}
                  size="large"
                  showBorder={true}
                />
                <View className="ml-3">
                  <Text className="font-lato-bold text-base">Large Profile</Text>
                  <Text className="font-lato text-sm text-text-secondary">
                    64x64px with loading animation
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ImageWithFallback Examples */}
          <View className="mb-8">
            <Text className="font-lato-bold text-xl text-text-primary mb-4">
              3. ImageWithFallback Component
            </Text>
            <Text className="font-lato text-sm text-text-secondary mb-4">
              Enhanced with shimmer effect for attachments
            </Text>

            <View className="flex-row gap-2">
              {sampleImages.slice(0, 3).map((url, index) => (
                <View key={index} className="flex-1 h-32">
                  <ImageWithFallback
                    file={url}
                    file_url={url}
                    fileName={`Image ${index + 1}`}
                    className="h-full w-full rounded-lg"
                    resizeMode="cover"
                    containerStyle={{ borderRadius: 8 }}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* Error Handling Test */}
          <View className="mb-8">
            <Text className="font-lato-bold text-xl text-text-primary mb-4">
              4. Error Handling
            </Text>
            <Text className="font-lato text-sm text-text-secondary mb-4">
              How components handle invalid or missing images
            </Text>

            <View className="flex-row gap-2">
              <View className="flex-1 h-40">
                <OptimizedImage
                  source={{ uri: 'https://invalid-url.com/image.jpg' }}
                  resizeMode="cover"
                  showLoadingIndicator={true}
                  borderRadius={8}
                  className="w-full h-full"
                />
                <Text className="font-lato text-xs text-text-secondary text-center mt-2">
                  Invalid URL
                </Text>
              </View>

              <View className="flex-1 h-40">
                <OptimizedImage
                  source={{ uri: '' }}
                  resizeMode="cover"
                  showLoadingIndicator={true}
                  borderRadius={8}
                  className="w-full h-full"
                />
                <Text className="font-lato text-xs text-text-secondary text-center mt-2">
                  Empty URL
                </Text>
              </View>
            </View>
          </View>

          {/* Testing Instructions */}
          <View className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
            <Text className="font-lato-bold text-lg text-blue-900 mb-2">
              💡 Testing Tips
            </Text>
            <Text className="font-lato text-sm text-blue-800 mb-2">
              1. <Text className="font-lato-bold">Enable network throttling</Text> to see loading animations clearly
            </Text>
            <Text className="font-lato text-sm text-blue-800 mb-2">
              2. <Text className="font-lato-bold">Pull to refresh</Text> to reload all images
            </Text>
            <Text className="font-lato text-sm text-blue-800 mb-2">
              3. <Text className="font-lato-bold">Watch for shimmer effects</Text> when images are loading
            </Text>
            <Text className="font-lato text-sm text-blue-800">
              4. <Text className="font-lato-bold">Check error states</Text> at the bottom
            </Text>
          </View>

          {/* Performance Info */}
          <View className="mt-6 bg-green-50 p-4 rounded-lg border-2 border-green-200">
            <Text className="font-lato-bold text-lg text-green-900 mb-2">
              ✅ Optimizations Applied
            </Text>
            <Text className="font-lato text-sm text-green-800 mb-1">
              • Shimmer loading animation
            </Text>
            <Text className="font-lato text-sm text-green-800 mb-1">
              • Activity indicator during load
            </Text>
            <Text className="font-lato text-sm text-green-800 mb-1">
              • Progressive image rendering
            </Text>
            <Text className="font-lato text-sm text-green-800 mb-1">
              • Smooth fade-in transitions
            </Text>
            <Text className="font-lato text-sm text-green-800">
              • Graceful error handling
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

