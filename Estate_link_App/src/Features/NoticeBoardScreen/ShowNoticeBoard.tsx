import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StatusBar, Dimensions, Animated, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { ImageWithFallback } from '../../components/ImageWithFallback';
import { Ionicons } from '@expo/vector-icons';
import { PDFDownloader } from '../../components/PDFDownloader';
import { WebView } from 'react-native-webview';

type ShowNoticeBoardParams = {
  notice?: any;
  selectedAttachmentIndex?: number;
  allNotices?: any[];
  currentNoticeIndex?: number;
  returnToScreen?: keyof RootStackParamList;
};

type ShowNoticeBoardScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ShowNoticeBoard'
>;
type ShowNoticeBoardScreenRouteProp = RouteProp<RootStackParamList, 'ShowNoticeBoard'>;

const { width: screenWidth } = Dimensions.get('window');

export default function ShowNoticeBoard() {
  const navigation = useNavigation<ShowNoticeBoardScreenNavigationProp>();
  const route = useRoute<ShowNoticeBoardScreenRouteProp>();

  // Get parameters from route
  const params = route.params as ShowNoticeBoardParams | undefined;
  const selectedNotice = params?.notice;
  const selectedAttachmentIndex = params?.selectedAttachmentIndex || 0;
  const allNotices = params?.allNotices || [];
  const initialNoticeIndex = params?.currentNoticeIndex || 0;
  const returnToScreen = params?.returnToScreen; // Optional parameter to specify where to return

  // Story state management
  const [currentNoticeIndex, setCurrentNoticeIndex] = useState(initialNoticeIndex);
  const [currentAttachmentIndex, setCurrentAttachmentIndex] = useState(selectedAttachmentIndex);
  const [isPaused, setIsPaused] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false); // Flag to prevent timer conflicts during navigation
  const [manualNavigationMode, setManualNavigationMode] = useState(false); // Flag to disable auto-advance during manual navigation
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pausedProgress = useRef(0); // Store progress when paused

  // Touch tracking for swipe detection
  const touchStart = useRef({ x: 0, y: 0, time: 0 });
  const progressTimer = useRef<any>(null);
  const longPressTimer = useRef<any>(null);
  const isTimerRunning = useRef(false);
  const isNavigatingRef = useRef(false);
  const lastManualNavigationTime = useRef(0);
  const isPausedRef = useRef(false);

  // Refs to track current state for timer callbacks
  const currentNoticeIndexRef = useRef(currentNoticeIndex);
  const currentAttachmentIndexRef = useRef(currentAttachmentIndex);

  // Update refs when state changes
  useEffect(() => {
    currentNoticeIndexRef.current = currentNoticeIndex;
    currentAttachmentIndexRef.current = currentAttachmentIndex;
    isPausedRef.current = isPaused;
  }, [currentNoticeIndex, currentAttachmentIndex, isPaused]);

  // Get current notice (either from allNotices or selectedNotice)
  const currentNotice = allNotices.length > 0 ? allNotices[currentNoticeIndex] : selectedNotice;

  // Helper function to check if we're at the end of all stories
  const isAtEndOfAllStories = () => {
    if (allNotices.length > 0) {
      // Multiple notices: check if we're at the last notice and last attachment
      const isLastNotice = currentNoticeIndex >= allNotices.length - 1;
      const currentNoticeAttachments = currentNotice?.attachments?.length || 0;
      const isLastAttachment =
        currentNoticeAttachments === 0 || currentAttachmentIndex >= currentNoticeAttachments - 1;
      return isLastNotice && isLastAttachment;
    } else {
      // Single notice: check if we're at the last attachment
      const currentNoticeAttachments = currentNotice?.attachments?.length || 0;
      return (
        currentNoticeAttachments === 0 || currentAttachmentIndex >= currentNoticeAttachments - 1
      );
    }
  };

  // Auto-advance timer management
  const startProgressTimer = () => {
    if (isPaused || isNavigating || manualNavigationMode) {
      console.log('⏸️ Progress timer blocked:', { isPaused, isNavigating, manualNavigationMode });
      return;
    }

    // Additional check: prevent timer start if manual navigation happened recently
    const timeSinceLastNavigation = Date.now() - lastManualNavigationTime.current;
    if (timeSinceLastNavigation < 5000) {
      // 5 seconds
      console.log(
        '⏸️ Progress timer blocked - recent manual navigation:',
        timeSinceLastNavigation,
        'ms ago'
      );
      return;
    }

    if (isTimerRunning.current) {
      console.log('⏸️ Timer already running, skipping');
      return;
    }

    console.log('▶️ Starting progress timer');
    isTimerRunning.current = true;

    // Clear any existing timer
    if (progressTimer.current) {
      clearTimeout(progressTimer.current);
      progressTimer.current = null;
    }

    // Smoothly stop any running animation and reset
    progressAnim.stopAnimation(() => {
      progressAnim.setValue(0);
      pausedProgress.current = 0; // Reset paused progress for new content

      // Determine duration based on content type
      const currentAttachment = currentNotice?.attachments?.[currentAttachmentIndex];
      let duration = 7000; // Default for images

      if (!currentAttachment) {
        // Text-only notice
        duration = 5000; // 5 seconds for text-only
      } else if (currentAttachment.file_type === 'application/pdf') {
        // PDF document
        duration = 7000; // 7 seconds for PDFs
      } else {
        // Image
        duration = 7000; // 7 seconds for images
      }

      // Start animation with smooth timing
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: duration,
        useNativeDriver: false,
      }).start((finished) => {
        console.log('⏰ Progress animation finished:', {
          finished,
          isPaused,
          isNavigating,
          manualNavigationMode,
          currentNoticeIndex,
          currentAttachmentIndex,
          totalNotices: allNotices.length,
          currentNoticeAttachments: currentNotice?.attachments?.length || 0,
        });
        isTimerRunning.current = false;
        pausedProgress.current = 0; // Reset paused progress

        // Only auto-advance if we're not navigating, not paused, and animation completed naturally
        if (
          finished &&
          !isPausedRef.current &&
          !isNavigating &&
          !isNavigatingRef.current &&
          !manualNavigationMode
        ) {
          console.log('➡️ Auto-advancing to next from timer completion');
          advanceToNext();
        } else {
          console.log('⏸️ Auto-advance blocked:', {
            finished,
            isPaused: isPausedRef.current,
            isNavigating,
            isNavigatingRef: isNavigatingRef.current,
            manualNavigationMode,
          });
        }
      });
    });
  };

  const pauseTimer = () => {
    setIsPaused(true);
    isPausedRef.current = true;
    progressAnim.stopAnimation((value) => {
      pausedProgress.current = value; // Store current progress
      isTimerRunning.current = false;
    });
  };

  const resetTimerState = () => {
    console.log('🔄 Resetting timer state - entering manual navigation mode');

    // Immediately stop any running timer
    if (progressTimer.current) {
      clearTimeout(progressTimer.current);
      progressTimer.current = null;
    }

    // Smoothly stop animation and reset
    progressAnim.stopAnimation(() => {
      progressAnim.setValue(0);
      pausedProgress.current = 0; // Reset paused progress

      // Reset all timer flags
      isTimerRunning.current = false;
      isNavigatingRef.current = false;

      // Set manual navigation mode to block all auto-advance
      setManualNavigationMode(true);
      lastManualNavigationTime.current = Date.now();

      // Re-enable auto-advance after 5 seconds of inactivity (increased delay)
      setTimeout(() => {
        if (!isNavigating && !isPaused) {
          console.log('🔄 Re-enabling auto-advance after inactivity');
          setManualNavigationMode(false);
        }
      }, 5000);
    });
  };

  const resumeTimer = () => {
    setIsPaused(false);
    isPausedRef.current = false;

    if (isNavigating || manualNavigationMode) {
      return;
    }

    // Additional check: prevent timer start if manual navigation happened recently
    const timeSinceLastNavigation = Date.now() - lastManualNavigationTime.current;
    if (timeSinceLastNavigation < 5000) {
      return;
    }

    if (isTimerRunning.current) {
      return;
    }

    console.log('▶️ Resuming progress timer from:', pausedProgress.current);
    isTimerRunning.current = true;

    // Clear any existing timer
    if (progressTimer.current) {
      clearTimeout(progressTimer.current);
      progressTimer.current = null;
    }

    // Determine duration based on content type
    const currentAttachment = currentNotice?.attachments?.[currentAttachmentIndex];
    let totalDuration = 7000; // Default for images

    if (!currentAttachment) {
      // Text-only notice
      totalDuration = 5000; // 5 seconds for text-only
    } else if (currentAttachment.file_type === 'application/pdf') {
      // PDF document
      totalDuration = 7000; // 7 seconds for PDFs
    } else {
      // Image
      totalDuration = 7000; // 7 seconds for images
    }

    // Set animation to paused position first
    progressAnim.setValue(pausedProgress.current);

    // Calculate remaining duration based on paused progress
    const remainingDuration = totalDuration * (1 - pausedProgress.current);

    // Continue animation from paused position
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: remainingDuration,
      useNativeDriver: false,
    }).start((finished) => {
      console.log('⏰ Progress animation finished:', {
        finished,
        isPaused,
        isNavigating,
        manualNavigationMode,
        currentNoticeIndex,
        currentAttachmentIndex,
        totalNotices: allNotices.length,
        currentNoticeAttachments: currentNotice?.attachments?.length || 0,
      });
      isTimerRunning.current = false;
      pausedProgress.current = 0; // Reset paused progress

      // Only auto-advance if we're not navigating, not paused, and animation completed naturally
      if (
        finished &&
        !isPausedRef.current &&
        !isNavigating &&
        !isNavigatingRef.current &&
        !manualNavigationMode
      ) {
        console.log('➡️ Auto-advancing to next from timer completion');
        advanceToNext();
      }
    });
  };

  const advanceToNext = () => {
    // Prevent rapid navigation
    if (isNavigatingRef.current) {
      console.log('⏸️ Navigation blocked - already navigating');
      return;
    }

    // Get current state from refs to avoid stale closures
    const currentNoticeIdx = currentNoticeIndexRef.current;
    const currentAttachmentIdx = currentAttachmentIndexRef.current;
    const currentNoticeForCheck =
      allNotices.length > 0 ? allNotices[currentNoticeIdx] : selectedNotice;

    console.log('➡️ advanceToNext called with fresh state:', {
      currentNoticeIdx,
      currentAttachmentIdx,
      allNoticesLength: allNotices.length,
      currentNoticeAttachments: currentNoticeForCheck?.attachments?.length || 0,
    });

    // Check if we're at the end of all stories
    const isAtLastAttachment =
      !currentNoticeForCheck?.attachments ||
      currentNoticeForCheck.attachments.length === 0 ||
      currentAttachmentIdx >= currentNoticeForCheck.attachments.length - 1;

    const isAtLastNotice = allNotices.length === 0 || currentNoticeIdx >= allNotices.length - 1;

    if (isAtLastAttachment && isAtLastNotice) {
      // End of all stories - stay on last item, don't auto close
      console.log('🔚 End of all stories - staying on last item');

      // Clear navigation flags and stop auto-advance
      setIsNavigating(false);
      isNavigatingRef.current = false;
      setManualNavigationMode(true); // Keep manual mode to prevent auto-advance

      // Stop any running timers
      if (progressTimer.current) {
        clearTimeout(progressTimer.current);
        progressTimer.current = null;
      }
      progressAnim.stopAnimation();
      isTimerRunning.current = false;

      return;
    }

    // Set navigation flags to prevent timer conflicts
    setIsNavigating(true);
    isNavigatingRef.current = true;
    setManualNavigationMode(true);

    // Immediately reset progress animation to prevent flash of full progress
    progressAnim.setValue(0);
    progressAnim.stopAnimation();

    // Use setTimeout to defer state updates and avoid insertion effect warnings
    setTimeout(() => {
      if (
        currentNoticeForCheck?.attachments &&
        currentNoticeForCheck.attachments.length > 0 &&
        currentAttachmentIdx < currentNoticeForCheck.attachments.length - 1
      ) {
        // Next attachment in current notice
        console.log('📎 Going to next attachment:', currentAttachmentIdx + 1);
        setCurrentAttachmentIndex(currentAttachmentIdx + 1);
      } else if (allNotices.length > 0 && currentNoticeIdx < allNotices.length - 1) {
        // Next notice
        console.log('📋 Going to next notice:', currentNoticeIdx + 1);
        setCurrentNoticeIndex(currentNoticeIdx + 1);
        setCurrentAttachmentIndex(0);
      }

      // Clear navigation flags after a longer delay to prevent animation conflicts
      setTimeout(() => {
        setIsNavigating(false);
        isNavigatingRef.current = false;
        setManualNavigationMode(false);
        // Resume timer after navigation completes with additional delay
        setTimeout(() => {
          resumeTimer();
        }, 200);
      }, 300);
    }, 0);
  };

  // Swipe-level notice navigation — jumps directly to the next/previous notice
  const goToNextNotice = () => {
    if (isNavigatingRef.current) return;
    if (allNotices.length === 0 || currentNoticeIndexRef.current >= allNotices.length - 1) {
      // Already at the last notice — stop cleanly and stay
      progressAnim.stopAnimation();
      progressAnim.setValue(0);
      isTimerRunning.current = false;
      setManualNavigationMode(true);
      return;
    }

    // Synchronously stop all animation and clear timer state
    if (progressTimer.current) {
      clearTimeout(progressTimer.current);
      progressTimer.current = null;
    }
    progressAnim.stopAnimation();
    progressAnim.setValue(0);
    pausedProgress.current = 0;
    isTimerRunning.current = false;

    // Clear the 5-second time-block NOW so the useEffect won't be gated when flags release
    lastManualNavigationTime.current = 0;

    // Batch all state changes into a single render: navigation flags + new indices
    isNavigatingRef.current = true;
    setIsNavigating(true);
    setManualNavigationMode(true);
    setCurrentNoticeIndex(currentNoticeIndexRef.current + 1);
    setCurrentAttachmentIndex(0);

    // Release navigation flags — useEffect fires with fresh notice closures and starts timer
    setTimeout(() => {
      isNavigatingRef.current = false;
      setIsNavigating(false);
      setManualNavigationMode(false);
    }, 300);
  };

  const goToPreviousNotice = () => {
    if (isNavigatingRef.current) return;

    if (allNotices.length === 0 || currentNoticeIndexRef.current <= 0) {
      // At the very first notice — go back
      if (returnToScreen) {
        navigation.navigate(returnToScreen as any);
      } else {
        navigation.goBack();
      }
      return;
    }

    // Synchronously stop all animation and clear timer state
    if (progressTimer.current) {
      clearTimeout(progressTimer.current);
      progressTimer.current = null;
    }
    progressAnim.stopAnimation();
    progressAnim.setValue(0);
    pausedProgress.current = 0;
    isTimerRunning.current = false;

    // Clear the 5-second time-block NOW so the useEffect won't be gated when flags release
    lastManualNavigationTime.current = 0;

    // Batch all state changes into a single render: navigation flags + new indices
    isNavigatingRef.current = true;
    setIsNavigating(true);
    setManualNavigationMode(true);
    setCurrentNoticeIndex(currentNoticeIndexRef.current - 1);
    setCurrentAttachmentIndex(0);

    // Release navigation flags — useEffect fires with fresh notice closures and starts timer
    setTimeout(() => {
      isNavigatingRef.current = false;
      setIsNavigating(false);
      setManualNavigationMode(false);
    }, 300);
  };

  const goToPrevious = () => {
    // Prevent rapid navigation
    if (isNavigatingRef.current) {
      console.log('⏸️ Navigation blocked - already navigating');
      return;
    }

    console.log('⬅️ goToPrevious called', {
      currentAttachmentIndex,
      currentNoticeIndex,
      allNoticesLength: allNotices.length,
      currentNoticeAttachments: currentNotice?.attachments?.length || 0,
    });

    // Set navigation flags to prevent timer conflicts
    setIsNavigating(true);
    isNavigatingRef.current = true;
    setManualNavigationMode(true);

    // Immediately reset progress animation to prevent flash of full progress
    progressAnim.setValue(0);
    progressAnim.stopAnimation();

    // Use setTimeout to defer state updates and avoid insertion effect issues
    setTimeout(() => {
      if (
        currentNotice?.attachments &&
        currentNotice.attachments.length > 0 &&
        currentAttachmentIndex > 0
      ) {
        // Previous attachment in current notice
        console.log('📎 Going to previous attachment:', currentAttachmentIndex - 1);
        setCurrentAttachmentIndex(currentAttachmentIndex - 1);
      } else if (allNotices.length > 0 && currentNoticeIndex > 0) {
        // Previous notice
        const prevNoticeIndex = currentNoticeIndex - 1;
        const prevNotice = allNotices[prevNoticeIndex];
        console.log(
          '📋 Going to previous notice:',
          prevNoticeIndex,
          'with attachments:',
          prevNotice?.attachments?.length || 0
        );
        setCurrentNoticeIndex(prevNoticeIndex);
        // Set to the last attachment of the previous notice (or 0 for text-only)
        const lastAttachmentIndex =
          prevNotice?.attachments && prevNotice.attachments.length > 0
            ? prevNotice.attachments.length - 1
            : 0;
        console.log('📎 Setting attachment index to:', lastAttachmentIndex);
        setCurrentAttachmentIndex(lastAttachmentIndex);
      } else {
        // At the very beginning - go back to feed
        console.log('🔙 At beginning - going back to feed');

        // Use setTimeout to avoid useInsertionEffect warning
        setTimeout(() => {
          if (returnToScreen) {
            // Navigate to specific screen if provided
            console.log('🔄 Returning to specified screen:', returnToScreen);
            navigation.navigate(returnToScreen as any);
          } else {
            // Default behavior - go back
            navigation.goBack();
          }
        }, 0);
        return; // Exit early
      }

      // Clear navigation flags after a longer delay to prevent animation conflicts
      setTimeout(() => {
        setIsNavigating(false);
        isNavigatingRef.current = false;
        setManualNavigationMode(false);
        // Resume timer after navigation completes with additional delay
        setTimeout(() => {
          resumeTimer();
        }, 200);
      }, 300);
    }, 0);
  };

  const handleTouchStart = (event: any) => {
    const touch = event.nativeEvent.touches[0];
    touchStart.current = {
      x: touch.pageX,
      y: touch.pageY,
      time: Date.now(),
    };

    // Start long press timer
    longPressTimer.current = setTimeout(() => {
      pauseTimer();
    }, 200); // 200ms for long press detection
  };

  const handleTouchEnd = (event: any) => {
    const touch = event.nativeEvent.changedTouches[0];
    const deltaX = touch.pageX - touchStart.current.x;
    const deltaY = touch.pageY - touchStart.current.y;
    const deltaTime = Date.now() - touchStart.current.time;

    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // Resume if was paused from long press
    if (isPaused) {
      resumeTimer();
      return;
    }

    // Check for swipe down to exit
    if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY > 100 && deltaTime < 500) {
      console.log('👇 Swipe down detected - exiting story view');

      // Clear all timers and states smoothly
      if (progressTimer.current) {
        clearTimeout(progressTimer.current);
        progressTimer.current = null;
      }
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      progressAnim.stopAnimation(() => {
        isTimerRunning.current = false;
        isNavigatingRef.current = false;
      });

      if (returnToScreen) {
        // Navigate to specific screen if provided
        console.log('🔄 Swipe down - returning to specified screen:', returnToScreen);
        navigation.navigate(returnToScreen as any);
      } else {
        // Default behavior - go back
        navigation.goBack();
      }
      return;
    }

    // Check for horizontal swipes — jump between notices (story-level navigation)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30 && deltaTime < 500) {
      if (deltaX > 0) {
        // Swipe right - go to previous notice
        console.log('👈 Swipe right detected - going to previous notice');
        goToPreviousNotice();
      } else {
        // Swipe left - go to next notice
        console.log('👉 Swipe left detected - going to next notice');
        goToNextNotice();
      }
      return;
    }

    // Handle tap left/right for navigation (if not a swipe)
    if (Math.abs(deltaX) < 20 && Math.abs(deltaY) < 20 && deltaTime < 300) {
      const tapX = touch.pageX;
      const isLeftTap = tapX < screenWidth / 2;

      if (isLeftTap) {
        console.log('👆 Left tap detected - going to previous');
        goToPrevious();
      } else {
        console.log('👆 Right tap detected - going to next');
        advanceToNext();
      }
    }
  };

  // Start timer when notice changes - with a small delay to avoid insertion effect issues
  useEffect(() => {
    // Don't start timer if we're currently navigating, in manual mode, or paused
    if (isNavigating || manualNavigationMode || isPaused) {
      console.log('⏸️ Timer start blocked:', { isNavigating, manualNavigationMode, isPaused });
      return;
    }

    console.log('🔄 Starting timer for:', {
      currentNoticeIndex,
      currentAttachmentIndex,
      isNavigating,
      manualNavigationMode,
    });

    // Clear any existing timer first
    if (progressTimer.current) {
      clearTimeout(progressTimer.current);
      progressTimer.current = null;
    }

    // Add longer delay after navigation to prevent immediate timer start and animation conflicts
    const delay = isNavigating ? 1500 : 500; // Increased delays to prevent shaking

    const timeoutId = setTimeout(() => {
      // Double-check that we're still allowed to start timer
      if (isNavigating || manualNavigationMode || isPaused) {
        console.log('⏸️ Timer start blocked at timeout - state changed');
        return;
      }

      // Additional check: prevent timer start if manual navigation happened recently
      const timeSinceLastNavigation = Date.now() - lastManualNavigationTime.current;
      if (timeSinceLastNavigation < 5000) {
        // 5 seconds
        console.log(
          '⏸️ Timer start blocked at timeout - recent manual navigation:',
          timeSinceLastNavigation,
          'ms ago'
        );
        return;
      }

      console.log('⏰ Timer timeout completed, starting progress timer');
      startProgressTimer();
    }, delay);

    return () => {
      console.log('🧹 Cleaning up timer effect');
      clearTimeout(timeoutId);
      if (progressTimer.current) {
        clearTimeout(progressTimer.current);
        progressTimer.current = null;
      }
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };
  }, [currentNoticeIndex, currentAttachmentIndex, isNavigating, manualNavigationMode, isPaused]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressTimer.current) {
        clearTimeout(progressTimer.current);
        progressTimer.current = null;
      }
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      isTimerRunning.current = false;
      isNavigatingRef.current = false;
    };
  }, []);

  // Calculate total progress segments — scoped to the current notice only
  const getTotalSegments = () => {
    if (currentNotice?.attachments && currentNotice.attachments.length > 0) {
      return currentNotice.attachments.length;
    }
    return 1; // Text-only notice
  };

  const getCurrentSegmentIndex = () => {
    return currentAttachmentIndex;
  };

  const totalSegments = getTotalSegments();
  const currentSegmentIndex = getCurrentSegmentIndex();

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      <SafeAreaView className="flex-1 bg-white">
        {/* Story Progress Indicators */}
        <View className="bg-white px-4 pb-2 pt-4">
          <View className="mb-4 flex-row gap-2">
            {Array.from({ length: totalSegments }).map((_, index) => (
              <View key={index} className="h-1 flex-1 overflow-hidden rounded-full bg-gray-200 min-w-0">
                {index < currentSegmentIndex ? (
                  // Completed segments
                  <View className="h-full rounded-full bg-primary" />
                ) : index === currentSegmentIndex ? (
                  // Current segment with animated progress
                  <Animated.View
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                        extrapolate: 'clamp',
                      }),
                    }}
                  />
                ) : (
                  // Future segments remain empty (gray background)
                  <View className="h-full rounded-full bg-gray-200" />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Header with Navigation Arrows */}
        <View className="bg-white px-4 pb-4" style={{ zIndex: 999 }}>
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => {
                console.log('🔙 Back button TouchableOpacity pressed');
                // Reset timer state during navigation
                resetTimerState();
                goToPrevious();
              }}
              className="mr-4 rounded-full bg-gray-100 p-3"
              activeOpacity={0.7}
              style={{ zIndex: 1000 }}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
              <Ionicons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>

            <View className="flex-1">
              <Text className="font-oxanium-bold text-2xl text-text-primary">Notices</Text>
              {/* {currentNotice?.attachments && currentNotice.attachments.length > 1 && (
                <Text className="mt-1 font-oxanium text-xs text-gray-400">
                  Attachment {currentAttachmentIndex + 1} of {currentNotice.attachments.length}
                </Text>
              )} */}
            </View>

            <TouchableOpacity
              onPress={() => {
                console.log('❌ Close button pressed - exiting story view');

                // Clear all timers and states smoothly
                if (progressTimer.current) {
                  clearTimeout(progressTimer.current);
                  progressTimer.current = null;
                }
                if (longPressTimer.current) {
                  clearTimeout(longPressTimer.current);
                  longPressTimer.current = null;
                }
                progressAnim.stopAnimation(() => {
                  isTimerRunning.current = false;
                  isNavigatingRef.current = false;
                });

                // Force immediate navigation
                if (returnToScreen) {
                  // Navigate to specific screen if provided
                  console.log('🔄 Close button - returning to specified screen:', returnToScreen);
                  navigation.navigate(returnToScreen as any);
                } else {
                  // Default behavior - go back
                  navigation.goBack();
                }
              }}
              className="ml-4 rounded-full bg-primary p-3"
              activeOpacity={0.7}
              style={{ zIndex: 1001 }}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Story Content - Fullscreen with touch interaction */}
        <View className="flex-1 bg-white">
          {currentNotice ? (
            /* Display current notice */
            <View className="flex-1 bg-white">
              {/* Story Content with Touch Interaction */}
              <View
                className="flex-1 justify-center"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}>
                {currentNotice.attachments && currentNotice.attachments.length > 0 ? (
                  // Notice with attachments
                  currentNotice.attachments[currentAttachmentIndex]?.file_type ===
                  'application/pdf' ? (
                    /* PDF Download */
                    <View className="flex-1 items-center justify-center bg-primary-50 px-6">
                      <Ionicons name="document-text" size={80} color="#3C9D9B" />
                      <Text className="mt-6 px-4 text-center font-oxanium-bold text-2xl text-primary-600">
                        PDF Document
                      </Text>
                      <Text className="mt-3 px-4 text-center font-oxanium-bold text-base text-primary-500">
                        {currentNotice.attachments[currentAttachmentIndex]?.file_name}
                      </Text>
                      
                      {/* Download Button */}
                      <View className="mt-8 w-full max-w-sm">
                        <PDFDownloader
                          pdfUri={currentNotice.attachments[currentAttachmentIndex]?.file || currentNotice.attachments[currentAttachmentIndex]?.file_url}
                          fileName={currentNotice.attachments[currentAttachmentIndex]?.file_name}
                          title="Download PDF"
                          size="large"
                          variant="primary"
                        />
                      </View>
                      
                      {/* Notice Title */}
                      {currentNotice.title && (
                        <View className="mt-6 rounded-lg bg-white/80 p-4">
                          <Text className="text-center font-oxanium-bold text-base text-gray-800">
                            {currentNotice.title}
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    /* Image Display - Full Screen */
                    <View className="flex-1 justify-center bg-white">
                      <ImageWithFallback
                        file={currentNotice.attachments[currentAttachmentIndex]?.file}
                        file_url={currentNotice.attachments[currentAttachmentIndex]?.file_url}
                        fileName={currentNotice.attachments[currentAttachmentIndex]?.file_name}
                        debugName={`ShowNoticeBoard-${currentNotice.id}`}
                        className="w-full"
                        resizeMode="contain"
                        containerClassName="w-full h-full"
                      />
                      {/* Show notice text overlay on images if available */}
                      {currentNotice.title && (
                        <View className="absolute bottom-8 left-4 right-4 rounded-lg bg-black bg-opacity-70 p-4">
                          <Text className="text-center font-oxanium-bold text-lg text-white">
                            {currentNotice.title}
                          </Text>
                        </View>
                      )}
                    </View>
                  )
                ) : (
                  /* Text-only Notice */
                  <View className="flex-1 items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-8">
                    <View className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
                      <Ionicons
                        name="document-text"
                        size={48}
                        color="#4f46e5"
                        className="mb-4 self-center"
                      />
                      <Text className="mb-4 text-center font-oxanium-bold text-2xl text-gray-800">
                        Notice #{currentNotice.id}
                      </Text>
                      {currentNotice.title && (
                        <Text className="text-center font-oxanium text-lg leading-relaxed text-gray-700">
                          {currentNotice.title}
                        </Text>
                      )}
                      {currentNotice.description && (
                        <Text className="mt-4 text-center font-oxanium text-sm leading-relaxed text-gray-600">
                          {currentNotice.description}
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </View>

              {/* Navigation Hints */}

              {/* {allNotices.length > 0
                ? currentNoticeIndex === allNotices.length - 1 &&
                  currentAttachmentIndex ===
                    Math.max((currentNotice?.attachments?.length || 1) - 1, 0) && (
                    <View className="absolute right-4 top-1/2 rounded-lg bg-black bg-opacity-50 p-3">
                      <Text className="text-center font-oxanium text-xs text-white">
                        End of stories - swipe down to exit
                      </Text>
                    </View>
                  )
                : currentAttachmentIndex ===
                    Math.max((currentNotice?.attachments?.length || 1) - 1, 0) && (
                    <View className="absolute right-4 top-1/2 rounded-lg bg-black bg-opacity-50 p-3">
                      <Text className="text-center font-oxanium text-xs text-white">
                        End of story - swipe down to exit
                      </Text>
                    </View>
                  )} */}
            </View>
          ) : (
            /* No notice selected */
            <View className="flex-1 items-center justify-center bg-white">
              <Ionicons name="document-text" size={64} color="#9CA3AF" />
              <Text className="mt-4 font-oxanium text-lg text-text-secondary">
                No notice selected
              </Text>
              <Text className="mt-2 px-8 text-center font-oxanium text-sm text-text-secondary">
                Please select a notice from the notice board to view its details.
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
