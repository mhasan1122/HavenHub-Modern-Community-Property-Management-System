import React from "react";
import { Controller, useFieldArray } from "react-hook-form";
import { useDispatch } from "react-redux";
import { useState, useRef, useEffect, useMemo } from "react";
import { FaCaretDown } from "react-icons/fa6";
import { FaTrash } from "react-icons/fa";
import ErrorMessage from "../../../../Components/MessageBox/ErrorMessage";
import ModernDatePicker from "../../../../Components/FormComponent/ModernDatePicker";
import TowerSelector from "../../../CommunicationPortal/Announcements/components/TowerSelector";
import { naturalSort } from "../../../../utils/serviceFeeUtils";

const SectionTitle = ({ children, onClose }) => (
  <div className="flex items-center justify-between mb-3">
    <div className="flex flex-col flex-1 space-y-2">
      <h3 className="text-lg font-bold flex items-center">{children}</h3>
      <h5 className="text-sm text-primary">Service Fee Settings</h5>
    </div>
    {onClose && (
      <button
        onClick={onClose}
        className="ml-4 p-2 bg-primary rounded-full transition-colors"
        type="button"
      >
        <svg
          className="w-4 h-4 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    )}
  </div>
);

// Custom styles for dropdown options
const dropdownStyles = `
  select option {
    background-color: white !important;
    color: black !important;
  }
  
  select:focus option:checked {
    background-color: #f3f4f6 !important;
    color: black !important;
  }
  
  select:focus option:hover {
    background-color: #e5e7eb !important;
    color: black !important;
  }
`;

// Dummy data removed - will use real API data from hooks

// Single Select Dropdown for Tower selection
const SingleSelectDropdown = ({
  value,
  onChange,
  options,
  placeholder,
  disabled = false
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  // Use useMemo to prevent unnecessary re-renders
  const memoizedValue = useMemo(() => value, [value]);
  const memoizedOptions = useMemo(() => options, [JSON.stringify(options)]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debug logging removed to prevent console spam

  const selectItem = (id) => {
    if (disabled) return;
    onChange(id);
    setOpen(false);
  };

  const getItemName = (id) => {
    const item = memoizedOptions.find((option) => option.id === id);
    return item ? String(item.name) : "";
  };

  const selectedItem = memoizedOptions.find(
    (option) => option.id === memoizedValue
  );

  return (
    <div ref={ref} className="relative" style={{ width: "100%" }}>
      {/* Input box */}
      <div
        onClick={() => {
          if (disabled) return;
          setOpen(!open);
        }}
        className={`login-field-input !flex justify-between items-center gap-2 whitespace-nowrap ${disabled
            ? "bg-disabledInput cursor-not-allowed text-black100"
            : open
              ? "!border-primary !bg-white !shadow-ring-primary cursor-pointer"
              : "bg-white cursor-pointer"
        }`}
        style={{ boxSizing: "border-box", fontSize: "0.875rem" }}
      >
        <span className="flex-1 truncate text-sm overflow-hidden">
          {selectedItem ? selectedItem.name : placeholder}
        </span>
        <FaCaretDown
          className={`flex-shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""
          }`}
          style={{ width: "16px", height: "16px" }}
        />
      </div>

      {/* Dropdown */}
      {open && !disabled && (
        <ul className="absolute z-20 bg-white border border-gray-300 rounded mt-1 shadow-lg w-full max-h-60 overflow-y-auto">
          {memoizedOptions.length === 0 ? (
            <li className="px-3 py-2 text-gray-500">No options available</li>
          ) : (
            memoizedOptions.map(({ id, name }) => {
              const isSelected = memoizedValue === id;
              return (
                <li
                  key={id}
                  onClick={() => selectItem(id)}
                  className={`px-3 py-2 cursor-pointer ${isSelected
                      ? "bg-primary text-white"
                      : "hover:bg-primary hover:text-white"
                  }`}
                >
                  {String(name)}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
};

const MultiSelectDropdown = ({
  value = [],
  onChange,
  options,
  placeholder,
  disabled = false,
  selectedUnitsDisabled = [],
  isEdit = false
}) => {
  // Debug: Log when MultiSelectDropdown is created
  console.log("MultiSelectDropdown created with:", {
    value,
    valueType: typeof value,
    valueIsArray: Array.isArray(value),
    valueLength: Array.isArray(value) ? value.length : "not array",
    hasOnChange: !!onChange,
    onChangeType: typeof onChange,
    isEdit,
    optionsLength: options ? options.length : "no options"
  });

  // Ensure value is always an array and convert to strings for consistency
  const val = Array.isArray(value) ? value.map((v) => String(v)) : [];
  console.log("MultiSelectDropdown - processed val:", {
    val,
    valLength: val.length,
    valType: typeof val,
    valIsArray: Array.isArray(val)
  });

  const [open, setOpen] = useState(false);
  const [tempSelection, setTempSelection] = useState([]);
  const [lastValueUpdate, setLastValueUpdate] = useState(0);
  const ref = useRef();

  // Use useMemo to prevent unnecessary re-renders
  const memoizedVal = useMemo(() => val, [JSON.stringify(val)]);
  const memoizedOptions = useMemo(() => options, [JSON.stringify(options)]);

  // Initialize tempSelection with current value on mount and when value changes
  useEffect(() => {
    console.log("MultiSelectDropdown - Syncing tempSelection with value:", {
      currentValue: val,
      valueLength: val.length,
      isEdit,
      options: options ? options.slice(0, 3) : "no options", // Show first 3 options for debug
      tempSelectionBefore: tempSelection
    });

    // Only update tempSelection if it's different from current value
    if (JSON.stringify(val) !== JSON.stringify(tempSelection)) {
      console.log("MultiSelectDropdown - Updating tempSelection to:", val);
      setTempSelection(val);
      setLastValueUpdate(Date.now()); // Track when value was last updated
    }
  }, [JSON.stringify(val), isEdit]); // Watch val directly

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
        // Only reset temp selection if it's been more than 100ms since last value update
        // This prevents race conditions during form updates
        const timeSinceUpdate = Date.now() - lastValueUpdate;
        if (timeSinceUpdate > 100) {
          setTempSelection(val); // reset temp on outside click using current val
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [val, lastValueUpdate]); // Watch val and lastValueUpdate

  // Toggle single item
  const toggleItem = (id) => {
    console.log("toggleItem called with:", {
      id,
      tempSelection,
      currentVal: val
    });

    const newTempSelection = tempSelection.includes(id)
      ? tempSelection.filter((item) => item !== id)
      : [...tempSelection, id];

    console.log("toggleItem - new tempSelection:", newTempSelection);
    setTempSelection(newTempSelection);
  };

  // Toggle all items (only available units)
  const toggleAll = () => {
    console.log("toggleAll called with tempSelection:", tempSelection);

    // Filter out units that are assigned to other service fees
    const availableOptions = memoizedOptions.filter((option) => {
      const isAssignedToOther =
        option.assignment_status === "assigned_to_other" || option.is_assigned;
      const isCurrentlyAssigned =
        option.assignment_status === "currently_assigned" ||
        option.is_currently_assigned;

      // Determine if this option is already selected in the form
      const isSelected = tempSelection.includes(option.id);

      // In edit mode, allow currently selected units even if backend flags them as assigned
      if (isEdit) {
        return isSelected || !isAssignedToOther; // Allow currently selected and available
      } else {
        return !isAssignedToOther && !isCurrentlyAssigned; // Only allow available
      }
    });

    const availableIds = availableOptions.map((item) => item.id);
    console.log("toggleAll - availableIds:", availableIds);

    // Check if all available units are selected
    const allAvailableSelected = availableIds.every((id) =>
      tempSelection.includes(id)
    );
    console.log("toggleAll - allAvailableSelected:", allAvailableSelected);

    let newTempSelection;
    if (allAvailableSelected) {
      // Deselect all available units, but keep any unavailable units that were somehow selected
      const unavailableSelected = tempSelection.filter(
        (id) => !availableIds.includes(id)
      );
      newTempSelection = unavailableSelected;
    } else {
      // Select all available units, plus any unavailable units that were already selected
      const unavailableSelected = tempSelection.filter(
        (id) => !availableIds.includes(id)
      );
      newTempSelection = [...unavailableSelected, ...availableIds];
    }

    console.log("toggleAll - new tempSelection:", newTempSelection);
    setTempSelection(newTempSelection);
  };

  // Remove selected item from final selection
  const removeItem = (id) => {
    const newVal = val.filter((item) => item !== id);
    console.log("MultiSelectDropdown removeItem called:", {
      id,
      oldVal: val,
      newVal
    });
    console.log("Calling onChange with:", newVal);
    onChange(newVal);
  };

  // Save changes on Done
  const onDone = () => {
    console.log(
      "MultiSelectDropdown onDone called with tempSelection:",
      tempSelection
    );
    console.log("Calling onChange with:", tempSelection);
    onChange(tempSelection);
    setOpen(false);
  };

  const getItemName = (id) => {
    if (id === "All") return "All";
    // Ensure both IDs are strings for comparison
    const stringId = String(id);
    const item = memoizedOptions.find(
      (option) => String(option.id) === stringId
    );
    console.log("getItemName:", {
      searchId: stringId,
      foundItem: item,
      availableOptions: memoizedOptions
        .map((opt) => ({ id: String(opt.id), name: opt.name }))
        .slice(0, 3)
    });
    return item ? String(item.name) : String(id);
  };

  // Determine if all are selected in tempSelection (only available units)
  const availableOptions = memoizedOptions.filter((option) => {
    const isAssignedToOther =
      option.assignment_status === "assigned_to_other" || option.is_assigned;
    const isCurrentlyAssigned =
      option.assignment_status === "currently_assigned" ||
      option.is_currently_assigned;
    const isSelected = tempSelection.includes(option.id);

    if (isEdit) {
      return isSelected || !isAssignedToOther; // Allow currently selected and available
    } else {
      return !isAssignedToOther && !isCurrentlyAssigned; // Only allow available
    }
  });

  const availableIds = availableOptions.map((item) => item.id);
  // Calculate "All Selected" state for committed value (rendering display)
  const allValSelected = useMemo(() => {
    if (!val || val.length === 0) return false;
    if (val.includes("All")) return true;
    if (!memoizedOptions || memoizedOptions.length === 0) return false;

    return memoizedOptions.every((opt) => {
      // If selected, it's counted
      if (val.includes(opt.id)) return true;

      // If not selected, it must be unavailable to be considered "accounted for"
      // Unavailable = Assigned to Other OR (Create Mode AND Currently Assigned)
      // Note: We use the explicit API fields or mapped fields from options
      const isAssigned =
        opt.assignment_status === "assigned_to_other" ||
        (opt.is_assigned && !isEdit); // matches "isAssignedToOther" logic roughly

      // Actually, let's look at exact disable logic:
      // assignment_status === "assigned_to_other" || (is_assigned && !(isEdit && isSelected))
      // Since isSelected is false here (not in val), condition simplifies to:
      // assignment_status === "assigned_to_other" || is_assigned

      const isCurrentlyAssigned =
        opt.assignment_status === "currently_assigned" ||
        opt.is_currently_assigned;

      if (isEdit) {
        // In edit mode, currently assigned units (to this fee) are available.
        // So only "Assigned to Other" is unavailable.
        return isAssigned;
      } else {
        // In create mode, both "Assigned to Other" and "Currently Assigned" are unavailable
        return isAssigned || isCurrentlyAssigned;
      }
    });
  }, [val, memoizedOptions, isEdit]);

  // Calculate "All Selected" state for temporary selection (dropdown checkbox)
  const allTempSelected =
    availableIds.length > 0 &&
    availableIds.every((id) => tempSelection.includes(id));
  const someTempSelected = tempSelection.length > 0 && !allTempSelected;

  // Get display value - show individual items even when "All" is functionally selected
  const getDisplayValue = () => {
    console.log("getDisplayValue called:", {
      val,
      memoizedVal,
      memoizedOptions: memoizedOptions.slice(0, 3),
      valLength: val.length,
      memoizedValLength: memoizedVal.length,
      memoizedOptionsLength: memoizedOptions.length,
      isEdit
    });

    if (val.length === 0) {
      console.log("No values selected, returning empty array");
      return [];
    }

    // If all options are selected, show "All" instead of individual items
    if (val.length === memoizedOptions.length && memoizedOptions.length > 0) {
      console.log("All options selected, returning All");
      return ["All"]; // Return 'All' to show it as a single tag
    }

    console.log("Returning individual values:", val);
    return val;
  };

  const displayValue = getDisplayValue();

  // Handle removing "All" - when "All" is removed, clear all selections
  const handleRemoveItem = (id) => {
    if (id === "All") {
      // If removing "All", clear all selections
      onChange([]);
    } else {
      // Remove individual item
      onChange(val.filter((item) => item !== id));
    }
  };
  const getSelectedDisplay = () => {
    if (!val || val.length === 0) {
      return null;
    }

    if (allValSelected) {
      return (
        <div className="mb-2 p-2 bg-primary bg-opacity-10 rounded-md border border-primary border-opacity-30">
          <div className="text-sm font-medium text-primary mb-1">
            Selected Units:
          </div>
          <div className="text-sm text-gray-700">All Units</div>
        </div>
      );
    }

    return (
      <div className="mb-2 p-2 bg-primary bg-opacity-10 rounded-md border border-primary border-opacity-30">
        <div className="text-sm font-medium text-primary mb-1">
          Selected Units:
        </div>
        <div className="flex flex-wrap gap-1">
          {val
            .filter((id) => id !== "All")
            .map((id, index) => (
              <span
                key={id}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary text-white"
              >
                {getItemName(id)}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveItem(id);
                    }}
                    className="ml-1 text-white hover:text-red-100 focus:outline-none"
                    aria-label={`Remove ${getItemName(id)}`}
                  >
                    &times;
                  </button>
                )}
              </span>
            ))}
        </div>
      </div>
    );
  };

  return (
    <div ref={ref} className="relative" style={{ width: "100%" }}>
      {/* Selected Values Display */}
      {getSelectedDisplay()}

      {/* Input box */}
      <div
        onClick={() => {
          if (disabled) return; // Don't open if disabled
          if (open) {
            setOpen(false);
          } else {
            // Ensure tempSelection is synced with current value when opening
            console.log(
              "Opening dropdown, syncing tempSelection with current value:",
              val
            );

            if (JSON.stringify(val) !== JSON.stringify(tempSelection)) {
              setTempSelection(val);
            }
            setOpen(true);
          }
        }}
        className={`login-field-input !flex items-center justify-between pr-8 relative ${disabled
            ? "bg-disabledInput cursor-not-allowed text-black100"
            : open
              ? "!border-primary !bg-white !shadow-ring-primary cursor-pointer"
              : "bg-white cursor-pointer"
        }`}
        style={{
          boxSizing: "border-box",
          fontSize: "0.875rem",
          minHeight: "38px"
        }}
      >
        <span
          className={`truncate text-sm ${val && val.length > 0 ? "text-gray-900" : "text-gray-500"
          }`}
        >
          {val.length > 0
            ? allValSelected
              ? "All units selected"
              : `${val.length} unit${val.length > 1 ? "s" : ""} selected`
            : placeholder}
        </span>

        {/* Chevron icon */}
        <FaCaretDown
          className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 transition-transform ${open ? "rotate-180" : ""
          }`}
          style={{ width: "16px", height: "16px" }}
        />
      </div>

      {/* Dropdown */}
      {open && !disabled && (
        <div className="absolute z-20 bg-white border border-gray-200 rounded-lg mt-1 w-full shadow-lg max-h-96 overflow-hidden flex flex-col">
          <div className="flex-grow overflow-y-auto p-2">
            {/* ALL checkbox */}
            <label
              className="flex items-center space-x-3 px-3 py-2 cursor-pointer font-medium border-b border-gray-200 hover:bg-gray-50 rounded transition-colors"
              title="Select/Deselect All Available Units"
            >
              <div className="relative">
                <input
                  type="checkbox"
                  checked={allTempSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someTempSelected;
                  }}
                  onChange={(e) => {
                    toggleAll();
                  }}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${allTempSelected || someTempSelected
                      ? "bg-primary border-primary"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {allTempSelected && (
                    <svg
                      className="w-2.5 h-2.5 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {!allTempSelected && someTempSelected && (
                    <div className="w-2 h-0.5 bg-white rounded"></div>
                  )}
                </div>
              </div>
              <span className="text-sm font-medium text-gray-900">All Units</span>
            </label>

            {/* Individual item checkboxes */}
            <div className="mt-2 space-y-1">
              {memoizedOptions.map(
                ({
                  id,
                  name,
                  assignment_status,
                  is_assigned,
                  is_currently_assigned
                }) => {
                  // Determine styling and availability based on assignment status
                  let statusClass = "";
                  let statusIcon = "";
                  let isDisabled = false;
                  let statusIndicator = "";

                  const isSelected = tempSelection.includes(id);

                  // If editing and the item is currently selected in the form, treat as currently assigned
                  if (isEdit && isSelected) {
                    statusClass = "bg-blue-50 border-l-4 border-l-blue-400";
                    isDisabled = false;
                  } else if (
                    assignment_status === "currently_assigned" ||
                    is_currently_assigned
                  ) {
                    statusClass = "bg-blue-50 border-l-4 border-l-blue-400";
                    // In edit mode, allow selection of currently assigned units (they belong to this service fee)
                    isDisabled = !isEdit;
                  } else if (
                    assignment_status === "assigned_to_other" ||
                    (is_assigned && !(isEdit && isSelected))
                  ) {
                    statusClass =
                      "bg-red-50 border-l-4 border-l-red-400 opacity-60";
                    statusIndicator = "(Assigned)";
                    // Always disable units assigned to other service fees
                    isDisabled = true;
                  } else {
                    statusClass = "bg-green-50 border-l-4 border-l-green-400";
                    isDisabled = false;
                  }

                  return (
                    <label
                      key={id}
                      className={`flex items-center space-x-3 px-3 py-2 rounded transition-colors ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"
                        } ${statusClass} ${!isDisabled && isSelected
                          ? "bg-primary bg-opacity-10 border border-primary border-opacity-40"
                          : !isDisabled
                            ? "hover:bg-gray-50"
                            : ""
                      }`}
                      title={
                        isDisabled
                          ? "This unit is assigned to another service fee"
                          : ""
                      }
                    >
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={tempSelection.includes(id)}
                          onChange={(e) => {
                            console.log("Checkbox onChange triggered:", {
                              id,
                              checked: e.target.checked,
                              isDisabled
                            });
                            if (!isDisabled) {
                              toggleItem(id);
                            }
                          }}
                          disabled={isDisabled}
                          className="sr-only"
                        />
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${isSelected && !isDisabled
                              ? "bg-primary border-primary"
                              : isDisabled
                                ? "bg-gray-300 border-gray-400"
                                : "border-gray-300 bg-white"
                          }`}
                        >
                          {isSelected && !isDisabled && (
                            <svg
                              className="w-2.5 h-2.5 text-white"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-sm font-medium flex items-center gap-1 ${isSelected && !isDisabled
                            ? "text-primary"
                            : isDisabled
                              ? "text-gray-500"
                              : "text-gray-700"
                        }`}
                      >
                        {String(name)}
                        {statusIndicator && (
                          <span className="text-xs text-red-600 font-normal">
                            {statusIndicator}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                }
              )}
            </div>
          </div>

          {/* Footer with Done button */}
          <div className="border-t border-gray-200 p-3 bg-gray-50">
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={onDone}
                className="px-4 py-2 rounded-md bg-primary text-white font-medium hover:bg-primary-dark transition-colors shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ServiceFeeFormView = ({
  formMethods,
  onClose,
  onNext,
  towers = [],
  units = [],
  towersLoading = false,
  unitsLoading = false,
  loadUnitsByTower = () => {},
  clearUnitsData = () => {},
  isEdit = false,
  hasFormChanges = true,
  originalDueDay = null,
  isInitialDataReady = true
}) => {
  const dispatch = useDispatch();

  // Debug: Log the formMethods being received
  console.log("ServiceFeeFormView received formMethods:", {
    hasHandleUnitChange: !!formMethods?.handleUnitChange,
    handleUnitChangeType: typeof formMethods?.handleUnitChange,
    formMethodsKeys: Object.keys(formMethods || {}),
    fullFormMethods: formMethods
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
    setValue,
    trigger,
    clearErrors
  } = formMethods;

  const { fields, append, remove } = useFieldArray({ control, name: "mfs" });
  const {
    fields: latePenaltyFields,
    append: appendLatePenalty,
    remove: removeLatePenalty
  } = useFieldArray({
    control,
    name: "latePenaltyTiers"
  });
  const paymentMethods = watch("paymentMethods");

  // Debug log for payment methods state (throttled to prevent excessive logging)
  const paymentMethodsRef = useRef(paymentMethods);
  useEffect(() => {
    const changed =
      JSON.stringify(paymentMethodsRef.current) !==
      JSON.stringify(paymentMethods);
    if (changed) {
      console.log("Payment methods in FormView:", paymentMethods);
      paymentMethodsRef.current = paymentMethods;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(paymentMethods)]); // Use stringified version for comparison

  // State for all dropdowns
  const [bankNameOpen, setBankNameOpen] = useState(false);
  const [mfsProviderOpen, setMfsProviderOpen] = useState({});
  const [dueDayOpen, setDueDayOpen] = useState(false);

  // Click outside handler for all dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bankNameOpen) setBankNameOpen(false);
      if (dueDayOpen) setDueDayOpen(false);

      // Close MFS provider dropdowns
      const openProviders = Object.keys(mfsProviderOpen).filter(
        (key) => mfsProviderOpen[key]
      );
      if (openProviders.length > 0) {
        setMfsProviderOpen((prev) => {
          const newState = { ...prev };
          openProviders.forEach((key) => {
            newState[key] = false;
          });
          return newState;
        });
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankNameOpen, dueDayOpen]); // Removed mfsProviderOpen to prevent excessive rerenders

  // Towers and units are now passed as props

  // Load units when a tower is selected, clear units when no tower is selected
  const selectedTower = watch("tower");
  const selectedUnits = watch("unit") || [];

  // Debug logging for towers and units data (memoized to avoid rerenders)
  const debugInfo = useMemo(
    () => ({
      unitsLength: units.length,
      selectedTower,
      towersLength: towers.length,
      unitsLoading,
      towersLoading
    }),
    [units.length, selectedTower, towers.length, unitsLoading, towersLoading]
  );

  useEffect(() => {
    console.log("ServiceFeeFormView - Units data debug:", {
      units: units.slice(0, 3), // Show first 3 units for debugging
      ...debugInfo
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debugInfo]); // Only rerun when debug info changes

  // Use refs to avoid dependency issues
  const loadUnitsByTowerRef = useRef(loadUnitsByTower);
  const clearUnitsDataRef = useRef(clearUnitsData);
  const previousTowerRef = useRef(selectedTower);
  loadUnitsByTowerRef.current = loadUnitsByTower;
  clearUnitsDataRef.current = clearUnitsData;

  useEffect(() => {
    const previousTower = previousTowerRef.current;

    if (selectedTower) {
      // If tower changed from one to another, clear previously selected units
      if (previousTower && previousTower !== selectedTower) {
        setValue("unit", []);
      }
      // In edit mode the parent already loads units (with exclude logic & caching).
      // Avoid reloading here to prevent flicker or clearing matched values.
      if (!isEdit) {
        loadUnitsByTowerRef.current([selectedTower]);
      }
    } else {
      // Clear units when no tower is selected
      clearUnitsDataRef.current();
      // Also clear the selected units in the form
      setValue("unit", []);
    }

    // Update the previous tower reference
    previousTowerRef.current = selectedTower;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTower, isEdit]); // setValue is stable, removed from deps

  // If units are selected (or change), proactively clear and re-validate the field
  useEffect(() => {
    if (Array.isArray(selectedUnits)) {
      if (selectedUnits.length > 0 && errors?.unit) {
        clearErrors && clearErrors("unit");
      }
      // Only trigger validation if the form has been submitted or the field has been touched
      // This prevents showing validation errors before user interaction
      if (
        !(isEdit && unitsLoading) &&
        (formMethods?.formState?.isSubmitted ||
          formMethods?.formState?.touchedFields?.unit)
      ) {
        trigger && trigger("unit");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(selectedUnits), isEdit, unitsLoading]); // Removed formMethods dependencies

  const onSubmit = (data) => {
    dispatch(createServiceFee(data));
    reset();
    onClose && onClose();
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: dropdownStyles }} />
      {console.log("ServiceFeeFormView render flags:", {
        isEdit,
        hasFormChanges,
        isDirty: formMethods?.formState?.isDirty
      })}
      <div className="flex flex-col h-full">
        <form
          onSubmit={handleSubmit((data) => {
            console.log("Form submission with data:", data);
            console.log("Payment methods on submit:", data.paymentMethods);
            // Clear any existing API errors before submission
            if (formMethods.clearErrors) {
              formMethods.clearErrors();
            }
            onNext(data);
          })}
          className="flex flex-col h-full"
        >
          {/* Scrollable content area */}
          {/* create Service Fee Settings */}
          <section className="p-4">
            <SectionTitle onClose={onClose}>
              {isEdit
                ? "Edit Service Fee Settings"
                : "Create Service Fee Settings"}
            </SectionTitle>

            {/* Creator Name (show user name and role, read-only) */}
            <div className="login-field">
              <div className="text-left py-1 text-sm">
                <label htmlFor="creatorName">
                  Creator Name<span className="text-primary ml-1">*</span>
                </label>
              </div>

              <input
                id="creatorName"
                {...register("creatorName")}
                disabled
                className="w-full login-field-input text-sm"
              />
            </div>

            {/* Tower & Unit */}
            <div className="flex flex-wrap gap-2">
              <div className="login-field w-full sm:flex-1">
                <div className="text-left py-1 text-sm">
                  <label htmlFor="tower">
                    Tower<span className="text-primary ml-1">*</span>
                  </label>
                </div>
                <Controller
                  name="tower"
                  control={control}
                  defaultValue=""
                  rules={{ required: "Tower is required" }}
                  render={({ field }) => (
                    <TowerSelector
                      towers={towers}
                      disabled={isEdit}
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value);
                        // Clear units when tower changes
                        if (!isEdit) {
                          setValue("unit", []);
                        }
                      }}
                      placeholder={
                        towersLoading
                          ? "Loading towers..."
                          : isEdit
                            ? "Tower (cannot be changed)"
                            : "Select a tower..."
                      }
                      multiSelect={false}
                      hideAll={true}
                    />
                  )}
                />
                {errors.tower && (
                  <ErrorMessage message={errors.tower.message} />
                )}
              </div>

              <div className="login-field w-full sm:flex-1">
                <div className="text-left py-1 text-sm">
                  <label htmlFor="unit">
                    Unit<span className="text-primary ml-1">*</span>
                  </label>
                </div>
                <Controller
                  name="unit"
                  control={control}
                  defaultValue={[]}
                  rules={{
                    // Suppress validation while units are loading in edit mode to avoid flash
                    required:
                      isEdit && (unitsLoading || !isInitialDataReady)
                        ? false
                        : "At least one unit is required",
                    validate: (value) => {
                      if (isEdit && (unitsLoading || !isInitialDataReady))
                        return true;
                      return (
                        (Array.isArray(value) && value.length > 0) ||
                        "At least one unit is required"
                      );
                    }
                  }}
                  render={({ field }) => {
                    return (
                      <MultiSelectDropdown
                        value={field.value}
                        onChange={(newUnits) => {
                          if (formMethods.handleUnitChange) {
                            formMethods.handleUnitChange(newUnits);
                          } else {
                            field.onChange(newUnits);
                          }
                          clearErrors && clearErrors("unit");
                        }}
                        options={[...units].sort((a, b) => {
                          const nameA = a.display_name || a.unit_name || a.name || "";
                          const nameB = b.display_name || b.unit_name || b.name || "";
                            return naturalSort(nameA, nameB);
                        }).map((unit) => {
                            // Use the display_name from backend, which is properly formatted
                            const unitId = String(unit.id);
                            let unitName = unit.display_name;

                            // Fallback to constructing display name if not provided by backend
                            if (!unitName) {
                              const name =
                              unit.unit_name || unit.name || `Unit ${unit.id}`;
                              const floor =
                                unit.floor_no ||
                                unit.floor_number ||
                                unit.floor ||
                                "N/A";
                              const tower = unit.tower_name || "";
                              unitName = tower
                                ? `${name} (Floor ${floor}, ${tower})`
                                : `${name} (Floor ${floor})`;
                            }

                            // Derive assignment flags from text when API flags are missing
                            const displayText = String(
                              unit.display_name || unitName || ""
                            );
                            const textAssignedToOther = displayText.includes(
                              "(Assigned to Other)"
                            );
                            const textCurrentlyAssigned = displayText.includes(
                              "(Currently Assigned)"
                            );

                            const isCurrentlyAssigned =
                              Boolean(unit.is_currently_assigned) ||
                              unit.assignment_status === "currently_assigned" ||
                              textCurrentlyAssigned;
                            const isAssignedToOther =
                              Boolean(unit.is_assigned) ||
                              unit.assignment_status === "assigned_to_other" ||
                              textAssignedToOther;

                            return {
                              id: unitId,
                              name: String(unitName),
                              assignment_status: isCurrentlyAssigned
                                ? "currently_assigned"
                                : isAssignedToOther
                                  ? "assigned_to_other"
                                  : unit.assignment_status,
                              is_assigned: isAssignedToOther,
                              is_currently_assigned: isCurrentlyAssigned
                            };
                          })}
                        placeholder={
                          !selectedTower
                            ? "Please select a tower first..."
                            : unitsLoading && (!isEdit || units.length === 0)
                              ? "Loading units..."
                              : units.length === 0
                                ? "No units available for selected tower"
                                : isEdit
                                  ? "Select units to update (you can change assigned units)"
                                  : "Select units..."
                        }
                        disabled={
                          !selectedTower ||
                          (unitsLoading && (!isEdit || units.length === 0))
                        }
                        isEdit={isEdit}
                      />
                    );
                  }}
                />
                {errors.unit && <ErrorMessage message={errors.unit.message} />}
              </div>
            </div>

            {/* Frequency, Currency, Due Day */}
            <div className="flex flex-wrap gap-2">
              <div className="login-field w-full sm:flex-1">
                <div className="text-left py-1 text-sm">
                  <label htmlFor="frequency">
                    Frequency<span className="text-primary ml-1">*</span>
                  </label>
                </div>
                <Controller
                  name="frequency"
                  control={control}
                  defaultValue="Monthly"
                  rules={{ required: "Frequency is required" }}
                  render={({ field }) => (
                    <input
                      id="frequency"
                      {...field}
                      value="Monthly"
                      disabled
                      className="w-full login-field-input text-sm"
                    />
                  )}
                />
                {errors.frequency && (
                  <ErrorMessage message={errors.frequency.message} />
                )}
              </div>

              <div className="login-field w-full sm:flex-1">
                <div className="text-left py-1 text-sm">
                  <label htmlFor="currency">
                    Currency<span className="text-primary ml-1">*</span>
                  </label>
                </div>
                <Controller
                  name="currency"
                  control={control}
                  defaultValue="BDT"
                  rules={{ required: "Currency is required" }}
                  render={({ field }) => (
                    <input
                      id="currency"
                      {...field}
                      value="BDT"
                      disabled
                      className="w-full login-field-input text-sm"
                    />
                  )}
                />
                {errors.currency && (
                  <ErrorMessage message={errors.currency.message} />
                )}
              </div>
            </div>

            {/* Fee Amount and Service Fee Date */}
            <div className="flex flex-wrap gap-2">
              <div className="login-field w-full sm:flex-1">
                <div className="text-left py-1 text-sm">
                  <label htmlFor="feeAmount">
                    Service Fee Amount ({watch("currency")})
                    <span className="text-primary ml-1">*</span>
                  </label>
                </div>
                <Controller
                  name="feeAmount"
                  control={control}
                  defaultValue={null}
                  rules={{
                    required: "Fee amount is required",
                    validate: (value) => {
                      const numValue = parseFloat(value);
                      if (isNaN(numValue)) return "Please enter a valid number";
                      if (numValue < 0) return "Fee amount cannot be negative";
                      if (numValue == 0) return "Fee amount cannot be zero";

                      // Check if the value has more than 10 digits before decimal point
                      const valueStr = String(Math.floor(Math.abs(numValue)));
                      if (valueStr.length > 10) {
                        return "Fee amount cannot exceed 10 digits.";
                      }

                      return true;
                    }
                  }}
                  render={({ field }) => (
                    <input
                      id="feeAmount"
                      type="text"
                      value={field.value || ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow only numbers (no decimals, no negative signs)
                        const numericValue = value.replace(/[^0-9]/g, "");
                        field.onChange(numericValue);
                      }}
                      onBlur={field.onBlur}
                      className="w-full login-field-input text-sm"
                      placeholder="Enter fee amount"
                    />
                  )}
                />
                {errors.feeAmount && (
                  <ErrorMessage message={errors.feeAmount.message} />
                )}
              </div>

              <div className="login-field w-full sm:flex-1">
                <div className="text-left py-1 text-sm">
                  <label htmlFor="serviceFeeDate">
                    Service Fee Date
                    <span className="text-primary ml-1">*</span>
                  </label>
                </div>
                <Controller
                  name="serviceFeeDate"
                  control={control}
                  defaultValue=""
                  rules={{
                    required: "Service fee date is required"
                  }}
                  render={({ field }) => (
                    <ModernDatePicker
                      label=""
                      value={field.value || ""}
                      onChange={field.onChange}
                      placeholder="Select Service Fee Date"
                      name="serviceFeeDate"
                      error={errors.serviceFeeDate?.message || ""}
                      required
                      maxYearOffset={5}
                    />
                  )}
                />
                {errors.serviceFeeDate && (
                  <ErrorMessage message={errors.serviceFeeDate.message} />
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="login-field w-full sm:flex-1">
                <div className="text-left py-1 text-sm">
                  <label htmlFor="billingCycle">
                    Billing Cycle<span className="text-primary ml-1">*</span>
                  </label>
                </div>
                <Controller
                  name="billingCycle"
                  control={control}
                  defaultValue="Monthly"
                  rules={{ required: "Billing cycle is required" }}
                  render={({ field }) => (
                    <input
                      id="billingCycle"
                      {...field}
                      value="Monthly"
                      disabled
                      className="w-full login-field-input text-sm"
                    />
                  )}
                />
                {errors.billingCycle && (
                  <ErrorMessage message={errors.billingCycle.message} />
                )}
              </div>
              <div className="login-field w-full sm:flex-1">
                <div className="text-left py-1 text-sm">
                  <label htmlFor="dueDay">
                    Due Day of the Month
                    <span className="text-primary ml-1">*</span>
                  </label>
                </div>
                <Controller
                  name="dueDay"
                  control={control}
                  defaultValue=""
                  rules={{
                    required: "Due day is required",
                    validate: (value) => {
                      const numValue = parseInt(value);
                      if (isNaN(numValue) || numValue < 1 || numValue > 31) {
                        return "Due day must be between 1 and 31";
                      }
                      return true;
                    }
                  }}
                  render={({ field }) => (
                    <div className="relative">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setDueDayOpen(!dueDayOpen);
                        }}
                        className={`login-field-input !flex justify-between items-center gap-2 whitespace-nowrap ${dueDayOpen
                            ? "!border-primary !bg-white !shadow-ring-primary cursor-pointer"
                            : "bg-white cursor-pointer"
                        }`}
                        style={{
                          boxSizing: "border-box",
                          fontSize: "0.875rem"
                        }}
                      >
                        <span className="flex-1 truncate text-sm overflow-hidden">
                          {field.value ? `Day ${field.value}` : "Select day"}
                        </span>
                        <FaCaretDown
                          className={`flex-shrink-0 text-gray-500 transition-transform ${dueDayOpen ? "rotate-180" : ""
                          }`}
                          style={{ width: "16px", height: "16px" }}
                        />
                      </div>

                      {dueDayOpen && (
                        <ul className="absolute z-20 bg-white border border-gray-300 rounded mt-1 shadow-lg w-full max-h-60 overflow-y-auto">
                          <li
                            onClick={(e) => {
                              e.stopPropagation();
                              field.onChange("");
                              setDueDayOpen(false);
                            }}
                            className="px-3 py-2 cursor-pointer text-gray-500 hover:bg-primary hover:text-white"
                          >
                            Select day
                          </li>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(
                            (day) => (
                              <li
                                key={day}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  field.onChange(day);
                                  setDueDayOpen(false);
                                }}
                                className={`px-3 py-2 cursor-pointer ${field.value === day
                                    ? "bg-primary text-white"
                                    : "hover:bg-primary hover:text-white"
                                }`}
                              >
                                Day {day}
                              </li>
                            )
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                />
                {errors.dueDay && (
                  <ErrorMessage message={errors.dueDay.message} />
                )}
              </div>
            </div>
          </section>

          {/* Payment Settings */}
          <section className="p-4">
            <h5 className="text-sm text-primary">Payment Settings</h5>
            <div className="mt-3 space-y-3">
              <h4 className="text-base font-medium mb-4">
                Accepted Payment Methods
                <span className="text-primary ml-1">*</span>
              </h4>
              <div className="flex flex-col space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Controller
                    name="paymentMethods.cash"
                    control={control}
                    defaultValue={false}
                    rules={{
                      validate: {
                        atLeastOne: (value, formValues) => {
                          const paymentMethods =
                            formValues.paymentMethods || {};
                          return (
                            Boolean(paymentMethods.cash) ||
                            Boolean(paymentMethods.mfs) ||
                            Boolean(paymentMethods.bank) ||
                            "Please select at least one payment method (Cash, MFS, or Bank Transfer)"
                          );
                        }
                      }
                    }}
                    render={({ field }) => (
                      <input
                        type="checkbox"
                        checked={Boolean(field.value)}
                        onChange={(e) => {
                          console.log(
                            "Cash checkbox changed to:",
                            e.target.checked
                          );
                          field.onChange(e.target.checked);
                          // Force form to re-validate payment methods
                          const currentPaymentMethods =
                            watch("paymentMethods") || {};
                          console.log(
                            "Current payment methods after cash change:",
                            {
                              ...currentPaymentMethods,
                              cash: e.target.checked
                            }
                          );
                          // Trigger validation for all payment method fields
                          trigger([
                            "paymentMethods.cash",
                            "paymentMethods.mfs",
                            "paymentMethods.bank"
                          ]);
                        }}
                        className="w-5 h-5 rounded border-gray-300 accent-primary focus:ring-2 focus:ring-primary focus:ring-offset-0"
                      />
                    )}
                  />
                  <span className="text-base">Cash</span>
                </label>

                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Controller
                      name="paymentMethods.mfs"
                      control={control}
                      defaultValue={false}
                      rules={{
                        validate: {
                          atLeastOne: (value, formValues) => {
                            const paymentMethods =
                              formValues.paymentMethods || {};
                            return (
                              Boolean(paymentMethods.cash) ||
                              Boolean(paymentMethods.mfs) ||
                              Boolean(paymentMethods.bank) ||
                              "Please select at least one payment method (Cash, MFS, or Bank Transfer)"
                            );
                          }
                        }
                      }}
                      render={({ field }) => (
                        <input
                          type="checkbox"
                          checked={Boolean(field.value)}
                          onChange={(e) => {
                            console.log(
                              "MFS checkbox changed to:",
                              e.target.checked
                            );
                            field.onChange(e.target.checked);

                            // If MFS is being enabled and there are no MFS accounts, add one
                            if (e.target.checked && fields.length === 0) {
                              console.log(
                                "MFS enabled with no accounts, adding default MFS account"
                              );
                              append({
                                provider: "bKash",
                                name: "",
                                number: ""
                              });
                            }
                            // If MFS is being disabled, remove all MFS accounts
                            else if (!e.target.checked && fields.length > 0) {
                              console.log(
                                "MFS disabled, removing all MFS accounts"
                              );
                              // Remove all MFS accounts
                              for (let i = fields.length - 1; i >= 0; i--) {
                                remove(i);
                              }
                            }

                            // Force form to re-validate payment methods
                            const currentPaymentMethods =
                              watch("paymentMethods") || {};
                            console.log(
                              "Current payment methods after MFS change:",
                              {
                                ...currentPaymentMethods,
                                mfs: e.target.checked
                              }
                            );
                            // Trigger validation for all payment method fields
                            trigger([
                              "paymentMethods.cash",
                              "paymentMethods.mfs",
                              "paymentMethods.bank"
                            ]);
                          }}
                          className="w-5 h-5 rounded border-gray-300 accent-primary focus:ring-2 focus:ring-primary focus:ring-offset-0"
                        />
                      )}
                    />
                    <span className="text-base">MFS</span>
                  </label>

                  {/* MFS Details - shown when MFS is selected */}
                  {paymentMethods?.mfs && (
                    <div className="mt-4 ml-8">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-medium">
                          MFS Accounts <span className="text-primary">*</span>
                        </h4>
                        <button
                          type="button"
                          onClick={() =>
                            append({ provider: "bKash", name: "", number: "" })
                          }
                          className="text-base text-black bg-subprimary rounded-full w-8 h-8 flex justify-center items-center"
                        >
                          +
                        </button>
                      </div>

                      {/* Show helpful message if no MFS accounts */}
                      {fields.length === 0 && (
                        <div className="text-sm text-gray-600 mb-3 p-2 bg-blue-50 border border-blue-200 rounded">
                          💡 Please add at least one MFS account by clicking the
                          "+" button above.
                        </div>
                      )}

                      {fields.map((f, idx) => (
                        <div key={f.id} className="mb-3">
                          <div className="flex justify-end">
                            {fields.length > 1 && (
                              <button
                                type="button"
                                onClick={() => remove(idx)}
                                className="text-base text-black bg-subprimary rounded-full w-8 h-8 flex justify-center items-center"
                              >
                                -
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <div className="text-left py-1 text-sm">
                                <label htmlFor={`mfs-provider-${idx}`}>
                                  MFS Provider
                                  <span className="text-primary ml-1">*</span>
                                </label>
                              </div>
                              <Controller
                                name={`mfs.${idx}.provider`}
                                control={control}
                                defaultValue=""
                                rules={{ required: "MFS provider is required" }}
                                render={({ field }) => (
                                  <div className="relative">
                                    <div
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMfsProviderOpen((prev) => ({
                                          ...prev,
                                          [idx]: !prev[idx]
                                        }));
                                      }}
                                      className={`login-field-input !flex justify-between items-center gap-2 whitespace-nowrap ${mfsProviderOpen[idx]
                                          ? "!border-primary !bg-white !shadow-ring-primary cursor-pointer"
                                          : "bg-white cursor-pointer"
                                      }`}
                                      style={{
                                        boxSizing: "border-box",
                                        fontSize: "0.875rem"
                                      }}
                                    >
                                      <span className="flex-1 truncate text-sm overflow-hidden">
                                        {field.value || "Select provider"}
                                      </span>
                                      <FaCaretDown
                                        className={`flex-shrink-0 text-gray-500 transition-transform ${mfsProviderOpen[idx]
                                            ? "rotate-180"
                                            : ""
                                        }`}
                                        style={{
                                          width: "16px",
                                          height: "16px"
                                        }}
                                      />
                                    </div>

                                    {mfsProviderOpen[idx] && (
                                      <ul className="absolute z-20 bg-white border border-gray-300 rounded mt-1 shadow-lg w-full max-h-60 overflow-y-auto">
                                        <li
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            field.onChange("");
                                            setMfsProviderOpen((prev) => ({
                                              ...prev,
                                              [idx]: false
                                            }));
                                          }}
                                          className="px-3 py-2 cursor-pointer text-gray-500 hover:bg-primary hover:text-white"
                                        >
                                          Select provider
                                        </li>
                                        <li
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            field.onChange("IKcash");
                                            setMfsProviderOpen((prev) => ({
                                              ...prev,
                                              [idx]: false
                                            }));
                                          }}
                                          className={`px-3 py-2 cursor-pointer ${field.value === "IKcash"
                                              ? "bg-primary text-white"
                                              : "hover:bg-primary hover:text-white"
                                          }`}
                                        >
                                          IKcash
                                        </li>
                                        <li
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            field.onChange("Nagad");
                                            setMfsProviderOpen((prev) => ({
                                              ...prev,
                                              [idx]: false
                                            }));
                                          }}
                                          className={`px-3 py-2 cursor-pointer ${field.value === "Nagad"
                                              ? "bg-primary text-white"
                                              : "hover:bg-primary hover:text-white"
                                          }`}
                                        >
                                          Nagad
                                        </li>
                                        <li
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            field.onChange("bKash");
                                            setMfsProviderOpen((prev) => ({
                                              ...prev,
                                              [idx]: false
                                            }));
                                          }}
                                          className={`px-3 py-2 cursor-pointer ${field.value === "bKash"
                                              ? "bg-primary text-white"
                                              : "hover:bg-primary hover:text-white"
                                          }`}
                                        >
                                          bKash
                                        </li>
                                        <li
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            field.onChange("Rocket");
                                            setMfsProviderOpen((prev) => ({
                                              ...prev,
                                              [idx]: false
                                            }));
                                          }}
                                          className={`px-3 py-2 cursor-pointer ${field.value === "Rocket"
                                              ? "bg-primary text-white"
                                              : "hover:bg-primary hover:text-white"
                                          }`}
                                        >
                                          Rocket
                                        </li>
                                      </ul>
                                    )}
                                  </div>
                                )}
                              />
                              {errors.mfs?.[idx]?.provider && (
                                <ErrorMessage
                                  message={errors.mfs[idx].provider.message}
                                />
                              )}
                            </div>

                            <div>
                              <div className="text-left py-1 text-sm">
                                <label htmlFor={`mfs-name-${idx}`}>
                                  Account Name
                                  <span className="text-primary ml-1">*</span>
                                </label>
                              </div>
                              <input
                                id={`mfs-name-${idx}`}
                                {...register(`mfs.${idx}.name`, {
                                  required: "Account name is required"
                                })}
                                className="w-full login-field-input text-sm"
                                style={{ width: "100%" }}
                              />
                              {errors.mfs?.[idx]?.name && (
                                <ErrorMessage
                                  message={errors.mfs[idx].name.message}
                                />
                              )}
                            </div>

                            <div>
                              <div className="text-left py-1 text-sm">
                                <label htmlFor={`mfs-number-${idx}`}>
                                  Mobile Number
                                  <span className="text-primary ml-1">*</span>
                                </label>
                                <div className="text-xs text-gray-500 mt-1">
                                  Enter Bangladeshi mobile number (e.g.,
                                  01XXXXXXXXX)
                                </div>
                              </div>
                              <input
                                id={`mfs-number-${idx}`}
                                type="tel"
                                placeholder="01XXXXXXXXX"
                                {...register(`mfs.${idx}.number`, {
                                  required: "Mobile number is required",
                                  validate: (value) => {
                                    if (!value || !value.trim()) {
                                      return "Mobile number is required";
                                    }

                                    const mobileNumber = value.trim();

                                    // Check if it's exactly 11 digits
                                    if (mobileNumber.length !== 11) {
                                      return "Please enter a valid Bangladeshi mobile number (11 digits, e.g., 01XXXXXXXXX).";
                                    }

                                    // Check if it contains only digits
                                    if (!/^\d+$/.test(mobileNumber)) {
                                      return "Mobile number should contain only digits.";
                                    }

                                    // Check if it starts with '01'
                                    if (!mobileNumber.startsWith("01")) {
                                      return "Bangladeshi mobile number must start with '01'.";
                                    }

                                    // Check for valid Bangladeshi operator prefixes
                                    const validPrefixes = [
                                      "013",
                                      "014",
                                      "015",
                                      "016",
                                      "017",
                                      "018",
                                      "019"
                                    ];
                                    const prefix = mobileNumber.substring(0, 3);

                                    if (!validPrefixes.includes(prefix)) {
                                      return `Invalid mobile number prefix '${prefix}'. Valid prefixes are: ${validPrefixes.join(
                                        ", "
                                      )}.`;
                                    }

                                    return true;
                                  }
                                })}
                                className="w-full login-field-input text-sm"
                                style={{ width: "100%" }}
                                maxLength={11}
                              />
                              {errors.mfs?.[idx]?.number && (
                                <ErrorMessage
                                  message={errors.mfs[idx].number.message}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {/* MFS Section Validation Error */}
                      {errors.mfs &&
                        typeof errors.mfs === "object" &&
                        errors.mfs.message && (
                          <ErrorMessage message={errors.mfs.message} />
                        )}
                      {errors.mfs && (
                        <ErrorMessage message={errors.mfs.message} />
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Controller
                      name="paymentMethods.bank"
                      control={control}
                      defaultValue={false}
                      rules={{
                        validate: {
                          atLeastOne: (value, formValues) => {
                            const paymentMethods =
                              formValues.paymentMethods || {};
                            return (
                              Boolean(paymentMethods.cash) ||
                              Boolean(paymentMethods.mfs) ||
                              Boolean(paymentMethods.bank) ||
                              "Please select at least one payment method (Cash, MFS, or Bank Transfer)"
                            );
                          }
                        }
                      }}
                      render={({ field }) => (
                        <input
                          type="checkbox"
                          checked={Boolean(field.value)}
                          onChange={(e) => {
                            console.log(
                              "Bank checkbox changed to:",
                              e.target.checked
                            );
                            field.onChange(e.target.checked);
                            // Force form to re-validate payment methods
                            const currentPaymentMethods =
                              watch("paymentMethods") || {};
                            console.log(
                              "Current payment methods after Bank change:",
                              {
                                ...currentPaymentMethods,
                                bank: e.target.checked
                              }
                            );
                            // Trigger validation for all payment method fields
                            trigger([
                              "paymentMethods.cash",
                              "paymentMethods.mfs",
                              "paymentMethods.bank"
                            ]);
                          }}
                          className="w-5 h-5 rounded border-gray-300 accent-primary focus:ring-2 focus:ring-primary focus:ring-offset-0"
                        />
                      )}
                    />
                    <span className="text-base">Bank Transfer</span>
                  </label>

                  {/* Bank Details - shown when Bank is selected */}
                  {paymentMethods?.bank && (
                    <div className="mt-4 ml-8 space-y-4">
                      <h4 className="text-sm font-medium">
                        Bank Transfer Details
                      </h4>

                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <div className="text-left py-1 text-sm">
                            <label htmlFor="bankName">
                              Bank Name
                              <span className="text-primary ml-1">*</span>
                            </label>
                          </div>
                          <Controller
                            name="bank.bankName"
                            control={control}
                            defaultValue=""
                            rules={{ required: "Bank name is required" }}
                            render={({ field }) => (
                              <div className="relative">
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setBankNameOpen(!bankNameOpen);
                                  }}
                                  className={`login-field-input !flex justify-between items-center gap-2 whitespace-nowrap ${bankNameOpen
                                      ? "!border-primary !bg-white !shadow-ring-primary cursor-pointer"
                                      : "bg-white cursor-pointer"
                                  }`}
                                  style={{
                                    boxSizing: "border-box",
                                    fontSize: "0.875rem"
                                  }}
                                >
                                  <span className="flex-1 truncate text-sm overflow-hidden">
                                    {field.value || "Select bank"}
                                  </span>
                                  <FaCaretDown
                                    className={`flex-shrink-0 text-gray-500 transition-transform ${bankNameOpen ? "rotate-180" : ""
                                    }`}
                                    style={{ width: "16px", height: "16px" }}
                                  />
                                </div>

                                {bankNameOpen && (
                                  <ul className="absolute z-20 bg-white border border-gray-300 rounded mt-1 shadow-lg w-full max-h-60 overflow-y-auto">
                                    <li
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        field.onChange("");
                                        setBankNameOpen(false);
                                      }}
                                      className="px-3 py-2 cursor-pointer text-gray-500 hover:bg-primary hover:text-white"
                                    >
                                      Select bank
                                    </li>
                                    <li
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        field.onChange("Prime Bank");
                                        setBankNameOpen(false);
                                      }}
                                      className={`px-3 py-2 cursor-pointer ${field.value === "Prime Bank"
                                          ? "bg-primary text-white"
                                          : "hover:bg-primary hover:text-white"
                                      }`}
                                    >
                                      Prime Bank
                                    </li>
                                    <li
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        field.onChange("DBBL");
                                        setBankNameOpen(false);
                                      }}
                                      className={`px-3 py-2 cursor-pointer ${field.value === "DBBL"
                                          ? "bg-primary text-white"
                                          : "hover:bg-primary hover:text-white"
                                      }`}
                                    >
                                      DBBL
                                    </li>
                                    <li
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        field.onChange("BRAC Bank");
                                        setBankNameOpen(false);
                                      }}
                                      className={`px-3 py-2 cursor-pointer ${field.value === "BRAC Bank"
                                          ? "bg-primary text-white"
                                          : "hover:bg-primary hover:text-white"
                                      }`}
                                    >
                                      BRAC Bank
                                    </li>
                                    <li
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        field.onChange("City Bank");
                                        setBankNameOpen(false);
                                      }}
                                      className={`px-3 py-2 cursor-pointer ${field.value === "City Bank"
                                          ? "bg-primary text-white"
                                          : "hover:bg-primary hover:text-white"
                                      }`}
                                    >
                                      City Bank
                                    </li>
                                  </ul>
                                )}
                              </div>
                            )}
                          />
                          {errors.bank?.bankName && (
                            <ErrorMessage
                              message={errors.bank.bankName.message}
                            />
                          )}
                        </div>

                        <div>
                          <div className="text-left py-1 text-sm">
                            <label htmlFor="accountName">
                              Account Name
                              <span className="text-primary ml-1">*</span>
                            </label>
                          </div>
                          <input
                            id="accountName"
                            {...register("bank.accountName", {
                              required: "Account name is required"
                            })}
                            className="w-full login-field-input text-sm"
                            style={{ width: "100%" }}
                          />
                          {errors.bank?.accountName && (
                            <ErrorMessage
                              message={errors.bank.accountName.message}
                            />
                          )}
                        </div>

                        <div>
                          <div className="text-left py-1 text-sm">
                            <label htmlFor="accountNumber">
                              Account Number
                              <span className="text-primary ml-1">*</span>
                            </label>
                            <div className="text-xs text-gray-500 mt-1">
                              Enter bank account number (10-18 digits as per
                              Bangladesh bank standards)
                            </div>
                          </div>
                          <input
                            id="accountNumber"
                            type="tel"
                            placeholder="Enter 10-18 digit account number"
                            {...register("bank.accountNumber", {
                              required: "Account number is required",
                              validate: (value) => {
                                if (!value || !value.trim()) {
                                  return "Account number is required";
                                }

                                const accountNumber = value.trim();

                                // Check if it contains only digits
                                if (!/^\d+$/.test(accountNumber)) {
                                  return "Account number should contain only digits.";
                                }

                                // Check minimum length (most Bangladeshi banks have at least 10 digits)
                                if (accountNumber.length < 10) {
                                  return "Account number must be at least 10 digits long.";
                                }

                                // Check maximum length (Bangladeshi banking standard is 18 digits)
                                if (accountNumber.length > 18) {
                                  return "Account Number cannot exceed 18 digits as per Bangladesh bank standards.";
                                }

                                return true;
                              }
                            })}
                            className="w-full login-field-input text-sm"
                            style={{ width: "100%" }}
                            maxLength={18}
                          />
                          {errors.bank?.accountNumber && (
                            <ErrorMessage
                              message={errors.bank.accountNumber.message}
                            />
                          )}
                        </div>

                        <div>
                          <div className="text-left py-1 text-sm">
                            <label htmlFor="branch">
                              Branch Name
                              <span className="text-primary ml-1">*</span>
                            </label>
                          </div>
                          <input
                            id="branch"
                            {...register("bank.branch", {
                              required: "Branch name is required"
                            })}
                            className="w-full login-field-input text-sm"
                            style={{ width: "100%" }}
                          />
                          {errors.bank?.branch && (
                            <ErrorMessage
                              message={errors.bank.branch.message}
                            />
                          )}
                        </div>

                        <div>
                          <div className="text-left py-1 text-sm">
                            <label htmlFor="routing">
                              Routing Number
                              <span className="text-primary ml-1">*</span>
                            </label>
                          </div>
                          <input
                            id="routing"
                            {...register("bank.routing", {
                              required: "Routing number is required"
                            })}
                            className="w-full login-field-input text-sm"
                            style={{ width: "100%" }}
                          />
                          {errors.bank?.routing && (
                            <ErrorMessage
                              message={errors.bank.routing.message}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Methods Validation Error */}
              {(errors.paymentMethods?.cash ||
                errors.paymentMethods?.mfs ||
                errors.paymentMethods?.bank) && (
                <ErrorMessage
                  message={
                    errors.paymentMethods?.cash?.message ||
                    errors.paymentMethods?.mfs?.message ||
                    errors.paymentMethods?.bank?.message ||
                    "Please select at least one payment method (Cash, MFS, or Bank Transfer)"
                  }
                />
              )}
              {errors.paymentMethods && (
                <ErrorMessage message={errors.paymentMethods.message} />
              )}
            </div>
          </section>

          {/* Late Penalty Settings */}
          <section className="p-4">
            <h5 className="text-sm text-primary">Late Penalty Settings</h5>
            <div className="mt-3 space-y-3">
              <h4 className="text-base font-medium mb-4">
                Late Payment Penalties
                <span className="text-primary ml-1">*</span>
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                Configure penalty fees for overdue payments. Multiple penalty
                tiers can be added.
              </p>

              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Controller
                    name="latePaymentEnabled"
                    control={control}
                    defaultValue={false}
                    render={({ field }) => (
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="w-5 h-5 rounded border-gray-300 accent-primary focus:ring-2 focus:ring-primary focus:ring-offset-0"
                      />
                    )}
                  />
                  <span className="text-base font-medium text-black">
                    Enable Late Payment Penalties
                  </span>
                </label>
                {watch("latePaymentEnabled") && (
                  <button
                    type="button"
                    onClick={() => {
                      appendLatePenalty({
                        daysOverdue: "",
                        penaltyPercentage: ""
                      });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    + Add Penalty
                  </button>
                )}
              </div>

              {watch("latePaymentEnabled") && (
                <div className="space-y-4">
                  {[...latePenaltyFields].sort((a, b) => {
                    const valA = watch(`latePenaltyTiers.${latePenaltyFields.indexOf(a)}.daysOverdue`);
                    const valB = watch(`latePenaltyTiers.${latePenaltyFields.indexOf(b)}.daysOverdue`);
                      return (valA || 0) - (valB || 0);
                  }).map((field) => {
                    const index = latePenaltyFields.findIndex(f => f.id === field.id);
                      return (
                        <div
                          key={field.id}
                          className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium mb-1">
                                Penalty Percentage (%)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="1.01"
                                max="100"
                                placeholder="e.g., 5"
                                {...register(
                                  `latePenaltyTiers.${index}.penaltyPercentage`,
                                  {
                                    required: watch("latePaymentEnabled")
                                      ? "Penalty percentage is required"
                                      : false,
                                    min: {
                                      value: 1.01,
                                    message: "Percentage must be greater than 1"
                                    },
                                    max: {
                                      value: 100,
                                      message: "Percentage cannot exceed 100"
                                    },
                                    valueAsNumber: true
                                  }
                                )}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                              />
                              {errors.latePenaltyTiers?.[index]
                                ?.penaltyPercentage && (
                                <ErrorMessage
                                  message={
                                    errors.latePenaltyTiers[index].penaltyPercentage
                                      .message
                                  }
                                />
                              )}
                            </div>
                            <div className="flex items-end gap-2">
                              <div className="flex-1">
                                <label className="block text-sm font-medium mb-1">
                                  Days Overdue
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  max="31"
                                  placeholder="e.g., 30"
                                  {...register(
                                    `latePenaltyTiers.${index}.daysOverdue`,
                                    {
                                      required: watch("latePaymentEnabled")
                                        ? "Days overdue is required"
                                        : false,
                                      min: {
                                        value: 1,
                                      message: "Days overdue must be at least 1"
                                      },
                                      max: {
                                        value: 31,
                                        message: "Days overdue cannot exceed 31"
                                      },
                                      valueAsNumber: true
                                    }
                                  )}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                                />
                              {errors.latePenaltyTiers?.[index]?.daysOverdue && (
                                  <ErrorMessage
                                    message={
                                      errors.latePenaltyTiers[index].daysOverdue
                                        .message
                                    }
                                  />
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeLatePenalty(index)}
                                className="p-2 text-red-600 hover:text-red-800 transition-colors"
                                title="Delete penalty tier"
                              >
                                <FaTrash className="text-lg" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {latePenaltyFields.length === 0 && (
                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 text-center text-sm text-gray-500">
                      No penalty tiers configured. Click "+ Add Penalty" to add
                      one.
                    </div>
                  )}

                  {latePenaltyFields.length > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> When multiple penalties are
                        configured, the system will apply the penalty
                        corresponding to the number of days overdue. Ensure
                        penalties are configured in ascending order of days for
                        proper calculation.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Fixed Footer with Next Button */}
          <div className="flex items-center justify-center p-4 border-t bg-white">
            <button
              type="submit"
              disabled={
                isEdit
                  ? !(hasFormChanges || formMethods?.formState?.isDirty)
                  : false
              }
              className="w-[90%] py-3 rounded-xl bg-primary text-white text-base font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
            >
              Next
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default ServiceFeeFormView;
