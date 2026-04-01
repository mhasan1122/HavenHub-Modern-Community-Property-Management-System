import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { FaEdit, FaHistory, FaTrash } from "react-icons/fa";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";
import { useServiceFees } from "../../../../hooks/useServiceFees";
import ServiceFeeHistoryModal from "../ServiceFeeHistory/ServiceFeeHistoryModal";
import EditServiceFeeForm from "../ServiceFeeEditForm/EditServiceFeeForm";
import ConfirmationMessageBox from "../../../../Components/MessageBox/ConfirmationMessageBox";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import { PERMISSIONS } from "../../../../constants/permissions";
import ArrowHeading from "../../../../Components/HeadingComponent/ArrowHeading";
import PageContainer from "../../../../Components/Ui/PageContainer";
import { naturalSort } from "../../../../utils/serviceFeeUtils";

/**
 * Returns the ordinal suffix for a day number (st, nd, rd, th)
 * @param {number} day - The day number
 * @returns {string} - The ordinal suffix
 */
const getOrdinalSuffix = (day) => {
  const num = parseInt(day, 10) || 1;
  const lastDigit = num % 10;
  const lastTwoDigits = num % 100;

  // Special cases for 11th, 12th, 13th
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return 'th';
  }

  // Regular cases
  if (lastDigit === 1) return 'st';
  if (lastDigit === 2) return 'nd';
  if (lastDigit === 3) return 'rd';
  return 'th';
};

