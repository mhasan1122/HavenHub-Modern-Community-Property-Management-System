import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaFilter, FaDownload, FaPrint } from "react-icons/fa";
import ReportsTable from './ReportsTable';
import FilterControls from './FilterControls';
import ViewReceiptModal from '../../components/ViewReceiptModal';
import LoadingAnimation from '../../../../Components/Loaders/LoadingAnimation';
import TableSkeleton from '../../../../Components/Loaders/TableSkeleton';
import useSkeletonLoading from '../../../../hooks/useSkeletonLoading';
import { SKELETON_MIN_DISPLAY_TIME } from '../../../../config/skeletonLoadingConfig';
import { fetchServiceFeeResidents, fetchFilterOptions } from '../../../../redux/slices/api/serviceFeeManagement/serviceFeeManagementApi';
import { clearAllStates, clearErrors } from '../../../../redux/slices/serviceFeeManagement/serviceFeeManagementSlice';
import * as XLSX from 'xlsx';
import Button from '../../../../Components/FormComponent/ButtonComponent/Button';
import FilterButton from '../../../../Components/FormComponent/ButtonComponent/FilterButton';
import PageContainer from '../../../../Components/Ui/PageContainer';
import ContentBox from '../../../../Components/Ui/ContentBox';

const Reports = () => {
  const dispatch = useDispatch();

  // Redux state - Updated to use serviceFees slice with safe defaults
  const serviceFeeState = useSelector(state => state.serviceFeeManagement) || {};
  const {
    residents: payments = [],
    residentsLoading: residentsLoading = false,
    residentsError: error = null,
    residentsStatistics: paymentStats = {},
    filterOptions = { towers: [], status_options: [], payment_methods: [] },
    filterOptionsLoading = false
  } = serviceFeeState;

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

  // Local state - Initialize with current service period for both from and to
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTower, setSelectedTower] = useState('All Towers');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [selectedMethod, setSelectedMethod] = useState('All Methods');
  const [selectedTowers, setSelectedTowers] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedMethods, setSelectedMethods] = useState([]);
  const [servicePeriodFrom, setServicePeriodFrom] = useState(currentServicePeriod);
  const [servicePeriodTo, setServicePeriodTo] = useState(currentServicePeriod);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [showViewReceiptModal, setShowViewReceiptModal] = useState(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Get selected service period display (using from period for title)
  const getSelectedServicePeriod = () => {
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    if (servicePeriodFrom && servicePeriodTo) {
      if (servicePeriodFrom.year === servicePeriodTo.year && servicePeriodFrom.month === servicePeriodTo.month) {
        return `${monthNames[servicePeriodFrom.month - 1]} ${servicePeriodFrom.year}`;
      } else {
        return `${monthNames[servicePeriodFrom.month - 1]} ${servicePeriodFrom.year} - ${monthNames[servicePeriodTo.month - 1]} ${servicePeriodTo.year}`;
      }
    }
    return `${monthNames[servicePeriodFrom?.month - 1 || 0]} ${servicePeriodFrom?.year || new Date().getFullYear()}`;
  };

  useEffect(() => {
    // Clear any previous errors
    dispatch(clearAllStates());

    // Fetch filter options first
    dispatch(fetchFilterOptions());

  }, [dispatch]);

  // Initialize page loading - Updated to use new API
  useEffect(() => {
    const initializePage = async () => {
      // Clear any previous errors
      dispatch(clearErrors());

      // Use checkbox arrays if they exist, otherwise fall back to single selection
      const towerIds = selectedTowers.length > 0 ? selectedTowers : (selectedTower === 'All Towers' ? [] : [selectedTower]);
      const statusValues = selectedStatuses.length > 0 ? selectedStatuses : (selectedStatus === 'All Status' ? [] : [selectedStatus]);
      const methodValues = selectedMethods.length > 0 ? selectedMethods : (selectedMethod === 'All Methods' ? [] : [selectedMethod]);

      // Fetch service fee residents with current filters (combined data + statistics)
      const filterParams = {
        tower_id: towerIds.length > 0 ? towerIds.join(',') : '',
        status: statusValues.length > 0 ? statusValues.join(',') : '',
        payment_method: methodValues.length > 0 ? methodValues.join(',') : '',
        service_period_month_from: servicePeriodFrom?.month,
        service_period_year_from: servicePeriodFrom?.year,
        service_period_month_to: servicePeriodTo?.month,
        service_period_year_to: servicePeriodTo?.year,
        search: searchQuery,
        stats: true
      };

      await dispatch(fetchServiceFeeResidents(filterParams));
    };

    initializePage();
  }, [dispatch, searchQuery, selectedTower, selectedStatus, selectedMethod, selectedTowers, selectedStatuses, selectedMethods, servicePeriodFrom, servicePeriodTo]);

  // Handle initial load completion
  useEffect(() => {
    if (!residentsLoading && payments) {
      setIsInitialLoad(false);
    }
  }, [residentsLoading, payments]);

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

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleViewReceipt = (payment) => {
    setSelectedPaymentForReceipt(payment);
    setShowViewReceiptModal(true);
  };

  // Helper function to handle null/undefined values
  const getDisplayValue = (value, fallback = 'N/A') => {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }
    return value;
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
      return `${day}-${month}-${year}`;
    } catch {
      return 'N/A';
    }
  };

  const handleExport = () => {
    try {
      if (!filteredPayments || filteredPayments.length === 0) {
        alert('No data to export');
        return;
      }

      // Prepare data for Excel export
      const exportData = filteredPayments.map((payment, index) => ({

        'Tower': getDisplayValue(payment.tower_name),
        'Unit': getDisplayValue(payment.unit_display),
        'Fee Amount': `৳ ${getDisplayValue(payment.fee_amount, '0')}`,
        'Penalty': `৳ ${getDisplayValue(payment.penalty_amount, '0')}`,
        'Waiver': `৳ ${getDisplayValue(payment.waived_amount, '0')}`,
        'Paid Amount': `৳ ${getDisplayValue(payment.paid_amount || payment.amount, '0')}`,
        'Due Amount': `৳ ${getDisplayValue(payment.due_amount, '0')}`,
        'Payment Date': formatDate(payment.payment_date),
        'Payment Method': getDisplayValue(payment.payment_method),
        'Status': payment.service_status || 'Due',
        'Created By': getDisplayValue(payment.created_by_name)
      }));

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 15 },  // Tower
        { wch: 10 },  // Unit
        { wch: 15 },  // Fee Amount
        { wch: 12 },  // Penalty
        { wch: 12 },  // Waiver
        { wch: 15 },  // Paid Amount
        { wch: 15 },  // Due Amount
        { wch: 15 },  // Payment Date
        { wch: 15 },  // Payment Method
        { wch: 10 },  // Status
        { wch: 15 }   // Created By
      ];
      ws['!cols'] = colWidths;

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Service Fee Reports');

      // Generate filename
      const filename = `Service_Fee_Reports_${getSelectedServicePeriod().replace(/\s+/g, '_').replace(/[-]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      console.log('Excel file exported successfully:', filename);

    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Error exporting data to Excel. Please try again.');
    }
  };

  const handlePrint = () => {
    // Create print-friendly content
    const printContent = `
      <html>
        <head>
          <title>Service Fee Reports - ${getSelectedServicePeriod()}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
            .header { text-align: center; margin-bottom: 30px; }
            .company-name { font-size: 24px; font-weight: bold; color: #3D9D9B; margin-bottom: 10px; }
            .report-title { font-size: 18px; font-weight: 600; color: #374151; margin-bottom: 5px; }
            .period { font-size: 14px; color: #6B7280; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid var(--border-color, #E5E7EB); padding: 8px; text-align: left; }
            th { background-color: var(--header-bg, #F3F4F6); font-weight: bold; }
            .status-paid { background-color: #DEF7EC; color: #047857; }
            .status-due { background-color: #FEF3C7; color: #92400E; }
            .status-overdue { background-color: #FEE2E2; color: #DC2626; }
            .status-partial { background-color: #DBEAFE; color: #1E40AF; }
            @media print {
              body { margin: 0; }
              table { font-size: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">Estate Link</div>
            <div class="report-title">Service Fee Reports</div>
            <div class="period">${getSelectedServicePeriod()}</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Tower</th>
                <th>Unit</th>
                <th>Fee Amount</th>
                <th>Penalty</th>
                <th>Waiver</th>
                <th>Paid Amount</th>
                <th>Due Amount</th>
                <th>Payment Date</th>
                <th>Method</th>
                <th>Status</th>
                <th>Created By</th>
              </tr>
            </thead>
            <tbody>
              ${filteredPayments.map((payment, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${getDisplayValue(payment.tower_name)}</td>
                  <td>${getDisplayValue(payment.unit_display)}</td>
                  <td>৳ ${getDisplayValue(payment.fee_amount, '0')}</td>
                  <td>৳ ${getDisplayValue(payment.penalty_amount, '0')}</td>
                  <td>৳ ${getDisplayValue(payment.waived_amount, '0')}</td>
                  <td>৳ ${getDisplayValue(payment.paid_amount || payment.amount, '0')}</td>
                  <td>৳ ${getDisplayValue(payment.due_amount, '0')}</td>
                  <td>${formatDate(payment.payment_date)}</td>
                  <td>${getDisplayValue(payment.payment_method)}</td>
                  <td class="status-${(payment.service_status || 'due').toLowerCase()}">${payment.service_status || 'Due'}</td>
                  <td>${getDisplayValue(payment.created_by_name)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="margin-top: 30px; text-align: center; color: #6B7280; font-size: 10px;">
            Generated on ${new Date().toLocaleString()}
          </div>
        </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();

    // Print after content is loaded
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Sort and filter payments
  const getSortedPayments = () => {
    let sortedPayments = [...payments];

    if (sortConfig.key) {
      sortedPayments.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Handle null/undefined values
        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';

        // Convert to strings for comparison if they're not already
        if (typeof aValue !== 'string') aValue = String(aValue);
        if (typeof bValue !== 'string') bValue = String(bValue);

        // For numeric columns, parse as numbers
        if (['fee_amount', 'amount', 'due_amount', 'payment_id'].includes(sortConfig.key)) {
          aValue = parseFloat(aValue) || 0;
          bValue = parseFloat(bValue) || 0;
        }

        // For date columns, parse as dates
        if (sortConfig.key === 'payment_date') {
          aValue = new Date(aValue);
          bValue = new Date(bValue);
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return sortedPayments;
  };

  const filteredPayments = getSortedPayments();

  // Use skeleton loading hook to ensure minimum display time and data validation
  const showSkeleton = useSkeletonLoading(
    residentsLoading || isInitialLoad,
    payments,
    SKELETON_MIN_DISPLAY_TIME
  );

  return (
    <PageContainer>
      <ContentBox>
        {/* Header Section */}
        <div className="mb-3 sticky top-0 z-20 bg-white pb-4 backdrop-blur">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6">
            <div>
              <h1 className="text-[24px] font-semibold text-gray-900">Service Fee Reports: {getSelectedServicePeriod()}</h1>
            </div>
            <div className="flex items-center space-x-4 mt-4 lg:mt-0">
              <Button
                icon={FaDownload}
                variant="download"
                size="large"
                onClick={handleExport}
                disabled={!filteredPayments || filteredPayments.length === 0}
                iconSize="medium"
                tooltip="Excel"
                tooltipId="reports-excel-tooltip"
              />
              <Button
                variant="download"
                size="large"
                icon={FaPrint}
                onClick={handlePrint}
                disabled={!filteredPayments || filteredPayments.length === 0}
                iconSize="medium"
                tooltip="Print"
                tooltipId="reports-print-tooltip"
              />
              <FilterButton active={isFilterExpanded} onClick={() => setIsFilterExpanded(!isFilterExpanded)}>
                Filter
              </FilterButton>
            </div>
          </div>

          {/* Filters Section - Using FilterControls Component */}
          {isFilterExpanded && (
            <div className="mb-6 pb-4 border-b border-gray-200">
              <FilterControls
                searchQuery={searchQuery}
                servicePeriodFrom={servicePeriodFrom}
                servicePeriodTo={servicePeriodTo}
                selectedTowers={selectedTowers}
                selectedStatuses={selectedStatuses}
                selectedMethods={selectedMethods}
                onChange={handleFilterChange}
                onClearAll={handleClearAllFilters}
              />
            </div>
          )}

          {/* Payment Statistics - Dynamic from Redux */}
          {paymentStats && (
            <div className="mb-8">
              {/* Status Overview Cards */}
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <div className="text-sm font-medium text-blue-600">Total Records</div>
                    <div className="text-2xl font-bold text-blue-900">{paymentStats.totalPayments || 0}</div>
                    <div className="text-sm text-blue-700">৳ {((paymentStats.totalFeeAmount || 0))}</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                    <div className="text-sm font-medium text-green-600">Completed</div>
                    <div className="text-2xl font-bold text-green-900">{paymentStats.completedCount || 0}</div>
                    <div className="text-sm text-green-700">৳ {paymentStats.completedAmount || 0}</div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                    <div className="text-sm font-medium text-yellow-600">Due</div>
                    <div className="text-2xl font-bold text-yellow-900">{paymentStats.dueCount || 0}</div>
                    <div className="text-sm text-yellow-700">৳ {paymentStats.dueAmount || 0}</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                    <div className="text-sm font-medium text-red-600">Overdue</div>
                    <div className="text-2xl font-bold text-red-900">{paymentStats.overdueCount || 0}</div>
                    <div className="text-sm text-red-700">Action Required</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Content Container */}
        <div className="max-h-[calc(100vh-350px)] overflow-y-auto">
          {/* Table Section */}
          {showSkeleton ? (
            <div className="flex justify-center items-center py-12">
              <TableSkeleton rows={10} columns={7} />
            </div>
          ) : (
            <ReportsTable
              payments={filteredPayments}
              onViewReceipt={handleViewReceipt}
              onSort={handleSort}
              sortConfig={sortConfig}
            />
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

export default Reports;
