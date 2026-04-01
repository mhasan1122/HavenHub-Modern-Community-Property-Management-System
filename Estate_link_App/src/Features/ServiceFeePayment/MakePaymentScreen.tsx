import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  Platform,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useServiceFee } from '../../hooks/useServiceFee';
import { useAppSelector } from '../../store/hooks';
import { SimpleTabBar } from '../../components/SimpleTabBar';
import {
  processSelectedPayments,
  validatePaymentData,
  parsePaymentId,
  generatePaymentSummary,
  formatAmount,
  sanitizeCustomerData,
  generateTransactionId,
  PaymentData,
  PaymentMonth
} from '../../utils/paymentUtils';
import { API_CONFIG, enhancedFetch } from '../../utils/networkUtils';
import Ionicons from '@expo/vector-icons/Ionicons';
import AntDesign from '@expo/vector-icons/AntDesign';
import SuccessPopup from '../../../components/SuccessPopup';
import ErrorPopup from '../../../components/ErrorPopup';
import PaymentAllocationModal from './PaymentAllocationModal';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing
} from 'react-native-reanimated';

interface MakePaymentScreenProps { }

interface SelectedPaymentMonth {
  month: number;
  year: number;
  amount: number;
}

// Loading Icon Component with rotation animation
const LoadingIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 24,
  color = 'white'
}) => {
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 1000,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <AntDesign name="loading-3-quarters" size={size} color={color} />
    </Animated.View>
  );
};

