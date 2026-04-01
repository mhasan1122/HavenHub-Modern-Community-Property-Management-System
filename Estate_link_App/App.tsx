import './global.css';
import './src/utils/suppressWarnings'; // Suppress all deprecation warnings
import * as Updates from 'expo-updates';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './src/store';
import { Login } from './src/Features/LoginScreen/Login';
import { WelcomeBack } from './src/Features/WelcomeBackScreen/WelcomeBack';
import { InitialScreen } from './src/Features/InitialResetPassword/InitialScreen';
import { PasswordReset } from './src/Features/InitialResetPassword/PasswordReset';
import { ForgotPassword } from './src/Features/ForgetPasswordScreen/ForgotPassword';
import { VerifyCode } from './src/Features/VerifyCodeScreen/VerifyCode';
import { SetPassword } from './src/Features/SetPasswordScreen/SetPassword';
import { BottomTabNavigator } from './components/BottomTabBar';
import { ProfileManagement } from './src/Features/ProfileManagement/ProfileManagement';
import { ProfileManagementSettings } from './src/Features/ProfileManagement/ProfileManagementSettings';
import { EditGeneralInfo } from './src/Features/ProfileManagement/EditGeneralInfoScreen';
import { EditLoginInfo } from './src/Features/ProfileManagement/EditLoginInfoScreen/EditLoginInfo';
import { InfoAndSupport } from './src/Features/ProfileManagement/InfoAndSupportScreen';
import { TermsAndPrivacy } from './src/Features/ProfileManagement/TermsAndPrivacyScreen';
import { BlockedMembers } from './src/Features/ProfileManagement/BlockedMembers';
// import NoticeBoard from './src/Features/NoticeBoardScreen/NoticeBoard';
import ShowNoticeBoard from './src/Features/NoticeBoardScreen/ShowNoticeBoard';
import CreateBulletinForm from './src/Features/BulletinScreen/CreateBulletinForm';
import EditBulletinForm from './src/Features/BulletinScreen/EditBulletinForm';
import PendingBulletin from './src/Features/BulletinScreen/PendingBulletin';
import Archive from './src/Features/BulletinScreen/Archive';
import ReportBulletin from './src/Features/BulletinScreen/ReportBulletin';
import NotificationFeedScreen from './src/Features/NotificationFeedScreen';
import { ServiceFeePaymentScreen, MakePaymentScreen, PaymentHistoryScreen, ReceiptViewScreen, BillDetailScreen } from './src/Features/ServiceFeePayment';
import PaymentGatewayScreen from './src/Features/ServiceFeePayment/PaymentGatewayScreen';
import { TokenRefreshManager } from './src/components/TokenRefreshManager';
import UpdatePopup, { type UpdatePopupState } from './components/UpdatePopup';
import React, { useEffect } from 'react';
import {
  useFonts,
  Oxanium_400Regular,
  Oxanium_500Medium,
  Oxanium_600SemiBold,
  Oxanium_700Bold,
} from '@expo-google-fonts/oxanium';
import {
  Lato_100Thin,
  Lato_100Thin_Italic,
  Lato_300Light,
  Lato_300Light_Italic,
  Lato_400Regular,
  Lato_400Regular_Italic,
  Lato_700Bold,
  Lato_700Bold_Italic,
  Lato_900Black,
  Lato_900Black_Italic,
} from '@expo-google-fonts/lato';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { navigationRef } from './src/utils/navigationRef';
import { useSelector } from 'react-redux';

// Disable React Native error overlay and warnings
const { LogBox } = require('react-native');

// Comprehensive warning suppression
LogBox.ignoreLogs([
  // SafeAreaView warnings
  'SafeAreaView has been deprecated',
  'SafeAreaView',
  'react-native-safe-area-context',

  // Reanimated warnings
  'react-native-reanimated/plugin',
  'react-native-worklets',
  'Reanimated',
  '[Reanimated]',

  // Network and API warnings
  'User not found',
  'Login error:',
  'Backend connection test failed:',
  'Network request failed',
  'AbortError',
  'timeout',
  'connection',
  'fetch',

  // Development warnings
  'LogBox.setDisabled is not a function',
  'runtime not ready',
  'Warning: componentWillReceiveProps',
  'Warning: componentWillMount',
  'VirtualizedLists should never be nested',
  // Firebase native module not linked (use dev build for push)
  'RNFBAppModule not found',
  'Native module RNFBAppModule not found',
]);

