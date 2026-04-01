import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import { BsArrowUpShort, BsArrowDownShort } from 'react-icons/bs';
import { FaEye } from 'react-icons/fa';
import { getServiceStatusBadge } from '../utils/paymentUtils';
import TableSkeleton from '../../../../Components/Loaders/TableSkeleton';
import useSkeletonLoading from '../../../../hooks/useSkeletonLoading';
import { SKELETON_MIN_DISPLAY_TIME } from '../../../../config/skeletonLoadingConfig';

const ReportsTable = ({ payments, onViewReceipt, onSort, sortConfig, isLoading = false }) => {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset to page 1 when payments list changes
  useEffect(() => {
    setCurrentPage(1);
  }, [payments]);

  // Pagination calculations
  const totalPages = Math.ceil((payments?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPayments = payments?.slice(startIndex, endIndex) || [];

  const handleViewReceipt = (payment) => {
    console.log('View Receipt for:', payment);
    onViewReceipt && onViewReceipt(payment);
  };

  const getSortIcon = (columnKey) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return null;
    }
    return sortConfig.direction === 'asc' ?
      <BsArrowUpShort className="inline ml-1" /> :
      <BsArrowDownShort className="inline ml-1" />;
  };

  const handleSort = (columnKey) => {
    onSort && onSort(columnKey);
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

  // Get service status badge - use service_status from backend
  const getStatusBadge = (payment) => {
    const statusBadge = getServiceStatusBadge(payment.service_status);
    return (
      <span className={statusBadge.className}>
        {statusBadge.text}
      </span>
    );
  };

  // Use skeleton loading hook to ensure minimum display time and data validation
  const showSkeleton = useSkeletonLoading(
    isLoading,
    payments,
    SKELETON_MIN_DISPLAY_TIME
  );

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="relative">
        {showSkeleton ? (
          <div className="flex justify-center items-center py-12">
            <TableSkeleton rows={10} columns={7} />
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[400px] lg:max-h-[500px] xl:max-h-[600px]">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-[#EBF5F5] sticky top-0 z-10">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                    onClick={() => handleSort('tower_name')}
                  >
                    Tower {getSortIcon('tower_name')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                    onClick={() => handleSort('unit_display')}
                  >
                    Unit {getSortIcon('unit_display')}
                  </th>
                  {/* <th 
                className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                onClick={() => handleSort('resident_name')}
              >
                Name {getSortIcon('resident_name')}
              </th> */}
                  <th
                    className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                    onClick={() => handleSort('fee_amount')}
                  >
                    Fee Amount {getSortIcon('fee_amount')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                    onClick={() => handleSort('penalty_amount')}
                  >
                    Penalty {getSortIcon('penalty_amount')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                    onClick={() => handleSort('waived_amount')}
                  >
                    Waived {getSortIcon('waived_amount')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                    onClick={() => handleSort('amount')}
                  >
                    Paid Amount {getSortIcon('amount')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                    onClick={() => handleSort('due_amount')}
                  >
                    Due Amount {getSortIcon('due_amount')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                    onClick={() => handleSort('payment_date')}
                  >
                    Payment Date {getSortIcon('payment_date')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                    onClick={() => handleSort('payment_method')}
                  >
                    Method {getSortIcon('payment_method')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                    onClick={() => handleSort('service_status')}
                  >
                    Status {getSortIcon('service_status')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-base font-semibold text-black cursor-pointer hover:bg-[#D6EFEF]"
                    onClick={() => handleSort('created_by_name')}
                  >
                    Created By {getSortIcon('created_by_name')}
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
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 break-words">{getDisplayValue(payment.tower_name)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 break-words">{getDisplayValue(payment.unit_display)}</div>
                      </td>
                      {/* <td className="px-6 py-4">
                <div className="text-sm font-medium text-gray-900 break-words">{getDisplayValue(payment.resident_name)}</div>
              </td> */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">৳ {getDisplayValue(payment.fee_amount, '0')}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-orange-600">৳ {getDisplayValue(payment.penalty_amount, '0')}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-emerald-600">৳ {getDisplayValue(payment.waived_amount, '0')}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">৳ {getDisplayValue(payment.paid_amount || payment.amount, '0')}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">৳ {getDisplayValue(payment.due_amount, '0')}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(payment.payment_date)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{getDisplayValue(payment.payment_method)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(payment)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {getDisplayValue(payment.created_by_name)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex justify-center space-x-2">
                          <button
                            onClick={() => handleViewReceipt(payment)}
                            className="p-2 text-primary hover:text-primaryHover transition-colors rounded-full hover:bg-gray-100"
                            title="View Receipt"
                          >
                            <FaEye className="w-[18px] h-[18px] text-primary" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="13" className="px-6 py-12 text-center">
                      <div className="text-gray-500">
                        <div className="text-lg font-medium mb-2">No Report Data Available</div>
                        <div className="text-sm">There are currently no reports to display for the selected filters.</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {payments && payments.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1} to {Math.min(endIndex, payments.length)} of {payments.length} payments
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
              className={`px-3 py-1 rounded border ${currentPage === 1
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
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
                      className={`px-3 py-1 rounded border ${currentPage === page
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-gray-700 hover:bg-gray-50"
                        }`}
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
              className={`px-3 py-1 rounded border ${currentPage === totalPages
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

ReportsTable.propTypes = {
  payments: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      tower: PropTypes.string,
      unit: PropTypes.string,
      amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      dueDate: PropTypes.string,
      method: PropTypes.string,
      status: PropTypes.string,
    })
  ).isRequired,
  onViewReceipt: PropTypes.func,
  onSort: PropTypes.func,
  sortConfig: PropTypes.shape({
    key: PropTypes.string,
    direction: PropTypes.oneOf(['asc', 'desc']),
  }),
  isLoading: PropTypes.bool,
};

export default ReportsTable;
