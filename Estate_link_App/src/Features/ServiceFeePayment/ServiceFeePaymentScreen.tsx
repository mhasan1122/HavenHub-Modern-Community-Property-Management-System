import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StatusBar,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Dimensions,
  TouchableWithoutFeedback,
  AppState
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useServiceFee } from '../../hooks/useServiceFee';
import { useAppSelector } from '../../store/hooks';
import { API_CONFIG, enhancedFetch } from '../../utils/networkUtils';
import NoAccessScreen from './NoAccessScreen';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SimpleTabBar } from '../../components/SimpleTabBar';

const DEBUG_SERVICE_FEE = false; // Set true to log refresh/load details

const ServiceFeePaymentScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    units,
    accessibleUnits,
    selectedUnit,
    upcomingBillings,
    hasAccess,
    accessChecked,
    isLoadingUnits,
    isLoading,
    error,
    loadUnits,
    loadUpcomingBillings,
    selectUnit,
    clearAllErrors,
    checkAccess,
  } = useServiceFee();
  const accessToken = useAppSelector((state) => state.auth.accessToken);


  // Get screen dimensions for responsive dropdown height
  const screenHeight = Dimensions.get('window').height;
  const maxModalHeight = screenHeight * 0.8; // 80vh
  const maxScrollHeight = screenHeight * 0.6; // 60vh

  if (DEBUG_SERVICE_FEE) {
    console.log('📱 ServiceFeePaymentScreen render:', {
      unitsCount: units?.length || 0,
      selectedUnit: selectedUnit ? `${selectedUnit.tower_name}, ${selectedUnit.unit_name}` : 'none',
      hasAccess,
      accessChecked
    });
  }

  const [showUnitSelector, setShowUnitSelector] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('services');
  const [selectedPayments, setSelectedPayments] = useState<Set<number | string>>(new Set());
  const [currentTrackedMonth, setCurrentTrackedMonth] = useState<number>(new Date().getMonth() + 1);
  const [advanceBalance, setAdvanceBalance] = useState<number>(0);
  const [advanceDate, setAdvanceDate] = useState<string | null>(null);
  const appState = useRef(AppState.currentState);
  const isFirstFocus = useRef(true);

  // Tab configuration
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
    // Navigate back to Dashboard which contains the BottomTabNavigator
    navigation.navigate('Dashboard' as never);
  };

  // Get unique units for dropdown (remove duplicates from multiple months)
  // IMPORTANT: Only show units that have service fee records (from fetchUnits API)
  // Do NOT show units without service fees (from accessibleUnits)
  const getUniqueUnits = () => {
    const uniqueUnitsMap = new Map();

    // Only add units with service fee payment records (from fetchUnits API)
    units.forEach(unit => {
      const uniqueKey = unit.unit_id;
      if (!uniqueUnitsMap.has(uniqueKey)) {
        uniqueUnitsMap.set(uniqueKey, unit);
      }
    });

    const unitsWithServiceFees = Array.from(uniqueUnitsMap.values());
    if (DEBUG_SERVICE_FEE) {
      console.log('🔍 getUniqueUnits:', { total: unitsWithServiceFees.length });
    }
    return unitsWithServiceFees;
  };



  // Load units on mount
  useEffect(() => {
    if (!hasAccess) return;

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // BUSINESS LOGIC: Fetch ONLY from service fee start date to current month
    // This shows ALL due months from start to now
    // Example: If service started June 2025 and now is October 2025
    // Show ONLY: June, July, August, September, October
    // NO future months (November only shows when calendar turns to November)

    if (DEBUG_SERVICE_FEE) {
      console.log('🔄 ServiceFeePaymentScreen INITIAL LOAD:', `${currentMonth}/${currentYear}`);
    }
    loadUnits({
      stats: true,
      service_period_month_from: 1,  // January (backend determines actual start)
      service_period_year_from: 2020, // Start year (backend determines actual start)
      service_period_month_to: currentMonth,  // ONLY up to current month
      service_period_year_to: currentYear
    });

    loadUpcomingBillings();
  }, [hasAccess]);

  // Fetch advance balance for selected unit (for Advance Payment card)
  useEffect(() => {
    if (!hasAccess || !selectedUnit || !accessToken) {
      setAdvanceBalance(0);
      return;
    }
    const unitId = selectedUnit.unit_id ?? selectedUnit.id;
    if (unitId == null || unitId === undefined) {
      setAdvanceBalance(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await enhancedFetch(
          `${API_CONFIG.BASE_URL}/api/service-fee-management/mobile/unit-advance-balance/?unit_id=${encodeURIComponent(unitId)}`,
          { method: 'GET' },
          API_CONFIG.TIMEOUT,
          accessToken
        );
        if (cancelled) return;
        const data = await response.json();
        if (data?.success && typeof data.total_advance === 'number') {
          setAdvanceBalance(data.total_advance);
        } else {
          setAdvanceBalance(0);
        }
      } catch {
        if (!cancelled) setAdvanceBalance(0);
      }
    })();
    return () => { cancelled = true; };
  }, [hasAccess, accessToken, selectedUnit?.unit_id, selectedUnit?.id]);

  // Refresh data when screen comes into focus (e.g. after payment or navigating back).
  // Skip the first focus to avoid duplicate load with the initial useEffect.
  useFocusEffect(
    React.useCallback(() => {
      if (!hasAccess) return;

      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }

      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();

      loadUnits({
        stats: true,
        service_period_month_from: 1,
        service_period_year_from: 2020,
        service_period_month_to: currentMonth,
        service_period_year_to: currentYear
      });
      loadUpcomingBillings();
    }, [hasAccess, loadUnits, loadUpcomingBillings])
  );

  // Auto-select first unit if available, or maintain selected unit after refresh
  useEffect(() => {
    if (units.length > 0) {
      const uniqueUnits = getUniqueUnits();

      if (!selectedUnit && uniqueUnits.length > 0) {
        // No unit selected, auto-select first one
        // Prioritize units with actual payment records over units from access check (no_records)
        const unitsWithPayments = uniqueUnits.filter((u: any) => u.service_status !== 'no_records');
        const unitToSelect = unitsWithPayments.length > 0 ? unitsWithPayments[0] : uniqueUnits[0];
        
        selectUnit(unitToSelect);
      } else if (selectedUnit) {
        // After refresh, find and re-select the same unit from new data
        const matchingUnit = uniqueUnits.find(unit => {
          const matchesById = unit.unit_id && selectedUnit.unit_id && unit.unit_id === selectedUnit.unit_id;
          const matchesByName = unit.tower_name === selectedUnit.tower_name && unit.unit_name === selectedUnit.unit_name;
          return matchesById || matchesByName;
        });

        if (matchingUnit && matchingUnit.id !== selectedUnit.id) {
          selectUnit(matchingUnit);
        } else if (!matchingUnit && uniqueUnits.length > 0) {
          // CRITICAL FIX: Selected unit doesn't exist in units with service fees
          // This happens when a unit from access check (no service fees) was selected
          // Auto-select the first available unit with service fees
          const unitsWithPayments = uniqueUnits.filter((u: any) => u.service_status !== 'no_records');
          const unitToSelect = unitsWithPayments.length > 0 ? unitsWithPayments[0] : uniqueUnits[0];
          
          selectUnit(unitToSelect);
        }
      }
    }
  }, [units]);

  // Auto-detect month change and refresh data
  useEffect(() => {
    if (!hasAccess) return;

    // Check every 60 seconds if the month has changed
    const monthCheckInterval = setInterval(() => {
      const currentMonth = new Date().getMonth() + 1;

      if (currentMonth !== currentTrackedMonth) {
        if (DEBUG_SERVICE_FEE) {
          console.log('📅 Month changed detected (periodic check)!', { previousMonth: currentTrackedMonth, newMonth: currentMonth });
        }
        // Update tracked month
        setCurrentTrackedMonth(currentMonth);

        // Auto-refresh data to show new month's payment card
        const currentYear = new Date().getFullYear();

        loadUnits({
          stats: true,
          service_period_month_from: 1,
          service_period_year_from: 2020,
          service_period_month_to: currentMonth,
          service_period_year_to: currentYear
        });
      }
    }, 60000); // Check every 60 seconds

    return () => clearInterval(monthCheckInterval);
  }, [hasAccess, currentTrackedMonth, loadUnits]);

  // When app comes to foreground: always refresh so payments made from web are reflected
  useEffect(() => {
    if (!hasAccess) return;

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        // Always refresh when app comes to foreground so amounts stay in sync
        if (currentMonth !== currentTrackedMonth) {
          setCurrentTrackedMonth(currentMonth);
        }

        loadUnits({
          stats: true,
          service_period_month_from: 1,
          service_period_year_from: 2020,
          service_period_month_to: currentMonth,
          service_period_year_to: currentYear
        });
        loadUpcomingBillings();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [hasAccess, currentTrackedMonth, loadUnits, loadUpcomingBillings]);

  // Removed auto-refresh on focus - only manual refresh now
  // Removed auto-refresh when app comes to foreground - only manual refresh now
  // Removed periodic access check - only manual refresh now

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await checkAccess();
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      setCurrentTrackedMonth(currentMonth);

      await loadUnits({
        stats: true,
        service_period_month_from: 1,
        service_period_year_from: 2020,
        service_period_month_to: currentMonth,
        service_period_year_to: currentYear
      });
      await loadUpcomingBillings();

      // Add a small delay to show refresh indicator
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('❌ Error during service fee refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  // Format number with comma separators (e.g., 10000 -> 10,000)
  const formatCurrency = (amount: string | number | null | undefined) => {
    if (amount === null || amount === undefined) return '0';
    try {
      const numAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
      if (isNaN(numAmount) || !isFinite(numAmount)) return '0';
      return numAmount.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
    } catch (error) {
      console.warn('Error formatting currency:', error, amount);
      return '0';
    }
  };

  // Bangladeshi Taka currency symbol (used in fee breakdown)
  const CURRENCY_SYMBOL = '৳';

  // Total of all utility/bill_category charges (used for totals)
  const getGasFee = (payment: any): number => {
    const items = getUtilityBillItems(payment);
    if (items.length > 0) return items.reduce((sum, i) => sum + i.amount, 0);
    const additionalCharges = (payment as any).additional_bill_charges;
    if (additionalCharges !== undefined && additionalCharges !== null && String(additionalCharges).trim() !== '') {
      const num = parseFloat(String(additionalCharges));
      if (!isNaN(num) && num > 0) return num;
    }
    const gas = (payment as any).gas_fee;
    if (gas !== undefined && gas !== null && String(gas).trim() !== '') {
      const num = parseFloat(String(gas));
      if (!isNaN(num)) return num;
    }
    return 0;
  };

  // Dynamic utility bill line items (Gas, Water, Electricity, etc.) from service_fee_items
  const getUtilityBillItems = (payment: any): { name: string; amount: number }[] => {
    let items = (payment as any).service_fee_items;
    // Backend may return JSON as string; parse so we get itemized names (Water, Gas, etc.)
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch {
        items = null;
      }
    }
    if (!Array.isArray(items)) {
      const single = getGasFeeFromLegacy(payment);
      if (single > 0) return [{ name: 'Utility Charges', amount: single }];
      return [];
    }
    const billCategoryItems = items
      .filter((it: any) => {
        const type = String(it?.item_type ?? it?.itemType ?? '').toLowerCase();
        return type === 'bill_category' || type === 'bill category' || (type.includes('bill') && type.includes('category'));
      })
      .map((it: any) => {
        const amt = parseFloat(it?.amount ?? '0');
        const name = (it?.item_name ?? it?.itemName ?? it?.bill_category_name ?? it?.billCategoryName ?? 'Utility').trim() || 'Utility';
        return { name, amount: isNaN(amt) ? 0 : amt };
      })
      .filter((x: { name: string; amount: number }) => x.amount > 0);
    if (billCategoryItems.length > 0) return billCategoryItems;
    const single = getGasFeeFromLegacy(payment);
    if (single > 0) return [{ name: 'Utility Charges', amount: single }];
    return [];
  };

  const getGasFeeFromLegacy = (payment: any): number => {
    const additionalCharges = (payment as any).additional_bill_charges;
    if (additionalCharges !== undefined && additionalCharges !== null && String(additionalCharges).trim() !== '') {
      const num = parseFloat(String(additionalCharges));
      if (!isNaN(num) && num > 0) return num;
    }
    const gas = (payment as any).gas_fee;
    if (gas !== undefined && gas !== null && String(gas).trim() !== '') {
      const num = parseFloat(String(gas));
      if (!isNaN(num)) return num;
    }
    return 0;
  };

  // Get late fee (penalty) from payment
  const getLateFee = (payment: any): number => {
    const penalty = (payment as any).penalty_amount;
    if (penalty === undefined || penalty === null || String(penalty).trim() === '') return 0;
    const num = parseFloat(String(penalty));
    return isNaN(num) ? 0 : num;
  };

  // Function to format the due date for upcoming payment display
  const getFutureDate = (dueDate: string) => {
    if (!dueDate) return 'N/A';

    try {
      const dueDateObj = new Date(dueDate);

      const formattedDate = dueDateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      return formattedDate;
    } catch {
      return 'N/A';
    }
  };

    const getPaymentStatus = (unit: any) => {
    // If backend provides service_status, use it directly
    if (unit.service_status) {
      const backendStatus = unit.service_status.toLowerCase();

      if (backendStatus === 'paid' || backendStatus === 'completed') {
        return {
          status: 'paid',
          label: 'Paid',
          color: 'paymentCompleted',
          bgColor: 'paymentCompletedBg',
        };
      }

      if (backendStatus === 'overdue') {
        return {
          status: 'overdue',
          label: 'Overdue',
          color: 'paymentFailed',
          bgColor: 'paymentFailedBg',
        };
      }

      if (backendStatus === 'partial') {
        return {
          status: 'partial',
          label: 'Partial',
          color: 'paymentPartial',
          bgColor: 'paymentPartialBg',
        };
      }

      if (backendStatus === 'due' || backendStatus === 'pending') {
        return {
          status: 'due',
          label: 'Due',
          color: 'paymentDue',
          bgColor: 'paymentDueBg',
        };
      }
    }

    // Fallback: Calculate status based on due date and amounts
    const dueAmount = parseFloat(unit.due_amount || '0');
    const feeAmount = parseFloat(unit.fee_amount || '0');
    const dueDate = new Date(unit.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    // Check if payment is overdue first (regardless of amount)
    if (dueDate < today && dueAmount > 0) {
      return {
        status: 'overdue',
        label: 'Overdue',
        color: '#EF4444', // red
        bgColor: '#FEE2E2',
      };
    }

    // Fully paid (no amount due)
    if (dueAmount === 0) {
      return {
        status: 'paid',
        label: 'Paid',
        color: '#10B981', // green
        bgColor: '#D1FAE5',
      };
    }

    // Partial payment
    if (dueAmount > 0 && dueAmount < feeAmount) {
      return {
        status: 'partial',
        label: 'Partial',
        color: '#F59E0B', // amber
        bgColor: '#FEF3C7',
      };
    }

    // Due (full amount due and not overdue)
    return {
      status: 'due',
      label: 'Due',
      color: '#3B82F6', // blue
      bgColor: '#DBEAFE',
    };
  };

  const getDaysOverdue = (unit: any) => {
    if (!unit || !unit.due_date) return 0;

    // Calculate days overdue from the original due date to current date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(unit.due_date);
    dueDate.setHours(0, 0, 0, 0);

    // Calculate the difference in milliseconds
    const diffTime = today.getTime() - dueDate.getTime();

    // Convert to days
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Return positive days overdue, or 0 if not yet due
    return diffDays > 0 ? diffDays : 0;
  };

  const getCurrentMonthPayment = () => {
    if (!selectedUnit) return null;

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Find payment for current month/year using multiple matching strategies
    const foundUnit = units.find(unit => {
      const matchesById = unit.unit_id && selectedUnit.unit_id && unit.unit_id === selectedUnit.unit_id;
      const matchesByName = unit.tower_name === selectedUnit.tower_name && unit.unit_name === selectedUnit.unit_name;

      return (matchesById || matchesByName) &&
        unit.service_period_month === currentMonth &&
        unit.service_period_year === currentYear;
    }) || selectedUnit;

    return foundUnit;
  };

  // Get all monthly payments for selected unit, sorted by date (newest first)
  // BUSINESS LOGIC: Return ALL months from service start up to current month (not future months)
  // EXCLUDE fully paid payments from the list
  const getAllMonthlyPayments = () => {
    if (!selectedUnit) return [];

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Get current month payment to use as reference if needed
    const currentPayment = getCurrentMonthPayment();

    // Filter ALL payments up to current month for the selected unit (exclude future months)
    let unitPayments = units.filter(unit => {
      // First try: match by unit_id if it exists
      if (unit.unit_id && selectedUnit.unit_id && unit.unit_id === selectedUnit.unit_id) {
        // Check if payment month/year is valid
        if (!unit.service_period_month || !unit.service_period_year) return false;

        // Only include payments up to and including current month (exclude future)
        const paymentDate = new Date(unit.service_period_year, unit.service_period_month - 1);
        const currentDateObj = new Date(currentYear, currentMonth - 1);

        return paymentDate <= currentDateObj;
      }

      // Second try: match by tower_name and unit_name
      if (unit.tower_name === selectedUnit.tower_name && unit.unit_name === selectedUnit.unit_name) {
        // Check if payment month/year is valid
        if (!unit.service_period_month || !unit.service_period_year) return false;

        // Only include payments up to and including current month (exclude future)
        const paymentDate = new Date(unit.service_period_year, unit.service_period_month - 1);
        const currentDateObj = new Date(currentYear, currentMonth - 1);

        return paymentDate <= currentDateObj;
      }

      return false;
    });

    // ENHANCED FALLBACK: If units array is empty, use selectedUnit or currentPayment
    // This handles the case where API returns empty data but we still have payment info
    if (unitPayments.length === 0) {
      // Priority 1: Use currentPayment if it exists (it has the most accurate data)
      if (currentPayment && currentPayment.service_period_month && currentPayment.service_period_year) {
        const paymentDate = new Date(currentPayment.service_period_year, currentPayment.service_period_month - 1);
        const currentDateObj = new Date(currentYear, currentMonth - 1);

        if (paymentDate <= currentDateObj) {
          if (DEBUG_SERVICE_FEE) console.log('✅ getAllMonthlyPayments: Using currentPayment as fallback');
          unitPayments = [currentPayment];
        }
      }
      // Priority 2: Use selectedUnit if it has period data
      else if (selectedUnit && selectedUnit.service_period_month && selectedUnit.service_period_year) {
        const paymentDate = new Date(selectedUnit.service_period_year, selectedUnit.service_period_month - 1);
        const currentDateObj = new Date(currentYear, currentMonth - 1);

        if (paymentDate <= currentDateObj) {
          if (DEBUG_SERVICE_FEE) console.log('✅ getAllMonthlyPayments: Using selectedUnit as fallback (has period data)');
          unitPayments = [selectedUnit];
        }
      }
      // Priority 3: Use selectedUnit with inferred period if it has payment data
      else if (selectedUnit) {
        const hasPaymentData = selectedUnit.due_amount || selectedUnit.fee_amount || selectedUnit.service_status;
        const hasValidPayment = parseFloat(selectedUnit.due_amount || '0') > 0 ||
          selectedUnit.service_status === 'overdue' ||
          selectedUnit.service_status === 'due' ||
          selectedUnit.service_status === 'partial';

        if (hasPaymentData && hasValidPayment) {
          if (DEBUG_SERVICE_FEE) console.log('✅ getAllMonthlyPayments: Using selectedUnit as fallback (has payment data, inferring period)');
          // Use period from currentPayment if available, otherwise use current month
          const inferredMonth = currentPayment?.service_period_month || currentMonth;
          const inferredYear = currentPayment?.service_period_year || currentYear;

          unitPayments = [{
            ...selectedUnit,
            service_period_month: selectedUnit.service_period_month || inferredMonth,
            service_period_year: selectedUnit.service_period_year || inferredYear
          }];
        } else if (DEBUG_SERVICE_FEE) {
          console.log('⚠️ getAllMonthlyPayments: No valid payment data found in selectedUnit');
        }
      }
    }

    // CRITICAL: If we still have no payments but currentPayment exists and is unpaid, include it
    // This ensures unpaid months always show even when API returns empty
    // Use getCurrentMonthPayment() directly to ensure we have the latest data
    const latestCurrentPayment = getCurrentMonthPayment();
    if (unitPayments.length === 0 && latestCurrentPayment) {
      const currentPaymentStatus = getPaymentStatus(latestCurrentPayment);
      const isCurrentPaid = currentPaymentStatus.status === 'paid';
      const isCurrentSynthetic = (latestCurrentPayment as any).isSynthetic === true;
      const currentDueAmount = parseFloat(latestCurrentPayment.due_amount || '0');

      // Include if it's unpaid and has amount due
      if (!isCurrentPaid && !isCurrentSynthetic && currentDueAmount > 0) {
        unitPayments = [latestCurrentPayment];
      }
    }

    // Filter out fully paid payments and synthetic payments
    const unpaidPayments = unitPayments.filter(unit => {
      const paymentStatus = getPaymentStatus(unit);
      const isFullyPaid = paymentStatus.status === 'paid';
      const isSynthetic = (unit as any).isSynthetic === true;

      // Also check if due_amount is 0 (fully paid)
      const dueAmount = parseFloat(unit.due_amount || '0');
      const isZeroDue = dueAmount === 0;

      const shouldShow = !isFullyPaid && !isSynthetic && !isZeroDue;
      return shouldShow; // Only show non-paid, non-synthetic payments with amount due
    });

    // CRITICAL: If all payments are filtered out but the most recent payment has advance balance,
    // keep it so we can display the advance balance card
    if (unpaidPayments.length === 0 && unitPayments.length > 0) {
      const mostRecentPayment = unitPayments[0]; // Already sorted by date (newest first)
      const hasAdvanceBalance = parseFloat(String((mostRecentPayment as any).unit_total_advance || (mostRecentPayment as any).advance_balance || 0)) > 0;
      
      if (hasAdvanceBalance) {
        // Keep the most recent payment to preserve advance balance information
        // Create a new object with the flag so it won't be displayed in the payment cards list
        const advanceBalanceHolder = {
          ...mostRecentPayment,
          _isAdvanceBalanceHolder: true
        };
        unpaidPayments.push(advanceBalanceHolder as any);
      }
    }

    // Sort by year and month (oldest first - ascending order)
    const sortedPayments = unpaidPayments.sort((a, b) => {
      const yearA = a.service_period_year || 0;
      const yearB = b.service_period_year || 0;
      const monthA = a.service_period_month || 0;
      const monthB = b.service_period_month || 0;

      if (yearA !== yearB) {
        return yearA - yearB;  // Ascending by year
      }
      return monthA - monthB;  // Ascending by month
    });

    if (DEBUG_SERVICE_FEE) {
      console.log('📅 getAllMonthlyPayments result:', {
        selectedUnitId: selectedUnit.unit_id,
        totalPayments: sortedPayments.length,
        payments: sortedPayments.map(p => `${p.service_period_month}/${p.service_period_year}`)
      });
    }
    return sortedPayments;
  };

  const getMonthYearLabel = (month: number, year: number) => {
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    return `${monthNames[month - 1]}, ${year}`;
  };

  // Generate a unique payment identifier
  // ALWAYS use composite key from unit_id, month, and year to ensure uniqueness
  // Multiple records can have the same id but different months
  const getPaymentId = (payment: any): string => {
    if (!payment) {
      return `unknown-${Date.now()}`;
    }
    try {
      const unitId = payment.unit_id || selectedUnit?.unit_id || 'unknown';
      const month = payment.service_period_month || 'unknown';
      const year = payment.service_period_year || 'unknown';
      return `${unitId}-${month}-${year}`;
    } catch (error) {
      console.warn('Error generating payment ID:', error);
      return `error-${Date.now()}`;
    }
  };

  const getUpcomingPayment = () => {
    if (!selectedUnit) return null;

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Calculate the next month (always show next month as upcoming)
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

    // First, check if there's an upcoming billing record from the backend
    // This ensures we show the latest service fee settings from the web app
    if (upcomingBillings && upcomingBillings.length > 0) {
      const upcomingBilling = upcomingBillings.find(billing => {
        // Match by unit_id (most reliable)
        const matchesById = billing.unit_id === selectedUnit.unit_id;
        // Also try matching by name as fallback
        const matchesByName = billing.tower_name === selectedUnit.tower_name && 
                             billing.unit_name === selectedUnit.unit_name;
        
        return (matchesById || matchesByName) && 
               billing.service_period_month === nextMonth && 
               billing.service_period_year === nextYear;
      });

      if (upcomingBilling) {
        // Convert upcoming billing to a format compatible with the UI
        // CRITICAL FIX: ALWAYS use fee_amount (current service fee settings from ServiceFee table)
        // NEVER use billing_amount (snapshot from when bill was generated)
        // This ensures we show the LATEST service fee amount updated from web app
        
        const upcomingUnit = {
          id: upcomingBilling.billing_id,
          unit_id: upcomingBilling.unit_id,
          unit_name: upcomingBilling.unit_name,
          unit_display: upcomingBilling.unit_name,
          tower_name: upcomingBilling.tower_name,
          tower_id: upcomingBilling.tower_id,
          service_fee_id: upcomingBilling.service_fee_id,
          fee_amount: upcomingBilling.fee_amount,           // ✓ MUST USE: Current service fee from ServiceFee table
          amount: upcomingBilling.fee_amount,               // ✓ MUST USE: Current service fee (NOT billing_amount)
          due_amount: upcomingBilling.fee_amount,           // ✓ MUST USE: Current service fee as due amount
          due_day: upcomingBilling.due_day,
          payment_method: '',
          method_display: '',
          service_status: upcomingBilling.service_status || 'due',
          due_date: upcomingBilling.due_date || '',
          frequency: 'Monthly',
          service_period_month: upcomingBilling.service_period_month,
          service_period_year: upcomingBilling.service_period_year,
          isFromUpcomingBilling: true // Flag to identify this is from upcoming billing API
        } as any;

        return upcomingUnit;
      }
    }

    // If no upcoming billing from backend, check existing units data
    const unitPayments = units
      .filter(unit => {
        // Try multiple matching strategies
        const matchesById = unit.unit_id && selectedUnit.unit_id && unit.unit_id === selectedUnit.unit_id;
        const matchesByName = unit.tower_name === selectedUnit.tower_name && unit.unit_name === selectedUnit.unit_name;

        return (matchesById || matchesByName) && unit.service_period_month && unit.service_period_year;
      })
      .sort((a, b) => {
        const yearDiff = (a.service_period_year || 0) - (b.service_period_year || 0);
        if (yearDiff !== 0) return yearDiff;
        return (a.service_period_month || 0) - (b.service_period_month || 0);
      });

    // Try to find an existing payment for the next month
    let upcomingUnit = unitPayments.find(unit => {
      if (!unit.service_period_year || !unit.service_period_month) return false;
      return unit.service_period_month === nextMonth && unit.service_period_year === nextYear;
    });

    // If we found an existing payment for next month, check if it's unpaid
    if (upcomingUnit) {
      const paymentStatus = getPaymentStatus(upcomingUnit);
      const isFullyPaid = paymentStatus.status === 'paid';

      // If it's fully paid, don't show it as upcoming
      if (isFullyPaid) {
        upcomingUnit = undefined;
      }
    }

    // If still no upcoming payment found, create a synthetic one based on most recent payment
    // This is a fallback for when the service fee hasn't been generated yet for next month
    if (!upcomingUnit) {
      // Find the most recent payment to get the fee amount and due date pattern
      const mostRecentPayment = unitPayments[unitPayments.length - 1];

      if (mostRecentPayment) {
        // Create synthetic upcoming payment for next month
        upcomingUnit = {
          ...mostRecentPayment,
          service_period_month: nextMonth,
          service_period_year: nextYear,
          service_status: 'Due',
          due_amount: mostRecentPayment.fee_amount || '0',
          fee_amount: mostRecentPayment.fee_amount || '0',
          // Create a due date for next month (same day as the most recent payment)
          due_date: new Date(nextYear, nextMonth - 1, new Date(mostRecentPayment.due_date || new Date()).getDate()).toISOString(),
          // Flag to identify this as a synthetic payment (won't appear in payment cards)
          isSynthetic: true
        } as any;

      }
    }

    return upcomingUnit || null;
  };

  const handleUnitSelect = (unit: any) => {
    selectUnit(unit);
    setShowUnitSelector(false);
    setSelectedPayments(new Set()); // Reset selections when changing units
  };

  // Toggle payment selection
  const togglePaymentSelection = (paymentId: number | string) => {
    setSelectedPayments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(paymentId)) {
        newSet.delete(paymentId);
      } else {
        newSet.add(paymentId);
      }
      return newSet;
    });
  };



  // Render individual payment card item
  const renderPaymentItem = ({ item: payment, index }: { item: any; index: number }) => {
    // Skip rendering if payment is invalid or is just an advance balance holder
    if (!payment || (payment as any)._isAdvanceBalanceHolder) {
      return null;
    }
    
    try {
      const paymentStatus = getPaymentStatus(payment);
      const daysOverdue = getDaysOverdue(payment);
      const paymentId = getPaymentId(payment);
      const isSelected = selectedPayments?.has(paymentId) || false;
      // Can only select if there's amount due AND payment is not already paid
      const dueAmount = parseFloat(payment.due_amount || '0');
      const canSelect = !isNaN(dueAmount) && dueAmount > 0 && paymentStatus.status !== 'paid';

    // Fee breakdown: Original, Gas, Late (Penalty), then Remaining = Original + Gas + Late, Total Due = Remaining
    const originalAmount = parseFloat(payment.original_amount || payment.fee_amount || '0');
    const gasFee = getGasFee(payment);
    const lateFee = getLateFee(payment);
    const totalBeforePay = originalAmount + gasFee + lateFee;
    // Use backend remaining_amount/due_amount so values stay correct after web payment
    const remainingAmount = parseFloat(payment.remaining_amount ?? payment.due_amount ?? '0');
    const totalDue = remainingAmount;
    const displayRemainingAmount = remainingAmount;
    // Use paid_amount from backend when available; otherwise derive from remaining (so after web pay we show correct paid)
    const paidAmount = payment.paid_amount != null && String(payment.paid_amount).trim() !== ''
      ? parseFloat(String(payment.paid_amount))
      : Math.max(0, totalBeforePay - remainingAmount);
    const isPartialPayment = paidAmount > 0 && totalDue > 0 && paidAmount < totalBeforePay;

    return (
      <View className="mb-6">
        <View className="bg-white rounded-lg p-4 border border-primary/40 shadow-sm">
          {/* Month Header with Status Badge */}
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-black text-xl font-oxanium-bold">
              {getMonthYearLabel(payment.service_period_month || 1, payment.service_period_year || new Date().getFullYear())}
            </Text>

            {/* Status Badge - Show ONLY for Partial and Paid */}
            {isPartialPayment && (
              <View className="bg-amber-100 px-3 py-1 rounded-full">
                <Text className="text-amber-700 text-xs font-lato-bold uppercase">
                  Partial
                </Text>
              </View>
            )}
            {!isPartialPayment && paymentStatus.status === 'paid' && (
              <View className="bg-green-100 px-3 py-1 rounded-full">
                <Text className="text-green-600 text-xs font-lato-bold uppercase">
                  Paid
                </Text>
              </View>
            )}
          </View>

          {/* Due Date and Days Overdue - Only show for unpaid */}
          {paymentStatus.status !== 'paid' && (
            <>
              <View className="flex-row justify-between mb-2">
                <Text className="font-lato text-lg">Due Date</Text>
                <Text className="font-lato text-lg">Days Overdue</Text>
              </View>
              <View className="flex-row justify-between mb-4">
                <Text className="font-lato-bold text-lg">
                  {formatDate(payment.due_date)}
                </Text>
                <Text className={`font-lato-bold text-base ${daysOverdue > 0 ? 'text-red-600' : 'text-gray-900'
                  }`}>
                  {daysOverdue > 0 ? daysOverdue : '-'}
                </Text>
              </View>
              <View className="h-px w-full bg-gray-300 my-4" />
            </>
          )}

          {/* For paid items - only show Due Date */}
          {paymentStatus.status === 'paid' && (
            <>
              <View className="flex-row justify-between mb-4">
                <Text className="font-lato text-lg">Due Date</Text>
                <Text className="font-lato-bold text-lg">
                  {formatDate(payment.due_date)}
                </Text>
              </View>
              <View className="h-px w-full bg-gray-300 my-4" />
            </>
          )}

          {/* Fee breakdown - Original, dynamic utility items (Gas, Water, Electricity, etc.), Late Fee, Remaining, Total Due */}
          <View className="mb-1">
            <View className="flex-row justify-between mb-2">
              <Text className="font-lato text-lg text-black">Original Amount</Text>
              <Text className="font-lato-bold text-lg text-black">
                {CURRENCY_SYMBOL}{formatCurrency(originalAmount)}
              </Text>
            </View>
            {getUtilityBillItems(payment).map((utility, idx) => (
              <View key={idx} className="flex-row justify-between mb-2">
                <Text className="font-lato text-lg text-black">{utility.name}</Text>
                <Text className="font-lato-bold text-lg text-black">
                  {CURRENCY_SYMBOL}{formatCurrency(utility.amount)}
                </Text>
              </View>
            ))}
            {lateFee > 0 && (
              <View className="flex-row justify-between mb-2">
                <Text className="font-lato text-lg text-paymentFailed">Late Fee (Penalty)</Text>
                <Text className="font-lato-bold text-lg text-paymentFailed">
                  {CURRENCY_SYMBOL}{formatCurrency(lateFee)}
                </Text>
              </View>
            )}
            <View className="flex-row justify-between mb-2">
              <Text className="font-lato text-lg text-black">Remaining Amount</Text>
              <Text className="font-lato-bold text-lg text-black">
                {CURRENCY_SYMBOL}{formatCurrency(displayRemainingAmount)}
              </Text>
            </View>
          </View>

          <View className="h-px w-full bg-gray-300 my-3" />

          {/* Total Due - visually emphasized as final payable amount */}
          <View className="flex-row justify-between items-center mb-4 bg-primary/10 rounded-lg px-3 py-3 border border-primary/30">
            <View className="flex-col">
              <Text className="font-lato-bold text-xl text-black">
                {isPartialPayment ? 'Remaining Due' : 'Total Due'}
              </Text>
              {isPartialPayment && (
                <Text className="font-lato text-sm text-gray-600 mt-1">
                  {((totalDue / (originalAmount + gasFee + lateFee)) * 100).toFixed(0)}% remaining
                </Text>
              )}
            </View>
            <Text className={`font-oxanium-bold text-2xl ${paymentStatus.status === 'paid' ? 'text-green-600' : 'text-primary'}`}>
              {CURRENCY_SYMBOL}{paymentStatus.status === 'paid' ? '0' : formatCurrency(totalDue)}
            </Text>
          </View>

          {/* Paid Amount - Show only if there's a partial payment or fully paid */}
          {paidAmount > 0 && (
            <>
              <View className="h-px w-full bg-gray-300 my-3" />
              <View className="flex-row justify-between mb-1">
                <View className="flex-row items-center">
                  <Text className="font-lato-bold text-lg text-primary">Paid Amount</Text>
                  {isPartialPayment && (
                    <View className="ml-2 bg-primary/10 px-2 py-0.5 rounded">
                      <Text className="text-primary text-xs font-lato-bold">
                        {((paidAmount / (originalAmount + gasFee + lateFee)) * 100).toFixed(0)}% Paid
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="font-lato-bold text-lg text-primary">
                  {CURRENCY_SYMBOL}{formatCurrency(paidAmount)}
                </Text>
              </View>
              {isPartialPayment && (
                <View className="mt-2 mb-2">
                  <View className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <View
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${(paidAmount / (originalAmount + gasFee + lateFee)) * 100}%` }}
                    />
                  </View>
                </View>
              )}
            </>
          )}

          {/* Selection Button or Paid Status */}
          {canSelect ? (
            <TouchableOpacity
              className={`${isSelected
                ? 'border border-primary bg-white'
                : 'bg-primary'
                } rounded-lg p-3`}
              onPress={() => togglePaymentSelection(paymentId)}
            >
              <View className="flex-row items-center justify-center">
                {isSelected && (
                  <Text className="text-primary text-xl mr-2">✓</Text>
                )}
                <Text className={`${isSelected ? 'text-primary' : 'text-white'
                  } font-oxanium-bold text-lg`}>
                  {isSelected ? 'Selected' : 'Select'}
                </Text>
              </View>
            </TouchableOpacity>
          ) : paymentStatus.status === 'paid' ? (
            <View className="bg-green-50 border border-primary rounded-lg p-3">
              <View className="flex-row items-center justify-center">
                <Ionicons name="checkmark-circle" size={24} color="#3C9D9B" />
                <Text className="text-primary font-lato-bold text-lg ml-2">Paid</Text>
              </View>
            </View>
          ) : null}

          {/* View Details Button */}
          <TouchableOpacity
            className="bg-gray-100 border border-gray-300 rounded-lg p-3 mt-3"
            onPress={() => {
              navigation.navigate('BillDetail' as any, {
                payment: payment,
                unit: selectedUnit
              });
            }}
          >
            <View className="flex-row items-center justify-center">
              <Text className="text-gray-700 font-lato-bold text-base">View Details</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
    } catch (error) {
      console.error('Error rendering payment item:', error);
      return null;
    }
  };

  // Render list header with all static content
  const renderListHeader = () => {
    const uniqueUnits = getUniqueUnits();
    const hasMultipleUnits = uniqueUnits.length > 1;

    return (
      <>
        {/* Unit Selection - Only show dropdown when multiple units available */}
        {hasMultipleUnits ? (
          <View className="mx-4 mt-4 mb-2">
            <TouchableOpacity
              className="bg-white rounded-lg p-4 border border-primary/40 flex-row items-center justify-between shadow-sm"
              onPress={() => setShowUnitSelector(!showUnitSelector)}
              activeOpacity={0.7}
            >
              <View className="flex-1">
                {/* <Text className="text-gray-600 text-xs font-lato mb-1">Selected Unit</Text> */}
                <Text className="text-black text-lg font-lato-bold">
                  {selectedUnit ? `${selectedUnit.tower_name}, ${selectedUnit.unit_name}` : 'Select Unit'}
                </Text>
              </View>
              <Ionicons
                name={showUnitSelector ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#3C9D9B"
              />
            </TouchableOpacity>

            {/* Dropdown Box with Scroll */}
            {showUnitSelector && (
              <View
                className="mt-2 bg-white rounded-lg border-2 border-primary shadow-lg overflow-hidden"
                style={{
                  maxHeight: 320,
                  elevation: 5,
                }}
              >
                {/* Dropdown Header */}
                {/* <View className="bg-primary/5 px-4 py-3 border-b border-primary/20">
                  <Text className="text-primary font-lato-bold text-sm">
                    Select Your Unit ({uniqueUnits.length} available)
                  </Text>
                </View> */}

                {/* Scrollable List */}
                <ScrollView
                  style={{ maxHeight: 260 }}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  bounces={true}
                >
                  {uniqueUnits.map((unit, index) => {
                    const isSelected = selectedUnit && selectedUnit.unit_id === unit.unit_id;
                    return (
                      <TouchableOpacity
                        key={`${unit.unit_id}-${index}`}
                        className={`px-4 py-4 border-b border-gray-100 ${isSelected ? 'bg-primary/10' : 'bg-white'
                          }`}
                        onPress={() => handleUnitSelect(unit)}
                        activeOpacity={0.6}
                      >
                        <View className="flex-row items-center justify-between">
                          <View className="flex-1">
                            <Text className={`text-base font-lato-bold ${isSelected ? 'text-primary' : 'text-black'
                              }`}>
                              {unit.tower_name}
                            </Text>
                            <Text className={`text-sm font-lato mt-1 ${isSelected ? 'text-primary/70' : 'text-gray-600'
                              }`}>
                              Unit {unit.unit_name}
                            </Text>
                          </View>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={24} color="#3C9D9B" />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        ) : (
          /* Display unit info without dropdown when only one unit */
          selectedUnit && (
            <View className="mx-4 mt-4 mb-2">
              <View className="bg-white rounded-lg p-4 border border-primary/40">
                <Text className="text-black text-lg font-lato-bold">
                  {selectedUnit.tower_name}, {selectedUnit.unit_name}
                </Text>
              </View>
            </View>
          )
        )}

        {/* Overdue Payment Alert */}
        {overduePayments.length > 0 && !hasNoPaymentRecords && (
          <View className="mx-4 mb-3 mt-4 bg-red-50 rounded-lg p-4 border border-red-200">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-red-800 font-lato-bold text-xl">
                Overdue Payment
              </Text>
              <Text className="text-red-600 font-lato-bold text-2xl">
                Tk {formatCurrency(overduePayments.reduce((sum: number, p: any) => sum + parseFloat(p.due_amount || '0'), 0))}
              </Text>
            </View>
            <Text className="text-gray-800 text-base font-lato">
              Please pay overdue amount immediately
            </Text>
          </View>
        )}

        {/* Upcoming Payment - Show only if there's an unpaid current month and not from access check */}
        {(() => {
          // NEW BUSINESS LOGIC: Only show if upcomingPayment exists (unpaid current month)
          // Do NOT show future months - upcomingPayment will be null when all current months are paid
          // Also don't show when we only have access check data (no real payment records)
          if (upcomingPayment && !hasNoPaymentRecords) {
            return (
              <View className="mx-4 mb-6 bg-gray-100 rounded-lg p-4 border border-gray-200">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-gray-900 font-lato-bold text-xl">
                    Upcoming Payment
                  </Text>
                  <Text className="text-gray-900 font-lato-bold text-2xl">
                    Tk {formatCurrency(upcomingPayment.fee_amount || '0')}
                  </Text>
                </View>
                <Text className="text-gray-600 text-lg font-lato">
                  {getFutureDate(upcomingPayment.due_date)}
                </Text>
              </View>
            );
          }
          return null;
        })()}

        {/* Advance Balance Card - Show current advance balance if exists */}
        {(() => {
          if (!selectedUnit) return null;

          // Derive advance balance from selectedUnit first, then from any matching row in units
          // (Backend may send unit_total_advance/advance_balance on any month row for the unit)
          let advanceFromSelected =
            selectedUnit?.unit_total_advance ?? selectedUnit?.advance_balance ?? null;
          const advanceFromSelectedNum = advanceFromSelected != null
            ? parseFloat(String(advanceFromSelected)) || 0
            : 0;

          const matchingUnits = (units || []).filter((u: any) => {
            const byId = u.unit_id != null && selectedUnit.unit_id != null && u.unit_id === selectedUnit.unit_id;
            const byName = u.tower_name === selectedUnit.tower_name && u.unit_name === selectedUnit.unit_name;
            return byId || byName;
          });

          let advanceFromUnits = 0;
          for (const u of matchingUnits) {
            const val = (u as any).unit_total_advance ?? (u as any).advance_balance;
            if (val != null && val !== '') {
              const n = parseFloat(String(val));
              if (!isNaN(n) && n > advanceFromUnits) advanceFromUnits = n;
            }
          }

          const advanceBalanceNum = Math.max(advanceFromSelectedNum, advanceFromUnits, advanceBalance || 0);

          // Only show if there's an advance balance (allow showing even when hasNoPaymentRecords if we have advance)
          if (advanceBalanceNum > 0 && selectedUnit) {
            return (
              <View className="mx-4 mb-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
                <View className="flex-row justify-between items-center">
                  <Text className="text-blue-900 font-lato-bold text-xl">
                    Advance Payment
                  </Text>
                  <Text className="text-blue-900 font-lato-bold text-2xl">
                    Tk {formatCurrency(advanceBalanceNum)}
                  </Text>
                </View>
               
              </View>
            );
          }
          return null;
        })()}

        {/* Current Balance Summary */}
        <View className="mx-4 mb-4">
          <Text className="text-black font-lato-bold text-2xl mb-2">
            Current Balance:
          </Text>
          <Text className="text-primary text-5xl font-oxanium-bold mb-1">
            Tk {(() => {
              // If we only have access check data (no payment records), show 0
              if (hasNoPaymentRecords) {
                return '0';
              }
              // Normal calculation from unpaid payments
              const totalDue = allMonthlyPayments.reduce((sum: number, p: any) => sum + parseFloat(p.due_amount || '0'), 0);
              return formatCurrency(totalDue);
            })()}
          </Text>
          <Text className="text-gray-600 text-base font-lato">
            {hasNoPaymentRecords ? (
              'No payments due at this time'
            ) : (
              <>Payment Required by: {(() => {
              // Calculate total due amount
              const totalDue = allMonthlyPayments.reduce((sum: number, p: any) => sum + parseFloat(p.due_amount || '0'), 0);

              // If there are unpaid amounts, show the earliest due date
              if (totalDue > 0) {
                // Find the earliest unpaid payment
                const unpaidPayments = allMonthlyPayments.filter((p: any) => parseFloat(p.due_amount || '0') > 0);
                if (unpaidPayments.length > 0) {
                  const earliestPayment = unpaidPayments.sort((a: any, b: any) =>
                    new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
                  )[0];
                  return formatDate(earliestPayment.due_date);
                }
              }

              // If all paid, show "All Paid" instead of future date
              return 'All Paid';
            })()}</>
            )}
          </Text>
        </View>

        {/* View Payment History Button */}
        <View className="mb-4">
          <TouchableOpacity
            className="bg-white border border-black rounded-lg p-4 items-center"
            onPress={() => (navigation as any).navigate('PaymentHistory', { unit: selectedUnit })}
          >
            <Text className="font-lato-bold text-xl">
              View Payment History
            </Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  // Auto-select unit if none selected and only one unit available
  React.useEffect(() => {
    if (!selectedUnit && units.length === 1) {
      selectUnit(units[0]);
    }
  }, [selectedUnit, units, selectUnit]);

  // Calculate data - MUST be before early returns to avoid hook ordering issues
  const currentPayment = selectedUnit ? getCurrentMonthPayment() : null;
  const upcomingPayment = selectedUnit ? getUpcomingPayment() : null;
  const currentStatus = currentPayment ? getPaymentStatus(currentPayment) : null;
  const allMonthlyPayments = selectedUnit ? getAllMonthlyPayments() : [];

  // Check if units are from access check (no payment records yet)
  // This must be calculated early so it's available in renderListHeader
  const hasNoPaymentRecords = selectedUnit && (selectedUnit as any).service_status === 'no_records';

  // Payment cards should only show actual payments from the database, not synthetic ones
  // The upcoming payment section will handle showing future payments separately
  const allPaymentsWithUpcoming = allMonthlyPayments;

  // Calculate total selected amount from the payments list
  const getTotalSelectedAmount = React.useCallback(() => {
    if (!allPaymentsWithUpcoming || !Array.isArray(allPaymentsWithUpcoming) || !selectedPayments) {
      return '0.00';
    }
    let total = 0;
    allPaymentsWithUpcoming.forEach(payment => {
      if (!payment) return;
      try {
        const paymentId = getPaymentId(payment);
        if (selectedPayments.has(paymentId)) {
          const dueAmount = parseFloat(payment.due_amount || '0');
          if (!isNaN(dueAmount)) {
            total += dueAmount;
          }
        }
      } catch (error) {
        console.warn('Error calculating payment amount:', error);
      }
    });
    return total.toFixed(2);
  }, [allPaymentsWithUpcoming, selectedPayments]);

  // Get overdue payments for the selected unit only
  // Check ALL months for overdue status (not just current month)
  // allMonthlyPayments already excludes fully paid payments, so we just need to filter for overdue
  // BUSINESS LOGIC: Only include payments where due_date has passed by at least 1 day
  const overduePayments = selectedUnit ? allMonthlyPayments.filter(unit => {
    if (!unit.due_date) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDate = new Date(unit.due_date);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Only include if at least 1 day overdue and has amount due
    const dueAmount = parseFloat(unit.due_amount || '0');
    return diffDays >= 1 && dueAmount > 0;
  }) : [];

  const handleMakePayment = () => {
    if (!selectedUnit) {
      Alert.alert('Error', 'Please select a unit first');
      return;
    }

    // Extract payment data for selected payments (empty when nothing selected)
    const selectedPaymentData: Array<{ month: number; year: number; amount: number }> = [];
    if (!allPaymentsWithUpcoming || !Array.isArray(allPaymentsWithUpcoming)) {
      console.warn('allPaymentsWithUpcoming is not available');
    } else {
      selectedPayments.forEach(paymentId => {
        try {
          const payment = allPaymentsWithUpcoming.find(p => {
            if (!p) return false;
            return getPaymentId(p) === paymentId;
          });
          if (payment && payment.service_period_month && payment.service_period_year) {
            const dueAmount = parseFloat(payment.due_amount || '0');
            if (!isNaN(dueAmount) && dueAmount > 0) {
              selectedPaymentData.push({
                month: payment.service_period_month,
                year: payment.service_period_year,
                amount: dueAmount
              });
            }
          }
        } catch (error) {
          console.warn('Error processing selected payment:', error);
        }
      });
    }

    selectedPaymentData.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    // Always navigate: with amount when something selected, with 0 when nothing selected
    navigation.navigate('MakePayment', {
      unit: selectedUnit,
      amount: selectedPayments.size > 0 ? getTotalSelectedAmount() : '0',
      selectedPayments: selectedPayments.size > 0 ? selectedPayments : new Set(),
      selectedPaymentData
    });
  };

  // Show loading while checking access
  if (!accessChecked) {
    if (DEBUG_SERVICE_FEE) {
      console.log('⏳ ServiceFeePaymentScreen: Checking access...');
    }
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#3C9D9B" />
        <Text className="text-gray-600 mt-4 font-['Lato-Regular']">Checking access...</Text>
      </SafeAreaView>
    );
  }

  // Show no access screen
  if (!hasAccess) {
    return <NoAccessScreen />;
  }

  // Show loading while fetching data
  if (isLoadingUnits && units.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#3C9D9B" />
        <Text className="text-gray-600 mt-4 font-['Lato-Regular']">Loading service fees...</Text>
      </SafeAreaView>
    );
  }

  // Show message when no unit is selected but units are available
  if (!selectedUnit && units.length > 0) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="items-center px-6">
          <Ionicons name="home-outline" size={64} color="#9CA3AF" />
          <Text className="text-xl font-lato-bold text-gray-800 mt-4 text-center">
            Select Your Unit
          </Text>
          <Text className="text-gray-600 mt-2 text-center font-lato-regular">
            Please select a unit to view and manage your service fee payments
          </Text>
          <TouchableOpacity
            onPress={() => setShowUnitSelector(true)}
            className="bg-primary px-6 py-3 rounded-lg mt-6"
          >
            <Text className="text-white font-lato-bold">Select Unit</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header - back goes to previous screen (e.g. Dashboard/Home when opened from there) */}
      <View className="px-4 py-3 flex-row items-center">
        <TouchableOpacity
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              (navigation as any).navigate('Dashboard', { screen: 'Home' });
            }
          }}
          className="flex-row items-center pr-3"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={20} color="#3C9D9B" />
        </TouchableOpacity>
        <Text className="text-text-primary text-xl font-oxanium-bold">
          Service Fees
        </Text>
      </View>

      {/* Payment List with Header */}
      <FlatList
        data={allPaymentsWithUpcoming}
        renderItem={renderPaymentItem}
        keyExtractor={(item) => String(getPaymentId(item))}
        ListHeaderComponent={renderListHeader}
        contentContainerClassName="pb-44 px-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3C9D9B']}
            tintColor="#3C9D9B"
          />
        }
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => setShowUnitSelector(false)}
        ListEmptyComponent={
          hasNoPaymentRecords ? (
            <View className="bg-green-50 rounded-lg p-6 items-center border border-green-200">
              <Ionicons name="checkmark-circle-outline" size={48} color="#3C9D9B" />
              <Text className="text-gray-800 font-lato-bold text-lg mt-4 text-center">
                No Pending Payments
              </Text>
              <Text className="text-gray-600 font-lato text-base mt-2 text-center">
                You have no service fee payments due at this time.
                New payments will appear here when they are generated.
              </Text>
            </View>
          ) : (
            <View className="bg-gray-100 rounded-lg p-6 items-center">
              <Text className="text-gray-600 font-lato text-base">
                No payment records available
              </Text>
            </View>
          )
        }
        removeClippedSubviews={false}
        initialNumToRender={Math.max(allPaymentsWithUpcoming.length, 10)}
        maxToRenderPerBatch={Math.max(allPaymentsWithUpcoming.length, 10)}
        windowSize={21}
      />

      {/* Fixed Bottom Container - Make Payment Button + Tab Bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-white">
        {/* Make Payment Button */}
        <View className="border-t border-gray-200 px-4 pt-3 pb-2">
          <TouchableOpacity
            className="bg-primary items-center py-4 rounded-lg"
            onPress={handleMakePayment}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-white font-oxanium-bold text-lg">
                {selectedPayments.size > 0
                  ? `Make Payment - Tk ${formatCurrency(getTotalSelectedAmount())}`
                  : 'Make Payment'}
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
    </SafeAreaView>
  );
};

export default ServiceFeePaymentScreen;