if (__DEV__) {
  // Also ignore all logs completely in development
  LogBox.ignoreAllLogs();

  // Override console.error to prevent error overlay
  const originalConsoleError = console.error;
  console.error = (...args) => {
    // Only log to console, don't show overlay
    originalConsoleError.apply(console, args);
  };

  // Also disable error overlay globally
  if ((global as any).ErrorUtils) {
    (global as any).ErrorUtils.setGlobalHandler((error: any, isFatal: any) => {
      const msg = error?.message ?? String(error);
      // Swallow Firebase native module error so app runs without dev build
      if (msg.includes('RNFBAppModule') || msg.includes('Native module') && msg.includes('not found')) {
        if (__DEV__) console.warn('[Firebase] Native module not available. Use a development build for push notifications.');
        return;
      }
      console.error('Global error:', error);
    });
  }
}

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator();

export default function App() {
  const [isRehydrated, setIsRehydrated] = React.useState(false);
  const [initialRoute, setInitialRoute] = React.useState<string>('InitialScreen');
  const [showUpdatePopup, setShowUpdatePopup] = React.useState(false);
  const [updatePopupState, setUpdatePopupState] = React.useState<UpdatePopupState>('available');

  // Check for OTA updates on app launch
  useEffect(() => {
    async function checkForUpdates() {
      if (__DEV__) {
        console.log('⚙️ Running in development mode - skipping update check');
        return;
      }

      try {
        console.log('🔄 Checking for app updates...');
        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          console.log('📦 Update available - showing popup');
          setUpdatePopupState('available');
          setShowUpdatePopup(true);
        } else {
          console.log('✅ App is up to date');
        }
      } catch (error) {
        console.log('⚠️ Error checking for updates:', error);
        // Fail gracefully - don't block the app
      }
    }

    checkForUpdates();
  }, []);

  const handleUpdateDownload = React.useCallback(async () => {
    setUpdatePopupState('downloading');
    try {
      await Updates.fetchUpdateAsync();
      setUpdatePopupState('downloaded');
    } catch (error) {
      console.log('⚠️ Error downloading update:', error);
      setUpdatePopupState('available');
    }
  }, []);

  const handleUpdateRestart = React.useCallback(() => {
    Updates.reloadAsync();
  }, []);

  const handleUpdateLater = React.useCallback(() => {
    setShowUpdatePopup(false);
    setUpdatePopupState('available');
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    'Oxanium-Regular': Oxanium_400Regular,
    'Oxanium-Medium': Oxanium_500Medium,
    'Oxanium-SemiBold': Oxanium_600SemiBold,
    'Oxanium-Bold': Oxanium_700Bold,
    'Lato-Thin': Lato_100Thin,
    'Lato-Thin-Italic': Lato_100Thin_Italic,
    'Lato-Light': Lato_300Light,
    'Lato-Light-Italic': Lato_300Light_Italic,
    'Lato-Regular': Lato_400Regular,
    'Lato-Italic': Lato_400Regular_Italic,
    'Lato-Bold': Lato_700Bold,
    'Lato-Bold-Italic': Lato_700Bold_Italic,
    'Lato-Black': Lato_900Black,
    'Lato-Black-Italic': Lato_900Black_Italic,
  });

  // Auto-login: Listen for redux-persist rehydration and check auth state
  useEffect(() => {
    console.log('🔐 Checking rehydration status...');

    const checkRehydration = () => {
      const persistorState = persistor.getState();

      if (persistorState.bootstrapped) {
        console.log('✅ Redux persist rehydration complete');

        // Check auth state from store
        const authState = store.getState().auth;
        console.log('🔍 Checking auth state:', {
          isAuthenticated: authState.isAuthenticated,
          hasAccessToken: !!authState.accessToken,
          hasUser: !!authState.user,
          userId: authState.user?.id,
        });

        // Determine initial route
        if (authState.isAuthenticated && authState.accessToken && authState.user?.id) {
          console.log('✅ User is authenticated - setting initial route to Dashboard');
          setInitialRoute('Dashboard');
        } else {
          console.log('ℹ️ User not authenticated - setting initial route to InitialScreen');
          setInitialRoute('InitialScreen');
        }

        setIsRehydrated(true);
      }
    };

    // Check immediately in case it's already bootstrapped
    checkRehydration();

    // Subscribe to persistor for updates
    const unsubscribe = persistor.subscribe(checkRehydration);

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Log font loading status for debugging
  useEffect(() => {
    if (fontError) {
      console.warn('Font loading error:', fontError);
    }
    if (fontsLoaded) {
      console.log('Fonts loaded successfully');
    }
  }, [fontsLoaded, fontError]);

  // Initialize Firebase messaging for push notifications (lazy-loaded so app works without native module)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { FirebaseMessagingService } = await import('./src/services/firebaseMessagingService');
        if (!cancelled) await FirebaseMessagingService.initialize();
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('RNFBAppModule') || msg.includes('Native module') || msg.includes('not found')) {
          if (__DEV__) console.warn('[Firebase] Native module not available. Run a development build (expo prebuild, pod install, rebuild) for push notifications.');
          return;
        }
        console.error('Failed to initialize Firebase messaging:', error);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      // Small delay to ensure smooth transition from splash screen
      setTimeout(async () => {
        await SplashScreen.hideAsync();
      }, 100);
    }
  }, [fontsLoaded, fontError]);

  // Show loading state until fonts and rehydration are ready
  if ((!fontsLoaded && !fontError) || !isRehydrated) {
    return null;
  }

  // Even if fonts fail to load, continue with the app (will use system fonts as fallback)
  if (fontError) {
    console.warn('Continuing with app despite font loading errors');
  }

  const AppTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#ffffff',
      card: '#ffffff',
    },
  };

  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <TokenRefreshManager />
          <View className="flex-1 bg-white" onLayout={onLayoutRootView}>
            <UpdatePopup
              visible={showUpdatePopup}
              state={updatePopupState}
              onDownload={handleUpdateDownload}
              onRestart={handleUpdateRestart}
              onLater={handleUpdateLater}
            />
            <NavigationContainer ref={navigationRef} theme={AppTheme}>
              <Stack.Navigator
                initialRouteName={initialRoute}
                screenOptions={{
                  headerShown: false,
                  animation: 'slide_from_right',
                  gestureEnabled: true,
                  fullScreenGestureEnabled: true,
                  freezeOnBlur: true,
                  contentStyle: { backgroundColor: '#ffffff' },
                }}>
                <Stack.Screen name="Login" component={Login} />
                <Stack.Screen name="WelcomeBack" component={WelcomeBack} />
                <Stack.Screen name="InitialScreen" component={InitialScreen} />
                <Stack.Screen name="PasswordReset" component={PasswordReset} />
                <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
                <Stack.Screen name="VerifyCode" component={VerifyCode} />
                <Stack.Screen name="SetPassword" component={SetPassword} />
                {/* Bottom Tab Navigator - Main app navigation */}
                <Stack.Screen
                  name="Dashboard"
                  component={BottomTabNavigator}
                  options={{
                    animation: 'slide_from_right',
                    gestureEnabled: false, // Disable iOS swipe-back gesture to prevent going back to login
                    fullScreenGestureEnabled: false, // Disable full-screen swipe gesture on iOS
                  }}
                />

                {/* Profile Screens */}
                <Stack.Screen
                  name="ProfileManagement"
                  component={ProfileManagement}
                  options={{
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="ProfileManagementSettings"
                  component={ProfileManagementSettings}
                  options={{
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="EditGeneralInfo"
                  component={EditGeneralInfo}
                  options={{
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="EditLoginInfo"
                  component={EditLoginInfo}
                  options={{
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="InfoAndSupport"
                  component={InfoAndSupport}
                  options={{
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="TermsAndPrivacy"
                  component={TermsAndPrivacy}
                  options={{
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="BlockedMembers"
                  component={BlockedMembers}
                  options={{
                    animation: 'slide_from_right',
                  }}
                />

                {/* Notice and Bulletin Screens */}
                {/* <Stack.Screen 
              name="NoticeBoard" 
              component={NoticeBoard}
              options={{
                animation: 'slide_from_right',
              }} */}

                <Stack.Screen
                  name="ShowNoticeBoard"
                  component={ShowNoticeBoard}
                  options={{
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="CreateBulletin"
                  component={CreateBulletinForm}
                  options={{
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="EditBulletin"
                  component={EditBulletinForm}
                  options={{
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="PendingBulletin"
                  component={PendingBulletin}
                  options={{
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="Archive"
                  component={Archive}
                  options={{
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="ReportBulletin"
                  component={ReportBulletin}
                  options={{
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="NotificationFeed"
                  component={NotificationFeedScreen}
                  options={{
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="ServiceFeePayment"
                  component={ServiceFeePaymentScreen}
                  options={{
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="MakePayment"
                  component={MakePaymentScreen}
                  options={{
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="BillDetail"
                  component={BillDetailScreen}
                  options={{
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="PaymentGateway"
                  component={PaymentGatewayScreen}
                  options={{
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="PaymentHistory"
                  component={PaymentHistoryScreen}
                  options={{
                    animation: 'slide_from_right',
                  }}
                />
                <Stack.Screen
                  name="ReceiptView"
                  component={ReceiptViewScreen}
                  options={{
                    animation: 'slide_from_right',
                  }}
                />
              </Stack.Navigator>
            </NavigationContainer>
          </View>
        </PersistGate>
      </Provider>
    </SafeAreaProvider>
  );
}

