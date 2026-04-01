import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Image,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TermsAndPrivacyModal } from '../../../components/TermsAndPrivacyModal';
import SuccessPopup from '../../../../components/SuccessPopup';
import { useAppSelector, useAppDispatch } from '../../../store/hooks';
import { getBackendURL } from '../../../config/environment';
import { enhancedFetch } from '../../../utils/networkUtils';
import { updateUserData } from '../../../store/slices/authSlice';

type RootStackParamList = {
  InfoAndSupport: undefined;
  Dashboard: undefined;
};

type TermsAndPrivacyNavigationProp = StackNavigationProp<RootStackParamList, 'InfoAndSupport'>;

export function TermsAndPrivacy() {
  const navigation = useNavigation<TermsAndPrivacyNavigationProp>();
  const dispatch = useAppDispatch();
  const { accessToken, user } = useAppSelector((state) => state.auth);
  const [isChecked, setIsChecked] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Block back button if terms not accepted (mandatory acceptance during login flow)
  useEffect(() => {
    const isFromLogin = !user?.termsAccepted; // If terms not accepted, user is from login flow
    
    if (isFromLogin) {
      const onBackPress = () => {
        console.log('🚫 Back button blocked - Terms acceptance is mandatory');
        return true; // Block back navigation
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => backHandler.remove();
    }
  }, [user?.termsAccepted]);

  const handleContinue = async () => {
    if (isChecked && accessToken) {
      setIsLoading(true);
      try {
        const baseUrl = getBackendURL();
        const response = await enhancedFetch(
          `${baseUrl}/user/accept_terms/`,
          {
            method: 'POST',
            body: JSON.stringify({
              terms_version: '1.0'
            }),
          },
          10000,
          accessToken
        );

        if (response.ok) {
          // Update Redux state to reflect terms acceptance
          dispatch(updateUserData({ termsAccepted: true }));
          setIsSuccessModalVisible(true);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Error accepting terms:', errorData);
          // You can show an error message here if needed
        }
      } catch (error) {
        console.error('Error accepting terms:', error);
        // You can show an error message here if needed
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleViewAndRead = () => {
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
  };

  const handleSuccessModalClose = () => {
    setIsSuccessModalVisible(false);
    
    // Check if user was coming from login flow (terms not previously accepted)
    // If so, navigate to Dashboard and reset navigation stack
    const isFromLogin = user?.termsAccepted; // Now it's true after acceptance
    
    if (isFromLogin) {
      // Reset navigation stack and navigate to Dashboard (prevent going back to login)
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Dashboard' as any }],
        })
      );
    } else {
      // If accessed from settings, just go back
      navigation.goBack();
    }
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      
      <SafeAreaView className="flex-1 bg-white">
        {/* Logo Section - Centered */}
        <View className="items-center mt-10">
          <Image
            source={require('../../../../assets/Logo.png')}
            className="w-48 h-20"
            resizeMode="contain"
          />
        </View>

        {/* Main Content - Centered */}
        <View className="flex-1 justify-center px-6 mb-20">
          {/* Title */}
          <Text className="font-oxanium-bold text-3xl text-gray-900 text-center mb-3">
            Terms & Privacy
          </Text>

          {/* Subtitle */}
          <Text className="font-lato text-base text-gray-600 text-center mb-8">
            Please read and accept to continue
          </Text>

          {/* View and Read Section */}
          <TouchableOpacity
            onPress={handleViewAndRead}
            className="border border-primary rounded-lg p-4 mb-6"
            activeOpacity={0.7}
          >
            <Text className="font-lato-bold text-lg text-gray-900 mb-1">
              View and Read
            </Text>
            <Text className="font-lato text-base text-gray-700">
              Terms & Conditions and Privacy Policy
            </Text>
          </TouchableOpacity>

          {/* Checkbox Section */}
          <TouchableOpacity
            onPress={() => setIsChecked(!isChecked)}
            className="flex-row items-start mb-8"
            activeOpacity={0.7}
          >
            <View
              className={`w-6 h-6 rounded border-2 mr-3 items-center justify-center mt-0.5 ${
                isChecked
                  ? 'border-primary bg-primary'
                  : 'border-primary bg-transparent'
              }`}
            >
              {isChecked && (
                <Ionicons name="checkmark" size={16} color="white" />
              )}
            </View>
            <View className="flex-1">
              <Text className="font-lato text-base text-gray-900 leading-6">
                I acknowledge that I have read and agree to the Terms & Conditions and Privacy Policy of Estate Link.
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Continue Button - Fixed at bottom */}
        <View className="px-6 pb-6">
          <TouchableOpacity
            onPress={handleContinue}
            disabled={!isChecked || isLoading}
            className={`rounded-lg py-4 flex-row items-center justify-center ${
              isChecked && !isLoading ? 'bg-primary' : 'bg-gray-300'
            }`}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="font-lato-bold text-lg text-white text-center">
                Continue
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Terms and Privacy Modal */}
      <TermsAndPrivacyModal
        visible={isModalVisible}
        onClose={handleCloseModal}
      />

      {/* Success Modal */}
      <SuccessPopup
        visible={isSuccessModalVisible}
        onClose={handleSuccessModalClose}
        title="Congratulations!"
        message="You have successfully accepted the Terms & Conditions and Privacy Policy."
        buttonText="OK"
      />
    </View>
  );
}

