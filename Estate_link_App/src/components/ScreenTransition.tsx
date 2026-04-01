import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';

interface ScreenTransitionProps {
  children: React.ReactNode;
  isVisible: boolean;
  direction?: 'fade' | 'slideLeft' | 'slideRight' | 'slideUp' | 'slideDown';
  duration?: number;
}

export const ScreenTransition: React.FC<ScreenTransitionProps> = ({
  children,
  isVisible,
  direction = 'fade',
  duration = 300,
}) => {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0.95);

  useEffect(() => {
    if (isVisible) {
      // Animate in
      opacity.value = withTiming(1, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
      
      translateX.value = withSpring(0, {
        damping: 20,
        stiffness: 100,
      });
      
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 100,
      });
      
      scale.value = withSpring(1, {
        damping: 20,
        stiffness: 100,
      });
    } else {
      // Animate out
      opacity.value = withTiming(0, {
        duration: duration * 0.6,
        easing: Easing.in(Easing.cubic),
      });
      
      if (direction === 'slideLeft') {
        translateX.value = withTiming(-50, { duration: duration * 0.6 });
      } else if (direction === 'slideRight') {
        translateX.value = withTiming(50, { duration: duration * 0.6 });
      } else if (direction === 'slideUp') {
        translateY.value = withTiming(-50, { duration: duration * 0.6 });
      } else if (direction === 'slideDown') {
        translateY.value = withTiming(50, { duration: duration * 0.6 });
      }
      
      scale.value = withTiming(0.95, { duration: duration * 0.6 });
    }
  }, [isVisible, direction, duration]);

  const animatedStyle = useAnimatedStyle(() => {
    let transform: any[] = [{ scale: scale.value }];
    
    if (direction === 'slideLeft' || direction === 'slideRight') {
      transform.push({ translateX: translateX.value });
    } else if (direction === 'slideUp' || direction === 'slideDown') {
      transform.push({ translateY: translateY.value });
    }
    
    return {
      opacity: opacity.value,
      transform,
    };
  });

  return (
    <Animated.View style={animatedStyle} className="flex-1">
      {children}
    </Animated.View>
  );
};
