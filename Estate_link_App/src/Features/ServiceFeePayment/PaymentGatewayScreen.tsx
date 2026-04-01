import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import SuccessPopup from '../../../components/SuccessPopup';
import CancelPaymentModal from '../../../components/CancelPaymentModal';

interface PaymentGatewayScreenProps {}

const PaymentGatewayScreen: React.FC<PaymentGatewayScreenProps> = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { gatewayUrl, transactionId, invoiceNumber, amount, unitName, gateway = 'paystation' } = route.params as any;
  
  const webViewRef = useRef<WebView>(null);
  const failureOrCancelHandledRef = useRef(false);
  const lastProcessedUrlRef = useRef<string>(''); // Track last processed URL to prevent duplicate handling
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [paymentTimeout, setPaymentTimeout] = useState<NodeJS.Timeout | null>(null);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [validationInProgress, setValidationInProgress] = useState(false);

  const goBackFromGateway = () => {
    setLoading(false);
    failureOrCancelHandledRef.current = true;
    if ((navigation as any).navigate) {
      (navigation as any).navigate('ServiceFeePayment');
    } else {
      navigation.goBack();
    }
  };

  // Only log render in development to reduce noise
  if (__DEV__) {
    console.log('💳 PaymentGatewayScreen render:', {
      gatewayUrl,
      transactionId,
      invoiceNumber,
      amount,
      unitName,
      gateway,
    });
  }

  // Clean up pending payment when component unmounts without successful payment
  useEffect(() => {
    return () => {
      // Only cancel if payment wasn't completed
      if (!paymentCompleted) {
        console.log('🧹 PaymentGatewayScreen unmounting, cleaning up pending payment');
        cancelPendingPayment();
      }
    };
  }, [paymentCompleted, invoiceNumber]);

  const cancelPendingPayment = async () => {
    try {
      console.log('🚫 Cancelling pending payment:', invoiceNumber || transactionId);
      
      const { getBackendURL } = await import('../../config/environment');
      const baseURL = getBackendURL();
      
      // PayStation uses invoice_number for cancellation
      const response = await fetch(`${baseURL}/api/service-fee-management/payments/paystation/cancel/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoice_number: invoiceNumber || transactionId,
        }),
      });

      const result = await response.json();
      console.log('✅ Payment cancellation result:', result);
    } catch (error) {
      console.error('❌ Error cancelling payment:', error);
    }
  };

  const handleNavigationStateChange = (navState: any) => {
    const rawUrl = navState?.url || '';
    const url = rawUrl.toLowerCase();
    const isOurCallback =
      url.includes('/paystation/success') ||
      url.includes('/paystation/fail') ||
      url.includes('/paystation/cancel');

    // For our callback URLs: mark as processed first and skip duplicates immediately (no setState)
    if (isOurCallback) {
      if (rawUrl === lastProcessedUrlRef.current) {
        return;
      }
      lastProcessedUrlRef.current = rawUrl;
    }

    if (__DEV__) {
      console.log('📍 WebView navigation:', rawUrl);
    }
    setCanGoBack(navState.canGoBack);

    // Ignore intermediate PayStation URLs (3D verification, checkout)
    if (
      url.includes('paystation.com.bd') &&
      (url.includes('/sebl/pay/get') ||
        url.includes('/checkout/') ||
        url.includes('is_3d_verified'))
    ) {
      return;
    }

    // Parse query parameters from URL
    const parseQueryParams = (urlString: string): Record<string, string> => {
      try {
        const urlObj = new URL(urlString);
        const params: Record<string, string> = {};
        urlObj.searchParams.forEach((value, key) => {
          params[key.toLowerCase()] = value;
        });
        return params;
      } catch {
        return {};
      }
    };

    const queryParams = parseQueryParams(navState.url);
    const statusParam = queryParams.status?.toLowerCase();

    if (__DEV__) {
      console.log('🔍 URL Analysis:', {
        url: navState.url,
        gateway,
        statusParam,
        hasPayStationSuccess: url.includes('/paystation/success'),
        hasPayStationFail: url.includes('/paystation/fail'),
        hasPayStationCancel: url.includes('/paystation/cancel'),
      });
    }

    if (url.includes('/paystation/success')) {
      if (statusParam && !['success', 'successful'].includes(statusParam)) {
        if (failureOrCancelHandledRef.current) {
          return;
        }
        failureOrCancelHandledRef.current = true;
        if (__DEV__) {
          console.log('❌ Payment callback indicates failure:', statusParam);
        }
        setLoading(false);

        let errorMessage =
          queryParams.message || 'Payment could not be processed. Please try again.';
        try {
          errorMessage = decodeURIComponent(errorMessage);
        } catch {
          // keep original if decode fails
        }

        const lower = errorMessage.toLowerCase();
        let messageToShow = errorMessage;
        if (lower.includes('password attempts exceeded')) {
          messageToShow =
            'Payment gateway is temporarily unavailable. Please contact support or try again later.';
        } else if (
          lower.includes('password') ||
          lower.includes('authentication')
        ) {
          messageToShow =
            'Payment gateway connection error. Please try again later or contact support.';
        } else if (
          lower.includes('invalid payment state') ||
          lower.includes('invalid payment')
        ) {
          messageToShow =
            'The payment session expired or was invalid. Please try again.';
        }

        setTimeout(() => {
          Alert.alert(
            'Payment Failed',
            messageToShow,
            [{ text: 'OK', onPress: goBackFromGateway }],
            { cancelable: false }
          );
        }, 100);
        return;
      }
      
      // Prevent duplicate success handling
      if (paymentCompleted) {
        console.log('⚠️ Payment success already handled, skipping duplicate callback');
        return;
      }
      
      console.log('✅ Payment successful - showing success popup');
      setPaymentCompleted(true); // Mark payment as completed to prevent cleanup
      setLoading(false);
      setValidationInProgress(true);
      
      // Show success popup immediately (optimistic UI)
      // Backend validation happens asynchronously
      setTimeout(() => {
        setShowSuccessPopup(true);
        setValidationInProgress(false);
      }, 500); // Reduced from 1000ms to 500ms for faster response
    } else if (url.includes('/paystation/fail')) {
      if (failureOrCancelHandledRef.current) return;
      failureOrCancelHandledRef.current = true;
      if (__DEV__) console.log('❌ Payment failed - showing error alert');
      setLoading(false);

      let failMessage =
        queryParams.message || 'Your payment could not be processed. Please try again.';
      try {
        failMessage = decodeURIComponent(failMessage);
      } catch {
        // keep original
      }
      const lowerFail = failMessage.toLowerCase();
      if (lowerFail.includes('password attempts exceeded')) {
        failMessage =
          'Payment gateway is temporarily unavailable. Please contact support or try again later.';
      } else if (
        lowerFail.includes('password') ||
        lowerFail.includes('authentication')
      ) {
        failMessage =
          'Payment gateway connection error. Please try again later or contact support.';
      } else if (
        lowerFail.includes('invalid payment state') ||
        lowerFail.includes('invalid payment')
      ) {
        failMessage =
          'The payment session expired or was invalid. Please try again.';
      }
      setTimeout(() => {
        Alert.alert(
          'Payment Failed',
          failMessage,
          [{ text: 'OK', onPress: goBackFromGateway }],
          { cancelable: false }
        );
      }, 100);
    } else if (
      url.includes('/paystation/cancel') ||
      (url.includes('cancel') && url.includes('paystation'))
    ) {
      if (failureOrCancelHandledRef.current) return;
      failureOrCancelHandledRef.current = true;
      if (__DEV__) console.log('🚫 Payment cancelled - showing cancel alert');
      setLoading(false);
      setTimeout(() => {
        Alert.alert(
          'Payment Cancelled',
          'You have cancelled the payment.',
          [{ text: 'OK', onPress: goBackFromGateway }],
          { cancelable: false }
        );
      }, 100);
    } else if (
      (url.includes('error') || url.includes('failed')) &&
      url.includes('paystation')
    ) {
      if (failureOrCancelHandledRef.current) return;
      failureOrCancelHandledRef.current = true;
      if (__DEV__) console.log('❌ Payment error detected - showing error alert');
      setLoading(false);
      let errMessage =
        queryParams.message || 'An error occurred during payment processing.';
      try {
        errMessage = decodeURIComponent(errMessage);
      } catch {
        // keep original
      }
      const lowerErr = errMessage.toLowerCase();
      if (
        lowerErr.includes('invalid payment state') ||
        lowerErr.includes('invalid payment')
      ) {
        errMessage =
          'The payment session expired or was invalid. Please try again.';
      }
      setTimeout(() => {
        Alert.alert(
          'Payment Error',
          errMessage,
          [{ text: 'OK', onPress: goBackFromGateway }],
          { cancelable: false }
        );
      }, 100);
    }
  };

  const handleWebViewError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('❌ WebView error:', nativeEvent);
    
    Alert.alert(
      'Connection Error',
      'Failed to load payment gateway. Please check your internet connection and try again.',
      [
        {
          text: 'Retry',
          onPress: () => {
            webViewRef.current?.reload();
          },
        },
        {
          text: 'Cancel',
          onPress: () => {
            navigation.goBack();
          },
          style: 'cancel',
        },
      ]
    );
  };

  const handleBackPress = () => {
    setShowCancelModal(true);
  };

  const handleCancelPayment = async () => {
    setShowCancelModal(false);
    await cancelPendingPayment();
    navigation.goBack();
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View className="px-4 py-3 flex-row items-center border-b border-gray-200">
        <TouchableOpacity
          onPress={handleBackPress}
          className="flex-row items-center pr-3"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={20} color="black" />
        </TouchableOpacity>
        <Text className="text-text-primary text-lg font-semibold font-lato-bold">
          Payment Gateway
        </Text>
      </View>

      {/* Payment Info Bar */}
      <View className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <Text className="text-black text-lg font-lato">
          Unit: <Text className="font-lato-bold">{unitName}</Text>
        </Text>
        <Text className="text-black text-lg font-lato">
          Amount: <Text className="font-lato-bold text-primary">Tk {parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Text>
        </Text>
        <Text className="text-black text-lg font-lato">
          <Text className="font-lato">Invoice:</Text>
          <Text className="font-lato-bold">{invoiceNumber || transactionId}</Text>
        </Text>
      </View>

      {/* WebView - hidden after success so user only sees the success modal, not the API response page */}
      <View className="flex-1">
        {loading && !paymentCompleted && (
          <View className="absolute top-0 left-0 right-0 bottom-0 items-center justify-center bg-white z-10">
            <ActivityIndicator size="large" color="#3C9D9B" />
            <Text className="text-gray-600 text-base font-lato mt-4">
              {validationInProgress ? 'Processing payment...' : 'Loading payment gateway...'}
            </Text>
            {loadProgress > 0 && loadProgress < 100 && (
              <View className="w-64 h-1 bg-gray-200 rounded-full mt-4 overflow-hidden">
                <View 
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${loadProgress}%` }}
                />
              </View>
            )}
            {validationInProgress && (
              <Text className="text-gray-500 text-sm font-lato mt-2">
                Please wait while we verify your payment...
              </Text>
            )}
          </View>
        )}

        {paymentCompleted ? (
          <View className="flex-1 bg-white" />
        ) : (
          <WebView
            ref={webViewRef}
            source={{ uri: gatewayUrl }}
            onLoadStart={() => {
              setLoading(true);
              setLoadProgress(0);
            }}
            onLoadProgress={({ nativeEvent }) => {
              setLoadProgress(nativeEvent.progress * 100);
            }}
            onLoadEnd={() => {
              setLoading(false);
              setLoadProgress(100);
            }}
            onNavigationStateChange={handleNavigationStateChange}
            onError={handleWebViewError}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.warn('⚠️ WebView HTTP error:', nativeEvent.statusCode);
            }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={false}
            scalesPageToFit={true}
            mixedContentMode="always"
            allowsBackForwardNavigationGestures={false}
            cacheEnabled={true}
            androidLayerType="hardware"
            style={{ flex: 1 }}
          />
        )}
      </View>

      {/* Bottom Info Bar */}
      <View className="px-4 py-2 bg-gray-50 border-t border-gray-200">
        <View className="flex-row items-center">
          <Ionicons name="shield-checkmark" size={16} color="#3C9D9B" />
          <Text className="text-gray-600 text-xs font-lato ml-2">
            Secured by PayStation
          </Text>
        </View>
      </View>

      {/* Success Popup */}
      <SuccessPopup
        visible={showSuccessPopup}
        onClose={() => {
          setShowSuccessPopup(false);
          // Navigate directly to ServiceFeePaymentScreen, skipping MakePaymentScreen
          // This ensures we go back to the main service fee page after successful payment
          (navigation as any).navigate('ServiceFeePayment');
        }}
        title="Payment Successful!"
        message={`Your payment of Tk ${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} for ${unitName} has been processed successfully!`}
        buttonText="OK"
      />

      {/* Cancel Payment Modal */}
      <CancelPaymentModal
        visible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelPayment}
        transactionId={invoiceNumber || transactionId}
        amount={amount}
        unitName={unitName}
      />
    </SafeAreaView>
  );
};

export default PaymentGatewayScreen;

