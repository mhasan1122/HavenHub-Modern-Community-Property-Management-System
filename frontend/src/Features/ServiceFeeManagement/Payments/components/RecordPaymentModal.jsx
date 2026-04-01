import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import 'react-datepicker/dist/react-datepicker.css';
import { RxCross1 } from 'react-icons/rx';

import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import { createPayment, updatePayment } from '../../../../redux/slices/api/paymentApi';
import MessageBox from '../../../../Components/MessageBox/MessageBox';
import ConfirmationMessageBox from '../../../../Components/MessageBox/ConfirmationMessageBox';
import { clearErrors, clearSuccessStates, clearPaymentItems } from '../../../../redux/slices/payments/paymentSlice';
import MonthYearPicker from '../../components/MonthYearPicker';

import { fetchServiceFeeResidentsSingle, fetchFilterOptions } from '../../../../redux/slices/api/serviceFeeManagement/serviceFeeManagementApi';
// import { updateResidentPayment } from '../../../../redux/slices/serviceFee/serviceFeeSlice';
import UserSearchInput from '../../components/UserSearchInput';
import { FaPlus, FaTimes } from 'react-icons/fa';
import { FaWallet, FaRegCreditCard, FaBuildingColumns, FaMoneyBillWave } from 'react-icons/fa6';
import axiosInstance from '../../../../utils/axiosInstance';
import ModernLoadingAnimation from '../../../../Components/Loaders/ModernLoadingAnimation';
import ModernDatePicker from '../../../../Components/FormComponent/ModernDatePicker';
import WaivePenaltyModal from './WaivePenaltyModal';
import calculateDaysOverdue from '../../utils/feeUtils';











// Payment logic constants moved to dynamic state inside component



