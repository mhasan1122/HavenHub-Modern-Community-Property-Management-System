import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppSelector } from '../../store/hooks';
import { Button } from '../../components';
import SuccessPopup from '../../../components/SuccessPopup';
import { getBackendURL } from '../../config/environment';

type RootStackParamList = {
  ReportBulletin: { bulletinId: string };
  Dashboard: 
    | {
        screen: 'AnnouncementNotice';
        params: { activeTab?: string };
      }
    | undefined;
};

type ReportBulletinRouteProp = RouteProp<RootStackParamList, 'ReportBulletin'>;
type ReportBulletinNavigationProp = StackNavigationProp<RootStackParamList, 'ReportBulletin'>;

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or Advertising' },
  { value: 'harassment', label: 'Harassment or Hate Speech' },
  { value: 'pornographic', label: 'Pornographic or Explicit Content' },
  { value: 'violence', label: 'Violence or Harmful Content' },
  { value: 'illegal', label: 'Illegal Activity' },
  { value: 'privacy', label: 'Privacy Violation' },
  { value: 'false_info', label: 'False Information / Misinformation' },
  { value: 'inappropriate', label: 'Inappropriate / Off-Topic' },
  { value: 'other', label: 'Other' },
];

export default function ReportBulletin() {
  const navigation = useNavigation<ReportBulletinNavigationProp>();
  const route = useRoute<ReportBulletinRouteProp>();
  const { bulletinId } = route.params;
  
  const { accessToken } = useAppSelector((state) => state.auth);
  const API_BASE_URL = getBackendURL();

  const [selectedReason, setSelectedReason] = useState<string>('');
  const [details, setDetails] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);
  const previousScrollY = useRef<number>(0);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      // Scroll to end when keyboard shows
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      // Restore previous scroll position when keyboard hides
      setTimeout(() => {
        if (previousScrollY.current >= 0) {
          scrollViewRef.current?.scrollTo({
            y: previousScrollY.current,
            animated: true,
          });
        }
      }, 100);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Required Field', 'Please select a reason for reporting this bulletin.');
      return;
    }

    setIsSubmitting(true);

    try {
      const url = `${API_BASE_URL}/api/bulletins/${bulletinId}/report/`;
      console.log('📡 Submitting report to:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          reason: selectedReason,
          details: details.trim() || undefined,
        }),
      });

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      let data: any = {};

      if (contentType && contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error('Failed to parse JSON response:', jsonError);
          throw new Error('Invalid response from server');
        }
      } else {
        // Response is not JSON (likely HTML error page)
        const textResponse = await response.text();
        console.error('Non-JSON response received:', textResponse.substring(0, 200));
        
        if (response.status === 404) {
          throw new Error('Report endpoint not found. Please check the API configuration.');
        } else if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        } else if (response.status === 403) {
          throw new Error('You do not have permission to report this bulletin.');
        } else {
          throw new Error(`Server error (${response.status}). Please try again later.`);
        }
      }

      if (!response.ok) {
        throw new Error(data.error || data.details || data.message || 'Failed to submit report');
      }

      // Show success popup
      setShowSuccessPopup(true);
    } catch (error: any) {
      console.error('Error submitting report:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to submit report. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessPopup(false);
    // Navigate back to Dashboard (BottomTabNavigator) and then to AnnouncementNotice tab with params
    navigation.navigate('Dashboard', {
      screen: 'AnnouncementNotice',
      params: { activeTab: 'bulletin' }
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
        <TouchableOpacity
          onPress={() => navigation.navigate('Dashboard', {
            screen: 'AnnouncementNotice',
            params: { activeTab: 'bulletin' }
          })}
          className="p-2 -ml-2"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="font-lato-bold text-xl text-gray-900">Submit Report</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        enabled={Platform.OS === 'ios'}
      >
        <ScrollView 
          ref={scrollViewRef}
          className="flex-1" 
          contentContainerStyle={{ 
            paddingHorizontal: 16, 
            paddingVertical: 24, 
            paddingBottom: Platform.OS === 'android' ? 300 : 24,
            flexGrow: 1 
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
          scrollEnabled={true}
          onScroll={(event) => {
            // Continuously track scroll position
            // We'll save it to previousScrollY when input is focused
            const currentY = event.nativeEvent.contentOffset.y;
            if (!textInputRef.current?.isFocused()) {
              previousScrollY.current = currentY;
            }
          }}
          scrollEventThrottle={16}
          onContentSizeChange={() => {
            if (textInputRef.current?.isFocused()) {
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }
          }}
        >
          {/* Report Options */}
          <View className="mb-6">
            {REPORT_REASONS.map((reason, index) => (
              <View key={reason.value}>
                <TouchableOpacity
                  onPress={() => setSelectedReason(reason.value)}
                  className="flex-row items-center justify-between py-4 px-2"
                  activeOpacity={0.7}
                >
                  <Text className="flex-1 font-lato-bold text-base text-gray-900">
                    {reason.label}
                  </Text>
                  <View className="ml-3">
                    <View
                      className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                        selectedReason === reason.value
                          ? 'border-primary bg-primary'
                          : 'border-gray-400 bg-white'
                      }`}
                    >
                      {selectedReason === reason.value && (
                        <View className="w-2.5 h-2.5 rounded-full bg-white" />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
                {index < REPORT_REASONS.length - 1 && (
                  <View className="h-px bg-gray-200 mr-10" />
                )}
              </View>
            ))}
          </View>

          {/* Optional Details */}
          <View className="mb-6">
            <TextInput
              ref={textInputRef}
              value={details}
              onChangeText={setDetails}
              placeholder="Optional Details"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              className="px-4 py-3 rounded-lg border border-gray-300 bg-white font-lato text-base text-gray-900 min-h-[100px]"
              style={{
                textAlignVertical: 'top',
              }}
              maxLength={1000}
              onFocus={() => {
                // The onScroll handler has already saved the current position to previousScrollY
                // Now scroll to show the input when keyboard appears
                if (Platform.OS === 'android') {
                  // For Android, wait a bit longer for keyboard to show
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 500);
                } else {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 300);
                }
              }}
            />
          </View>

          {/* Submit Button */}
          <Button
            title={isSubmitting ? 'Submitting...' : 'Submit Report'}
            onPress={handleSubmit}
            disabled={!selectedReason || isSubmitting}
            loading={isSubmitting}
            variant={selectedReason && !isSubmitting ? 'primary' : 'outline'}
            size="large"
            fullWidth={true}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Popup */}
      <SuccessPopup
        visible={showSuccessPopup}
        onClose={handleSuccessClose}
        title="Report Submitted"
        message="Thank you for your report. We will review it and take appropriate action."
        buttonText="OK"
      />
    </SafeAreaView>
  );
}

