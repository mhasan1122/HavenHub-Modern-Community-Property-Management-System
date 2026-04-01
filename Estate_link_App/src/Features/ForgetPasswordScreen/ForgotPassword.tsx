import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StatusBar,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { ErrorMessage } from 'components';
import { Button } from '../../components/Button';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppDispatch, useAppSelector } from 'store/hooks';
import {
  requestOtp,
  clearState,
  clearAllState,
  setEmail,
  clearError,
  clearMessage,
} from 'store/slices/forgotPasswordSlice';
import { useFormValidation } from 'hooks/useFormValidation';
import { forgotPasswordSchema } from 'validation/schemas';

type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  PasswordReset: undefined;
  VerifyCode: undefined;
};

type ForgotPasswordScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ForgotPassword'>;

type RecoveryMethod = 'email';

export function ForgotPassword() {
  const { width, height } = useWindowDimensions();
  const navigation = useNavigation<ForgotPasswordScreenNavigationProp>();
  const dispatch = useAppDispatch();
  const { message, error, loading } = useAppSelector((state) => state.forgotPassword);

  console.log('ForgotPassword: Component rendered');

  const [selectedMethod, setSelectedMethod] = useState<RecoveryMethod>('email');
  const [contactInfo, setContactInfo] = useState('');
  const [contactInfoInlineError, setContactInfoInlineError] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Responsive dimensions
  const isSmallScreen = width < 375;

  // Keyboard event listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const {
    errors,
    validateForm,
    setFieldTouched,
    getFieldError,
    isFieldTouched,
    clearErrors,
    setFieldError,
  } = useFormValidation(forgotPasswordSchema);

  // Memoize navigation function to prevent infinite loops
  const navigateToVerifyCode = useCallback(() => {
    console.log('ForgotPassword: Navigating to VerifyCode');
    navigation.navigate('VerifyCode');
  }, [navigation]);

  const goBack = useCallback(() => {
    console.log('ForgotPassword: Going back to previous screen');
    // Clear any pending state before navigating
    dispatch(clearAllState());
    
    // Small delay to ensure state is cleared before navigation
    setTimeout(() => {
      // Use navigate instead of goBack to ensure proper navigation
      // This will navigate to Login screen even if there's no previous screen in stack
      navigation.navigate('Login');
    }, 50);
  }, [navigation, dispatch]);

  // Show success message and navigate to verify code
  useEffect(() => {
    if (message && !error) {
      // Only navigate to VerifyCode for OTP sent messages, not for password reset success
      if (message.includes('OTP sent')) {
        console.log('ForgotPassword: OTP sent successfully, message:', message);
        dispatch(clearMessage());
        // Small delay to ensure state is updated
        setTimeout(() => {
          console.log('ForgotPassword: Executing navigation to VerifyCode');
          navigateToVerifyCode();
        }, 100);
      } else if (message.includes('password has been successfully updated')) {
        // For password reset success, just clear the message and don't navigate
        console.log('ForgotPassword: Password reset success detected, clearing message');
        dispatch(clearMessage());
      }
    }
  }, [message, error, dispatch, navigateToVerifyCode]);

  // Clear errors when component unmounts or when method changes
  useEffect(() => {
    return () => {
      console.log('ForgotPassword: Component unmounting, clearing all state');
      // Only clear state on unmount, not during navigation
      // This prevents interference with navigation
      dispatch(clearAllState());
    };
  }, [dispatch]);

  const handleInputChange = useCallback(
    (value: string) => {
      setContactInfo(value);

      // Clear inline error when user starts typing
      if (contactInfoInlineError) {
        setContactInfoInlineError('');
      }

      // Clear Redux error when user starts typing
      if (error) {
        dispatch(clearError());
      }

      // Clear validation errors when user starts typing
      if (getFieldError('contactInfo')) {
        setFieldError('contactInfo', null);
      }
    },
    [contactInfoInlineError, error, dispatch, getFieldError, setFieldError]
  );

  const handleMethodChange = useCallback(
    (method: RecoveryMethod) => {
      console.log('ForgotPassword: Method changed to:', method);
      setSelectedMethod(method);
      // Clear errors when method changes
      clearErrors();
      dispatch(clearAllState()); // Clear all state when method changes
      setContactInfoInlineError('');
      setContactInfo(''); // Clear contact info when method changes
    },
    [clearErrors, dispatch]
  );

  const handleBlur = useCallback(() => {
    setFieldTouched('contactInfo', true);
    setKeyboardVisible(false);
  }, [setFieldTouched]);

  const handleFocus = useCallback(() => {
    setKeyboardVisible(true);
  }, []);

  const validateContactInfo = useCallback(
    (value: string, method: RecoveryMethod): string | null => {
      if (!value.trim()) {
        return 'Contact information is required';
      }

      if (method === 'email') {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(value)) {
          return 'Please enter a valid email address';
        }
      } else if (method === 'phone' || method === 'whatsapp') {
        const cleanedPhone = value.replace(/[^\d+]/g, '');
        if (cleanedPhone.startsWith('+')) {
          if (!/^\+[1-9]\d{6,14}$/.test(cleanedPhone)) {
            return 'Please enter a valid phone number';
          }
        } else {
          if (!/^[1-9]\d{6,14}$/.test(cleanedPhone)) {
            return 'Please enter a valid phone number';
          }
        }
      }

      return null;
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    console.log(
      'ForgotPassword: Submit button pressed with method:',
      selectedMethod,
      'contactInfo:',
      contactInfo
    );
    // Clear previous errors
    clearErrors();
    dispatch(clearAllState());
    setContactInfoInlineError('');

    // Inline validation: if contact info is empty, show an inline error
    if (!contactInfo.trim()) {
      console.log('ForgotPassword: Contact info is empty, showing inline error');
      setContactInfoInlineError('Contact information is required');
      return;
    }

    // Validate contact info format
    const validationError = validateContactInfo(contactInfo, selectedMethod);
    if (validationError) {
      console.log('ForgotPassword: Contact info validation failed:', validationError);
      setContactInfoInlineError(validationError);
      return;
    }

    // Validate form using schema
    const validation = await validateForm({
      contactInfo,
      method: selectedMethod,
    });

    if (!validation.isValid) {
      console.log('ForgotPassword: Form validation failed');
      return;
    }

    try {
      console.log('ForgotPassword: Dispatching requestOtp action for:', contactInfo);
      // Request OTP
      const result = await dispatch(requestOtp(contactInfo)).unwrap();

      // Only store email and proceed if OTP request was successful
      if (result && !result.error) {
        console.log('ForgotPassword: OTP request successful, storing email');
        dispatch(setEmail(contactInfo));
      } else {
        // If there's an error in the response
        console.log('ForgotPassword: OTP request failed with error:', result.error);
        setContactInfoInlineError(result.error || 'Failed to send OTP. Please try again.');
        return;
      }
    } catch (error: any) {
      // Handle AbortError specifically
      if (error.name === 'AbortError') {
        console.warn(
          'ForgotPassword: Request was aborted. This might be due to poor network connection or timeout.'
        );
        dispatch(clearAllState());
        setContactInfoInlineError('Request failed. Please check your connection and try again.');
      } else {
        // Handle other types of errors
        console.error('ForgotPassword: OTP request error:', error);
        dispatch(clearAllState());
        setContactInfoInlineError(
          error.message || 'An unexpected error occurred. Please try again.'
        );
      }
    }
  }, [contactInfo, selectedMethod, clearErrors, dispatch, validateForm, validateContactInfo]);

  const getPlaceholderText = useCallback(() => {
    switch (selectedMethod) {
      case 'email':
        return 'Enter Your Email Address';
      default:
        return 'Enter Your Contact Information';
    }
  }, [selectedMethod]);

  const getKeyboardType = useCallback(() => {
    switch (selectedMethod) {
      case 'email':
        return 'email-address';
      default:
        return 'default';
    }
  }, [selectedMethod]);

  const contactInfoError = getFieldError('contactInfo');
  const showContactInfoError = isFieldTouched('contactInfo') && contactInfoError;
  const isFormValid = contactInfo.trim() && !contactInfoError && !contactInfoInlineError;

  const RadioButton = ({
    selected,
    onPress,
    label,
  }: {
    selected: boolean;
    onPress: () => void;
    label: string;
  }) => (
    <TouchableOpacity className="flex-row items-center" onPress={onPress} disabled={loading}>
      <View className="w-6 h-6 rounded-full items-center justify-center border-2 border-primary bg-transparent mr-3">
        {selected && (
          <View className="w-3 h-3 rounded-full bg-primary" />
        )}
      </View>
      <Text className="font-oxanium-medium text-text-primary text-lg font-medium">
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 bg-white">
            
            {/* Header with Back Button */}
            <View className="flex-row items-center px-6 pb-6 pt-12">
              <TouchableOpacity className="flex-row items-center" onPress={goBack} disabled={loading}>
                <Ionicons name="chevron-back" size={20} color="#6B7280" className="mr-3" />
                <Text className="font-oxanium-medium text-text-secondary text-xl">
                  Back to login
                </Text>
              </TouchableOpacity>
            </View>

            {/* Main Container */}
            <View className="flex-1 px-6 pt-12">
                {/* Logo Section */}
                <View className={`items-center ${keyboardVisible ? 'mb-6' : 'mb-12'}`}>
                  <Image
                    source={require('../../../assets/Logo.png')}
                    className={`${keyboardVisible ? 'w-48 h-16 mb-4' : 'w-64 h-20 mb-8'}`}
                    resizeMode="contain"
                  />
                </View>

                {/* Title and Description */}
                <View className={`${keyboardVisible ? 'mb-6' : 'mb-10'}`}>
                  <Text className={`text-center font-oxanium-bold text-text-primary font-medium mb-4 leading-tight ${keyboardVisible ? 'text-3xl' : 'text-4xl'}`}>
                    Forgot your password?
                  </Text>

                  <Text className={`text-center font-oxanium-medium text-text-secondary font-normal leading-6 px-2 ${keyboardVisible ? 'text-base' : 'text-lg'}`}>
                    Don't worry, happens to all of us.{'\n'}Enter your email below to recover your password
                  </Text>
                </View>

                {/* Radio Button Options */}
                <View className={`w-full flex-row justify-start ${keyboardVisible ? 'mb-4' : 'mb-6'}`}>
                  <RadioButton
                    selected={selectedMethod === 'email'}
                    onPress={() => handleMethodChange('email')}
                    label="Email"
                  />
                </View>

                {/* Input Field */}
                <View className={`${keyboardVisible ? 'mb-4' : 'mb-8'}`}>
            <TextInput
              className={`h-16 rounded-xl border-2 border-primary bg-background-input font-oxanium-medium text-text-primary px-4 text-lg pt-2${
                showContactInfoError || contactInfoInlineError ? 'border-error mb-6' : 'border-border'
              }`}
              placeholder={getPlaceholderText()}
              placeholderTextColor="#9CA3AF"
              value={contactInfo}
              onChangeText={handleInputChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              keyboardType={getKeyboardType()}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              editable={!loading}
              autoCapitalize={selectedMethod === 'email' ? 'none' : 'none'}
              autoCorrect={false}
            />

            {/* Inline error message */}
            {contactInfoInlineError && (
              <ErrorMessage message={contactInfoInlineError} visible={true} />
            )}

            {/* Validation error message */}
            {showContactInfoError && <ErrorMessage message={contactInfoError} visible={true} />}

            {/* Redux Error Message */}
            {error && <ErrorMessage message={error} visible={true} />}
          </View>

                {/* Submit Button */}
                <View className={`${keyboardVisible ? 'mb-4' : 'mb-8'}`}>
                  <Button
                    title="Submit"
                    onPress={handleSubmit}
                    disabled={!isFormValid}
                    loading={loading}
                    variant={isFormValid ? 'primary' : 'outline'}
                    size={isSmallScreen ? 'medium' : 'large'}
                  />
                </View>

                {/* Bottom Link */}
                <View className={`flex-1 items-center justify-end ${keyboardVisible ? 'pb-4' : 'pb-8'}`}>
            <TouchableOpacity disabled={loading}>
              <Text className="font-oxanium-bold text-text-primary underline text-lg font-medium">
                Log into Estate Control
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
