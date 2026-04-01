import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StatusBar,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EyeIcon } from 'components/EyeIcon';
import { ErrorMessage } from 'components/ErrorMessage';
import { SuccessMessage } from 'components/SuccessMessage';
import { useAppDispatch, useAppSelector } from 'store/hooks';
import {
  setNewPassword,
  clearState,
  clearError,
  clearAllState,
} from 'store/slices/forgotPasswordSlice';
import { useFormValidation } from 'hooks/useFormValidation';
import { passwordSchema } from 'validation/schemas';
import { RootStackParamList } from 'types/navigation';

type SetPasswordScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SetPassword'>;

export function SetPassword() {
  const navigation = useNavigation<SetPasswordScreenNavigationProp>();
  const isFocused = useIsFocused();
  const dispatch = useAppDispatch();
  const { message, error, loading, email, passwordResetCompleted } = useAppSelector(
    (state) => state.forgotPassword
  );

  const hasNavigated = useRef(false);
  const isMounted = useRef(false);
  const hasShownSuccess = useRef(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const { validateForm, getFieldError, clearErrors } = useFormValidation(passwordSchema);

  // Mount effect and navigation listeners
  useEffect(() => {
    console.log('SetPassword: Component mounted');
    isMounted.current = true;

    // Keyboard event listeners
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    const unsubscribeBeforeRemove = navigation.addListener('beforeRemove', (e) => {
      // If success modal is showing, prevent navigation and ensure modal is visible
      if (showSuccessModal && !hasNavigated.current) {
        console.log('SetPassword: Preventing navigation - success modal is active');
        e.preventDefault();
        // Ensure the success modal is clearly visible
        setShowSuccessModal(true);
      } else {
        console.log(
          'SetPassword: Allowing navigation - success modal closed or navigation initiated'
        );
      }
    });

    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log('SetPassword: Screen focused');
      // When screen comes into focus, if we have shown success, ensure modal is visible
      if (hasShownSuccess.current && !hasNavigated.current) {
        console.log('SetPassword: Screen focused with success shown, ensuring modal visibility');
        setShowSuccessModal(true);
      }
    });

    return () => {
      console.log('SetPassword: Component unmounting');
      isMounted.current = false;
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
      unsubscribeBeforeRemove();
      unsubscribeFocus();
    };
  }, [navigation, showSuccessModal]);

  // Redirect to forgot password if email is missing (BUT skip if success happened)
  useEffect(() => {
    if (hasShownSuccess.current || passwordResetCompleted) return;
    if (!isFocused) return;
    if (isMounted.current && !email && !loading && !hasNavigated.current && !showSuccessModal) {
      console.log('SetPassword: Email missing, navigating to ForgotPassword');
      hasNavigated.current = true;
      navigation.navigate('ForgotPassword');
    }
  }, [email, loading, navigation, showSuccessModal, passwordResetCompleted, isFocused]);

  // Clear Redux state on unmount only if password reset was not completed
  useEffect(() => {
    return () => {
      console.log('SetPassword: Cleanup effect - clearing modal state');
      setShowSuccessModal(false);
      setSuccessMessage('');
      // Only clear state if password reset was not completed
      if (!passwordResetCompleted) {
        console.log('SetPassword: Clearing Redux state on unmount');
        dispatch(clearState());
      }
    };
  }, [dispatch, passwordResetCompleted]);

  // Listen for success from Redux
  useEffect(() => {
    if (showSuccessModal || passwordResetCompleted) return;
    if (message && !error && !loading && !hasShownSuccess.current) {
      if (
        message.includes('password has been successfully updated') ||
        message.includes('Password updated successfully') ||
        message.includes('Your password has been successfully updated')
      ) {
        console.log('SetPassword: Password reset success detected, showing modal');
        setSuccessMessage(message);
        setShowSuccessModal(true);
        hasShownSuccess.current = true;
        console.log('SetPassword: Success modal shown');
      }
    }
  }, [message, error, loading, showSuccessModal, passwordResetCompleted]);

  // Monitor modal state changes for navigation
  useEffect(() => {
    if (!showSuccessModal && hasShownSuccess.current && !hasNavigated.current) {
      console.log('SetPassword: Modal closed, triggering navigation to Login');
      hasNavigated.current = true;

      // Clear all state and navigate to login
      console.log('SetPassword: Clearing all Redux state before navigation');
      dispatch(clearAllState());

      setTimeout(() => {
        console.log('SetPassword: Executing navigation.reset to Login');
        try {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
          console.log('SetPassword: Successfully navigated to Login');
        } catch (error) {
          console.error('SetPassword: Navigation from modal state change failed:', error);
          console.log('SetPassword: Attempting fallback navigation to Login');
          navigation.navigate('Login');
        }
      }, 100);
    }
  }, [showSuccessModal, dispatch, navigation]);

  // Password checks (same as Forgot Password flow)
  const hasMinLength = password.length >= 8;
  const hasSpecialChar = /[!@#$%^&*]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const isFormValid = hasMinLength && hasSpecialChar && hasUppercase && hasLowercase && hasNumber && passwordsMatch;
  const hasUserInput = password.length > 0 || confirmPassword.length > 0;
  const canSubmit = isFormValid && hasUserInput;

  const handlePasswordChange = async (value: string) => {
    setPassword(value);
    if (error) dispatch(clearError());
    if (showErrors) {
      await validateForm({ password: value, confirmPassword });
    }
  };

  const handlePasswordFocus = () => {
    setKeyboardVisible(true);
  };

  const handlePasswordBlur = () => {
    setKeyboardVisible(false);
  };

  const handleConfirmPasswordFocus = () => {
    setKeyboardVisible(true);
  };

  const handleConfirmPasswordBlur = () => {
    setKeyboardVisible(false);
  };

  const handleConfirmPasswordChange = async (value: string) => {
    setConfirmPassword(value);
    if (error) dispatch(clearError());
    if (showErrors) {
      await validateForm({ password, confirmPassword: value });
    }
  };

  const handleSetPassword = async () => {
    console.log('SetPassword: Set Password button pressed');
    if (!email) {
      console.error('SetPassword: Email is missing, cannot proceed');
      return;
    }
    console.log('SetPassword: Starting password reset process for email:', email);
    clearErrors();
    dispatch(clearError());
    const validation = await validateForm({ password, confirmPassword });
    setShowErrors(true);
    if (!validation.isValid) {
      console.log('SetPassword: Form validation failed');
      return;
    }

    try {
      console.log('SetPassword: Dispatching setNewPassword action');
      const result = await dispatch(setNewPassword({ email, new_password: password })).unwrap();
      if (
        result?.message &&
        (result.message.includes('password has been successfully updated') ||
          result.message.includes('Password updated successfully') ||
          result.message.includes('Your password has been successfully updated'))
      ) {
        console.log('SetPassword: Password reset successful, result:', result.message);
        setSuccessMessage(result.message);
        setShowSuccessModal(true);
        hasShownSuccess.current = true;
        // Don't clear state here - let the Redux slice handle the passwordResetCompleted flag
      }
    } catch (err) {
      console.error('Set password error:', err);
    }
  };

  const handleSuccessModalClose = () => {
    console.log('SetPassword: Success modal close triggered');
    setShowSuccessModal(false);
    setSuccessMessage('');
    // The useEffect will handle the navigation when modal closes
  };

  const handleBackButton = () => {
    if (showSuccessModal) {
      console.log(
        'SetPassword: Back button pressed while success modal is showing - ensuring modal visibility'
      );
      // If success modal is showing, ensure it's clearly visible instead of navigating
      setShowSuccessModal(true);
      return;
    }
    console.log('SetPassword: Back button pressed, navigating to VerifyCode');
    // Clear any success/error message so VerifyCode doesn't auto-advance.
    dispatch(clearState());
    navigation.navigate('VerifyCode');
  };

  const passwordError = getFieldError('password');
  const confirmPasswordError = getFieldError('confirmPassword');
  const showPasswordError = showErrors && passwordError;
  const showConfirmPasswordError = showErrors && confirmPasswordError;

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
            {/* Header */}
            <View className={`flex-row items-center px-6 pb-2 ${keyboardVisible ? 'pt-12' : 'pt-20'}`}>
              <TouchableOpacity
                onPress={handleBackButton}
                disabled={loading}
                className={`flex-row items-center ${showSuccessModal ? 'opacity-50' : 'opacity-100'}`}>
                <View className="mr-2">
                  <Ionicons name="chevron-back" size={18} color="#656565" />
                </View>
                <Text className="font-oxanium-medium text-lg text-black">
                  Back to Verify Code
                </Text>
              </TouchableOpacity>
            </View>

            {/* Main */}
            <View className="flex-1 px-6 pt-6">
              <View
                className={`items-center ${keyboardVisible ? 'mb-[20px] mt-[20px]' : 'mb-[40px] mt-[36px]'}`}>
                <Image
                  source={require('../../../assets/Logo.png')}
                  className={`${keyboardVisible ? 'w-[140px] h-[45px] mb-[15px]' : 'w-[180px] h-[58px] mb-[20px]'}`}
                  resizeMode="contain"
                />
              </View>

              <View className={`${keyboardVisible ? 'mb-[20px]' : 'mb-8'}`}>
                <Text 
                  className={`text-center font-oxanium-bold text-primary ${keyboardVisible ? 'text-[24px] font-semibold mb-2 leading-[28px]' : 'text-[30px] font-semibold mb-3 leading-[36px]'}`}>
                  Set a password
                </Text>
                <Text 
                  className={`text-center font-oxanium-medium text-black px-3 ${keyboardVisible ? 'text-[14px] leading-[24px]' : 'text-[16px] leading-[24px]'}`}>
                  Your previous password has been reset. Please set a new password for your account.
                </Text>
              </View>

              {/* Password Input */}
              <View className="mb-5">
                <Text className="font-oxanium-bold text-back text-xl font-normal mb-4">Create Password</Text>
                <View className="relative">
                  <TextInput
                    className={`h-14 rounded-lg border border bg-background-input px-4 pr-12 text-base text-text-primary font-oxanium ${showPasswordError ? 'mb-2 border-error' : 'border-border'}`}
                    placeholder="Enter Your Password"
                    placeholderTextColor="#9CA3AF"
                    value={password}
                    onChangeText={handlePasswordChange}
                    onBlur={handlePasswordBlur}
                    onFocus={handlePasswordFocus}
                    secureTextEntry={!showPassword}
                    editable={!loading}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View className="absolute right-4 top-4">
                    <EyeIcon
                      isVisible={showPassword}
                      onPress={() => setShowPassword(!showPassword)}
                    />
                  </View>
                </View>
                {showPasswordError && <ErrorMessage message={passwordError} visible />}
              </View>

              {/* Confirm Password */}
              <View className="mb-8">
                <Text className="font-oxanium-bold text-back text-xl font-normal mb-4">Re-type Password</Text>
                <View className="relative">
                  <TextInput
                    className={`h-14 rounded-lg border border bg-background-input px-4 pr-12 text-base text-text-primary font-oxanium ${showConfirmPasswordError ? 'mb-2 border-error' : 'border-border'}`}
                    placeholder="Confirm Your Password"
                    placeholderTextColor="#9CA3AF"
                    value={confirmPassword}
                    onChangeText={handleConfirmPasswordChange}
                    onBlur={handleConfirmPasswordBlur}
                    onFocus={handleConfirmPasswordFocus}
                    secureTextEntry={!showConfirmPassword}
                    editable={!loading}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View className="absolute right-4 top-4">
                    <EyeIcon
                      isVisible={showConfirmPassword}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    />
                  </View>
                </View>
                {showConfirmPasswordError && <ErrorMessage message={confirmPasswordError} visible />}
              </View>

              {/* Requirements (same as Forgot Password flow) */}
              <View className={`${keyboardVisible ? 'mb-[20px]' : 'mb-8'}`}>
                <Text className={`text-xs ${hasMinLength ? 'font-oxanium-medium text-primary' : 'text-text-placeholder'}`}>
                  • At least 8 characters long
                </Text>
                <Text
                  className={`text-xs ${hasSpecialChar ? 'font-oxanium-medium text-primary' : 'text-text-placeholder'}`}>
                  • Contains at least one special character (!@#$%^&*)
                </Text>
                <Text
                  className={`text-xs ${hasUppercase ? 'font-oxanium-medium text-primary' : 'text-text-placeholder'}`}>
                  • Contains at least one uppercase letter
                </Text>
                <Text
                  className={`text-xs ${hasLowercase ? 'font-oxanium-medium text-primary' : 'text-text-placeholder'}`}>
                  • Contains at least one lowercase letter
                </Text>
                <Text
                  className={`text-xs ${hasNumber ? 'font-oxanium-medium text-primary' : 'text-text-placeholder'}`}>
                  • Contains at least one number
                </Text>
                <Text
                  className={`text-xs ${passwordsMatch ? 'font-oxanium-medium text-primary' : 'text-text-placeholder'}`}>
                  • Passwords match
                </Text>
              </View>

              {/* Button */}
              <TouchableOpacity
                className={`mb-5 h-14 items-center justify-center rounded-3xl border-2 border-primary ${canSubmit && !loading ? 'bg-primary' : 'bg-white'}`}
                onPress={handleSetPassword}
                disabled={!canSubmit || loading}>
                {loading ? (
                  <ActivityIndicator color="#3C9D9B" size="small" />
                ) : (
                  <Text className={`text-lg ${canSubmit ? 'text-white' : 'text-primary'}`}>
                    Set Password
                  </Text>
                )}
              </TouchableOpacity>

              {error && <ErrorMessage message={error} visible />}

              <SuccessMessage
                title="Success"
                message={successMessage}
                visible={showSuccessModal}
                onClose={handleSuccessModalClose}
              />

              <View className="flex-1 items-center justify-end pb-10">
                <TouchableOpacity disabled={loading}>
                  <Text className="font-oxanium-bold text-base text-text-primary underline">
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
