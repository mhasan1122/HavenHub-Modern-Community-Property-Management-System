import { useState, useEffect } from "react";
import { FaTimes, FaEye } from "react-icons/fa";
import PropTypes from "prop-types";
import axiosInstance from "../../utils/axiosInstance";
import ModernLoadingAnimation from "../../Components/Loaders/ModernLoadingAnimation";

/**
 * VoucherDetailModal Component
 * Displays comprehensive voucher details in a modal overlay
 */
const VoucherDetailModal = ({ isOpen, onClose, voucherId }) => {
  const [voucher, setVoucher] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch voucher details when modal opens or voucherId changes
  useEffect(() => {
    if (isOpen && voucherId) {
      fetchVoucherDetails();
    } else if (!isOpen) {
      // Reset state when modal closes
      setVoucher(null);
      setError(null);
    }
  }, [isOpen, voucherId]);

  const fetchVoucherDetails = async () => {
    if (!voucherId) return; // Prevent API call without voucherId
    
    setLoading(true);
    setError(null);

    try {
      const response = await axiosInstance.get(
        `/api/accounts/voucher-entries/${voucherId}/`
      );
      setVoucher(response.data);
    } catch (err) {
      console.error("Error fetching voucher details:", err);
      setError("Failed to load voucher details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  // Format date and time for display
  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return "0.00";
    return parseFloat(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Get status badge class
  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case "draft":
        return "bg-yellow-100 text-yellow-800";
      case "posted":
        return "bg-green-100 text-green-800";
      case "void":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 transition-all duration-300"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col relative animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primaryDark px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <FaEye className="text-white w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">Voucher Details</h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 min-h-[300px]">
              <ModernLoadingAnimation />
              <p className="mt-4 text-gray-600 text-lg">Loading voucher details...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <FaTimes className="text-red-500 text-3xl" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Error Loading Details
              </h3>
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={fetchVoucherDetails}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          ) : voucher ? (
            <div className="space-y-6">
              {/* Header Information */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Voucher Number
                    </label>
                    <p className="text-lg font-bold text-blue-600">
                      {voucher.voucherNumber || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Status
                    </label>
                    <span
                      className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusClass(
                        voucher.status
                      )}`}
                    >
                      {voucher.status?.toUpperCase() || "N/A"}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Voucher Type
                    </label>
                    <p className="text-base font-medium text-gray-900">
                      {voucher.voucherTypeName || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Entry Date
                    </label>
                    <p className="text-base font-medium text-gray-900">
                      {formatDate(voucher.entryDate)}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Reference Number
                    </label>
                    <p className="text-base font-medium text-gray-900">
                      {voucher.referenceNumber || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Created By
                    </label>
                    <p className="text-base font-medium text-gray-900">
                      {voucher.createdByName || "N/A"}
                    </p>
                  </div>
                </div>

                {/* Narration */}
                {voucher.narration && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Narration
                    </label>
                    <p className="text-base text-gray-700">
                      {voucher.narration}
                    </p>
                  </div>
                )}
              </div>

              {/* Voucher Entry Details */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Entry Details
                </h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-[#EBF5F5]">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                            #
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                            Account Code
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                            Account Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-black uppercase tracking-wider">
                            Debit (৳)
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-black uppercase tracking-wider">
                            Credit (৳)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {voucher.details && voucher.details.length > 0 ? (
                          voucher.details.map((detail, index) => (
                            <tr
                              key={detail.id}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {index + 1}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {detail.accountCode || "N/A"}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {detail.accountName || "N/A"}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                {detail.description || "—"}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                                {detail.debitAmount > 0 ? (
                                  <span className="text-red-600">
                                    {formatCurrency(detail.debitAmount)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                                {detail.creditAmount > 0 ? (
                                  <span className="text-green-600">
                                    {formatCurrency(detail.creditAmount)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan="6"
                              className="px-4 py-8 text-center text-gray-500"
                            >
                              No entry details available
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {/* Totals Footer */}
                      <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                        <tr>
                          <td
                            colSpan="4"
                            className="px-4 py-3 text-right font-bold text-gray-900"
                          >
                            Totals:
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right font-bold">
                            <span className="text-red-700">
                              {formatCurrency(voucher.totalDebit || 0)}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right font-bold">
                            <span className="text-green-700">
                              {formatCurrency(voucher.totalCredit || 0)}
                            </span>
                          </td>
                        </tr>
                        {/* Balance Check */}
                        <tr>
                          <td
                            colSpan="6"
                            className="px-4 py-2 text-center text-sm"
                          >
                            {voucher.totalDebit === voucher.totalCredit ? (
                              <span className="text-green-600 font-semibold">
                                ✓ Voucher is balanced
                              </span>
                            ) : (
                              <span className="text-red-600 font-semibold">
                                ⚠ Voucher is not balanced (Difference: ৳
                                {formatCurrency(
                                  Math.abs(
                                    voucher.totalDebit - voucher.totalCredit
                                  )
                                )}
                                )
                              </span>
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              {/* Audit Information */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Audit Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Created By
                    </label>
                    <p className="text-base text-gray-900">
                      {voucher.createdByName || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Created At
                    </label>
                    <p className="text-base text-gray-900">
                      {formatDateTime(voucher.createdAt)}
                    </p>
                  </div>
                  {voucher.postedByName && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Posted By
                        </label>
                        <p className="text-base text-gray-900">
                          {voucher.postedByName}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Posted At
                        </label>
                        <p className="text-base text-gray-900">
                          {formatDateTime(voucher.postedAt)}
                        </p>
                      </div>
                    </>
                  )}
                  {voucher.updatedByName && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Last Updated By
                        </label>
                        <p className="text-base text-gray-900">
                          {voucher.updatedByName}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Last Updated At
                        </label>
                        <p className="text-base text-gray-900">
                          {formatDateTime(voucher.updatedAt)}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primaryDark transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

VoucherDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  voucherId: PropTypes.number
};

export default VoucherDetailModal;
