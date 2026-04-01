import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Dimensions, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
  withSequence,
  withDelay,
} from 'react-native-reanimated';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface TabItem {
  name: string;
  icon: any;
  label: string;
}

interface AnimatedTabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onTabPress: (tabName: string) => void;
}

export const AnimatedTabBar: React.FC<AnimatedTabBarProps> = ({
  tabs,
  activeTab,
  onTabPress,
}) => {
  const scaleValues = tabs.map(() => useSharedValue(1));
  const opacityValues = tabs.map(() => useSharedValue(0.6));
  const rotationValues = tabs.map(() => useSharedValue(0));

  // Animate tab scales, opacities, and rotations
  useEffect(() => {
    tabs.forEach((tab, index) => {
      const isActive = tab.name === activeTab;
      
      // Scale animation with bounce effect
      scaleValues[index].value = withSpring(isActive ? 1.15 : 1, {
        damping: 12,
        stiffness: 200,
        mass: 0.8,
      });
      
      // Opacity animation
      opacityValues[index].value = withTiming(isActive ? 1 : 0.6, {
        duration: 300,
      });

      // Rotation animation for active tab
      if (isActive) {
        rotationValues[index].value = withSequence(
          withSpring(0.1, { damping: 8, stiffness: 300 }),
          withSpring(0, { damping: 15, stiffness: 200 })
        );
      } else {
        rotationValues[index].value = withSpring(0, { damping: 15, stiffness: 200 });
      }
    });
  }, [activeTab]);

  const getTabAnimatedStyle = (index: number) => {
    return useAnimatedStyle(() => ({
      transform: [
        { scale: scaleValues[index].value },
        { rotate: `${rotationValues[index].value}rad` }
      ],
      opacity: opacityValues[index].value,
    }));
  };

  const handleTabPress = (tabName: string) => {
    // Add haptic feedback animation
    const tabIndex = tabs.findIndex(tab => tab.name === tabName);
    if (tabIndex !== -1) {
      // Bounce animation on press
      scaleValues[tabIndex].value = withSequence(
        withSpring(0.9, { damping: 8, stiffness: 300 }),
        withSpring(1.1, { damping: 8, stiffness: 300 }),
        withSpring(1, { damping: 15, stiffness: 200 })
      );
    }

    if (onTabPress) {
      onTabPress(tabName);
    }
  };

  return (
    <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200" style={{
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      backgroundColor: '#ffffff',
    }}>
      
      {/* Tab buttons */}
      <View className="flex-row items-center justify-between px-4 py-3" style={{ paddingBottom: 8 }}>
        {tabs.map((tab, index) => (
          <Animated.View
            key={tab.name}
            style={getTabAnimatedStyle(index)}
            className="flex-1 items-center"
          >
            <Pressable
              className="items-center px-2 py-3"
              onPress={() => handleTabPress(tab.name)}
              android_ripple={{ color: '#3C9D9B20', borderless: true }}
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.8 : 1,
                }
              ]}
            >
              <Image
                source={tab.icon}
                className="mb-1 h-6 w-6"
                style={{
                  tintColor: activeTab === tab.name ? '#3C9D9B' : '#9CA3AF',
                }}
                resizeMode="contain"
              />
              <Text
                className={`mt-1 font-oxanium-bold text-sm ${
                  activeTab === tab.name ? 'text-primary' : 'text-gray-400'
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </View>
  );
};
