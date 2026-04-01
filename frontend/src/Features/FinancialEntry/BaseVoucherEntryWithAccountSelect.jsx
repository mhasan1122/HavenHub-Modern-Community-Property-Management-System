import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { FaPlus, FaTrash, FaSave, FaFileAlt } from "react-icons/fa";
import axiosInstance from "../../utils/axiosInstance";
import AccountHeadSelect from "../../Components/AccountHeadSelect";
import ModernDatePicker from "../../Components/FormComponent/ModernDatePicker";
import MessageBox from "../../Components/MessageBox/MessageBox";
import ConfirmationMessageBox from "../../Components/MessageBox/ConfirmationMessageBox";
import ModernLoadingAnimation from "../../Components/Loaders/ModernLoadingAnimation";

/**
 * Enhanced BaseVoucherEntry component using the AccountHeadSelect component
 * This version replaces the basic select dropdowns with a searchable account selector
 */
const BaseVoucherEntryWithAccountSelect = ({
  title,
  onSaved,
  accountFilter = null,
  voucherType = ""
}) => {
  const [loading, setLoading] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [voucherTypeId, setVoucherTypeId] = useState(null);

  // Message states
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [pendingAction, setPendingAction] = useState(null);

  const [formData, setFormData] = useState({
    entryDate: new Date().toISOString().split("T")[0],
    voucherNumber: "",
    referenceNumber: "",
    narration: "",
    voucherType: voucherType,
    status: "draft",
    details: [
      {
        lineNumber: 1,
        accountId: "",
        description: "",
        debitAmount: "",
        creditAmount: ""
      },
      {
        lineNumber: 2,
        accountId: "",
        description: "",
        debitAmount: "",
        creditAmount: ""
      }
    ]
  });
  
  // State to hold default account heads
  const [defaultAccountHeads, setDefaultAccountHeads] = useState([]);

  useEffect(() => {
    fetchAccounts();
    fetchVoucherTypes();
    fetchDefaultAccountHeads();
  }, []);
  
  const fetchDefaultAccountHeads = async () => {
    try {
      const response = await axiosInstance.get("/api/accounts/default-account-heads/");
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      setDefaultAccountHeads(data);
    } catch (error) {
      console.error("Error fetching default account heads:", error);
    }
  };

  // Update voucher type when prop changes
  useEffect(() => {
    if (voucherType && voucherTypes.length > 0) {
      const vType = voucherTypes.find(
        (vt) => vt.value.toLowerCase() === voucherType.toLowerCase()
      );
      if (vType) {
        setVoucherTypeId(vType.id);
        setFormData((prev) => ({ ...prev, voucherType }));
      }
    }
  }, [voucherType, voucherTypes]);

  const fetchAccounts = async () => {
    setAccountsLoading(true);
    try {
      const response = await axiosInstance.get("/api/accounts/accounts/");
      // Handle both paginated and direct array responses
      let accountsData = Array.isArray(response.data)
        ? response.data
        : response.data.results || [];
      let filteredAccounts = accountsData.filter((acc) => acc.isActive);

      // Apply account filter if provided
      if (accountFilter) {
        filteredAccounts = filteredAccounts.filter(accountFilter);
      }

      setAccounts(filteredAccounts);
    } catch (error) {
      console.error("Error fetching accounts:", error);
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
        value: type.value || type.code || type.name,
        label: type.label || type.name || type.display_name || type.displayName
      }));

      // If no voucher types are returned from API, use fallback values
      if (formattedTypes.length === 0) {
        console.warn("No voucher types found in database");
        setVoucherTypes([]);
      } else {
        setVoucherTypes(formattedTypes);
      }
    } catch (error) {
      console.error("Error fetching voucher types:", error);
      setVoucherTypes([]);
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

  // Handle account selection from AccountHeadSelect component
  const handleAccountChange = (index, account) => {
    const newDetails = [...formData.details];
    newDetails[index].accountId = account?.id || "";
    
    // Find if this account is associated with a default account head
    const defaultHead = defaultAccountHeads.find(head => head.defaultAccount === account?.id);
    if (defaultHead && defaultHead.defaultEntryType) {
      // Pre-populate the appropriate debit/credit field based on default entry type
      if (defaultHead.defaultEntryType === 'debit') {
        newDetails[index].debitAmount = ""; // Clear any existing value
        newDetails[index].creditAmount = ""; // Clear any existing value
      } else if (defaultHead.defaultEntryType === 'credit') {
        newDetails[index].debitAmount = ""; // Clear any existing value
        newDetails[index].creditAmount = ""; // Clear any existing value
      }
    }
    
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
    if (formData.details.length <= 2) {
      setErrorMessage("A voucher entry must have at least 2 lines");
      return;
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
    if (!voucherTypeId) {
      setErrorMessage(
        "Voucher type could not be determined. Please contact support."
      );
      return false;
    }
    if (!formData.entryDate) {
      setErrorMessage("Entry date is required");
      return false;
    }
    if (formData.details.length < 2) {
      setErrorMessage("At least 2 lines are required");
      return false;
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
      
      // Rule 1: Amount Validation - must be positive (greater than zero)
      if (debit < 0 || credit < 0) {
        setErrorMessage(
          `Line ${i + 1}: Amounts cannot be negative. Please enter positive values only.`
        );
        return false;
      }
      if (debit > 0 && debit <= 0) {
        setErrorMessage(
          `Line ${i + 1}: Debit amount must be greater than zero`
        );
        return false;
      }
      if (credit > 0 && credit <= 0) {
        setErrorMessage(
          `Line ${i + 1}: Credit amount must be greater than zero`
        );
        return false;
      }
    }

    // Rule 3: Account Duplication Prevention
    // Check if same account appears in both debit and credit sides
    const debitAccounts = new Set();
    const creditAccounts = new Set();
    
    for (let i = 0; i < formData.details.length; i++) {
      const detail = formData.details[i];
      const debit = parseFloat(detail.debitAmount) || 0;
      const credit = parseFloat(detail.creditAmount) || 0;
      
      if (debit > 0) {
        debitAccounts.add(detail.accountId);
      }
      if (credit > 0) {
        creditAccounts.add(detail.accountId);
      }
    }
    
    // Find accounts that appear in both debit and credit
    const duplicateAccounts = [...debitAccounts].filter(accId => creditAccounts.has(accId));
    if (duplicateAccounts.length > 0) {
      // Get account name for better error message
      const duplicateAccount = accounts.find(acc => acc.id === parseInt(duplicateAccounts[0]));
      const accountName = duplicateAccount ? duplicateAccount.accountName : 'Unknown Account';
      setErrorMessage(
        `Account "${accountName}" cannot be used in both debit and credit sides. Each account should appear only once per entry.`
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async (postEntry = false) => {
    if (!validateForm()) return;

    const { totalDebit, totalCredit } = calculateTotals();

    // Rule 2: Balancing Requirement - must be balanced for both draft and post
    if (!isBalanced()) {
      setErrorMessage(
        `Entry is not balanced. Total Debits: ৳${totalDebit.toFixed(
          2
        )}, Total Credits: ৳${totalCredit.toFixed(2)}. The entry must be balanced before saving.`
      );
      return;
    }

    setLoading(true);
    try {
      const payload = {
        entryDate: formData.entryDate,
        voucherNumber: formData.voucherNumber || `AUTO-${Date.now()}`,
        referenceNumber: formData.referenceNumber || "",
        narration: formData.narration,
        voucherType: voucherTypeId,
        status: postEntry ? "posted" : "draft",
        details: formData.details.map((detail) => ({
          lineNumber: detail.lineNumber,
          accountId: parseInt(detail.accountId),
          description: detail.description || "",
          debitAmount: parseFloat(detail.debitAmount) || 0,
          creditAmount: parseFloat(detail.creditAmount) || 0
        }))
      };

      const response = await axiosInstance.post(
        "/api/accounts/voucher-entries/",
        payload
      );

      if (response.data.success) {
        setSuccessMessage(
          `Voucher entry ${
            postEntry ? "posted" : "saved as draft"
          } successfully!`
        );
      }
    } catch (error) {
      console.error("Error saving voucher entry:", error);
      console.error("Error response data:", error.response?.data);
      setErrorMessage(
        error.response?.data?.message ||
          JSON.stringify(error.response?.data) ||
          "Error saving voucher entry"
      );
    } finally {
      setLoading(false);
    }
  };

  const { totalDebit, totalCredit } = calculateTotals();
  const difference = totalDebit - totalCredit;

  // Clear all messages
  const clearMessage = () => {
    setSuccessMessage("");
    setErrorMessage("");
    setConfirmMessage("");
    setPendingAction(null);
  };

  // Handle success message OK button
  const handleSuccessOk = () => {
    clearMessage();
    if (onSaved) {
      onSaved();
    }
  };

  // Handle confirmation
  const handleConfirm = () => {
    if (pendingAction) {
      pendingAction();
    }
    clearMessage();
  };

  return (
    <div>
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
          <ModernLoadingAnimation />
        </div>
      )}

      <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">{title}</h2>

      {/* Voucher Header */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6 pb-6 border-b">
        <div className="md:col-span-3">
          <ModernDatePicker
            label="Entry Date"
            value={formData.entryDate}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, entryDate: value }))
            }
            placeholder="Select entry date"
            name="entryDate"
            required
            maxDate={new Date().toISOString().split("T")[0]}
            labelClassName="block text-sm font-medium text-gray-700"
            inputClassName="h-[42px]"
          />
        </div>

        <div className="md:col-span-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reference Number
          </label>
          <input
            type="text"
            name="referenceNumber"
            value={formData.referenceNumber}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm sm:text-base"
            placeholder="External reference (optional)"
          />
        </div>

        <div className="md:col-span-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Narration / Description
          </label>
          <textarea
            name="narration"
            value={formData.narration}
            onChange={handleInputChange}
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm sm:text-base"
            placeholder="Description of the transaction..."
          />
        </div>
      </div>

      {/* Voucher Details */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-3 sm:mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800">
            Voucher Details
          </h3>
          <button
            onClick={addDetail}
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-primary text-white rounded-lg hover:bg-primaryDark transition-colors font-medium shadow-sm text-sm sm:text-base w-full sm:w-auto"
          >
            <FaPlus /> Add Line
          </button>
        </div>

        {/* Details List - Using AccountHeadSelect */}
        <div className="space-y-3 sm:space-y-4">
          {formData.details.map((detail, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between mb-2 sm:mb-3">
                <h4 className="text-xs sm:text-sm font-semibold text-gray-700">
                  Line {detail.lineNumber}
                </h4>
                <button
                  onClick={() => removeDetail(index)}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed p-1"
                  disabled={formData.details.length <= 2}
                  title={
                    formData.details.length <= 2
                      ? "Minimum 2 lines required"
                      : "Remove line"
                  }
                >
                  <FaTrash size={14} className="sm:w-4 sm:h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Account Selection using AccountHeadSelect */}
                <div className="lg:col-span-2">
                  <div className="mb-1">
                    <AccountHeadSelect
                      accountHeads={accounts}
                      value={detail.accountId}
                      onChange={(account) => handleAccountChange(index, account)}
                      label="Account"
                      placeholder="Select account"
                      required
                      showCode={true}
                      className="w-full"
                      loading={accountsLoading}
                    />
                    {/* Show default entry type indicator if applicable */}
                    {detail.accountId && (
                      () => {
                        const selectedAccount = accounts.find(acc => acc.id === parseInt(detail.accountId));
                        const defaultHead = selectedAccount ? defaultAccountHeads.find(head => head.defaultAccount === selectedAccount.id) : null;
                        return defaultHead && defaultHead.defaultEntryType ? (
                          <div className="mt-1 text-xs">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${defaultHead.defaultEntryType === 'debit' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                              Default: {defaultHead.defaultEntryType.toUpperCase()}
                            </span>
                          </div>
                        ) : null;
                      }
                    )()
                    }
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={detail.description}
                    onChange={(e) =>
                      handleDetailChange(index, "description", e.target.value)
                    }
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Line description"
                  />
                </div>

                {/* Amount columns */}
                <div className="grid grid-cols-2 gap-2 lg:col-span-1">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Debit (৳)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={detail.debitAmount}
                      onChange={(e) =>
                        handleDetailChange(index, "debitAmount", e.target.value)
                      }
                      className="w-full px-2 py-1.5 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
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
                      className="w-full px-2 py-1.5 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Totals Summary */}
        <div className="mt-3 sm:mt-4 p-3 sm:p-4 rounded-md bg-gray-50 border border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <span className="text-xs sm:text-sm font-medium text-gray-600">
                Total Debit:
              </span>
              <p className="text-base sm:text-lg font-semibold text-gray-900">
                ৳ {totalDebit.toFixed(2)}
              </p>
            </div>
            <div>
              <span className="text-xs sm:text-sm font-medium text-gray-600">
                Total Credit:
              </span>
              <p className="text-base sm:text-lg font-semibold text-gray-900">
                ৳ {totalCredit.toFixed(2)}
              </p>
            </div>
            <div>
              <span className="text-xs sm:text-sm font-medium text-gray-600">
                Difference:
              </span>
              <p
                className={`text-base sm:text-lg font-semibold ${
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
        <div className="mt-3 sm:mt-4 p-3 sm:p-4 rounded-md bg-gray-50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
            <span className="text-xs sm:text-sm font-medium">Entry Status:</span>
            <span
              className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${
                isBalanced()
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {isBalanced() ? "✓ Balanced" : "⚠ Not Balanced"}
            </span>
          </div>
          {!isBalanced() && totalDebit + totalCredit > 0 && (
            <p className="text-xs sm:text-sm text-gray-600 mt-2">
              Note: Total debits must equal total credits to post this entry.
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-4 pt-4 sm:pt-6 border-t">
        <button
          onClick={() => window.location.reload()}
          className="px-4 sm:px-6 py-2 sm:py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium shadow-sm text-sm sm:text-base justify-center"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          onClick={() => handleSubmit(false)}
          className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          disabled={loading || !isBalanced()}
          title={!isBalanced() ? "Entry must be balanced to save" : ""}
        >
          <FaSave /> Save as Draft
        </button>
        <button
          onClick={() => handleSubmit(true)}
          className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-primary text-white rounded-lg hover:bg-primaryDark transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          disabled={loading || !isBalanced()}
          title={!isBalanced() ? "Entry must be balanced to post" : ""}
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Posting...
            </>
          ) : (
            <>
              <FaFileAlt /> Post Entry
            </>
          )}
        </button>
      </div>

      {/* Message Boxes */}
      <MessageBox
        message={successMessage}
        error={errorMessage}
        clearMessage={clearMessage}
        onOk={successMessage ? handleSuccessOk : clearMessage}
      />

      <ConfirmationMessageBox
        message={confirmMessage}
        onConfirm={handleConfirm}
        onCancel={clearMessage}
        confirmText="Yes"
        cancelText="No"
        isLoading={loading}
      />
    </div>
  );
};

BaseVoucherEntryWithAccountSelect.propTypes = {
  title: PropTypes.string.isRequired,
  onSaved: PropTypes.func,
  accountFilter: PropTypes.func,
  voucherType: PropTypes.string
};

export default BaseVoucherEntryWithAccountSelect;