const RecordPaymentModal = ({ isOpen, onClose, payment = null, residentId = null, unitId = null, onSuccess = null }) => {
  // Use the utility function for calculations



  // Confirmation dialog state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const dispatch = useDispatch();
  const { creating, updating, createError, updateError, createSuccess, updateSuccess } = useSelector(state => state.payments);

  // Get filter options including payment methods
  const serviceFeeState = useSelector(state => state.serviceFeeManagement) || {};
  const { filterOptions = { payment_methods: [] } } = serviceFeeState;

  // Get current user from auth state
  const currentUser = useSelector(state => state.auth?.user);
  // console.log('👤 Current User:', currentUser);
  // State for selected user in autocomplete
  const [selectedUser, setSelectedUser] = useState(null);
  const [receivedByUser, setReceivedByUser] = useState(null); // State for Cash Received By autocomplete
  const [amountError, setAmountError] = useState('');
  const [createdByError, setCreatedByError] = useState('');
  const [isCreatedByValid, setIsCreatedByValid] = useState(false);

  // Multi-month payment states
  const [unpaidPeriods, setUnpaidPeriods] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [totalAdvance, setTotalAdvance] = useState(0); // NEW: Store advance amount from API
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [apiSuccessMessage, setApiSuccessMessage] = useState(null);
  const [apiErrorMessage, setApiErrorMessage] = useState(null);
  const [showWaiverHistory, setShowWaiverHistory] = useState({});
  const [showWaivePenaltyModal, setShowWaivePenaltyModal] = useState(false);
  const [selectedMonthForWaiver, setSelectedMonthForWaiver] = useState(null);
  const [editingWaiverIndex, setEditingWaiverIndex] = useState(null);
  const [waiverDeleteState, setWaiverDeleteState] = useState({
    isOpen: false,
    waiver: null,
    month: null,
    index: null
  });

  // Allocation confirmation states
  const [showAllocationConfirm, setShowAllocationConfirm] = useState(false);
  const [allocationSummary, setAllocationSummary] = useState(null);

  // Memoized calculation for all summary values - avoid redundant loops
  const summaryCalculations = useMemo(() => {
    let currentBalance = 0;
    let overdueBalance = 0;
    let totalPenalties = 0;
    let totalWaived = 0;

    availableMonths.forEach(m => {
      // Parse service_fee_items once per month (exclude penalty items)
      let serviceFeeItemsTotal = 0;
      try {
        let items = [];
        if (typeof m.service_fee_items === 'string') {
          items = JSON.parse(m.service_fee_items);
        } else if (Array.isArray(m.service_fee_items)) {
          items = m.service_fee_items;
        }
        // Filter out penalty items and service_fee duplicates (use base_fee and bill_category only)
        serviceFeeItemsTotal = items
          .filter(item => item.item_type !== 'penalty')
          .reduce((iSum, item) => iSum + parseFloat(item.amount || 0), 0);
      } catch (e) {
        console.error('Error parsing service_fee_items:', e);
      }

      // Get penalty amounts
      const grossPenaltyAmount = parseFloat(m.gross_penalty_amount || 0);
      const waived = Array.isArray(m.waiver_data)
        ? m.waiver_data.reduce((wSum, w) => wSum + parseFloat(w.waived_amount || w.waivedAmount || 0), 0)
        : 0;
      const paid = parseFloat(m.paid_amount || 0);
      const advance = parseFloat(m.advance_amount || 0);

      // Calculate outstanding
      // Option A: derived from items: serviceFeeItemsTotal + grossPenalty - waived - paid
      // Option B: derived from pre-calc API value: due_amount + grossPenalty - waived
      let outstanding = 0;
      if (serviceFeeItemsTotal > 0) {
        outstanding = Math.max(0, serviceFeeItemsTotal + grossPenaltyAmount - waived - paid);
      } else {
        // Fallback: Use the record's remaining balance directly if items are missing
        // m.due_amount comes from API as (amount - paid)
        const remainingServiceFee = parseFloat(m.due_amount || 0);
        outstanding = Math.max(0, remainingServiceFee + grossPenaltyAmount - waived);
      }

      // Accumulate current balance
      currentBalance += outstanding;

      // Accumulate overdue balance
      if (calculateDaysOverdue(m.due_date) > 0) {
        overdueBalance += outstanding;
      }

      // Accumulate penalties (use gross penalty amount)
      totalPenalties += grossPenaltyAmount;

      // Accumulate waivers
      totalWaived += waived;
    });

    // Use the total_advance from API instead of summing from months
    // (advance is unit-level, not period-level)
    return {
      currentBalance,
      overdueBalance,
      totalPenalties,
      totalWaived,
      totalAdvance: totalAdvance // Now using state from API
    };
  }, [availableMonths, totalAdvance]);

  // Dynamic payment categories and methods derived from filterOptions
  const { paymentCategories, groupedMethods, methodIdMap } = useMemo(() => {
    const methods = filterOptions?.payment_methods || [];
    const groups = {};
    const idMap = {};

    // Standard labels for internal types
    const categoryLabels = {
      'cash': 'Cash',
      'bank': 'Bank Transfer',
      'mfs': 'MFS',
      'card': 'Card',
      'other': 'Other'
    };

    methods.forEach(method => {
      const type = method.type || 'other';
      if (!groups[type]) groups[type] = [];
      groups[type].push(method);
      idMap[method.value] = method.label;
    });

    // Define fixed display order for categories
    const desiredOrder = ['cash', 'bank', 'mfs', 'card'];
    const categoriesList = desiredOrder
      .filter(type => groups[type])
      .map(type => ({
        value: type,
        label: categoryLabels[type]
      }));

    // Add any types not in desired order (excluding 'other' as requested)
    Object.keys(groups).forEach(type => {
      if (!desiredOrder.includes(type) && type !== 'other') {
        categoriesList.push({
          value: type,
          label: type.charAt(0).toUpperCase() + type.slice(1)
        });
      }
    });

    return { paymentCategories: categoriesList, groupedMethods: groups, methodIdMap: idMap };
  }, [filterOptions]);

  const [waiverEditState, setWaiverEditState] = useState({
    isOpen: false,
    waiverId: null,
    newData: null
  });

  const handleDeleteWaiver = (waiver, month, index) => {
    // If it's a new session waiver (not saved to DB), delete immediately without confirmation or success message
    if (waiver?.isSessionNew) {
      setAvailableMonths(prev => {
        const updated = prev.map(m => {
          if (m.service_period_month === month.service_period_month &&
            m.service_period_year === month.service_period_year) {
            const remaining = (m.waiver_data || []).filter((_, i) => i !== index);
            return { ...m, waiver_applied: remaining.length > 0, waiver_data: remaining };
          }
          return m;
        });
        return updated;
      });
      return;
    }

    // For past waivers (saved in DB), show confirmation dialog
    setWaiverDeleteState({ isOpen: true, waiver, month, index });
  };

  const confirmDeleteWaiver = async () => {
    const { waiver } = waiverDeleteState;
    if (!waiver) return;

    // We only reach here for past waivers that need API deletion
    try {
      const res = await axiosInstance.delete(`/api/service-fee-management/penalty-waivers/${waiver.id}/`);
      if (res.data.success || res.status === 200 || res.status === 204) {
        setApiSuccessMessage('Waiver deleted successfully.');
        setIsPaymentSuccess(false); // Not a final payment close
        fetchUnpaidPeriods({
          unit_id: formData.unitId,
          service_fee_id: formData.serviceFeeId,
          account_holder_type: formData.accountHolderType,
          account_holder_id: formData.accountHolderId
        }); // Refresh data with current form values
        // Also refresh background to update stats
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      console.error('Delete failed:', err);
      setApiErrorMessage(err.response?.data?.message || 'Error deleting waiver.');
    }

    setWaiverDeleteState({ isOpen: false, waiver: null, month: null, index: null });
  };

  const [formData, setFormData] = useState({
    member_id: payment?.member_id || null,
    serviceFeeId: payment?.service_fee_id || '',
    residentId: payment?.resident_id || residentId || '',
    unitId: payment?.unit_id || unitId || '',
    accountHolderType: payment?.account_holder_type || '',
    accountHolderId: payment?.account_holder_id || '',
    amount: '',
    manualAmount: '', // Track manual amount input
    currency: 'BDT',
    paymentMethod: 1, // Default to Cash (ID: 1)
    methodType: 'cash', // Categorized payment method type
    payment_date: new Date().toISOString().slice(0, 10), // Default to today
    bankFromAccount: '',
    bankToAccount: '',
    bankToAccountName: '',
    otherMethodName: '',
    otherFromAccount: '',
    otherToAccount: '',
    otherToAccountName: '', // Added for MFS/Other receiver name
    receivedBy: currentUser?.full_name || '',
    dueDate: '',
    service_period_month: new Date().getMonth() + 1,
    service_period_year: new Date().getFullYear(),
    referenceNumber: '',
    notes: '',
    sendEmail: true, // Default checked
    sendPrimarySMS: false, // Default unchecked
    sendSecondarySMS: false // Default unchecked
  });

  const [loading, setLoading] = useState(false);
  const [isManuallyEdited, setIsManuallyEdited] = useState(false); // Track if user manually edited amount
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false); // Track if success message is for final payment

  // Function to handle modal close with proper cleanup
  const handleClose = () => {
    // Clear all local errors
    setAmountError('');
    setCreatedByError('');
    setApiSuccessMessage(null);
    setApiErrorMessage(null);
    // Clear Redux errors
    dispatch(clearErrors());
    // Reset validation state
    setIsCreatedByValid(false);
    setSelectedUser(null);
    setShowAllocationConfirm(false);
    setAllocationSummary(null);
    // Call the original onClose function
    onClose();
  };

  // Helper function to validate form data before allocation or submission
  const validateForm = () => {
    // 1. Created By Validation
    if (!isCreatedByValid || !selectedUser?.id) {
      setApiErrorMessage('Please select a valid user for Created By field');
      setCreatedByError('Please select a valid user for Created By field');
      return false;
    }

    // 2. Amount Validation
    const inputAmount = parseFloat(formData.manualAmount || 0);
    const hasAdvance = totalAdvance > 0;

    if (!hasAdvance && (isNaN(inputAmount) || inputAmount <= 0)) {
      setApiErrorMessage('Payment amount must be greater than 0');
      setAmountError('Amount must be greater than 0');
      return false;
    }

    if (!isNaN(inputAmount) && inputAmount < 0) {
      setApiErrorMessage('Payment amount cannot be negative');
      setAmountError('Amount cannot be negative');
      return false;
    }

    // 3. Payment Method Specific Validations
    if (formData.methodType === 'cash') {
      const rcvBy = receivedByUser?.full_name || formData.receivedBy;
      if (!rcvBy) {
        setApiErrorMessage('Please specify who received the cash payment');
        return false;
      }
    }

    if (formData.methodType === 'bank') {
      if (!formData.bankFromAccount) {
        setApiErrorMessage("From Account Number is required for Bank Transfer");
        return false;
      }
      if (!formData.bankToAccount) {
        setApiErrorMessage("To Account Number is required for Bank Transfer");
        return false;
      }
      if (!formData.bankToAccountName) {
        setApiErrorMessage("To Account Name is required for Bank Transfer");
        return false;
      }
    }

    if (['mfs', 'other'].includes(formData.methodType)) {
      if (!formData.otherFromAccount) {
        setApiErrorMessage(`From Account Number/Phone is required for ${formData.methodType.toUpperCase()}`);
        return false;
      }
      if (!formData.otherToAccount) {
        setApiErrorMessage(`To Account Number/Phone is required for ${formData.methodType.toUpperCase()}`);
        return false;
      }
      if (!formData.otherToAccountName) {
        setApiErrorMessage(`Receiver's Name is required for ${formData.methodType.toUpperCase()}`);
        return false;
      }
    }

    return true;
  };

  // Function to prepare payment allocation breakdown for confirmation view
  const handlePrepareAllocation = () => {
    // Full validation before proceeding to confirmation
    if (!validateForm()) return;

    const inputAmount = parseFloat(formData.manualAmount || 0);

    // Calculate details for allocation breakdown
    const paymentAmount = inputAmount;

    // Helper function to calculate net due for a month (same logic as summaryCalculations)
    const calculateMonthNetDue = (month) => {
      // Parse service_fee_items once per month (exclude penalty items)
      let serviceFeeItemsTotal = 0;
      try {
        let items = [];
        if (typeof month.service_fee_items === 'string') {
          items = JSON.parse(month.service_fee_items);
        } else if (Array.isArray(month.service_fee_items)) {
          items = month.service_fee_items;
        }
        // Filter out penalty items and calculate total
        serviceFeeItemsTotal = items
          .filter(item => item.item_type !== 'penalty')
          .reduce((iSum, item) => iSum + parseFloat(item.amount || 0), 0);
      } catch (e) {
        console.error('Error parsing service_fee_items:', e);
      }

      // Get penalty amounts
      const grossPenaltyAmount = parseFloat(month.gross_penalty_amount || 0);
      const waived = Array.isArray(month.waiver_data)
        ? month.waiver_data.reduce((wSum, w) => wSum + parseFloat(w.waived_amount || w.waivedAmount || 0), 0)
        : 0;
      const paid = parseFloat(month.paid_amount || 0);

      // Calculate outstanding
      // Option A: derived from items: serviceFeeItemsTotal + grossPenalty - waived - paid
      // Option B: derived from pre-calc API value: due_amount + grossPenalty - waived
      let outstanding = 0;
      if (serviceFeeItemsTotal > 0) {
        outstanding = Math.max(0, serviceFeeItemsTotal + grossPenaltyAmount - waived - paid);
      } else {
        // Fallback: Use the record's remaining balance directly if items are missing
        const remainingServiceFee = parseFloat(month.due_amount || 0);
        outstanding = Math.max(0, remainingServiceFee + grossPenaltyAmount - waived);
      }

      return outstanding;
    };

    // Determine which periods will be paid
    let periodsToProcess = availableMonths.filter(month => month.isSelected);

    if (periodsToProcess.length === 0) {
      if (paymentAmount > 0) {
        let remaining = paymentAmount;
        periodsToProcess = availableMonths.filter(month => {
          if (remaining > 0) {
            const netDue = calculateMonthNetDue(month);

            if (netDue > 0) {
              remaining -= netDue;
              return true;
            }
          }
          return false;
        });
      } else if (hasAdvance && availableMonths.length > 0) {
        periodsToProcess = [availableMonths[0]];
      }
    }

    // Calculate allocated amounts for each period sequentially
    let remainingCash = paymentAmount;
    let remainingAdvance = totalAdvance;

    const allocatedPeriods = periodsToProcess.map(month => {
      const netDue = calculateMonthNetDue(month);

      // Allocating Strategy: Use Cash first, then Advance
      // 1. Apply Cash
      const cashAllocated = Math.min(remainingCash, netDue);
      remainingCash -= cashAllocated;

      // 2. Apply Advance to remaining due
      const remainingDueAfterCash = netDue - cashAllocated;
      const advanceAllocated = Math.min(remainingAdvance, remainingDueAfterCash);
      remainingAdvance -= advanceAllocated;

      const totalAllocated = cashAllocated + advanceAllocated;
      const isFullyPaid = totalAllocated >= (netDue - 0.01); // Tolerance for float

      return {
        ...month,
        netDue,
        amountAllocated: totalAllocated,
        cashAllocated,
        advanceAllocated,
        isFullyPaid,
        monthName: new Date(month.service_period_year, month.service_period_month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      };
    });

    const totalAllocated = allocatedPeriods.reduce((sum, p) => sum + p.amountAllocated, 0);
    const totalCashAllocated = allocatedPeriods.reduce((sum, p) => sum + p.cashAllocated, 0);
    const totalAdvanceAllocated = allocatedPeriods.reduce((sum, p) => sum + p.advanceAllocated, 0);

    const totalOutstandingAcrossAll = availableMonths.reduce((sum, month) => {
      return sum + calculateMonthNetDue(month);
    }, 0);

    // Any remaining cash is saved as NEW advance
    const savedAsAdvance = Math.max(0, remainingCash);

    setAllocationSummary({
      paymentAmount,
      totalOutstanding: totalOutstandingAcrossAll,
      allocatedPeriods,
      totalAllocated, // Total value of bills cleared
      totalCashAllocated, // Portion paid by cash
      totalAdvanceAllocated, // Portion paid by advance
      savedAsAdvance // Cash turning into new advance
    });

    setShowAllocationConfirm(true);
  };

  // Track if initial user has been set for this modal session
  const initialUserSet = useRef(false);

  // Reset initialization state when modal closes
  useEffect(() => {
    if (!isOpen) {
      initialUserSet.current = false;
    }
  }, [isOpen]);

  // Fetch unpaid periods from backend
  const fetchUnpaidPeriods = useCallback(async (params = {}) => {
    const {
      unit_id,
      service_fee_id,
      account_holder_type,
      account_holder_id
    } = params;

    if (!unit_id) {
      console.log('⏳ Skipping fetchUnpaidPeriods: Missing unit_id');
      setLoadingPeriods(false);
      return;
    }

    setLoadingPeriods(true);

    console.log('🔍 Fetching unpaid periods for:', {
      unit_id,
      account_holder_type,
      account_holder_id
    });

    try {
      const url = `/api/service-fee-management/unpaid-periods/`;
      const queryParams = {
        unit_id,
        // service_fee_id, // Removed as per user request
        account_holder_type,
        account_holder_id
      };
      console.log('📡 Request URL:', url, 'Params:', queryParams);

      const response = await axiosInstance.get(url, { params: queryParams });
      console.log('📥 Response status:', response.status, response.statusText);

      const data = response.data;

      if (data.success) {
        // Map unpaid periods to availableMonths format with isSelected: false
        const periods = (data.data.unpaid_periods || []).map((period, index) => ({
          service_period_month: period.service_period_month,
          service_period_year: period.service_period_year,
          amount: period.due_amount,
          original_amount: period.original_amount,
          bill_category_amount: period.bill_category_amount,
          paid_amount: period.paid_amount,
          gross_penalty_amount: parseFloat(period.gross_penalty_amount || 0),
          penalty_amount: parseFloat(period.penalty_amount || 0),
          penalty_fee: parseFloat(period.penalty_fee || 0),
          waived_amount: parseFloat(period.waived_amount || 0),
          due_amount: parseFloat(period.due_amount || 0),
          due_date: period.due_date,
          due_day: parseInt(period.due_day, 10),
          service_status: period.service_status,
          account_holder_type: period.account_holder_type,
          account_holder_id: period.account_holder_id,
          month_name: period.month_name,
          late_payment_enabled: period.late_payment_enabled,
          waiver_applied: period.waiver_applied || false,
          waiver_data: (() => {
            try {
              if (typeof period.waiver_data === 'string') {
                return JSON.parse(period.waiver_data);
              } else if (Array.isArray(period.waiver_data)) {
                return period.waiver_data;
              }
              return [];
            } catch (e) {
              console.error('Error parsing waiver_data:', e);
              return [];
            }
          })(),
          service_fee_items: period.service_fee_items || [],
          isSelected: false
        }));
        setAvailableMonths(periods);

        // CRITICAL: Extract total_advance from top-level response
        const advanceAmount = parseFloat(data.data.total_advance || 0);
        setTotalAdvance(advanceAmount);

        console.log('✅ Fetched unpaid periods:', periods);
        console.log('💰 Total Advance Amount:', advanceAmount);
      } else {
        console.error('Failed to fetch unpaid periods:', data.message);
        setAvailableMonths([]);
        setTotalAdvance(0);
      }
    } catch (error) {
      console.error('Error fetching unpaid periods:', error);
      console.error('Error details:', error.response?.data || error.message);
      setAvailableMonths([]);
    } finally {
      setLoadingPeriods(false);
    }
  }, []); // Stable: No dependencies to prevent re-render loops


  // Load service fees on mount and initialize user
  useEffect(() => {
    if (isOpen) {
      // Fetch payment methods
      dispatch(fetchFilterOptions());

      // Reset transaction date to today when modal opens and sync payment data
      const today = new Date().toISOString().slice(0, 10);
      setFormData(prev => ({
        ...prev,
        payment_date: today,
        unitId: payment?.unit_id || unitId || '',
        serviceFeeId: payment?.service_fee_id || '',
        residentId: payment?.resident_id || residentId || '',
        accountHolderType: payment?.account_holder_type || '',
        accountHolderId: payment?.account_holder_id || '',
        member_id: payment?.member_id || null,
        paymentMethod: payment?.payment_method_id || 1,
        methodType: 'cash' // Default, will be updated by sync effect if payment exists
      }));

      // Initialize selected user with current user on first load if no payment exists
      // Only do this ONCE per modal session to allow user to clear/change it
      if (currentUser && !initialUserSet.current && !payment) {
        const initialUser = {
          id: currentUser.id,
          full_name: currentUser.full_name || currentUser.name
        };
        console.log('👤 Initial User set to:', initialUser);

        handleUserSelect(initialUser);
        setReceivedByUser(initialUser); // Also set for Received By
        setFormData(prev => ({
          ...prev,
          receivedBy: initialUser.full_name
        }));
        setIsCreatedByValid(true); // Mark as valid since we have current user
        setCreatedByError(''); // Clear any error

        // Mark as set so we don't overwrite if user clears it
        initialUserSet.current = true;
      }

      // Log payment data for debugging
      console.log('📋 Modal opened with payment data:', {
        payment,
        unitId: payment?.unit_id || unitId,
        serviceFeeId: payment?.service_fee_id,
        residentId: payment?.resident_id || residentId
      });

      dispatch(clearErrors());
      setAmountError(''); // Clear amount error when modal opens
      setCreatedByError(''); // Clear created by error when modal opens
      setApiSuccessMessage(null); // Clear API success message when modal opens
      setApiErrorMessage(null); // Clear API error message when modal opens

      // Immediate fetch with props/payment data to avoid state update lag
      fetchUnpaidPeriods({
        unit_id: payment?.unit_id || unitId || '',
        service_fee_id: payment?.service_fee_id || '',
        account_holder_type: payment?.account_holder_type || '',
        account_holder_id: payment?.account_holder_id || ''
      });
    }
  }, [isOpen, payment, unitId, residentId, fetchUnpaidPeriods]);

  // Sync method type when payment or filterOptions changes
  useEffect(() => {
    if (isOpen && filterOptions?.payment_methods?.length > 0) {
      const pmId = payment?.payment_method_id || formData.paymentMethod || 1;
      const pm = filterOptions.payment_methods.find(m => m.value === pmId);
      if (pm) {
        setFormData(prev => ({
          ...prev,
          paymentMethod: pmId,
          methodType: pm.type || 'other',
          otherMethodName: (pm.type === 'mfs' || pm.type === 'card') ? pm.label : prev.otherMethodName,
          bankToAccount: pm.account_number || '',
          bankToAccountName: pm.account_name || '',
          otherToAccount: pm.account_number || '',
          otherToAccountName: pm.account_name || ''
        }));
      }
    }
  }, [isOpen, filterOptions.payment_methods, payment?.payment_method_id, formData.paymentMethod]);


  // Helper function to calculate the net due for a single month card (Matches card display logic)
  const calculateMonthNetDue = (month) => {
    let serviceFeeItemsTotal = 0;
    try {
      let items = [];
      if (typeof month.service_fee_items === 'string') {
        items = JSON.parse(month.service_fee_items);
      } else if (Array.isArray(month.service_fee_items)) {
        items = month.service_fee_items;
      }

      // Matches card logic: use items but ignore tags that might cause double-counting
      serviceFeeItemsTotal = items
        .filter(item => item.item_type !== 'penalty' && item.item_type !== 'service_fee')
        .reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    } catch (e) {
      console.error('Error parsing service_fee_items:', e);
    }

    const grossPenalty = parseFloat(month.gross_penalty_amount || 0);
    const paid = parseFloat(month.paid_amount || 0);
    const totalWaivedAmount = Array.isArray(month.waiver_data)
      ? month.waiver_data.reduce((sum, w) => sum + parseFloat(w.waived_amount || w.waivedAmount || 0), 0)
      : 0;

    return Math.max(0, serviceFeeItemsTotal + grossPenalty - totalWaivedAmount - paid);
  };

  // Calculate total amount for all selected months using the shared logic
  const calculateTotalAmount = (months = availableMonths) => {
    const total = months
      .filter(m => m.isSelected)
      .reduce((sum, m) => sum + calculateMonthNetDue(m), 0);

    return Math.round(total).toString();
  };

  // Update calculated amount when months selection or waivers change
  useEffect(() => {
    // Only auto-update if the user hasn't manually typed a custom amount
    if (!isManuallyEdited && isOpen) {
      const calculatedTotal = calculateTotalAmount();
      const currentAmount = formData.manualAmount || '';

      if (calculatedTotal !== '0') {
        if (calculatedTotal !== currentAmount) {
          setFormData(prev => ({
            ...prev,
            manualAmount: calculatedTotal
          }));
          setAmountError('');
        }
      } else if (currentAmount !== '') {
        // If no months selected, clear the amount
        setFormData(prev => ({
          ...prev,
          manualAmount: ''
        }));
        setAmountError('');
      }
    }
  }, [availableMonths, isManuallyEdited, isOpen]);

  // Get count of selected months
  const getSelectedCount = () => {
    return availableMonths.filter(month => month.isSelected).length;
  };

  // Calculate total savings from waived penalties
  const calculateTotalSavings = () => {
    return availableMonths
      .filter(month => month.isSelected && month.waiver_applied)
      .reduce((sum, month) => {
        const waived = Array.isArray(month.waiver_data)
          ? month.waiver_data.reduce((wSum, w) => wSum + parseFloat(w.waived_amount || w.waivedAmount || 0), 0)
          : 0;
        return sum + waived;
      }, 0);
  };



  // Debug: Log formData changes
  useEffect(() => {
    console.log('📝 FormData updated:', {
      unitId: formData.unitId,
      serviceFeeId: formData.serviceFeeId,
      residentId: formData.residentId,
      paymentMethod: formData.paymentMethod,
      manualAmount: formData.manualAmount
    });
  }, [formData.unitId, formData.serviceFeeId, formData.residentId, formData.paymentMethod, formData.manualAmount]);

  // Update form data when payment or resident/unit props change
  useEffect(() => {
    if (!payment && currentUser) {
      // Only set initial user and validation for new payment
      const initialUser = {
        id: currentUser.id,
        full_name: currentUser.full_name || currentUser.name
      };
      handleUserSelect(initialUser);
      setIsCreatedByValid(true);
      setCreatedByError('');
    } else if (payment) {
      setAmountError('');
      setCreatedByError('');
      // Set form data for editing existing payment
      setFormData({
        resident: payment.member_id || '',
        payment_id: '', // Don't copy payment_id for new payments
        tower_id: payment.tower_id || '',
        transactionId: '', // Don't copy transaction_id for new payments
        serviceFeeId: payment.service_fee_id || '',
        residentId: payment.resident_id || residentId || '',
        unitId: payment.unit_id || unitId || '',
        amount: '',
        currency: payment.currency || 'BDT',
        paymentMethod: 1, // Always use Cash (ID: 1)
        dueDate: payment.due_date || '',
        service_period_month: payment.service_period_month || new Date().getMonth() + 1,
        service_period_year: payment.service_period_year || new Date().getFullYear(),
        referenceNumber: payment.reference_number || '',
        notes: '', // Always start with empty notes for new cash payments
        created_by_id: currentUser ? currentUser.id : null,
        created_by_name: currentUser ? currentUser.name : null,
        sendEmail: true,
        resident_email: payment.primary_email || payment.secondary_email || '',
        sendPrimarySMS: false,
        sendSecondarySMS: false
      });
    } else if (residentId || unitId) {
      setFormData(prev => ({
        ...prev,
        residentId: residentId || prev.residentId,
        unitId: unitId || prev.unitId
      }));
    }
  }, [payment, residentId, unitId, currentUser]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Handle checkbox inputs
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));

      return;
    }

    // Handle manual amount input
    if (name === 'manualAmount') {
      // Remove any non-numeric characters (prevent decimals)
      const numericValue = value.replace(/[^0-9]/g, '');

      setIsManuallyEdited(true); // Always mark as manually edited

      // Unselect all payment cards when user manually inputs amount
      setAvailableMonths(prev =>
        prev.map(m => ({ ...m, isSelected: false }))
      );

      // If user clears the field completely
      if (!numericValue || numericValue.trim() === '') {
        setAmountError('');
        setFormData(prev => ({
          ...prev,
          manualAmount: '',
          amount: ''
        }));
        return;
      }

      setFormData(prev => ({
        ...prev,
        manualAmount: numericValue,
        amount: numericValue
      }));

      // Immediate validation
      const inputAmountVal = parseFloat(numericValue || 0);

      if (inputAmountVal > 0 || totalAdvance > 0) {
        setAmountError('');
      } else {
        setAmountError('Amount must be greater than 0');
      }

      return;
    }

    // Validate amount if it's the amount field
    if (name === 'amount') {
      const amountVal = parseFloat(value);
      if (isNaN(amountVal) || amountVal <= 0) {
        if (totalAdvance <= 0) {
          setAmountError('Amount must be greater than 0');
        }
      } else {
        setAmountError('');
      }
    }

    // Clear created by error when user types in other fields
    if (name !== 'createdBy' && createdByError) {
      setCreatedByError('');
    }

    // For paymentDate, always store YYYY-MM
    if (name === 'paymentDate') {
      setFormData(prev => ({
        ...prev,
        paymentDate: value
      }));
    } else if (name === 'service_period_month' || name === 'service_period_year') {
      setFormData(prev => ({
        ...prev,
        [name]: parseInt(value) || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    console.log('👤 Selected User set to handler:', selectedUser);
    // Only validate if this is a final selection (not during typing)
    if (user && user.id) {
      setCreatedByError(''); // Clear error if valid user selected
      setIsCreatedByValid(true);
    } else if (user === null) {
      // User is typing/searching - don't show error yet
      setIsCreatedByValid(false);
      setCreatedByError(''); // Don't show error while typing
    }
  };

  const handleCreatedByValidationChange = (isValid, errorMessage) => {
    setIsCreatedByValid(isValid);
    if (errorMessage) {
      setCreatedByError(errorMessage);
    } else {
      setCreatedByError('');
    }
  };

  // Helper to get display name for top section
  const getDynamicPaymentMethodName = () => {
    const methodId = formData.paymentMethod;
    const methodName = methodIdMap[methodId];

    if (formData.methodType === 'cash') return 'Cash';
    if (formData.methodType === 'bank') return methodName || 'Bank Transfer';

    return methodName || 'Other';
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      dispatch(clearErrors());

      if (!validateForm()) {
        setLoading(false);
        return;
      }

      // Check if advance is available (needed for various logic below)
      const hasAdvance = totalAdvance > 0;

      // Calculate total due amount from ALL available months (including penalties and subtracting waivers)
      const totalDueAmount = availableMonths
        .reduce((sum, month) => {
          const monthDue = parseFloat(month.due_amount || 0);
          // Try ALL possible penalty field names to ensure we catch the value
          const penalty = parseFloat(month.gross_penalty_amount || month.penalty_amount || month.penalty_fee || 0);
          const waived = Array.isArray(month.waiver_data)
            ? month.waiver_data.reduce((wSum, w) => wSum + parseFloat(w.waived_amount || w.waivedAmount || 0), 0)
            : 0;

          return sum + Math.max(0, monthDue + penalty - waived);
        }, 0);

      /*
      if (totalDueAmount > 0 && inputAmount > (Math.ceil(totalDueAmount) + 1)) {
        console.log('❌ Validation failed: Amount exceeds total due');
        setAmountError(`Amount cannot exceed total due amount (Tk ${Math.round(totalDueAmount).toLocaleString('en-BD')})`);
        setLoading(false);
        return;
      }
      */

      console.log('✅ All validations passed!');

      // Validate unit_id
      if (!formData.unitId || formData.unitId === '' || isNaN(parseInt(formData.unitId))) {
        console.log('❌ Validation failed: unit_id');
        setAmountError('Unit ID is required');
        setLoading(false);
        return;
      }

      // Validate service_fee_id
      if (!formData.serviceFeeId || formData.serviceFeeId === '' || isNaN(parseInt(formData.serviceFeeId))) {
        console.log('❌ Validation failed: service_fee_id');
        setAmountError('Service Fee ID is required');
        setLoading(false);
        return;
      }

      // Payment method is always 1 (Cash) for record payment
      const paymentMethodId = 1;
      console.log('✅ Payment method validated:', paymentMethodId);

      // Get the final amount (manual or calculated)
      const finalAmount = formData.manualAmount || calculateTotalAmount();
      const paymentAmount = parseFloat(finalAmount);

      // Auto-select months based on manual amount if no months are selected
      // This handles the case where user manually inputs amount without selecting cards
      let periodsToProcess = availableMonths.filter(month => month.isSelected);

      if (periodsToProcess.length === 0) {
        if (paymentAmount > 0) {
          // No months selected but amount > 0 - auto-select based on amount
          let remainingAmount = paymentAmount;
          periodsToProcess = availableMonths.filter(month => {
            if (remainingAmount > 0) {
              const monthDue = parseFloat(month.due_amount || 0);
              if (monthDue > 0) {
                remainingAmount -= monthDue;
                return true;
              }
            }
            return false;
          });
        } else if (hasAdvance && availableMonths.length > 0) {
          // Amount is 0 but we have advance - pick the oldest unpaid month to apply credit
          periodsToProcess = [availableMonths[0]];
          console.log('🔄 Auto-selected oldest month for advance credit application');
        }

        // Final fallback: satisfy backend requirement of non-empty selected_periods
        if (periodsToProcess.length === 0 && availableMonths.length > 0) {
          periodsToProcess = [availableMonths[0]];
        }
      }

      // Prepare multi-month payment data
      const selectedPeriods = periodsToProcess.map(month => {
        const totalWaived = month.waiver_applied && Array.isArray(month.waiver_data)
          ? Math.round(month.waiver_data.reduce((wSum, w) => wSum + parseFloat(w.waivedAmount || 0), 0))
          : 0;

        return {
          service_period_month: month.service_period_month,
          service_period_year: month.service_period_year,
          penalty_amount: parseFloat(month.penalty_amount || 0),
          waived_amount: totalWaived,
          // Only send brand new waivers to the backend, ensuring amounts are rounded
          new_waiver_data: (month.waiver_data || [])
            .filter(w => w.isSessionNew)
            .map(w => ({
              ...w,
              waivedAmount: Math.round(parseFloat(w.waivedAmount || 0))
            })),
        };
      });

      // 2. Selection Validation (Only if both amount and advance are unavailable)
      if ((!selectedPeriods || selectedPeriods.length === 0) && paymentAmount <= 0 && !hasAdvance) {
        console.log('❌ Validation failed: Nothing to process');
        setAmountError('Please select months or enter an amount');
        setLoading(false);
        return;
      }

      // 3. Fallback for no periods at all (unit has no data)
      if ((!selectedPeriods || selectedPeriods.length === 0) && paymentAmount <= 0) {
        console.log('❌ Validation failed: No periods and no amount');
        setAmountError('No service periods available to process');
        setLoading(false);
        return;
      }

      // Ensure we have a valid created_by user ID
      const createdById = selectedUser?.id || currentUser?.id;
      console.log('👤 Created By IDfgsdfgfsdgs:', createdById);
      if (!createdById) {
        console.error('❌ No valid user ID found!');
        console.log('selectedUser:', selectedUser);
        console.log('currentUser:', currentUser);
        setCreatedByError('Unable to determine created by user');
        setLoading(false);
        return;
      }

      // Map payment method and prepare notes based on dynamic categories
      const finalPaymentMethodId = formData.paymentMethod;
      let detailedNotes = formData.notes || '';

      if (formData.methodType === 'bank') {
        const methodName = methodIdMap[formData.paymentMethod] || 'Bank';
        const bankDetails = `[${methodName}] From: ${formData.bankFromAccount}, To: ${formData.bankToAccount}, Name: ${formData.bankToAccountName}`;
        detailedNotes = detailedNotes ? `${detailedNotes} | ${bankDetails}` : bankDetails;
      } else if (['mfs', 'card', 'other'].includes(formData.methodType)) {
        const methodName = methodIdMap[formData.paymentMethod] || formData.otherMethodName || 'Other';
        const mobileDetails = `[${methodName.toUpperCase()}] From: ${formData.otherFromAccount}, To: ${formData.otherToAccount}, Name: ${formData.otherToAccountName}`;
        detailedNotes = detailedNotes ? `${detailedNotes} | ${mobileDetails}` : mobileDetails;
      } else if (formData.methodType === 'cash') {
        const rcvBy = receivedByUser?.full_name || formData.receivedBy;
        if (rcvBy) {
          detailedNotes = detailedNotes ? `${detailedNotes} | Received By: ${rcvBy}` : `Received By: ${rcvBy}`;
        }
      }

      const paymentData = {
        unit_id: parseInt(formData.unitId),
        service_fee_id: parseInt(formData.serviceFeeId),
        resident_id: formData.residentId ? parseInt(formData.residentId) : null,
        payment_method: finalPaymentMethodId,
        payment_date: formData.payment_date,
        reference_number: formData.referenceNumber || '',
        notes: detailedNotes,
        created_by: parseInt(createdById),
        sendEmail: formData.sendEmail,
        selected_periods: selectedPeriods,
        total_amount: parseFloat(finalAmount),
        account_holder_type: formData.accountHolderType,
        account_holder_id: formData.accountHolderId,

        // Detailed Tracking Fields
        received_by_id: formData.methodType === 'cash' ? receivedByUser?.id : null,
        received_by_name: formData.methodType === 'cash' ? (receivedByUser?.full_name || formData.receivedBy) : null,
        from_account_number: formData.methodType === 'bank' ? formData.bankFromAccount : (['mfs', 'card', 'other'].includes(formData.methodType) ? formData.otherFromAccount : null),
        to_account_number: formData.methodType === 'bank' ? formData.bankToAccount : (['mfs', 'card', 'other'].includes(formData.methodType) ? formData.otherToAccount : null),
        to_account_name: formData.methodType === 'bank' ? formData.bankToAccountName : (['mfs', 'card', 'other'].includes(formData.methodType) ? formData.otherToAccountName : null),
        other_method_name: ['mfs', 'card', 'other'].includes(formData.methodType) ? (methodIdMap[formData.paymentMethod] || formData.otherMethodName) : null
      };

      // Final validation - ensure all required fields are present
      const requiredFields = {
        unit_id: paymentData.unit_id,
        service_fee_id: paymentData.service_fee_id,
        payment_method: paymentData.payment_method,
        selected_periods: paymentData.selected_periods,
        created_by: paymentData.created_by
      };

      const missingFields = Object.entries(requiredFields)
        .filter(([key, value]) => {
          if (key === 'selected_periods') {
            // Allow empty periods IF there is a valid positive amount (Pure Advance Payment)
            const amountVal = parseFloat(finalAmount || 0);
            if (amountVal > 0) return false; // Valid if amount > 0 regardless of periods

            return !value || !Array.isArray(value) || value.length === 0;
          }
          return value === null || value === undefined || value === '' || isNaN(value);
        })
        .map(([key]) => key);

      if (missingFields.length > 0) {
        console.error('❌ Missing required fields:', missingFields);
        console.log('Payment Data:', paymentData);
        console.log('Form Data:', formData);
        // setAmountError(`Missing required fields: ${missingFields.join(', ')}`);
        setLoading(false);
        return;
      }

      console.log('✅ Payment Data being sent:', JSON.stringify(paymentData, null, 2));
      console.log('Selected User:', selectedUser);
      console.log('Current User:', currentUser);
      console.log('Form Data:', formData);

      // Call multi-month payment endpoint using axiosInstance
      const response = await axiosInstance.post('/api/service-fee-management/multi-month-payment/', paymentData);

      const result = response.data;

      if (result.success) {
        // Set success message - don't close modal yet, let MessageBox show first
        const successMsg = result.message || `Successfully processed ${selectedPeriods.length} payment(s) for total amount ${parseFloat(finalAmount).toFixed(0)}`;
        setApiSuccessMessage(successMsg);
        setIsPaymentSuccess(true); // Final payment - close modal on OK

        // CRITICAL: Refresh Redux state to update the payment list and advance amounts
        // This ensures the UI shows the latest data without manual reload
        console.log('💾 Refreshing Redux state after successful payment...');

        // Notify parent to refresh the table
        if (onSuccess) {
          onSuccess();
        }

        // Dispatch custom event to trigger notification refresh
        window.dispatchEvent(new Event('serviceFeePaymentRecorded'));
        console.log('🔔 Dispatched serviceFeePaymentRecorded event for notification refresh');

        // ALSO: Refetch unpaid periods to update advance amount display in modal
        // This ensures if user opens payment modal again, they see updated advance
        if (payment && payment.unit_id && payment.service_fee_id) {
          fetchUnpaidPeriods({
            unit_id: payment.unit_id,
            service_fee_id: payment.service_fee_id,
            account_holder_type: payment.account_holder_type,
            account_holder_id: payment.account_holder_id
          });
        }

        // Reset form
        setFormData(prev => ({
          ...prev,
          manualAmount: '',
          notes: ''
        }));
        setIsManuallyEdited(false);

        // Stop loading
        setLoading(false);
      } else {
        // Set error message
        setApiErrorMessage(result.message || 'Failed to create payments');
        setLoading(false);
      }

    } catch (error) {
      console.error('Error submitting multi-month payment:', error);

      // Handle axios error response
      let errorMessage = 'Unable to process the payment. Please try again or contact support.';

      if (error.response) {
        // Server responded with error status
        const errorData = error.response.data;
        if (errorData && errorData.message) {
          errorMessage = errorData.message;
        } else if (error.response.status === 500) {
          errorMessage = 'Server error occurred. Please contact support if this issue persists.';
        } else if (error.response.status === 400) {
          errorMessage = errorData?.message || 'Invalid payment data. Please check your input.';
        }
        console.error('Error response data:', errorData);
        console.error('Error status:', error.response.status);
      } else if (error.request) {
        // Request was made but no response received
        errorMessage = 'No response from server. Please check your connection and try again.';
        console.error('No response received:', error.request);
      } else {
        // Error setting up the request
        console.error('Error setting up request:', error.message);
      }

      setApiErrorMessage(errorMessage);
      setLoading(false);
    }
  };

  if (!isOpen) return null;


  return (

    <>
      {/* Loading Overlay */}
      {(loading || creating || updating || loadingPeriods) && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-[10000]">
          <ModernLoadingAnimation />
        </div>
      )}

      {/* Error Display using MessageBox */}
      {(createError || updateError) && (
        <div className="fixed inset-0 z-[9999]">
          <MessageBox
            type="error"
            error
            message={
              typeof (createError || updateError) === 'string' && (createError || updateError).includes('<!DOCTYPE')
                ? 'Unable to connect to the server. Please contact support if this issue persists.'
                : (createError || updateError)
            }
            clearMessage={() => dispatch(clearErrors())}
            onOk={() => dispatch(clearErrors())}
          />
        </div>
      )}

      {/* Success Display using MessageBox */}
      {(createSuccess || updateSuccess) && (
        <div className="fixed inset-0 z-[9999]">
          <MessageBox
            message={createSuccess ? createSuccess : updateSuccess}
            clearMessage={() => dispatch(clearSuccessStates())}
            onOk={() => {
              onClose();
              dispatch(clearPaymentItems());
              dispatch(clearSuccessStates());
              // Call onSuccess callback to refresh parent data
              if (onSuccess) {
                onSuccess();
              }

              // Dispatch custom event to trigger notification refresh
              window.dispatchEvent(new Event('serviceFeePaymentRecorded'));
              console.log('🔔 Dispatched serviceFeePaymentRecorded event for notification refresh');
            }}
          />
        </div>
      )}

      {/* API Success Message from multi-month payment */}
      {apiSuccessMessage && (
        <div className="fixed inset-0 z-[9999]">
          <MessageBox
            message={apiSuccessMessage}
            clearMessage={() => {
              setApiSuccessMessage(null);
              // Refresh the parent data
              if (onSuccess) {
                onSuccess();
              }
              // Close modal after showing success message
              handleClose();
            }}
            onOk={() => {
              setApiSuccessMessage(null);
              // Refresh the parent data
              if (onSuccess) {
                onSuccess();
              }
              // Close modal after showing success message
              handleClose();
            }}
          />
        </div>
      )}

      {/* API Error Message from multi-month payment */}
      {apiErrorMessage && (
        <div className="fixed inset-0 z-[9999]">
          <MessageBox
            type="error"
            error
            message={apiErrorMessage}
            clearMessage={() => setApiErrorMessage(null)}
            onOk={() => {
              setApiErrorMessage(null);
            }}
          />
        </div>
      )}

      {apiSuccessMessage && (
        <div className="fixed inset-0 z-[9999]">
          <MessageBox
            message={apiSuccessMessage}
            clearMessage={() => setApiSuccessMessage(null)}
            onOk={() => {
              setApiSuccessMessage(null);
              if (isPaymentSuccess) {
                handleClose();
              }
              setIsPaymentSuccess(false);
            }}
          />
        </div>
      )}

      {showConfirmation && (
        <div className="fixed inset-0 z-[9999]">
          <ConfirmationMessageBox
            message="Are you sure you want to delete this payment? This action cannot be undone."
            onConfirm={() => setShowConfirmation(false)}
            onCancel={() => setShowConfirmation(false)}
          />
        </div>
      )}

      {waiverDeleteState.isOpen && (
        <div className="fixed inset-0 z-[9999]">
          <ConfirmationMessageBox
            message={waiverDeleteState.waiver?.isSessionNew
              ? "Remove this new waiver adjustment?"
              : "Permanently delete this historical waiver? This action cannot be undone."}
            onConfirm={confirmDeleteWaiver}
            onCancel={() => setWaiverDeleteState({ isOpen: false, waiver: null, month: null, index: null })}
            confirmText="Delete"
          />
        </div>
      )}
      {waiverEditState.isOpen && (
        <div className="fixed inset-0 z-[9999]">
          <ConfirmationMessageBox
            message="Are you sure you want to update this past waiver? This action will generate an audit log."
            onConfirm={confirmEditWaiver}
            onCancel={() => setWaiverEditState({ isOpen: false, waiverId: null, newData: null })}
            confirmText="Update Waiver"
          />
        </div>
      )}

      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl relative h-[95vh] flex flex-col">
          {/* Modal Header - Fixed */}
          <div className="p-6 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              {/* Left: Back button + Title */}
              <div className="flex items-center gap-4">
                <button
                  onClick={showAllocationConfirm ? () => setShowAllocationConfirm(false) : handleClose}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  type="button"
                >
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {showAllocationConfirm ? 'Confirm Payment Allocation' : 'Record Payment'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {showAllocationConfirm
                      ? `Review how your payment of ৳${parseFloat(formData.manualAmount || 0).toLocaleString('en-BD')} will be allocated`
                      : 'Manage penalty waivers and record payments'}
                  </p>
                </div>
              </div>

              {/* Right: Close button */}
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                type="button"
              >
                <RxCross1 className="w-5 h-5 text-gray-700" />
              </button>
            </div>
          </div>

          {/* Modal Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            {showAllocationConfirm && allocationSummary ? (
              <div className="space-y-8">
                {/* Allocation Header Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-6 bg-blue-50 border border-blue-100 rounded-xl">
                    <p className="text-sm font-medium text-blue-600 mb-1 uppercase tracking-wider">Total Payment</p>
                    <p className="text-3xl font-bold text-blue-700">৳{allocationSummary.paymentAmount.toLocaleString('en-BD')}</p>
                  </div>
                  <div className="p-6 bg-white border border-gray-200 rounded-xl">
                    <p className="text-sm font-medium text-gray-500 mb-1 uppercase tracking-wider">Total Outstanding</p>
                    <p className="text-3xl font-bold text-gray-900">৳{allocationSummary.totalOutstanding.toLocaleString('en-BD')}</p>
                  </div>
                </div>

                {/* Allocated to Bills Section */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="p-1.5 bg-teal-50 rounded-lg text-teal-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                    <h3 className="text-lg font-bold text-gray-900">Allocated to Bills</h3>
                    <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-bold rounded-full">
                      {allocationSummary.allocatedPeriods.length} Bill{allocationSummary.allocatedPeriods.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {allocationSummary.allocatedPeriods.map((period, idx) => (
                      <div key={idx} className="p-4 border border-gray-200 bg-white rounded-xl shadow-sm flex items-center justify-between transition-all hover:shadow-md">
                        <div>
                          <h4 className="text-lg font-bold text-gray-900 mb-1">{period.monthName}</h4>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">Amount Due:</span>
                            <span className="text-sm font-semibold text-gray-700">৳{period.netDue.toLocaleString('en-BD')}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2 mb-2 justify-end">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Paying</span>
                            <span className="text-xl font-bold text-teal-600">৳{period.amountAllocated.toLocaleString('en-BD')}</span>
                          </div>
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${period.isFullyPaid
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              {period.isFullyPaid ? (
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              ) : (
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                              )}
                            </svg>
                            {period.isFullyPaid ? 'Fully Paid' : 'Partially Paid'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Advance Amount Section */}
                {allocationSummary.savedAsAdvance > 0 && (
                  <div className="p-6 bg-indigo-50/50 border border-indigo-100 rounded-2xl relative overflow-hidden">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-indigo-900 mb-1">Advance Payment</h4>
                        <p className="text-sm text-indigo-700/80 mb-4 font-medium">The remaining amount will be saved as advance credit toward future bills</p>
                        <div className="bg-white p-4 rounded-xl border border-indigo-100/50 shadow-sm flex items-center justify-between mb-4">
                          <div>
                            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Advance Amount</p>
                            <p className="text-sm font-semibold text-indigo-900">Available for future bills</p>
                          </div>
                          <p className="text-3xl font-black text-indigo-600">৳{allocationSummary.savedAsAdvance.toLocaleString('en-BD')}/-</p>
                        </div>
                        <div className="bg-indigo-100/30 p-4 rounded-lg flex gap-3 text-xs leading-relaxed text-indigo-900">
                          <span className="text-indigo-600 mt-0.5 animate-pulse">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          </span>
                          <div className="space-y-1">
                            <p className="text-sm font-black opacity-100">How advance payments work:</p>
                            <ul className="list-disc pl-4 space-y-0.5 opacity-80 text-sm">
                              <li>Automatically applied to future service fee bills</li>
                              <li>Reduces amount due on upcoming invoices</li>
                              <li>Visible in unit's payment history and balance</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Allocation Breakdown */}
                <div className="pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Allocation Breakdown</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 font-medium">Payment Amount Entered (Cash)</span>
                      <span className="font-bold text-gray-900">৳{allocationSummary.paymentAmount.toLocaleString('en-BD')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 font-medium">Applied from Cash</span>
                      <span className="font-bold text-red-500">-৳{allocationSummary.totalCashAllocated.toLocaleString('en-BD')}</span>
                    </div>

                    {allocationSummary.totalAdvanceAllocated > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-600 font-medium">Applied from Advance</span>
                        <span className="font-bold text-blue-600">-৳{allocationSummary.totalAdvanceAllocated.toLocaleString('en-BD')}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 font-medium">Saved as Advance (New Credit)</span>
                      <span className="font-bold text-pink-600">-৳{allocationSummary.savedAsAdvance.toLocaleString('en-BD')}</span>
                    </div>
                    <div className="flex justify-between pt-3 border-t border-gray-100">
                      <span className="text-base font-bold text-gray-900">Total Cash Accounted For</span>
                      <span className="text-lg font-black text-emerald-600">৳{allocationSummary.paymentAmount.toLocaleString('en-BD')}</span>
                    </div>
                  </div>
                </div>


              </div>
            ) : (
              <form id="payment-form" onSubmit={(e) => { e.preventDefault(); handlePrepareAllocation(); }}>
                {/* Info Display Section - Resident, Tower, Unit, Payment Method */}
                <div className="mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Tower Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Tower Name</label>
                      <p className="text-base font-bold text-gray-900">{payment?.tower_name || 'N/A'}</p>
                    </div>

                    {/* Unit Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Unit Name</label>
                      <p className="text-base font-bold text-gray-900">{payment?.unit_name || 'N/A'}</p>
                    </div>

                    {/* Name (Resident) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Name</label>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-bold text-gray-900">{payment?.primary_name || payment?.secondary_name || 'N/A'}</p>
                        {payment?.account_holder_type && (
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] font-bold text-gray-600 uppercase">
                            {payment.account_holder_type}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Payment Method</label>
                      <p className="text-base font-bold text-teal-600">{getDynamicPaymentMethodName()}</p>
                    </div>
                  </div>
                </div>

                {/* Payment Summary Section - Updated Design */}
                <div className="mb-6">
                  {/* Row 1: Current Balance and Overdue Payment */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Current Balance */}
                    <div className="bg-teal-50 rounded-lg p-6 text-center">
                      <p className="text-sm text-gray-600 mb-2">Current Balance</p>
                      <p className="text-3xl font-bold text-teal-600">
                        ৳{summaryCalculations.currentBalance.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>

                    {/* Overdue Payment */}
                    <div className="bg-red-50 rounded-lg p-6 text-center">
                      <p className="text-sm text-gray-600 mb-2">Overdue Payment</p>
                      <p className="text-3xl font-bold text-red-600">
                        ৳{summaryCalculations.overdueBalance.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>

                  {/* Row 2: Advance Balance, Total Penalties, Total Waived */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Advance Balance */}
                    <div className="bg-blue-50 rounded-lg p-6 text-center">
                      <p className="text-sm text-gray-600 mb-2">Advance Credit Balance</p>
                      <p className="text-3xl font-bold text-blue-600">
                        ৳{summaryCalculations.totalAdvance.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-xs text-blue-500 mt-1">From previous payments</p>
                    </div>

                    {/* Total Penalties */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                      <div className="flex items-center gap-2 mb-1 justify-center">
                        <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm font-semibold text-yellow-800">Total Penalties</span>
                      </div>
                      <p className="text-3xl font-bold text-yellow-800 text-center">
                        ৳{summaryCalculations.totalPenalties.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>

                    {/* Total Waived */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
                      <div className="flex items-center gap-2 mb-1 justify-center">
                        <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm font-semibold text-emerald-800">Total Waived</span>
                      </div>
                      <p className="text-3xl font-bold text-emerald-800 text-center">
                        -৳{summaryCalculations.totalWaived.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Payment Controls Section - Transaction Date & Method */}
                <div className="mb-6 p-6 bg-[#FFFBEB] rounded-2xl border border-[#FEF3C7]">
                  <div className="space-y-6">
                    {/* Transaction Date */}
                    <div className="flex flex-col gap-2">
                      <ModernDatePicker
                        key={`trans-date-${isOpen}`}
                        label="Transaction Date"
                        required={true}
                        value={formData.payment_date || new Date().toISOString().slice(0, 10)}
                        onChange={(date) => setFormData(prev => ({ ...prev, payment_date: date }))}
                        inputClassName="h-12 bg-white border-2 border-[#3C9D9B] rounded-md text-lg transition-all duration-200"
                        labelClassName="flex items-center gap-2 text-base font-semibold text-gray-900"
                        placeholder="Select transaction date"
                        showIcon={true}
                      />
                    </div>



                    {/* Method Details Card - Unified Container */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm overflow-hidden animate-fadeIn">
                      {/* Browser-style Payment Method Category Tabs */}
                      <div className="flex border-b border-gray-200 mb-8 overflow-x-auto whitespace-nowrap no-scrollbar">
                        {paymentCategories.map(cat => {
                          const isActive = formData.methodType === cat.value;
                          const getCategoryIcon = (type) => {
                            switch (type) {
                              case 'cash': return <FaMoneyBillWave size={18} />;
                              case 'bank': return <FaBuildingColumns size={18} />;
                              case 'mfs': return <FaWallet size={18} />;
                              case 'card': return <FaRegCreditCard size={18} />;
                              default: return null;
                            }
                          };

                          return (
                            <button
                              key={cat.value}
                              type="button"
                              onClick={() => {
                                const methods = groupedMethods[cat.value] || [];
                                const firstMethod = methods[0];
                                setFormData(prev => ({
                                  ...prev,
                                  methodType: cat.value,
                                  paymentMethod: firstMethod?.value || prev.paymentMethod,
                                  otherMethodName: (cat.value === 'mfs' || cat.value === 'card') ? firstMethod?.label : '',
                                  bankToAccount: firstMethod?.account_number || '',
                                  bankToAccountName: firstMethod?.account_name || '',
                                  otherToAccount: firstMethod?.account_number || '',
                                  otherToAccountName: firstMethod?.account_name || ''
                                }));
                              }}
                              className={`flex items-center gap-3 px-6 py-2.5 text-sm font-bold transition-all duration-200 border-t-2 border-x-2 rounded-t-2xl -mb-[1px] ${isActive
                                ? 'bg-white border-teal-500 text-teal-600 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]'
                                : 'bg-transparent border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                              <span className={isActive ? 'text-teal-600 font-bold' : 'text-gray-400'}>
                                {getCategoryIcon(cat.value)}
                              </span>
                              {cat.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Nested Method Selection Cards */}
                      {formData.methodType && groupedMethods[formData.methodType]?.length > 0 && (
                        <div className="mb-8 animate-fadeIn">
                          <div className="flex items-center justify-between mb-4">
                            <label className="text-base font-extrabold text-gray-800">
                              Select {paymentCategories.find(c => c.value === formData.methodType)?.label} Method <span className="text-red-500">*</span>
                            </label>
                            <span className="text-xs bg-teal-100 px-3 py-1 rounded-full text-teal-700 font-bold uppercase tracking-wider">
                              {groupedMethods[formData.methodType].length} Channels Available
                            </span>
                          </div>
                          <div className="bg-[#F3F4F6] p-2 rounded-2xl">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {groupedMethods[formData.methodType].map(method => {
                                const isSelected = formData.paymentMethod === method.value;
                                const getBrandColor = (label) => {
                                  const lowerLabel = label.toLowerCase();
                                  if (lowerLabel.includes('bkash')) return 'text-pink-600';
                                  if (lowerLabel.includes('nagad')) return 'text-orange-600';
                                  if (lowerLabel.includes('rocket')) return 'text-purple-600';
                                  if (lowerLabel.includes('visa')) return 'text-blue-700';
                                  if (lowerLabel.includes('master')) return 'text-red-700';
                                  return 'text-teal-600';
                                };

                                return (
                                  <button
                                    key={method.value}
                                    type="button"
                                    onClick={() => {
                                      setFormData(prev => ({
                                        ...prev,
                                        paymentMethod: method.value,
                                        otherMethodName: (formData.methodType === 'mfs' || formData.methodType === 'card') ? method.label : '',
                                        // Auto-set account details if available
                                        bankToAccount: method.account_number || '',
                                        bankToAccountName: method.account_name || '',
                                        otherToAccount: method.account_number || '',
                                        otherToAccountName: method.account_name || ''
                                      }));
                                    }}
                                    className={`relative p-3 rounded-xl transition-all duration-200 flex flex-col items-center justify-center gap-1 h-20 group ${isSelected
                                      ? 'bg-white shadow-md border border-gray-100 scale-[1.02]'
                                      : 'hover:bg-white/50 text-gray-500'
                                      }`}
                                  >
                                    {isSelected && (
                                      <div className="absolute top-2 right-2">
                                        <div className="bg-teal-600 text-white rounded-full p-0.5 shadow-sm">
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                                          </svg>
                                        </div>
                                      </div>
                                    )}
                                    <div className={`text-sm font-bold text-center leading-tight transition-colors ${isSelected ? getBrandColor(method.label) : 'text-gray-700'}`}>
                                      {method.label}
                                    </div>
                                    <div className="text-[9px] uppercase font-bold tracking-widest opacity-40">
                                      {formData.methodType}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="border-t border-dashed border-gray-200 pt-8 mt-2">
                      </div>
                      {formData.methodType === 'cash' && (
                        <div className="space-y-4">
                          <h4 className="text-base font-semibold text-gray-700">Cash Payment Details</h4>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Received By <span className="text-red-500">*</span></label>
                            <UserSearchInput
                              key={isOpen ? `cash-rcv-${isOpen}` : 'closed'}
                              value={receivedByUser}
                              created_by_name={receivedByUser?.full_name || formData.receivedBy}
                              currentUser={currentUser}
                              onSelect={(user) => {
                                setReceivedByUser(user);
                                if (user) {
                                  setFormData(prev => ({ ...prev, receivedBy: user.full_name }));
                                }
                              }}
                              onValidationChange={() => { }} // Not strictly validating for now
                              placeholder="Search user..."
                              className="w-full"
                            />
                          </div>
                        </div>
                      )}

                      {formData.methodType === 'bank' && (
                        <div className="space-y-4">
                          <h4 className="text-base font-semibold text-gray-700">Bank Transfer Details</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">From Account Number <span className="text-red-500">*</span></label>
                              <input
                                type="text"
                                name="bankFromAccount"
                                value={formData.bankFromAccount}
                                onChange={handleChange}
                                className="w-full h-12 px-4 bg-[#F3F4F6] border-none rounded-xl text-gray-900 text-lg"
                                placeholder="Sender's account number"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">To Account Number <span className="text-red-500">*</span></label>
                              <input
                                type="text"
                                name="bankToAccount"
                                value={formData.bankToAccount}
                                onChange={handleChange}
                                className="w-full h-12 px-4 bg-[#F3F4F6] border-none rounded-xl text-gray-900 text-lg"
                                placeholder="Receiver's account number"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">To Account Name <span className="text-red-500">*</span></label>
                            <input
                              type="text"
                              name="bankToAccountName"
                              value={formData.bankToAccountName}
                              onChange={handleChange}
                              className="w-full h-12 px-4 bg-[#F3F4F6] border-none rounded-xl text-gray-900 text-lg"
                              placeholder="Receiver's account name"
                            />
                          </div>
                        </div>
                      )}

                      {(formData.methodType === 'mfs' || formData.methodType === 'card' || formData.methodType === 'other') && (
                        <div className="space-y-4">
                          <h4 className="text-base font-semibold text-gray-700">
                            {paymentCategories.find(c => c.value === formData.methodType)?.label} Payment Details
                          </h4>
                          {/* Explicitly show selected brand when needed */}
                          {['mfs', 'card'].includes(formData.methodType) && (
                            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-600">
                                {formData.methodType === 'card' ? <FaRegCreditCard size={20} /> : <FaWallet size={20} />}
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 font-medium">Selected Brand</p>
                                <p className="text-lg font-bold text-gray-900">{methodIdMap[formData.paymentMethod] || formData.otherMethodName || 'N/A'}</p>
                              </div>
                            </div>
                          )}
                          {formData.methodType !== 'card' && (
                            <>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">From Account Number <span className="text-red-500">*</span></label>
                                  <input
                                    type="text"
                                    name="otherFromAccount"
                                    value={formData.otherFromAccount}
                                    onChange={handleChange}
                                    className="w-full h-12 px-4 bg-[#F3F4F6] border-none rounded-xl text-gray-900 text-lg"
                                    placeholder="Sender's account/phone"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">To Account Number <span className="text-red-500">*</span></label>
                                  <input
                                    type="text"
                                    name="otherToAccount"
                                    value={formData.otherToAccount}
                                    onChange={handleChange}
                                    className="w-full h-12 px-4 bg-[#F3F4F6] border-none rounded-xl text-gray-900 text-lg"
                                    placeholder="Receiver's account/phone"
                                  />
                                </div>
                              </div>
                              <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">To Account Name <span className="text-red-500">*</span></label>
                                <input
                                  type="text"
                                  name="otherToAccountName"
                                  value={formData.otherToAccountName}
                                  onChange={handleChange}
                                  className="w-full h-12 px-4 bg-[#F3F4F6] border-none rounded-xl text-gray-900 text-lg"
                                  placeholder="Receiver's account name"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Total Amount - Editable */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Amount ({formData.currency}) <span className="text-primary text-lg">*</span>
                    </label>
                    <input
                      type="number"
                      step="1"
                      name="manualAmount"
                      value={formData.manualAmount || ''}
                      onWheel={(e) => e.target.blur()}
                      onChange={handleChange}
                      onKeyDown={(e) => {
                        if (['.', 'e', 'E', '+', '-'].includes(e.key)) {
                          e.preventDefault();
                          if (e.key === '.') {
                            setAmountError('Decimal values are not allowed. Please enter whole numbers only.');
                          }
                        }
                      }}
                      placeholder="0"
                      className={`w-full h-12 px-4 border ${amountError ? 'border-red-500' : 'border-gray-300'} rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-lg text-gray-900 font-bold bg-white`}
                    />
                    {amountError ? (
                      <p className="mt-1 text-xs text-red-600 font-medium">{amountError}</p>
                    ) : (
                      <p className="mt-1 text-xs text-gray-500 font-medium">Automatically calculated from selected months</p>
                    )}
                  </div>

                  {/* Recorded By - Renamed from Received By and made read-only */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Recorded By <span className="text-red-500">*</span> <span className="text-[10px] text-gray-400 font-normal">(cannot be changed)</span>
                    </label>
                    <div className="flex-1">
                      <div className="w-full h-12 px-4 bg-gray-100 border border-gray-200 rounded-xl flex items-center text-gray-600 font-medium">
                        {selectedUser?.full_name || currentUser?.full_name || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes Section - Moved above emai l */}
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes !== '' ? formData.notes : ''}
                    onChange={handleChange}
                    placeholder="Additional payment details..."
                    rows={2}
                    className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-primary focus:shadow-ring-primary text-sm text-gray-700 bg-white resize-none"
                  />
                </div>

                {/* Email Notification - Checkbox and Email on same ro w */}
                <div className="mt-3">
                  <div className="flex items-center gap-4">
                    {/* Email Checkbox */}
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="sendEmail"
                        name="sendEmail"
                        checked={formData.sendEmail}
                        onChange={handleChange}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded accent-primary"
                      />
                      <label htmlFor="sendEmail" className="ml-2 block text-sm text-gray-700">
                        <span className="font-medium">Send email receipt to resident</span>
                      </label>
                    </div>

                    {/* Email Display */}
                    {(payment?.primary_email || payment?.secondary_email) && (
                      <div>
                        <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                          ✓ Email available: {payment.primary_email || payment.secondary_email}
                        </span>
                      </div>
                    )}
                    {!payment?.primary_email && !payment?.secondary_email && (
                      <div>
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                          ⚠ No email address found for this resident
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reference Number - Hidden but keeping field structur e */}
                <input
                  type="hidden"
                  name="referenceNumber"
                  value={formData.referenceNumber}
                />

                {/* Payment Month Cards - Dynamic with Select/Selected Toggle */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        Payment Details ({getSelectedCount()} month{getSelectedCount() !== 1 ? 's' : ''} selected)
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">Select bills to pay and manage penalty waivers</p>
                    </div>
                    {getSelectedCount() > 0 && calculateTotalSavings() > 0 && (
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full font-medium">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 10.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM6 10.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM12 10.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zM16 10.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" />
                          </svg>
                          ৳{calculateTotalSavings().toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} saved
                        </span>
                      </div>
                    )}
                  </div>
                  {loadingPeriods ? (
                    <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-2"></div>
                        <p className="text-sm text-gray-600">Loading unpaid periods...</p>
                      </div>
                    </div>
                  ) : availableMonths.length === 0 ? (
                    <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-600">No unpaid periods found</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {availableMonths.map((month, index) => {
                        const monthDate = new Date(month.service_period_year, month.service_period_month - 1);
                        const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

                        // Format due date
                        const dueDate = month.due_date ? new Date(month.due_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }) : 'N/A';


                        // Use gross penalty amount from backend - ensure proper parsing

                        const penaltyFee = parseFloat(month.gross_penalty_amount || 0);

                        // Calculate total waived from waiver_data array
                        const totalWaivedAmount = Array.isArray(month.waiver_data)
                          ? month.waiver_data.reduce((sum, w) => sum + parseFloat(w.waived_amount || w.waivedAmount || 0), 0)
                          : 0;

                        return (
                          <div
                            key={`payment-${month.service_period_year}-${month.service_period_month}`}
                            className={`relative p-6 rounded-xl border-[3px] bg-white shadow-sm transition-all ${month.isSelected
                              ? 'border-teal-600 shadow-lg'
                              : 'border-gray-300 hover:border-gray-400'
                              }`}
                          >
                            {/* Header with Month Name and Overdue Badge */}
                            <div className="flex items-start justify-between mb-4">
                              <h3 className="text-xl font-bold text-gray-900">
                                {monthName}
                              </h3>
                              {(() => {
                                const overdueDays = calculateDaysOverdue(month.due_date);
                                return overdueDays > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-full bg-red-600 text-white shadow-md">
                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    {overdueDays} day{overdueDays !== 1 ? 's' : ''} overdue
                                  </span>
                                ) : null;
                              })()}

                            </div>

                            {/* Due Date Section */}
                            <div className="mb-4 pb-4 border-b border-gray-200">
                              <div className="flex justify-between items-center">
                                <span className="text-base text-gray-600">Due Date</span>
                                <span className="text-base font-medium text-gray-900">{dueDate}</span>
                              </div>
                            </div>

                            {/* Financial Details Section */}
                            <div className="space-y-3 mb-4">
                              {/* Service Fee Items (Mapped) */}
                              {/* Unified Financial Breakdown */}
                              {(() => {
                                let items = [];

                                // 1. Base Items (Service Fees & Bill Categories) - Sorted by ID ascending, exclude penalty items
                                try {
                                  if (typeof month.service_fee_items === 'string') {
                                    items = JSON.parse(month.service_fee_items);
                                  } else if (Array.isArray(month.service_fee_items)) {
                                    items = [...month.service_fee_items];
                                  }
                                  // Filter out penalty items to avoid duplication and sort by ID
                                  items = items
                                    .filter(item => item.item_type !== 'penalty')
                                    .sort((a, b) => (a.id || 0) - (b.id || 0));
                                } catch (e) {
                                  console.error('Error parsing service_fee_items', e);
                                }

                                // 2. Add gross penalty amount as separate item (not in service_fee_items)
                                if (penaltyFee > 0) {
                                  items.push({
                                    id: 'gross-penalty',
                                    item_type: 'penalty',
                                    item_name: 'Late Fee (Penalty)',
                                    bill_category_name: 'Late Fee',
                                    amount: penaltyFee
                                  });
                                }

                                // 3. Waiver Items (Aggregate all waivers into a single line)
                                if (Array.isArray(month.waiver_data) && month.waiver_data.length > 0) {
                                  // Calculate total waiver amount
                                  const totalWaiverAmount = month.waiver_data.reduce((sum, waiver) => {
                                    const waiverAmount = parseFloat(waiver.waived_amount || waiver.waivedAmount || 0);
                                    return sum + (waiverAmount > 0 ? waiverAmount : 0);
                                  }, 0);

                                  // Only add single waiver line if total amount is greater than 0
                                  if (totalWaiverAmount > 0) {
                                    items.push({
                                      id: 'waiver-total',
                                      item_type: 'Waiver',
                                      item_name: 'Waiver',
                                      bill_category_name: 'Waiver',
                                      amount: -Math.abs(totalWaiverAmount),
                                      is_waiver: true
                                    });
                                  }
                                }

                                // 4. Past Payments (Negative) - Only show if paid_amount > 0
                                const paidAmount = parseFloat(month.paid_amount || 0);
                                const normalizedPaid = Math.max(0, paidAmount);
                                items.push({
                                  id: 'paid-total',
                                  item_type: 'Payment',
                                  item_name: 'Paid Amount',
                                  bill_category_name: 'Paid Amount',
                                  amount: -normalizedPaid,
                                  is_payment: true
                                });

                                if (items.length > 0) {
                                  return items.map((item, idx) => {
                                    // Check if this is a penalty item and has waivers
                                    const isPenalty = item.item_type === 'penalty';
                                    const hasWaiver = isPenalty && totalWaivedAmount > 0;
                                    const originalPenaltyAmount = isPenalty ? penaltyFee : null;

                                    // Show penalty after waiver; default to raw amount for others
                                    const displayAmount = isPenalty
                                      ? Math.max(0, parseFloat(item.amount || 0) - totalWaivedAmount)
                                      : Math.abs(parseFloat(item.amount || 0));

                                    return (
                                      <div key={`fee-item-${item.id || idx}`} className={`flex justify-between items-center ${item.is_waiver || item.is_payment ? 'text-teal-600' : ''}`}>
                                        <span className={`text-base ${isPenalty ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                                          {item.item_name}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          {/* Show original penalty amount with strikethrough if waiver exists */}
                                          {hasWaiver && (
                                            <span className="text-base font-medium text-gray-400 line-through">
                                              ৳{Math.abs(parseFloat(originalPenaltyAmount || 0)).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                            </span>
                                          )}
                                          {/* Show current amount (after waiver for penalties) */}
                                          <span className="text-base font-medium text-gray-900">
                                            ৳{Math.abs(displayAmount).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  });
                                }
                                return <p className="text-sm text-gray-500 italic">No breakdown details available</p>;
                              })()}
                            </div>

                            {/* Total Due Section */}
                            <div className="mb-5 pt-4 pb-4 border-t-2 border-b-2 border-gray-200">
                              <div className="flex justify-between items-center">
                                <span className="text-lg font-bold text-gray-900">Total Due</span>
                                <span className="text-3xl font-bold text-teal-600">
                                  ৳{calculateMonthNetDue(month).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                              </div>
                            </div>

                            {/* Action Buttons Section */}
                            <div className="flex gap-3 items-center">
                              {/* Select/Selected Toggle Button - Wider */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();

                                  // Toggle selection
                                  const isNowSelected = !month.isSelected;
                                  const updatedMonths = availableMonths.map(m =>
                                    m.service_period_month === month.service_period_month &&
                                      m.service_period_year === month.service_period_year
                                      ? { ...m, isSelected: isNowSelected }
                                      : m
                                  );

                                  setAvailableMonths(updatedMonths);

                                  // Clicking a card resets "manual edit" mode to sync with card selection
                                  setIsManuallyEdited(false);

                                  // Calculate and set the total for all selected months immediately for better feedback
                                  const newTotal = calculateTotalAmount(updatedMonths);
                                  setFormData(prev => ({
                                    ...prev,
                                    manualAmount: newTotal !== '0' ? newTotal : ''
                                  }));
                                  setAmountError('');
                                }}
                                className={`flex-[2] px-6 py-3 rounded-lg transition-all text-base font-semibold flex items-center justify-center gap-2 ${month.isSelected
                                  ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-md'
                                  : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-300'
                                  }`}
                              >
                                {month.isSelected ? (
                                  <>
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Selected
                                  </>
                                ) : (
                                  'Select'
                                )}
                              </button>

                              {/* Waive Penalty Button - Smaller */}
                              {penaltyFee > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const remaining = Math.max(0, penaltyFee - totalWaivedAmount);

                                    // Check if fully waived
                                    if (remaining <= 0) {
                                      setApiErrorMessage('Penalty limit reached. Cannot waive more than the total penalty amount.');
                                      return;
                                    }

                                    // Default is 50% of ORIGINAL penalty, but cap at remaining
                                    const defaultWaiver = Math.round(penaltyFee / 2);
                                    const amountToWaive = Math.min(defaultWaiver, remaining);
                                    const isCapped = amountToWaive < defaultWaiver;

                                    // Append new waiver
                                    setAvailableMonths(prev => {
                                      const updated = prev.map(m => {
                                        if (m.service_period_month === month.service_period_month &&
                                          m.service_period_year === month.service_period_year) {
                                          // Get existing waivers and filter out any with zero or invalid amounts
                                          const existingWaivers = Array.isArray(m.waiver_data)
                                            ? m.waiver_data.filter(w => {
                                              const amount = parseFloat(w.waived_amount || w.waivedAmount || 0);
                                              return amount > 0; // Only keep waivers with actual amounts
                                            })
                                            : (m.waiver_data && parseFloat(m.waiver_data.waived_amount || m.waiver_data.waivedAmount || 0) > 0 ? [m.waiver_data] : []);

                                          const updatedMonth = {
                                            ...m,
                                            waiver_applied: true, // Mark as having waiver
                                            waiver_data: [
                                              {
                                                waivedAmount: amountToWaive,
                                                reason: 'Administrative Decision',
                                                appliedAt: new Date().toISOString(),
                                                appliedBy: currentUser?.full_name || 'System',
                                                waiverType: 'partial',
                                                partialType: isCapped ? 'fixed' : 'percentage',
                                                waiverPercentage: 50,
                                                isSessionNew: true
                                              },
                                              ...existingWaivers // Spread filtered existing waivers
                                            ]
                                          };



                                          return updatedMonth;
                                        }
                                        return m;
                                      });
                                      return updated;
                                    });
                                  }}
                                  className="flex-[1] px-3 py-3 rounded-lg text-sm font-semibold text-yellow-700 bg-yellow-50 border-2 border-yellow-400 hover:bg-yellow-100 transition-all flex items-center justify-center gap-1.5"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                                  </svg>
                                  Waive Penalty
                                </button>
                              )}

                              {/* Waiver History Button - Only show if waiver applied */}
                              {month.waiver_applied && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowWaiverHistory(prev => ({
                                      ...prev,
                                      [`${month.service_period_year}-${month.service_period_month}`]: !prev[`${month.service_period_year}-${month.service_period_month}`]
                                    }));
                                  }}
                                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 hover:bg-gray-50 transition-all min-w-[60px]"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="text-base font-bold">
                                    {Array.isArray(month.waiver_data) ? month.waiver_data.length : 1}
                                  </span>
                                </button>
                              )}
                            </div>

                            {/* Waiver History Section - Expandable */}
                            {month.waiver_applied && showWaiverHistory[`${month.service_period_year}-${month.service_period_month}`] && (
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="flex items-center gap-2 mb-3">
                                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <h4 className="text-base font-bold text-gray-900">Waiver History</h4>
                                </div>

                                {/* Waiver Entries - Loop through all waivers */}
                                <div className="space-y-3">
                                  {(Array.isArray(month.waiver_data) ? month.waiver_data : (month.waiver_data ? [month.waiver_data] : [])).map((waiver, index) => {
                                    // Show "Latest Adjustment" for ALL isSessionNew waivers (client-side before save)
                                    // Show "Past Waiver" ONLY for API-loaded waivers (without isSessionNew flag)
                                    const isLatest = waiver?.isSessionNew === true;

                                    return (
                                      <div key={index} className={`${isLatest ? 'bg-emerald-50/50 border-emerald-200' : 'bg-gray-50/50 border-gray-200 opacity-80'} rounded-lg p-4 border transition-all`}>
                                        <div className="flex items-start justify-between mb-3">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                              <span className="text-sm font-semibold text-gray-900">
                                                {waiver?.applied_at
                                                  ? new Date(waiver.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                  : waiver?.appliedAt
                                                    ? new Date(waiver.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                }
                                              </span>
                                              {isLatest ? (
                                                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium shadow-sm">
                                                  Latest Adjustment
                                                </span>
                                              ) : (
                                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                                                  Past Waiver
                                                </span>
                                              )}
                                            </div>
                                            <div className="space-y-1">
                                              <p className="text-sm text-gray-700">
                                                <span className="font-medium">Reason:</span> {waiver?.reason || waiver?.waiver_reason || waiver?.notes || 'Administrative Decision'}
                                              </p>
                                              {waiver?.notes && (
                                                <p className="text-sm text-gray-700">
                                                  <span className="font-medium">Notes:</span> {waiver.notes}
                                                </p>
                                              )}
                                              <p className="text-sm text-gray-700">
                                                <span className="font-medium">Approved by:</span> {waiver?.applied_by || waiver?.appliedBy || selectedUser?.full_name || currentUser?.full_name || 'N/A'}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="flex flex-col items-end gap-2 ml-4">
                                            <span className={`text-base font-bold ${isLatest ? 'text-emerald-600' : 'text-gray-400'}`}>
                                              -৳{(waiver?.waived_amount || waiver?.waivedAmount || waiver?.amount || 0).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                              {(waiver?.waiver_type === 'full' || waiver?.waiverType === 'full') ? ' (100%)' : ''}
                                            </span>
                                            <div className="flex items-center gap-2">
                                              {/* Edit Button - Available for all records */}
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setEditingWaiverIndex(index);
                                                  setSelectedMonthForWaiver(month);
                                                  setShowWaivePenaltyModal(true);
                                                }}
                                                className="p-2 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                                                title="Edit waiver"
                                              >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                              </button>

                                              {/* Delete Button - Available for all records */}
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteWaiver(waiver, month, index);
                                                }}
                                                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title={`Delete ${isLatest ? 'latest' : 'past'} waiver`}
                                              >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                              </button>

                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>


              </form>
            )}
          </div>

          {/* New Fixed Modal Footer */}
          <div className="p-6 border-t border-gray-200 bg-white flex-shrink-0 z-10 flex justify-end gap-3">
            {showAllocationConfirm ? (
              <>
                <button
                  onClick={() => setShowAllocationConfirm(false)}
                  className="px-6 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => handleSubmit(e)}
                  disabled={loading || creating || updating}
                  className="px-6 py-2.5 text-sm font-bold bg-[#3C9D9B] text-white rounded-lg hover:bg-teal-700 transition-colors shadow-md shadow-teal-100 flex items-center gap-2"
                >
                  {loading ? 'Processing...' : 'Confirm & Save Payment'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleClose}
                  type="button"
                  className="px-6 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="payment-form"
                  disabled={
                    loading ||
                    creating ||
                    updating ||
                    (availableMonths.length === 0 && parseFloat(formData.manualAmount || 0) <= 0) ||
                    !((parseFloat(formData.manualAmount || 0) > 0) || (totalAdvance > 0)) ||
                    (!!amountError && totalAdvance <= 0) ||
                    !!createdByError ||
                    (!isCreatedByValid && !selectedUser && !currentUser)
                  }
                  className="px-8 py-2.5 text-base font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {loading || creating || updating ? 'Saving...' : 'Save Payment'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Waive Penalty Modal */}
      < WaivePenaltyModal
        isOpen={showWaivePenaltyModal}
        initialWaiver={editingWaiverIndex !== null && selectedMonthForWaiver?.waiver_data ? selectedMonthForWaiver.waiver_data[editingWaiverIndex] : null}
        initialWaiverIndex={editingWaiverIndex}
        onClose={() => {
          setShowWaivePenaltyModal(false);
          setSelectedMonthForWaiver(null);
          setEditingWaiverIndex(null);
        }}
        onApply={async (waiverData) => {
          try {
            console.log('✅ onApply Debug:', { waiverData, editingWaiverIndex, selectedMonth: selectedMonthForWaiver });

            // 1. Identify the waiver being edited using the index OR the ID passed back
            const originalWaiver = selectedMonthForWaiver?.waiver_data?.[editingWaiverIndex];
            const waiverId = waiverData.id || originalWaiver?.id;

            // 2. If it's a past waiver (has ID and NOT session new), call API directly
            if (waiverId && (!originalWaiver || !originalWaiver.isSessionNew)) {
              console.log('🚀 Triggering PATCH API for waiver ID:', waiverId);
              const payload = {
                waived_amount: waiverData.waivedAmount,
                reason: waiverData.reason,
                notes: waiverData.notes,
                waiver_type: waiverData.waiverType,
                partial_type: waiverData.partialType,
                waiver_percentage: waiverData.waiverPercentage
              };

              setLoading(true);
              const res = await axiosInstance.patch(`/api/service-fee-management/penalty-waivers/${waiverId}/`, payload);

              if (res.data.success || res.status === 200) {
                console.log('🎉 API Update Success');
                setApiSuccessMessage("Waiver updated successfully");
                setIsPaymentSuccess(false);
                fetchUnpaidPeriods();
                // Refresh background table to update stats
                if (onSuccess) onSuccess();

                setShowWaivePenaltyModal(false);
                setSelectedMonthForWaiver(null);
                setEditingWaiverIndex(null);
              }
              setLoading(false);
              return;
            }

            console.log('🌱 Performing local session update');
            // 3. Local state update for session-new waivers or fallback
            setAvailableMonths(prev =>
              prev.map(month => {
                if (
                  month.service_period_month === selectedMonthForWaiver?.service_period_month &&
                  month.service_period_year === selectedMonthForWaiver?.service_period_year
                ) {
                  const existingWaivers = Array.isArray(month.waiver_data) ? month.waiver_data : (month.waiver_data ? [month.waiver_data] : []);
                  let updatedWaivers;

                  if (editingWaiverIndex !== null && existingWaivers[editingWaiverIndex]) {
                    updatedWaivers = existingWaivers.map((w, i) =>
                      i === editingWaiverIndex ? { ...w, ...waiverData } : w
                    );
                  } else {
                    const newWaiver = {
                      ...waiverData,
                      appliedAt: new Date().toISOString(),
                      appliedBy: selectedUser?.full_name || currentUser?.full_name || 'Admin',
                      isSessionNew: true
                    };
                    updatedWaivers = [newWaiver, ...existingWaivers];
                  }

                  return {
                    ...month,
                    waiver_applied: true,
                    waiver_data: updatedWaivers
                  };
                }
                return month;
              })
            );

            setShowWaivePenaltyModal(false);
            setSelectedMonthForWaiver(null);
            setEditingWaiverIndex(null);

          } catch (error) {
            console.error('❌ Error in onApply:', error);
            setApiErrorMessage(error.response?.data?.message || 'Error processing waiver update');
            setLoading(false);
          }
        }}
        paymentData={payment}
        monthData={selectedMonthForWaiver}
      />
    </>
  );
};

RecordPaymentModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  payment: PropTypes.object,
  residentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  unitId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSuccess: PropTypes.func,
};

export default RecordPaymentModal;

