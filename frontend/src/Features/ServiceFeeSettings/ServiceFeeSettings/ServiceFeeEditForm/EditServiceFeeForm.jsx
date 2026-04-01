import React, { useEffect, useMemo, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import ServiceFeeFormView from "../ServiceFeeCreateForm/ServiceFeeFormView";
import ServiceConfirmationView from "../ServiceFeeCreateForm/ServiceConfirmationView";
import { useServiceFeeEdit } from "../../../../hooks/useServiceFees";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import ErrorMessage from "../../../../Components/MessageBox/ErrorMessage";
import { shouldRefreshUnits, filterValidUnits } from "../../../../utils/serviceFeeUtils";

// Store form data outside component to persist across unmounts (keyed by service fee ID)
const savedFormDataRef = { current: {} };

const EditServiceFeeForm = ({ id, onClose, onSuccess }) => {
  const navigate = useNavigate();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [formData, setFormData] = useState(null);
  const [validationError, setValidationError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showErrorMessage, setShowErrorMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Get user data from auth state - the user object contains member data
  const user = useSelector((state) => state.auth?.user);

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

  const {
    selectedServiceFee,
    loading,
    updating,
    updateError,
    updateSuccess,
    message,
    loadServiceFee,
    updateServiceFee,
    resetState,
    towers,
    units,
    towersLoading,
    unitsLoading,
    loadTowers,
    loadUnitsByTower,
  } = useServiceFeeEdit();

  // Use ref to store loadUnitsByTower to avoid dependency issues
  const loadUnitsByTowerRef = useRef(loadUnitsByTower);
  loadUnitsByTowerRef.current = loadUnitsByTower;

  // Memoize units to prevent unnecessary re-renders
  const memoizedUnits = useMemo(() => units, [JSON.stringify(units)]);

  useEffect(() => {
    loadTowers();
  }, []); // Remove loadTowers from dependencies to prevent infinite loop

  // Service fee data should already be loaded by the parent ViewServiceFeeSettings component
  // No need to load it again here

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
    reset,
    setError,
    clearErrors,
    setValue,
    trigger,
  } = useForm({
    mode: "onSubmit",
    defaultValues: {
      creatorName: creatorDisplay,
      tower: "",
      unit: [],
      frequency: "Monthly",
      currency: "BDT",
      feeAmount: null,
      serviceFeeDate: "",
      billingCycle: "Monthly",
      dueDay: null,
      paymentMethods: { cash: false, mfs: false, bank: false },
      mfs: [],
      bank: { bankName: "", accountName: "", accountNumber: "", branch: "", routing: "" },
      latePaymentEnabled: false,
      latePenaltyTiers: []
    },
  });

  // Keep creatorName in sync with user info and update instantly on user change
  useEffect(() => {
    const newDisplay = getCreatorDisplay(user);
    setCreatorDisplay(newDisplay);
  }, [user]);

  // Use ref to track if units have been matched to prevent re-matching
  const unitsMatchedRef = useRef(false);
  // Use ref to track if units have been loaded to prevent duplicate loading
  const unitsLoadedRef = useRef(false);
  // Use ref to track if initial setup is complete
  const initialSetupCompleteRef = useRef(false);

  // Track original form values to detect changes and originally selected units
  const [originalFormValues, setOriginalFormValues] = useState(null);
  const [hasFormChanges, setHasFormChanges] = useState(false);
  const [originallySelectedUnits, setOriginallySelectedUnits] = useState([]);

  // Track unit interactions to detect changes even if final state matches original
  const [unitInteractions, setUnitInteractions] = useState(0);
  const [hasUnitInteractions, setHasUnitInteractions] = useState(false);

  // State to track when initial data is ready to prevent loading flashes
  const [isInitialDataReady, setIsInitialDataReady] = useState(false);

  // Function to compare form values and detect changes
  const compareFormValues = (currentValues, originalValues) => {
    if (!originalValues) return false;

    // Compare key fields that matter for changes
    const fieldsToCompare = [
      'tower', 'unit', 'frequency', 'currency', 'feeAmount', 'serviceFeeDate', 'billingCycle', 'dueDay',
      'paymentMethods', 'mfs', 'bank', 'reminderBefore', 'reminderAfter'
    ];

    for (const field of fieldsToCompare) {
      const current = currentValues[field];
      const original = originalValues[field];

      // Handle arrays (like unit, mfs)
      if (Array.isArray(current) && Array.isArray(original)) {
        if (current.length !== original.length) return true;
        for (let i = 0; i < current.length; i++) {
          if (JSON.stringify(current[i]) !== JSON.stringify(original[i])) return true;
        }
      }
      // Handle objects (like paymentMethods, bank)
      else if (typeof current === 'object' && typeof original === 'object' && current !== null && original !== null) {
        if (JSON.stringify(current) !== JSON.stringify(original)) return true;
      }
      // Handle primitive values
      else if (current !== original) {
        return true;
      }
    }

    return false;
  };

  // Check if units need to be refreshed due to tower configuration changes
  useEffect(() => {
    if (selectedServiceFee && towers.length > 0 && selectedServiceFee.tower_details) {
      const needsRefresh = shouldRefreshUnits(selectedServiceFee.tower_details, towers);

      if (needsRefresh) {
        console.log("Tower configuration changed, refreshing units...");

        // Get the first tower ID to reload units
        const firstTowerId = selectedServiceFee.tower_id_list?.[0] || 
          selectedServiceFee.tower_ids?.[0] ||
          selectedServiceFee.towers?.[0]?.id;

        if (firstTowerId) {
          // Reset flags to allow re-loading and re-matching
          unitsMatchedRef.current = false;
          unitsLoadedRef.current = false;
          initialSetupCompleteRef.current = false;
          setIsInitialDataReady(false);

          // Clear current units and reload
          setValue("unit", [], { shouldDirty: false, shouldTouch: false });

          // Reload units with current tower configuration
          loadUnitsByTowerRef.current({
            towerIds: [firstTowerId],
            excludeServiceFeeId: selectedServiceFee.id
          });

          console.log('Units refresh initiated due to tower configuration change');
        }
      }
    }
  }, [selectedServiceFee?.tower_details, towers, setValue]);

  // Consolidated unit matching logic - runs after units are loaded and form is reset
  useEffect(() => {
    if (selectedServiceFee && memoizedUnits.length > 0 && !unitsMatchedRef.current && !initialSetupCompleteRef.current) {
      console.log('Unit matching - selectedServiceFee:', selectedServiceFee);
      console.log('Unit matching - memoizedUnits:', memoizedUnits);
      console.log('Unit matching - unitsMatchedRef.current:', unitsMatchedRef.current);

      let matchedUnitIds = [];

      // Try to match by unit_id_list first (new field)
      if (Array.isArray(selectedServiceFee.unit_id_list) && selectedServiceFee.unit_id_list.length > 0) {
        console.log('Matching by unit_id_list:', selectedServiceFee.unit_id_list);
        matchedUnitIds = selectedServiceFee.unit_id_list.map(unitId => {
          const unit = memoizedUnits.find(u => u.id === unitId || u.id === parseInt(unitId));
            return unit ? String(unit.id) : null;
        }).filter(id => id !== null);
      }
      // Try to match by unit_ids (fallback)
      else if (Array.isArray(selectedServiceFee.unit_ids) && selectedServiceFee.unit_ids.length > 0) {
        console.log('Matching by unit_ids:', selectedServiceFee.unit_ids);
        matchedUnitIds = selectedServiceFee.unit_ids.map(unitId => {
          const unit = memoizedUnits.find(u => u.id === unitId || u.id === parseInt(unitId));
            return unit ? String(unit.id) : null;
        }).filter(id => id !== null);
      }
      // Try to match by units array
      else if (Array.isArray(selectedServiceFee.units) && selectedServiceFee.units.length > 0) {
        console.log('Matching by units array:', selectedServiceFee.units);
        matchedUnitIds = selectedServiceFee.units.map(unit => {
            const unitId = unit.id || unit;
          const foundUnit = memoizedUnits.find(u => u.id === unitId || u.id === parseInt(unitId));
            return foundUnit ? String(foundUnit.id) : null;
        }).filter(id => id !== null);
      }
      // Try to match by unit_names
      else if (Array.isArray(selectedServiceFee.unit_names) && selectedServiceFee.unit_names.length > 0) {
        console.log('Matching by unit_names:', selectedServiceFee.unit_names);
        matchedUnitIds = selectedServiceFee.unit_names.map(unitName => {
          const unit = memoizedUnits.find(u => {
            const unitDisplayName = u.display_name || `${u.unit_name || u.name || 'Unit'} (Floor ${u.floor_no || u.floor_number || 'N/A'})`;
            return unitDisplayName.includes(unitName) || unitName.includes(u.unit_name || u.name || '');
            });
            return unit ? String(unit.id) : null;
        }).filter(id => id !== null);
      }

      console.log("Final matched unit IDs before filtering:", matchedUnitIds);

      // Skip filtering for now to ensure units are displayed - the backend should handle validation
      // if (matchedUnitIds.length > 0 && selectedServiceFee.tower_details) {
      //   const validUnitIds = filterValidUnits(matchedUnitIds, memoizedUnits, selectedServiceFee.tower_details);
      //   console.log('Filtered valid unit IDs:', validUnitIds);
      //   matchedUnitIds = validUnitIds;
      // }

      if (matchedUnitIds.length > 0) {
        console.log("Setting matched unit values:", matchedUnitIds);

        // Store originally selected units for edit mode - but allow editing
        setOriginallySelectedUnits(matchedUnitIds);

        // Update original form values to include the matched units
        setOriginalFormValues(prev => prev ? { ...prev, unit: matchedUnitIds } : null);

        // Set units immediately and then verify
        setValue("unit", matchedUnitIds, { shouldDirty: false, shouldTouch: false, shouldValidate: true });
        trigger("unit");

        console.log("Units matched successfully:", matchedUnitIds);

        // Force a re-render by updating the units update key
        setUnitsUpdateKey((prev) => prev + 1);

        // Mark units as matched and setup as complete
        unitsMatchedRef.current = true;
        initialSetupCompleteRef.current = true;
        setIsInitialDataReady(true);

        // Additional verification after a short delay to ensure form state is updated
        setTimeout(() => {
          const currentUnitValue = watch("unit");
          console.log('Unit value after matching (verification):', currentUnitValue);
          if (JSON.stringify(currentUnitValue) !== JSON.stringify(matchedUnitIds)) {
            console.log('Unit values mismatch detected, re-setting...');
            setValue("unit", matchedUnitIds, { shouldDirty: false, shouldTouch: false, shouldValidate: true });
            trigger("unit");
            setUnitsUpdateKey((prev) => prev + 1);
          }
        }, 200); // Increased delay to ensure form state is properly updated
      } else {
        console.log('No units matched, setting empty array');
        setValue("unit", [], { shouldDirty: false, shouldTouch: false, shouldValidate: true });
        trigger("unit");
        setOriginallySelectedUnits([]);
        setOriginalFormValues((prev) => (prev ? { ...prev, unit: [] } : null));
        setUnitsUpdateKey((prev) => prev + 1);

        // Mark setup as complete even with no units
        unitsMatchedRef.current = true;
        initialSetupCompleteRef.current = true;
        setIsInitialDataReady(true);
      }
    }
  }, [selectedServiceFee?.id, memoizedUnits.length, setValue, setOriginalFormValues, watch, trigger]);

  // Effect to reset flags when service fee changes
  useEffect(() => {
    if (selectedServiceFee) {
      console.log('Service fee changed to ID:', selectedServiceFee.id, '- resetting flags');
      unitsMatchedRef.current = false;
      unitsLoadedRef.current = false;
      initialSetupCompleteRef.current = false;
      setIsInitialDataReady(false);
    }
  }, [selectedServiceFee?.id]);

  // Verification effect to ensure units are properly set
  useEffect(() => {
    if (initialSetupCompleteRef.current && selectedServiceFee && memoizedUnits.length > 0) {
      // Small delay to ensure all updates are complete
      const timer = setTimeout(() => {
        const currentUnits = watch("unit");
        console.log("Verification - Current form units:", currentUnits);

        // Only re-set units if this is the initial setup and user hasn't made changes yet
        // Allow user to make changes after initial setup
        if (!hasFormChanges && originallySelectedUnits.length > 0 && 
            (!currentUnits || currentUnits.length === 0 || 
             JSON.stringify(currentUnits) !== JSON.stringify(originallySelectedUnits))) {
          console.log('Verification - Re-setting units (no user changes yet):', originallySelectedUnits);
          setValue("unit", originallySelectedUnits, { shouldDirty: false, shouldTouch: false, shouldValidate: true });
          trigger("unit");
          // Force a re-render by updating the units update key
          setUnitsUpdateKey((prev) => prev + 1);
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [initialSetupCompleteRef.current, selectedServiceFee, memoizedUnits.length, originallySelectedUnits, setValue, trigger, watch, hasFormChanges]);

  // Optimized form initialization with pre-loaded units
  useEffect(() => {
    if (selectedServiceFee && towers.length > 0 && !initialSetupCompleteRef.current) {
      const fee = selectedServiceFee;
      console.log("EditServiceFeeForm - selectedServiceFee:", fee);

      // Check if we have saved form data for this service fee ID
      const savedData = savedFormDataRef.current[id];

      // Try different possible field names for tower data
      let firstTowerId = "";

      // Check for tower_id_list first (new field)
      if (Array.isArray(fee.tower_id_list) && fee.tower_id_list.length > 0) {
        firstTowerId = String(fee.tower_id_list[0]);
      }
      // Check for tower_ids
      else if (Array.isArray(fee.tower_ids) && fee.tower_ids.length > 0) {
        firstTowerId = String(fee.tower_ids[0]);
      }
      // If no tower_ids, check for towers array
      else if (Array.isArray(fee.towers) && fee.towers.length > 0) {
        firstTowerId = String(fee.towers[0].id || fee.towers[0]);
      }
      // If no towers array, check for tower_names and try to match
      else if (Array.isArray(fee.tower_names) && fee.tower_names.length > 0) {
        const matchingTower = towers.find(t => t.tower_name === fee.tower_names[0]);
        if (matchingTower) {
          firstTowerId = String(matchingTower.id);
        }
      }

      console.log("EditServiceFeeForm - firstTowerId:", firstTowerId);

      // Load units immediately and set up form once units are loaded
      if (firstTowerId && !unitsLoadedRef.current) {
        console.log('Loading units for tower from selectedServiceFee:', firstTowerId);
        // Pass service fee ID to exclude from assignment check
        loadUnitsByTowerRef.current({
          towerIds: [firstTowerId],
          excludeServiceFeeId: selectedServiceFee.id
        });
        unitsLoadedRef.current = true;
      }

      // Get initial unit IDs from service fee data
      let initialUnitIds = [];
      if (Array.isArray(fee.unit_id_list) && fee.unit_id_list.length > 0) {
        initialUnitIds = fee.unit_id_list.map((id) => String(id));
      } else if (Array.isArray(fee.unit_ids) && fee.unit_ids.length > 0) {
        initialUnitIds = fee.unit_ids.map((id) => String(id));
      }

      console.log("Form initialization - initial unit IDs:", initialUnitIds);

      // Prepare form values - use saved data if available, otherwise use API data
      const formValues = savedData || {
        creatorName: creatorDisplay,
        tower: firstTowerId,
        unit: [], // Don't set initial units here, let unit matching effect handle it
        frequency: fee.frequency || fee.billing_cycle || "Monthly",
        currency: fee.currency || "BDT",
        feeAmount: fee.fee_amount ? (fee.fee_amount % 1 === 0 ? Math.round(fee.fee_amount) : fee.fee_amount) : null,
        serviceFeeDate: fee.service_fee_date || "",
        billingCycle: fee.billing_cycle || "Monthly",
        dueDay: fee.due_day ?? null,
        paymentMethods: {
          cash: !!fee.accepts_cash,
          mfs: !!fee.accepts_mfs,
          bank: !!fee.accepts_bank,
        },
        mfs: Array.isArray(fee.mfs_accounts)
          ? fee.mfs_accounts.map((m) => ({
              provider: m.provider || "",
              name: m.account_name || "",
              number: m.account_number || "",
            }))
          : [],
        bank: fee.bank_account
          ? {
              bankName: fee.bank_account.bank_name || "",
              accountName: fee.bank_account.account_holder_name || "",
              accountNumber: fee.bank_account.account_number || "",
              branch: fee.bank_account.branch_name || "",
              routing: fee.bank_account.routing_number || "",
            }
          : { bankName: "", accountName: "", accountNumber: "", branch: "", routing: "" },
        latePaymentEnabled: fee.late_payment_enabled || false,
        latePenaltyTiers: Array.isArray(fee.late_penalty_tiers)
          ? fee.late_penalty_tiers.map((tier) => ({
              daysOverdue: tier.days_overdue || "",
              penaltyPercentage: tier.penalty_percentage || ""
            }))
          : []
      };

      // If using saved data, use saved units; otherwise use initial unit IDs
      const unitsToUse = savedData?.unit || initialUnitIds;

      // Reset form with all values including units
      reset(formValues);

      // Store original form values (units will be set by unit matching effect)
      setOriginalFormValues(formValues);
      setOriginallySelectedUnits(savedData?.unit || initialUnitIds);
      setHasFormChanges(false);

      console.log('Form initialized with values (units to be matched):', formValues);

      // Don't mark setup as complete here - let the unit matching effect handle it
      // This ensures units are properly loaded with display names before setup is complete

      // If there are no units to load/match, mark setup as complete so change detection works
      if (!memoizedUnits || memoizedUnits.length === 0) {
        initialSetupCompleteRef.current = true;
        setIsInitialDataReady(true);
      }
    }
  }, [selectedServiceFee?.id, towers.length, reset, creatorDisplay, memoizedUnits.length, id]);


  // Simplified tower watching for edit mode (should not change tower in edit)
  const watchedTower = watch("tower");

  useEffect(() => {
    console.log("Tower value in edit mode:", watchedTower);
    // In edit mode, tower should not change, so we don't need to load units here
    // Units are already loaded and matched during initialization
  }, [watchedTower]);

  // Watch unit values for debugging (only when setup is complete)
  const watchedUnits = watch("unit");
  const [unitsUpdateKey, setUnitsUpdateKey] = useState(0);

  useEffect(() => {
    if (initialSetupCompleteRef.current) {
      console.log('Unit values changed:', watchedUnits, 'Setup complete:', initialSetupCompleteRef.current);
      // Force re-render when units change after initial setup
      setUnitsUpdateKey((prev) => prev + 1);
    }
  }, [watchedUnits]);

  // Additional effect to ensure units are displayed when they become available
  useEffect(() => {
    if (selectedServiceFee && memoizedUnits.length > 0 && initialSetupCompleteRef.current) {
      const currentUnits = watch("unit");
      console.log("Units availability check:", {
        currentUnits,
        originallySelectedUnits,
        memoizedUnitsLength: memoizedUnits.length,
        hasUnits: currentUnits && currentUnits.length > 0
      });

      // If we have originally selected units but current form shows no units, re-set them
      if (originallySelectedUnits.length > 0 && (!currentUnits || currentUnits.length === 0)) {
        console.log('Re-setting units from originallySelectedUnits:', originallySelectedUnits);
        setValue("unit", originallySelectedUnits, { shouldDirty: false, shouldTouch: false, shouldValidate: true });
        trigger("unit");
        setUnitsUpdateKey((prev) => prev + 1);
      }
    }
  }, [memoizedUnits.length, selectedServiceFee, originallySelectedUnits, setValue, trigger, watch]);

  // Removed fallback effect - let the unit matching effect handle all unit setting
  // This ensures units are properly loaded with display names from the API

  // Custom unit change handler to track interactions
  const handleUnitChange = (newUnits) => {
    console.log('handleUnitChange called with:', newUnits);
    console.log('Current unitInteractions:', unitInteractions);

    // Increment interaction counter whenever units are changed
    setUnitInteractions((prev) => {
      const newCount = prev + 1;
      console.log("Incrementing unitInteractions from", prev, "to", newCount);
      return newCount;
    });
    setHasUnitInteractions(true);

    // Call the original setValue to update the form
    setValue("unit", newUnits, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
  };

  // Watch form values to detect changes (only after initial setup is complete)
  const watchedFormValues = watch();
  useEffect(() => {
    if (originalFormValues && initialSetupCompleteRef.current) {
      const hasChanges = compareFormValues(watchedFormValues, originalFormValues);
      const finalHasChanges = hasChanges || hasUnitInteractions;

      console.log("Change detection:", {
        hasChanges,
        hasUnitInteractions,
        unitInteractions,
        finalHasChanges,
        currentUnits: watchedFormValues.unit,
        originalUnits: originalFormValues.unit
      });

      // Consider it a change if either form values changed OR there were unit interactions
      setHasFormChanges(finalHasChanges);
    }
  }, [watchedFormValues, originalFormValues, hasUnitInteractions, unitInteractions]);


  // Validate payment methods selection
  const watchedPaymentMethods = watch("paymentMethods");
  useEffect(() => {
    if (watchedPaymentMethods?.cash || watchedPaymentMethods?.mfs || watchedPaymentMethods?.bank) {
      clearErrors("paymentMethods");
    }
  }, [watchedPaymentMethods, clearErrors]);

  const onNext = (data) => {
    const isEdit = true; // This is always an edit form
    setValidationError("");
    setShowErrorMessage(false); // Hide any existing error popup
    clearErrors();

    const hasPaymentMethod = data.paymentMethods?.cash || data.paymentMethods?.mfs || data.paymentMethods?.bank;
    if (!hasPaymentMethod) {
      setError("paymentMethods", {
        type: "manual",
        message: "Please select at least one payment method (Cash, MFS, or Bank Transfer)",
      });
      return;
    }

    if (data.paymentMethods?.mfs) {
      if (!data.mfs || !Array.isArray(data.mfs) || data.mfs.length === 0) {
        setError("mfs", { type: "manual", message: "Please add at least one MFS account when MFS payment is selected" });
        return;
      }
      for (let i = 0; i < data.mfs.length; i++) {
        const mfs = data.mfs[i];
        if (!mfs.provider) {
          setError(`mfs.${i}.provider`, { type: "manual", message: "Provider is required" });
          return;
        }
        if (!mfs.name) {
          setError(`mfs.${i}.name`, { type: "manual", message: "Account name is required" });
          return;
        }
        if (!mfs.number) {
          setError(`mfs.${i}.number`, { type: "manual", message: "Account number is required" });
          return;
        }
      }
    }

    if (data.paymentMethods?.bank) {
      const bank = data.bank || {};
      const requiredBank = [
        ["bank.bankName", bank.bankName, "Bank name is required"],
        ["bank.accountName", bank.accountName, "Account name is required"],
        ["bank.accountNumber", bank.accountNumber, "Account number is required"],
        ["bank.branch", bank.branch, "Branch name is required"],
        ["bank.routing", bank.routing, "Routing number is required"],
      ];
      for (const [field, value, msg] of requiredBank) {
        if (!value) {
          setError(field, { type: "manual", message: msg });
          return;
        }
      }
    }

    if (!data.tower && (!data.unit || !Array.isArray(data.unit) || data.unit.length === 0)) {
      setValidationError("Please select at least one tower or unit");
      setShowErrorMessage(true);
      return;
    }

    if (!data.feeAmount || data.feeAmount <= 0) {
      setValidationError("Please enter a valid fee amount");
      setShowErrorMessage(true);
      return;
    }

    if (!data.serviceFeeDate) {
      setValidationError("Please select a service fee date");
      setShowErrorMessage(true);
      return;
    }

    // Currency, frequency, and billing cycle are now fixed values, no validation needed

    if (!data.dueDay || data.dueDay < 1 || data.dueDay > 31) {
      setValidationError("Please enter a valid due day (1-31)");
      setShowErrorMessage(true);
      return;
    }

    setFormData(data);
    setShowConfirmation(true);
  };

  const onFinalSubmit = async () => {
    // Validate service_fee_id is present
    if (!id) {
      setValidationError("Service fee ID is required for updates.");
      setShowErrorMessage(true);
      return;
    }

    const payload = {
      service_fee_id: parseInt(id), // Required field for updates
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
      tower_ids: formData.tower ? [parseInt(formData.tower)].filter((x) => !isNaN(x) && x > 0) : [],
      unit_ids: Array.isArray(formData.unit)
        ? formData.unit.map((id) => parseInt(id)).filter((x) => !isNaN(x) && x > 0)
        : [],
    };

    // Add late penalty tiers if enabled
    if (payload.late_payment_enabled && formData.latePenaltyTiers && Array.isArray(formData.latePenaltyTiers) && formData.latePenaltyTiers.length > 0) {
      payload.late_penalty_tiers = formData.latePenaltyTiers
        .filter(tier => tier.daysOverdue && tier.penaltyPercentage !== undefined)
        .map(tier => ({
          days_overdue: parseInt(tier.daysOverdue),
          penalty_percentage: parseFloat(tier.penaltyPercentage)
        }));
    } else {
      payload.late_penalty_tiers = [];
    }

    if (payload.accepts_mfs && Array.isArray(formData.mfs) && formData.mfs.length > 0) {
      const validMfs = formData.mfs
        .map((m) => ({
          provider: String(m.provider || "").trim(),
          account_name: String(m.name || "").trim(),
          account_number: String(m.number || "").trim(),
        }))
        .filter((m) => m.provider && m.account_name && m.account_number);

      // Check for duplicate mobile numbers within the same provider (database constraint)
      const providerNumbers = {};
      for (const account of validMfs) {
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
      payload.mfs_accounts = validMfs;

      if (payload.mfs_accounts.length === 0) {
        setValidationError("Error: At least one valid MFS account is required when MFS payment is selected.");
        return;
      }
    }

    if (payload.accepts_bank) {
      const b = formData.bank || {};
      if (!b.bankName || !b.accountName || !b.accountNumber || !b.branch || !b.routing) {
        setValidationError("Error: All bank account fields are required when Bank Transfer is selected.");
        return;
      }
      payload.bank_account = {
        bank_name: String(b.bankName),
        branch_name: String(b.branch),
        branch_address: String(b.branch),
        account_holder_name: String(b.accountName),
        account_number: String(b.accountNumber),
        routing_number: String(b.routing),
      };
    }

    if (payload.tower_ids.length === 0 && payload.unit_ids.length === 0) {
      setValidationError("Error: No valid tower or unit IDs found. Please select at least one tower or unit.");
      return;
    }

    if (!payload.accepts_cash && !payload.accepts_mfs && !payload.accepts_bank) {
      setValidationError("Error: No payment methods selected. Please select at least one payment method.");
      return;
    }

    try {
      console.log('DEBUG: Final payload being sent for update:', JSON.stringify(payload, null, 2));
      console.log('DEBUG: Payload keys:', Object.keys(payload));
      console.log('DEBUG: Payment methods in payload:', {
        accepts_cash: payload.accepts_cash,
        accepts_mfs: payload.accepts_mfs,
        accepts_bank: payload.accepts_bank,
        mfs_accounts: payload.mfs_accounts,
        bank_account: payload.bank_account
      });

      const result = await updateServiceFee(id, payload);

      if (result.type.endsWith("/fulfilled")) {
        setValidationError("");
        resetState();
        setSuccessMessage("Service fee schedule updated successfully.");
        setShowSuccessMessage(true);
        setShowConfirmation(false);
      } else {
        const payloadErr = result.payload;

        // Enhanced error handling for duplicate units - similar to CreateServiceFeeForm
        if (payloadErr && payloadErr.errors) {
          // Check if this is a duplicate unit assignment error
          const allErrors = payloadErr.errors.__all__;
          if (allErrors && Array.isArray(allErrors)) {
            const duplicateError = allErrors.find(error => 
              typeof error === 'string' && error.includes('already assigned to service fee')
            );

            if (duplicateError) {
              // Show duplicate error in MessageBox popup and clear all related error states
              setErrorMessage(duplicateError);
              setShowErrorMessage(true);
              setShowConfirmation(false); // Go back to form
              setValidationError(""); // Clear validation error
              clearErrors(); // Clear form validation errors
              return;
            }
          }

          // Handle other detailed field errors - Map API errors to form fields
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
              const errs = Object.entries(payloadErr.errors)
                .flatMap(([k, v]) => (Array.isArray(v) ? v.map((m) => `${k}: ${m}`) : [`${k}: ${v}`]))
                .join('\n');
              setValidationError(`Validation errors:\n${errs}`);
            }
          };

          // Handle the API errors
          handleApiErrors(payloadErr.errors);
          setShowConfirmation(false); // Go back to form to show field errors
        } else if (payloadErr && payloadErr.message) {
          // Check if the message contains duplicate unit information
          if (payloadErr.message.includes("already assigned to service fee")) {
            setErrorMessage(payloadErr.message);
            setShowErrorMessage(true);
            setShowConfirmation(false);
            setValidationError(""); // Clear validation error
            clearErrors(); // Clear form validation errors
          } else {
            // Show the backend's validation message with helpful context
            let errorMessage = payloadErr.message;
            if (errorMessage.includes('already defined by service fee')) {
              errorMessage += '\n\nPlease select different units that are not currently assigned to another service fee, or modify the existing service fee instead.';
            }
            setValidationError(errorMessage);
            setShowConfirmation(false); // Go back to form to show error
            setShowErrorMessage(true); // Show error popup
            setErrorMessage(""); // Clear separate error message
            clearErrors(); // Clear any form validation errors
            // Additional timeout to ensure form errors are cleared
            setTimeout(() => clearErrors(), 100);
          }
        } else {
          setValidationError("Unable to update service fee at this time. Please try again later.");
          setShowConfirmation(false); // Go back to form to show error
          setShowErrorMessage(true); // Show error popup
          setErrorMessage(""); // Clear separate error message
          clearErrors(); // Clear any form validation errors
          setTimeout(() => clearErrors(), 100);
        }
      }
    } catch (e) {
      setValidationError("Unable to update service fee at this time. Please try again later.");
      setShowErrorMessage(true);
      setShowConfirmation(false); // Go back to form
      setErrorMessage(""); // Clear separate error message
      clearErrors(); // Clear any form validation errors
      setTimeout(() => clearErrors(), 100);
    }
  };

  const handleClose = (shouldReset = true) => {
    if (shouldReset) {
      // Explicit close - reset everything
      reset();
      if (id) {
        savedFormDataRef.current[id] = null;
      }
    } else {
      // Backdrop click - save form data before closing
      const currentFormData = watch();
      if (id) {
        savedFormDataRef.current[id] = currentFormData;
      }
    }
    setShowConfirmation(false);
    setFormData(null);
    setShowSuccessMessage(false);
    setSuccessMessage("");
    setShowErrorMessage(false);
    setErrorMessage("");
    unitsMatchedRef.current = false; // Reset units matched flag
    unitsLoadedRef.current = false; // Reset units loaded flag
    initialSetupCompleteRef.current = false; // Reset initial setup flag
    setIsInitialDataReady(false); // Reset initial data ready state
    setOriginalFormValues(null); // Reset original form values
    setHasFormChanges(false); // Reset form changes flag
    setOriginallySelectedUnits([]); // Reset originally selected units
    setUnitInteractions(0); // Reset unit interactions
    setHasUnitInteractions(false); // Reset unit interactions flag
    if (shouldReset) {
      resetState(); // Clear any API state only on explicit close
    }
    onClose && onClose();
  };

  const handleSuccessOk = () => {
    setShowSuccessMessage(false);
    setSuccessMessage("");
    reset();
    if (id) {
      savedFormDataRef.current[id] = null;
    }
    setFormData(null);
    unitsMatchedRef.current = false; // Reset units matched flag
    unitsLoadedRef.current = false; // Reset units loaded flag
    initialSetupCompleteRef.current = false; // Reset initial setup flag
    setIsInitialDataReady(false); // Reset initial data ready state
    setOriginalFormValues(null); // Reset original form values
    setHasFormChanges(false); // Reset form changes flag
    setOriginallySelectedUnits([]); // Reset originally selected units
    setUnitInteractions(0); // Reset unit interactions
    setHasUnitInteractions(false); // Reset unit interactions flag
    if (onSuccess) onSuccess();
    onClose && onClose();
    // Navigate back to Service Fee Settings list
    navigate("/service-fee-settings");
  };

  const clearSuccessMessage = () => {
    setShowSuccessMessage(false);
    setSuccessMessage("");
  };

  const clearErrorMessage = () => {
    setShowErrorMessage(false);
    setErrorMessage("");
    setValidationError("");
    clearErrors(); // Clear form validation errors too
  };

  const handleErrorOk = () => {
    clearErrorMessage();
    // Stay on the form so user can make corrections
  };

  // Show loading state if essential data is not ready
  if (loading || !selectedServiceFee || towersLoading || towers.length === 0) {
    return (
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
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading service fee data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {!showSuccessMessage && (
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
            {/* Error Messages */}
            {updateError && validationError && (
              <div className="mx-3 mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                <p className="font-medium">Error updating service fee:</p>
                <p>{String(validationError)}</p>
              </div>
            )}

            {/* Loading State */}
            {updating && (
              <div className="mx-3 mt-4 p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700 mr-2"></div>
                  Updating service fee...
                </div>
              </div>
            )}

            {/* Validation Error */}
            {validationError && !showErrorMessage && (
              <div className="mx-3 mt-4">
                <ErrorMessage message={validationError} />
              </div>
            )}

            {/* Scrollable Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {showConfirmation ? (
                <ServiceConfirmationView
                  data={formData}
                  towers={towers}
                  units={memoizedUnits}
                  onBack={() => {
                    console.log('Back button clicked in edit form, setting showConfirmation to false');
                    setShowConfirmation(false);
                  }}
                  onSubmit={onFinalSubmit}
                  onClose={handleClose}
                  isEdit={true}
                />
              ) : (
                <ServiceFeeFormView
                  key={`edit-form-${selectedServiceFee?.id}-${unitsUpdateKey}-${isInitialDataReady}`}
                  formMethods={{
                    register,
                    control,
                    handleSubmit,
                    watch,
                    formState: { errors, isDirty },
                    setValue,
                    clearErrors,
                    trigger,
                    handleUnitChange, // Add custom unit change handler
                  }}
                  // Debug: Log the formMethods being passed
                  onFormMethodsDebug={() => {
                    console.log('FormMethods being passed to ServiceFeeFormView:', {
                        hasHandleUnitChange: !!handleUnitChange,
                        handleUnitChangeType: typeof handleUnitChange
                    });
                  }}
                  onClose={handleClose}
                  onNext={onNext}
                  towers={towers}
                  units={memoizedUnits}
                  towersLoading={towersLoading}
                  unitsLoading={unitsLoading && !isInitialDataReady}
                  loadUnitsByTower={loadUnitsByTowerRef.current}
                  clearUnitsData={() => {}}
                  isEdit={true}
                  hasFormChanges={hasFormChanges}
                  originalDueDay={originalFormValues?.dueDay}
                  isInitialDataReady={isInitialDataReady}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {showSuccessMessage && successMessage && (
        <MessageBox message={successMessage} clearMessage={clearSuccessMessage} onOk={handleSuccessOk} />
      )}

      {showErrorMessage && (errorMessage || validationError) && (
        <MessageBox
          error={errorMessage || validationError}
          clearMessage={clearErrorMessage}
          onOk={handleErrorOk}
        />
      )}
    </>
  );
};

export default EditServiceFeeForm;
