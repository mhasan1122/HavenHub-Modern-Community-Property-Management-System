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
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { ErrorMessage } from 'components';
import { Button } from '../../components/Button';
import { useAppDispatch, useAppSelector } from 'store/hooks';
import { checkUserStatus, clearError, setError } from 'store/slices/authSlice';
import { useFormValidation } from 'hooks/useFormValidation';
import { initialScreenSchema } from 'validation/schemas';
import { testBackendConnection, logNetworkInfo } from '../../utils/testBackendConnection';
import { performHealthCheck, logHealthCheckResult } from '../../utils/healthCheck';
import { getRememberedUsername, saveRememberedUsername, clearRememberedUsername, getUsernameSuggestions, addUsernameToHistory } from '../../utils/authUtils';

type RootStackParamList = {
  Login: undefined;
  PasswordReset: undefined;
  ForgotPassword: undefined;
  WelcomeBack: undefined;
};

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;


export function InitialScreen() {
  const { width, height } = useWindowDimensions();
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((state) => state.auth);
  
  // Static logo source
  const logoSource = require('../../../assets/Logo.png');
  
  // Enhanced keyboard handling
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Keyboard event listeners with height tracking
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates.height);
        // Scroll to input when keyboard shows
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Responsive dimensions
  const isSmallScreen = width < 375;

  const [formData, setFormData] = useState({
    username: '',
    rememberMe: false,
  });
  const [forceUpdate, setForceUpdate] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const {
    errors,
    validateForm,
    setFieldTouched,
    setFieldError,
    getFieldError,
    isFieldTouched,
    clearErrors,
  } = useFormValidation(initialScreenSchema);

  // Load remembered username on mount
  useEffect(() => {
    (async () => {
      const { username, enabled } = await getRememberedUsername();
      if (enabled && username) {
        setFormData(prev => ({ ...prev, username, rememberMe: true }));
      }
      const list = await getUsernameSuggestions();
      setSuggestions(list);
    })();
  }, []);

  const handleInputChange = async (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (error) {
      dispatch(clearError());
    }

    if (forceUpdate > 0) {
      setForceUpdate(0);
    }

    // Do not trigger validation while typing; only clear existing errors if the field was touched
    if (field === 'username') {
      setFieldError('username', null);
      const list = await getUsernameSuggestions(value);
      setSuggestions(list);
      setShowSuggestions(true);
    }
  };

  const handleInputFocus = () => {
    setKeyboardVisible(true);
    // Scroll to input when focused
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 300);
    setShowSuggestions(true);
    if (!formData.username) {
      getUsernameSuggestions().then(setSuggestions).catch(() => {});
    }
  };

  const handleInputBlur = () => {
    setKeyboardVisible(false);
    handleBlur('username');
    setTimeout(() => setShowSuggestions(false), 150);
  };

  const handleBlur = (field: string) => {
    setFieldTouched(field as keyof typeof formData, true);
  };

  const handleLogin = async () => {
    dispatch(clearError());
    setFieldTouched('username', true);

    if (!formData.username.trim()) {
      setFieldError('username', 'Username, email, or phone number is required');
      setForceUpdate((prev) => prev + 1);
      return;
    }

    const validation = await validateForm(formData);
    if (!validation.isValid) {
      return;
    }

    try {
      const statusResult = await dispatch(checkUserStatus(formData.username)).unwrap();

      // Persist or clear remembered username based on checkbox
      if (formData.rememberMe) {
        await saveRememberedUsername(formData.username.trim());
      } else {
        await clearRememberedUsername();
      }

      // Gate: allow if comm member (with or without org); block if org-only
      if (statusResult?.is_org_member && !statusResult?.is_comm_member) {
        const errorMessage = 'Access denied: Organization-only members cannot login.';
        setFieldError('username', errorMessage);
        dispatch(setError(errorMessage));
        return;
      }

      if (statusResult.is_first_login) {
        if (formData.rememberMe) {
          await saveRememberedUsername(formData.username.trim());
          await addUsernameToHistory(formData.username.trim());
        } else {
          await clearRememberedUsername();
        }
        navigation.navigate('PasswordReset');
      } else {
        if (formData.rememberMe) {
          await saveRememberedUsername(formData.username.trim());
          await addUsernameToHistory(formData.username.trim());
        } else {
          await clearRememberedUsername();
        }
        navigation.navigate('WelcomeBack');
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  const testNavigation = () => {
    navigation.navigate('WelcomeBack');
  };

  const testConnection = async () => {
    console.log('=== Testing Connection ===');
    logNetworkInfo();
    const healthCheck = await performHealthCheck();
    logHealthCheckResult(healthCheck);
    const connectionTest = await testBackendConnection();
    console.log('Connection test result:', connectionTest);
  };

  const usernameError = getFieldError('username');
  const hasUsernameError = !!usernameError;
  const shouldShowError = Boolean(
    (forceUpdate > 0 && (hasUsernameError || !formData.username.trim())) ||
      (hasUsernameError && formData.username.trim())
  );
  const isFormValid = formData.username.trim();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        className="flex-1">
        <TouchableWithoutFeedback onPress={() => {
          Keyboard.dismiss();
          setKeyboardVisible(false);
        }}>
          <ScrollView 
            ref={scrollViewRef}
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}>
            <View className="flex-1 px-6">
            {/* Header Section */}
            <View 
              className={`items-center justify-center ${keyboardVisible ? 'pt-12 pb-8 min-h-[20%]' : 'pt-20 pb-16 min-h-[35%]'}`}
            >
              <Image
                source={logoSource}
                className={`${keyboardVisible ? 'w-48 h-16' : 'w-56 h-20'} mb-8`}
                resizeMode="contain"
              />

              <Text
                className={`text-center font-oxanium-bold text-text-primary font-semibold mb-4 leading-tight tracking-wide ${keyboardVisible ? 'text-4xl' : 'text-5xl'}`}>
                Welcome Back
              </Text>

              <Text
                className={`text-center font-oxanium text-text-secondary font-normal leading-relaxed max-w-[80%] ${keyboardVisible ? 'text-base' : 'text-lg'}`}>
                Login to access your Estate Link account
              </Text>
            </View>

            {/* Form Section */}
            <View 
              className="flex-1 justify-start"
              style={{ 
                paddingBottom: keyboardVisible ? Math.max(keyboardHeight * 0.1, 20) : 48 
              }}>
              <View className="mb-6">
                <Text
                  className={`font-oxanium-bold text-text-primary font-medium mb-4 ${isSmallScreen ? 'text-base' : 'text-lg'}`}>
                  User Name / Email / Phone Number
                </Text>

                <TextInput
                  ref={inputRef}
                  className={`rounded-xl border-2 bg-white font-oxanium-medium text-black px-4 h-16 ${isSmallScreen ? 'text-base' : 'text-lg'} ${
                    shouldShowError ? 'border-red-500' : 'border-primary'
                  }`}
                  style={{ 
                    textAlignVertical: 'center',
                    includeFontPadding: false,
                    paddingVertical: 0
                  }}
                  placeholder="Enter Username, Email or Phone"
                  placeholderTextColor="#9CA3AF"
                  value={formData.username}
                  onChangeText={(value) => handleInputChange('username', value)}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  multiline={false}
                  numberOfLines={1}
                />

                {shouldShowError && (
                  <ErrorMessage
                    message={usernameError || 'Username, email, or phone number is required'}
                    visible={true}
                  />
                )}
                {showSuggestions && suggestions.length > 0 && (
                  <View 
                    className="mt-2 bg-white rounded-lg overflow-hidden border border-gray-200 shadow-md"
                  >
                    {suggestions.map((item, idx) => (
                      <TouchableOpacity
                        key={`${item}-${idx}`}
                        className="px-4 py-3.5 flex-row items-center active:bg-gray-50"
                        activeOpacity={0.7}
                        onPress={() => {
                          setFormData(prev => ({ ...prev, username: item }));
                          setShowSuggestions(false);
                        }}
                      >
                        <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mr-3">
                          <Text className="font-oxanium-bold text-primary text-xs">
                            {item.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <Text className="font-oxanium-medium text-gray-900 text-base flex-1">
                          {item}
                        </Text>
                        {idx < suggestions.length - 1 && (
                          <View className="absolute bottom-0 left-4 right-4 h-px bg-gray-100" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {error && (
                <View className="mb-6">
                  <ErrorMessage message={error} visible={true} />
                </View>
              )}

              {/* Remember Me Checkbox */}
              <TouchableOpacity
                className="flex-row items-center mb-8 py-4 min-h-[56px]"
                onPress={() => setFormData((prev) => ({ ...prev, rememberMe: !prev.rememberMe }))}
                activeOpacity={0.7}
                disabled={isLoading}>
                <View
                  className={`items-center justify-center rounded border-2 w-6 h-6 mr-4 ${
                    formData.rememberMe ? 'bg-primary' : 'bg-transparent'
                  } border-primary`}>
                  {formData.rememberMe && (
                    <Text 
                      className="font-bold text-white text-sm"
                    >
                      ✓
                    </Text>
                  )}
                </View>
                <Text
                  className={`font-oxanium-bold text-black font-normal flex-1 ${isSmallScreen ? 'text-base' : 'text-lg'}`}>
                  Remember me
                </Text>
              </TouchableOpacity>

              {/* Login Button */}
              <View className="mb-8">
                <Button
                  title="Submit"
                  onPress={handleLogin}
                  disabled={!isFormValid}
                  loading={isLoading}
                  variant={isFormValid ? 'primary' : 'outline'}
                  size={isSmallScreen ? 'medium' : 'large'}
                />
              </View>

              {/* Links Section */}
              <View className="items-center space-y-6 flex-1">
                <TouchableOpacity 
                  className="py-3 px-4"
                  onPress={handleForgotPassword} 
                  disabled={isLoading}>
                  <Text className={`font-oxanium-bold text-center font-semibold text-primary ${isSmallScreen ? 'text-base' : 'text-lg'}`}>
                    Forgot Password?
                  </Text>
                </TouchableOpacity>

                {/* <TouchableOpacity 
                  className="py-2 px-4"
                  onPress={testNavigation} 
                  disabled={isLoading}>
                  <Text className={`font-oxanium text-blue-500 text-center font-medium ${isSmallScreen ? 'text-sm' : 'text-base'}`}>
                    Test Navigation (Debug)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  className="py-2 px-4"
                  onPress={testConnection} 
                  disabled={isLoading}>
                  <Text className={`font-oxanium text-green-500 text-center font-medium ${isSmallScreen ? 'text-sm' : 'text-base'}`}>
                    Test Connection (Debug)
                  </Text>
                </TouchableOpacity> */}

                <TouchableOpacity 
                  className="py-3 px-4 mt-auto"
                  disabled={isLoading}>
                  <Text
                    className={`font-oxanium-bold text-black underline font-normal ${isSmallScreen ? 'text-base' : 'text-lg'}`}>
                    Log into Estate Control
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}