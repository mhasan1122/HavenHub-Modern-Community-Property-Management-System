import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useProfile } from '../../../hooks/useProfile';
import { Button } from '../../../components/Button';
import SuccessPopup from '../../../../components/SuccessPopup';
import ErrorPopup from '../../../../components/ErrorPopup';

type RootStackParamList = {
  ProfileManagementSettings: undefined;
  ProfileManagement: undefined;
};

type EditLoginInfoNavigationProp = StackNavigationProp<RootStackParamList, 'ProfileManagementSettings'>;

// Validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^(018|019|013|017|015|016|014)\d{8}$/;

export function EditLoginInfo() {
  const navigation = useNavigation<EditLoginInfoNavigationProp>();
  const { profile, loading, updateUserProfile, refetchProfile } = useProfile();
  
  const [method, setMethod] = useState<'email' | 'contact'>('email');
  const [deliveryMethod, setDeliveryMethod] = useState('');
  const [updating, setUpdating] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [validationError, setValidationError] = useState('');
  const [hasChanged, setHasChanged] = useState(false);

  // Initialize form data from profile
  useEffect(() => {
    if (profile) {
      if (profile.login_email) {
        setMethod('email');
        setDeliveryMethod(profile.login_email);
      } else if (profile.login_contact) {
        setMethod('contact');
        setDeliveryMethod(profile.login_contact);
      }
    }
  }, [profile]);

  // Check if form has changed
  useEffect(() => {
    if (!profile) return;
    
    const originalValue = method === 'email' ? profile.login_email : profile.login_contact;
    setHasChanged(deliveryMethod !== originalValue);
  }, [deliveryMethod, method, profile]);

  const handleMethodChange = (newMethod: 'email' | 'contact') => {
    setMethod(newMethod);
    setValidationError('');
    
    // Load the appropriate value from profile
    if (profile) {
      if (newMethod === 'email') {
        setDeliveryMethod(profile.login_email || '');
      } else {
        setDeliveryMethod(profile.login_contact || '');
      }
    }
  };

  const validateInput = (): boolean => {
    if (!deliveryMethod.trim()) {
      setValidationError(method === 'email' ? 'Email required' : 'Contact required');
      return false;
    }

    if (method === 'email') {
      if (!emailRegex.test(deliveryMethod)) {
        setValidationError('Email Invalid format');
        return false;
      }
    } else {
      if (!phoneRegex.test(deliveryMethod)) {
        setValidationError('Contact Invalid format');
        return false;
      }
    }

    return true;
  };

  const handleSend = async () => {
    if (!validateInput()) {
      return;
    }

    try {
      setUpdating(true);
      
      // Update profile with new login credential
      await updateUserProfile({
        delivery_method: deliveryMethod,
      });
      
      // Refetch profile to ensure we have the latest data
      await refetchProfile();
      
      // Show success popup
      setShowSuccessPopup(true);
      
    } catch (error) {
      console.error('❌ Login info update error:', error);
      
      let errorMsg = 'Failed to update login info. Please try again.';
      
      if (error instanceof Error) {
        errorMsg = error.message;
      }
      
      setErrorMessage(errorMsg);
      setShowErrorPopup(true);
    } finally {
      setUpdating(false);
    }
  };

  const handleSuccessPopupClose = () => {
    setShowSuccessPopup(false);
    navigation.navigate('ProfileManagement');
  };

  // Show loading state while profile data is being fetched
  if (loading && !profile) {
    return (
      <View className="flex-1 bg-white">
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center px-4 py-4 border-b border-gray-100">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="flex-row items-center"
            >
              <Ionicons name="arrow-back" size={24} color="#3C9D9B" />
              <Text className="font-oxanium-bold text-2xl text-gray-900 ml-3">Edit Login Info</Text>
            </TouchableOpacity>
          </View>
          
          <View className="flex-1 justify-center items-center">
            <Text className="font-lato text-xl text-gray-600">Loading profile data...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      
      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center px-4 py-4 border-b border-gray-100">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="flex-row items-center"
          >
            <Ionicons name="arrow-back" size={24} color="#3C9D9B" />
            <Text className="font-oxanium-bold text-2xl text-gray-900 ml-3">Edit Login Info</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          className="flex-1 px-6 pt-6" 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Section Title */}
          <Text className="font-lato-bold text-xl text-gray-900 mb-4">
            Send User ID & Password
          </Text>

          {/* Radio buttons for Email or Phone Number Selection */}
          <View className="flex-row items-center mb-6 gap-8">
            <TouchableOpacity
              className="flex-row items-center"
              onPress={() => handleMethodChange('email')}
              disabled={updating}
            >
              <View className="w-5 h-5 rounded-full border-2 border-primary mr-2 items-center justify-center">
                {method === 'email' && (
                  <View className="w-3 h-3 rounded-full bg-primary" />
                )}
              </View>
              <Text className="font-lato text-xl text-gray-900">Email</Text>
            </TouchableOpacity>

            {/* Phone Number section commented out */}
            {/* <TouchableOpacity
              className="flex-row items-center"
              onPress={() => handleMethodChange('contact')}
              disabled={updating}
            >
              <View className="w-5 h-5 rounded-full border-2 border-primary mr-2 items-center justify-center">
                {method === 'contact' && (
                  <View className="w-3 h-3 rounded-full bg-primary" />
                )}
              </View>
              <Text className="font-lato text-xl text-gray-900">Phone Number</Text>
            </TouchableOpacity> */}
          </View>

          {/* Input Field */}
          <View className="mb-6">
            <TextInput
              value={deliveryMethod}
              onChangeText={(text) => {
                setDeliveryMethod(text);
                setValidationError('');
              }}
              placeholder={method === 'email' ? 'Enter email address' : 'Enter phone number'}
              keyboardType={method === 'contact' ? 'phone-pad' : 'email-address'}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!updating}
              className={`px-4 py-3 rounded-lg font-lato text-xl text-gray-900 border ${
                validationError 
                  ? 'bg-red-50 border-red-300' 
                  : 'bg-gray-100 border-gray-300'
              }`}
              placeholderTextColor="#9CA3AF"
            />
            {validationError ? (
              <Text className="text-red-500 font-lato text-lg mt-2">
                {validationError}
              </Text>
            ) : null}
          </View>

          {/* Send Button */}
          <Button
            title={updating ? 'Sending...' : 'Send'}
            onPress={handleSend}
            disabled={updating || loading || !hasChanged}
            loading={updating}
            variant="primary"
            size="large"
            fullWidth={true}
            className="mb-8"
          />
        </ScrollView>
      </SafeAreaView>

      {/* Success Popup */}
      <SuccessPopup
        visible={showSuccessPopup}
        onClose={handleSuccessPopupClose}
        title="Success!"
        message="Login credentials have been sent successfully."
        buttonText="OK"
      />

      {/* Error Popup */}
      <ErrorPopup
        visible={showErrorPopup}
        onClose={() => setShowErrorPopup(false)}
        title="Error!"
        message={errorMessage}
        buttonText="OK"
      />
    </View>
  );
}
