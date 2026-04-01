import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';

export const AnimationDemo: React.FC = () => {
  const [activeAnimation, setActiveAnimation] = useState<string | null>(null);
  
  // Animation values
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
      { translateY: translateY.value },
    ],
    opacity: opacity.value,
  }));

  const runAnimation = (type: string) => {
    setActiveAnimation(type);
    
    switch (type) {
      case 'bounce':
        scale.value = withSequence(
          withSpring(1.2, { damping: 8, stiffness: 300 }),
          withSpring(0.8, { damping: 8, stiffness: 300 }),
          withSpring(1, { damping: 15, stiffness: 200 })
        );
        break;
        
      case 'rotate':
        rotation.value = withSequence(
          withSpring(360, { damping: 15, stiffness: 200 }),
          withSpring(0, { damping: 15, stiffness: 200 })
        );
        break;
        
      case 'slide':
        translateY.value = withSequence(
          withSpring(-50, { damping: 15, stiffness: 200 }),
          withSpring(50, { damping: 15, stiffness: 200 }),
          withSpring(0, { damping: 15, stiffness: 200 })
        );
        break;
        
      case 'fade':
        opacity.value = withSequence(
          withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 300, easing: Easing.in(Easing.cubic) })
        );
        break;
        
      case 'complex':
        // Run multiple animations in sequence
        scale.value = withSequence(
          withSpring(1.3, { damping: 8, stiffness: 300 }),
          withSpring(0.7, { damping: 8, stiffness: 300 }),
          withSpring(1, { damping: 15, stiffness: 200 })
        );
        
        rotation.value = withDelay(150, withSequence(
          withSpring(180, { damping: 15, stiffness: 200 }),
          withSpring(0, { damping: 15, stiffness: 200 })
        ));
        
        translateY.value = withDelay(300, withSequence(
          withSpring(-30, { damping: 15, stiffness: 200 }),
          withSpring(30, { damping: 15, stiffness: 200 }),
          withSpring(0, { damping: 15, stiffness: 200 })
        ));
        break;
    }
    
    // Reset active animation after animation completes
    setTimeout(() => setActiveAnimation(null), 1000);
  };

  const animations = [
    { name: 'bounce', label: 'Bounce Effect' },
    { name: 'rotate', label: '360° Rotation' },
    { name: 'slide', label: 'Slide Up & Down' },
    { name: 'fade', label: 'Fade In/Out' },
    { name: 'complex', label: 'Complex Animation' },
  ];

  return (
    <ScrollView className="flex-1 bg-gray-50 p-4">
      <Text className="text-2xl font-oxanium-bold text-center text-primary mb-8">
        Animation Demo
      </Text>
      
      {/* Animated Box */}
      <View className="items-center mb-8">
        <Animated.View
          className="w-32 h-32 bg-primary rounded-2xl items-center justify-center"
          style={animatedStyle}
        >
          <Text className="text-white font-oxanium-bold text-lg">
            Animated
          </Text>
        </Animated.View>
      </View>
      
      {/* Animation Controls */}
      <View className="space-y-4">
        {animations.map((animation) => (
          <TouchableOpacity
            key={animation.name}
            className={`p-4 rounded-xl border-2 ${
              activeAnimation === animation.name
                ? 'border-primary bg-primary/10'
                : 'border-gray-300 bg-white'
            }`}
            onPress={() => runAnimation(animation.name)}
            activeOpacity={0.7}
          >
            <Text
              className={`text-center font-oxanium-bold text-lg ${
                activeAnimation === animation.name ? 'text-primary' : 'text-gray-700'
              }`}
            >
              {animation.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Instructions */}
      <View className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-200">
        <Text className="text-blue-800 font-oxanium-bold text-lg mb-2">
          How to Use:
        </Text>
        <Text className="text-blue-700 text-sm leading-5">
          • Tap any animation button to see the effect{'\n'}
          • The animated box will demonstrate the animation{'\n'}
          • Active animations are highlighted in primary color{'\n'}
          • These same animations are used in the tab bar
        </Text>
      </View>
    </ScrollView>
  );
};
