import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
// Sorting icons removed; not needed
import { FaEye, FaMoneyBillWave } from 'react-icons/fa';
import { MdOutlinePayments } from "react-icons/md";
import { getServiceStatusBadge } from '../utils/paymentUtils';
import TableSkeleton from '../../../../Components/Loaders/TableSkeleton';
import useSkeletonLoading from '../../../../hooks/useSkeletonLoading';
import { SKELETON_MIN_DISPLAY_TIME } from '../../../../config/skeletonLoadingConfig';
import EmptyState from '../../../../Components/Ui/EmptyState';

const OverviewTable = ({ payments, onViewReceipt, onViewHistory, onRecordPayment, isLoading = false }) => {
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

  // Helper to safely format generic dates (e.g., due date)
  const formatDate = (dateValue) => {
    if (!dateValue || dateValue === '1970-01-01T00:00:00Z' || dateValue === '1970-01-01') {
      return 'N/A';
    }
    try {
      const date = new Date(dateValue);
      const day = String(date.getDate()).padStart(2, '0');
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return 'N/A';
    }
  };

  // Helper to handle null/undefined values
  const getDisplayValue = (value, fallback = 'N/A') => {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }
    return value;
  };

  // Service status badge (optional visual aid)
  const getStatusBadge = (payment) => {
    const statusBadge = getServiceStatusBadge(payment.service_status);
    return <span className={statusBadge.className}>{statusBadge.text}</span>;
  };

  // Use skeleton loading hook to ensure minimum display time and data validation
  const showSkeleton = useSkeletonLoading(
    isLoading,
    payments,
    SKELETON_MIN_DISPLAY_TIME
  );

  // Helper to calculate bill category amount
  const getBillCategoryAmount = (payment) => {
    let billCategoryAmount = parseFloat(payment.bill_category_amount || 0);
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
    return billCategoryAmount;
  };

  // Helper to calculate total bills (the original "total due")
  const getTotalBilled = (payment) => {
    const feeAmount = parseFloat(payment.fee_amount || payment.original_amount || payment.service_fee_amount || 0);
    const penaltyAmount = parseFloat(payment.penalty_amount || 0);
    const waivedAmount = parseFloat(payment.waived_amount || 0);
    const billCategoryAmount = getBillCategoryAmount(payment);

    // We parse gross penalty to avoid double-counting waivers in net penalty
    let actualGrossPenalty = 0;
    if (payment.service_fee_items) {
      try {
        const items = typeof payment.service_fee_items === 'string' ? JSON.parse(payment.service_fee_items) : payment.service_fee_items;
        const penaltyItem = items.find(item => item.item_type === 'penalty');
        if (penaltyItem) actualGrossPenalty = parseFloat(penaltyItem.amount || 0);
      } catch (e) { }
    }

    const grossPenaltyToUse = actualGrossPenalty > 0 ? actualGrossPenalty : (penaltyAmount + waivedAmount);
    return Math.max(0, feeAmount + billCategoryAmount + grossPenaltyToUse - waivedAmount);
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      {showSkeleton ? (
        <div className="flex justify-center items-center py-12">
          <TableSkeleton rows={10} columns={10} />
        </div>
      ) : (
        <div className="w-full min-h-[260px] overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[1200px] border-collapse table-auto">
            <thead className="sticky top-0 bg-[#EBF5F5] border-b border-borderLight z-[1]">
              <tr>
                <th className="px-6 py-3 text-left text-base font-semibold text-black whitespace-nowrap">#</th>
                <th className="px-6 py-3 text-left text-base font-semibold text-black whitespace-nowrap">Tower</th>
                <th className="px-6 py-3 text-left text-base font-semibold text-black whitespace-nowrap">Unit</th>
                <th className="px-6 py-3 text-left text-base font-semibold text-black whitespace-nowrap">Name</th>
                <th className="px-6 py-3 text-left text-base font-semibold text-black whitespace-nowrap">Contact</th>
                <th className="px-6 py-3 text-left text-base font-semibold text-black whitespace-nowrap">Fee Amount</th>
                <th className="px-6 py-3 text-left text-base font-semibold text-black whitespace-nowrap">Additional Charges</th>
                <th className="px-6 py-3 text-left text-base font-semibold text-black whitespace-nowrap">Penalty</th>
                <th className="px-6 py-3 text-left text-base font-semibold text-black whitespace-nowrap">Waived</th>
                <th className="px-6 py-3 text-left text-base font-semibold text-black whitespace-nowrap">Due Amount</th>
                <th className="px-6 py-3 text-center text-base font-semibold text-black whitespace-nowrap">Paid Amount</th>
                <th className="px-6 py-3 text-left text-base font-semibold text-black whitespace-nowrap">Due Date</th>
                <th className="px-6 py-3 text-left text-base font-semibold text-black whitespace-nowrap">Status</th>
                <th className="px-6 py-3 text-center text-base font-semibold text-black whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPayments && paginatedPayments.length > 0 ? (
                paginatedPayments.map((payment, idx) => (
                  <tr
                    key={`overview-${payment.id || idx}-${payment.unit_id || ''}-${payment.service_fee_id || ''}`}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4"><div className="text-sm font-medium text-gray-900">{startIndex + idx + 1}</div></td>
                    <td className="px-6 py-4"><div className="text-sm font-medium text-gray-900 break-words">{getDisplayValue(payment.tower_name)}</div></td>
                    <td className="px-6 py-4"><div className="text-sm font-medium text-gray-900 break-words">{getDisplayValue(payment.unit_display)}</div></td>
                    <td className="px-6 py-4"><div className="text-sm font-medium text-gray-900 break-words">{getDisplayValue(payment.primary_name)}</div></td>
                    <td className="px-6 py-4"><div className="text-sm text-gray-900">{getDisplayValue(payment.primary_number)}</div></td>
                    <td className="px-6 py-4"><div className="text-sm text-gray-900 break-words">{getDisplayValue(payment.fee_amount || payment.original_amount || payment.service_fee_amount)}</div></td>
                    <td className="px-6 py-4"><div className="text-sm text-gray-900 break-words">
                      {(() => {
                        let billCategoryAmount = parseFloat(payment.bill_category_amount || 0);

                        // Try service_fee_items first (new API format)
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
                                // Only sum bill_category items, not base_fee or penalty
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

                        // Fallback to bill_category_details
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
                        return getDisplayValue(billCategoryAmount, '0');
                      })()}
                    </div></td>
                    <td className="px-6 py-4"><div className="text-sm text-orange-600 font-medium">৳ {getDisplayValue(payment.penalty_amount, '0')}</div></td>
                    <td className="px-6 py-4"><div className="text-sm text-emerald-600 font-medium">৳ {getDisplayValue(payment.waived_amount, '0')}</div></td>
                    <td className="px-6 py-4"><div className="text-sm font-bold text-primary">
                      {(() => {
                        const totalBilled = getTotalBilled(payment);
                        const paidAmount = parseFloat(payment.paid_amount || 0);
                        const advanceApplied = parseFloat(payment.advance_applied || 0);
                        const balanceDue = Math.max(0, totalBilled - (paidAmount + advanceApplied));
                        return `৳ ${balanceDue.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
                      })()}
                    </div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-center font-medium text-gray-900">{getDisplayValue(payment.paid_amount, '0')}</div></td>
                    <td className="px-6 py-4"><div className="text-sm text-gray-900">{formatDate(payment.due_date)}</div></td>
                    <td className="px-6 py-4"><span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full
                          ${payment.service_status?.toLowerCase() === 'due' ? 'bg-yellow-50 text-yellow-700' : ''}
                          ${payment.service_status?.toLowerCase() === 'partial' ? 'bg-blue-50 text-blue-700' : ''}
                          ${payment.service_status?.toLowerCase() === 'overdue' ? 'bg-red-50 text-red-600' : ''}
                          ${payment.service_status?.toLowerCase() === 'paid' ? 'bg-emerald-50 text-emerald-700' : ''}
                        `}>
                      {getDisplayValue(payment.service_status?.charAt(0).toUpperCase() + payment.service_status?.slice(1))}
                    </span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex justify-center space-x-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onRecordPayment && onRecordPayment(payment)}
                          className="p-2 text-primary hover:text-primaryHover transition-colors rounded-full hover:bg-gray-100"
                          title="Record Payment"
                        >
                          <FaMoneyBillWave className="w-[18px] h-[18px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="14" className="p-0 align-middle h-[240px]">
                    <div className="bg-white rounded-lg p-6 flex items-center justify-center w-full h-full">
                      <div className="flex flex-col items-center justify-center gap-2 text-center">
                        <MdOutlinePayments className="w-10 h-10 text-gray-300" />
                        <div className="text-base font-semibold text-gray-600">
                          No Payments Found
                        </div>
                      
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {payments && payments.length > 0 && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 mt-4 pt-4 border-t border-gray-200">
          <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
            Showing {startIndex + 1} to {Math.min(endIndex, payments.length)} of {payments.length} payments
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentPage((prev) => Math.max(1, prev - 1));
              }}
              disabled={currentPage === 1}
              className={`px-3 py-2 sm:py-1 rounded border text-sm min-h-[44px] sm:min-h-0 active:scale-95 ${currentPage === 1 ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCurrentPage(page);
                      }}
                      className={`px-3 py-2 sm:py-1 rounded border text-sm min-h-[44px] sm:min-h-0 active:scale-95 ${currentPage === page ? "bg-primary text-white border-primary" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                    >
                      {page}
                    </button>
                  );
                } else if (page === currentPage - 2 || page === currentPage + 2) {
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
                setCurrentPage((prev) => Math.min(totalPages, prev + 1));
              }}
              disabled={currentPage === totalPages}
              className={`px-3 py-2 sm:py-1 rounded border text-sm min-h-[44px] sm:min-h-0 active:scale-95 ${currentPage === totalPages ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

OverviewTable.propTypes = {
  payments: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      tower_name: PropTypes.string,
      unit_display: PropTypes.string,
      primary_name: PropTypes.string,
      primary_number: PropTypes.string,
      amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      paid_amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      due_date: PropTypes.string,
      service_status: PropTypes.string,
    })
  ).isRequired,
  onViewReceipt: PropTypes.func,
  onViewHistory: PropTypes.func,
  onRecordPayment: PropTypes.func,
  isLoading: PropTypes.bool,
};

export default OverviewTable;
