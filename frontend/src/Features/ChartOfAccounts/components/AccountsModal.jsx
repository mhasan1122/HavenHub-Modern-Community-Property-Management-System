import { useState, useEffect, useCallback } from "react";
import { useDispatch } from "react-redux";
import PropTypes from "prop-types";
import { FaTimes } from "react-icons/fa";
import {
  createAccount,
  updateAccount
} from "../../../redux/slices/chartOfAccounts/chartOfAccountsSlice";
import axiosInstance from "../../../utils/axiosInstance";
import ModernLoadingAnimation from "../../../Components/Loaders/ModernLoadingAnimation";
import Calendar from "../../../Components/Calendar/Calendar";

const AccountsModal = ({
  isOpen,
  title,
  account,
  parentAccountId,
  parentAccountType,
  onClose,
  onSave,
  isEdit = false,
  onSuccess,
  onError,
  operationLoading
}) => {
  const dispatch = useDispatch();
  const [formData, setFormData] = useState({
    accountCode: "",
    accountName: "",
    accountType: "", // Don't default to asset
    parentAccount: "",
    description: "",
    openingBalance: "0",
    openingBalanceDate: "",
    openingDebit: "0",
    openingCredit: "0",
    isGroup: false
  });

  const [hasUserInput, setHasUserInput] = useState(false); // Track if user has made changes
  const [preservedFormData, setPreservedFormData] = useState(null); // Preserve form data when modal closes with validation errors
  const [parentAccounts, setParentAccounts] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [parentAccountsLoading, setParentAccountsLoading] = useState(false);
  const [codeGenerating, setCodeGenerating] = useState(false);

  const accountTypes = [
    { value: "asset", label: "Asset" },
    { value: "liability", label: "Liability" },
    { value: "equity", label: "Equity" },
    { value: "revenue", label: "Revenue" },
    { value: "expense", label: "Expense" }
  ];

  const fetchParentAccounts = useCallback(async () => {
    setParentAccountsLoading(true);
    try {
      const response = await axiosInstance.get("/api/accounts/accounts/");
      // Handle both paginated and direct array responses
      let filtered = Array.isArray(response.data)
        ? response.data
        : response.data.results || [];

      if (isEdit && account) {
        // Remove the current account and its descendants
        filtered = filtered.filter((acc) => acc.id !== account.id);
      }

      // Store all parent accounts for later filtering
      setParentAccounts(filtered);
    } catch (err) {
      console.error("Error fetching parent accounts:", err);
      setParentAccounts([]);
    } finally {
      setParentAccountsLoading(false);
    }
  }, [isEdit, account]);

  // Fetch parent accounts and initialize form data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchParentAccounts();

      // Reset form data based on different conditions
      if (preservedFormData) {
        // Use preserved form data if available (when modal reopens after validation error)
        setFormData(preservedFormData);
        setPreservedFormData(null); // Clear preserved data after using it
        setHasUserInput(true); // Mark as having user input to prevent future resets
      } else if (!hasUserInput) {
        // Only reset form data if user hasn't made changes (to preserve data after validation errors)
        if (isEdit && account) {
          const parentId =
            account.parentAccount || account.parent_account || "";
          setFormData({
            accountCode: account.accountCode || "",
            accountName: account.accountName || "",
            accountType: account.accountType || "asset",
            parentAccount: parentId ? String(parentId) : "",
            description: account.description || "",
            openingBalance: account.openingBalance || "0",
            openingBalanceDate: account.openingBalanceDate || "",
            openingDebit: account.openingDebit || "0",
            openingCredit: account.openingCredit || "0",
            isGroup: account.isGroup || false
          });
        } else {
          setFormData({
            accountCode: "",
            accountName: "",
            accountType: parentAccountType || "", // Use parent account type if provided
            parentAccount: parentAccountId ? String(parentAccountId) : "",
            description: "",
            openingBalance: "0",
            openingBalanceDate: "",
            openingDebit: "0",
            openingCredit: "0",
            isGroup: false
          });
        }
      }

      setErrors({});
    }
  }, [
    isOpen,
    account,
    isEdit,
    parentAccountId,
    hasUserInput,
    preservedFormData,
    fetchParentAccounts
  ]);

  const autoGenerateCode = useCallback(async (type, parentId) => {
    if (isEdit || !type) return;

    setCodeGenerating(true);
    try {
      const parentParam = parentId && parentId !== "" ? `&parent_id=${parentId}` : "";
      const response = await axiosInstance.get(
        `/api/accounts/accounts/generate_code/?account_type=${type}${parentParam}`
      );
      if (response.data && response.data.success) {
        setFormData((prev) => ({
          ...prev,
          accountCode: response.data.accountCode
        }));
      }
    } catch (err) {
      console.error("Error generating account code:", err);
    } finally {
      setCodeGenerating(false);
    }
  }, [isEdit]);

  // Trigger auto-generation when type or parent changes
  useEffect(() => {
    if (isOpen && !isEdit) {
      autoGenerateCode(formData.accountType, formData.parentAccount);
    }
  }, [isOpen, isEdit, formData.accountType, formData.parentAccount, autoGenerateCode]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextValue = type === "checkbox" ? checked : value;

    setFormData((prev) => ({
      ...prev,
      [name]: nextValue
    }));

    // Mark that user has made changes
    setHasUserInput(true);

    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: ""
      }));
    }

    // XOR validation for openingDebit and openingCredit
    if (name === "openingDebit" && value && parseFloat(value) > 0) {
      setFormData((prev) => ({
        ...prev,
        openingCredit: "0"
      }));
      // Clear credit error if debit is being set
      if (errors.openingCredit) {
        setErrors((prev) => ({
          ...prev,
          openingCredit: ""
        }));
      }
    }

    if (name === "openingCredit" && value && parseFloat(value) > 0) {
      setFormData((prev) => ({
        ...prev,
        openingDebit: "0"
      }));
      // Clear debit error if credit is being set
      if (errors.openingDebit) {
        setErrors((prev) => ({
          ...prev,
          openingDebit: ""
        }));
      }
    }

    // If account type changed and a parent is selected, clear parent if types don't match
    if (name === "accountType" && formData.parentAccount) {
      const selectedParent = parentAccounts.find(
        (acc) => String(acc.id) === formData.parentAccount
      );
      if (selectedParent && selectedParent.accountType !== value) {
        setFormData((prev) => ({
          ...prev,
          parentAccount: ""
        }));
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.accountCode.trim()) {
      newErrors.accountCode = "Account code is required";
    }

    if (!formData.accountName.trim()) {
      newErrors.accountName = "Account name is required";
    }

    if (!formData.accountType) {
      newErrors.accountType = "Account type is required";
    }

    // Validate opening debit if provided
    if (formData.openingDebit && isNaN(parseFloat(formData.openingDebit))) {
      newErrors.openingDebit = "Opening debit must be a valid number";
    }

    // Validate opening credit if provided
    if (formData.openingCredit && isNaN(parseFloat(formData.openingCredit))) {
      newErrors.openingCredit = "Opening credit must be a valid number";
    }

    // XOR validation: Cannot have both opening debit and credit
    const debit = parseFloat(formData.openingDebit) || 0;
    const credit = parseFloat(formData.openingCredit) || 0;
    if (debit > 0 && credit > 0) {
      newErrors.openingDebit = "Cannot have both opening debit and opening credit";
      newErrors.openingCredit = "Cannot have both opening debit and opening credit";
    }

    // Validate opening balance if provided (legacy field)
    if (formData.openingBalance && isNaN(parseFloat(formData.openingBalance))) {
      newErrors.openingBalance = "Opening balance must be a valid number";
    }

    // Validate opening balance date if provided
    if (
      formData.openingBalanceDate &&
      !/^(\d{4})-(\d{2})-(\d{2})$/.test(formData.openingBalanceDate)
    ) {
      newErrors.openingBalanceDate =
        "Opening balance date must be in YYYY-MM-DD format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const payload = {
        accountCode: formData.accountCode,
        accountName: formData.accountName,
        accountType: formData.accountType,
        parentAccount: formData.parentAccount
          ? parseInt(formData.parentAccount)
          : null,
        description: formData.description || "",
        openingBalance: parseFloat(formData.openingBalance) || 0,
        openingBalanceDate: formData.openingBalanceDate || null,
        openingDebit: parseFloat(formData.openingDebit) || 0,
        openingCredit: parseFloat(formData.openingCredit) || 0,
        isGroup: !!formData.isGroup
      };

      // Use Redux actions for create/update to properly manage loading state
      let result;
      if (isEdit) {
        result = await dispatch(
          updateAccount({ id: account.id, accountData: payload })
        );
      } else {
        result = await dispatch(createAccount(payload));
      }

      if (
        isEdit
          ? updateAccount.fulfilled.match(result)
          : createAccount.fulfilled.match(result)
      ) {
        // Trigger success callback with message
        if (onSuccess) {
          onSuccess(
            isEdit
              ? "Account updated successfully!"
              : "Account created successfully!"
          );
        }
        onSave(result.payload);
        onClose();
        // Reset user input tracking after successful save
        setHasUserInput(false);
        return; // Exit early on success
      }

      // Handle error from Redux action (result.payload contains the error)
      const errorPayload = result.payload || {};
      throw { response: { data: errorPayload }, isReduxError: true };
    } catch (err) {
      console.log("[DEBUG] Full error:", err);
      console.log(
        "[DEBUG] Error response data:",
        err.response?.data || err.message
      );

      // Helper function to extract user-friendly error messages
      const extractErrorMessage = (error) => {
        if (typeof error === "string") {
          return error;
        }
        if (Array.isArray(error)) {
          return extractErrorMessage(error[0]);
        }
        if (typeof error === "object" && error !== null) {
          if (error.string) {
            return error.string;
          }
          if (error.message) {
            return error.message;
          }
        }
        return String(error);
      };

      // Extract error message from response
      let errorMessage = isEdit
        ? "Failed to update account. Please try again."
        : "Failed to create account. Please try again.";
      let shouldCloseModal = false;
      const fieldErrors = {};

      // Handle Redux action errors (result.payload) or axios errors (err.response?.data)
      const errorData = err.response?.data || err.message || err;

      if (err.response?.data) {
        const responseData = err.response.data;

        // Check for field-specific errors
        if (responseData.accountCode) {
          const accountCodeError = extractErrorMessage(
            responseData.accountCode
          );
          fieldErrors.accountCode = accountCodeError;

          // If it's a duplicate error, still treat it as a field error
          if (
            accountCodeError.toLowerCase().includes("already in use") ||
            accountCodeError.toLowerCase().includes("already exists") ||
            accountCodeError.toLowerCase().includes("unique")
          ) {
            fieldErrors.accountCode = accountCodeError;
            errorMessage =
              "Please correct the errors in the form and try again.";
            // Don't close modal for field-specific errors like duplicate account code
            shouldCloseModal = false;
          }
        }

        if (responseData.accountName) {
          fieldErrors.accountName = extractErrorMessage(
            responseData.accountName
          );
          // Don't close modal for field-specific errors
          shouldCloseModal = false;
        }

        if (responseData.accountType) {
          fieldErrors.accountType = extractErrorMessage(
            responseData.accountType
          );
          // Don't close modal for field-specific errors
          shouldCloseModal = false;
        }

        if (responseData.parentAccount) {
          fieldErrors.parentAccount = extractErrorMessage(
            responseData.parentAccount
          );
          // Don't close modal for field-specific errors
          shouldCloseModal = false;
        }

        if (responseData.description) {
          fieldErrors.description = extractErrorMessage(
            responseData.description
          );
          // Don't close modal for field-specific errors
          shouldCloseModal = false;
        }

        if (responseData.openingBalance) {
          fieldErrors.openingBalance = extractErrorMessage(
            responseData.openingBalance
          );
        }

        if (responseData.openingBalanceDate) {
          fieldErrors.openingBalanceDate = extractErrorMessage(
            responseData.openingBalanceDate
          );
        }

        if (responseData.openingDebit) {
          fieldErrors.openingDebit = extractErrorMessage(
            responseData.openingDebit
          );
        }

        if (responseData.openingCredit) {
          fieldErrors.openingCredit = extractErrorMessage(
            responseData.openingCredit
          );
        }

        // Check for general error messages (only if we haven't already set shouldCloseModal)
        if (!shouldCloseModal) {
          if (responseData.message) {
            errorMessage = responseData.message;
            shouldCloseModal = true;
          }
        } else if (responseData.detail) {
          errorMessage = responseData.detail;
          if (Object.keys(fieldErrors).length === 0) {
            fieldErrors.general = responseData.detail;
            shouldCloseModal = true;
          }
        } else if (responseData.non_field_errors) {
          errorMessage = extractErrorMessage(responseData.non_field_errors);
          if (Object.keys(fieldErrors).length === 0) {
            fieldErrors.general = extractErrorMessage(
              responseData.non_field_errors
            );
            shouldCloseModal = true;
          }
        } else if (typeof responseData === "string") {
          errorMessage = responseData;
          if (Object.keys(fieldErrors).length === 0) {
            fieldErrors.general = responseData;
            shouldCloseModal = true;
          }
        }
      } else if (err.message && !err.response) {
        // Handle Redux action errors or network errors
        if (typeof errorData === "string") {
          errorMessage = errorData;
        } else if (errorData && typeof errorData === "object") {
          // Try to extract error from Redux action payload
          if (errorData.detail) {
            errorMessage = errorData.detail;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        }
        fieldErrors.general = errorMessage;
        shouldCloseModal = true;
      }

      // Set field-specific errors if any
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
      }

      // If we need to show error in parent component's MessageBox, close modal first
      if (shouldCloseModal) {
        // Preserve form data for general errors so user can reopen and continue editing
        setPreservedFormData(formData);
        onClose();
        // Don't reset hasUserInput here as user might want to reopen and continue editing
        // Trigger error callback for parent component
        if (onError) {
          onError(errorMessage);
        }
      } else {
        // If modal stays open due to field-specific errors, ensure hasUserInput is true
        // to prevent form reset when user reopens the modal
        setHasUserInput(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">{title}</h2>
          <button
            onClick={() => {
              // Preserve form data if there are validation errors
              if (Object.keys(errors).length > 0 && errors.general) {
                setPreservedFormData(formData);
              }
              onClose();
              // Reset user input tracking when modal is closed
              setHasUserInput(false);
            }}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <FaTimes size={18} className="sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
          {/* General Error (for non-field-specific errors) */}
          {errors.general && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {errors.general}
            </div>
          )}

          {/* Account Code */}
          <div>
            <label
              htmlFor="accountCode"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Account Code *
            </label>
            <div className="relative">
              <input
                type="text"
                id="accountCode"
                name="accountCode"
                value={formData.accountCode}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed outline-none transition"
                placeholder={codeGenerating ? "Generating..." : "Auto-generated code"}
              />
              {codeGenerating && (
                <div className="absolute right-3 top-2.5">
                  <ModernLoadingAnimation size="small" />
                </div>
              )}
            </div>
            {errors.accountCode && (
              <p className="mt-1 text-xs text-red-600">{errors.accountCode}</p>
            )}
          </div>

          {/* Account Name */}
          <div>
            <label
              htmlFor="accountName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Account Name *
            </label>
            <input
              type="text"
              id="accountName"
              name="accountName"
              value={formData.accountName}
              onChange={handleChange}
              disabled={isEdit && account?.hasVoucherEntries}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition ${
                errors.accountName ? "border-red-500" : "border-gray-300"
              } ${
                isEdit && account?.hasVoucherEntries
                  ? "bg-gray-100 cursor-not-allowed"
                  : ""
                }`}
              placeholder="e.g., Cash"
            />
            {errors.accountName && (
              <p className="mt-1 text-xs text-red-600">{errors.accountName}</p>
            )}
            {isEdit && account?.hasVoucherEntries && (
              <p className="mt-1 text-xs text-amber-600">
                ⓘ Account name cannot be changed as it has associated voucher
                entries
              </p>
            )}
          </div>

          {/* Account Type */}
          <div>
            <label
              htmlFor="accountType"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Account Type *
            </label>
            <select
              id="accountType"
              name="accountType"
              value={formData.accountType}
              onChange={handleChange}
              disabled={isEdit && account?.hasVoucherEntries}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition ${
                errors.accountType ? "border-red-500" : "border-gray-300"
              } ${
                isEdit && account?.hasVoucherEntries
                  ? "bg-gray-100 cursor-not-allowed text-gray-500"
                  : ""
                }`}
            >
              {accountTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {errors.accountType && (
              <p className="mt-1 text-xs text-red-600">{errors.accountType}</p>
            )}
            {isEdit && account?.hasVoucherEntries && (
              <p className="mt-1 text-xs text-amber-600">
                ⓘ Account type cannot be changed as it has associated voucher
                entries
              </p>
            )}
          </div>

          {/* Parent Account */}
          <div>
            <label
              htmlFor="parentAccount"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Parent Account (Optional)
            </label>
            {parentAccountsLoading ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 relative">
                <div className="opacity-50">
                  <select
                    id="parentAccount"
                    name="parentAccount"
                    value={formData.parentAccount}
                    onChange={handleChange}
                    disabled={true}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition bg-white border-gray-300"
                  >
                    <option value="">Loading...</option>
                  </select>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <ModernLoadingAnimation size="small" />
                </div>
              </div>
            ) : (
              <select
                id="parentAccount"
                name="parentAccount"
                value={formData.parentAccount}
                onChange={handleChange}
                disabled={
                  (isEdit && account?.hasVoucherEntries) ||
                  parentAccountsLoading
                }
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition bg-white ${
                  errors.parentAccount ? "border-red-500" : "border-gray-300"
                } ${
                  isEdit && account?.hasVoucherEntries
                    ? "bg-gray-100 cursor-not-allowed"
                    : ""
                } ${
                  parentAccountsLoading ? "opacity-75 cursor-not-allowed" : ""
                  }`}
              >
                <option value="">-- No Parent --</option>
                {parentAccounts && parentAccounts.length > 0 ? (
                  parentAccounts
                    .filter(
                      (acc) =>
                        acc.accountType === formData.accountType && acc.isGroup
                    )
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountCode} - {acc.accountName}
                      </option>
                    ))
                ) : (
                  <option disabled>No parent accounts available</option>
                )}
              </select>
            )}
            {errors.parentAccount && (
              <p className="mt-1 text-xs text-red-600">
                {errors.parentAccount}
              </p>
            )}
            {!errors.parentAccount &&
              formData.accountType &&
              parentAccounts.filter(
                (acc) =>
                  acc.accountType === formData.accountType && acc.isGroup
              ).length === 0 &&
              parentAccounts.length > 0 && (
                <p className="mt-1 text-xs text-blue-600">
                  ⓘ No parent accounts of type &apos;{formData.accountType}
                  &apos; available. Only accounts with matching types can be
                  selected as parent.
                </p>
              )}
            {!errors.parentAccount &&
              isEdit &&
              formData.parentAccount &&
              parentAccounts.length > 0 &&
              !account?.hasVoucherEntries && (
                <p className="mt-2 text-xs text-green-600">
                  ✓ Current parent:{" "}
                  {parentAccounts.find(
                    (p) => String(p.id) === formData.parentAccount
                  )?.accountName || "Unknown"}
                </p>
              )}
            {isEdit && account?.hasVoucherEntries && (
              <p className="mt-1 text-xs text-amber-600">
                ⓘ Parent account cannot be changed as this account has
                associated voucher entries
              </p>
            )}
          </div>

          {/* Is Group */}
          <div className="flex items-start gap-3">
            <input
              id="isGroup"
              name="isGroup"
              type="checkbox"
              checked={!!formData.isGroup}
              onChange={handleChange}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <div>
              <label htmlFor="isGroup" className="block text-sm font-medium text-gray-700">
                Is Group
              </label>
              <p className="text-xs text-gray-500">
                Use this account as a group/parent for consolidated ledger selection.
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition resize-none"
              placeholder="Optional account description"
            />
          </div>

          {/* Opening Debit Amount */}
          <div>
            <label
              htmlFor="openingDebit"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Opening Debit Amount (Optional)
            </label>
            <input
              type="number"
              id="openingDebit"
              name="openingDebit"
              value={formData.openingDebit}
              onChange={handleChange}
              step="0.01"
              min="0"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition ${
                errors.openingDebit ? "border-red-500" : "border-gray-300"
                }`}
              placeholder="0.00"
            />
            {errors.openingDebit && (
              <p className="mt-1 text-xs text-red-600">
                {errors.openingDebit}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Enter opening debit OR opening credit, not both
            </p>
          </div>

          {/* Opening Credit Amount */}
          <div>
            <label
              htmlFor="openingCredit"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Opening Credit Amount (Optional)
            </label>
            <input
              type="number"
              id="openingCredit"
              name="openingCredit"
              value={formData.openingCredit}
              onChange={handleChange}
              step="0.01"
              min="0"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition ${
                errors.openingCredit ? "border-red-500" : "border-gray-300"
                }`}
              placeholder="0.00"
            />
            {errors.openingCredit && (
              <p className="mt-1 text-xs text-red-600">
                {errors.openingCredit}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Enter opening debit OR opening credit, not both
            </p>
          </div>

          {/* Opening Balance Date */}
          <div>
            <label
              htmlFor="openingBalanceDate"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Opening Balance Date
            </label>
            <Calendar
              value={formData.openingBalanceDate}
              onChange={(value) => {
                setFormData((prev) => ({
                  ...prev,
                  openingBalanceDate: value
                }));
                // Mark that user has made changes
                setHasUserInput(true);
                // Clear error for this field
                if (errors.openingBalanceDate) {
                  setErrors((prev) => ({
                    ...prev,
                    openingBalanceDate: ""
                  }));
                }
              }}
              placeholder="Select Opening Balance Date"
            />
            {errors.openingBalanceDate && (
              <p className="mt-1 text-xs text-red-600">
                {errors.openingBalanceDate}
              </p>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-2 sm:gap-2 p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => {
              // Preserve form data if there are validation errors
              if (Object.keys(errors).length > 0 && errors.general) {
                setPreservedFormData(formData);
              }
              onClose();
              // Reset user input tracking when modal is closed
              setHasUserInput(false);
            }}
            className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || operationLoading}
            className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base bg-primary text-white rounded-lg hover:bg-primaryHover transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading || operationLoading
              ? "Saving..."
              : isEdit
                ? "Update"
                : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
};

AccountsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  account: PropTypes.shape({
    id: PropTypes.number,
    accountCode: PropTypes.string,
    accountName: PropTypes.string,
    accountType: PropTypes.string,
    parentAccount: PropTypes.number,
    parent_account: PropTypes.number,
    description: PropTypes.string,
    openingBalance: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    openingBalanceDate: PropTypes.string,
    openingDebit: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    openingCredit: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    hasVoucherEntries: PropTypes.bool
  }),
  parentAccountId: PropTypes.number,
  parentAccountType: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  isEdit: PropTypes.bool,
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
  operationLoading: PropTypes.bool
};

export default AccountsModal;