const ViewServiceFeeSettings = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((state) => state.auth.user);
  const permissionIds = user?.permission_ids?.map(String) || [];
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Permission checks - Strictly depend on permission IDs
  const canEdit = permissionIds.includes(String(PERMISSIONS.EDIT_SERVICE_FEE_SETTINGS));
  const canArchive = permissionIds.includes(String(PERMISSIONS.EDIT_SERVICE_FEE_SETTINGS));

  // Check if coming from cancelled list
  const searchParams = new URLSearchParams(location.search);
  const isFromCancelled = searchParams.get('from') === 'cancelled';

  const {
    selectedServiceFee,
    loading,
    error,
    deleting,
    deleteSuccess,
    deleteError,
    message,
    loadServiceFee,
    clearSelection,
    removeServiceFee,
    clearAllErrors,
    clearSuccessMessages
  } = useServiceFees();

  // Fetch service fee details
  useEffect(() => {
    if (id) {
      loadServiceFee(id);
    }

    // Cleanup on unmount
    return () => {
      clearSelection();
      clearSuccessMessages();
      clearAllErrors();
    };
  }, [id]); // Remove loadServiceFee and clearSelection from dependencies to prevent infinite loop

  const handleBack = () => {
    if (isFromCancelled) {
      navigate('/service-fee-settings/cancelled');
    } else {
      navigate('/service-fee-settings');
    }
  };

  const handleEdit = () => {
    setShowEditModal(true);
  };

  const handleHistory = () => {
    setShowHistoryModal(true);
  };

  const handleCancel = () => {
    setCancelMessage("Are you sure you want to delete this service fee setting? This action will deactivate the service fee and move it to the Archived list.");
    setShowCancelConfirmation(true);
  };

  const handleCancelConfirm = async () => {
    try {
      await removeServiceFee(id);
      setShowCancelConfirmation(false);
      setCancelMessage("");
    } catch (error) {
      console.error("Error cancelling service fee:", error);
    }
  };

  const handleCancelCancel = () => {
    setShowCancelConfirmation(false);
    setCancelMessage("");
  };

  const clearSuccessMessage = () => {
    setShowSuccessMessage(false);
    setSuccessMessage("");
  };

  const handleSuccessOk = () => {
    clearSuccessMessage();
    // Clear all success states to prevent showing message when navigating back
    clearSuccessMessages();
    // Navigate to cancel list after success
    navigate('/service-fee-settings/cancelled');
  };

  // Handle success/error messages
  useEffect(() => {
    if (deleteSuccess && message) {
      setSuccessMessage("Service fee archived successfully");
      setShowSuccessMessage(true);
      const timer = setTimeout(() => {
        clearSuccessMessages();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [deleteSuccess, message, clearSuccessMessages]);

  useEffect(() => {
    if (deleteError) {
      setSuccessMessage("Failed to cancel service fee. Please try again.");
      setShowSuccessMessage(true);
      const timer = setTimeout(() => {
        clearAllErrors();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [deleteError, clearAllErrors]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ModernLoadingAnimation />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {error.message || error}
        </div>
      </div>
    );
  }

  if (!selectedServiceFee) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">Service fee not found</div>
      </div>
    );
  }

  const serviceFee = selectedServiceFee;

  return (
    <PageContainer className="min-h-screen bg-surfaceMuted">
      {/* Success/Error Message Modal */}
      <MessageBox
        message={deleteSuccess ? successMessage : null}
        error={deleteError ? successMessage : null}
        clearMessage={clearSuccessMessage}
        onOk={handleSuccessOk}
      />

      <div className="md:sticky top-0 z-20 mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surfaceMuted/95 py-4 md:backdrop-blur -mx-6 px-6">
        <div
          onClick={handleBack}
          className="inline-flex cursor-pointer items-center gap-3 text-[#0F172A] transition-colors hover:text-primary"
        >
          <ArrowHeading title="View Service Fee Settings" size="2xl" color="text-black" />
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {canArchive && (
            <button
              onClick={handleCancel}
              disabled={isFromCancelled}
              className={`flex items-center justify-center px-4 py-2 bg-white border border-secondary text-gray-700 rounded-lg transition-colors w-full sm:w-auto ${isFromCancelled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-gray-50'
                }`}
            >
              <FaTrash className="w-4 h-4 mr-2" />
              Archive
            </button>
          )}
          <button
            onClick={handleHistory}
            className="flex items-center justify-center px-4 py-2 bg-white border border-primary text-gray-700 rounded-lg hover:bg-gray-50 transition-colors w-full sm:w-auto"
          >
            <FaHistory className="w-4 h-4 mr-2" />
            History
          </button>
          {canEdit && (
            <button
              onClick={handleEdit}
              disabled={isFromCancelled}
              className={`flex items-center justify-center px-4 py-2 bg-white border border-primary text-gray-700 rounded-lg transition-colors w-full sm:w-auto ${isFromCancelled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-primary-dark'
                }`}
            >
              <FaEdit className="w-4 h-4 mr-2" />
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="max-h-[calc(100vh-180px)] overflow-y-auto">
        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
          {/* Service Fee Settings Section */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-base sm:text-lg font-semibold text-primary mb-4 sm:mb-6">Service Fee Settings</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-4 sm:mb-6">
              {/* Tower Name */}
              <div>
                <label className="block text-sm font-medium text-primary mb-2">Tower Name</label>
                <div className="text-sm sm:text-base text-gray-900 break-words overflow-hidden">
                  <span className="block" title={serviceFee.tower_names?.length > 0 ? serviceFee.tower_names.join(", ") : "All"}>
                    {serviceFee.tower_names?.length > 0 ? serviceFee.tower_names.join(", ") : "All"}
                  </span>
                </div>
              </div>

              {/* Units */}
              <div>
                <label className="block text-sm font-medium text-primary mb-2">Units</label>
                <div className="text-sm sm:text-base text-gray-900">
                  {(() => {
                    // If specific units are selected, check if it's all units from the tower
                    if (serviceFee.unit_names && serviceFee.unit_names.length > 0) {
                      // If all units from the tower are selected, show "All"
                      if (serviceFee.total_units_in_towers &&
                        serviceFee.unit_names.length === serviceFee.total_units_in_towers) {
                        return "All";
                      }
                      // Otherwise show the specific unit names
                      return [...serviceFee.unit_names].sort(naturalSort).join(", ");
                    }
                    // If towers are selected but no specific units, show "All"
                    if (serviceFee.tower_names?.length > 0 && (!serviceFee.unit_names || serviceFee.unit_names.length === 0)) {
                      return "All";
                    }
                    // Fallback to "All"
                    return "All";
                  })()}
                </div>
              </div>

              {/* Fee Amount */}
              <div>
                <label className="block text-sm font-medium text-primary mb-2">Fee Amount (BDT)</label>
                <div className="text-sm sm:text-base text-gray-900">
                  {serviceFee.currency === 'BDT' ? '৳' : '$'}{serviceFee.fee_amount}
                </div>
              </div>

              {/* Service Fee Date */}
              <div>
                <label className="block text-sm font-medium text-primary mb-2">Service Fee Date</label>
                <div className="text-sm sm:text-base text-gray-900">
                  {serviceFee.service_fee_date
                    ? new Date(serviceFee.service_fee_date).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    }).replace(/\//g, '-')
                    : 'Not specified'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {/* Billing Cycle */}
              <div>
                <label className="block text-sm font-medium text-primary mb-2">Billing Cycle</label>
                <div className="text-sm sm:text-base text-gray-900">
                  {serviceFee.billing_cycle}
                </div>
              </div>

              {/* Due Day */}
              <div>
                <label className="block text-sm font-medium text-primary mb-2">Due Day of the Month</label>
                <div className="text-sm sm:text-base text-gray-900">
                  {serviceFee.due_day}<sup>{getOrdinalSuffix(serviceFee.due_day)}</sup> of every month
                </div>
              </div>

              {/* Payment Methods */}
              <div className="sm:col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-primary mb-2">Accepted Payment Methods</label>
                <div className="text-sm sm:text-base text-gray-900">
                  {(() => {
                    const methods = [];
                    if (serviceFee.accepts_cash) methods.push('Cash');
                    if (serviceFee.accepts_mfs && serviceFee.mfs_accounts) {
                      const mfsProviders = serviceFee.mfs_accounts.map(acc => acc.provider);
                      methods.push(...mfsProviders);
                    } else if (serviceFee.accepts_mfs) {
                      methods.push('MFS');
                    }
                    if (serviceFee.accepts_bank) methods.push('Bank');
                    return methods.join(', ') || 'None';
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Settings Section */}
          {(serviceFee.accepts_mfs && serviceFee.mfs_accounts && serviceFee.mfs_accounts.length > 0) ||
            (serviceFee.accepts_bank && serviceFee.bank_account) ? (
            <div className="mb-6 sm:mb-8">
              <h2 className="text-base sm:text-lg font-semibold text-primary mb-4 sm:mb-6">Payment Settings</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                {/* MFS Details */}
                {serviceFee.accepts_mfs && serviceFee.mfs_accounts && serviceFee.mfs_accounts.length > 0 &&
                  serviceFee.mfs_accounts.map((account, index) => (
                    <div key={index}>
                      <h3 className="text-sm font-medium text-primary mb-4">{account.provider} Detail</h3>
                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center">
                          <span className="text-xs sm:text-sm text-gray-900 font-medium sm:min-w-[60px]">Name: </span>
                          <span className="text-xs sm:text-sm text-gray-900 break-words">{account.account_name}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center">
                          <span className="text-xs sm:text-sm text-gray-900 font-medium sm:min-w-[60px]">Number: </span>
                          <span className="text-xs sm:text-sm text-gray-900 break-words">{account.account_number}</span>
                        </div>
                      </div>
                    </div>
                  ))
                }

                {/* Bank Detail */}
                {serviceFee.accepts_bank && serviceFee.bank_account && (
                  <div>
                    <h3 className="text-sm font-medium text-primary mb-4">Bank Detail</h3>
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center">
                        <span className="text-xs sm:text-sm text-gray-900 font-medium sm:min-w-[100px]">Bank Name: </span>
                        <span className="text-xs sm:text-sm text-gray-900 break-words">{serviceFee.bank_account.bank_name}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center">
                        <span className="text-xs sm:text-sm text-gray-900 font-medium sm:min-w-[100px]">Account Name: </span>
                        <span className="text-xs sm:text-sm text-gray-900 break-words">{serviceFee.bank_account.account_holder_name}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-start">
                        <span className="text-xs sm:text-sm text-gray-900 font-medium sm:min-w-[100px]">Account Number: </span>
                        <span className="text-xs sm:text-sm text-gray-900 break-all">{serviceFee.bank_account.account_number}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center">
                        <span className="text-xs sm:text-sm text-gray-900 font-medium sm:min-w-[100px]">Branch: </span>
                        <span className="text-xs sm:text-sm text-gray-900 break-words">{serviceFee.bank_account.branch_name}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center">
                        <span className="text-xs sm:text-sm text-gray-900 font-medium sm:min-w-[100px]">Routing Number: </span>
                        <span className="text-xs sm:text-sm text-gray-900 break-words">{serviceFee.bank_account.routing_number}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Late Payment Penalties Section */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-base sm:text-lg font-semibold text-primary mb-4 sm:mb-6">Late Payment Penalties</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-2">Status</label>
                <div className="text-sm sm:text-base text-gray-900">
                  {serviceFee.late_payment_enabled ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-green-100 text-green-800">
                      Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-gray-100 text-gray-800">
                      Disabled
                    </span>
                  )}
                </div>
              </div>

              {serviceFee.late_payment_enabled && (
                <div>
                  <label className="block text-sm font-medium text-primary mb-3">Penalty Tiers</label>
                  {serviceFee.late_penalty_tiers && Array.isArray(serviceFee.late_penalty_tiers) && serviceFee.late_penalty_tiers.length > 0 ? (
                    <div className="space-y-3">
                      {[...serviceFee.late_penalty_tiers]
                        .sort((a, b) => (a.days_overdue || 0) - (b.days_overdue || 0))
                        .map((tier, index) => (
                          <div
                            key={index}
                            className="p-3 sm:p-4 border border-gray-200 rounded-lg bg-gray-50"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <span className="text-xs sm:text-sm font-medium text-gray-700">Days Overdue:</span>
                                <span className="text-sm sm:text-base text-gray-900 ml-2">{tier.days_overdue || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-xs sm:text-sm font-medium text-gray-700">Penalty Percentage:</span>
                                <span className="text-sm sm:text-base text-gray-900 ml-2">{tier.penalty_percentage || 'N/A'}%</span>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="p-3 sm:p-4 border border-gray-200 rounded-lg bg-gray-50 text-center text-xs sm:text-sm text-gray-500">
                      No penalty tiers configured
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History Modal */}
      <ServiceFeeHistoryModal
        visible={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        serviceFeeId={id}
        serviceFeeData={selectedServiceFee}
      />

      {/* Edit Modal */}
      {showEditModal && (
        <EditServiceFeeForm
          id={id}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            loadServiceFee(id);
          }}
        />
      )}

      {/* Cancel Confirmation Modal */}
      <ConfirmationMessageBox
        message={cancelMessage}
        onConfirm={handleCancelConfirm}
        onCancel={handleCancelCancel}
      />
    </PageContainer>
  );
};

export default ViewServiceFeeSettings;