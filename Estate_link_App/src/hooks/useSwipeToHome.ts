import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Gesture } from 'react-native-gesture-handler';

/**
 * useSwipeToHome
 *
 * Returns a `panGesture` that detects horizontal swipes (left or right)
 * and navigates to the Home (Dashboard) tab when triggered.
 *
 * Pass enabled: false when the screen has a full-screen scrollable list (e.g. Bulletin Board)
 * so vertical scroll receives all touches and works reliably.
 *
 * Usage:
 *   const panGesture = useSwipeToHome(enabled);
 *   <GestureDetector gesture={panGesture}>
 *     <View style={{ flex: 1 }}>...</View>
 *   </GestureDetector>
 */
export function useSwipeToHome(enabled = true) {
  const navigation = useNavigation<any>();

  const navigateHome = useCallback(() => {
    navigation.navigate('Home');
  }, [navigation]);

  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .runOnJS(true)
    .minDistance(10)
    .activeOffsetX(40)
    .failOffsetY([-10, 10])
    .onEnd((event) => {
      const { translationX, translationY } = event;
      const absX = Math.abs(translationX);
      const absY = Math.abs(translationY);

      // Swipe is horizontal and meets minimum threshold
      if (absX > 60 && absX > absY) {
        navigateHome();
      }
    });

  return panGesture;
}

export default useSwipeToHome;
