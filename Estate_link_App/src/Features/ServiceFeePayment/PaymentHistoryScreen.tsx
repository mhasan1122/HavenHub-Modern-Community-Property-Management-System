import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useServiceFee } from '../../hooks/useServiceFee';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';

interface PaymentHistoryScreenProps {
  route?: {
    params: {
      unit: any;
    };
  };
}

interface PaymentItem {
  id: string;
  receipt_id?: string;  // Receipt ID field
  transaction_id: string;
  amount: string;
  payment_method: string;
  method_display: string;
  payment_date: string;
  due_date?: string;  // Due date for the service period
  service_period_display: string;
  reference_number?: string;
  payment_status: string;
  status_display: string;
  service_status_display: string;  // Current billing status (changes when new payments are made)
  payment_result_display?: string;  // Historical status at time of payment (fixed, never changes)
  is_overdue: boolean;
  is_fully_paid: boolean;
  notes?: string;
  unit_id: number;  // Add unit_id field
  /** When 'advance_payment', this is a pure advance (no bill); show advance card. */
  payment_type?: string;
  /** Name of who recorded the payment (e.g. admin name or empty for self-payment from app) */
  created_by_name?: string;
  // Add original amount fields
  service_fee_amount?: string;
  billing_amount?: string;
  original_amount?: string;
  fee_amount?: string;
  remaining_amount?: string;
  penalty_amount?: string;
  gross_penalty_amount?: string;
  waived_amount?: string;
  penalty_after_waiver?: string;
  waiver_reason?: string;
  /** Bill total (base+utility) for allocation display - from API original_amount / total_amount */
  total_amount?: string;
  base_service_amount?: string;
  additional_bill_charges?: string;
}

type DateFilter = 'all' | 'last3months' | 'thisyear' | 'custom';

/** One card per transaction: same invoice = one grouped item with allocations (bill + advance). */
export interface GroupedPaymentItem {
  key: string;
  transaction_id: string;
  receipt_id?: string;
  payment_date: string;
  method_display: string;
  total_amount: string;
  allocations: PaymentItem[];
}