const MakePaymentScreen: React.FC<MakePaymentScreenProps> = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { unit, amount, selectedPayments, selectedPaymentData } = route.params as any;
  const { createNewPayment, isCreatingPayment, loadUnits, units } = useServiceFee();
  const { accessToken, isAuthenticated, isLoading: authLoading } = useAppSelector((state) => state.auth);

  console.log('📱 MakePaymentScreen render:', {
    unit: unit ? `${unit.tower_name}, ${unit.unit_name}` : 'none',
    unitId: unit?.id,
    amount,
    selectedPayments: selectedPayments?.size || 0,
    selectedPaymentData: selectedPaymentData?.length || 0,
    selectedPaymentDataDetails: selectedPaymentData,
    isCreatingPayment,
    hasAccessToken: !!accessToken,
    isAuthenticated,
    authLoading
  });

  // Check authentication when component mounts and redirect if not authenticated
  useEffect(() => {
    // Only check if auth is not loading (to avoid checking during rehydration)
    if (!authLoading && (!isAuthenticated || !accessToken)) {
      console.warn('⚠️ MakePaymentScreen: User not authenticated, redirecting to login');
      Alert.alert(
        'Authentication Required',
        'Please log in to continue.',
        [
          {
            text: 'OK',
            onPress: () => {
              (navigation as any).reset({
                index: 0,
                routes: [{ name: 'Login' as never }],
              });
            },
          },
        ]
      );
    }
  }, [isAuthenticated, accessToken, authLoading, navigation]);

  const [activeTab, setActiveTab] = useState('services');
  const [refreshing, setRefreshing] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successAmount, setSuccessAmount] = useState('0');
  // Store as integer string (no decimals), format display as 12,590
  const initialAmount = (() => {
    const n = parseFloat(String(amount ?? '0')) || 0;
    const int = Math.round(n);
    return int > 0 ? String(int) : '';
  })();
  const [editableAmount, setEditableAmount] = useState(initialAmount);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Load units with extended date range on component mount
  useEffect(() => {
    const loadUnitsWithExtendedRange = async () => {
      try {
        console.log('🔄 MakePaymentScreen loading units on mount...');
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();

        // Calculate 6 months ahead to include future payments (including January 2026)
        const futureMonthCount = currentMonth + 6;
        const futureMonth = futureMonthCount > 12 ? futureMonthCount - 12 : futureMonthCount;
        const futureYear = futureMonthCount > 12 ? currentYear + 1 : currentYear;

        console.log('📅 Loading units on mount with date range:', {
          from: '2020-01',
          to: `${futureYear}-${futureMonth.toString().padStart(2, '0')}`,
          currentMonth,
          currentYear,
          futureMonth,
          futureYear
        });

        await loadUnits({
          stats: true,
          service_period_month_from: 1,
          service_period_year_from: 2020,
          service_period_month_to: futureMonth,
          service_period_year_to: futureYear
        });

        console.log('✅ MakePaymentScreen units loaded on mount');
      } catch (error) {
        console.error('❌ MakePaymentScreen load units error:', error);
      }
    };

    loadUnitsWithExtendedRange();
  }, [loadUnits]);

  const tabs = [
    {
      name: 'home',
      icon: require('../../../assets/Home.png'),
      label: 'Home'
    },
    {
      name: 'info',
      icon: require('../../../assets/Info.png'),
      label: 'Info'
    },
    {
      name: 'services',
      icon: require('../../../assets/Services.png'),
      label: 'Services'
    },
    {
      name: 'feed',
      icon: require('../../../assets/Feed.png'),
      label: 'Feed'
    },
    {
      name: 'activity',
      icon: require('../../../assets/Activity.png'),
      label: 'Activity'
    },
  ];

  const handleTabPress = (tabName: string) => {
    setActiveTab(tabName);

    // Navigate back to Dashboard - it contains the BottomTabNavigator with all tabs
    navigation.navigate('Dashboard');
  };

  const onRefresh = async () => {
    console.log('🔄 MakePaymentScreen refresh triggered');
    setRefreshing(true);
    try {
      // Refresh service fee data with extended date range to include future months
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();

      // Calculate 6 months ahead to include future payments (including January 2026)
      const futureMonthCount = currentMonth + 6;
      const futureMonth = futureMonthCount > 12 ? futureMonthCount - 12 : futureMonthCount;
      const futureYear = futureMonthCount > 12 ? currentYear + 1 : currentYear;

      console.log('📅 Loading units with date range:', {
        from: '2020-01',
        to: `${futureYear}-${futureMonth.toString().padStart(2, '0')}`,
        currentMonth,
        currentYear,
        futureMonth,
        futureYear
      });

      await loadUnits({
        stats: true,
        service_period_month_from: 1,
        service_period_year_from: 2020,
        service_period_month_to: futureMonth,
        service_period_year_to: futureYear
      });

      console.log('✅ MakePaymentScreen refresh completed');
    } catch (error) {
      console.error('❌ MakePaymentScreen refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAmountChange = (text: string) => {
    // Remove any non-numeric characters (no decimals allowed)
    const cleanedText = text.replace(/[^0-9]/g, '');
    setEditableAmount(cleanedText);
  };

  const validateAmount = () => {
    const enteredAmount = parseFloat(editableAmount);
    const originalAmount = parseFloat(amount);

    if (isNaN(enteredAmount) || enteredAmount <= 0) {
      setErrorMessage('Please enter a valid amount greater than 0');
      setShowErrorPopup(true);
      return false;
    }

    return true;
  };

  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [allocationData, setAllocationData] = useState<any>(null);

  const getMonthName = (month: number) => {
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return monthNames[month - 1] || '';
  };

  const calculateAllocationData = (enteredAmount: number) => {
    // Calculate actual unit ID
    const parsedId = typeof unit.id === 'string' && String(unit.id).startsWith('SF-') ? parsePaymentId(unit.id) : null;
    const actualUnitId = unit.unit_id ?? (typeof unit.id === 'number' ? unit.id : (parsedId?.unitId ?? NaN));

    const matchesUnit = (u: any) => {
      const idMatch = actualUnitId != null && !isNaN(Number(actualUnitId)) && u.unit_id === actualUnitId;
      const unitIdMatch = unit.unit_id && u.unit_id === unit.unit_id;
      const nameMatch = u.tower_name === unit.tower_name && u.unit_name === unit.unit_name;
      
      return (idMatch || unitIdMatch || nameMatch) && u.service_period_month && u.service_period_year;
    };

    // Get all bills for this unit (including future bills created by PayStation)
    let allUnitBills = (units || []).filter(matchesUnit);
    allUnitBills.sort((a: any, b: any) => {
      if (a.service_period_year !== b.service_period_year) return a.service_period_year - b.service_period_year;
      return a.service_period_month - b.service_period_month;
    });

    // Separate into outstanding and future bills
    let eligibleBills = allUnitBills.filter((u: any) => {
      const hasAmountDue = parseFloat(u.due_amount || '0') > 0 ||
        u.service_status === 'due' ||
        u.service_status === 'partial' ||
        u.service_status === 'overdue';
      return hasAmountDue;
    });

    // Future bills (paid status or zero due amount but exists in system)
    let futureBills = allUnitBills.filter((u: any) => {
      const isPaid = u.service_status === 'paid';
      const hasNoDueAmount = parseFloat(u.due_amount || '0') === 0;
      const isFuture = u.service_period_year > new Date().getFullYear() || 
        (u.service_period_year === new Date().getFullYear() && u.service_period_month >= new Date().getMonth() + 1);
      return (isPaid || hasNoDueAmount) && isFuture;
    });

    let targetBills: any[] = [];
    
    // Determine which bills are being paid
    if (selectedPaymentData && selectedPaymentData.length > 0) {
       // Using route params data
       targetBills = selectedPaymentData.map((p: any) => {
          const original = units.find((u: any) => u.service_period_month === p.month && u.service_period_year === p.year);
          return {
             month: getMonthName(p.month),
             year: p.year,
             amountDue: p.amount,
             originalDue: parseFloat(original?.due_amount || String(p.amount))
          };
       });
    } else if (selectedPayments && selectedPayments.size > 0) {
       // Using selected map
       const processed = processSelectedPayments(selectedPayments, units);
       targetBills = processed.map(p => {
          const original = units.find((u: any) => u.service_period_month === p.month && u.service_period_year === p.year);
          return {
             month: getMonthName(p.month),
             year: p.year,
             amountDue: p.amount,
             originalDue: parseFloat(original?.due_amount || String(p.amount))
          };
       });
    } else {
       // No selection -> using eligible bills (oldest first), then future bills
       targetBills = eligibleBills.map((b: any) => ({
          month: getMonthName(b.service_period_month),
          year: b.service_period_year,
          amountDue: parseFloat(b.due_amount || '0'),
          originalDue: parseFloat(b.due_amount || '0')
       }));
    }

    // Distribute payment to outstanding bills first
    let remainingPayment = enteredAmount;
    const allocatedBills = [];
    
    for (const bill of targetBills) {
       if (remainingPayment <= 0) break;
       
       const payAmount = Math.min(remainingPayment, bill.amountDue);
       remainingPayment -= payAmount;
       
       allocatedBills.push({
          month: bill.month,
          year: bill.year,
          amountDue: bill.originalDue,
          paying: payAmount,
          status: payAmount >= bill.amountDue ? 'Fully Paid' : 'Partially Paid'
       });
    }

    // If there's still remaining payment and no specific selection was made, 
    // allocate to future bills created by PayStation
    if (remainingPayment > 0 && !selectedPaymentData && !selectedPayments) {
       for (const futureBill of futureBills) {
          if (remainingPayment <= 0) break;
          
          // Use fee_amount for future bills
          const billAmount = parseFloat(futureBill.fee_amount || futureBill.billing_amount || '0');
          if (billAmount <= 0) continue;
          
          const payAmount = Math.min(remainingPayment, billAmount);
          remainingPayment -= payAmount;
          
          allocatedBills.push({
             month: getMonthName(futureBill.service_period_month),
             year: futureBill.service_period_year,
             amountDue: billAmount,
             paying: payAmount,
             status: payAmount >= billAmount ? 'Fully Paid' : 'Partially Paid'
          });
       }
    }

    // Total outstanding includes all bills we're allocating payment to (both outstanding and future)
    const totalOutstanding = allocatedBills.reduce((sum, b) => sum + b.amountDue, 0);

    return {
       totalPayment: enteredAmount,
       totalOutstanding,
       allocatedBills,
       advanceAmount: remainingPayment
    };
  };

  const handlePayNow = async () => {
    console.log('💳 MakePaymentScreen handlePayNow called:', {
      originalAmount: amount,
      editableAmount: editableAmount,
      unit: unit ? `${unit.tower_name}, ${unit.unit_name}` : 'none'
    });

    // Validate amount before proceeding
    if (!validateAmount()) {
      return;
    }

    const enteredAmount = parseFloat(editableAmount);
    const originalAmount = parseFloat(amount || '0');

    const executePayment = async () => {
      try {
        setIsProcessingPayment(true);
        // Always proceed with PayStation payment
        await handlePayStationPayment();
      } catch (error: any) {
        console.error('Error in executePayment:', error);
        Alert.alert(
          'Error',
          error?.message || error?.toString() || 'Failed to process payment. Please try again.',
          [{ text: 'OK' }]
        );
      } finally {
        setIsProcessingPayment(false);
      }
    };

    // Check for advance payment (paying more than due) OR Custom amount (when nothing selected)
    // If originalAmount is 0 (no bills selected), any valid payment (enteredAmount > 0) should trigger the modal
    if (enteredAmount > originalAmount) {
      const allocation = calculateAllocationData(enteredAmount);
      setAllocationData(allocation);
      setShowAllocationModal(true);
    } else {
      await executePayment();
    }
  };

  const handlePayStationPayment = async () => {
    try {
      console.log('💳 Initializing PayStation payment...');
      console.log('📋 Unit data:', {
        id: unit.id,
        unit_id: unit.unit_id,
        service_fee_id: unit.service_fee_id,
        unit_name: unit.unit_name,
        tower_name: unit.tower_name
      });

      // Get customer information from unit and sanitize it
      const customerInfo = sanitizeCustomerData({
        name: unit.primary_name || unit.secondary_name,
        email: unit.primary_email || unit.secondary_email,
        phone: unit.primary_number || unit.secondary_number,
        address: `${unit.tower_name}, ${unit.unit_name}`
      });

      // Prepare payment initialization data
      // IMPORTANT: Use unit_id (the actual database ID), not id (which is a composite key)
      // Extract unit_id - handle composite ID format (SF-2-23-202512-2)
      const parsedId = typeof unit.id === 'string' && String(unit.id).startsWith('SF-') ? parsePaymentId(unit.id) : null;
      const actualUnitId = unit.unit_id ?? (typeof unit.id === 'number' ? unit.id : (parsedId?.unitId ?? NaN));

      // Process selected payments using the utility function
      // Use selectedPaymentData from route params if available (more reliable)
      // Otherwise fall back to processing from units array
      // When nothing selected (custom amount), behaviour differs:
      // - If there are UNPAID months -> send all unpaid months so backend can distribute across bills
      // - If there are NO unpaid months -> treat as PURE ADVANCE payment (no months sent)
      let selectedPaymentMonths: PaymentMonth[];

      if (selectedPaymentData && selectedPaymentData.length > 0) {
        console.log('✅ Using selectedPaymentData from route params');
        selectedPaymentMonths = selectedPaymentData;
      } else {
        selectedPaymentMonths = processSelectedPayments(selectedPayments, units);
        if (selectedPaymentMonths.length === 0) {
          // Nothing explicitly selected – this is the "custom amount" path.
          // Decide whether to treat as bill payment (distribute across unpaid months)
          // or as PURE ADVANCE (no unpaid months).
          const matchesUnit = (u: any) => {
            const idMatch = actualUnitId != null && !isNaN(Number(actualUnitId)) && u.unit_id === actualUnitId;
            const unitIdMatch = unit.unit_id && u.unit_id === unit.unit_id;
            const nameMatch = u.tower_name === unit.tower_name && u.unit_name === unit.unit_name;
            // Only include unpaid/partial payments
            const hasAmountDue = parseFloat(u.due_amount || '0') > 0 || 
                                 u.service_status === 'due' || 
                                 u.service_status === 'partial' || 
                                 u.service_status === 'overdue';
            return (idMatch || unitIdMatch || nameMatch) && u.service_period_month && u.service_period_year && hasAmountDue;
          };
          const unitPayments = (units || []).filter(matchesUnit);
          unitPayments.sort((a: any, b: any) => {
            if (a.service_period_year !== b.service_period_year) return a.service_period_year - b.service_period_year;
            return a.service_period_month - b.service_period_month;
          });
          
          if (unitPayments.length > 0) {
            // There ARE unpaid months – send ALL unpaid months so backend can
            // distribute the custom amount across them (bill payment mode).
            console.log('✅ Custom amount: Sending ALL unpaid months to backend:', unitPayments.length);
            selectedPaymentMonths = unitPayments.map((payment: any) => ({
              month: payment.service_period_month,
              year: payment.service_period_year,
              amount: parseFloat(payment.due_amount || payment.remaining_amount || '0')
            }));
            console.log('📋 All unpaid months:', selectedPaymentMonths);
          } else {
            // IMPORTANT: No unpaid months -> this MUST be treated as PURE ADVANCE.
            // Do NOT synthesize a fake current-month bill here, otherwise the
            // backend will create a new monthly card (e.g. February) instead of
            // increasing the advance balance.
            console.log('✅ Custom amount: No unpaid months found – treating as PURE ADVANCE payment');
            selectedPaymentMonths = [];
          }
        } else {
          console.log('⚠️ Falling back to processSelectedPayments from units array');
        }
      }

      console.log('📅 PayStation selected payment months (sorted oldest first):', selectedPaymentMonths);
      console.log('🔍 Total selected months:', selectedPaymentMonths.length);

      // Validate payment data
      const paymentData: Partial<PaymentData> = {
        unitId: actualUnitId,
        serviceFeeId: unit.service_fee_id,
        amount: parseFloat(editableAmount),
        selectedPayments: selectedPaymentMonths,
        customerInfo
      };

      const validation = validatePaymentData(paymentData);

      if (!validation.isValid) {
        console.error('❌ Payment validation failed:', validation.errors);
        Alert.alert(
          'Payment Validation Error',
          validation.errors.join('\n'),
          [{ text: 'OK' }]
        );
        return;
      }

      // Show warnings if any
      if (validation.warnings.length > 0) {
        console.warn('⚠️ Payment validation warnings:', validation.warnings);
      }

      // Determine if this is advance payment: no bills selected AND amount > 0
      const isAdvancePaymentMode = selectedPaymentMonths.length === 0 && parseFloat(editableAmount) > 0;

      // Use the first month from sorted list (oldest month) ONLY for normal bill payments.
      // For pure advance payments we still need to send *some* period to satisfy backend
      // type-casting, but it will be ignored by the dedicated advance branch.
      let firstSelectedMonth: PaymentMonth | null = null;
      if (!isAdvancePaymentMode && selectedPaymentMonths.length > 0) {
        firstSelectedMonth = selectedPaymentMonths[0];
      } else {
        const currentDate = new Date();
        firstSelectedMonth = {
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
          amount: parseFloat(editableAmount)
        };
      }
      console.log('✅ Using first selected month (oldest or placeholder):', firstSelectedMonth);
      
      const paymentInitData = {
        unit_id: actualUnitId,
        service_fee_id: unit.service_fee_id,
        amount: parseFloat(editableAmount),
        service_period_month: firstSelectedMonth?.month,
        service_period_year: firstSelectedMonth?.year,
        selected_payments: selectedPaymentMonths, // Send all selected months
        is_advance_payment: isAdvancePaymentMode, // Auto-detect: no bills selected = advance payment
        customer_name: customerInfo.name,
        customer_email: customerInfo.email,
        customer_phone: customerInfo.phone,
        customer_address: customerInfo.address,
      };

      console.log('📡 PayStation init data:', paymentInitData);
      console.log('📡 Unit IDs - unit.id:', unit.id, ', unit.unit_id:', unit.unit_id, ', using:', actualUnitId);
      console.log('💰 Advance Payment Mode (auto-detected):', isAdvancePaymentMode);

      // Check authentication before making API call
      if (!accessToken) {
        console.error('❌ MakePaymentScreen: No access token available');
        Alert.alert(
          'Authentication Error',
          'Your session has expired. Please log in again.',
          [
            {
              text: 'OK',
              onPress: () => {
                (navigation as any).reset({
                  index: 0,
                  routes: [{ name: 'Login' as never }],
                });
              },
            },
          ]
        );
        return;
      }

      // Call backend API to initialize payment using enhancedFetch with authentication
      const response = await enhancedFetch(
        `${API_CONFIG.BASE_URL}/api/service-fee-management/payments/paystation/init/`,
        {
          method: 'POST',
          body: JSON.stringify(paymentInitData),
        },
        API_CONFIG.TIMEOUT,
        accessToken
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || 'Failed to initialize payment gateway';
        console.error('❌ PayStation init failed:', errorMessage);

        // If it's an authentication error, redirect to login
        if (response.status === 401) {
          Alert.alert(
            'Authentication Error',
            'Your session has expired. Please log in again.',
            [
              {
                text: 'OK',
                onPress: () => {
                  (navigation as any).reset({
                    index: 0,
                    routes: [{ name: 'Login' as never }],
                  });
                },
              },
            ]
          );
          return;
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('📡 PayStation init response:', result);

      if (result.success && result.payment_url) {
        // Navigate to payment gateway screen
        console.log('✅ Navigating to payment gateway with URL:', result.payment_url);

        if (!result.invoice_number) {
          throw new Error('Invoice number not received from payment gateway');
        }

        (navigation as any).navigate('PaymentGateway', {
          gatewayUrl: result.payment_url,
          transactionId: result.invoice_number,
          invoiceNumber: result.invoice_number,
          amount: editableAmount,
          unitName: `${unit.tower_name || ''}, ${unit.unit_name || ''}`,
          gateway: 'paystation'
        });
      } else {
        // Check if payment already completed
        if (result.message && result.message.includes('already been completed')) {
          Alert.alert(
            'Payment Already Completed',
            result.message,
            [
              {
                text: 'OK',
                onPress: () => navigation.goBack()
              }
            ]
          );
        } else {
          throw new Error(result.message || result.error || 'Failed to initialize payment gateway');
        }
      }
    } catch (error: any) {
      console.error('❌ PayStation payment initialization error:', error);
      setIsProcessingPayment(false);
      const errorMessage = error?.message || error?.toString() || 'Failed to initialize payment. Please try again.';
      Alert.alert(
        'Payment Gateway Error',
        errorMessage,
        [{ text: 'OK' }]
      );
    }
  };

  const onConfirmAllocation = async () => {
    setShowAllocationModal(false);
    
    try {
      setIsProcessingPayment(true);
      // Always proceed with PayStation payment
      await handlePayStationPayment();
    } catch (error: any) {
      console.error('Error in onConfirmAllocation:', error);
      Alert.alert(
        'Error',
        error?.message || error?.toString() || 'Failed to process payment. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#3C9D9B" />
        <Text className="text-gray-600 mt-4 font-lato">Checking authentication...</Text>
      </SafeAreaView>
    );
  }

  // Don't render if not authenticated (redirect will happen via useEffect)
  if (!isAuthenticated || !accessToken) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#3C9D9B" />
        <Text className="text-gray-600 mt-4 font-lato">Redirecting to login...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View className="px-4 py-3 flex-row items-center border-b border-gray-200">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="flex-row items-center pr-3"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={20} color="#3C9D9B" />
        </TouchableOpacity>
        <Text className="text-text-primary text-xl font-oxanium-bold">
          Make Payment
        </Text>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-56"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3C9D9B']}
            tintColor="#3C9D9B"
          />
        }
      >
        {/* Amount to Pay Section */}
        <View className="items-center py-8 border-b border-gray-200">
          <Text className="text-black text-xl font-lato-bold mb-3">
            Selected Total Amount
          </Text>
          <Text className="text-gray-600 text-3xl font-lato-bold mb-4">
            Tk {parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </Text>

          {/* Editable Amount Section */}
          <Text className="text-black text-xl font-lato-bold mb-3 mt-4">
            Amount to Pay
          </Text>
          <View className="flex-row items-center justify-center mb-4">
            <Text className="text-primary text-3xl font-lato-bold mr-2">Tk</Text>
            <TextInput
              value={editableAmount === '' ? '' : (parseInt(editableAmount, 10) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
              onChangeText={handleAmountChange}
              keyboardType="number-pad"
              placeholder="0"
              selectTextOnFocus
              className="text-primary text-5xl font-lato-bold border-b-2 border-primary min-w-[150px] text-center"
              style={{
                paddingVertical: 4
              }}
            />
          </View>
          
          <Text className="text-gray-900 text-base font-lato text-center px-2 mb-2">
            Note: Partial payments are applied to the oldest overdue month first.
          </Text>
          <Text className="text-gray-600 text-sm font-lato text-center px-2">
            {parseFloat(amount) > 0
              ? 'Overpayment will be saved as advance credit for future bills'
              : 'Enter the amount you wish to pay. Any amount will be saved as advance credit.'}
          </Text>
        </View>
      </ScrollView>

      {/* Fixed Bottom Container - Terms, Pay Button + Tab Bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-white">
        {/* Terms and Privacy Notice */}
        <View className="border-t border-gray-200 px-6 py-3">
          <Text className="text-black text-base font-lato text-center leading-5">
            By proceeding, you confirm that you have read and agree to{' '}
            <Text className="text-primary font-lato-bold">Estate Link Terms of Use</Text> and{' '}
            <Text className="text-primary font-lato-bold">Privacy Notice</Text>.
          </Text>
        </View>

        {/* Pay Now Button */}
        <View className="px-4 pb-2">
          <TouchableOpacity
            className="bg-primary items-center py-4 rounded-lg"
            onPress={handlePayNow}
            disabled={isProcessingPayment}
            activeOpacity={0.8}
          >
            {isProcessingPayment ? (
              <LoadingIcon size={24} color="white" />
            ) : (
              <Text className="text-white font-lato-bold text-xl">
                Pay Now
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Bottom Tab Navigation */}
        <SimpleTabBar
          tabs={tabs}
          activeTab={activeTab}
          onTabPress={handleTabPress}
        />
      </View>

      {/* Success Popup */}
      <SuccessPopup
        visible={showSuccessPopup}
        onClose={() => {
          setShowSuccessPopup(false);
          navigation.navigate('ServiceFeePayment' as never);
        }}
        title="Payment Successful!"
        message={`Your payment of Tk ${parseFloat(successAmount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} has been processed successfully!`}
        buttonText="OK"
      />

      {/* Error Popup */}
      <ErrorPopup
        visible={showErrorPopup}
        onClose={() => setShowErrorPopup(false)}
        title="Invalid Amount"
        message={errorMessage}
        buttonText="OK"
      />

      <PaymentAllocationModal
        visible={showAllocationModal}
        onClose={() => setShowAllocationModal(false)}
        onConfirm={onConfirmAllocation}
        data={allocationData}
      />
    </SafeAreaView>
  );
};

export default MakePaymentScreen;

