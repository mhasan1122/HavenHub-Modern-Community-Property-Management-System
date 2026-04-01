import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { BiFilter } from "react-icons/bi";
import { FaArrowLeft, FaFilter, FaPlus, FaDownload, FaBuilding, FaDollarSign, FaExclamationCircle, FaChartLine, FaGift, FaMoneyBillWave, FaCheckCircle, FaClock, FaList } from 'react-icons/fa';
import { IoSearch } from 'react-icons/io5';
import PaymentTable from './PaymentTable';
import PaymentHistoryList from './PaymentHistoryList';
import FilterControls from './FilterControls';
import PaymentHistoryFilters from './PaymentHistoryFilters';
import ViewReceiptModal from '../../components/ViewReceiptModal';
import RecordPaymentModal from './RecordPaymentModal';
import BillDetailView from '../../BillingManagement/components/BillDetailView';
import TableSkeleton from '../../../../Components/Loaders/TableSkeleton';
import useSkeletonLoading from '../../../../hooks/useSkeletonLoading';
import { SKELETON_MIN_DISPLAY_TIME } from '../../../../config/skeletonLoadingConfig';
import { fetchServiceFeeResidents, fetchServiceFeeResidentsSingle, fetchFilterOptions, generateServiceFee, deletePayment, fetchPaymentHistory } from '../../../../redux/slices/api/serviceFeeManagement/serviceFeeManagementApi';
import { fetchTowers } from '../../../../redux/slices/towers/towerSlice';
import { clearAllStates, clearErrors } from '../../../../redux/slices/serviceFeeManagement/serviceFeeManagementSlice';
import { clearSuccessStates } from '../../../../redux/slices/payments/paymentSlice';
import ConfirmationMessageBox from '../../../../Components/MessageBox/ConfirmationMessageBox';
import MessageBox from '../../../../Components/MessageBox/MessageBox';
import { PERMISSIONS } from '../../../../constants/permissions';
import Button from '../../../../Components/FormComponent/ButtonComponent/Button';
import FilterButton from '../../../../Components/FormComponent/ButtonComponent/FilterButton';
import PageContainer from '../../../../Components/Ui/PageContainer';
import ContentBox from '../../../../Components/Ui/ContentBox';
import Heading from '../../../../Components/HeadingComponent/Heading';
import axiosInstance from '../../../../utils/axiosInstance';
import html2pdf from 'html2pdf.js';
import { getReceiptHtml } from '../../../../utils/paymentReceiptTemplate';


