import { useState, useEffect } from "react";
import { FaTimes, FaSave, FaPlus, FaTrash, FaEdit } from "react-icons/fa";
import PropTypes from "prop-types";
import axiosInstance from "../../utils/axiosInstance";
import AccountHeadSelect from "../../Components/AccountHeadSelect";
import ModernDatePicker from "../../Components/FormComponent/ModernDatePicker";
import MessageBox from "../../Components/MessageBox/MessageBox";
import ModernLoadingAnimation from "../../Components/Loaders/ModernLoadingAnimation";

/**
 * VoucherEditModal Component
 * Allows editing of draft voucher entries with comprehensive validation
 */
const VoucherEditModal = ({ isOpen, onClose, voucherId, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [fetchingVoucher, setFetchingVoucher] = useState(false);
  const [allAccounts, setAllAccounts] = useState([]); // Store all accounts
  const [accounts, setAccounts] = useState([]); // Store filtered accounts based on voucher type
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [voucherTypes, setVoucherTypes] = useState([]);

  // Message states
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState({
    entryDate: "",
    voucherNumber: "",
    referenceNumber: "",
    narration: "",
    voucherType: null,
    status: "draft",
    details: []
  });

  // Fetch voucher details when modal opens
  useEffect(() => {
    if (isOpen && voucherId) {
      fetchVoucherDetails();
      fetchAccounts();
      fetchVoucherTypes();
    }
  }, [isOpen, voucherId]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && !loading) {
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
  }, [isOpen, loading, onClose]);

  const fetchVoucherDetails = async () => {
    setFetchingVoucher(true);
    try {
      const response = await axiosInstance.get(
        `/api/accounts/voucher-entries/${voucherId}/`
      );
      const voucher = response.data;
      
      // Get the voucher type to determine account filtering
      const voucherTypeObj = voucherTypes.find(type => type.id === voucher.voucherType);
      const voucherTypeName = voucherTypeObj ? voucherTypeObj.value.toLowerCase() : '';
      
      // Apply account filtering based on voucher type
      if (allAccounts.length > 0) {
        if (voucherTypeName === 'receipt') {
          // For receipt vouchers (income), show only revenue account heads
          const revenueAccounts = allAccounts.filter(acc => acc.accountType === 'revenue');
          setAccounts(revenueAccounts);
        } else if (voucherTypeName === 'payment') {
          // For payment vouchers (expense), show only expense account heads
          const expenseAccounts = allAccounts.filter(acc => acc.accountType === 'expense');
          setAccounts(expenseAccounts);
        } else {
          // For other types (journal, contra), use all accounts
          setAccounts(allAccounts);
        }
      }

      // Format data for form
      setFormData({
        entryDate: voucher.entryDate || "",
        voucherNumber: voucher.voucherNumber || "",
        referenceNumber: voucher.referenceNumber || "",
        narration: voucher.narration || "",
        voucherType: voucher.voucherType,
        status: voucher.status || "draft",
        details: voucher.details.map((detail) => ({
          id: detail.id,
          lineNumber: detail.lineNumber,
          accountId: detail.accountId,
          description: detail.description || "",
          debitAmount: detail.debitAmount || "",
          creditAmount: detail.creditAmount || ""
        }))
      });
    } catch (error) {
      console.error("Error fetching voucher details:", error);
      setErrorMessage("Failed to load voucher details. Please try again.");
    } finally {
      setFetchingVoucher(false);
    }
  };

  const fetchAccounts = async () => {
    setAccountsLoading(true);
    try {
      const response = await axiosInstance.get("/api/accounts/accounts/");
      const accountsData = Array.isArray(response.data)
        ? response.data
        : response.data.results || [];
      const allActiveAccounts = accountsData.filter((acc) => acc.isActive);
      setAllAccounts(allActiveAccounts);
      setAccounts(allActiveAccounts); // Initially set all accounts
    } catch (error) {
      console.error("Error fetching accounts:", error);
      setErrorMessage("Failed to load accounts. Please refresh the page.");
    } finally {
      setAccountsLoading(false);
    }
  };

  const fetchVoucherTypes = async () => {
    try {
      const response = await axiosInstance.get("/api/accounts/voucher-types/");
      const data = response.data;
      
      // Handle both paginated and direct array responses
      const typesData = Array.isArray(data) ? data : data.results || [];
      
      // Format the data to include both id and value
      const formattedTypes = typesData.map((type) => ({
        id: type.id,
        value: type.name || type.value || type.code || type.name,
        label: type.displayName || type.label || type.name || type.display_name || type.displayName
      }));
      
      setVoucherTypes(formattedTypes);
    } catch (error) {
      console.error("Error fetching voucher types:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDetailChange = (index, field, value) => {
    const newDetails = [...formData.details];
    newDetails[index][field] = value;

    // If entering debit, clear credit and vice versa
    if (field === "debitAmount" && value) {
      newDetails[index].creditAmount = "";
    } else if (field === "creditAmount" && value) {
      newDetails[index].debitAmount = "";
    }

    setFormData((prev) => ({ ...prev, details: newDetails }));
  };

  const handleAccountChange = (index, account) => {
    const newDetails = [...formData.details];
    newDetails[index].accountId = account?.id || "";
    setFormData((prev) => ({ ...prev, details: newDetails }));
  };

  const addDetail = () => {
    const newDetail = {
      lineNumber: formData.details.length + 1,
      accountId: "",
      description: "",
      debitAmount: "",
      creditAmount: ""
    };
    setFormData((prev) => ({ ...prev, details: [...prev.details, newDetail] }));
  };

  const removeDetail = (index) => {
    // Check if this is a receipt or payment voucher
    const voucherTypeObj = voucherTypes.find(type => type.id === formData.voucherType);
    const voucherTypeName = voucherTypeObj ? voucherTypeObj.value.toLowerCase() : '';
    
    if (voucherTypeName === 'receipt' || voucherTypeName === 'payment') {
      // For receipt and payment vouchers, follow specialized form logic
      // Only allow removal of items beyond the first one
      if (index === 0) {
        setErrorMessage(`A ${voucherTypeName === 'receipt' ? 'receipt' : 'payment'} voucher must have at least one line item.`);
        return;
      }
      // Check if we're trying to remove the last user-added item
      if (formData.details.filter((_, i) => i !== index && i !== 0).length < 1) {
        setErrorMessage(`A ${voucherTypeName === 'receipt' ? 'receipt' : 'payment'} voucher must have at least one line item.`);
        return;
      }
    } else {
      // For other voucher types, maintain original logic
      if (formData.details.length <= 2) {
        setErrorMessage("A voucher entry must have at least 2 lines");
        return;
      }
    }
    
    const newDetails = formData.details.filter((_, i) => i !== index);
    // Renumber details
    newDetails.forEach((detail, idx) => {
      detail.lineNumber = idx + 1;
    });
    setFormData((prev) => ({ ...prev, details: newDetails }));
  };

  const calculateTotals = () => {
    const totalDebit = formData.details.reduce(
      (sum, detail) => sum + (parseFloat(detail.debitAmount) || 0),
      0
    );
    const totalCredit = formData.details.reduce(
      (sum, detail) => sum + (parseFloat(detail.creditAmount) || 0),
      0
    );
    return { totalDebit, totalCredit };
  };

  const isBalanced = () => {
    const { totalDebit, totalCredit } = calculateTotals();
    return totalDebit === totalCredit && totalDebit > 0;
  };

  const validateForm = () => {
    if (!formData.entryDate) {
      setErrorMessage("Entry date is required");
      return false;
    }
    
    // Check voucher type to apply specialized validation
    const voucherTypeObj = voucherTypes.find(type => type.id === formData.voucherType);
    const voucherTypeName = voucherTypeObj ? voucherTypeObj.value.toLowerCase() : '';
    
    if (voucherTypeName === 'receipt' || voucherTypeName === 'payment') {
      // For receipt and payment vouchers, ensure at least one line item exists
      if (formData.details.length < 1) {
        setErrorMessage(
          `At least 1 line item is required for a ${voucherTypeName} voucher entry`
        );
        return false;
      }
    } else {
      // For other voucher types, maintain original validation
      if (formData.details.length < 2) {
        setErrorMessage(
          "At least 2 lines are required for a valid voucher entry"
        );
        return false;
      }
    }

    // Validate each detail
    for (let i = 0; i < formData.details.length; i++) {
      const detail = formData.details[i];
      if (!detail.accountId) {
        setErrorMessage(`Line ${i + 1}: Account is required`);
        return false;
      }
      const debit = parseFloat(detail.debitAmount) || 0;
      const credit = parseFloat(detail.creditAmount) || 0;
      if (debit === 0 && credit === 0) {
        setErrorMessage(
          `Line ${i + 1}: Either debit or credit amount is required`
        );
        return false;
      }
      if (debit > 0 && credit > 0) {
        setErrorMessage(
          `Line ${i + 1}: Cannot have both debit and credit amounts`
        );
        return false;
      }
    }

    return true;
  };

  const extractErrorMessage = (error) => {
    if (typeof error === "string") return error;
    if (Array.isArray(error)) {
      return extractErrorMessage(error[0]);
    }
    if (typeof error === "object" && error !== null) {
      if (error.string) return error.string;
      if (error.message) return error.message;
    }
    return String(error);
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const { totalDebit, totalCredit } = calculateTotals();

    if (!isBalanced()) {
      setErrorMessage(
        `Entry is not balanced. Total Debits: ${totalDebit.toFixed(
          2
        )}, Total Credits: ${totalCredit.toFixed(
          2
        )}. Please adjust the amounts to balance the entry.`
      );
      return;
    }

    setLoading(true);
    try {
      const payload = {
        entryDate: formData.entryDate,
        voucherNumber: formData.voucherNumber,
        referenceNumber: formData.referenceNumber || "",
        narration: formData.narration || "",
        voucherType: formData.voucherType,
        status: "draft",
        details: formData.details.map((detail) => ({
          lineNumber: detail.lineNumber,
          accountId: parseInt(detail.accountId),
          description: detail.description || "",
          debitAmount: parseFloat(detail.debitAmount) || 0,
          creditAmount: parseFloat(detail.creditAmount) || 0
        }))
      };

      const response = await axiosInstance.put(
        `/api/accounts/voucher-entries/${voucherId}/`,
        payload
      );

      if (response.data.success) {
        // Call the parent's success handler which handles the success message
        if (onSuccess) {
          onSuccess();
        }
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setErrorMessage(
          response.data.message || "Failed to update voucher. Please try again."
        );
      }
    } catch (error) {
      console.error("Error updating voucher:", error);
      console.error("Error response:", error.response?.data);

      // Extract user-friendly error messages
      let errorMsg = "Failed to update voucher. ";
      if (error.response?.data) {
        const data = error.response.data;
        if (typeof data === "object" && !Array.isArray(data)) {
          const errors = [];
          for (const [field, value] of Object.entries(data)) {
            const message = extractErrorMessage(value);
            errors.push(`${field}: ${message}`);
          }
          if (errors.length > 0) {
            errorMsg += errors.join("; ");
          } else {
            errorMsg += JSON.stringify(data);
          }
        } else {
          errorMsg += extractErrorMessage(data);
        }
      } else {
        errorMsg += "Please check your inputs and try again.";
      }
      setErrorMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      onClose();
    }
  };

  const clearMessage = () => {
    setSuccessMessage("");
    setErrorMessage("");
  };

  if (!isOpen) return null;

  const { totalDebit, totalCredit } = calculateTotals();
  const difference = totalDebit - totalCredit;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 transition-all duration-300"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col relative animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primaryDark px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <FaEdit className="text-white w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">Edit Voucher Entry</h2>
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
          {fetchingVoucher ? (
            <div className="flex flex-col justify-center items-center py-12">
              <ModernLoadingAnimation />
              <p className="mt-4 text-gray-600">Loading voucher details...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Voucher Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6 border-b">
                <div>
                  <ModernDatePicker
                    label="Entry Date"
                    value={formData.entryDate}
                    onChange={(value) =>
                      setFormData((prev) => ({ ...prev, entryDate: value }))
                    }
                    placeholder="Select entry date"
                    required
                    maxDate={new Date().toISOString().split("T")[0]}
                    labelClassName="block text-sm font-medium text-gray-700"
                    inputClassName="h-[42px]"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Voucher Number
                  </label>
                  <input
                    type="text"
                    value={formData.voucherNumber}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reference Number
                  </label>
                  <input
                    type="text"
                    name="referenceNumber"
                    value={formData.referenceNumber}
                    onChange={handleInputChange}
                    disabled={loading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="External reference (optional)"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Narration / Description
                  </label>
                  <textarea
                    name="narration"
                    value={formData.narration}
                    onChange={handleInputChange}
                    disabled={loading}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Description of the transaction..."
                  />
                </div>
              </div>

              {/* Voucher Details */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Voucher Details
                  </h3>
                  <button
                    onClick={addDetail}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primaryDark transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FaPlus /> Add Line
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.details.map((detail, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-700">
                          Line {detail.lineNumber}
                        </h4>
                        {(() => {
                          // Check if this is a receipt or payment voucher
                          const voucherTypeObj = voucherTypes.find(type => type.id === formData.voucherType);
                          const voucherTypeName = voucherTypeObj ? voucherTypeObj.value.toLowerCase() : '';
                          
                          // For receipt and payment vouchers, don't show remove button for the first item
                          if ((voucherTypeName === 'receipt' || voucherTypeName === 'payment') && index === 0) {
                            return null;
                          }
                          
                          // For other vouchers, use original logic
                          const shouldDisable = (voucherTypeName === 'receipt' || voucherTypeName === 'payment') 
                            ? (formData.details.filter((_, i) => i !== index && i !== 0).length < 1) 
                            : (formData.details.length <= 2);
                          
                          const titleText = (voucherTypeName === 'receipt' || voucherTypeName === 'payment')
                            ? (formData.details.filter((_, i) => i !== index && i !== 0).length < 1
                              ? `A ${voucherTypeName} voucher must have at least one line item.`
                              : "Remove line")
                            : (formData.details.length <= 2
                              ? "Minimum 2 lines required"
                              : "Remove line");
                          
                          return (
                            <button
                              onClick={() => removeDetail(index)}
                              disabled={shouldDisable || loading}
                              className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={titleText}
                            >
                              <FaTrash />
                            </button>
                          );
                        })()}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-2">
                          <AccountHeadSelect
                            accountHeads={accounts}
                            value={detail.accountId}
                            onChange={(account) =>
                              handleAccountChange(index, account)
                            }
                            label="Account"
                            placeholder="Select account"
                            required
                            showCode={true}
                            className="w-full"
                            loading={accountsLoading}
                            disabled={loading}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description
                          </label>
                          <input
                            type="text"
                            value={detail.description}
                            onChange={(e) =>
                              handleDetailChange(
                                index,
                                "description",
                                e.target.value
                              )
                            }
                            disabled={loading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            placeholder="Line description"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2 lg:col-span-1">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Debit (৳)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={detail.debitAmount}
                              onChange={(e) =>
                                handleDetailChange(
                                  index,
                                  "debitAmount",
                                  e.target.value
                                )
                              }
                              disabled={loading}
                              className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Credit (৳)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={detail.creditAmount}
                              onChange={(e) =>
                                handleDetailChange(
                                  index,
                                  "creditAmount",
                                  e.target.value
                                )
                              }
                              disabled={loading}
                              className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals Summary */}
                <div className="mt-4 p-4 rounded-md bg-gray-50 border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-600">
                        Total Debit:
                      </span>
                      <p className="text-lg font-semibold text-gray-900">
                        ৳ {totalDebit.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">
                        Total Credit:
                      </span>
                      <p className="text-lg font-semibold text-gray-900">
                        ৳ {totalCredit.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">
                        Difference:
                      </span>
                      <p
                        className={`text-lg font-semibold ${
                          difference === 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        ৳ {Math.abs(difference).toFixed(2)}{" "}
                        {difference !== 0 && (difference > 0 ? "(Dr)" : "(Cr)")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Balance Status */}
                <div className="mt-4 p-4 rounded-md bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Entry Status:</span>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        isBalanced()
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {isBalanced() ? "✓ Balanced" : "⚠ Not Balanced"}
                    </span>
                  </div>
                  {!isBalanced() && totalDebit + totalCredit > 0 && (
                    <p className="text-sm text-gray-600 mt-2">
                      Note: Total debits must equal total credits to save this
                      entry.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-4 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !isBalanced() || fetchingVoucher}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primaryDark transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <FaSave /> Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Message Boxes */}
      <MessageBox
        message={successMessage}
        error={errorMessage}
        clearMessage={clearMessage}
        onOk={clearMessage}
      />
    </div>
  );
};

VoucherEditModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  voucherId: PropTypes.number,
  onSuccess: PropTypes.func
};

export default VoucherEditModal;
