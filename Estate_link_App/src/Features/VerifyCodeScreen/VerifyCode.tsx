import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StatusBar, TouchableWithoutFeedback, Keyboard, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ErrorMessage } from 'components/ErrorMessage';
import { useAppDispatch, useAppSelector } from 'store/hooks';
import { verifyOtp, resendOtp, clearState, clearAllState } from 'store/slices/forgotPasswordSlice';
import { useFormValidation } from 'hooks/useFormValidation';
import { otpSchema } from 'validation/schemas';
import { RootStackParamList } from 'types/navigation';

type VerifyCodeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'VerifyCode'>;

export function VerifyCode() {
  const navigation = useNavigation<VerifyCodeScreenNavigationProp>();
  const isFocused = useIsFocused();
  const dispatch = useAppDispatch();
  const { message, error, loading, email, passwordResetCompleted } = useAppSelector((state) => state.forgotPassword);

  console.log('VerifyCode: Component rendered with email:', email, 'passwordResetCompleted:', passwordResetCompleted, 'message:', message, 'error:', error, 'loading:', loading);

  const [code, setCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(120); // 2:00 in seconds
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [otpInlineError, setOtpInlineError] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const {
    errors,
    validateForm,
    setFieldTouched,
    getFieldError,
    isFieldTouched,
    clearErrors,
  } = useFormValidation(otpSchema);

  // Component mount/unmount logging
  useEffect(() => {
    console.log('VerifyCode: Component mounted');
    return () => {
      console.log('VerifyCode: Component unmounting');
    };
  }, []);

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

  // Debug state changes
  useEffect(() => {
    console.log('VerifyCode: State changed - code:', code, 'showSuccess:', showSuccess, 'successMessage:', successMessage, 'otpInlineError:', otpInlineError);
  }, [code, showSuccess, successMessage, otpInlineError]);

  // Redirect to forgot password if email is missing, or to login if password reset is completed
  useEffect(() => {
    console.log('VerifyCode: Checking email availability - email:', email);
    if (!isFocused) {
      return;
    }
    // Add a small delay to ensure Redux state is properly initialized
    const timer = setTimeout(() => {
      if (!email) {
        console.warn('VerifyCode: Email missing, redirecting to ForgotPassword');
        navigation.replace('ForgotPassword');
      } else if (passwordResetCompleted) {
        console.log('VerifyCode: Password reset already completed, redirecting to Login');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else {
        console.log('VerifyCode: Email found, staying on VerifyCode screen');
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [email, navigation, passwordResetCompleted, isFocused]);

  // Countdown timer effect
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  // Show success message and navigate to set password
  useEffect(() => {
    console.log('VerifyCode: Message/error effect triggered - message:', message, 'error:', error);
    if (!isFocused) {
      return;
    }
    if (message && !error && !showSuccess) { // Only run if showSuccess is false
      if (message.includes('verified')) {
        console.log('VerifyCode: OTP verification successful, message:', message);
        setShowSuccess(true);
        setSuccessMessage('Verification successful!');
        setOtpInlineError(''); // Clear any inline errors
        
        // Only navigate to SetPassword if password reset was not already completed
        const timer = setTimeout(() => {
          if (!passwordResetCompleted) {
            console.log('VerifyCode: Password not yet reset, navigating to SetPassword');
            navigation.navigate('SetPassword');
          } else {
            // If password was already reset, navigate directly to login
            console.log('VerifyCode: Password already reset, navigating directly to Login');
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }
        }, 600);
        
        return () => clearTimeout(timer);
      }
    }
    // Don't set inline error from Redux error here, let the handleVerify function handle errors
  }, [message, error, navigation, passwordResetCompleted]); // Removed showSuccess from dependencies

  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  const handleCodeChange = useCallback((value: string) => {
    console.log('VerifyCode: Code input changed to:', value);
    // Only allow numbers and limit to reasonable OTP length
    const numericValue = value.replace(/[^0-9]/g, '');
    if (numericValue.length <= 6) {
      setCode(numericValue);
      
      // Clear inline error when user starts typing
      setOtpInlineError('');
      
      // Clear Redux error when user starts typing
      dispatch(clearState());
      
      // Clear success message when user starts typing
      setShowSuccess(false);
      setSuccessMessage('');
    }
  }, [dispatch]);

  const handleBlur = useCallback(() => {
    console.log('VerifyCode: Input blur triggered');
    setKeyboardVisible(false);
    setFieldTouched('otp', true);
  }, [setFieldTouched]);

  const handleFocus = useCallback(() => {
    console.log('VerifyCode: Input focus triggered');
    setKeyboardVisible(true);
  }, []);

  const handleVerify = useCallback(async () => {
    console.log('VerifyCode: Verify button pressed with code:', code);
    // Clear previous errors
    clearErrors();
    dispatch(clearState());
    setOtpInlineError('');

    // Inline validation: if OTP is empty, show an inline error
    if (!code.trim()) {
      console.log('VerifyCode: OTP is empty, showing inline error');
      setOtpInlineError('Please enter the OTP.');
      return;
    }

    // Validate form
    const validation = await validateForm({ otp: code });
    if (!validation.isValid) {
      console.log('VerifyCode: Form validation failed');
      return;
    }

    try {
      console.log('VerifyCode: Dispatching verifyOtp action for email:', email);
      // Verify OTP
      const result = await dispatch(verifyOtp({ email, otp: code })).unwrap();
      
      if (result && result.error) {
        console.log('VerifyCode: OTP verification failed with error:', result.error);
        setOtpInlineError(result.error);
        return;
      }
      console.log('VerifyCode: OTP verification successful');
    } catch (error: any) {
      // Handle specific error cases
      if (error.message === 'Invalid OTP') {
        console.log('VerifyCode: Invalid OTP error');
        setOtpInlineError('The verification code you entered is incorrect. Please try again.');
      } else if (error.name === 'AbortError') {
        console.log('VerifyCode: Network error (AbortError)');
        setOtpInlineError('Network error. Please check your connection and try again.');
      } else {
        console.log('VerifyCode: General error:', error.message);
        setOtpInlineError(error.message || 'Failed to verify OTP. Please try again.');
      }
      console.error('OTP verification error:', error);
    }
  }, [code, email, clearErrors, dispatch, validateForm]);

  const handleResend = useCallback(async () => {
    console.log('VerifyCode: Resend button pressed');
    if (!email) {
      console.log('VerifyCode: Email missing for resend');
      setOtpInlineError('Email is missing.');
      return;
    }

    try {
      console.log('VerifyCode: Dispatching resendOtp action for email:', email);
      // Resend OTP using API
      await dispatch(resendOtp(email)).unwrap();
      
      // Reset timer
      setTimeLeft(120);
      
      // Clear current code and messages
      setCode('');
      clearErrors();
      dispatch(clearState());
      setShowSuccess(false);
      setSuccessMessage('');
      setOtpInlineError('');
      
      console.log('VerifyCode: OTP resent successfully');
      // Focus on input
      inputRef.current?.focus();
    } catch (error) {
      // Error handling is done in Redux slice
      console.error('Resend OTP error:', error);
    }
  }, [email, dispatch, clearErrors]);

  // Memoize computed values to prevent unnecessary re-renders
  const otpError = getFieldError('otp');
  const showOtpError = isFieldTouched('otp') && otpError;
  const isFormValid = useMemo(() => {
    const valid = code.length >= 4 && !otpError && !otpInlineError;
    console.log('VerifyCode: Form validation - code length:', code.length, 'otpError:', otpError, 'otpInlineError:', otpInlineError, 'isFormValid:', valid);
    return valid;
  }, [code.length, otpError, otpInlineError]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1">
        <TouchableWithoutFeedback onPress={() => {
          Keyboard.dismiss();
          setKeyboardVisible(false);
        }}>
          <View className="flex-1">
            {/* Header with Back Button */}
            <View className={`flex-row items-center px-6 pb-4 ${keyboardVisible ? 'pt-10' : 'pt-20'}`}>
              <TouchableOpacity className="flex-row items-center" onPress={() => {
                console.log('VerifyCode: Back button pressed, navigating to ForgotPassword');
                navigation.navigate('ForgotPassword');
              }} disabled={loading}>
                <Ionicons name="chevron-back" size={18} color="#656565" className="mr-2" />
                <Text className="font-oxanium-medium text-text-secondary text-lg">
                  Back to Forgot Password
                </Text>
              </TouchableOpacity>
            </View>

            {/* Main Container */}
            <View className="flex-1 px-6 pt-10">
              {/* Logo Section */}
              <View 
                className={`items-center ${keyboardVisible ? 'mb-[30px]' : 'mb-[60px]'}`}>
                <Image
                  source={require('../../../assets/Logo.png')}
                  className={`${keyboardVisible ? 'w-[160px] h-[51px] mb-[20px]' : 'w-[200px] h-[64px] mb-[40px]'}`}
                  resizeMode="contain"
                />
              </View>

              {/* Title and Description */}
              <View className={`${keyboardVisible ? 'mb-[20px]' : 'mb-[40px]'}`}>
                <Text
                  className={`text-center font-oxanium-bold text-primary ${keyboardVisible ? 'text-[30px] leading-[30px] mb-[10px]' : 'text-[40px] leading-[40px] mb-[20px]'} font-semibold`}>
                  Verify code
                </Text>

                <Text
                  className={`text-center font-oxanium-medium text-text-secondary ${keyboardVisible ? 'text-[16px]' : 'text-[18px]'} font-normal leading-6 px-5`}>
                  An authentication code has been sent to your email.
                </Text>
              </View>

              {/* Code Input Section */}
              <View className="mb-8">
                <Text
                  className="font-oxanium-bold text-primary text-xl font-normal mb-4">
                  Enter Code
                </Text>

                <TextInput
                  ref={inputRef}
                  className={`rounded-lg border bg-background-input text-black font-oxanium h-14 border px-4 text-base text-left ${(showOtpError || otpInlineError) ? 'mb-2' : ''} ${
                    (showOtpError || otpInlineError) ? 'border-secondary' : 'border-border'
                  }`}
                  placeholder="Enter Your OTP"
                  placeholderTextColor="#9CA3AF"
                  value={code}
                  onChangeText={handleCodeChange}
                  onBlur={handleBlur}
                  onFocus={handleFocus}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus={true}
                  editable={!loading}
                />

                {/* Error Messages - Show only one error in priority order */}
                {otpInlineError ? (
                  <ErrorMessage message={otpInlineError} visible={true} />
                ) : showOtpError && otpError ? (
                  <ErrorMessage message={otpError} visible={true} />
                ) : error ? (
                  <ErrorMessage message={error} visible={true} />
                ) : null}
                
                {/* Success Message */}
                {showSuccess && (
                  <View className="mb-4 flex-row items-center">
                    <View className="mr-3">
                      <Text className="font-bold text-green-600 text-lg">
                        ✓
                      </Text>
                    </View>
                    <Text className="flex-1 text-green-600 font-oxanium-medium text-base">
                      {successMessage}
                    </Text>
                  </View>
                )}
              </View>

              {/* Resend Section */}
              <View className="flex-row items-center justify-between mb-[30px]">
                <View className="flex-row items-center">
                  <Text className="font-oxanium-medium text-text-secondary text-lg">
                    Didn&apos;t receive a code?
                  </Text>
                  <TouchableOpacity onPress={handleResend} disabled={loading}>
                    <Text
                      className="font-oxanium-bold text-secondary ml-2 text-xl"
                      >
                      Resend
                    </Text>
                  </TouchableOpacity>
                </View>
                <View
                  className="items-center justify-center rounded-full border border-secondary bg-white min-w-[36px] h-[36px] px-2">
                  <Text className="font-oxanium-medium text-sm text-center">
                    {formatTime(timeLeft)}
                  </Text>
                </View>
              </View>

              {/* Verify Button */}
              <TouchableOpacity
                className={`items-center justify-center border-2 border-primary ${
                  isFormValid && !loading ? 'bg-primary' : 'bg-white'
                } h-14 rounded-[28px] mb-5`}
                onPress={() => {
                  console.log('VerifyCode: Verify button pressed - isFormValid:', isFormValid, 'loading:', loading, 'code:', code);
                  handleVerify();
                }}
                disabled={!isFormValid || loading}>
                {loading ? (
                  <ActivityIndicator color="#3C9D9B" size="small" />
                ) : (
                  <Text
                    className={`font-oxanium-bold ${
                      isFormValid ? 'text-white' : 'text-primary'
                    } text-lg font-semibold`}>
                    Verify
                  </Text>
                )}
              </TouchableOpacity>

              {/* Bottom Link */}
              <View className="flex-1 items-center justify-end pb-10">
                <TouchableOpacity 
                  disabled={loading}
                  onPress={() => {
                    console.log('VerifyCode: Test button pressed - current state:', { email, message, error, loading, passwordResetCompleted });
                  }}
                >
                  <Text
                    className="font-oxanium-bold text-text-primary underline text-base font-normal">
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