const PaymentsTable = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  // Check if navigated from Overview page via tabs
  const showBackButton = location.state?.fromOverview === true;

  // Permission checks
  const user = useSelector((state) => state.auth.user);
  const permissionIds = user?.permission_ids?.map(String) || [];
  const canRecordPayment = permissionIds.includes(String(PERMISSIONS.RECORD_SERVICE_FEE_PAYMENT));
  const canViewPaymentHistory = permissionIds.includes(String(PERMISSIONS.VIEW_UNIT_PAYMENT_HISTORY));
  const canViewOutstanding = permissionIds.includes(String(PERMISSIONS.VIEW_SERVICE_FEE_PAYMENTS));

  // Redux state
  const serviceFeeState = useSelector(state => state.serviceFeeManagement) || {};
  const paymentState = useSelector(state => state.payments) || {};
  const {
    residents: payments = [],
    residentsLoading: residentsLoading = false,
    filterOptions = { towers: [], status_options: [], payment_methods: [], service_fees: [] }
  } = serviceFeeState;

  // Only show loading animation on initial window load
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    if (canViewOutstanding) return 'outstanding';
    if (canViewPaymentHistory) return 'history';
    return 'outstanding'; // fallback if neither is matched (though router should prevent this)
  });
  const [paymentHistory, setPaymentHistory] = useState([]);

  // Auto-switch tab based on permissions (keep this just in case permissions update dynamically)
  useEffect(() => {
    if (!canViewOutstanding && canViewPaymentHistory && activeTab === 'outstanding') {
      setActiveTab('history');
    }
  }, [canViewOutstanding, canViewPaymentHistory, activeTab]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Payment History specific filters
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [advanceFilter, setAdvanceFilter] = useState('all');
  const [selectedUnits, setSelectedUnits] = useState([]);

  const {
    deleteSuccess,
    deleteError
  } = paymentState;

  // // Debug logging
  // console.log('Component payments:', payments);
  // console.log('Component loading:', loading);
  // console.log('Component error:', error);

  // Get current month and year for service period
  const getCurrentServicePeriod = () => {
    const today = new Date();
    return {
      year: today.getFullYear(),
      month: today.getMonth() + 1
    };
  };

  const currentServicePeriod = getCurrentServicePeriod();

  // Local state - Initialize with current service period
  const [searchQueryOutstanding, setSearchQueryOutstanding] = useState('');
  const [searchQueryHistory, setSearchQueryHistory] = useState('');
  const [selectedTowers, setSelectedTowers] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedMethods, setSelectedMethods] = useState([]);
  const [servicePeriod, setServicePeriod] = useState(currentServicePeriod);
  const [generateMonth, setGenerateMonth] = useState(currentServicePeriod);
  const [isFilterExpanded, setIsFilterExpanded] = useState(true); // Show filters by default
  const [showViewReceiptModal, setShowViewReceiptModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState(null);
  const [selectedPaymentForAction, setSelectedPaymentForAction] = useState(null);
  const [selectedPaymentForHistory, setSelectedPaymentForHistory] = useState(null);

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);
  const [deleteMessage, setDeleteMessage] = useState('');
  const [isDeleteSuccess, setIsDeleteSuccess] = useState(false);

  // Selection states for checkboxes
  const [selectedPayments, setSelectedPayments] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState('');
  const [generateError, setGenerateError] = useState(false);

  // Generate service fee filter state (for service fee dropdown in FilterControls)
  const [selectedServiceFees, setSelectedServiceFees] = useState([]);

  // Confirmation state for generation
  const [showGenerateConfirmation, setShowGenerateConfirmation] = useState(false);
  const [generateConfirmMessage, setGenerateConfirmMessage] = useState('');

  // Get selected service period display
  const getSelectedServicePeriod = () => {
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    return `${monthNames[servicePeriod.month - 1]} ${servicePeriod.year}`;
  };

  useEffect(() => {
    dispatch(clearAllStates());
    dispatch(fetchFilterOptions());
    dispatch(fetchTowers());
  }, [dispatch]);

  // Fetch service fees when tower selection changes
  useEffect(() => {
    if (selectedTowers && selectedTowers.length > 0) {
      // Fetch filtered service fees based on selected towers
      const towerIdsParam = selectedTowers.join(',');
      dispatch(fetchFilterOptions(towerIdsParam));
    }
  }, [selectedTowers, dispatch]);

  // Initialize page loading - Updated to use new API
  const initializePage = async () => {
    // Clear any previous errors
    dispatch(clearErrors());
    // Fetch service fee residents with current filters (combined data + statistics)
    const filterParams = {
      tower_ids: selectedTowers.length > 0 ? selectedTowers : [],
      statuses: selectedStatuses.length > 0 ? selectedStatuses : [],
      service_period_month: generateMonth?.month,  // Use generateMonth instead of servicePeriod
      service_period_year: generateMonth?.year,     // Use generateMonth instead of servicePeriod
      search: searchQueryOutstanding,
      include_payment_details: true
    };

    await dispatch(fetchServiceFeeResidents(filterParams));
  };

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'outstanding') {
      initializePage();
    } else {
      fetchHistory();
    }
  }, [activeTab, servicePeriod, generateMonth, selectedTowers, selectedStatuses, selectedMethods, selectedServiceFees, searchQueryOutstanding, searchQueryHistory, minAmount, maxAmount, advanceFilter, selectedUnits]);

  // Fetch payment history for the history tab
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const params = {};

      if (selectedTowers.length > 0) {
        params.tower_ids = selectedTowers.join(',');
      }

      if (searchQueryHistory) {
        params.search = searchQueryHistory;
      }

      // Add new filters
      if (selectedMethods.length > 0) {
        params.payment_method_ids = selectedMethods.join(',');
      }

      if (selectedUnits.length > 0) {
        params.unit_ids = selectedUnits.join(',');
      }

      if (minAmount) params.min_amount = minAmount;
      if (maxAmount) params.max_amount = maxAmount;
      if (advanceFilter && advanceFilter !== 'all') params.advance_filter = advanceFilter;

      const result = await dispatch(fetchPaymentHistory(params)).unwrap();
      // API utility returns response.data.data (which is { payments: [...] }) or response.data
      // So we should check result.payments first
      setPaymentHistory(result?.payments || result?.data?.payments || []);
    } catch (error) {
      console.error('Error fetching history:', error);
      setPaymentHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Handle initial load completion
  useEffect(() => {
    if (!residentsLoading && payments) {
      setIsInitialLoad(false);
    }
  }, [residentsLoading, payments]);

  // Use skeleton loading hook to ensure minimum display time and data validation
  const showSkeleton = useSkeletonLoading(
    residentsLoading || isInitialLoad,
    payments,
    SKELETON_MIN_DISPLAY_TIME
  );

  // const handleSearch = (query) => {
  //   setSearchQuery(query);
  //   setShowSearchDropdown(query.length > 0);
  //   if (query.length > 0) {
  //     dispatch(fetchServiceFeeResidents({
  //       search: query,
  //       tower_id: selectedTower === 'All Towers' ? '' : selectedTower,
  //       status: selectedStatus === 'All Status' ? '' : selectedStatus,
  //       payment_method: selectedMethod === 'All Methods' ? '' : selectedMethod,
  //       payment_date_from: fromDate,
  //       payment_date_to: toDate
  //     }));
  //   }
  // };

  const handleFilterChange = (filterType, value) => {
    switch (filterType) {
      case 'searchQuery':
        if (activeTab === 'outstanding') {
          setSearchQueryOutstanding(value);
        } else {
          setSearchQueryHistory(value);
        }
        break;
      case 'servicePeriod':
        console.log('Setting service period:', value);
        setServicePeriod(value);
        break;
      case 'generateMonth':
        setGenerateMonth(value);
        break;
      case 'selectedTowers':
      case 'towers':
        setSelectedTowers(value);
        break;
      case 'selectedStatuses':
      case 'status':
      case 'statuses':
        setSelectedStatuses(value);
        break;
      case 'selectedMethods':
      case 'method':
      case 'methods':
        setSelectedMethods(value);
        break;
      default:
        break;
    }
  };

  const handleClearAllFilters = () => {
    setSearchQueryOutstanding('');
    setSearchQueryHistory('');
    setSelectedTowers([]);
    setSelectedStatuses([]);
    setServicePeriod(getCurrentServicePeriod());
  };



  const handleDeletePayment = (payment) => {
    // Reset success state
    setIsDeleteSuccess(false);

    // Check if the payment is generated
    // if (payment.generation_status !== 'Generated') {
    //   setDeleteMessage('This unit has not been generated yet. Only generated service fees can be deleted.');
    //   setShowConfirmation(true);
    //   setPaymentToDelete(null);
    //   return;
    // }

    // Set the payment to delete and show confirmation
    const residentName = payment.primary_name || payment.resident_name || 'Unknown Resident';
    const unitDisplay = payment.unit_display || payment.unit_name || 'Unknown Unit';
    setPaymentToDelete(payment);
    setDeleteMessage(`Are you sure you want to delete/regenerate the service fee for ${residentName} (Unit: ${unitDisplay})? This will remove all payment records for this month.`);
    setShowConfirmation(true);
  };

  const fetchAndUpdateSingleItem = async (paymentData) => {
    const specificFilterParams = {
      unit_id: paymentData.unit_id,
      resident_id: paymentData.resident_id,
      service_fee_id: paymentData.service_fee_id,
      service_period_month: servicePeriod?.month,
      service_period_year: servicePeriod?.year
    };

    await dispatch(fetchServiceFeeResidentsSingle(specificFilterParams));
  };

  const handleDeletePaymentConfirmed = async () => {
    if (!paymentToDelete) {
      // Just close the dialog if no payment to delete (info message case)
      setShowConfirmation(false);
      setDeleteMessage('');
      setIsDeleteSuccess(false);
      return;
    }

    try {
      setIsGenerating(true); // Use the same loading state
      setIsDeleteSuccess(false); // Reset success state

      // Send delete request with service fee details
      const deleteParams = {
        payment_id: paymentToDelete.payment_id,

      };

      console.log('Deleting service fee with params:', deleteParams);

      // // Call the delete API endpoint
      // const response = await axiosInstance.post('/api/service-fee-management/delete-generated-fee/', {
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(deleteParams)
      // });

      const resultAction = await dispatch(deletePayment(deleteParams));

      if (deletePayment.fulfilled.match(resultAction)) {
        const result = resultAction.payload;
        setDeleteMessage(result.message || 'Service fee deleted successfully');
        setGenerateError(false);
        setIsDeleteSuccess(true); // Set success state

        // Refresh the payment list
        // const filterParams = {
        //   tower_ids: selectedTowers.length > 0 ? selectedTowers : [],
        //   statuses: selectedStatuses.length > 0 ? selectedStatuses : [],
        //   service_period_month: generateMonth?.month,
        //   service_period_year: generateMonth?.year,
        //   search: searchQuery,
        //   include_payment_details: true
        // };

        // await dispatch(fetchServiceFeeResidents(filterParams));

        // // Auto-close success dialog after 2 seconds
        // setTimeout(() => {
        //   setShowConfirmation(false);
        //   setPaymentToDelete(null);
        //   setDeleteMessage('');
        //   setIsDeleteSuccess(false);
        // }, 2000);
      } else {
        const error = resultAction.payload || resultAction.error;
        setDeleteMessage(error?.message || 'Failed to delete service fee');
        setGenerateError(true);
        setIsDeleteSuccess(false);
        // Close confirmation and show error in MessageBox
        setShowConfirmation(false);
        setPaymentToDelete(null);
      }

    } catch (error) {
      console.error('Error deleting service fee:', error);
      setDeleteMessage('Error deleting service fee. Please try again.');
      setGenerateError(true);
      setIsDeleteSuccess(false);
      // Close confirmation and show error in MessageBox
      setShowConfirmation(false);
      setPaymentToDelete(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleViewReceipt = (payment) => {
    setSelectedPaymentForReceipt(payment);
    setShowViewReceiptModal(true);
  };

  const handleDownloadReceipt = (payment) => {
    if (!payment) return;

    try {
      // Create a hidden iframe for ultimate isolation (prevents any page shaking)
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '800px';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';
      iframe.style.left = '-9999px';
      document.body.appendChild(iframe);

      const html = getReceiptHtml(payment);

      const fileName = `Receipt_${payment.receipt_id || payment.transaction_id || 'Unknown'}.pdf`;

      const opt = {
        margin: [10, 10], // top, left, bottom, right
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      // Use the HTML string directly for better style preservation
      html2pdf().from(html).set(opt).save().then(() => {
        // Remove the iframe after download completes
        document.body.removeChild(iframe);
      });
    } catch (error) {
      console.error('Error generating receipt PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  const handleRecordPayment = (payment) => {
    setSelectedPaymentForAction(payment);
    setShowRecordPaymentModal(true);
  };

  // const handleViewHistory = (payment) => {
  //   setSelectedPaymentForHistory(payment);
  //   setShowPaymentHistoryModal(true);
  // };

  // Function to refresh payment data after successful update
  const handlePaymentSuccess = async () => {
    console.log('Refreshing payment data after successful operation...');

    // Refresh based on active tab
    if (activeTab === 'outstanding') {
      const filterParams = {
        tower_ids: selectedTowers.length > 0 ? selectedTowers : [],
        statuses: selectedStatuses.length > 0 ? selectedStatuses : [],
        service_period_month: generateMonth?.month,  // ✅ Use generateMonth to maintain filter
        service_period_year: generateMonth?.year,    // ✅ Use generateMonth to maintain filter
        search: searchQueryOutstanding,
        include_payment_details: true  // Set to true after payment to refresh generation status
      };

      // Refresh the payment data
      await dispatch(fetchServiceFeeResidents(filterParams));
      // Clear selections after refresh
      setSelectedPayments([]);
    } else {
      // Refresh payment history on history tab
      await fetchHistory();
    }
  };

  // Handle select single payment with confirmation for "Generated" items
  const handleSelectPayment = (payment) => {
    const isAlreadySelected = selectedPayments.some(p =>
      p.id === payment.id || (p.unit_id === payment.unit_id && p.service_fee_id === payment.service_fee_id)
    );

    if (isAlreadySelected) {
      // Deselect - remove from list (no confirmation needed)
      const newSelection = selectedPayments.filter(p =>
        !(p.id === payment.id || (p.unit_id === payment.unit_id && p.service_fee_id === payment.service_fee_id))
      );
      setSelectedPayments(newSelection);
    } else {
      // If selecting a "Generated" item, show confirmation FIRST (before any validation)
      if (payment.generation_status === 'Generated') {
        // Check if mixing statuses (only if items already selected)
        if (selectedPayments.length > 0) {
          const firstSelectedStatus = selectedPayments[0].generation_status;
          if (firstSelectedStatus !== 'Generated') {
            // Trying to mix Generated with Not Generated
            setGenerateMessage("You cannot select both Generated and Not Generated items at the same time. Please select items with the same status.");
            setGenerateError(true);
            return;
          }
        }

        // Show confirmation for Generated item
        setGenerateConfirmMessage(`You are selecting "${payment.unit_display}" which is already Generated. Do you want to regenerate this service fee?`);
        setShowGenerateConfirmation(true);

        // Store the pending payment to be added after confirmation
        window.pendingPaymentSelection = payment;
      } else {
        // For "Not Generated" items, check validation then add directly
        if (selectedPayments.length > 0) {
          const firstSelectedStatus = selectedPayments[0].generation_status;
          if (firstSelectedStatus === 'Generated') {
            // Trying to mix Not Generated with Generated
            setGenerateMessage("You cannot select both Generated and Not Generated items at the same time. Please select items with the same status.");
            setGenerateError(true);
            return;
          }
        }

        // Add directly without confirmation
        setSelectedPayments([...selectedPayments, payment]);
      }
    }
  };

  // Handle select all payments - with confirmation for "Generated" items
  const handleSelectAll = (checked) => {
    if (checked) {
      // Determine which payments to select
      let paymentsToSelect = [];

      if (selectedPayments.length === 0) {
        // No items selected yet, select all
        paymentsToSelect = [...payments];
      } else {
        // Select all with same status as first selected item
        const firstSelectedStatus = selectedPayments[0].generation_status;
        paymentsToSelect = payments.filter(p => p.generation_status === firstSelectedStatus);
      }

      // Check if any of the items to select are "Generated"
      const hasGeneratedItems = paymentsToSelect.some(p => p.generation_status === 'Generated');

      if (hasGeneratedItems) {
        // Show confirmation for selecting "Generated" items
        setGenerateConfirmMessage(`You are selecting ${paymentsToSelect.length} items including Generated service fees. Do you want to regenerate these service fees?`);
        setShowGenerateConfirmation(true);
        window.pendingPaymentSelection = paymentsToSelect; // Store as array
      } else {
        // No "Generated" items, select directly
        setSelectedPayments(paymentsToSelect);
      }
    } else {
      setSelectedPayments([]);
    }
  };

  // Handle generate service fee button click - placeholder for future implementation
  const handleGenerateServiceFeeClick = () => {
    // TODO: Add logic later
  };

  // Handle confirmed generation
  const handleConfirmedGenerate = async () => {
    // Check if this is a selection confirmation (for "Generated" items)
    if (window.pendingPaymentSelection) {
      const pending = window.pendingPaymentSelection;

      // Check if it's an array (Select All) or single payment
      if (Array.isArray(pending)) {
        setSelectedPayments(pending);
      } else {
        setSelectedPayments(prev => [...prev, pending]);
      }

      window.pendingPaymentSelection = null;
      setShowGenerateConfirmation(false);
      setGenerateConfirmMessage('');
    } else {
      // This is a generation confirmation (clicking the Generate button)
      setShowGenerateConfirmation(false);
      await executeGeneration();
    }
  };

  // Handle cancel generation
  const handleCancelGenerate = () => {
    // If canceling selection confirmation, don't add the payment
    if (window.pendingPaymentSelection) {
      window.pendingPaymentSelection = null;
    }
    setShowGenerateConfirmation(false);
    setGenerateConfirmMessage('');
  };

  // Execute the actual generation
  const executeGeneration = async () => {
    // Validate: At least one unit must be checked
    if (!selectedPayments || selectedPayments.length === 0) {
      setGenerateMessage('Please select at least one unit to generate service fee');
      setGenerateError(true);
      return;
    }

    setIsGenerating(true);
    try {
      // Check if any selected payment has 'Generated' status
      const hasGeneratedPayments = selectedPayments.some(
        payment => payment.generation_status === 'Generated'
      );

      // Build generate params with optional filters using generateMonth instead of servicePeriod
      const params = {
        year: generateMonth.year,
        month: generateMonth.month,
        force_regenerate: hasGeneratedPayments  // Add flag for regeneration
      };

      // Add service fee filter: send all selected as service_fee_ids (array or comma-separated string)


      // Add tower filter if selected (use first selected tower if multiple)
      if (selectedTowers && selectedTowers.length > 0) {
        params.tower_id = selectedTowers[0];
      }

      // Add selected unit IDs and service fee IDs from selectedPayments (single loop, unique values)
      if (selectedPayments && selectedPayments.length > 0) {
        const unitIdSet = new Set();
        const serviceFeeIdSet = new Set();
        selectedPayments.forEach(payment => {
          if (payment.unit_id != null) unitIdSet.add(payment.unit_id);
          if (payment.service_fee_id != null) serviceFeeIdSet.add(payment.service_fee_id);
        });
        if (unitIdSet.size > 0) {
          params.unit_ids = Array.from(unitIdSet).join(',');
        }
        if (serviceFeeIdSet.size > 0) {
          params.service_fee_ids = Array.from(serviceFeeIdSet).join(',');
        }
      }

      const result = await dispatch(generateServiceFee(params));

      if (result.payload && result.payload.success) {
        setGenerateMessage(result.payload.message);
        setGenerateError(false);
        // Clear service fee selection after successful generation
        setSelectedServiceFees([]);
        setSelectedPayments([]);

        // Refresh the list with include_payment_details: false to show generation status
        const filterParams = {
          tower_ids: selectedTowers.length > 0 ? selectedTowers : [],
          statuses: selectedStatuses.length > 0 ? selectedStatuses : [],
          service_period_month: generateMonth?.month,
          service_period_year: generateMonth?.year,
          search: searchQuery,
          include_payment_details: true
        };

        await dispatch(fetchServiceFeeResidents(filterParams));
      } else {
        setGenerateMessage(result.payload?.message || 'Failed to generate service fees');
        setGenerateError(true);
      }
    } catch (error) {
      setGenerateMessage('Error generating service fees');
      setGenerateError(true);
    } finally {
      setIsGenerating(false);
    }
  };

  // Filter and sort payments
  // const getFilteredAndSortedPayments = () => {
  //   console.log('Starting filter with payments:', payments);
  //   console.log('Current filters:', { searchQuery, selectedTower, selectedStatus, selectedMethod, fromDate, toDate });

  // let filtered = payments.filter(payment => {
  //   const matchesSearch = (payment.tower_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
  //                        (payment.unit_display || payment.unit_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
  //                        (payment.resident_name || '').toLowerCase().includes(searchQuery.toLowerCase());

  //   const matchesTowerFilter = selectedTower === 'All Towers' || payment.tower_name === selectedTower;
  //   const matchesStatusFilter = selectedStatus === 'All Status' || payment.service_status === selectedStatus;
  //   const matchesMethodFilter = selectedMethod === 'All Methods' || payment.payment_method === selectedMethod || payment.method_display === selectedMethod;

  //   // Date filtering logic
  //   let matchesDateFilter = true;
  //   if (fromDate || toDate) {
  //     // Convert payment due date to comparable format
  //     // Backend returns due_date in YYYY-MM-DD format
  //     const paymentDate = new Date(payment.due_date);

  //     if (fromDate) {
  //       const from = new Date(fromDate);
  //       matchesDateFilter = matchesDateFilter && paymentDate >= from;
  //     }

  //     if (toDate) {
  //       const to = new Date(toDate);
  //       matchesDateFilter = matchesDateFilter && paymentDate <= to;
  //     }
  //   }

  //   console.log('Payment filter result:', {
  //     payment: payment.resident_name,
  //     matchesSearch,
  //     matchesTowerFilter,
  //     matchesStatusFilter,
  //     matchesMethodFilter,
  //     matchesDateFilter
  //   });

  //   return matchesSearch && matchesTowerFilter && matchesStatusFilter && matchesMethodFilter && matchesDateFilter;
  // });

  // console.log('Filtered payments:', filtered);

  // // Apply sorting
  // if (sortConfig.key) {
  //   filtered.sort((a, b) => {
  //     let aValue = a[sortConfig.key];
  //     let bValue = b[sortConfig.key];

  //     // Handle amount sorting (remove currency symbols)
  //     if (sortConfig.key === 'amount') {
  //       aValue = parseFloat(aValue.toString().replace(/[^\d.-]/g, ''));
  //       bValue = parseFloat(bValue.toString().replace(/[^\d.-]/g, ''));
  //     }

  //     if (aValue < bValue) {
  //       return sortConfig.direction === 'asc' ? -1 : 1;
  //     }
  //     if (aValue > bValue) {
  //       return sortConfig.direction === 'asc' ? 1 : -1;
  //     }
  //     return 0;
  //   });
  // }

  //   return filtered;
  // };

  // Apply sorting to payments
  // const getSortedPayments = () => {
  //   console.log('=== GET SORTED PAYMENTS DEBUG ===');
  //   console.log('Input payments array:', payments);
  //   console.log('Payments length:', payments.length);
  //   console.log('Sort config:', sortConfig);

  //   if (!sortConfig.key) {
  //     console.log('No sort config, returning payments as is');
  //     return payments;
  //   }

  //   const sorted = [...payments].sort((a, b) => {
  //     let aValue = a[sortConfig.key];
  //     let bValue = b[sortConfig.key];

  //     // Handle payment_id sorting (convert to number for proper sorting)
  //     if (sortConfig.key === 'payment_id') {
  //       aValue = parseInt(aValue) || 0;
  //       bValue = parseInt(bValue) || 0;
  //     }

  //     // Handle amount sorting (remove currency symbols)
  //     if (sortConfig.key === 'amount') {
  //       aValue = parseFloat(aValue.toString().replace(/[^\d.-]/g, ''));
  //       bValue = parseFloat(bValue.toString().replace(/[^\d.-]/g, ''));
  //     }

  //     if (aValue < bValue) {
  //       return sortConfig.direction === 'asc' ? -1 : 1;
  //     }
  //     if (aValue > bValue) {
  //       return sortConfig.direction === 'asc' ? 1 : -1;
  //     }
  //     return 0;
  //   });

  //   console.log('Sorted payments:', sorted);
  //   console.log('Sorted length:', sorted.length);
  //   console.log('=== END GET SORTED PAYMENTS DEBUG ===');
  //   return sorted;
  // };

  // Apply sorting to payments
  const filteredPayments = payments;

  // Calculate statistics from payments data
  const calculateStatistics = useMemo(() => {
    if (!payments || payments.length === 0) {
      return {
        totalUnits: 0,
        totalCollectable: 0,
        totalPaid: 0,
        totalDue: 0,
        overdue: 0,
        penalties: 0,
        waived: 0,
        advance: 0
      };
    }

    let stats = {
      totalUnits: 0,
      totalCollectable: 0,
      totalPaid: 0,
      totalDue: 0,
      overdue: 0,
      penalties: 0,
      waived: 0,
      advance: 0
    };

    // Use Set to track unique units for advance calculations
    const uniqueUnits = new Set();
    const processedAdvanceUnits = new Set(); // To avoid double-counting advance per unit/account holder

    payments.forEach((payment) => {
      // Count unique units
      if (payment.unit_id) {
        uniqueUnits.add(payment.unit_id);
      }

      // Calculate amounts
      const originalAmount = parseFloat(payment.original_amount || 0);
      const paidAmount = parseFloat(payment.paid_amount || 0);
      const waivedAmount = parseFloat(payment.waived_amount || 0);
      const advanceAmount = parseFloat(payment.advance_amount || 0);
      const unitTotalAdvance = parseFloat(payment.unit_total_advance || payment.advance_balance || 0);
      const billCategoryAmount = parseFloat(payment.bill_category_amount || 0);

      // Parse service_fee_items if available
      let serviceFeeItemsTotal = 0;
      let actualGrossPenalty = 0;
      if (payment.service_fee_items) {
        try {
          let serviceFeeItems = [];
          if (typeof payment.service_fee_items === 'string') {
            serviceFeeItems = JSON.parse(payment.service_fee_items);
          } else if (Array.isArray(payment.service_fee_items)) {
            serviceFeeItems = [...payment.service_fee_items];
          }

          // Calculate base total (excluding penalties)
          serviceFeeItemsTotal = serviceFeeItems
            .filter(item => item.item_type !== 'penalty')
            .reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

          // Get actual gross penalty from the items breakdown
          const penaltyItem = serviceFeeItems.find(item => item.item_type === 'penalty');
          if (penaltyItem) {
            actualGrossPenalty = parseFloat(penaltyItem.amount || 0);
          }
        } catch (e) {
          console.error('Error parsing service_fee_items:', e);
        }
      }

      // Penalty amount that should be charged
      // If we found it in service_fee_items, use that; otherwise fallback to gross_penalty_amount or penalty_amount
      const grossPenaltyAmount = actualGrossPenalty > 0
        ? actualGrossPenalty
        : parseFloat(payment.gross_penalty_amount || payment.penalty_amount || 0);

      // Waived amount (reduced from penalties)
      stats.waived += waivedAmount;

      // Total collectable = base amounts + penalties that are not waived
      // If service_fee_items available, use it; otherwise use original_amount + bill_category_amount
      const baseAmount = serviceFeeItemsTotal > 0 ? serviceFeeItemsTotal : (originalAmount + billCategoryAmount);

      // Penalty amount that should be charged (after waiving if applicable)
      const chargeablePenalty = Math.max(0, grossPenaltyAmount - waivedAmount);

      // Total collectable = base + charged penalties
      const totalBilled = baseAmount + chargeablePenalty;
      stats.totalCollectable += totalBilled;

      // Advance amount - Only add ONCE per unit/account holder combination (Total Pool)
      // because unit_total_advance is repeated for every service period row
      const advanceKey = `${payment.unit_id}-${payment.account_holder_type}-${payment.account_holder_id}`;
      if (!processedAdvanceUnits.has(advanceKey)) {
        stats.advance += unitTotalAdvance;
        processedAdvanceUnits.add(advanceKey);
      }

      // Penalties (use gross penalty amount - before waiving)
      stats.penalties += grossPenaltyAmount;

      // Update Total Paid
      stats.totalPaid += paidAmount;

      // Calculate balance due for this item
      const balanceDue = Math.max(0, totalBilled - paidAmount);



      // Check if overdue based on service_status
      const status = payment.service_status?.toLowerCase();
      if (status === 'overdue') {
        // Bucket 1: Overdue items
        stats.overdue += balanceDue;
      } else if (status === 'due' || status === 'partial') {
        // Bucket 2: Current Due items (not yet overdue)
        stats.totalDue += balanceDue;
      }
    });

    stats.totalUnits = uniqueUnits.size;

    return stats;
  }, [payments]);

  // Format currency for display (full numbers with commas)
  const formatCurrency = (amount) => {
    return `৳${(amount || 0).toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Debug logging
  // console.log('filteredPayments:', filteredPayments);
  // console.log('filteredPayments length:', filteredPayments.length);

  // Get button text and color based on selected items - recalculate when selection changes
  const buttonConfig = useMemo(() => {
    if (!selectedPayments || selectedPayments.length === 0) {
      return {
        text: 'Generate Service Fees',
        color: 'bg-green-600 hover:bg-green-700',
        title: 'Please select at least one unit'
      };
    }

    const firstStatus = selectedPayments[0]?.generation_status;
    const isGenerated = firstStatus === 'Generated';

    if (isGenerated) {
      return {
        text: 'Re-Generate Service Fees',
        color: 'bg-orange-600 hover:bg-orange-700',
        title: 'Re-generate selected service fees'
      };
    } else {
      return {
        text: 'Generate Service Fees',
        color: 'bg-green-600 hover:bg-green-700',
        title: 'Generate selected service fees'
      };
    }
  }, [selectedPayments]);

  // Get search suggestions
  // const getSearchSuggestions = () => {
  //   if (searchQuery.length === 0) return [];
  //   // Use backend data for suggestions
  //   return payments.slice(0, 5).map(payment => ({
  //     type: 'resident',
  //     value: payment.resident_name,
  //     label: `Resident: ${payment.resident_name}`
  //   }));
  // };

  // const searchSuggestions = getSearchSuggestions();

  // const handleSuggestionClick = (suggestion) => {
  //   setSearchQuery(suggestion.value);
  //   setShowSearchDropdown(false);
  // };

  // Show error message if there's an error
  // if (error) {
  //   return (
  //     <div className="min-h-screen bg-gray-50 p-6">
  //       <div className="bg-white shadow-lg border border-gray-200 rounded-lg p-6">
  //         <div className="text-center py-12">
  //           <div className="text-red-500 text-lg font-medium mb-2">Error Loading Payments</div>
  //           <div className="text-gray-600 mb-4">{error.message || 'Something went wrong while loading payments.'}</div>
  //           <button
  //             onClick={() => window.location.reload()}
  //             className="bg-primary text-white px-4 py-2 rounded-md hover:bg-[#34877A] transition-colors"
  //           >
  //             Retry
  //           </button>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <PageContainer>
      <ContentBox>
        <div className="mb-4">
          <Heading title="Service Fees Payments" size="2xl" color="black" />
        </div>
        {/* Tab Selection Section - Now at the top */}
        <div className="border-b border-gray-200">
          <div className="flex items-center gap-2">
            {/* Unit Outstanding List Tab */}
            {canViewOutstanding && (
              <button
                onClick={() => setActiveTab('outstanding')}
                className={`flex items-center gap-2 px-6 py-3 border-t-2 border-x-2 rounded-t-xl transition-all font-semibold ${activeTab === 'outstanding'
                  ? 'border-teal-500 bg-white text-gray-900 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]'
                  : 'border-transparent bg-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                <FaList className={`w-5 h-5 ${activeTab === 'outstanding' ? 'text-teal-600' : 'text-gray-400'}`} />
                Service Fee Payments
              </button>
            )}

            {/* Payment History Tab */}
            {canViewPaymentHistory && (
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-6 py-3 border-t-2 border-x-2 rounded-t-xl transition-all font-semibold ${activeTab === 'history'
                  ? 'border-teal-500 bg-white text-teal-600 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]'
                  : 'border-transparent bg-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                <FaClock className={`w-4 h-4 ${activeTab === 'history' ? 'text-teal-600' : 'text-gray-400'}`} />
                Payment History
              </button>
            )}
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'outstanding' ? (
          canViewOutstanding && (
            <div className="pt-6">
              {/* Filters - Only in Outstanding Tab */}
              <FilterControls
                key="outstanding-filters"
                searchQuery={searchQueryOutstanding}
                servicePeriod={servicePeriod}
                generateMonth={generateMonth}
                selectedTowers={selectedTowers}
                selectedStatuses={selectedStatuses}
                selectedMethods={selectedMethods}
                selectedServiceFees={selectedServiceFees}
                onChange={handleFilterChange}
                onClearAll={handleClearAllFilters}
                onFilter={() => { }}
                onGenerate={executeGeneration}
              />

              {/* Summary Cards Section - Only in Outstanding Tab */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 mb-6">
                {/* Total Units */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FaBuilding className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Total Units</p>
                      <p className="text-2xl font-bold text-gray-900">{calculateStatistics.totalUnits}</p>
                    </div>
                  </div>
                </div>

                {/* Total Collectable */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-600/60 rounded-lg">
                      <FaDollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Total Collectable</p>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(calculateStatistics.totalCollectable)}</p>
                    </div>
                  </div>
                </div>

                {/* Total Paid */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <FaCheckCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Total Paid</p>
                      <p className="text-2xl font-bold text-emerald-600">{formatCurrency(calculateStatistics.totalPaid)}</p>
                    </div>
                  </div>
                </div>

                {/* Total Due */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <FaClock className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Total Due</p>
                      <p className="text-2xl font-bold text-indigo-600">{formatCurrency(calculateStatistics.totalDue)}</p>
                    </div>
                  </div>
                </div>

                {/* Overdue */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <FaExclamationCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Total Overdue</p>
                      <p className="text-2xl font-bold text-red-600">{formatCurrency(calculateStatistics.overdue)}</p>
                    </div>
                  </div>
                </div>

                {/* Penalties */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <FaChartLine className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Penalties</p>
                      <p className="text-2xl font-bold text-orange-600">{formatCurrency(calculateStatistics.penalties)}</p>
                    </div>
                  </div>
                </div>

                {/* Waived */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <FaGift className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Waived</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(calculateStatistics.waived)}</p>
                    </div>
                  </div>
                </div>

                {/* Advance */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FaMoneyBillWave className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Advance</p>
                      <p className="text-2xl font-bold text-blue-600">{formatCurrency(calculateStatistics.advance)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-4">View and manage service fee bills for all units</p>

              {/* Service Fee Payments Table */}
              <div>
                {showSkeleton || residentsLoading ? (
                  <div className="flex justify-center items-center py-12">
                    <TableSkeleton rows={10} columns={9} />
                  </div>
                ) : (
                  <PaymentTable
                    payments={filteredPayments}
                    onViewReceipt={handleViewReceipt}
                    onRecordPayment={canRecordPayment ? handleRecordPayment : null}
                    onDeletePayment={handleDeletePayment}
                    selectedPayments={selectedPayments}
                    onSelectPayment={handleSelectPayment}
                    onSelectAll={handleSelectAll}
                  />
                )}
              </div>
            </div>
          )
        ) : (
          canViewPaymentHistory && (
            <div className="pt-6">
              {/* Payment History Specific Filters */}
              <PaymentHistoryFilters
                key="history-filters"
                searchQuery={searchQueryHistory}
                selectedTowers={selectedTowers}
                selectedMethods={selectedMethods}
                selectedUnits={selectedUnits}
                minAmount={minAmount}
                maxAmount={maxAmount}
                advanceFilter={advanceFilter}
                onChange={(filterType, value) => {
                  if (filterType === 'minAmount') setMinAmount(value);
                  else if (filterType === 'maxAmount') setMaxAmount(value);
                  else if (filterType === 'advanceFilter') setAdvanceFilter(value);
                  else if (filterType === 'selectedUnits') setSelectedUnits(value);
                  else handleFilterChange(filterType, value);
                }}
                onClearAll={() => {
                  handleClearAllFilters();
                  setMinAmount('');
                  setMaxAmount('');
                  setAdvanceFilter('all');
                  setSelectedUnits([]);
                }}
                totalCount={paymentHistory.length}
              />

              {/* Payment History Content */}
              <p className="text-sm text-gray-600 mb-4 mt-6">View all recorded payments and download receipts</p>

              {historyLoading ? (
                <div className="flex justify-center items-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
                </div>
              ) : (
                <PaymentHistoryList
                  history={paymentHistory}
                  onViewReceipt={handleViewReceipt}
                  onDownload={handleDownloadReceipt}
                />
              )}
            </div>
          )
        )}
      </ContentBox>

      {/* Modals - Outside Card */}
      <ViewReceiptModal
        isOpen={showViewReceiptModal}
        onClose={() => {
          setShowViewReceiptModal(false);
          setSelectedPaymentForReceipt(null);
        }}
        payment={selectedPaymentForReceipt}
      />

      <RecordPaymentModal
        isOpen={showRecordPaymentModal}
        onClose={() => {
          setShowRecordPaymentModal(false);
          setSelectedPaymentForAction(null);
        }}
        payment={selectedPaymentForAction}
        onSuccess={handlePaymentSuccess}
      />

      {/* Bill Detail Modal - Replaces PaymentHistoryModal */}
      {
        showPaymentHistoryModal && selectedPaymentForHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl w-[95vw] max-h-[95vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Bill Details</h2>
                <button
                  onClick={() => {
                    setShowPaymentHistoryModal(false);
                    setSelectedPaymentForHistory(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>
              <div className="p-6">
                <BillDetailView
                  bill={selectedPaymentForHistory}
                  onBack={() => {
                    setShowPaymentHistoryModal(false);
                    setSelectedPaymentForHistory(null);
                  }}
                />
              </div>
            </div>
          </div>
        )
      }

      {/* Confirmation Modal for Delete */}
      {
        showConfirmation && (
          <ConfirmationMessageBox
            message={deleteMessage}
            onConfirm={paymentToDelete ? handleDeletePaymentConfirmed : () => {
              setShowConfirmation(false);
              setDeleteMessage('');
              setPaymentToDelete(null);
              setIsDeleteSuccess(false);
            }}
            onCancel={() => {
              if (!isGenerating) {
                setShowConfirmation(false);
                setPaymentToDelete(null);
                setDeleteMessage('');
                setIsDeleteSuccess(false);
              }
            }}
            confirmText={paymentToDelete ? "Delete" : "OK"}
            showCancel={paymentToDelete !== null && !isGenerating}
            isLoading={isGenerating}
            isSuccess={isDeleteSuccess}
          />
        )
      }

      {/* Confirmation Modal for Generate Service Fee */}
      {
        showGenerateConfirmation && (
          <ConfirmationMessageBox
            message={generateConfirmMessage}
            onConfirm={handleConfirmedGenerate}
            onCancel={handleCancelGenerate}
          />
        )
      }

      {/* Success/Error Message Box */}
      {
        (deleteSuccess || deleteError) && (
          <MessageBox
            message={deleteSuccess ? "Payment has been deleted successfully." : deleteError}
            clearMessage={() => dispatch(clearSuccessStates())}
            onOk={() => {
              dispatch(clearSuccessStates());
            }}
          />
        )
      }

      {/* Generate Service Fee Message */}
      {
        generateMessage && (
          <MessageBox
            message={!generateError ? generateMessage : null}
            error={generateError ? generateMessage : null}
            clearMessage={() => {
              setGenerateMessage('');
              setGenerateError(false);
            }}
            onOk={() => {
              setGenerateMessage('');
              setGenerateError(false);
            }}
          />
        )
      }

      {/* Delete Error Message Box */}
      {
        deleteMessage && generateError && (
          <MessageBox
            error={deleteMessage}
            clearMessage={() => {
              setDeleteMessage('');
              setGenerateError(false);
            }}
            onOk={() => {
              setDeleteMessage('');
              setGenerateError(false);
            }}
          />
        )
      }
    </PageContainer >
  );
};

export default PaymentsTable;
