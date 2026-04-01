import React from 'react';
import { View, Text, ScrollView } from 'react-native';
// UPCOMING - Ionicons used by commented Coming Soon card
// import Ionicons from '@expo/vector-icons/Ionicons';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSwipeToHome } from '../../hooks/useSwipeToHome';

export const Activity: React.FC = () => {
  const panGesture = useSwipeToHome();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={panGesture}>
        <View className="flex-1 bg-white">
      <ScrollView
          className="flex-1 bg-white"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: 20,
            flex: 1,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <View className="mb-6">
            <Text className="font-oxanium-bold text-2xl">
              Activity
            </Text>
          </View>

          {/* UPCOMING - Commented out: Upcoming Features Card */}
          {/* <View className="flex-1 items-center justify-center">
            <View className="bg-gray-50 rounded-2xl p-8 items-center" style={{ width: '100%', maxWidth: 400 }}>
              <View className="bg-primaryLight rounded-full p-6 mb-4">
                <Ionicons name="trending-up" size={64} color="#3C9D9B" />
              </View>
              
              <Text className="font-oxanium-bold text-2xl text-gray-800 mb-2 text-center">
                Coming Soon!
              </Text>
              
              <Text className="font-oxanium-medium text-base text-gray-600 text-center mb-6">
                This feature is currently under development and will be available soon.
              </Text>
              
              <View className="bg-white rounded-xl p-4 w-full mb-4">
                <Text className="font-oxanium-semibold text-sm text-gray-700 mb-3">
                  Upcoming Features:
                </Text>
                
                <View className="space-y-2">
                  <View className="flex-row items-center mb-2">
                    <View className="bg-primaryLight rounded-full p-1 mr-3">
                      <Ionicons name="checkmark" size={16} color="#3C9D9B" />
                    </View>
                    <Text className="font-oxanium-regular text-sm text-gray-600 flex-1">
                      Track your activity history
                    </Text>
                  </View>
                  
                  <View className="flex-row items-center mb-2">
                    <View className="bg-primaryLight rounded-full p-1 mr-3">
                      <Ionicons name="checkmark" size={16} color="#3C9D9B" />
                    </View>
                    <Text className="font-oxanium-regular text-sm text-gray-600 flex-1">
                      Payment transactions log
                    </Text>
                  </View>
                  
                  <View className="flex-row items-center mb-2">
                    <View className="bg-primaryLight rounded-full p-1 mr-3">
                      <Ionicons name="checkmark" size={16} color="#3C9D9B" />
                    </View>
                    <Text className="font-oxanium-regular text-sm text-gray-600 flex-1">
                      Service request updates
                    </Text>
                  </View>
                  
                  <View className="flex-row items-center">
                    <View className="bg-primaryLight rounded-full p-1 mr-3">
                      <Ionicons name="checkmark" size={16} color="#3C9D9B" />
                    </View>
                    <Text className="font-oxanium-regular text-sm text-gray-600 flex-1">
                      Notifications and alerts
                    </Text>
                  </View>
                </View>
              </View>
              
              <Text className="font-oxanium-regular text-xs text-gray-500 text-center">
                Stay tuned for updates!
              </Text>
            </View>
          </View> */}
      </ScrollView>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

export default Activity;

