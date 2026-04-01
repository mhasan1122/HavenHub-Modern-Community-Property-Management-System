import { useState } from 'react';
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

} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EyeIcon, ErrorMessage } from 'components';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAppDispatch, useAppSelector } from 'store/hooks';
import { setPassword, clearError } from 'store/slices/authSlice';

type RootStackParamList = {
  Login: undefined;
  PasswordReset: undefined;
  ForgotPassword: undefined;
  InitialScreen: undefined;
  VerifyCode: undefined;
};

type PasswordResetScreenNavigationProp = StackNavigationProp<RootStackParamList, 'PasswordReset'>;

export function PasswordReset() {
  const navigation = useNavigation<PasswordResetScreenNavigationProp>();
  const dispatch = useAppDispatch();
  const { isLoading, error, user } = useAppSelector((state) => state.auth);
  
  // Check if this is a first-time login
  const isFirstLogin = user?.isFirstLogin;
  
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    rememberMe: false,
  });

  const [showPasswords, setShowPasswords] = useState({
    oldPassword: false,
    newPassword: false,
    confirmPassword: false,
  });

  const [fieldErrors, setFieldErrors] = useState({
    oldPassword: false,
    newPassword: false,
    confirmPassword: false,
    passwordMismatch: false,
  });

  const [fieldErrorMessages, setFieldErrorMessages] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    passwordMismatch: '',
  });

  const [localError, setLocalError] = useState({
    message: '',
    visible: false,
  });

  // Validate password complexity (same as Forgot Password flow)
  const validatePasswordComplexity = (password: string): string[] => {
    const errors: string[] = [];
    if (!password) return errors;
    if (password.length < 8) errors.push('Password must be at least 8 characters long');
    if (!/[!@#$%^&*]/.test(password)) errors.push('Password must contain at least one special character (!@#$%^&*)');
    if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
    return errors;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (fieldErrors[field as keyof typeof fieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [field]: false }));
      setFieldErrorMessages((prev) => ({ ...prev, [field]: '' }));
    }
    // Validate password complexity in real-time for newPassword field
    if (field === 'newPassword') {
      const errors = validatePasswordComplexity(value);
      if (errors.length > 0) {
        setFieldErrors((prev) => ({ ...prev, newPassword: true }));
        setFieldErrorMessages((prev) => ({ 
          ...prev, 
          newPassword: errors.join('. ') 
        }));
      } else {
        setFieldErrors((prev) => ({ ...prev, newPassword: false }));
        setFieldErrorMessages((prev) => ({ ...prev, newPassword: '' }));
      }
      // Check password match when newPassword changes
      if (formData.confirmPassword && value !== formData.confirmPassword) {
        setFieldErrors((prev) => ({ ...prev, passwordMismatch: true }));
        setFieldErrorMessages((prev) => ({ ...prev, passwordMismatch: "Your passwords do not match." }));
      } else {
        setFieldErrors((prev) => ({ ...prev, passwordMismatch: false }));
        setFieldErrorMessages((prev) => ({ ...prev, passwordMismatch: '' }));
      }
    }
    // Check password match when confirmPassword changes
    if (field === 'confirmPassword') {
      if (formData.newPassword && value !== formData.newPassword) {
        setFieldErrors((prev) => ({ ...prev, passwordMismatch: true }));
        setFieldErrorMessages((prev) => ({ ...prev, passwordMismatch: "Your passwords do not match." }));
      } else {
        setFieldErrors((prev) => ({ ...prev, passwordMismatch: false }));
        setFieldErrorMessages((prev) => ({ ...prev, passwordMismatch: '' }));
      }
    }
    // Clear password mismatch error when either password field changes
    if (field === 'newPassword' || field === 'confirmPassword') {
      // Already handled above, but keep for other cases
    }
    // Clear general error when user starts typing
    if (localError.visible) {
      setLocalError({ message: '', visible: false });
    }
  };

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleResetPassword = async () => {
    console.log('Reset Password button pressed');
    // Clear previous errors
    setLocalError({ message: '', visible: false });
    dispatch(clearError());
    setFieldErrors({
      oldPassword: false,
      newPassword: false,
      confirmPassword: false,
      passwordMismatch: false,
    });
    setFieldErrorMessages({
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
      passwordMismatch: '',
    });

    let hasFieldErrors = false;

    // Field validation - old password is required for both first-time and existing users
    if (!formData.oldPassword.trim()) {
      setFieldErrors((prev) => ({ ...prev, oldPassword: true }));
      setFieldErrorMessages((prev) => ({ 
        ...prev, 
        oldPassword: isFirstLogin ? "Temporary password is required" : "Old password is required" 
      }));
      hasFieldErrors = true;
    }

    if (!formData.newPassword.trim()) {
      setFieldErrors((prev) => ({ ...prev, newPassword: true }));
      setFieldErrorMessages((prev) => ({ ...prev, newPassword: "New password is required" }));
      hasFieldErrors = true;
    }

    if (!formData.confirmPassword.trim()) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: true }));
      setFieldErrorMessages((prev) => ({ ...prev, confirmPassword: "Please confirm your new password" }));
      hasFieldErrors = true;
    }

    if (hasFieldErrors) {
      return;
    }

    // Additional validation - same as Forgot Password flow
    const passwordValidationErrors: string[] = [];
    if (formData.newPassword.length < 8) {
      passwordValidationErrors.push('Password must be at least 8 characters long');
    }
    if (!/[!@#$%^&*]/.test(formData.newPassword)) {
      passwordValidationErrors.push('Password must contain at least one special character (!@#$%^&*)');
    }
    if (!/[A-Z]/.test(formData.newPassword)) {
      passwordValidationErrors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(formData.newPassword)) {
      passwordValidationErrors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(formData.newPassword)) {
      passwordValidationErrors.push('Password must contain at least one number');
    }

    if (passwordValidationErrors.length > 0) {
      setFieldErrors((prev) => ({ ...prev, newPassword: true }));
      setFieldErrorMessages((prev) => ({ 
        ...prev, 
        newPassword: passwordValidationErrors.join('. ') 
      }));
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setFieldErrors((prev) => ({ ...prev, passwordMismatch: true }));
      setFieldErrorMessages((prev) => ({ ...prev, passwordMismatch: "Your passwords do not match." }));
      return;
    }

    // Check if old password is different from new password (for both first-time and existing users)
    if (formData.oldPassword === formData.newPassword) {
      setLocalError({ message: 'New password must be different from old password', visible: true });
      return;
    }

    try {
      // Get user ID from Redux state
      const userId = user?.id;
      if (!userId) {
        setLocalError({ 
          message: 'User information not found. Please try again.', 
          visible: true 
        });
        return;
      }

      console.log('User ID:', userId);
      console.error('User:', user);
      

      // Call the set password API - both first-time and existing users use setPassword
      await dispatch(setPassword({
        userId,
        oldPassword: formData.oldPassword,
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword,
      })).unwrap();

      console.log('Password reset successful');
      
      // Navigate back to Login screen after successful password reset
      navigation.replace('Login');
      
    } catch (error: any) {
      // Extract meaningful error message for logging
      const errorMessage = typeof error === 'object' && error.message 
        ? (typeof error.message === 'string' ? error.message : JSON.stringify(error.message))
        : String(error || '');
      
      // Handle specific error cases
      console.error('❌ Password reset error:', errorMessage);
      
      if (error && typeof error === 'object') {
        console.log('📋 Error details:', {
          message: errorMessage,
          type: typeof errorMessage,
          name: error.name || 'Unknown'
        });
      }
      
      // Parse field-specific errors from the backend
      if (errorMessage.startsWith('old_password:')) {
        // Extract the error message after "old_password: "
        const actualError = errorMessage.replace('old_password: ', '');
        console.log('Old password error detected:', actualError);
        setFieldErrors((prev) => ({ ...prev, oldPassword: true }));
        setFieldErrorMessages((prev) => ({ 
          ...prev, 
          oldPassword: isFirstLogin 
            ? 'Temporary password is incorrect. Please check your email for the correct temporary password.' 
            : 'Old password is incorrect. Please enter your current password.'
        }));
        // Clear Redux error to prevent showing raw backend error
        dispatch(clearError());
      } else if (errorMessage.startsWith('new_password:')) {
        const actualError = errorMessage.replace('new_password: ', '');
        console.log('New password error detected:', actualError);
        setFieldErrors((prev) => ({ ...prev, newPassword: true }));
        setFieldErrorMessages((prev) => ({ 
          ...prev, 
          newPassword: actualError
        }));
        // Clear Redux error to prevent showing raw backend error
        dispatch(clearError());
      } else if (errorMessage.startsWith('confirm_password:')) {
        const actualError = errorMessage.replace('confirm_password: ', '');
        console.log('Confirm password error detected:', actualError);
        setFieldErrors((prev) => ({ ...prev, confirmPassword: true }));
        setFieldErrorMessages((prev) => ({ 
          ...prev, 
          confirmPassword: actualError
        }));
        // Clear Redux error to prevent showing raw backend error
        dispatch(clearError());
      } else {
        // Handle other errors
        console.log('General error detected:', errorMessage);
        setLocalError({ 
          message: errorMessage || 'Failed to reset password. Please try again.', 
          visible: true 
        });
      }
    }
  };

  const isFormValid = formData.oldPassword.trim() && formData.newPassword.trim() && formData.confirmPassword.trim();

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" backgroundColor="white" />

            {/* Scrollable Content */}
            <KeyboardAwareScrollView
              className="flex-1"
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              enableOnAndroid
              enableAutomaticScroll
              extraScrollHeight={24}
              keyboardOpeningTime={0}
            >
              {/* Main Container */}
              <View className="px-6 pt-6">
                {/* Logo Section */}
                <View className="items-center mb-10">
                  <Image
                    source={require('../../../assets/Logo.png')}
                    className="w-52 h-32 mb-10"
                    resizeMode="contain"
                  />

                  <Text className="text-center font-oxanium-bold text-text-primary text-4xl font-medium mb-3 leading-tight tracking-wide">
                    {isFirstLogin ? 'Set Your Password' : 'Welcome Back'}
                  </Text>

                  <Text className="text-center font-oxanium text-text-secondary text-base font-medium leading-relaxed px-2">
                    {isFirstLogin 
                      ? 'Create a secure password for your Estate Link account'
                      : 'Login to access your Estate Link account'
                    }
                  </Text>
                </View>

              {/* Error Message */}
              <ErrorMessage message={localError.message} visible={localError.visible} />

              {/* Redux Error Message - Only show if no field-specific errors */}
              {error && !fieldErrors.oldPassword && !fieldErrors.newPassword && !fieldErrors.confirmPassword && !fieldErrors.passwordMismatch && (
                <ErrorMessage message={error} visible={true} />
              )}

                {/* Form Section */}
                <View className="mb-4">
                  {/* Old Password - Required for both first-time and existing users */}
                  <Text className="font-oxanium-bold text-text-primary text-xl font-normal mb-3">
                    {isFirstLogin ? 'Temporary Password' : 'Old Password'}
                  </Text>

                  <View className={fieldErrors.oldPassword ? 'relative mb-2' : 'relative mb-5'}>
                    <TextInput
                      className="h-14 rounded-lg border-2 border-primary bg-background-input text-text-primary px-4 pr-12 text-base font-oxanium-medium font-normal"
                      style={{ color: '#000000' }}
                      placeholder={isFirstLogin ? "Enter Temporary Password From Email" : "Enter Old Password"}
                      placeholderTextColor="#9CA3AF"
                      value={formData.oldPassword}
                      onChangeText={(value) => handleInputChange('oldPassword', value)}
                      secureTextEntry={!showPasswords.oldPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="password"
                    />
                    <View className="absolute right-4 top-4">
                      <EyeIcon
                        isVisible={showPasswords.oldPassword}
                        onPress={() => togglePasswordVisibility('oldPassword')}
                      />
                    </View>
                  </View>

                  <ErrorMessage 
                    message={fieldErrorMessages.oldPassword} 
                    visible={fieldErrors.oldPassword} 
                  />

                  {/* New Password */}
                  <Text className="font-oxanium-bold text-text-primary text-xl font-medium mb-3 mt-4">
                    New Password
                  </Text>

                  <View className={fieldErrors.newPassword ? 'relative mb-2' : 'relative mb-5'}>
                    <TextInput
                      className="h-14 rounded-lg border-2 border-primary bg-background-input text-text-primary px-4 pr-12 text-base font-oxanium-medium font-normal"
                      style={{ color: '#000000' }}
                      placeholder="Enter New Password"
                      placeholderTextColor="#9CA3AF"
                      value={formData.newPassword}
                      onChangeText={(value) => handleInputChange('newPassword', value)}
                      secureTextEntry={!showPasswords.newPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="newPassword"
                    />
                    <View className="absolute right-4 top-4">
                      <EyeIcon
                        isVisible={showPasswords.newPassword}
                        onPress={() => togglePasswordVisibility('newPassword')}
                      />
                    </View>
                  </View>

                  <ErrorMessage message={fieldErrorMessages.newPassword} visible={fieldErrors.newPassword} />

                  {/* Re-type New Password */}
                  <Text className="font-oxanium-bold text-text-primary text-xl font-medium mb-3 mt-4">
                    Re-type New Password
                  </Text>

                  <View className={fieldErrors.confirmPassword ? 'relative mb-2' : 'relative mb-5'}>
                    <TextInput
                      className="h-14 rounded-lg border-2 border-primary bg-background-input text-text-primary px-4 pr-12 text-base font-oxanium-medium font-normal"
                      style={{ color: '#000000' }}
                      placeholder="Re-type New Password"
                      placeholderTextColor="#9CA3AF"
                      value={formData.confirmPassword}
                      onChangeText={(value) => handleInputChange('confirmPassword', value)}
                      secureTextEntry={!showPasswords.confirmPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="newPassword"
                    />
                    <View className="absolute right-4 top-4">
                      <EyeIcon
                        isVisible={showPasswords.confirmPassword}
                        onPress={() => togglePasswordVisibility('confirmPassword')}
                      />
                    </View>
                  </View>

                  <ErrorMessage
                    message={fieldErrorMessages.confirmPassword}
                    visible={fieldErrors.confirmPassword}
                  />

                  <ErrorMessage
                    message={fieldErrorMessages.passwordMismatch}
                    visible={fieldErrors.passwordMismatch}
                  />

                  {/* Remember Me Checkbox */}
                  <TouchableOpacity
                    className="flex-row items-center mb-6 py-3"
                    onPress={() => setFormData((prev) => ({ ...prev, rememberMe: !prev.rememberMe }))}
                    activeOpacity={0.7}>
                    <View className={`items-center justify-center w-6 h-6 border-2 rounded border-primary mr-3 ${formData.rememberMe ? 'bg-primary' : 'bg-transparent'}`}>
                      {formData.rememberMe && (
                        <Text className="font-bold text-white text-xs">
                          ✓
                        </Text>
                      )}
                    </View>
                    <Text className="font-oxanium-bold text-text-primary text-xl font-normal flex-1">
                      Remember me
                    </Text>
                  </TouchableOpacity>

                  {/* Reset Password Button */}
                  <TouchableOpacity
                    className={`items-center justify-center w-full h-14 rounded-full border-2 mb-6 ${
                      isFormValid && !isLoading 
                        ? 'bg-primary border-primary' 
                        : 'bg-white border-primary'
                    }`}
                    onPress={handleResetPassword}
                    disabled={isLoading}>
                    {isLoading ? (
                      <ActivityIndicator color="#3C9D9B" size="small" />
                    ) : (
                      <Text className={`font-oxanium-bold text-center text-base font-semibold ${isFormValid ? 'text-white' : 'text-primary'}`}>
                        {isFirstLogin ? 'Set Password' : 'Reset Password'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Forgot Password Link - Only show for non-first-time users */}
                  {!isFirstLogin && (
                    <View className="items-center mb-6">
                      <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                        <Text className="font-oxanium-bold text-primary text-center text-base font-semibold">
                          Forgot Password?
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Bottom Link */}
                <View className="items-center mb-6">
                  <TouchableOpacity>
                    <Text className="font-oxanium-bold text-text-primary underline text-base font-normal">
                      Log into Estate Control
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAwareScrollView>
          </View>
        </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}
