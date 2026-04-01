import React from "react";

/**
 * DateInput Component - Reusable date input field
 * 
 * Props:
 * - label: string - Label text for the input
 * - value: string - Date value in YYYY-MM-DD format
 * - onChange: function - Handler for date change
 * - error: string - Error message to display
 * - required: boolean - Whether the field is required
 * - disabled: boolean - Whether the field is disabled
 * - placeholder: string - Placeholder text
 * - minDate: string - Minimum selectable date (YYYY-MM-DD)
 * - maxDate: string - Maximum selectable date (YYYY-MM-DD)
 */
const DateInput = ({
  label,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  placeholder = "Select date",
  minDate,
  maxDate,
  ...props
}) => {
  return (
    <div className="login-field">
      {label && (
        <div className="text-left py-1 text-sm">
          <label>
            {label}
            {required && <span className="text-primary ml-1">*</span>}
          </label>
        </div>
      )}
      <input
        type="date"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        min={minDate}
        max={maxDate}
        placeholder={placeholder}
        inputMode="none"
        className={`w-full border rounded px-2 py-2 text-sm ${
          disabled
            ? "bg-gray-100 cursor-not-allowed opacity-60"
            : "bg-white"
        } ${error ? "border-red-500" : "border-gray-300"}`}
        {...props}
      />
      {error && (
        <div className="text-red-500 text-xs mt-1">{error}</div>
      )}
    </div>
  );
};

export default DateInput;

