import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { FaPlus, FaTrash, FaSave } from "react-icons/fa";
import axiosInstance from "../../utils/axiosInstance";
import AccountHeadSelect from "../../Components/AccountHeadSelect";
import ModernDatePicker from "../../Components/FormComponent/ModernDatePicker";
import MessageBox from "../../Components/MessageBox/MessageBox";
import ConfirmationMessageBox from "../../Components/MessageBox/ConfirmationMessageBox";
import ModernLoadingAnimation from "../../Components/Loaders/ModernLoadingAnimation";

/**
 * Specialized Payment Voucher form with automatic debit/credit assignment
 * - Main account head at top restricted to Bank/Cash accounts
 * - Line items restricted to Payable accounts (creditors/suppliers)
 * - Automatic debit/credit: money flowing OUT (payment) - selected payable account gets credited, bank/cash account gets debited
 */
const SpecializedPaymentVoucher = ({
  title,
  onSaved,
  voucherType = "payment"
}) => {
  const [loading, setLoading] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [bankCashAccounts, setBankCashAccounts] = useState([]); // For main account selection
  const [payableAccounts, setPayableAccounts] = useState([]); // For line items
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [voucherTypeId, setVoucherTypeId] = useState(null);

  // Message states
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [pendingAction, setPendingAction] = useState(null);

  // Main account head (Bank/Cash) selected
  const [mainAccountHead, setMainAccountHead] = useState(null);

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
      }
    ]
  });

  // State to hold default account heads
  const [defaultAccountHeads, setDefaultAccountHeads] = useState([]);

  useEffect(() => {
    const initialize = async () => {
      const heads = await fetchDefaultAccountHeads();
      fetchAccounts(heads);
      fetchVoucherTypes();
    };
    initialize();
  }, []);

  const fetchDefaultAccountHeads = async () => {
    try {
      const response = await axiosInstance.get("/api/accounts/default-account-heads/");
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      setDefaultAccountHeads(data);
      return data;
    } catch (error) {
      console.error("Error fetching default account heads:", error);
      return [];
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

  const fetchAccounts = async (defaultHeads = defaultAccountHeads) => {
    setAccountsLoading(true);
    try {
      const response = await axiosInstance.get("/api/accounts/accounts/");
      // Handle both paginated and direct array responses
      let accountsData = Array.isArray(response.data)
        ? response.data
        : response.data.results || [];
      let filteredAccounts = accountsData.filter((acc) => acc.isActive);

      setAccounts(filteredAccounts);

      // Filter accounts for specific purposes - Use same logic as ContraEntryTab
      // 1. Identification by default account head configuration (most accurate)
      const cceDefaultHead = defaultHeads.find(h => h.transactionType?.toLowerCase() === 'cce');
      const cceAccountId = cceDefaultHead?.defaultAccount;
      
      const bankCashDefaultIds = new Set(
        defaultHeads
          .filter(h => ['cash', 'bank', 'mfs', 'cce'].includes(h.transactionType?.toLowerCase()))
          .map(h => h.defaultAccount)
      );

      const bankCashAccs = filteredAccounts.filter(acc => {
        // If it's explicitly set as a bank/cash/cce default account
        if (bankCashDefaultIds.has(acc.id)) return true;
        
        // If its parent is the CCE account
        if (cceAccountId && (acc.parentAccount === cceAccountId || acc.parent_account === cceAccountId)) {
          return true;
        }

        // If it follows the traditional naming/coding convention
        if (acc.accountType === 'asset' && acc.accountCode && 
           (acc.accountCode.startsWith('111') || acc.accountCode.startsWith('112'))) {
          return true;
        }

        // Fallback: If name suggests it's a bank or cash account
        const name = acc.accountName?.toLowerCase() || '';
        if (acc.accountType === 'asset' && 
           (name.includes('bank') || name.includes('cash') || name.includes('mfs') || 
            name.includes('bkash') || name.includes('nagad') || name.includes('rocket'))) {
          return true;
        }

        return false;
      });
      setBankCashAccounts(bankCashAccs);

      // For payment vouchers (expenses), show only expense account heads
      const payableAccs = filteredAccounts.filter(acc => 
        acc.accountType === 'expense'
      );
      setPayableAccounts(payableAccs);
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

  const handleMainAccountChange = (account) => {
    setMainAccountHead(account);
  };

  const handleDetailChange = (index, field, value) => {
    const newDetails = [...formData.details];
    newDetails[index][field] = value;

    // For payment vouchers, when money flows out:
    // - Selected payable account gets DEBITED
    // - Main bank/cash account gets CREDITED
    
    // Calculate total amount to be credited to the main account (sum of all debits in line items)
    const totalDebitAmount = newDetails.reduce((sum, detail) => {
      // Skip the main account line itself
      if (detail.isMainAccount) return sum;
      return sum + (parseFloat(detail.debitAmount) || 0);
    }, 0);

    // Update or add the main account line with the total credit amount
    const mainAccountIndex = newDetails.findIndex(detail => detail.isMainAccount);
    if (mainAccountIndex !== -1) {
      // Update existing main account line
      newDetails[mainAccountIndex].creditAmount = totalDebitAmount.toString();
      newDetails[mainAccountIndex].debitAmount = "";
    } else if (mainAccountHead && totalDebitAmount > 0) {
      // Add main account line if it doesn't exist and there's a debit amount
      newDetails.push({
        lineNumber: newDetails.length + 1,
        accountId: mainAccountHead.id,
        description: `Payment from ${mainAccountHead.accountName}`,
        debitAmount: "",
        creditAmount: totalDebitAmount.toString(),
        isMainAccount: true
      });
    } else if (mainAccountHead && totalDebitAmount === 0) {
      // Remove main account line if there's no debit amount
      if (mainAccountIndex !== -1) {
        newDetails.splice(mainAccountIndex, 1);
      }
    }

    setFormData((prev) => ({ ...prev, details: newDetails }));
  };

  // Handle account selection from AccountHeadSelect component for line items
  const handleAccountChange = (index, account) => {
    const newDetails = [...formData.details];
    newDetails[index].accountId = account?.id || "";
    
    // For payment vouchers: when money flows OUT, the selected payable account gets DEBITED
    // and the main bank/cash account gets CREDITED
    newDetails[index].debitAmount = newDetails[index].creditAmount ? "" : newDetails[index].debitAmount;
    
    // Find if this account is associated with a default account head
    const defaultHead = defaultAccountHeads.find(head => head.defaultAccount === account?.id);
    if (defaultHead && defaultHead.defaultEntryType) {
      // For payment vouchers, payable accounts are typically debited
      if (defaultHead.defaultEntryType === 'debit') {
        newDetails[index].debitAmount = newDetails[index].creditAmount ? "" : newDetails[index].debitAmount;
      }
    }
    
    setFormData((prev) => ({ ...prev, details: newDetails }));
  };

  const addDetail = () => {
    if (!mainAccountHead) {
      setErrorMessage("Please select the main Bank/Cash account first");
      return;
    }
    
    const newDetail = {
      lineNumber: formData.details.length + 1,
      accountId: "",
      description: "",
      debitAmount: "", // For payment vouchers, line items are debited (expense)
      creditAmount: ""
    };
    setFormData((prev) => ({ ...prev, details: [...prev.details, newDetail] }));
  };

  const removeDetail = (index) => {
    if (formData.details.filter(d => !d.isMainAccount).length <= 1) {
      setErrorMessage("A voucher entry must have at least 1 payable line item");
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
    if (!mainAccountHead) {
      setErrorMessage("Main Bank/Cash account is required");
      return false;
    }
    if (!formData.entryDate) {
      setErrorMessage("Entry date is required");
      return false;
    }
    if (formData.details.filter(d => !d.isMainAccount).length < 1) {
      setErrorMessage("At least 1 payable line item is required");
      return false;
    }

    // Validate each detail
    for (let i = 0; i < formData.details.length; i++) {
      const detail = formData.details[i];
      
      // Skip validation for the main account line if it exists
      if (detail.isMainAccount) continue;
      
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
      // Skip the main account line for duplication check
      if (detail.isMainAccount) continue;
      
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
      // Prepare details ensuring the main account (bank/cash) is properly set as credit
      const preparedDetails = formData.details.map((detail) => {
        // For payment vouchers, the main account (bank/cash) should be credited
        if (detail.isMainAccount) {
          return {
            ...detail,
            accountId: parseInt(mainAccountHead.id),
            description: detail.description || `Payment from ${mainAccountHead.accountName}`
          };
        }
        return detail;
      });

      const payload = {
        entryDate: formData.entryDate,
        voucherNumber: formData.voucherNumber || `PV-${Date.now()}`,
        referenceNumber: formData.referenceNumber || "",
        narration: formData.narration,
        voucherType: voucherTypeId,
        status: postEntry ? "posted" : "draft",
        details: preparedDetails.map((detail) => ({
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
          `Payment voucher entry ${
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

      <h2 className="text-xl font-semibold text-gray-800 mb-4">{title}</h2>

      {/* Voucher Header */}
      <div className="mb-6 pb-6 border-b">
        {/* Main Account Head, Entry Date, and Reference Number in a single row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
          {/* Entry Date - 3 columns */}
          <div className="md:col-span-3">
            <ModernDatePicker
              label="Entry Date*"
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
          
          {/* Reference Number - 4 columns */}
          <div className="md:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reference Number
            </label>
            <input
              type="text"
              name="referenceNumber"
              value={formData.referenceNumber}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="External reference (optional)"
            />
          </div>
          
          {/* Main Account Head Selection - Bank/Cash only - 5 columns */}
          <div className="md:col-span-5">
            <AccountHeadSelect
              accountHeads={bankCashAccounts}
              value={mainAccountHead?.id}
              onChange={handleMainAccountChange}
              label="Main Account Head (Bank/Cash)*"
              placeholder="Select Bank or Cash Account"
              required
              showCode={true}
              className="w-full"
              loading={accountsLoading}
            />
            {mainAccountHead && (
              <div className="mt-2 text-sm text-gray-600">
                <span className="font-medium">Selected:</span> {mainAccountHead.accountName} ({mainAccountHead.accountCode})
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Narration / Description
          </label>
          <textarea
            name="narration"
            value={formData.narration}
            onChange={handleInputChange}
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Description of the payment transaction..."
          />
        </div>
      </div>

      {/* Voucher Details */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Payment Details
          </h3>
          <button
            onClick={addDetail}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primaryDark transition-colors font-medium shadow-sm"
          >
            <FaPlus /> Add Line
          </button>
        </div>

        {/* Details List - Using AccountHeadSelect */}
        <div className="space-y-4">
          {formData.details.map((detail, index) => {
            // Skip the main account line in the UI display since it's handled automatically
            if (detail.isMainAccount) return null;
            
            return (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700">
                    Line {detail.lineNumber}
                  </h4>
                  {index > 0 && (
                    <button
                      onClick={() => removeDetail(index)}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={formData.details.length <= 2}
                      title={
                        formData.details.length <= 2
                          ? "Minimum 2 lines required"
                          : "Remove payable"
                      }
                    >
                      <FaTrash />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Account Selection using AccountHeadSelect - Restricted to Payable accounts */}
                  <div className="lg:col-span-2">
                    <div className="mb-1">
                      <AccountHeadSelect
                        accountHeads={payableAccounts}
                        value={detail.accountId}
                        onChange={(account) => handleAccountChange(index, account)}
                        label="Account"
                        placeholder="Select creditor/supplier account"
                        required
                        showCode={true}
                        className="w-full"
                        loading={accountsLoading}
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <input
                      type="text"
                      value={detail.description}
                      onChange={(e) =>
                        handleDetailChange(index, "description", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Payment description"
                    />
                  </div>

                  {/* Amount column - For payment vouchers, we only show one amount field (debit for payables) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount (৳)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={detail.debitAmount}
                      onChange={(e) =>
                        handleDetailChange(index, "debitAmount", e.target.value)
                      }
                      className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="0.00"
                    />
                    <div className="mt-1 text-xs text-gray-500">
                      Will be debited from payable account
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
              Note: Total debits must equal total credits to post this entry.
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-end gap-4 pt-6 border-t">
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium shadow-sm"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          onClick={() => handleSubmit(false)}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading || !isBalanced() || !mainAccountHead}
          title={!isBalanced() ? "Entry must be balanced to save" : ""}
        >
          <FaSave /> Save as Draft
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

SpecializedPaymentVoucher.propTypes = {
  title: PropTypes.string.isRequired,
  onSaved: PropTypes.func,
  voucherType: PropTypes.string
};

export default SpecializedPaymentVoucher;