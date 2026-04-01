import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import ServiceFeeFormView from "./ServiceFeeFormView";
import ServiceConfirmationView from "./ServiceConfirmationView";
import { useServiceFeeCreate } from "../../../../hooks/useServiceFees";
import ErrorMessage from "../../../../Components/MessageBox/ErrorMessage";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import { shouldRefreshUnits } from "../../../../utils/serviceFeeUtils";

// Dummy user selector (replace with your actual auth/user selector)
import { useSelector } from "react-redux";

// Store form data outside component to persist across unmounts
const savedFormDataRef = { current: null };

const ServiceFeeForm = ({ onClose, onSuccess }) => {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [formData, setFormData] = useState(null);
  const [validationError, setValidationError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showErrorMessage, setShowErrorMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Get user data from auth state - the user object contains member data
  const user = useSelector((state) => state.auth?.user);

  // Use the service fee creation hook
  const {
    creating,
    createError,
    createSuccess,
    createServiceFee: createServiceFeeAction,
    resetState,
    towers,
    units,
    towersLoading,
    unitsLoading,
    loadTowers,
    loadUnitsByTower,
    clearUnitsData
  } = useServiceFeeCreate();

  // Extract name and role from user data with fallbacks
  const getCreatorDisplay = (userObj) => {
    const userName =
      userObj?.full_name ||
      userObj?.name ||
      userObj?.first_name ||
      userObj?.username ||
      "User";
    const memberTypeName = userObj?.member_type_name || "";
    const firstRoleName = userObj?.member_roles?.[0]?.role_name || "";
    const userRole = firstRoleName || memberTypeName || "Member";
    return `${userName}    ${userRole}`.trim();
  };
  const [creatorDisplay, setCreatorDisplay] = useState(getCreatorDisplay(user));
  const [lastTowerConfig, setLastTowerConfig] = useState(null);

  // Get current date in YYYY-MM-DD format for Service Fee Date
  const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
    setError,
    clearErrors,
    setValue,
    trigger
  } = useForm({
    mode: "onSubmit",
    reValidateMode: "onChange", // Re-validate on change after first submit
    shouldFocusError: true, // Focus on first error field
    defaultValues: savedFormDataRef.current || {
      creatorName: creatorDisplay,
      tower: "",
      unit: [],
      frequency: "Monthly",
      currency: "BDT",
      feeAmount: null,
      serviceFeeDate: getCurrentDate(),
      billingCycle: "Monthly",
      dueDay: null,
      paymentMethods: { cash: false, mfs: false, bank: false },
      mfs: [],
      bank: {
        bankName: "",
        accountName: "",
        accountNumber: "",
        branch: "",
        routing: ""
      },
      latePaymentEnabled: false,
      latePenaltyTiers: []
    }
  });

  // Restore saved form data when component mounts
  useEffect(() => {
    if (savedFormDataRef.current) {
      reset(savedFormDataRef.current);
    }
  }, [reset]);

  // Keep creatorName in sync with user info and update instantly on user change
  useEffect(() => {
    const newDisplay = getCreatorDisplay(user);
    setCreatorDisplay(newDisplay);

    // Get current form values before reset to preserve changes
    const currentValues = watch();
    console.log("Resetting form with new creator display:", newDisplay);
    console.log("Current form values before reset:", currentValues);

    reset({
      ...currentValues,
      creatorName: newDisplay,
      // Ensure payment methods object is properly initialized
      paymentMethods: currentValues.paymentMethods || { cash: false, mfs: false, bank: false }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Only depend on user - watch and reset are stable

  // Ensure towers are loaded for the Tower dropdown
  useEffect(() => {
    loadTowers();
  }, [loadTowers]);

  // Watch for tower selection changes and detect configuration changes
  const selectedTower = watch("tower");

  useEffect(() => {
    if (selectedTower && towers.length > 0) {
      const currentTower = towers.find(t => String(t.id) === String(selectedTower));

      if (currentTower) {
        const currentConfig = {
          id: currentTower.id,
          unit_naming_type: currentTower.unit_naming_type,
          add_tower_number_to_unit_name: currentTower.add_tower_number_to_unit_name,
          tower_number: currentTower.tower_number,
          num_floors: currentTower.num_floors,
          num_units: currentTower.num_units
        };

        // Use a ref comparison to avoid infinite loops
        const lastConfig = lastTowerConfig;

        // Check if tower configuration has changed
        if (lastConfig && lastConfig.id === currentConfig.id) {
          const configChanged = Object.keys(currentConfig).some(key =>
            key !== 'id' && lastConfig[key] !== currentConfig[key]
          );

          if (configChanged) {
            console.log("Tower configuration changed, clearing units...");
            // Clear selected units as they may no longer be valid
            setValue("unit", [], { shouldDirty: true, shouldTouch: true });
            // Reload units for the tower
            loadUnitsByTower([selectedTower]);
          }
        }

        // Only update if config actually changed
        const configString = JSON.stringify(currentConfig);
        const lastConfigString = lastConfig ? JSON.stringify(lastConfig) : null;

        if (configString !== lastConfigString) {
          setLastTowerConfig(currentConfig);
        }
      }
    } else if (!selectedTower) {
      setLastTowerConfig(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTower, towers]); // Remove lastTowerConfig, setValue, loadUnitsByTower from deps

  // Watch payment methods and clear validation error when any is selected
  const watchedPaymentMethods = watch("paymentMethods");
  useEffect(() => {
    console.log("Payment methods changed:", watchedPaymentMethods); // Debug log

    // Clear payment method errors when any payment method is selected
    if (watchedPaymentMethods && (watchedPaymentMethods.cash || watchedPaymentMethods.mfs || watchedPaymentMethods.bank)) {
      console.log('Clearing payment method errors due to selection'); // Debug log
      clearErrors("paymentMethods");
      setValidationError(""); // Also clear any general validation error
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedPaymentMethods]); // clearErrors and setValidationError are stable

  // Step 1: Collect data and move to confirmation
  const onNext = async (data) => {
    console.log("Form data collected:", data); // Debug log
    console.log("Payment methods:", data.paymentMethods); // Debug payment methods specifically
    console.log("Form errors:", errors); // Debug form errors

    // Clear previous validation errors
    setValidationError("");
    clearErrors();

    // Trigger form validation first
    const isFormValid = await trigger();
    console.log("Form validation result:", isFormValid);
    console.log("Form errors after trigger:", errors);

    if (!isFormValid) {
      console.log("Form validation failed, stopping submission");
      // The form validation errors should now be displayed
      return;
    }

    // Validate that at least one payment method is selected
    // Add more robust checking for payment methods
    const paymentMethods = data.paymentMethods || {};
    const hasPaymentMethod = Boolean(paymentMethods.cash) || Boolean(paymentMethods.mfs) || Boolean(paymentMethods.bank);

    console.log("Payment method validation details:", {
      paymentMethods,
      cash: Boolean(paymentMethods.cash),
      mfs: Boolean(paymentMethods.mfs),
      bank: Boolean(paymentMethods.bank),
      hasPaymentMethod
    });

    if (!hasPaymentMethod) {
      console.log('Payment methods validation failed - no payment method selected'); // Debug
      const errorMessage = "Please select at least one payment method (Cash, MFS, or Bank Transfer)";
      setError("paymentMethods", {
        type: "manual",
        message: errorMessage
      });
      setValidationError(errorMessage); // Also set general validation error for visibility
      return;
    } else {
      // Clear the payment methods error if validation passes
      clearErrors("paymentMethods");
      console.log("Payment method validation passed"); // Debug
    }

    // Validate required fields based on selected payment methods
    if (Boolean(paymentMethods.mfs) && (!data.mfs || !Array.isArray(data.mfs) || data.mfs.length === 0)) {
      console.log('MFS validation failed - MFS selected but no accounts:', data.mfs);
      const errorMessage = "Please add at least one MFS account when MFS payment is selected";
      setError("mfs", {
        type: "manual",
        message: errorMessage
      });
      setValidationError(errorMessage); // Also set general validation error for visibility
      return;
    }

    // Validate MFS accounts have required fields
    if (Boolean(paymentMethods.mfs) && data.mfs && Array.isArray(data.mfs)) {
      console.log("Validating MFS accounts:", data.mfs);
      for (let i = 0; i < data.mfs.length; i++) {
        const mfs = data.mfs[i];
        if (!mfs.provider) {
          console.log(`MFS account ${i} missing provider:`, mfs);
          const errorMessage = "MFS provider is required";
          setError(`mfs.${i}.provider`, {
            type: "manual",
            message: errorMessage
          });
          setValidationError(errorMessage); // Also set general validation error for visibility
          return;
        }
        if (!mfs.name && !mfs.account_name) {
          console.log(`MFS account ${i} missing name:`, mfs);
          const errorMessage = "MFS account name is required";
          setError(`mfs.${i}.name`, {
            type: "manual",
            message: errorMessage
          });
          setValidationError(errorMessage); // Also set general validation error for visibility
          return;
        }
        if (!mfs.number && !mfs.account_number) {
          console.log(`MFS account ${i} missing number:`, mfs);
          const errorMessage = "MFS account number is required";
          setError(`mfs.${i}.number`, {
            type: "manual",
            message: errorMessage
          });
          setValidationError(errorMessage); // Also set general validation error for visibility
          return;
        }
      }
    }

    if (Boolean(paymentMethods.bank)) {
      console.log("Validating bank details:", data.bank);
      if (!data.bank?.bankName) {
        console.log("Bank name missing:", data.bank);
        const errorMessage = "Bank name is required";
        setError("bank.bankName", {
          type: "manual",
          message: errorMessage
        });
        setValidationError(errorMessage); // Also set general validation error for visibility
        return;
      }
      if (!data.bank?.accountName) {
        const errorMessage = "Bank account name is required";
        setError("bank.accountName", {
          type: "manual",
          message: errorMessage
        });
        setValidationError(errorMessage); // Also set general validation error for visibility
        return;
      }
      if (!data.bank?.accountNumber) {
        const errorMessage = "Bank account number is required";
        setError("bank.accountNumber", {
          type: "manual",
          message: errorMessage
        });
        setValidationError(errorMessage); // Also set general validation error for visibility
        return;
      }
      if (!data.bank?.branch) {
        const errorMessage = "Bank branch name is required";
        setError("bank.branch", {
          type: "manual",
          message: errorMessage
        });
        setValidationError(errorMessage); // Also set general validation error for visibility
        return;
      }
      if (!data.bank?.routing) {
        const errorMessage = "Bank routing number is required";
        setError("bank.routing", {
          type: "manual",
          message: errorMessage
        });
        setValidationError(errorMessage); // Also set general validation error for visibility
        return;
      }
    }

    // Validate other required fields
    if (!data.tower && (!data.unit || !Array.isArray(data.unit) || data.unit.length === 0)) {
      setValidationError('Please select at least one tower or unit');
      return;
    }

    // if (!data.feeAmount || data.feeAmount <= 0) {
    //   setValidationError('Please enter a valid fee amount');
    //   return;
    // }

    if (!data.serviceFeeDate) {
      setValidationError("Please select a service fee date");
      return;
    }

    // Currency, frequency, and billing cycle are now fixed values, no validation needed

    if (!data.dueDay || data.dueDay < 1 || data.dueDay > 31) {
      setValidationError("Please enter a valid due day (1-31)");
      return;
    }

    console.log("Validation passed, moving to confirmation");
    console.log("Final form data:", data);
    console.log("Setting showConfirmation to true");
    setFormData(data);
    setShowConfirmation(true);
  };

  // Step 2: Final submission
  const onFinalSubmit = async () => {
    try {
      // Format data for API
      const apiData = {
        fee_amount: parseFloat(formData.feeAmount) || 0,
        service_fee_date: formData.serviceFeeDate,
        currency: formData.currency || "BDT",
        frequency: formData.frequency || "Monthly",
        billing_cycle: formData.billingCycle || "Monthly",
        due_day: parseInt(formData.dueDay) || 1,
        accepts_cash: Boolean(formData.paymentMethods?.cash),
        accepts_mfs: Boolean(formData.paymentMethods?.mfs),
        accepts_bank: Boolean(formData.paymentMethods?.bank),
        reminder_before_days: 1, // Default value - backend requires non-null integer
        reminder_after_days: 1, // Default value - backend requires non-null integer
        late_payment_enabled: Boolean(formData.latePaymentEnabled),
        tower_ids: formData.tower ? [parseInt(formData.tower)].filter(id => !isNaN(id) && id > 0) : [],
        unit_ids: Array.isArray(formData.unit) ? formData.unit.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0) : [],
      };

      // Add late penalty tiers if enabled
      if (apiData.late_payment_enabled && formData.latePenaltyTiers && Array.isArray(formData.latePenaltyTiers) && formData.latePenaltyTiers.length > 0) {
        apiData.late_penalty_tiers = formData.latePenaltyTiers
          .filter(tier => tier.daysOverdue && tier.penaltyPercentage !== undefined)
          .map(tier => ({
            days_overdue: parseInt(tier.daysOverdue),
            penalty_percentage: parseFloat(tier.penaltyPercentage)
          }))
          .sort((a, b) => a.days_overdue - b.days_overdue);
      } else {
        apiData.late_penalty_tiers = [];
      }

      // Only add MFS accounts if MFS is accepted and accounts exist
      if (apiData.accepts_mfs && formData.mfs && Array.isArray(formData.mfs) && formData.mfs.length > 0) {
        console.log('DEBUG: Raw MFS data from form:', formData.mfs);
        console.log('DEBUG: MFS payment method selected:', apiData.accepts_mfs);
        console.log('DEBUG: Form MFS array length:', formData.mfs.length);

        // Map and validate MFS accounts
        const validMfsAccounts = formData.mfs.map(mfs => {
          const accountNumber = String(mfs.number || mfs.account_number || '').trim();
          console.log('DEBUG: Processing MFS account:', {
              provider: mfs.provider,
              name: mfs.name || mfs.account_name,
              originalNumber: mfs.number || mfs.account_number,
              processedNumber: accountNumber
            });

            return {
              provider: String(mfs.provider || "").trim(),
              account_name: String(mfs.name || mfs.account_name || "").trim(),
              account_number: accountNumber // Keep original format, don't strip non-digits
            };
        }).filter(mfs => {
            // Filter out invalid entries and validate
          const isValid = mfs.provider && mfs.account_name && mfs.account_number && mfs.account_number.length >= 3; // Reduced minimum length
            if (!isValid) {
              console.warn("Invalid MFS account filtered out:", mfs, {
                provider: !!mfs.provider,
                account_name: !!mfs.account_name,
                account_number: !!mfs.account_number,
                account_number_length: mfs.account_number?.length
              });
            }
            return isValid;
          });

        // Check for duplicate mobile numbers within the same provider (database constraint)
        const providerNumbers = {};
        for (const account of validMfsAccounts) {
          const provider = account.provider;
          const accountNumber = account.account_number;

          if (!providerNumbers[provider]) {
            providerNumbers[provider] = [];
          }

          if (providerNumbers[provider].includes(accountNumber)) {
            console.error(`DEBUG: Duplicate mobile number ${accountNumber} found for provider ${provider}`);
            // Show duplicate mobile number error in MessageBox popup
            setErrorMessage(`The mobile number ${accountNumber} is already used for ${provider}. Each provider can only have unique mobile numbers.`);
            setShowErrorMessage(true);
            return;
          }

          providerNumbers[provider].push(accountNumber);
        }

        // Same mobile number can be used across different providers, but not within the same provider
        apiData.mfs_accounts = validMfsAccounts;

        console.log('DEBUG: Final MFS accounts:', apiData.mfs_accounts);
        console.log('DEBUG: Number of valid MFS accounts:', apiData.mfs_accounts.length);

        // Ensure we have at least one valid MFS account
        if (apiData.mfs_accounts.length === 0) {
          console.error("DEBUG: No valid MFS accounts found!");
          console.error("DEBUG: Original form data:", formData.mfs);
          console.error("DEBUG: Valid accounts:", validMfsAccounts);
          setValidationError("Error: At least one valid MFS account is required when MFS payment is selected.");
          return;
        }
      }

      // Only add bank account if bank is accepted and bank data exists
      if (apiData.accepts_bank && formData.bank) {
        console.log("DEBUG: Raw bank data from form:", formData.bank);

        // Validate required bank fields before creating bank_account
        const bankName = String(formData.bank.bankName || "").trim();
        const branchName = String(formData.bank.branch || "").trim();
        const accountHolderName = String(formData.bank.accountName || "").trim();
        const accountNumber = String(formData.bank.accountNumber || "").trim();
        const routingNumber = String(formData.bank.routing || "").trim();

        if (!bankName || !branchName || !accountHolderName || !accountNumber || !routingNumber) {
          setValidationError("Error: All bank account fields are required when Bank Transfer is selected.");
          return;
        }

        apiData.bank_account = {
          bank_name: bankName,
          branch_name: branchName,
          branch_address: branchName, // Use branch name as address
          account_holder_name: accountHolderName,
          account_number: accountNumber,
          routing_number: routingNumber
        };
        console.log("DEBUG: Mapped bank account:", apiData.bank_account);
      }

      console.log("Formatted API data:", JSON.stringify(apiData, null, 2)); // Debug log
      console.log("Payment methods debug:", {
        raw: formData.paymentMethods,
        cash: formData.paymentMethods?.cash,
        mfs: formData.paymentMethods?.mfs,
        bank: formData.paymentMethods?.bank,
        converted: {
          accepts_cash: apiData.accepts_cash,
          accepts_mfs: apiData.accepts_mfs,
          accepts_bank: apiData.accepts_bank
        }
      });

      // Final validation before API call
      if (apiData.tower_ids.length === 0 && apiData.unit_ids.length === 0) {
        setValidationError("Error: No valid tower or unit IDs found. Please select at least one tower or unit.");
        return;
      }

      if (!apiData.accepts_cash && !apiData.accepts_mfs && !apiData.accepts_bank) {
        setValidationError("Error: No payment methods selected. Please select at least one payment method.");
        return;
      }

      // Additional debugging for bank account data
      if (apiData.bank_account) {
        console.log("Bank account data being sent:", apiData.bank_account);
        console.log("Bank account field validation:", {
          bank_name: !!apiData.bank_account.bank_name,
          branch_name: !!apiData.bank_account.branch_name,
          branch_address: !!apiData.bank_account.branch_address,
          account_holder_name: !!apiData.bank_account.account_holder_name,
          account_number: !!apiData.bank_account.account_number,
          routing_number: !!apiData.bank_account.routing_number
        });
      }

      const result = await createServiceFeeAction(apiData);

      if (result.type.endsWith("/fulfilled")) {
        // Clear any existing errors and show success message
        setValidationError("");
        resetState(); // Clear any API error state
        setSuccessMessage("Service Fee Settings has been successfully Created.");
        setShowSuccessMessage(true);
        setShowConfirmation(false);
      } else if (result.type.endsWith("/rejected")) {
        console.error("Service fee creation rejected:", result.payload);
        console.error("Full rejection payload:", JSON.stringify(result.payload, null, 2));

        // Handle validation or duplicate unit errors with proper MessageBox
        if (result.payload && result.payload.errors) {
          // Check if this is a duplicate unit assignment error
          const allErrors = result.payload.errors.__all__;
          if (allErrors && Array.isArray(allErrors)) {
            const duplicateError = allErrors.find(error =>
              typeof error === "string" && error.includes("already assigned to service fee")
            );

            if (duplicateError) {
              // Show duplicate error in MessageBox popup
              setErrorMessage(duplicateError);
              setShowErrorMessage(true);
              setShowConfirmation(false); // Go back to form
              return;
            }
          }

          // Handle other validation errors - Map API errors to form fields
          const handleApiErrors = (apiErrors) => {
            let hasFieldErrors = false;

            // Clear any existing form errors first
            clearErrors();

            Object.entries(apiErrors).forEach(([fieldName, fieldErrors]) => {
              if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
                const errorMessage = fieldErrors[0]; // Use first error message

                // Map API field names to form field names
                const fieldMapping = {
                  fee_amount: "feeAmount",
                  due_day: "dueDay",
                  reminder_before_days: "reminderBefore",
                  reminder_after_days: "reminderAfter",
                  frequency: "frequency",
                  currency: "currency",
                  billing_cycle: "billingCycle",
                  tower_ids: "tower",
                  unit_ids: "unit"
                };

                const formFieldName = fieldMapping[fieldName] || fieldName;

                // Set the error on the specific form field
                setError(formFieldName, {
                  type: "api",
                  message: errorMessage
                });

                hasFieldErrors = true;
                console.log(`Set field error for ${formFieldName}:`, errorMessage);
              }
            });

            // If no field-specific errors could be mapped, show general validation error
            if (!hasFieldErrors) {
              const formatErrors = (errors, prefix = "") => {
                let messages = [];

                if (Array.isArray(errors)) {
                  errors.forEach((error, index) => {
                    if (typeof error === "object" && error !== null) {
                      if (error.non_field_errors) {
                        messages.push(`${prefix}[${index}]: ${error.non_field_errors.join(', ')}`);
                      } else {
                        Object.entries(error).forEach(([key, value]) => {
                          if (Array.isArray(value)) {
                            messages.push(`${prefix}[${index}].${key}: ${value.join(', ')}`);
                          } else {
                            messages.push(`${prefix}[${index}].${key}: ${value}`);
                          }
                        });
                      }
                    } else if (error) {
                      messages.push(`${prefix}[${index}]: ${error}`);
                    }
                  });
                } else if (typeof errors === "object") {
                  Object.entries(errors).forEach(([key, value]) => {
                    if (Array.isArray(value)) {
                      messages.push(`${prefix}${key}: ${value.join(", ")}`);
                    } else {
                      messages.push(`${prefix}${key}: ${value}`);
                    }
                  });
                } else {
                  messages.push(`${prefix}: ${errors}`);
                }

                return messages;
              };

              const errorMessages = Object.entries(result.payload.errors)
                .flatMap(([field, messages]) => formatErrors(messages, field))
                .join("\n");
              setValidationError(`Validation errors:\n${errorMessages}`);
            }
          };

          // Handle the API errors
          handleApiErrors(result.payload.errors);
        } else if (result.payload && result.payload.message) {
          // Check if the message contains duplicate unit information
          if (result.payload.message.includes("already assigned to service fee")) {
            setErrorMessage(result.payload.message);
            setShowErrorMessage(true);
            setShowConfirmation(false);
          } else {
            setValidationError(`Error: ${result.payload.message}`);
          }
        } else {
          console.error("Unknown error format:", result.payload);
          setValidationError(`Failed to create service fee. Error: ${JSON.stringify(result.payload)}`);
        }
      }
    } catch (error) {
      console.error("Error creating service fee:", error);
      setValidationError("An unexpected error occurred. Please try again.");
    }
  };

  const handleClose = (shouldReset = true) => {
    if (shouldReset) {
      // Explicit close - reset everything
      reset();
      savedFormDataRef.current = null;
    } else {
      // Backdrop click - save form data before closing
      const currentFormData = watch();
      savedFormDataRef.current = currentFormData;
    }
    setShowConfirmation(false);
    setFormData(null);
    setShowSuccessMessage(false);
    setSuccessMessage("");
    setShowErrorMessage(false);
    setErrorMessage("");
    if (shouldReset) {
      resetState(); // Clear any API state only on explicit close
    }
    onClose();
  };

  const handleSuccessOk = () => {
    // Clear the success message
    setShowSuccessMessage(false);
    setSuccessMessage("");

    // Reset form data
    reset();
    savedFormDataRef.current = null;
    setFormData(null);

    // Call onSuccess to refresh the list and show updated values
    if (onSuccess) onSuccess();

    // Close the form
    onClose();
  };

  const clearSuccessMessage = () => {
    setShowSuccessMessage(false);
    setSuccessMessage("");
  };

  const clearErrorMessage = () => {
    setShowErrorMessage(false);
    setErrorMessage("");
  };

  const handleErrorOk = () => {
    clearErrorMessage();
    // Also clear validation error to remove red error message
    setValidationError("");
    // Clear any API error state that might be causing the red message
    resetState();
    // Stay on the form so user can make corrections
  };

  // Handle success state
  useEffect(() => {
    if (createSuccess) {
      // Success is handled in onFinalSubmit
      resetState();
    }
  }, [createSuccess, resetState]);

  return (
    <>
      {/* Hide the form when success message is showing or when confirmation modal is open */}
      {!showSuccessMessage && !showConfirmation && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/70"
          onClick={(e) => {
            // Close when clicking on backdrop (not on the drawer itself)
            // Don't reset form data when clicking outside
            if (e.target === e.currentTarget) {
              handleClose(false);
            }
          }}
        >
          <div
            className="w-full sm:w-[600px] h-full bg-white shadow-2xl flex flex-col"
            style={{ boxShadow: "rgba(0, 0, 0, 0.2) 0px 0px 10px" }}
            onClick={(e) => {
              // Prevent clicks inside drawer from propagating to backdrop
              e.stopPropagation();
            }}
          >
            {/* Error Messages - Hide when showing duplicate error in MessageBox */}
            {createError && !showErrorMessage && (
              <div className="mx-3 mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                <p className="font-medium">Error creating service fee:</p>
                {typeof createError === "object" ? (
                  <div className="mt-2">
                    {createError.message && <p>{String(createError.message)}</p>}
                    {createError.errors && (
                      <ul className="list-disc list-inside mt-1">
                        {Object.entries(createError.errors).map(([field, messages]) => {
                            // Safety check for messages - ensure it's renderable
                            let displayMessage = "";
                            if (Array.isArray(messages)) {
                            displayMessage = messages.map(msg => String(msg)).join(', ');
                          } else if (typeof messages === 'string') {
                              displayMessage = messages;
                          } else if (typeof messages === 'object' && messages !== null) {
                              // If it's an object, try to extract meaningful information
                              displayMessage = JSON.stringify(messages);
                            } else {
                              displayMessage = String(messages);
                            }

                            return (
                              <li key={field}>
                                <strong>{field}:</strong> {displayMessage}
                              </li>
                            );
                          }
                        )}
                      </ul>
                    )}
                    {!createError.message && !createError.errors && (
                      <pre className="text-xs mt-1 overflow-auto">{JSON.stringify(createError, null, 2)}</pre>
                    )}
                  </div>
                ) : (
                  <p>{String(createError)}</p>
                )}
              </div>
            )}

            {/* Loading State */}
            {creating && (
              <div className="mx-3 mb-4 p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700 mr-2"></div>
                  Creating service fee...
                </div>
              </div>
            )}

            {/* Validation Error - Hide when showing duplicate error in MessageBox */}
            {validationError && !showErrorMessage && (
              <div className="mx-3 mb-4">
                <ErrorMessage message={validationError} />
              </div>
            )}

            {/* Scrollable Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ServiceFeeFormView
                formMethods={{
                  register,
                  control,
                  handleSubmit,
                  watch,
                  formState: { errors },
                  setValue,
                  trigger,
                  clearErrors
                }}
                onClose={handleClose}
                onNext={onNext}
                towers={towers}
                units={units}
                towersLoading={towersLoading}
                unitsLoading={unitsLoading}
                loadUnitsByTower={loadUnitsByTower}
                clearUnitsData={clearUnitsData}
              />
            </div>
          </div>
        </div>
      )}

      {/* Show confirmation modal separately when needed */}
      {showConfirmation && (
        <ServiceConfirmationView
          data={formData}
          towers={towers}
          units={units}
          onBack={() => {
            console.log('Back button clicked, setting showConfirmation to false');
            setShowConfirmation(false);
          }}
          onSubmit={onFinalSubmit}
          onClose={handleClose}
          isEdit={false}
        />
      )}

      {/* Success Message Box */}
      {showSuccessMessage && successMessage && (
        <MessageBox
          message={successMessage}
          clearMessage={clearSuccessMessage}
          onOk={handleSuccessOk}
        />
      )}

      {/* Error Message Box for duplicate unit validation */}
      {showErrorMessage && errorMessage && (
        <MessageBox
          error={errorMessage}
          clearMessage={clearErrorMessage}
          onOk={handleErrorOk}
        />
      )}
    </>
  );
};

export default ServiceFeeForm;