const PaymentHistoryScreen: React.FC<PaymentHistoryScreenProps> = ({ route }) => {
  const navigation = useNavigation();
  const routeParams = useRoute().params as { unit: any };
  const { unit } = routeParams;
  const { payments, isLoadingPayments, loadPayments, paymentsError } = useServiceFee();

  const [filteredPayments, setFilteredPayments] = useState<GroupedPaymentItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(new Date());
  const [tempEndDate, setTempEndDate] = useState(new Date());

  // Helper function to load payments with date filtering
  const loadPaymentsWithDateFilter = (unitId: number, filter: DateFilter, startDate?: string, endDate?: string) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    let startDateParam: string | undefined;
    let endDateParam: string | undefined;

    console.log('🔍 loadPaymentsWithDateFilter called:', {
      unitId,
      filter,
      startDate,
      endDate,
      timestamp: new Date().toISOString()
    });

    switch (filter) {
      case 'last3months':
        // Calculate last 3 months for service period filtering
        // We want: exactly 3 months including current month
        // Example: If October, show August, September, October (3 months total)
        const currentMonth = now.getMonth() + 1; // JavaScript months are 0-based, but we want 1-based for service periods

        console.log('📅 Current date info:', {
          currentYear,
          currentMonth,
          now: now.toISOString(),
          nowMonth: now.getMonth(),
          nowYear: now.getFullYear(),
          deviceDate: new Date().toISOString(),
          deviceMonth: new Date().getMonth() + 1,
          deviceYear: new Date().getFullYear()
        });

        // Calculate the exact 3 months we want to include
        // For "Last 3 months", we want: current month + 2 previous months
        const targetMonths = [];
        for (let i = 2; i >= 0; i--) { // Go back 2 months, then 1 month, then current month
          let month = currentMonth - i;
          let year = currentYear;

          // Handle year boundary crossing
          if (month <= 0) {
            month += 12;
            year -= 1;
          }

          targetMonths.push({ year, month });
        }

        console.log('📅 Target months for last 3 months:', {
          currentYear,
          currentMonth,
          targetMonths: targetMonths.map(m => `${m.year}-${m.month.toString().padStart(2, '0')}`),
          description: `Want exactly these 3 months: ${targetMonths.map(m => `${m.year}-${m.month.toString().padStart(2, '0')}`).join(', ')}`
        });

        // Create date range for filtering
        // Start from the beginning of the first target month
        const firstMonth = targetMonths[0];
        const lastMonth = targetMonths[targetMonths.length - 1];

        // IMPORTANT: targetMonths uses 1-based months (1-12), but Date constructor uses 0-based (0-11)
        // So we need to subtract 1 from month when creating Date objects
        const start = new Date(firstMonth.year, firstMonth.month - 1, 1); // -1 because Date constructor expects 0-based months
        const end = new Date(lastMonth.year, lastMonth.month, 0, 23, 59, 59, 999); // 0th day of current month (using 0-based) = last day of previous month (which is our target month)

        console.log('📅 Date range calculation:', {
          start: start.toISOString(),
          end: end.toISOString(),
          startMonth: start.getMonth() + 1, // Convert back to 1-based
          endMonth: end.getMonth() + 1,     // Convert back to 1-based
          startYear: start.getFullYear(),
          endYear: end.getFullYear(),
          targetMonths: targetMonths.map(m => `${m.year}-${m.month.toString().padStart(2, '0')}`)
        });

        // Format dates without timezone conversion (avoid toISOString UTC conversion)
        startDateParam = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
        endDateParam = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

        console.log('📅 Last 3 months service period range:', {
          startDateParam,
          endDateParam,
          targetMonths: targetMonths.map(m => `${m.year}-${m.month.toString().padStart(2, '0')}`),
          expectedCount: 3,
          warning: 'Should only show 3 months, not 4!',
          actualRange: `${startDateParam} to ${endDateParam}`,
          check: `If current month is ${currentMonth}, should show: ${targetMonths.map(m => `${m.year}-${m.month.toString().padStart(2, '0')}`).join(', ')}`
        });
        break;
      case 'thisyear':
        startDateParam = `${currentYear}-01-01`;
        endDateParam = `${currentYear + 1}-01-01`;
        break;
      case 'custom':
        if (startDate && endDate) {
          startDateParam = startDate;
          endDateParam = endDate;
        }
        break;
      case 'all':
      default:
        // No date filtering
        break;
    }

    console.log('📅 Loading payments with date filter:', {
      unitId,
      filter,
      startDateParam,
      endDateParam,
      customStartDate: startDate,
      customEndDate: endDate
    });

    const params: any = { unit: unitId };
    if (startDateParam) {
      params.start_date = startDateParam;
    }
    if (endDateParam) {
      params.end_date = endDateParam;
    }

    console.log('📅 Final API params:', params);
    console.log('📅 Expected service periods:', {
      startDate: startDateParam,
      endDate: endDateParam,
      shouldInclude: 'Calculated in switch statement',
      warning: 'Backend should filter to exactly 3 months!'
    });
    loadPayments(params);
  };

  // Debug logging
  console.log('📱 PaymentHistoryScreen render:', {
    unit: unit ? `${unit.tower_name}, ${unit.unit_name}` : 'none',
    unitId: unit?.id,
    unitUnitId: unit?.unit_id,
    paymentsCount: payments?.length || 0,
    filteredCount: filteredPayments?.length || 0,
    isLoadingPayments,
    dateFilter,
    paymentsData: payments?.slice(0, 2) // Show first 2 payments for debugging
  });

  useEffect(() => {
    if (unit) {
      // Load payments for this unit
      // Try multiple possible unit ID fields
      const unitIdToUse = unit.unit_id || unit.id || unit.unitId;
      console.log('📡 PaymentHistoryScreen loading payments for unit:', {
        unitId: unit.id,
        unitUnitId: unit.unit_id,
        unitIdToUse,
        unitIdToUseType: typeof unitIdToUse,
        unitName: unit.unit_name,
        towerName: unit.tower_name,
        dueAmount: unit.due_amount,
        unitObject: unit,
        allUnitKeys: Object.keys(unit)
      });

      if (unitIdToUse) {
        // Ensure unitIdToUse is a number
        const numericUnitId = parseInt(unitIdToUse.toString(), 10);
        console.log('📡 PaymentHistoryScreen calling loadPayments with:', {
          unit: numericUnitId,
          unitType: typeof numericUnitId,
          isNaN: isNaN(numericUnitId)
        });

        if (!isNaN(numericUnitId)) {
          // Load payments with current date filter
          loadPaymentsWithDateFilter(numericUnitId, dateFilter, customStartDate, customEndDate);
        } else {
          console.error('❌ Invalid unit ID:', unitIdToUse);
        }
      } else {
        console.error('❌ No unit ID found in unit object:', unit);
      }
    }
  }, [unit, loadPayments, dateFilter, customStartDate, customEndDate]);

  useEffect(() => {
    if (unit) {
      console.log('📊 PaymentHistoryScreen processing payments:', {
        hasUnit: !!unit,
        paymentsLength: payments.length,
        unitId: unit.id,
        unitUnitId: unit.unit_id,
        isLoadingPayments,
        paymentsData: payments.slice(0, 3), // Show first 3 payments for debugging
        allPaymentStatuses: payments.map(p => ({
          id: p.id,
          txn: p.transaction_id,
          status: p.payment_status,
          amount: p.amount
        }))
      });

      if (payments.length > 0) {
        // Filter to only show actual completed payments with payment details
        // Exclude unpaid/pending bills that haven't been paid yet
        const actualPayments = payments.filter(payment => {
          // Show payments that have actual payment details (completed OR partial with payment date/transaction)
          const hasPaymentDate = payment.payment_date && payment.payment_date !== 'N/A' && payment.payment_date !== '';
          const hasTransactionId = payment.transaction_id && payment.transaction_id !== 'N/A' && payment.transaction_id !== '';
          const hasBillingRecord = (payment as any).billing_record_id || payment.receipt_id;

          // Payment is actual if it has payment date OR transaction ID OR billing record
          // This includes both fully paid (completed) and partially paid (pending but with payment made)
          const isActualPayment = hasPaymentDate || hasTransactionId || hasBillingRecord;

          if (!isActualPayment) {
            console.log('🚫 Filtered out unpaid/pending payment:', {
              id: payment.id,
              service_period: payment.service_period_display,
              payment_status: payment.payment_status,
              payment_date: payment.payment_date,
              transaction_id: payment.transaction_id,
              billing_record_id: (payment as any).billing_record_id,
              reason: 'No payment details - not an actual payment transaction'
            });
          }

          return isActualPayment;
        });

        // Convert filtered payments to PaymentItem[] format
        const paymentItems: PaymentItem[] = actualPayments.map(payment => {
          console.log('🔍 Processing payment:', {
            id: payment.id,
            transaction_id: payment.transaction_id,
            payment_status: payment.payment_status,
            amount: payment.amount,
            service_period: payment.service_period_display,
            payment_result_display: payment.payment_result_display,
            service_status_display: payment.service_status_display,
            remaining_amount: payment.remaining_amount,
            is_fully_paid: payment.is_fully_paid,
            original_amount: payment.original_amount,
            service_fee_amount: payment.service_fee_amount,
            base_service_amount: (payment as any).base_service_amount,
            additional_bill_charges: (payment as any).additional_bill_charges
          });

          return {
            id: payment.id?.toString() || payment.transaction_id,
            receipt_id: payment.receipt_id,  // Add receipt_id from backend
            transaction_id: payment.transaction_id,
            amount: payment.amount?.toString() || '0',
            payment_method: payment.payment_method_display || payment.method_display || 'Not Set',
            method_display: payment.payment_method_display || payment.method_display || 'Not Set',
            payment_date: payment.payment_date || '',
            due_date: payment.due_date || '',  // Capture due_date
            service_period_display: payment.service_period_display || 'N/A',
            reference_number: payment.reference_number,
            payment_status: payment.payment_status || 'pending',
            status_display: payment.service_status_display || 'Pending',
            service_status_display: payment.service_status_display || 'Pending',
            payment_result_display: payment.payment_result_display,  // Historical status
            is_overdue: payment.is_overdue || false,
            is_fully_paid: payment.is_fully_paid || false,
            notes: payment.notes,
            unit_id: payment.unit_id || 0,
            payment_type: (payment as any).payment_type,
            created_by_name: (payment as any).created_by_name,
            // Add original amount fields
            service_fee_amount: payment.service_fee_amount?.toString(),
            billing_amount: payment.service_fee_amount?.toString(), // Use service_fee_amount as billing_amount
            original_amount: payment.original_amount?.toString(),
            fee_amount: payment.service_fee_amount?.toString(), // Use service_fee_amount as fee_amount
            remaining_amount: payment.remaining_amount?.toString(),
            penalty_amount: payment.penalty_amount?.toString(),
            gross_penalty_amount: (payment as any).gross_penalty_amount?.toString(),
            waived_amount: payment.waived_amount?.toString(),
            penalty_after_waiver: payment.penalty_after_waiver?.toString(),
            waiver_reason: payment.waiver_reason?.toString(),
            total_amount: (payment as any).total_amount?.toString(),
            base_service_amount: (payment as any).base_service_amount?.toString(),
            additional_bill_charges: (payment as any).additional_bill_charges?.toString()
          };
        });

        // Group by transaction_id so one invoice = one card (bill + advance together)
        const byTxn = new Map<string, PaymentItem[]>();
        for (const p of paymentItems) {
          const txn = p.transaction_id || p.receipt_id || p.id;
          if (!byTxn.has(txn)) byTxn.set(txn, []);
          byTxn.get(txn)!.push(p);
        }
        const grouped: GroupedPaymentItem[] = [];
        byTxn.forEach((allocs, txn) => {
          const first = allocs[0];
          const total = allocs.reduce((sum, a) => sum + parseFloat(a.amount || '0'), 0);
          grouped.push({
            key: txn,
            transaction_id: first.transaction_id,
            receipt_id: first.receipt_id,
            payment_date: first.payment_date,
            method_display: first.method_display,
            total_amount: total.toFixed(2),
            allocations: allocs,
          });
        });
        // Sort by payment date descending (newest first)
        grouped.sort((a, b) => {
          const dA = a.payment_date ? new Date(a.payment_date).getTime() : 0;
          const dB = b.payment_date ? new Date(b.payment_date).getTime() : 0;
          return dB - dA;
        });

        console.log('📊 PaymentHistoryScreen processed payments:', {
          paymentItemsCount: paymentItems.length,
          groupedCount: grouped.length,
          dateFilter,
          customStartDate,
          customEndDate,
        });
        setFilteredPayments(grouped);
      } else {
        console.log('📊 PaymentHistoryScreen no payments found for unit:', {
          unitId: unit.id,
          unitUnitId: unit.unit_id,
          isLoadingPayments
        });
        setFilteredPayments([]);
      }
    }
  }, [payments, unit, isLoadingPayments]);



  const onRefresh = async () => {
    setRefreshing(true);
    try {
      console.log('🔄 PaymentHistoryScreen refresh triggered');
      if (unit) {
        // Reload payments data with current date filter
        const unitIdToUse = unit.unit_id || unit.id || unit.unitId;
        if (unitIdToUse) {
          const numericUnitId = parseInt(unitIdToUse.toString(), 10);
          if (!isNaN(numericUnitId)) {
            loadPaymentsWithDateFilter(numericUnitId, dateFilter, customStartDate, customEndDate);
          }
        }
      }
      console.log('✅ Payment history data refreshed successfully');
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('❌ Error during payment history refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDateFilterChange = (filter: DateFilter) => {
    setDateFilter(filter);
    if (filter === 'custom') {
      setShowCustomDateModal(true);
    } else {
      // Reload data with new filter
      if (unit) {
        const unitIdToUse = unit.unit_id || unit.id || unit.unitId;
        if (unitIdToUse) {
          const numericUnitId = parseInt(unitIdToUse.toString(), 10);
          if (!isNaN(numericUnitId)) {
            loadPaymentsWithDateFilter(numericUnitId, filter, customStartDate, customEndDate);
          }
        }
      }
    }
  };

  const handleCustomDateSubmit = () => {
    if (!customStartDate || !customEndDate) {
      Alert.alert('Error', 'Please select both start and end dates');
      return;
    }

    if (new Date(customStartDate) > new Date(customEndDate)) {
      Alert.alert('Error', 'Start date cannot be after end date');
      return;
    }

    setShowCustomDateModal(false);

    // Reload data with custom date range
    if (unit) {
      const unitIdToUse = unit.unit_id || unit.id || unit.unitId;
      if (unitIdToUse) {
        const numericUnitId = parseInt(unitIdToUse.toString(), 10);
        if (!isNaN(numericUnitId)) {
          loadPaymentsWithDateFilter(numericUnitId, 'custom', customStartDate, customEndDate);
        }
      }
    }
  };

  // Format date to YYYY-MM-DD for backend
  const formatDateForBackend = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format date for display (e.g., "Jan 15, 2024")
  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return 'Select Date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Handle start date picker change
  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartDatePicker(false);
    }

    if (selectedDate) {
      setTempStartDate(selectedDate);
      const formattedDate = formatDateForBackend(selectedDate);
      setCustomStartDate(formattedDate);

      if (Platform.OS === 'ios') {
        // iOS will close manually
      }
    }
  };

  // Handle end date picker change
  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndDatePicker(false);
    }

    if (selectedDate) {
      setTempEndDate(selectedDate);
      const formattedDate = formatDateForBackend(selectedDate);
      setCustomEndDate(formattedDate);

      if (Platform.OS === 'ios') {
        // iOS will close manually
      }
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return 'N/A';
    }
  };

  const formatCurrency = (amount: string | number) => {
    if (!amount) return '0';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return '0';
    return numAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Format service period with day (e.g., "October 3, 2025")
  const formatServicePeriodWithDay = (servicePeriodDisplay: string, dueDate?: string) => {
    if (!servicePeriodDisplay || servicePeriodDisplay === 'N/A') return 'N/A';

    try {
      // Extract day from due_date if available
      let day = 3; // Default to 3rd of the month (common due day)

      if (dueDate) {
        try {
          const date = new Date(dueDate);
          if (!isNaN(date.getTime())) {
            // Use the day from due_date as the due day
            day = date.getDate();
          }
        } catch (e) {
          // If parsing fails, use default day
        }
      }

      // Parse service_period_display (e.g., "October 2025" or "October, 2025")
      const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];

      // Try to match month and year - handle various formats
      const parts = servicePeriodDisplay.trim().split(/[\s,]+/).filter(p => p.length > 0);
      let monthName = '';
      let year = '';

      for (const part of parts) {
        // Check for full month name
        const fullMonthIndex = monthNames.findIndex(m =>
          m.toLowerCase() === part.toLowerCase()
        );
        if (fullMonthIndex !== -1) {
          monthName = monthNames[fullMonthIndex];
          continue;
        }

        // Check for abbreviated month (first 3 letters)
        const abbrevMonthIndex = monthNames.findIndex(m =>
          m.substring(0, 3).toLowerCase() === part.toLowerCase()
        );
        if (abbrevMonthIndex !== -1) {
          monthName = monthNames[abbrevMonthIndex];
          continue;
        }

        // Check for year (4 digits)
        if (/^\d{4}$/.test(part)) {
          year = part;
        }
      }

      if (monthName && year) {
        return `${monthName} ${day}, ${year}`;
      }

      // Fallback: try to parse with regex
      const dateMatch = servicePeriodDisplay.match(/(\w+)\s+(\d{4})/);
      if (dateMatch) {
        const monthIndex = monthNames.findIndex(m =>
          m.toLowerCase() === dateMatch[1].toLowerCase() ||
          m.substring(0, 3).toLowerCase() === dateMatch[1].toLowerCase()
        );
        if (monthIndex !== -1) {
          return `${monthNames[monthIndex]} ${day}, ${dateMatch[2]}`;
        }
      }

      // If all parsing fails, return original
      return servicePeriodDisplay;
    } catch (error) {
      console.error('Error formatting service period:', error);
      return servicePeriodDisplay;
    }
  };

  const getPaymentStatus = (payment: PaymentItem) => {
    console.log('🔍 getPaymentStatus called for payment:', {
      transaction_id: payment.transaction_id,
      payment_result_display: payment.payment_result_display,
      remaining_amount: payment.remaining_amount,
      amount: payment.amount
    });

    // Advance payments: "Advance paid" with blue background
    if (payment.payment_type === 'advance_payment') {
      return {
        label: 'Advance paid',
        color: 'text-white',
        bgColor: 'bg-blue-500',
      };
    }

    // Priority 1: Check payment_result_display (shows 'Paid' for full, 'Partial' for partial)
    if (payment.payment_result_display) {
      const resultDisplay = payment.payment_result_display.trim();

      console.log('✅ Using payment_result_display:', {
        payment_result_display: resultDisplay,
        transaction_id: payment.transaction_id
      });

      // When payment_result is 'full', backend returns 'Paid'
      if (resultDisplay === 'Paid' || resultDisplay.toLowerCase().includes('paid') || resultDisplay.toLowerCase().includes('full')) {
        return {
          label: 'Paid',
          color: 'text-white',
          bgColor: 'bg-paymentPaid',
        };
      }

      // When payment_result is 'partial', backend returns 'Partial'
      if (resultDisplay === 'Partial' || resultDisplay.toLowerCase().includes('partial')) {
        return {
          label: 'Partial',
          color: 'text-paymentPartial',
          bgColor: 'bg-paymentPartialBg',
        };
      }
    }

    // Priority 2: Check remaining_amount
    if (payment.remaining_amount !== undefined && payment.remaining_amount !== null && payment.remaining_amount !== '') {
      const remaining = typeof payment.remaining_amount === 'string'
        ? parseFloat(payment.remaining_amount)
        : payment.remaining_amount;

      if (!isNaN(remaining) && remaining < 1) {
        return {
          label: 'Paid',
          color: 'text-white',
          bgColor: 'bg-paymentPaid',
        };
      }
      if (!isNaN(remaining) && remaining >= 1) {
        return {
          label: 'Partial',
          color: 'text-paymentPartial',
          bgColor: 'bg-paymentPartialBg',
        };
      }
    }

    // Priority 3: For completed payments, default to "Paid"
    if (payment.payment_status === 'completed') {
      return {
        label: 'Paid',
        color: 'text-white',
        bgColor: 'bg-paymentPaid',
      };
    }

    // Final fallback: default to "Partial"
    return {
      label: 'Partial',
      color: 'text-paymentPartial',
      bgColor: 'bg-paymentPartialBg',
    };
  };

  const getPaymentMethodDisplay = (method: string) => {
    if (!method) return 'N/A';

    // Handle SSLCommerz card type format: "Card Type: NAGAD-Nagad"
    if (method.includes('Card Type:')) {
      const cardType = method.split('Card Type:')[1]?.trim();
      return cardType || method;
    }

    const methodLower = method.toLowerCase();

    switch (methodLower) {
      case 'bkash':
        return 'bKash';
      case 'nagad':
        return 'Nagad';
      case 'rocket':
        return 'Rocket';
      case 'upay':
        return 'Upay';
      case 'bank_transfer':
      case 'bank transfer':
      case 'bank':
        return 'Bank Transfer';
      case 'card':
      case 'credit card':
      case 'debit card':
        return 'Card';
      case 'visa':
        return 'Visa';
      case 'mastercard':
        return 'Mastercard';
      case 'amex':
        return 'Amex';
      case 'cash':
        return 'Cash';
      // Don't display gateway names to users
      case 'paystation':
      case 'sslcommerz':
        return 'N/A';
      default:
        return method;
    }
  };

  const getPaymentMethodWithCardType = (payment: PaymentItem) => {
    // Use API value first (PayStation now stores actual method e.g. bKash)
    const apiMethod = payment.method_display || payment.payment_method;
    if (apiMethod && apiMethod !== 'Not Set' && apiMethod !== 'N/A') {
      return getPaymentMethodDisplay(apiMethod);
    }

    // Then try to extract payment method from notes if available
    if (payment.notes) {
      // Look for SSLCommerz card type pattern and clean it up
      const cardTypeMatch = payment.notes.match(/Card Type:\s*([^,]+)/);
      if (cardTypeMatch) {
        let cardType = cardTypeMatch[1].trim();

        // Clean up the card type format (e.g., "BKASH-Bkash" -> "bKash")
        if (cardType.includes('-')) {
          const parts = cardType.split('-');
          if (parts.length >= 2) {
            // Take the second part and format it properly
            const secondPart = parts[1].trim();
            // Convert to proper case (first letter uppercase, rest lowercase)
            cardType = secondPart.charAt(0).toUpperCase() + secondPart.slice(1).toLowerCase();
          }
        }

        // Handle specific payment method formatting
        switch (cardType.toLowerCase()) {
          case 'bkash':
            return 'bKash';
          case 'nagad':
            return 'Nagad';
          case 'rocket':
            return 'Rocket';
          case 'bank transfer':
            return 'Bank Transfer';
          case 'cash':
            return 'Cash';
          default:
            return cardType;
        }
      }

      // Look for other payment method patterns in notes (e.g. PayStation advance with no stored method)
      const bkashMatch = payment.notes.match(/bKash|BKash/i);
      if (bkashMatch) {
        return 'bKash';
      }

      const nagadMatch = payment.notes.match(/Nagad|NAGAD/i);
      if (nagadMatch) {
        return 'Nagad';
      }

      const rocketMatch = payment.notes.match(/Rocket|ROCKET/i);
      if (rocketMatch) {
        return 'Rocket';
      }

      const bankMatch = payment.notes.match(/Bank Transfer|bank transfer/i);
      if (bankMatch) {
        return 'Bank Transfer';
      }

      const cashMatch = payment.notes.match(/Cash|cash/i);
      if (cashMatch) {
        return 'Cash';
      }
    }

    // Fallback: show "N/A" for unknown/missing methods
    return 'N/A';
  };

  const handlePaymentPress = (payment: PaymentItem, groupedAllocations?: PaymentItem[]) => {
    console.log('📄 Navigating to ReceiptView with payment:', {
      payment_id: payment.id,
      transaction_id: payment.transaction_id,
      receipt_id: payment.receipt_id,
      allocationsCount: groupedAllocations?.length,
    });
    (navigation as any).navigate('ReceiptView', { payment, unit, groupedAllocations: groupedAllocations ?? undefined });
  };

  const getFilterLabel = (filter: DateFilter) => {
    switch (filter) {
      case 'all': return 'All Time';
      case 'last3months': return 'Last 3 Months';
      case 'thisyear': return 'This Year';
      case 'custom': return 'Custom Range';
      default: return 'All Time';
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-white px-4 py-3 flex-row items-center">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="flex-row items-center pr-2"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#3C9D9B" />
        </TouchableOpacity>
        <Text className="text-black text-xl font-oxanium-bold">
          Payment History
        </Text>
      </View>

      {/* Unit Info */}
      <View className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <Text className="text-black text-lg font-lato-bold">
          {unit.tower_name}, {unit.unit_name}
        </Text>
      </View>

      {/* Date Filters */}
      <View className="bg-white px-4 py-3 border-b border-gray-200">
        <Text className="text-black text-sm font-lato-medium mb-2">
          Filter by Date Range
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          {(['all', 'last3months', 'thisyear', 'custom'] as DateFilter[]).map((filter) => (
            <TouchableOpacity
              key={filter}
              onPress={() => handleDateFilterChange(filter)}
              className={`px-4 py-2 rounded-full mr-2 ${dateFilter === filter
                  ? 'bg-primary'
                  : 'bg-gray-100'
                }`}
            >
              <Text className={`text-sm font-lato-medium ${dateFilter === filter
                  ? 'text-white'
                  : 'text-gray-700'
                }`}>
                {getFilterLabel(filter)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content: one card per transaction (same invoice = one card with breakdown) */}
      <FlatList
        data={filteredPayments}
        keyExtractor={(item) => item.key}
        renderItem={({ item: group }) => {
          const first = group.allocations[0];
          const hasMultiple = group.allocations.length > 1;
          const hasAdvance = group.allocations.some(a => a.payment_type === 'advance_payment');
          const hasBill = group.allocations.some(a => a.payment_type !== 'advance_payment');
          const paymentStatus = getPaymentStatus(first);
          const title = hasMultiple
            ? 'Payment'
            : (first.payment_type === 'advance_payment' ? 'Advance Payment' : (first.service_period_display || 'Payment'));
          return (
            <TouchableOpacity
              onPress={() => handlePaymentPress(first, group.allocations)}
              className="bg-white rounded-lg p-4 mx-4 mb-4 border border-gray-200 shadow-sm"
            >
              {/* Header */}
              <View className="flex-row justify-between items-start mb-3">
                <View className="flex-1">
                  <Text className="text-black font-oxanium-bold text-lg">
                    {title}
                  </Text>
                  <Text className="text-black font-lato mt-1">
                    Invoice: {group.transaction_id || 'N/A'}
                  </Text>
                  {first.payment_type === 'advance_payment' && !hasMultiple && first.notes ? (
                    <Text className="text-gray-600 font-lato text-sm mt-1" numberOfLines={2}>
                      {first.notes}
                    </Text>
                  ) : null}
                </View>
                <View className={`${paymentStatus.bgColor} px-3 py-1 rounded-full`}>
                  <Text className={`${paymentStatus.color} text-xs font-bold font-lato uppercase`}>
                    {paymentStatus.label}
                  </Text>
                </View>
              </View>

              {/* Total amount */}
              <View className="flex-row justify-between mb-2">
                <Text className="text-black text-base font-lato">
                  Amount:
                </Text>
                <Text className="text-primary text-base font-lato-bold">
                  Tk {formatCurrency(group.total_amount)}
                </Text>
              </View>

              {/* Breakdown when same invoice has multiple allocations (bill + advance) */}
              {hasMultiple && (
                <View className="bg-gray-50 rounded-lg p-3 mb-2">
                  <Text className="text-gray-600 text-xs font-lato-bold uppercase mb-2">Breakdown</Text>
                  {group.allocations.map((alloc, idx) => {
                    const isAdvance = alloc.payment_type === 'advance_payment';

                    // For bill rows: show full bill (base + utility + penalty - waived)
                    // For advance rows: show advance amount
                    let displayAmount = '';
                    if (isAdvance) {
                      displayAmount = `Tk ${formatCurrency(alloc.amount || '0')}`;
                    } else {
                      const base = parseFloat(alloc.original_amount || alloc.service_fee_amount || alloc.base_service_amount || '0');
                      const utility = parseFloat(alloc.additional_bill_charges || '0');
                      const penalty = parseFloat(alloc.gross_penalty_amount || alloc.penalty_amount || '0');
                      const waived = parseFloat(alloc.waived_amount || '0');
                      const fullBillAmount = base + utility + penalty - waived;
                      displayAmount = `(Bill: Tk ${formatCurrency(fullBillAmount.toString())})`;
                    }

                    return (
                      <View key={`${alloc.id}-${idx}`} className="flex-row justify-between py-1">
                        <Text className="text-black text-sm font-lato">
                          {isAdvance ? 'Advance' : (alloc.service_period_display || 'Bill')}
                        </Text>
                        <Text className="text-black text-sm font-lato-semibold">
                          {displayAmount}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Payment Details */}
              <View className="space-y-2">
                <View className="flex-row justify-between">
                  <Text className="text-black text-base font-lato">
                    Method:
                  </Text>
                  <Text className="text-black text-base font-lato">
                    {getPaymentMethodWithCardType(first)}
                  </Text>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-black text-base font-lato">
                    Date:
                  </Text>
                  <Text className="text-black text-base font-lato">
                    {formatDate(group.payment_date)}
                  </Text>
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-black text-base font-lato">
                    Time:
                  </Text>
                  <Text className="text-black text-base font-lato">
                    {formatTime(group.payment_date)}
                  </Text>
                </View>
              </View>

              {/* View Receipt Button */}
              <View className="mt-3 pt-3 border-t border-gray-100">
                <TouchableOpacity
                  onPress={() => handlePaymentPress(first, group.allocations)}
                  className="bg-white border border-black rounded-lg p-4 items-center"
                  activeOpacity={0.8}
                >
                  <Text className="font-lato-bold text-xl">
                    View Receipt
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={() => {
          if (isLoadingPayments) {
            return (
              <View className="flex-1 items-center justify-center py-8">
                <ActivityIndicator size="large" color="#3D9D9B" />
                <Text className="text-gray-600 mt-4 font-lato-regular">
                  Loading payment history...
                </Text>
              </View>
            );
          }

          if (paymentsError) {
            return (
              <View className="flex-1 items-center justify-center py-8 px-6">
                <View className="w-20 h-20 rounded-full bg-red-100 items-center justify-center mb-4">
                  <Text className="text-red-500 text-2xl">⚠️</Text>
                </View>
                <Text className="text-red-600 text-lg text-center font-lato-medium mb-2">
                  Error loading payments
                </Text>
                <Text className="text-red-500 text-sm text-center font-lato-regular">
                  {paymentsError}
                </Text>
              </View>
            );
          }

          return (
            <View className="flex-1 items-center justify-center py-8 px-6">
              <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
                <Text className="text-gray-400 text-2xl">📋</Text>
              </View>
              <Text className="text-gray-600 text-lg text-center font-lato-medium mb-2">
                No payments found for the selected filters.
              </Text>
              <Text className="text-gray-500 text-sm text-center font-lato-regular">
                Try adjusting your date range or check back later.
              </Text>
            </View>
          );
        }}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 16, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3C9D9B']}
            tintColor="#3C9D9B"
          />
        }
      />

      {/* Custom Date Range Modal */}
      <Modal
        visible={showCustomDateModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCustomDateModal(false)}
      >
        <View className="flex-1 items-center justify-center px-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}>
          <View className="bg-white rounded-lg p-6 w-full max-w-sm">
            <Text className="text-lg font-bold font-lato-bold mb-4 text-center">
              Custom Date Range
            </Text>

            {/* Start Date Picker */}
            <View className="mb-4">
              <Text className="text-gray-700 text-sm font-lato mb-2">
                Start Date
              </Text>
              <TouchableOpacity
                onPress={() => setShowStartDatePicker(true)}
                className="border border-gray-300 rounded-lg px-3 py-3 flex-row items-center justify-between"
              >
                <Text className="text-gray-800 font-lato">
                  {formatDateForDisplay(customStartDate)}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* End Date Picker */}
            <View className="mb-6">
              <Text className="text-gray-700 text-sm font-lato mb-2">
                End Date
              </Text>
              <TouchableOpacity
                onPress={() => setShowEndDatePicker(true)}
                className="border border-gray-300 rounded-lg px-3 py-3 flex-row items-center justify-between"
              >
                <Text className="text-gray-800 font-lato">
                  {formatDateForDisplay(customEndDate)}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowCustomDateModal(false);
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="flex-1 bg-gray-200 rounded-lg py-3 items-center"
              >
                <Text className="text-gray-700 font-lato">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCustomDateSubmit}
                className="flex-1 bg-primary rounded-lg py-3 items-center"
              >
                <Text className="text-white font-lato">Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Start Date Picker */}
      {showStartDatePicker && (
        <DateTimePicker
          value={tempStartDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleStartDateChange}
          maximumDate={new Date()}
        />
      )}

      {/* End Date Picker */}
      {showEndDatePicker && (
        <DateTimePicker
          value={tempEndDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleEndDateChange}
          maximumDate={new Date()}
        />
      )}
    </SafeAreaView>
  );
};

export default PaymentHistoryScreen;
