import { useState, useEffect } from 'react';
import { FaPlus, FaEye, FaExclamationCircle } from 'react-icons/fa';
import { IoSearch, IoCheckmarkCircle, IoTimeOutline, IoDocumentTextOutline } from 'react-icons/io5';
import { HiOutlineViewList } from 'react-icons/hi';
import { FaDownload, FaPrint } from 'react-icons/fa';
import { useSelector } from 'react-redux';
import { PERMISSIONS } from '../../../../constants/permissions';
import PageContainer from '../../../../Components/Ui/PageContainer';
import ContentBox from '../../../../Components/Ui/ContentBox';
import GenerateBillsWizard from './GenerateBillsWizard';
import BillDetailView from './BillDetailView';
import BillingFilterControls from './BillingFilterControls';
import axiosInstance from '../../../../utils/axiosInstance';
import MessageBox from '../../../../Components/MessageBox/MessageBox';
import Heading from '../../../../Components/HeadingComponent/Heading';



const BillingManagement = () => {
  const user = useSelector((state) => state.auth?.user);
  const permissionIds = user?.permission_ids?.map(String) || [];
  const canGenerate = permissionIds.includes(String(PERMISSIONS.GENERATE_SERVICE_FEES));
  const canView = permissionIds.includes(String(PERMISSIONS.VIEW_BILLING_MANAGEMENT));

  // Get current month and year for service period
  const getCurrentServicePeriod = () => {
    const today = new Date();
    return {
      year: today.getFullYear(),
      month: today.getMonth() + 1
    };
  };

  const currentServicePeriod = getCurrentServicePeriod();

  // Filter state with dynamic values
  const [selectedTowers, setSelectedTowers] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [servicePeriodFrom, setServicePeriodFrom] = useState(currentServicePeriod);
  const [servicePeriodTo, setServicePeriodTo] = useState(currentServicePeriod);
  const [searchQuery, setSearchQuery] = useState('');

  // Local state
  const [activeTab, setActiveTab] = useState(() => {
    if (canView) return 'bills-list';
    if (canGenerate) return 'generate-bills';
    return '';
  });
  const [selectedBill, setSelectedBill] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [isLoading, setIsLoading] = useState(false);
  const [bills, setBills] = useState([]);
  const [filterOptions, setFilterOptions] = useState({});
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');


  // Fetch filter options on component mount
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Fetch filter options from API
  const fetchFilterOptions = async () => {
    try {
      const response = await axiosInstance.get('/api/service-fee-management/filter-options/');
      if (response.data?.success && response.data?.data) {
        setFilterOptions(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  // Main function to fetch bills with filters - needs default values passed as parameters
  const fetchBillsWithFilters = async (towers = [], statuses = [], periodFrom, periodTo, query = '') => {
    // Use provided values or current defaults
    const from = periodFrom || currentServicePeriod;
    const to = periodTo || currentServicePeriod;
    setIsLoading(true);
    try {
      console.log('📋 Fetching bills from NEW detailed billing API...');

      // Build filter params using NEW endpoint
      const filterParams = {
        service_period_month_from: from?.month,
        service_period_year_from: from?.year,
        service_period_month_to: to?.month,
        service_period_year_to: to?.year,
        search: query,
        page: 1,
        limit: 500  // Get up to 500 records per page
      };

      // Create URLSearchParams to properly format multiple status parameters
      const params = new URLSearchParams();

      // Append all filters
      Object.keys(filterParams).forEach(key => {
        const value = filterParams[key];
        if (value !== '' && value !== null && value !== undefined) {
          params.append(key, value);
        }
      });

      // Add tower_ids only if there are selected towers
      if (towers && towers.length > 0) {
        towers.forEach(towerId => {
          params.append('tower_ids', towerId);
        });
      }

      // Add status parameters only if there are selected statuses
      if (statuses && statuses.length > 0) {
        statuses.forEach(status => {
          params.append('status', status);
        });
      }

      // Fetch from NEW detailed billing endpoint instead of residents endpoint
      const response = await axiosInstance.get('/api/service-fee-management/billing-detailed/', {
        params: params
      });

      console.log('✅ Bills fetched:', response.data);

      // Transform API data to match component structure
      let paymentsArray = [];

      // Check if data.payments exists (new flat array format)
      if (response.data?.data?.payments && Array.isArray(response.data.data.payments)) {
        paymentsArray = response.data.data.payments;
      }
      // Fallback to old nested format
      else {
        const apiData = response.data?.data || response.data?.results || response.data || [];
        paymentsArray = apiData.flatMap(unitData => unitData.payments || []);
      }

      const transformedBills = paymentsArray.map(payment => {
        // Use service_status directly from API (due, partial, paid, overdue)
        let status = payment.service_status || 'due';

        // Format period
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'];
        const period = `${monthNames[payment.service_period_month - 1]} ${payment.service_period_year}`;

        // Calculate amounts FIRST
        const originalAmount = parseFloat(payment.original_amount || payment.service_fee_amount || payment.fee_amount || 0);

        // Calculate bill_category_amount from service_fee_items
        let billCategoryAmount = 0;
        try {
          const serviceFeeItems = typeof payment.service_fee_items === 'string'
            ? JSON.parse(payment.service_fee_items)
            : payment.service_fee_items;
          if (Array.isArray(serviceFeeItems)) {
            billCategoryAmount = serviceFeeItems
              .filter(item => item.item_type === 'bill_category')
              .reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
          }
        } catch (e) {
          console.warn('Error parsing service_fee_items for bill_category_amount:', e);
        }

        // Use gross_penalty_amount if available, otherwise use penalty_amount
        const grossPenaltyAmount = parseFloat(payment.gross_penalty_amount || payment.penalty_amount || 0);
        const waiverAmount = parseFloat(payment.waived_amount || 0);
        // Total Bill = service_fee + bill_category + gross_penalty - waiver (NOT subtracting paid amount)
        const totalAmount = originalAmount + billCategoryAmount + grossPenaltyAmount - waiverAmount;

        // Parse bill_category_details to get individual categories
        const parseBillCategories = () => {
          try {
            if (payment.bill_category_details) {
              const parsed = typeof payment.bill_category_details === 'string'
                ? JSON.parse(payment.bill_category_details)
                : payment.bill_category_details;
              return Array.isArray(parsed) ? parsed : [];
            }
          } catch (e) {
            console.warn('Failed to parse bill_category_details', e);
          }
          return [];
        };

        const billCategories = parseBillCategories();

        // Build serviceFees array with individual category items
        const serviceFeeItems = [
          {
            description: 'Monthly Service Fee',
            details: 'Base service fee payment',
            amount: originalAmount
          }
        ];

        // Add each bill category as a separate item
        if (billCategories.length > 0) {
          billCategories.forEach(category => {
            const categoryAmount = parseFloat(category.total_amount || 0);
            if (categoryAmount > 0) {
              serviceFeeItems.push({
                description: `${category.category_name ? category.category_name.charAt(0).toUpperCase() + category.category_name.slice(1) : 'Utility'} Charges`,
                details: `Usage charges - ${category.consumption || 0} units @ ${category.price_per_unit || 0} per unit`,
                amount: categoryAmount
              });
            }
          });
        }

        // Add penalty if applicable
        if (grossPenaltyAmount > 0) {
          serviceFeeItems.push({
            description: 'Late Payment Penalty',
            details: `${payment.penalty_percentage || 0}% penalty on overdue amount`,
            amount: grossPenaltyAmount
          });
        }

        // Add waiver if applicable
        if (waiverAmount > 0) {
          serviceFeeItems.push({
            description: 'Waiver Discount',
            details: 'Applied discount/waiver',
            amount: -waiverAmount
          });
        }

        return {
          id: payment.payment_id || payment.id,
          billNumber: payment.bill_number || `BILL-${payment.service_period_year}${String(payment.service_period_month).padStart(2, '0')}-${payment.tower_name?.charAt(0) || 'A'}${payment.unit_name || payment.unit_id}`,
          status: status, // Use lowercase status directly (due, partial, paid, overdue)
          resident: payment.resident_name || payment.primary_name || 'N/A',
          account_holder_type: payment.account_holder_type || 'resident',
          unit: `${payment.tower_name || 'N/A'}, Unit ${payment.unit_name || payment.unit_display || 'N/A'}`,
          period: period,
          amount: totalAmount,
          payment_id: payment.payment_id,
          unit_id: payment.unit_id,
          account_holder_id: payment.account_holder_id,
          paidOn: payment.completion_date || null,
          paymentDate: payment.payment_date || null,
          paymentMethod: payment.payment_method || null,
          transactionId: payment.transaction_id || null,
          amountPaid: parseFloat(payment.paid_amount || 0),
          remaining_amount: parseFloat(payment.remaining_amount || 0),
          waiverAmount: waiverAmount,
          penalty_amount: grossPenaltyAmount,
          penalty_percentage: payment.penalty_percentage || 0,
          bill_category_amount: billCategoryAmount,
          bill_category_details: payment.bill_category_details,
          service_fee_items: payment.service_fee_items, // Pass through the service_fee_items from API
          // Parse payment_details from API response
          payment_details: (() => {
            try {
              const paymentDetails = payment.payment_details;
              if (typeof paymentDetails === 'string') {
                return JSON.parse(paymentDetails);
              }
              return Array.isArray(paymentDetails) ? paymentDetails : [];
            } catch (e) {
              return [];
            }
          })(),
          invoiceDate: payment.created_at || null,
          dueDate: payment.due_date || null,
          email: payment.primary_email || payment.secondary_email || 'N/A',
          serviceFees: [
            {
              category: 'Billing Details',
              items: serviceFeeItems
            }
          ]
        };
      });

      setBills(transformedBills);
      console.log(`✅ Transformed ${transformedBills.length} bills`);
    } catch (error) {
      console.error('❌ Error fetching bills:', error);
      // Keep empty bills array on error
      setBills([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBillsGenerated = () => {
    console.log('🔄 Bills generated, refreshing list...');
    fetchBillsWithFilters(selectedTowers, selectedStatuses, servicePeriodFrom, servicePeriodTo, searchQuery);
    // setSuccessMessage('Bills have been generated successfully!'); // Wizard handles its own success message
  };


  const clearMessage = () => {
    setSuccessMessage('');
    setErrorMessage('');
  };


  // Update bills when filters change or when switching back to the list tab
  useEffect(() => {
    if (activeTab === 'bills-list' && viewMode === 'list') {
      fetchBillsWithFilters(selectedTowers, selectedStatuses, servicePeriodFrom, servicePeriodTo, searchQuery);
    }
  }, [selectedTowers, selectedStatuses, servicePeriodFrom, servicePeriodTo, searchQuery, activeTab, viewMode]);

  // Calculate summary statistics
  const summaryStats = {
    total: bills.length,
    pending: bills.filter(b => b.status === 'due').length,
    partial: bills.filter(b => b.status === 'partial').length,
    paid: bills.filter(b => b.status === 'paid').length,
    overdue: bills.filter(b => b.status === 'overdue').length
  };

  // Bills are already filtered by API, so use them directly
  const filteredBills = bills;

  const getStatusBadge = (status) => {
    const baseClasses = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold";
    const statusLower = status?.toLowerCase() || 'due';

    switch (statusLower) {
      case 'paid':
        return (
          <span className={`${baseClasses} bg-emerald-100 text-emerald-700`}>
            <IoCheckmarkCircle className="w-3.5 h-3.5" />
            PAID
          </span>
        );
      case 'partial':
        return (
          <span className={`${baseClasses} bg-blue-100 text-blue-700`}>
            <IoCheckmarkCircle className="w-3.5 h-3.5" />
            PARTIAL
          </span>
        );
      case 'due':
        return (
          <span className={`${baseClasses} bg-yellow-100 text-yellow-700`}>
            <IoTimeOutline className="w-3.5 h-3.5" />
            DUE
          </span>
        );
      case 'overdue':
        return (
          <span className={`${baseClasses} bg-red-100 text-red-700`}>
            <FaExclamationCircle className="w-3.5 h-3.5" />
            OVERDUE
          </span>
        );
      default:
        return <span className={baseClasses}>{status?.toUpperCase()}</span>;
    }
  };

  const formatCurrency = (amount) => {
    return `৳${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Handle view bill detail
  const handleViewBill = (bill) => {
    setSelectedBill(bill);
    setViewMode('detail');
  };

  // Handle back to list
  const handleBackToList = () => {
    setViewMode('list');
    setSelectedBill(null);
  };

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
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
      case 'selectedTowers':
        setSelectedTowers(value);
        break;
      case 'selectedStatuses':
        setSelectedStatuses(value);
        break;
      default:
        break;
    }
  };

  // Handle clear all filters
  const handleClearAllFilters = () => {
    setSearchQuery('');
    setSelectedTowers([]);
    setSelectedStatuses([]);
    const currentPeriod = getCurrentServicePeriod();
    setServicePeriodFrom(currentPeriod);
    setServicePeriodTo(currentPeriod);
  };

  // Handle print invoice
  const handlePrint = () => {
    window.print();
  };

  // Handle download PDF
  const handleDownloadPDF = () => {
    // TODO: Implement PDF download functionality
    setErrorMessage('PDF download functionality will be implemented soon');
  };


  return (
    <PageContainer>
      <ContentBox>
        {/* Header Section */}
        <div className="mb-4 md:mb-6">
          <Heading title="Billing Management" size="2xl" color="black" />
          <p className="text-gray-600 text-sm md:text-base">
            Generate monthly bills and manage resident payments.
          </p>
        </div>

        {/* Navigation Tabs - Segmented Control */}
        <div className="relative inline-flex bg-gray-100 rounded-full p-1 mb-4 md:mb-6 w-full md:w-auto">
          {canView && (
            <button
              onClick={() => setActiveTab('bills-list')}
              className={`relative flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-full font-semibold transition-all duration-200 z-10 flex-1 md:flex-none ${activeTab === 'bills-list'
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                : 'text-gray-700'
                }`}
            >
              <HiOutlineViewList className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base">Bills List</span>
            </button>
          )}
          {canGenerate && (
            <button
              onClick={() => setActiveTab('generate-bills')}
              className={`relative flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-full font-semibold transition-all duration-200 z-10 flex-1 md:flex-none ${activeTab === 'generate-bills'
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                : 'text-gray-700'
                }`}
            >
              <FaPlus className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base">Generate Bills</span>
            </button>
          )}
        </div>

        {/* Generate Bills Wizard */}
        {activeTab === 'generate-bills' && canGenerate && (
          <GenerateBillsWizard
            onClose={() => setActiveTab('bills-list')}
            onBillsGenerated={handleBillsGenerated}
          />
        )}

        {/* Bill Detail View - Show when viewMode is 'detail' */}
        {activeTab === 'bills-list' && viewMode === 'detail' && selectedBill && (
          <BillDetailView
            bill={selectedBill}
            onBack={handleBackToList}
            onDownloadPDF={handleDownloadPDF}
          />
        )}


        {/* Bills List Content - Only show when bills-list tab is active and viewMode is 'list' */}
        {activeTab === 'bills-list' && viewMode === 'list' && (
          <>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
              {/* Total Bills */}
              <div className="bg-white rounded-xl p-3 md:p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-xs md:text-sm font-medium mb-1">Total Bills</p>
                    <p className="text-xl md:text-2xl font-bold text-gray-900">{summaryStats.total}</p>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <IoDocumentTextOutline className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              {/* Pending (Due) */}
              <div className="bg-white rounded-xl p-3 md:p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-xs md:text-sm font-medium mb-1">Due</p>
                    <p className="text-xl md:text-2xl font-bold text-gray-900">{summaryStats.pending}</p>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                    <IoTimeOutline className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" />
                  </div>
                </div>
              </div>

              {/* Partial */}
              <div className="bg-white rounded-xl p-3 md:p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-xs md:text-sm font-medium mb-1">Partial</p>
                    <p className="text-xl md:text-2xl font-bold text-gray-900">{summaryStats.partial}</p>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <IoCheckmarkCircle className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              {/* Paid */}
              <div className="bg-white rounded-xl p-3 md:p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-xs md:text-sm font-medium mb-1">Paid</p>
                    <p className="text-xl md:text-2xl font-bold text-gray-900">{summaryStats.paid}</p>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-primary flex items-center justify-center">
                    <IoCheckmarkCircle className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                </div>
              </div>

              {/* Overdue */}
              <div className="bg-white rounded-xl p-3 md:p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-xs md:text-sm font-medium mb-1">Overdue</p>
                    <p className="text-xl md:text-2xl font-bold text-gray-900">{summaryStats.overdue}</p>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-red-100 flex items-center justify-center">
                    <FaExclamationCircle className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Filters & Search Section */}
            <div className="bg-white rounded-xl p-4 md:p-5 shadow-sm border border-gray-100 mb-4 md:mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900">Filters & Search</h3>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleClearAllFilters}
                    className="px-3 md:px-4 py-2 text-xs md:text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex-1 sm:flex-none"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                    className="px-3 md:px-4 py-2 text-xs md:text-sm bg-primary text-white rounded-lg hover:bg-primaryHover transition-colors flex-1 sm:flex-none"
                  >
                    {isFilterExpanded ? 'Hide' : 'Show'} Filters
                  </button>
                </div>
              </div>

              {/* Search Input */}
              <div className="mb-4 relative">
                <IoSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search bills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              {/* Expanded Filters Section */}
              {isFilterExpanded && (
                <div className="border-t border-gray-200 pt-4">
                  <BillingFilterControls
                    searchQuery={searchQuery}
                    servicePeriodFrom={servicePeriodFrom}
                    servicePeriodTo={servicePeriodTo}
                    selectedTowers={selectedTowers}
                    selectedStatuses={selectedStatuses}
                    filterOptions={filterOptions}
                    onChange={handleFilterChange}
                    onClearAll={handleClearAllFilters}
                  />
                </div>
              )}
            </div>

            {/* Generated Bills Section */}
            <div className="bg-white rounded-xl p-4 md:p-5 shadow-sm border border-gray-100">
              <div className="mb-4">
                <h3 className="text-base md:text-lg font-semibold text-gray-900">Generated Bills</h3>
                <p className="text-xs md:text-sm text-gray-600 mt-1">{filteredBills.length} bills found</p>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
                  <p className="mt-4 text-gray-600">Loading bills...</p>
                </div>
              )}

              {/* Bills List */}
              {!isLoading && (
                <div className="space-y-4">
                  {filteredBills.map((bill) => (
                    <div
                      key={bill.id}
                      className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-200 hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col gap-4">
                        {/* Header Section */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0 flex items-center gap-3">
                            <h4 className="text-base md:text-lg font-semibold text-gray-900 truncate">{bill.billNumber}</h4>
                            {getStatusBadge(bill.status)}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleViewBill(bill)}
                              className="flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-xs md:text-sm"
                            >
                              <FaEye className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              <span className="hidden sm:inline">View</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500 mb-1">{bill.account_holder_type === 'owner' ? 'Owner' : 'Resident'}</p>
                            <p className="text-gray-900 font-medium">{bill.resident}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Unit</p>
                            <p className="text-gray-900 font-medium">{bill.unit}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Period</p>
                            <p className="text-gray-900 font-medium">{bill.period}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Amount</p>
                            <p className={`font-semibold ${bill.service_status === 'PAID' || bill.service_status === 'paid' ? 'text-emerald-600' : 'text-teal-600'
                              }`}>
                              {formatCurrency(bill.amount)}
                            </p>
                          </div>
                        </div>

                        {/* Additional Info for Paid Bills */}
                        {(bill.service_status === 'PAID' || bill.service_status === 'paid') && bill.paidOn && (
                          <p className="text-sm text-emerald-600 mt-2">
                            Paid on {bill.paidOn} via {bill.paymentMethod}
                          </p>
                        )}
                      </div>
                    </div>

                  ))}

                  {filteredBills.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <p>No bills found matching your filters.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </ContentBox>
      <MessageBox
        message={successMessage}
        error={errorMessage}
        clearMessage={clearMessage}
      />
    </PageContainer >

  );
};

export default BillingManagement;
