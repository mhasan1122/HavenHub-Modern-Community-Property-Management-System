import PropTypes from "prop-types";
import { useState, useEffect, useMemo } from "react";
import { FaMoneyBillWave } from "react-icons/fa";
import TableSkeleton from "../../../../Components/Loaders/TableSkeleton";
import { FaTrash } from "react-icons/fa6";
import useSkeletonLoading from "../../../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../../../config/skeletonLoadingConfig";
import EmptyState from "../../../../Components/Ui/EmptyState";

const PaymentTable = ({ payments, onViewReceipt, onDeletePayment, onRecordPayment, onViewHistory, isLoading = false, selectedPayments = [], onSelectPayment, onSelectAll }) => {
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

  // Memoized calculations for all payments - avoid redundant loops
  const paymentCalculations = useMemo(() => {
    return paginatedPayments.map(payment => {
      // Parse service_fee_items if exists
      let serviceFeeItemsTotal = 0;
      let serviceFeeItems = [];
      if (payment.service_fee_items) {
        try {
          if (typeof payment.service_fee_items === "string") {
            serviceFeeItems = JSON.parse(payment.service_fee_items);
          } else if (Array.isArray(payment.service_fee_items)) {
            serviceFeeItems = [...payment.service_fee_items];
          }
          // Calculate total excluding penalty items and avoiding duplication
          // Use base_fee and bill_category types only to avoid service_fee duplication
          serviceFeeItemsTotal = serviceFeeItems
            .filter((item) => item.item_type !== "penalty") // Exclude penalty and service_fee (duplicate of base_fee)
            .reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
        } catch (e) {
          console.error("Error parsing service_fee_items:", e);
        }
      }

      const paidAmount = parseFloat(payment.paid_amount || 0);
      const waived = parseFloat(payment.waived_amount || 0);
      const advanceAmount = parseFloat(payment.advance_amount || 0);
      const unitTotalAdvance = parseFloat(payment.unit_total_advance || payment.advance_balance || 0);
      const penalty = parseFloat(payment.penalty_amount || 0);
      const billCategoryAmount = parseFloat(payment.bill_category_amount || 0);
      let actualGrossPenalty = 0;

      // If we have items breakdown, find the actual gross penalty
      if (serviceFeeItems.length > 0) {
        const penaltyItem = serviceFeeItems.find(item => item.item_type === 'penalty');
        if (penaltyItem) {
          actualGrossPenalty = parseFloat(penaltyItem.amount || 0);
        }
      }

      // Determine what to use for gross penalty in the formula
      // If actualGrossPenalty is found, use it along with the waiver
      // Otherwise fallback to net penalty and assume waiver is already reflected
      const grossPenaltyToUse = actualGrossPenalty > 0 ? actualGrossPenalty : penalty + waived;

      const advanceApplied = parseFloat(payment.advance_applied || 0);

      // Use service_fee_items total if available, otherwise use due_amount or amount from API
      let currentBalance = 0;
      if (serviceFeeItemsTotal > 0) {
        // Correct Formula: Total Bills + Gross Penalty - Waived - Total Already Paid
        // Note: paidAmount usually includes advanceApplied, so we shouldn't subtract advanceApplied separately to avoid double counting
        currentBalance = Math.max(0, serviceFeeItemsTotal + grossPenaltyToUse - waived - paidAmount);
      } else {
        // Fallback: Use the record's remaining balance directly if available
        currentBalance = Math.max(0, parseFloat(payment.remaining_amount || payment.due_amount || payment.amount || 0));
      }

      // Calculate overdue amount
      const status = payment.service_status?.toLowerCase();
      const overdueAmount = status === "overdue" ? currentBalance : 0;

      // Count unpaid bills
      let unpaidBills = 0;
      let billCategoryDetails = payment.bill_category_details;
      if (typeof billCategoryDetails === "string") {
        try {
          billCategoryDetails = JSON.parse(billCategoryDetails);
        } catch (e) {
          // ignore
        }
      }
      if (Array.isArray(billCategoryDetails)) {
        unpaidBills = billCategoryDetails.length;
      } else if (billCategoryDetails && typeof billCategoryDetails === 'object') {
        unpaidBills = 1;
      }

      return {
        currentBalance,
        overdueAmount,
        penalty,
        unpaidBills,
        status,
        serviceFeeItems,
        serviceFeeItemsTotal,
        advanceAmount,
        advanceApplied: parseFloat(payment.advance_applied || 0),
        advanceGenerated: parseFloat(payment.advance_generated || 0),
        unitTotalAdvance: parseFloat(payment.unit_total_advance || payment.advance_balance || 0),
        paidAmount
      };
    });
  }, [paginatedPayments]);

  const handleRecordPayment = (payment) => {
    onRecordPayment && onRecordPayment(payment);
  };

  // Helper function to handle null/undefined values
  const getDisplayValue = (value, fallback = "N/A") => {
    if (value === null || value === undefined || value === "") {
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
      return "N/A";
    }
  };

  // Use skeleton loading hook to ensure minimum display time and data validation
  const showSkeleton = useSkeletonLoading(
    isLoading,
    payments,
    SKELETON_MIN_DISPLAY_TIME
  );

  const calculateCurrentBalance = (payment) => {
    const originalAmount = parseFloat(payment.original_amount || 0);
    const paidAmount = parseFloat(payment.total_paid_amount || payment.paid_amount || 0);
    const penalty = parseFloat(payment.penalty_amount || 0);
    const waived = parseFloat(payment.waived_amount || 0);
    const advanceApplied = parseFloat(payment.advance_applied || 0);
    const billCategoryAmount = parseFloat(payment.additional_bill_charges || payment.bill_category_total || payment.bill_category_amount || 0);

    // Formula: (original_amount + bill_category_amount + penalty_amount - waived_amount) - paid_amount - advance_applied
    return Math.max(0, (originalAmount + billCategoryAmount + penalty - waived) - paidAmount - advanceApplied);
  };

  // Calculate overdue amount
  const calculateOverdueAmount = (payment) => {
    if (payment.service_status?.toLowerCase() !== "overdue") return 0;
    return calculateCurrentBalance(payment);
  };

  // Calculate penalty
  const calculatePenalty = (payment) => {
    return parseFloat(payment.penalty_amount || 0);
  };

  // Calculate bill category total
  const calculateBillCategoryTotal = (payment) => {
    let billCategoryDetails = payment.bill_category_details;

    // Parse if it's a string (JSON from API)
    if (typeof billCategoryDetails === "string") {
      try {
        billCategoryDetails = JSON.parse(billCategoryDetails);
      } catch (e) {
        return 0;
      }
    }

    // Handle both array format (new) and single object format (old)
    if (Array.isArray(billCategoryDetails)) {
      return billCategoryDetails.reduce((sum, category) => {
        return sum + parseFloat(category.total_amount || 0);
      }, 0);
    } else if (billCategoryDetails && typeof billCategoryDetails === "object") {
      // Single object format (backward compatibility)
      return parseFloat(billCategoryDetails.total_amount || 0);
    }
    return 0;
  };

  // Helper function to count unpaid bills
  const countUnpaidBills = (payment) => {
    let billCategoryDetails = payment.bill_category_details;

    // Parse if it's a string (JSON from API)
    if (typeof billCategoryDetails === "string") {
      try {
        billCategoryDetails = JSON.parse(billCategoryDetails);
      } catch (e) {
        return 0;
      }
    }

    // Handle both array format (new) and single object format (old)
    if (Array.isArray(billCategoryDetails)) {
      return billCategoryDetails.length;
    } else if (billCategoryDetails && typeof billCategoryDetails === "object") {
      return 1; // Single object counts as 1 bill
    }
    return 0;
  };

  return (
    <div className="space-y-4">
      {showSkeleton ? (
        <div className="flex justify-center items-center py-12">
          <TableSkeleton rows={10} columns={9} />
        </div>
      ) : (
        <>
          {/* Payment Cards */}
          <div className="space-y-3">
            {paginatedPayments && paginatedPayments.length > 0 ? (
              paginatedPayments.map((payment, index) => {
                // Use pre-calculated values from memoized calculations
                const { currentBalance, overdueAmount, penalty, unpaidBills, status, serviceFeeItems, serviceFeeItemsTotal, advanceAmount, advanceApplied, advanceGenerated, unitTotalAdvance, paidAmount } = paymentCalculations[index] || {
                  currentBalance: 0,
                  overdueAmount: 0,
                  penalty: 0,
                  unpaidBills: 0,
                  status: payment.service_status?.toLowerCase(),
                  serviceFeeItems: [],
                  serviceFeeItemsTotal: 0,
                  advanceAmount: 0,
                  advanceApplied: 0,
                  advanceGenerated: 0,
                  unitTotalAdvance: 0,
                  paidAmount: 0
                };

                return (
                  <div
                    key={index}
                    // onClick={() => onViewHistory && onViewHistory(payment)}
                    className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
                      {/* Left Section: Icon + Info */}
                      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 w-full sm:w-auto">
                        {/* Building Icon */}
                        <div className="hidden md:flex flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-teal-50 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 sm:w-7 sm:h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>

                        {/* Unit Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start sm:items-center gap-2 sm:gap-3 mb-4 lg:mb-2">
                            <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                              {getDisplayValue(payment.tower_name)} -{" "}
                              {getDisplayValue(payment.unit_display)}
                            </h3>

                            {/* Status Badge */}
                            <span
                              className={`inline-flex items-center px-2 sm:px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap
                                ${status === "overdue" ? "bg-red-600 text-white" : ""}
                                ${status === "pending" || status === "due" ? "bg-blue-100 text-blue-700" : ""}
                                ${status === "paid" ? "bg-emerald-100 text-emerald-700" : ""}
                                ${status === "partial" ? "bg-yellow-100 text-yellow-700" : ""}
                              `}
                            >
                              {getDisplayValue(payment.service_status?.charAt(0).toUpperCase() + payment.service_status?.slice(1))}
                            </span>

                            {/* Waived Badge (if applicable) */}
                            {/* {payment.waived_amount && parseFloat(payment.waived_amount) > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-teal-700 bg-white border border-teal-600 rounded-full whitespace-nowrap">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                                </svg>
                                ৳{parseFloat(payment.waived_amount).toFixed(0)} waived
                              </span>
                            )} */}
                          </div>

                          {/* Resident/Owner & Payment Method Details */}
                          <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-sm text-gray-600 mt-1">
                            <div className="flex items-center gap-1.5" title="Account Holder">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span className="font-medium">{getDisplayValue(payment.primary_name)}</span>
                              {payment.account_holder_type && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded border border-gray-200 uppercase font-bold tracking-wider">
                                  {payment.account_holder_type} {payment.account_holder_id ? `#${payment.account_holder_id}` : ''}
                                </span>
                              )}
                            </div>

                            <div className="hidden sm:block text-gray-300">•</div>

                            <div className="flex items-center gap-1.5" title="Payment Method">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                              </svg>
                              <span>Method: <span className="font-medium text-gray-700">{getDisplayValue(payment.payment_method)}</span></span>
                            </div>

                            <div className="hidden sm:block text-gray-300">•</div>

                            <div className="flex items-center gap-1.5" title="Due Date">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>Due: <span className="font-medium">{formatDate(payment.due_date)}</span></span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Section: Balance + Actions */}
                      <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between sm:justify-end gap-4 sm:gap-6 w-full sm:w-auto">
                        {/* Current Balance */}
                        <div className="text-right w-full sm:w-auto">
                          <div className="text-sm text-gray-500 mb-1">
                            Due Amount
                          </div>
                          <div className="text-2xl sm:text-3xl font-bold text-teal-600">
                            ৳
                            {currentBalance
                              .toFixed(0)
                              .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                          </div>

                          {paidAmount > 0 && (
                            <div className="text-xs text-emerald-600 font-medium mt-0.5">
                              Paid: ৳{paidAmount.toFixed(0)}
                            </div>
                          )}
                          {status === "overdue" && overdueAmount > 0 && (
                            <div className="text-xs sm:text-sm text-red-600 font-medium mt-1">
                              ৳{overdueAmount.toFixed(0)} overdue
                            </div>
                          )}

                          {/* Penalty Display */}
                          {penalty > 0 && (
                            <div className="text-xs text-orange-600 font-medium mt-0.5">
                              ৳{penalty.toFixed(0)} penalty
                            </div>
                          )}

                          {/* Waiver Display */}
                          {parseFloat(payment.waived_amount || 0) > 0 && (
                            <div className="text-xs text-emerald-600 font-medium mt-0.5">
                              -৳{parseFloat(payment.waived_amount).toFixed(0)}{" "}
                              waived
                            </div>
                          )}

                          {/* Advance Display */}
                          {advanceApplied > 0 && (
                            <div className="text-xs text-blue-600 font-medium mt-0.5">
                              -৳{advanceApplied.toFixed(0)} advance applied
                            </div>
                          )}
                          {advanceGenerated > 0 && (
                            <div className="text-xs text-blue-600 font-medium mt-0.5">
                              +৳{advanceGenerated.toFixed(0)} advance generated
                            </div>
                          )}
                          {unitTotalAdvance > 0 && (
                            <div className="text-[10px] text-gray-500 italic mt-1 bg-blue-50 px-1.5 py-0.5 rounded inline-block">
                              Pool: ৳{unitTotalAdvance.toFixed(0)} available
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div
                          className="flex flex-col gap-2 w-full sm:w-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {onRecordPayment && (
                            <button
                              onClick={() => handleRecordPayment(payment)}
                              className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap bg-teal-600 text-white hover:bg-teal-700 cursor-pointer shadow-sm"
                            >
                              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567-.267z" />
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                              </svg>
                              <span>Record Payment</span>
                            </button>
                          )}
                          {/* <button
                            onClick={() => onViewHistory && onViewHistory(payment)}
                            className="px-3 sm:px-4 py-2 sm:py-2.5 bg-white text-gray-700 text-xs sm:text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 whitespace-nowrap flex-1 sm:flex-initial"
                          >
                            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View Details
                          </button> */}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-12">
                <EmptyState icon={FaMoneyBillWave} title="No payments found" />
              </div>
            )}
          </div>
        </>
      )}

      {/* Pagination */}
      {payments && payments.length > 0 && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-4 border-t border-gray-200 gap-4">
          <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
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
              className={`px-3 sm:px-4 py-2 sm:py-1 rounded border text-xs sm:text-sm ${currentPage === 1
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
                      className={`px-3 sm:px-4 py-2 sm:py-1 rounded border text-xs sm:text-sm ${currentPage === page
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
              className={`px-3 sm:px-4 py-2 sm:py-1 rounded border text-xs sm:text-sm ${currentPage === totalPages
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

PaymentTable.propTypes = {
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
  onDeletePayment: PropTypes.func,
  onRecordPayment: PropTypes.func,
  onViewHistory: PropTypes.func,

  isLoading: PropTypes.bool,
  selectedPayments: PropTypes.array,
  onSelectPayment: PropTypes.func,
  onSelectAll: PropTypes.func,
};

export default PaymentTable;
