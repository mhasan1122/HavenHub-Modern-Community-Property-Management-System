import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaDownload, FaPrint, FaFilter, FaArrowLeft, FaSearch, FaHistory } from "react-icons/fa";
import { FaCaretDown, FaTrash } from 'react-icons/fa6';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ModernLoadingAnimation from '../../../../../Components/Loaders/ModernLoadingAnimation';
import TableSkeleton from '../../../../../Components/Loaders/TableSkeleton';
import { fetchPaymentHistory, fetchFilterOptions, deleteBillingTransaction } from '../../../../../redux/slices/api/serviceFeeManagement/serviceFeeManagementApi';
import { clearAllStates, clearErrors } from '../../../../../redux/slices/serviceFeeManagement/serviceFeeManagementSlice';
import ViewReceiptModal from '../../../components/ViewReceiptModal';
import MonthYearPicker from '../../../components/MonthYearPicker';
import * as XLSX from 'xlsx';
import Button from '../../../../../Components/FormComponent/ButtonComponent/Button';
import FilterButton from '../../../../../Components/FormComponent/ButtonComponent/FilterButton';
import PageContainer from '../../../../../Components/Ui/PageContainer';
import ContentBox from '../../../../../Components/Ui/ContentBox';
import ConfirmationMessageBox from '../../../../../Components/MessageBox/ConfirmationMessageBox';
import MessageBox from '../../../../../Components/MessageBox/MessageBox';
import EmptyState from '../../../../../Components/Ui/EmptyState';

const UnitPaymentHistoryPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { unitId, residentId } = useParams();

  // Check if navigated from Overview page via tabs
  const showBackButton = location.state?.fromOverview === true;

  // Redux state
  const serviceFeeState = useSelector(state => state.serviceFeeManagement) || {};
  const {
    paymentHistory: payments = [],
    paymentHistoryLoading: residentsLoading = false,
    paymentHistoryError: error = null,
    filterOptions = { towers: [], status_options: [], payment_methods: [] },
    filterOptionsLoading = false,
    paymentLoading = false,
    paymentError = null,
    paymentSuccess = false,
    paymentMessage = ''
  } = serviceFeeState;

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      // 1. Basic filter for paid items (original logic)
      if (!(p.service_status === 'paid' || p.paid_amount > 0)) return false;

      // 2. Status Filter
      if (selectedStatuses.length > 0) {
        if (!selectedStatuses.includes(p.service_status)) return false;
      }

      // 3. Service Period Filter (Range) - Client side
      if (servicePeriodFrom && servicePeriodTo && p.service_period_year && p.service_period_month) {
        const pDate = Number(p.service_period_year) * 100 + Number(p.service_period_month);
        const fromDate = Number(servicePeriodFrom.year) * 100 + Number(servicePeriodFrom.month);
        const toDate = Number(servicePeriodTo.year) * 100 + Number(servicePeriodTo.month);

        if (pDate < fromDate || pDate > toDate) return false;
      }

      return true;
    });
  }, [payments, selectedStatuses, servicePeriodFrom, servicePeriodTo]);

  // Only show loading animation on initial window load
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Get current month and year for service period
  const getCurrentServicePeriod = () => {
    const today = new Date();
    return {
      year: today.getFullYear(),
      month: today.getMonth() + 1
    };
  };

  const currentServicePeriod = getCurrentServicePeriod();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTower, setSelectedTower] = useState('All Towers');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [selectedMethod, setSelectedMethod] = useState('All Methods');
  const [selectedTowers, setSelectedTowers] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedMethods, setSelectedMethods] = useState([]);
  const [servicePeriodFrom, setServicePeriodFrom] = useState(currentServicePeriod);
  const [servicePeriodTo, setServicePeriodTo] = useState(currentServicePeriod);
  const [isFilterExpanded, setIsFilterExpanded] = useState(true); // Show filters by default
  const [showViewReceiptModal, setShowViewReceiptModal] = useState(false);

  // State for dropdown visibility
  const [showTowerDropdown, setShowTowerDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showMethodDropdown, setShowMethodDropdown] = useState(false);

  // Local state for temporary selections (before Done is clicked)
  const [tempSelectedTowers, setTempSelectedTowers] = useState([]);
  const [tempSelectedStatuses, setTempSelectedStatuses] = useState([]);
  const [tempSelectedMethods, setTempSelectedMethods] = useState([]);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  // State for delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);
  // State for success/error message box
  const [showSuccessBox, setShowSuccessBox] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showErrorBox, setShowErrorBox] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset to page 1 when payments list changes
  useEffect(() => {
    setCurrentPage(1);
  }, [payments]);

  // Sort payments
  const sortedPayments = useMemo(() => {
    if (!sortConfig.key) return filteredPayments;

    return [...filteredPayments].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle numeric values
      if (['paid_amount', 'fee_amount', 'original_amount', 'service_fee_amount', 'penalty_amount', 'waived_amount', 'bill_category_amount'].includes(sortConfig.key)) {
        aValue = parseFloat(aValue || 0);
        bValue = parseFloat(bValue || 0);
      } else {
        // String comparison
        aValue = String(aValue || '').toLowerCase();
        bValue = String(bValue || '').toLowerCase();
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [filteredPayments, sortConfig]);

  // Pagination calculations
  const totalPages = Math.ceil((sortedPayments?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPayments = sortedPayments?.slice(startIndex, endIndex) || [];

  // Get selected service period display (using from period for title)
  const getSelectedServicePeriod = () => {
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    if (servicePeriodFrom && servicePeriodTo) {
      if (servicePeriodFrom.year === servicePeriodTo.year && servicePeriodFrom.month === servicePeriodTo.month) {
        return `${monthNames[servicePeriodFrom.month - 1]} ${servicePeriodFrom.year} `;
      } else {
        return `${monthNames[servicePeriodFrom.month - 1]} ${servicePeriodFrom.year} - ${monthNames[servicePeriodTo.month - 1]} ${servicePeriodTo.year} `;
      }
    }
    return `${monthNames[servicePeriodFrom?.month - 1 || 0]} ${servicePeriodFrom?.year || new Date().getFullYear()} `;
  };

  useEffect(() => {
    // Clear any previous errors
    dispatch(clearAllStates());

    // Fetch filter options first
    dispatch(fetchFilterOptions());
  }, [dispatch]);

  // Initialize page loading
  useEffect(() => {
    const initializePage = async () => {
      // Clear any previous errors
      dispatch(clearErrors());

      // Fetch payment history
      const params = {};
      if (unitId) {
        params.unit_id = unitId;
      }

      // Add more filters if present
      if (selectedTowers && selectedTowers.length > 0) {
        params.tower_ids = selectedTowers;
      }

      if (searchQuery) {
        params.search = searchQuery;
      }

      await dispatch(fetchPaymentHistory(params));
    };

    initializePage();
  }, [dispatch, unitId, selectedTowers, searchQuery]);

  // Handle initial load completion
  useEffect(() => {
    if (!residentsLoading && payments) {
      setIsInitialLoad(false);
    }
  }, [residentsLoading, payments]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.relative')) {
        setShowTowerDropdown(false);
        setShowStatusDropdown(false);
        setShowMethodDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleFilterChange = (filterType, value) => {
    console.log('Filter change:', filterType, value);
    switch (filterType) {
      case 'searchQuery':
        setSearchQuery(value);
        break;
      case 'servicePeriodFrom':
        setServicePeriodFrom(value);
        break;
      case 'servicePeriodTo':
        setServicePeriodTo(value);
        break;
      case 'selectedTower':
      case 'tower':
        setSelectedTower(value);
        break;
      case 'selectedStatus':
      case 'status':
        setSelectedStatus(value);
        break;
      case 'selectedMethod':
      case 'method':
        setSelectedMethod(value);
        break;
      case 'selectedTowers':
        setSelectedTowers(value);
        break;
      case 'selectedStatuses':
        setSelectedStatuses(value);
        break;
      case 'selectedMethods':
        setSelectedMethods(value);
        break;
      default:
        break;
    }
  };

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setSelectedTower('All Towers');
    setSelectedStatus('All Status');
    setSelectedMethod('All Methods');
    setSelectedTowers([]);
    setSelectedStatuses([]);
    setSelectedMethods([]);
    // Reset to current service period
    const currentPeriod = getCurrentServicePeriod();
    setServicePeriodFrom(currentPeriod);
    setServicePeriodTo(currentPeriod);
  };

  // Handle checkbox changes (temporary state)
  const handleCheckboxChange = (filterType, value, isChecked) => {
    let currentSelected = [];
    let setter = null;

    switch (filterType) {
      case 'tower':
        currentSelected = [...tempSelectedTowers];
        setter = setTempSelectedTowers;
        break;
      case 'status':
        currentSelected = [...tempSelectedStatuses];
        setter = setTempSelectedStatuses;
        break;
      case 'method':
        currentSelected = [...tempSelectedMethods];
        setter = setTempSelectedMethods;
        break;
      default:
        return;
    }

    if (isChecked) {
      currentSelected.push(value);
    } else {
      currentSelected = currentSelected.filter(item => item !== value);
    }

    setter(currentSelected);
  };

  // Handle "Select All" functionality (temporary state)
  const handleSelectAll = (filterType, allOptions) => {
    let currentSelected = [];
    let setter = null;

    switch (filterType) {
      case 'tower':
        currentSelected = tempSelectedTowers;
        setter = setTempSelectedTowers;
        break;
      case 'status':
        currentSelected = tempSelectedStatuses;
        setter = setTempSelectedStatuses;
        break;
      case 'method':
        currentSelected = tempSelectedMethods;
        setter = setTempSelectedMethods;
        break;
      default:
        return;
    }

    // If all are selected, deselect all. Otherwise, select all
    const allValues = allOptions.map(option => option.value);
    const newSelected = currentSelected.length === allValues.length ? [] : allValues;
    setter(newSelected);
  };

  // Check if all options are selected (temporary state)
  const isAllSelected = (filterType, allOptions) => {
    let currentSelected = [];

    switch (filterType) {
      case 'tower':
        currentSelected = tempSelectedTowers;
        break;
      case 'status':
        currentSelected = tempSelectedStatuses;
        break;
      case 'method':
        currentSelected = tempSelectedMethods;
        break;
      default:
        return false;
    }

    const allValues = allOptions?.map(option => option.value) || [];
    return allValues.length > 0 && currentSelected.length === allValues.length;
  };

  // Get display text for filter buttons - Always show placeholder with count
  const getDisplayText = (selectedItems, defaultText) => {
    const count = selectedItems.length;
    if (count > 0) {
      return `${defaultText} (${count})`;
    }
    return defaultText; // Always show placeholder, never show selected values
  };

  // Handle Done button click - Apply temporary selections and call API
  const handleDone = (filterType) => {
    let setterKey = '';
    let tempSelected = [];

    switch (filterType) {
      case 'tower':
        setterKey = 'selectedTowers';
        tempSelected = tempSelectedTowers;
        setShowTowerDropdown(false);
        break;
      case 'status':
        setterKey = 'selectedStatuses';
        tempSelected = tempSelectedStatuses;
        setShowStatusDropdown(false);
        break;
      case 'method':
        setterKey = 'selectedMethods';
        tempSelected = tempSelectedMethods;
        setShowMethodDropdown(false);
        break;
      default:
        return;
    }

    handleFilterChange(setterKey, tempSelected);
  };

  // Handle Clear button click - Clear all selections and call API
  const handleClear = (filterType) => {
    let setterKey = '';

    switch (filterType) {
      case 'tower':
        setterKey = 'selectedTowers';
        setTempSelectedTowers([]);
        setShowTowerDropdown(false);
        break;
      case 'status':
        setterKey = 'selectedStatuses';
        setTempSelectedStatuses([]);
        setShowStatusDropdown(false);
        break;
      case 'method':
        setterKey = 'selectedMethods';
        setTempSelectedMethods([]);
        setShowMethodDropdown(false);
        break;
      default:
        return;
    }

    handleFilterChange(setterKey, []);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Helper function to handle null/undefined values
  const getDisplayValue = (value, fallback = 'N/A') => {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }
    return value;
  };

  const formatCurrency = (value, currencySymbol = 'Tk') => {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
      return `${currencySymbol} 0.00`;
    }
    return `${currencySymbol} ${numericValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
      } `;
  };

  // Helper function to format dates safely
  const formatDate = (dateValue) => {
    if (!dateValue || dateValue === '1970-01-01T00:00:00Z' || dateValue === '1970-01-01') {
      return 'N/A';
    }
    try {
      const date = new Date(dateValue);
      const day = String(date.getDate()).padStart(2, '0');
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${day} -${month} -${year} `;
    } catch {
      return 'N/A';
    }
  };

  // Helper function to format service month as "monthname(year)"
  const formatServiceMonth = (dateValue) => {
    if (!dateValue || dateValue === '1970-01-01T00:00:00Z' || dateValue === '1970-01-01') {
      return 'N/A';
    }
    try {
      const date = new Date(dateValue);
      const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${month} ${year} `;
    } catch {
      return 'N/A';
    }
  };

  const handleViewReceipt = (payment) => {
    setSelectedPaymentForReceipt(payment);
    setShowViewReceiptModal(true);
  };

  const handleExport = () => {
    try {
      if (!filteredPayments || filteredPayments.length === 0) {
        alert("No data to export");
        return;
      }

      // Prepare data for Excel export - matching screen table columns exactly
      const exportData = filteredPayments.map((payment, index) => {
        // Extract bill category amount
        let billCategoryAmount = 0;
        if (payment.bill_category_details) {
          try {
            let billDetails;
            if (typeof payment.bill_category_details === 'string') {
              billDetails = JSON.parse(payment.bill_category_details);
            } else {
              billDetails = payment.bill_category_details;
            }
            // If it's an array, sum all amounts
            if (Array.isArray(billDetails)) {
              billCategoryAmount = billDetails.reduce((sum, item) => {
                return sum + parseFloat(item.total_amount || item.amount || 0);
              }, 0);
            } else {
              billCategoryAmount = parseFloat(billDetails.total_amount || 0);
            }
          } catch (e) {
            billCategoryAmount = 0;
          }
        }

        return {
          '#': index + 1,
          'Tower': getDisplayValue(payment.tower_name),
          'Unit': getDisplayValue(payment.unit_display),
          'Resident Name': getDisplayValue(payment.primary_name),
          'Contact': getDisplayValue(payment.primary_number),
          'Service Fee': `৳ ${getDisplayValue(payment.fee_amount || payment.original_amount || payment.service_fee_amount, '0')} `,
          'Bill Category': `৳ ${getDisplayValue(billCategoryAmount, '0')} `,
          'Penalty': `৳ ${getDisplayValue(payment.penalty_amount, '0')} `,
          'Waived': `৳ ${getDisplayValue(payment.waived_amount, '0')} `,
          'Paid Amount': `৳ ${getDisplayValue(payment.paid_amount, '0')} `,
          'Service Month': formatServiceMonth(payment.service_month),
          'Payment Method': getDisplayValue(payment.payment_method),
          'Payment Date': formatDate(payment.payment_date),
          'Status': getDisplayValue(payment.service_status?.charAt(0).toUpperCase() + payment.service_status?.slice(1))
        };
      });

      // Add totals row
      exportData.push({
        '#': '',
        'Tower': '',
        'Unit': '',
        'Resident Name': '',
        'Contact': 'Total:',
        'Service Fee': `৳ ${Number(calculatedStats.totalFeeAmount || 0).toLocaleString()} `,
        'Bill Category': `৳ ${Number(calculatedStats.totalBillCategoryAmount || 0).toLocaleString()} `,
        'Penalty': `৳ ${Number(calculatedStats.totalPenaltyAmount || 0).toLocaleString()} `,
        'Waived': `৳ ${Number(calculatedStats.totalWaivedAmount || 0).toLocaleString()} `,
        'Paid Amount': `৳ ${Number(calculatedStats.totalPaidAmount || 0).toLocaleString()} `,
        'Service Month': '',
        'Payment Method': '',
        'Payment Date': '',
        'Status': ''
      });

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 5 },   // #
        { wch: 15 },  // Tower
        { wch: 12 },  // Unit
        { wch: 20 },  // Resident Name
        { wch: 15 },  // Contact
        { wch: 15 },  // Service Fee
        { wch: 15 },  // Paid Amount
        { wch: 18 },  // Service Month
        { wch: 15 },  // Payment Method
        { wch: 15 },  // Payment Date
        { wch: 12 }   // Status
      ];
      ws['!cols'] = colWidths;

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Unit Payment History');

      // Generate filename
      const filename = `Unit_Payment_History_${getSelectedServicePeriod().replace(/\s+/g, '_').replace(/[-]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      console.log('Excel file exported successfully:', filename);

    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert("Error exporting data to Excel. Please try again.");
    }
  };

  const handlePrint = () => {
    if (!filteredPayments || filteredPayments.length === 0) {
      alert("No data to print");
      return;
    }

    // Create print-friendly content
    const printContent = `
  < html >
        <head>
          <title>Unit Payment History - ${getSelectedServicePeriod()}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
            .header { text-align: center; margin-bottom: 30px; }
            .company-name { font-size: 24px; font-weight: bold; color: #3D9D9B; margin-bottom: 10px; }
            .report-title { font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 5px; }
            .period { font-size: 14px; color: #6B7280; margin-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #E5E7EB; padding: 8px; text-align: left; }
            th { background-color: #EBF5F5; font-weight: bold; color: #000; }
            @media print {
              body { margin: 0; }
              table { font-size: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">Estate Link</div>
            <div class="report-title">Unit Payment History</div>
            <div class="period">${getSelectedServicePeriod()}</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Tower</th>
                <th>Unit</th>
                <th>Resident Name</th>
                <th>Contact</th>
                <th>Service Fee</th>
                <th>Additional Charges</th>
                <th>Penalty</th>
                <th>Waived</th>
                <th>Paid Amount</th>
                <th>Service Month</th>
                <th>Payment Method</th>
                <th>Payment Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredPayments.map((payment, index) => {
      // Extract bill category amount (service_fee_items first, then bill_category_details)
      let billCategoryAmount = 0;
      if (payment.service_fee_items) {
        try {
          let items;
          if (typeof payment.service_fee_items === 'string') {
            items = JSON.parse(payment.service_fee_items);
          } else {
            items = payment.service_fee_items;
          }
          if (Array.isArray(items)) {
            billCategoryAmount = items.reduce((sum, item) => {
              if (item.item_type === 'bill_category') {
                return sum + parseFloat(item.amount || 0);
              }
              return sum;
            }, 0);
          }
        } catch (e) {
          billCategoryAmount = 0;
        }
      }
      if (!billCategoryAmount && payment.bill_category_details) {
        try {
          let billDetails;
          if (typeof payment.bill_category_details === 'string') {
            billDetails = JSON.parse(payment.bill_category_details);
          } else {
            billDetails = payment.bill_category_details;
          }
          if (Array.isArray(billDetails)) {
            billCategoryAmount = billDetails.reduce((sum, item) => {
              return sum + parseFloat(item.total_amount || item.amount || 0);
            }, 0);
          } else {
            billCategoryAmount = parseFloat(billDetails.total_amount || billDetails.amount || 0);
          }
        } catch (e) {
          billCategoryAmount = 0;
        }
      }
      return `
                <tr>
                  <td>${index + 1}</td>
                  <td>${getDisplayValue(payment.tower_name)}</td>
                  <td>${getDisplayValue(payment.unit_display)}</td>
                  <td>${getDisplayValue(payment.primary_name)}</td>
                  <td>${getDisplayValue(payment.primary_number)}</td>
                  <td>৳ ${getDisplayValue(payment.fee_amount || payment.original_amount || payment.service_fee_amount, '0')}</td>
                  <td>৳ ${getDisplayValue(billCategoryAmount, '0')}</td>
                  <td>৳ ${getDisplayValue(payment.penalty_amount, '0')}</td>
                  <td>৳ ${getDisplayValue(payment.waived_amount, '0')}</td>
                  <td>৳ ${getDisplayValue(payment.paid_amount, '0')}</td>
                  <td>${formatServiceMonth(payment.service_month)}</td>
                  <td>${getDisplayValue(payment.payment_method)}</td>
                  <td>${formatDate(payment.payment_date)}</td>
                  <td>${getDisplayValue(payment.service_status?.charAt(0).toUpperCase() + payment.service_status?.slice(1))}</td>
                </tr>
              `;
    }).join('')}
              <tr style="background-color: #EBF5F5; font-weight: bold;">
                <td colspan="5" style="text-align: right;">Total:</td>
                <td style="font-weight: bold;">৳ ${Number(calculatedStats.totalFeeAmount || 0).toLocaleString()}</td>
                <td style="font-weight: bold;">৳ ${Number(calculatedStats.totalBillCategoryAmount || 0).toLocaleString()}</td>
                <td style="font-weight: bold;">৳ ${Number(calculatedStats.totalPenaltyAmount || 0).toLocaleString()}</td>
                <td style="font-weight: bold;">৳ ${Number(calculatedStats.totalWaivedAmount || 0).toLocaleString()}</td>
                <td style="font-weight: bold;">৳ ${Number(calculatedStats.totalPaidAmount || 0).toLocaleString()}</td>
                <td colspan="4"></td>
              </tr>
            </tbody>
          </table>
          
          <div style="margin-top: 30px; text-align: center; color: #6B7280; font-size: 10px;">
            Generated on ${new Date().toLocaleString()}
          </div>
        </body>
      </html >
  `;

    // Open print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();

    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  // Calculate stats from payments in a single loop (grouped by unit/period)
  const calculateStats = () => {
    const stats = {
      totalPayments: 0,
      totalFeeAmount: 0,
      totalPaidAmount: 0,
      totalDueAmount: 0,
      totalPenaltyAmount: 0,
      totalWaivedAmount: 0,
      totalBillCategoryAmount: 0,
      completedCount: 0,
      completedAmount: 0,
      dueCount: 0,
      dueAmount: 0,
      partialCount: 0,
      partialAmount: 0,
      overdueCount: 0,
      overdueAmount: 0
    };

    // Track service periods with aggregated values
    const serviceFeePeriodMap = {};

    filteredPayments.forEach((payment) => {
      const unitId = payment.unit_id;
      const serviceFeeId = payment.service_fee_id;
      const month = payment.service_period_month;
      const year = payment.service_period_year;
      const feePeriodKey = `${unitId} -${month} -${year} -${serviceFeeId} `;

      // Extract amounts
      const feeAmount = parseFloat(payment.fee_amount || payment.original_amount || payment.service_fee_amount || 0);
      const penaltyAmount = parseFloat(payment.penalty_amount || 0);
      const waivedAmount = parseFloat(payment.waived_amount || 0);
      const paidAmount = parseFloat(payment.paid_amount || 0);

      // Extract bill category amount from service_fee_items first, then bill_category_details
      let billCategoryAmount = parseFloat(payment.bill_category_amount || 0);
      if (!billCategoryAmount && payment.service_fee_items) {
        try {
          let items;
          if (typeof payment.service_fee_items === 'string') {
            items = JSON.parse(payment.service_fee_items);
          } else {
            items = payment.service_fee_items;
          }
          if (Array.isArray(items)) {
            billCategoryAmount = items.reduce((sum, item) => {
              if (item.item_type === 'bill_category') {
                return sum + parseFloat(item.amount || 0);
              }
              return sum;
            }, 0);
          }
        } catch (e) {
          billCategoryAmount = 0;
        }
      }
      if (!billCategoryAmount && payment.bill_category_details) {
        try {
          let billDetails;
          if (typeof payment.bill_category_details === 'string') {
            billDetails = JSON.parse(payment.bill_category_details);
          } else {
            billDetails = payment.bill_category_details;
          }
          if (Array.isArray(billDetails)) {
            billCategoryAmount = billDetails.reduce((sum, item) => {
              return sum + parseFloat(item.total_amount || item.amount || 0);
            }, 0);
          } else if (billDetails && typeof billDetails === 'object') {
            billCategoryAmount = parseFloat(billDetails.total_amount || billDetails.amount || 0);
          }
        } catch (e) {
          billCategoryAmount = 0;
        }
      }

      // Count each billing transaction
      stats.totalPayments += 1;

      // Aggregate per service period (fee, penalty, bill only counted once)
      if (!serviceFeePeriodMap[feePeriodKey]) {
        serviceFeePeriodMap[feePeriodKey] = {
          fee: feeAmount,
          bill: billCategoryAmount,
          penalty: penaltyAmount,
          waived: 0,
          paid: 0,
          status: payment.service_status
        };
      }

      const period = serviceFeePeriodMap[feePeriodKey];
      period.waived += waivedAmount;
      period.paid += paidAmount;
      period.status = payment.service_status || period.status;
    });

    // Calculate aggregated stats from service periods
    Object.values(serviceFeePeriodMap).forEach((period) => {
      const totalBilled = period.fee + period.bill + period.penalty - period.waived;
      const outstanding = Math.max(0, totalBilled - period.paid);

      stats.totalFeeAmount += period.fee;
      stats.totalBillCategoryAmount += period.bill;
      stats.totalPenaltyAmount += period.penalty;
      stats.totalWaivedAmount += period.waived;
      stats.totalPaidAmount += period.paid;
      stats.totalDueAmount += outstanding;

      const paymentStatus = period.status;
      if (paymentStatus === 'paid') {
        stats.completedCount += 1;
        stats.completedAmount += period.paid;
      } else if (paymentStatus === 'overdue') {
        stats.overdueCount += 1;
        stats.overdueAmount += outstanding;
      } else if (paymentStatus === 'due') {
        stats.dueCount += 1;
        stats.dueAmount += outstanding;
      } else if (paymentStatus === 'partial') {
        stats.partialCount += 1;
        stats.partialAmount += outstanding;
      }
    });

    return stats;
  };

  const calculatedStats = calculateStats();
  // Show loading animation only on initial window load
  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ModernLoadingAnimation />
      </div>
    );
  }

  return (
    <PageContainer>
      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <ConfirmationMessageBox
          isOpen={showDeleteConfirm}
          title="Delete Payment Record?"
          message={paymentLoading ? "Deleting payment..." : "Are you sure you want to delete this payment record? This action cannot be undone."}
          onConfirm={async () => {
            if (paymentToDelete && (paymentToDelete.billing_id || paymentToDelete.billing_pk)) {
              try {
                const billingId = paymentToDelete.billing_id || paymentToDelete.billing_pk;
                const result = await dispatch(deleteBillingTransaction(billingId));

                if (deleteBillingTransaction.fulfilled.match(result)) {
                  setSuccessMessage(result.payload.message || "Payment transaction deleted successfully.");
                  setShowSuccessBox(true);
                  setShowDeleteConfirm(false);
                  setPaymentToDelete(null);
                } else if (deleteBillingTransaction.rejected.match(result)) {
                  // Extract error message from rejected action
                  const errorPayload = result.payload;
                  let errorMsg = "Failed to delete payment.";

                  if (typeof errorPayload === 'string') {
                    errorMsg = errorPayload;
                  } else if (errorPayload?.message) {
                    errorMsg = errorPayload.message;
                  } else if (errorPayload?.error) {
                    errorMsg = errorPayload.error;
                  } else if (result.error?.message) {
                    errorMsg = result.error.message;
                  }

                  setErrorMessage(errorMsg);
                  setShowErrorBox(true);
                  setShowDeleteConfirm(false);
                  setPaymentToDelete(null);
                } else {
                  setErrorMessage("Failed to delete payment.");
                  setShowErrorBox(true);
                  setShowDeleteConfirm(false);
                  setPaymentToDelete(null);
                }
              } catch (err) {
                const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to delete payment.";
                setErrorMessage(errorMsg);
                setShowErrorBox(true);
                setShowDeleteConfirm(false);
                setPaymentToDelete(null);
              }
            } else {
              setErrorMessage("Invalid payment record.");
              setShowErrorBox(true);
              setShowDeleteConfirm(false);
              setPaymentToDelete(null);
            }
          }}
          onCancel={() => {
            setShowDeleteConfirm(false);
            setPaymentToDelete(null);
          }}
        />
      )}

      {/* Success MessageBox */}
      {showSuccessBox && (
        <MessageBox
          message={successMessage}
          clearMessage={() => setShowSuccessBox(false)}
        />
      )}

      {/* Error MessageBox */}
      {showErrorBox && (
        <MessageBox
          error={errorMessage}
          clearMessage={() => setShowErrorBox(false)}
        />
      )}
      <ContentBox>
        {/* Header Section - Inside Card */}
        <div className="mb-3 md:sticky top-0 z-20 bg-white pb-4 md:backdrop-blur">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {showBackButton && (
                <button
                  onClick={() => navigate('/service-fee-overview')}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
                  title="Back to Overview"
                >
                  <FaArrowLeft size={20} />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl md:text-[28px] font-semibold text-gray-900 leading-tight">
                  Unit Payment History: <span className="font-medium text-primary">{getSelectedServicePeriod()}</span>
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  {unitId && `Unit ID: ${unitId} `} {residentId && ` | Resident ID: ${residentId} `}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto">
              <Button
                icon={FaDownload}
                variant="download"
                size="large"
                onClick={handleExport}
                disabled={!filteredPayments || filteredPayments.length === 0}
                iconSize="medium"
                tooltip="Excel"
                tooltipId="unit-payment-history-excel-tooltip"
              ></Button>
              <Button
                variant="download"
                size="large"
                icon={FaPrint}
                onClick={handlePrint}
                disabled={!filteredPayments || filteredPayments.length === 0}
                iconSize="medium"
                tooltip="Print"
                tooltipId="unit-payment-history-print-tooltip"
              ></Button>
              <FilterButton active={isFilterExpanded} onClick={() => setIsFilterExpanded(!isFilterExpanded)}>
                Filter
              </FilterButton>
            </div>
          </div>

          {/* Filters Section - Simplified Layout */}
          {isFilterExpanded && (
            <div className="mb-6 relative z-30">
              <div className="flex flex-col sm:flex-row gap-3 items-end w-full">
                {/* Tower Filter */}
                <div className="relative z-40 w-full sm:flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2 pl-1">
                    Select Tower
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTowerDropdown(!showTowerDropdown);
                      setTempSelectedTowers([...selectedTowers]);
                    }}
                    className={`w - full h - [42px] pl - 3 pr - 3 border rounded - md focus: outline - none text - sm text - primary bg - white flex items - center justify - between ${showTowerDropdown
                      ? '!border-primary !shadow-ring-primary'
                      : 'border-gray-300 focus:border-primary focus:shadow-ring-primary'
                      } `}
                  >
                    <span className="truncate">
                      {getDisplayText(selectedTowers, 'Select Towers')}
                    </span>
                    <FaCaretDown className="text-primary ml-2" />
                  </button>

                  {showTowerDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      <div className="sticky top-0 bg-white border-b border-gray-200 px-3 py-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={isAllSelected('tower', filterOptions?.towers)}
                            onChange={() => handleSelectAll('tower', filterOptions?.towers)}
                            className="mr-3 text-primary focus:ring-primary accent-primary rounded"
                          />
                          <span className="text-sm font-medium text-gray-700">Select All</span>
                        </label>
                      </div>

                      <div className="px-3 py-2">

                        {filterOptions?.towers?.map((tower) => (
                          <label key={tower.value} className="flex items-center py-1">
                            <input
                              type="checkbox"
                              checked={tempSelectedTowers.includes(tower.value)}
                              onChange={(e) => handleCheckboxChange('tower', tower.value, e.target.checked)}
                              className="mr-3 text-primary focus:ring-primary accent-primary rounded"
                            />
                            <span className="text-sm text-gray-700">{tower.label}</span>
                          </label>
                        ))}
                      </div>

                      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-3 py-2 flex justify-between">
                        <button
                          type="button"
                          onClick={() => handleClear('tower')}
                          className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDone('tower')}
                          className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primaryHoverAlt transition-colors"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Search Input */}
                <div className="w-full sm:flex-1 sm:min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-2 pl-1">
                    Search
                  </label>
                  <div className="flex items-center bg-white border border-gray-300 shadow-sm py-2 px-3 rounded-md focus-within:border-primary focus-within:shadow-ring-primary h-[42px]">
                    <FaSearch className="text-primary mr-2" />
                    <input
                      type="text"
                      placeholder="Search Residents, Contracts, units..."
                      value={searchQuery}
                      onChange={e => handleFilterChange('searchQuery', e.target.value)}
                      className="outline-none placeholder-[#3D9D9B] text-primary w-full text-sm"
                    />
                  </div>
                </div>

                {/* Service Period From Filter */}
                <div className="w-full sm:flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2 pl-1">
                    Service Period From
                  </label>
                  <MonthYearPicker
                    className={'text-primary'}
                    value={servicePeriodFrom}
                    onChange={(value) => handleFilterChange('servicePeriodFrom', value)}
                    hideLabel={true}
                  />
                </div>

                {/* Service Period To Filter */}
                <div className="w-full sm:flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2 pl-1">
                    Service Period To
                  </label>
                  <MonthYearPicker
                    className={'text-primary'}
                    value={servicePeriodTo}
                    onChange={(value) => handleFilterChange('servicePeriodTo', value)}
                    hideLabel={true}
                  />
                </div>

                {/* Status Filter */}
                <div className="relative z-40 w-full sm:flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2 pl-1">
                    Select Status
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStatusDropdown(!showStatusDropdown);
                      setTempSelectedStatuses([...selectedStatuses]);
                    }}
                    className={`w - full h - [42px] pl - 3 pr - 3 border rounded - md focus: outline - none text - sm text - primary bg - white flex items - center justify - between ${showStatusDropdown
                      ? '!border-primary !shadow-ring-primary'
                      : 'border-gray-300 focus:border-primary focus:shadow-ring-primary'
                      } `}
                  >
                    <span className="truncate">
                      {getDisplayText(selectedStatuses, 'Select Status')}
                    </span>
                    <FaCaretDown className="text-primary ml-2" />
                  </button>

                  {showStatusDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      <div className="sticky top-0 bg-white border-b border-gray-200 px-3 py-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={isAllSelected('status', filterOptions?.status_options)}
                            onChange={() => handleSelectAll('status', filterOptions?.status_options)}
                            className="mr-3 text-primary focus:ring-primary accent-primary rounded"
                          />
                          <span className="text-sm font-medium text-gray-700">Select All</span>
                        </label>
                      </div>

                      <div className="px-3 py-2">
                        {filterOptions?.status_options?.filter(status => ['paid', 'partial'].includes(status.value.toLowerCase())).map((status) => (
                          <label key={status.value} className="flex items-center py-1">
                            <input
                              type="checkbox"
                              checked={tempSelectedStatuses.includes(status.value)}
                              onChange={(e) => handleCheckboxChange('status', status.value, e.target.checked)}
                              className="mr-3 text-primary focus:ring-primary accent-primary rounded"
                            />
                            <span className="text-sm text-gray-700">{status.label}</span>
                          </label>
                        ))}
                      </div>

                      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-3 py-2 flex justify-between">
                        <button
                          type="button"
                          onClick={() => handleClear('status')}
                          className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDone('status')}
                          className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primaryHoverAlt transition-colors"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Method Filter */}
                {/* <div className="relative flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2 pl-1">
                    Payment Method
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMethodDropdown(!showMethodDropdown);
                      setTempSelectedMethods([...selectedMethods]);
                    }}
                    className="w-full h-[42px] pl-3 pr-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-[#3D9D9B] text-sm text-primary bg-white flex items-center justify-between"
                  >
                    <span className="truncate">
                      {getDisplayText(selectedMethods, 'Select Methods')}
                    </span>
                    <FaCaretDown className="text-primary ml-2" />
                  </button>
                  
                  {showMethodDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      <div className="sticky top-0 bg-white border-b border-gray-200 px-3 py-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={isAllSelected('method', filterOptions?.payment_methods)}
                            onChange={() => handleSelectAll('method', filterOptions?.payment_methods)}
                            className="mr-3 text-primary focus:ring-primary accent-primary rounded"
                          />
                          <span className="text-sm font-medium text-gray-700">Select All</span>
                        </label>
                      </div>
                      
                      <div className="px-3 py-2">
                        {filterOptions?.payment_methods?.map((method) => (
                          <label key={method.value} className="flex items-center py-1">
                            <input
                              type="checkbox"
                              checked={tempSelectedMethods.includes(method.value)}
                              onChange={(e) => handleCheckboxChange('method', method.value, e.target.checked)}
                              className="mr-3 text-primary focus:ring-primary accent-primary rounded"
                            />
                            <span className="text-sm text-gray-700">{method.label}</span>
                          </label>
                        ))}
                      </div>
                      
                      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-3 py-2 flex justify-between">
                        <button
                          type="button"
                          onClick={() => handleClear('method')}
                          className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDone('method')}
                          className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primaryHoverAlt transition-colors"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>

             */}
              </div>
            </div>
          )}

          {/* Payment Statistics - Calculated from frontend */}
          {calculatedStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <div className="text-sm font-medium text-blue-600">Total Service Fee</div>
                <div className="text-2xl font-bold text-blue-900">৳{Number((calculatedStats.totalFeeAmount + calculatedStats.totalBillCategoryAmount + calculatedStats.totalPenaltyAmount - calculatedStats.totalWaivedAmount) || 0).toLocaleString()}</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 p-3 sm:p-4 rounded-lg">
                <div className="text-xs sm:text-sm font-medium text-purple-600">Total Additional Charges</div>
                <div className="text-lg sm:text-xl md:text-2xl font-bold text-purple-900 truncate">৳{Number(calculatedStats.totalBillCategoryAmount || 0).toLocaleString()}</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 p-3 sm:p-4 rounded-lg">
                <div className="text-xs sm:text-sm font-medium text-emerald-600">Total Paid</div>
                <div className="text-lg sm:text-xl md:text-2xl font-bold text-emerald-900 truncate">৳{Number(calculatedStats.totalPaidAmount || 0).toLocaleString()}</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 p-3 sm:p-4 rounded-lg">
                <div className="text-xs sm:text-sm font-medium text-orange-600">Total Penalty</div>
                <div className="text-lg sm:text-xl md:text-2xl font-bold text-orange-900 truncate">৳{Number(calculatedStats.totalPenaltyAmount || 0).toLocaleString()}</div>
              </div>
              <div className="bg-green-50 border border-green-200 p-3 sm:p-4 rounded-lg">
                <div className="text-xs sm:text-sm font-medium text-green-600">Total Waived</div>
                <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-900 truncate">৳{Number(calculatedStats.totalWaivedAmount || 0).toLocaleString()}</div>
              </div>
              <div className="bg-teal-50 border border-teal-200 p-4 rounded-lg">
                <div className="text-sm font-medium text-teal-600">Total Due</div>
                <div className="text-2xl font-bold text-teal-900">৳{Number(calculatedStats.totalDueAmount || 0).toLocaleString()}</div>
              </div>
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                <div className="text-sm font-medium text-red-600">Total Overdue</div>
                <div className="text-2xl font-bold text-red-900">৳{Number(calculatedStats.overdueAmount || 0).toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Content Container */}
        <div className="max-h-[calc(100vh-300px)] overflow-y-auto relative z-10">
          {/* Table Section - Inside Same Card */}
          <div className="border border-gray-200 rounded-lg">
            {residentsLoading && !isInitialLoad ? (
              <div className="p-6">
                <TableSkeleton rows={10} columns={12} />
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block relative overflow-auto max-h-[calc(100vh-500px)]">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-primaryLight sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-3 text-left text-base font-semibold text-black">
                          #
                        </th>
                        <th
                          className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                          onClick={() => handleSort('tower_name')}
                        >
                          Tower
                        </th>
                        <th
                          className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                          onClick={() => handleSort('unit_display')}
                        >
                          Unit
                        </th>
                        <th
                          className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                          onClick={() => handleSort('resident_name')}
                        >
                          Resident Name
                        </th>
                        <th
                          className="px-6 py-3 text-left text-base font-semibold text-black"
                        >
                          Contact
                        </th>
                        <th
                          className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                          onClick={() => handleSort('amount')}
                        >
                          Service Fee
                        </th>
                        <th
                          className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                          onClick={() => handleSort('bill_category_amount')}
                        >
                          Additional Charges
                        </th>
                        <th
                          className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                          onClick={() => handleSort('penalty_amount')}
                        >
                          Penalty
                        </th>
                        <th
                          className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                          onClick={() => handleSort('waived_amount')}
                        >
                          Waived
                        </th>
                        <th
                          className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                          onClick={() => handleSort('paid_amount')}
                        >
                          Paid Amount
                        </th>
                        <th
                          className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                          onClick={() => handleSort('service_month')}
                        >
                          Service Month
                        </th>
                        <th
                          className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                          onClick={() => handleSort('payment_method')}
                        >
                          Method
                        </th>
                        <th
                          className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                          onClick={() => handleSort('payment_date')}
                        >
                          Payment Date
                        </th>
                        <th
                          className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                          onClick={() => handleSort('service_status')}
                        >
                          Status
                        </th>
                        <th className="px-6 py-3 text-center text-base font-semibold text-black">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedPayments && paginatedPayments.length > 0 ? (
                        paginatedPayments.map((payment, index) => (




                          <tr
                            key={index}
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => handleViewReceipt(payment)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{index + 1}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 break-words">{getDisplayValue(payment.tower_name)}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 break-words">{getDisplayValue(payment.unit_display)}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900 break-words">{getDisplayValue(payment.primary_name)}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">{getDisplayValue(payment.primary_number)}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 break-words font-medium">{getDisplayValue(payment.fee_amount || payment.original_amount || payment.service_fee_amount)}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 break-words">
                                {(() => {
                                  let billCategoryAmount = 0;

                                  // Try service_fee_items first (new format)
                                  if (payment.service_fee_items) {
                                    try {
                                      let items;
                                      if (typeof payment.service_fee_items === 'string') {
                                        items = JSON.parse(payment.service_fee_items);
                                      } else {
                                        items = payment.service_fee_items;
                                      }
                                      if (Array.isArray(items)) {
                                        billCategoryAmount = items.reduce((sum, item) => {
                                          if (item.item_type === 'bill_category') {
                                            return sum + parseFloat(item.amount || 0);
                                          }
                                          return sum;
                                        }, 0);
                                      }
                                    } catch (e) {
                                      billCategoryAmount = 0;
                                    }
                                  }

                                  // Fallback to bill_category_details (old format)
                                  if (!billCategoryAmount && payment.bill_category_details) {
                                    try {
                                      let billDetails;
                                      if (typeof payment.bill_category_details === 'string') {
                                        billDetails = JSON.parse(payment.bill_category_details);
                                      } else {
                                        billDetails = payment.bill_category_details;
                                      }
                                      // If it's an array, sum all amounts
                                      if (Array.isArray(billDetails)) {
                                        billCategoryAmount = billDetails.reduce((sum, item) => {
                                          return sum + parseFloat(item.total_amount || item.amount || 0);
                                        }, 0);
                                      } else {
                                        // If it's an object, get total_amount
                                        billCategoryAmount = parseFloat(billDetails.total_amount || 0);
                                      }
                                    } catch (e) {
                                      billCategoryAmount = 0;
                                    }
                                  }
                                  return getDisplayValue(billCategoryAmount, '0');
                                })()}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-orange-600 break-words">{getDisplayValue(payment.penalty_amount, '0')}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-green-600 break-words">{getDisplayValue(payment.waived_amount, '0')}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{getDisplayValue(payment.paid_amount, '0')}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 break-words">{formatServiceMonth(payment.service_month)}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 break-words">{getDisplayValue(payment.payment_method)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{formatDate(payment.payment_date)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline - block px - 2 py - 1 text - xs font - semibold rounded - full
                              ${payment.service_status?.toLowerCase() === 'due' ? 'bg-yellow-50 text-yellow-700' : ''}
                              ${payment.service_status?.toLowerCase() === 'partial' ? 'bg-blue-50 text-blue-700' : ''}
                              ${payment.service_status?.toLowerCase() === 'overdue' ? 'bg-red-50 text-red-600' : ''}
                              ${payment.service_status?.toLowerCase() === 'paid' ? 'bg-emerald-50 text-emerald-700' : ''}
`}
                              >

                                {getDisplayValue(payment.service_status?.charAt(0).toUpperCase() + payment.service_status?.slice(1))}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => {
                                  setPaymentToDelete(payment);
                                  setShowDeleteConfirm(true);
                                }}
                                className="inline-flex items-center justify-center p-2 rounded-md hover:bg-red-50 transition-colors"
                                title="Delete Payment"
                              >
                                <FaTrash className="w-5 h-5 text-red-600" />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="15" className="px-6 py-12">
                            <EmptyState
                              icon={FaHistory}
                              title='No Unit Payment History Found'
                            />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4 p-4">
                  {paginatedPayments && paginatedPayments.length > 0 ? (
                    paginatedPayments.map((payment, index) => {
                      let billCategoryAmount = 0;
                      if (payment.bill_category_details) {
                        try {
                          let billDetails;
                          if (typeof payment.bill_category_details === 'string') {
                            billDetails = JSON.parse(payment.bill_category_details);
                          } else {
                            billDetails = payment.bill_category_details;
                          }
                          if (Array.isArray(billDetails)) {
                            billCategoryAmount = billDetails.reduce((sum, item) => {
                              return sum + parseFloat(item.total_amount || item.amount || 0);
                            }, 0);
                          } else {
                            billCategoryAmount = parseFloat(billDetails.total_amount || 0);
                          }
                        } catch (e) {
                          billCategoryAmount = 0;
                        }
                      }

                      return (
                        <div
                          key={index}
                          onClick={() => handleViewReceipt(payment)}
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-base font-semibold text-gray-900">
                                  {getDisplayValue(payment.tower_name)} - {getDisplayValue(payment.unit_display)}
                                </h3>
                              </div>
                              <p className="text-sm text-gray-600 mb-1">{getDisplayValue(payment.primary_name)}</p>
                              <p className="text-xs text-gray-500">{getDisplayValue(payment.primary_number)}</p>
                            </div>
                            <span
                              className={`inline - block px - 2 py - 1 text - xs font - semibold rounded - full whitespace - nowrap
                              ${payment.service_status?.toLowerCase() === 'due' ? 'bg-yellow-50 text-yellow-700' : ''}
                              ${payment.service_status?.toLowerCase() === 'partial' ? 'bg-blue-50 text-blue-700' : ''}
                              ${payment.service_status?.toLowerCase() === 'overdue' ? 'bg-red-50 text-red-600' : ''}
                              ${payment.service_status?.toLowerCase() === 'paid' ? 'bg-emerald-50 text-emerald-700' : ''}
`}
                            >
                              {getDisplayValue(payment.service_status?.charAt(0).toUpperCase() + payment.service_status?.slice(1))}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Service Fee</p>
                              <p className="text-sm font-medium text-gray-900">{getDisplayValue(payment.fee_amount || payment.original_amount || payment.service_fee_amount)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Additional Charges</p>
                              <p className="text-sm font-medium text-gray-900">{getDisplayValue(billCategoryAmount, '0')}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Penalty</p>
                              <p className="text-sm font-medium text-orange-600">{getDisplayValue(payment.penalty_amount, '0')}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Waived</p>
                              <p className="text-sm font-medium text-green-600">{getDisplayValue(payment.waived_amount, '0')}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Paid Amount</p>
                              <p className="text-sm font-semibold text-gray-900">{getDisplayValue(payment.paid_amount, '0')}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Service Month</p>
                              <p className="text-sm text-gray-900">{formatServiceMonth(payment.service_month)}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                            <div className="flex flex-col gap-1">
                              <p className="text-xs text-gray-500">Payment Method</p>
                              <p className="text-sm text-gray-900">{getDisplayValue(payment.payment_method)}</p>
                            </div>
                            <div className="flex flex-col gap-1 text-right">
                              <p className="text-xs text-gray-500">Payment Date</p>
                              <p className="text-sm text-gray-900">{formatDate(payment.payment_date)}</p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPaymentToDelete(payment);
                                setShowDeleteConfirm(true);
                              }}
                              className="p-2 rounded-md hover:bg-red-50 transition-colors"
                              title="Delete Payment"
                            >
                              <FaTrash className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-12">
                      <EmptyState
                        icon={FaHistory}
                        title='No Unit Payment History Found'
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Pagination */}
          {filteredPayments && filteredPayments.length > itemsPerPage && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-4 pt-4 border-t border-gray-200 gap-4">
              <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredPayments.length)} of {filteredPayments.length} payments
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentPage(prev => Math.max(1, prev - 1));
                  }}
                  disabled={currentPage === 1}
                  className={`px - 3 sm: px - 4 py - 2 sm: py - 1 rounded border text - xs sm: text - sm ${currentPage === 1
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                    } `}
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={page}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setCurrentPage(page);
                          }}
                          className={`px - 3 sm: px - 4 py - 2 sm: py - 1 rounded border text - xs sm: text - sm ${currentPage === page
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-gray-700 hover:bg-gray-50"
                            } `}
                        >
                          {page}
                        </button>
                      );
                    } else if (
                      page === currentPage - 2 ||
                      page === currentPage + 2
                    ) {
                      return <span key={page} className="px-2">...</span>;
                    }
                    return null;
                  })}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentPage(prev => Math.min(totalPages, prev + 1));
                  }}
                  disabled={currentPage === totalPages}
                  className={`px - 3 sm: px - 4 py - 2 sm: py - 1 rounded border text - xs sm: text - sm ${currentPage === totalPages
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                    } `}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
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
    </PageContainer>
  );
};

export default UnitPaymentHistoryPage;
