import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StatusBar,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { ErrorMessage, EyeIcon } from 'components';
import { Button } from '../../components/Button';
import { useAppDispatch, useAppSelector } from 'store/hooks';
import { loginUser, clearError } from 'store/slices/authSlice';
import { clearProfile } from 'store/slices/profileSlice';
import { saveRememberedUsername, clearRememberedUsername, addPasswordForUsername, getPasswordSuggestionsForUsername } from '../../utils/authUtils';
import { useCompanyLogo } from '../../hooks/useCompanyLogo';
import { getPhotoURL } from '../../utils/photoUtils';

type RootStackParamList = {
  Login: undefined;
  WelcomeBack: undefined;
  ForgotPassword: undefined;
  Dashboard: undefined;
  TermsAndPrivacy: undefined;
};

type WelcomeBackScreenNavigationProp = StackNavigationProp<RootStackParamList, 'WelcomeBack'>;

export function WelcomeBack() {
  const { width, height } = useWindowDimensions();
  const navigation = useNavigation<WelcomeBackScreenNavigationProp>();
  const dispatch = useAppDispatch();
  const { isLoading, error, user } = useAppSelector((state) => state.auth);
  const { logoUrl, hasLogo } = useCompanyLogo();
  
  // Logo error handling state
  const [logoLoadError, setLogoLoadError] = useState(false);
  
  // Process logo URL to ensure it's a full URL (handle relative paths)
  const processedLogoUrl = React.useMemo(() => {
    if (!hasLogo || !logoUrl) return null;
    
    // If already a full URL, use it directly
    if (/^https?:\/\//i.test(logoUrl)) {
      return logoUrl;
    }
    
    // Otherwise, process through getPhotoURL to ensure it's a full URL
    return getPhotoURL(logoUrl, logoUrl);
  }, [hasLogo, logoUrl]);
  
  // Stable logo source - use company logo if available, fallback to local
  const logoSource = React.useMemo(() => {
    if (processedLogoUrl && !logoLoadError) {
      return { uri: processedLogoUrl };
    }
    return require('../../../assets/Logo.png');
  }, [processedLogoUrl, logoLoadError]);
  
  // Reset logo error when logo URL changes
  useEffect(() => {
    if (processedLogoUrl) {
      setLogoLoadError(false);
    }
  }, [processedLogoUrl]);
  
  // Handle logo load error
  const handleLogoError = () => {
    setLogoLoadError(true);
  };
  
  // Keyboard handling
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);
  
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
  
  const [formData, setFormData] = useState({
    password: '',
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showError, setShowError] = useState(false);
  const [passwordSuggestions, setPasswordSuggestions] = useState<string[]>([]);
  const [showPasswordSuggestions, setShowPasswordSuggestions] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // Clear Redux error when user starts typing
    if (error) {
      dispatch(clearError());
    }
    
    // Clear local error when user starts typing (only for empty password error)
    if (showError && value.trim()) {
      setShowError(false);
    }
  };

  // Handle Remember Me toggle here to keep username remembered/cleared
  const toggleRememberMe = async () => {
    const next = !formData.rememberMe;
    setFormData(prev => ({ ...prev, rememberMe: next }));
    const username = user?.username || user?.email || user?.phone || '';
    if (next && username) {
      await saveRememberedUsername(username);
    }
    if (!next) {
      await clearRememberedUsername();
    }
  };

  const handleInputFocus = () => {
    setKeyboardVisible(true);
    // When password input focused, load suggestions for current username
    const username = user?.username || user?.email || user?.phone || '';
    if (username) {
      getPasswordSuggestionsForUsername(username).then(setPasswordSuggestions).catch(() => {});
      setShowPasswordSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    setKeyboardVisible(false);
    // small delay so tap on suggestion can register
    setTimeout(() => setShowPasswordSuggestions(false), 150);
  };

  const handleLogin = async () => {
    if (!formData.password.trim()) {
      setShowError(true);
      return;
    }

    setShowError(false);
    dispatch(clearError());

    try {
      // Get username from Redux state (should be set from previous screen)
      const username = user?.username || user?.email || user?.phone || '';
      
      if (!username) {
        console.error('No username found in Redux state:', user);
        setShowError(true);
        return;
      }

      console.log('Attempting login with username:', username);
      console.log('Password provided:', formData.password ? 'Yes' : 'No');

      // Clear any previous profile data before logging in
      console.log('🧹 Clearing previous profile data before login');
      dispatch(clearProfile());

      // Login with username and password
      const result = await dispatch(loginUser({ 
        username, 
        password: formData.password 
      })).unwrap();
      
      console.log('Login result:', result);
      
      // Save password suggestion securely (opt-in via rememberMe)
      if (formData.rememberMe && formData.password) {
        await addPasswordForUsername(username, formData.password);
      }

      // Initialize push notifications after successful login
      try {
        const { FirebaseMessagingService } = await import('../../services/firebaseMessagingService');
        const authToken = result?.access_token;
        if (authToken) {
          console.log('🔔 Registering FCM token with backend after login...');
          
          // Get the FCM token and register it with backend
          const token = await FirebaseMessagingService.requestPermissionAndGetToken();
          if (token) {
            await FirebaseMessagingService.registerDeviceToken(token, authToken);
            console.log('✅ FCM token registered with backend after login');
          }
        } else {
          console.warn('⚠️ No auth token available for push notification registration');
        }
      } catch (error) {
        console.error('❌ Failed to register FCM token:', error);
        // Don't block login if push notification registration fails
      }
      
      // Check if user has accepted terms and conditions
      const termsAccepted = result?.member?.terms_accepted;
      
      if (!termsAccepted) {
        // User hasn't accepted terms, navigate to Terms & Privacy screen
        console.log('Terms not accepted, navigating to TermsAndPrivacy');
        navigation.navigate('TermsAndPrivacy');
      } else {
        // Terms accepted, navigate to Dashboard
        console.log('Login successful, navigating to Dashboard');
        navigation.navigate('Dashboard');
      }
      
    } catch (error: any) {
      // Extract meaningful error message for logging
      const errorMessage = typeof error === 'object' && error.message 
        ? (typeof error.message === 'string' ? error.message : JSON.stringify(error.message))
        : String(error);
      
      // Error handling is done in Redux slice
      console.error('❌ Login error:', errorMessage);
      
      if (error && typeof error === 'object') {
        console.log('📋 Error details:', {
          message: errorMessage,
          name: error.name || 'Unknown',
          ...(error.code && { code: error.code }),
          ...(error.response && { response: error.response })
        });
      }
      
      // The error should be handled by Redux and displayed automatically
      // No need to set showError here as Redux will handle the error display
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

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
            {/* Main Container */}
            <View className="flex-1 px-6" style={{ paddingTop: keyboardVisible ? 60 : 112 }}> 
              {/* Logo Section */}
              <View className={`items-center ${keyboardVisible ? 'mb-8' : 'mb-20'}`}>
                <Image
                  source={logoSource}
                  className={`${keyboardVisible ? 'w-48 h-16 mb-8' : 'w-56 h-20 mb-16'}`}
                  resizeMode="contain"
                  defaultSource={require('../../../assets/Logo.png')}
                  onError={handleLogoError}
                />

                <Text className={`text-center font-oxanium-bold text-text-primary font-medium mb-4 leading-8 tracking-wide ${keyboardVisible ? 'text-3xl' : 'text-4xl'}`}>
                  Welcome Back
                </Text>

                <Text className={`text-center font-oxanium text-text-secondary font-medium ${keyboardVisible ? 'text-lg' : 'text-xl'}`}>
                  Login to access your Estate Link account
                </Text>
              </View>

              {/* Form Section */}
              <View style={{ flex: keyboardVisible ? 0 : 1, justifyContent: keyboardVisible ? 'flex-start' : 'space-between' }}>
                <Text className="font-oxanium-bold text-textDark text-xl font-semibold mb-4">
                  Password
                </Text>

                <View className="relative">
                  <TextInput
                    ref={inputRef}
                    className={`rounded-xl border-2 border-primary bg-white text-textDark pr-12 h-16 px-6 text-lg font-oxanium-medium font-normal ${
                      showError ? 'mb-2' : 'mb-6'
                    } ${showPassword ? 'tracking-normal' : 'tracking-wider'}`}
                    style={{
                      textAlignVertical: 'center',
                      includeFontPadding: false,
                      paddingVertical: 0
                    }}
                    placeholder="Enter Password"
                    placeholderTextColor="#9CA3AF"
                    value={formData.password}
                    onChangeText={(value) => handleInputChange('password', value)}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="password"
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    submitBehavior="blurAndSubmit"
                  />
                  {showPasswordSuggestions && passwordSuggestions.length > 0 && (
                    <View 
                      className="mt-2 bg-white rounded-lg overflow-hidden border border-gray-200 shadow-md"
                    >
                      {passwordSuggestions.map((item, idx) => (
                        <TouchableOpacity
                          key={`pw-${idx}`}
                          className="px-4 py-3.5 flex-row items-center active:bg-gray-50"
                          activeOpacity={0.7}
                          onPress={() => {
                            setFormData(prev => ({ ...prev, password: item }));
                            setShowPasswordSuggestions(false);
                          }}
                        >
                          <View className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center mr-3">
                            <Text className="text-gray-400 text-lg">🔒</Text>
                          </View>
                          <Text className="font-oxanium-medium text-gray-900 text-base flex-1 tracking-wider">
                            {'•'.repeat(Math.min(item.length, 8))}
                          </Text>
                          {idx < passwordSuggestions.length - 1 && (
                            <View className="absolute bottom-0 left-4 right-4 h-px bg-gray-100" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  
                  <View className="absolute right-6 top-4">
                    <EyeIcon isVisible={showPassword} onPress={togglePasswordVisibility} />
                  </View>
                </View>

                {/* Local Error Message - for empty password */}
                {showError && !formData.password.trim() && (
                  <ErrorMessage
                    message="Please enter your password to continue."
                    visible={true}
                  />
                )}

                {/* Redux Error Message - for invalid credentials */}
                {error && (
                  <ErrorMessage message={error} visible={true} />
                )}

                {/* Remember Me Checkbox */}
                <TouchableOpacity
                  className="flex-row items-center mb-8 py-4 min-h-[56px]"
                  onPress={toggleRememberMe}
                  activeOpacity={0.7}>
                  <View
                    className={`items-center justify-center w-6 h-6 border-2 border-primary rounded mr-4 ${
                      formData.rememberMe ? 'bg-primary' : 'bg-transparent'
                    }`}>
                    {formData.rememberMe && (
                      <Text className="font-bold text-white text-sm">
                        ✓
                      </Text>
                    )}
                  </View>
                  <Text className="font-oxanium-bold text-textDark text-xl font-normal">
                    Remember me
                  </Text>
                </TouchableOpacity>

                {/* Login Button */}
                <View className="mb-8">
                  <Button
                    title="Login"
                    onPress={handleLogin}
                    disabled={!formData.password.trim()}
                    loading={isLoading}
                    variant={formData.password.trim() ? 'primary' : 'outline'}
                    size="large"
                  />
                </View>

                {/* Forgot Password Link */}
                <View className="items-center mb-15">
                  <TouchableOpacity 
                    className="py-3 px-4"
                    onPress={() => navigation.navigate('ForgotPassword')}>
                    <Text className="font-oxanium-bold text-primary text-lg font-semibold">
                      Forgot Password?
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Bottom Link */}
              {!keyboardVisible && (
                <View className="flex-1 items-center justify-end pb-10">
                  <TouchableOpacity className="py-3 px-4">
                    <Text className="font-oxanium-bold text-text-primary underline text-lg font-normal">
                      Log into Estate Control
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}