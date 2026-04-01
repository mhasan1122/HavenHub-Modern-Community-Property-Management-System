import React, { useState, useRef, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FaCalendarAlt } from "react-icons/fa";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import PropTypes from "prop-types";
import "./ModernDatePicker.css";

/**
 * ModernDatePicker - A modern, styled date picker component
 *
 * Props:
 * - label: string - Label text for the input
 * - value: string - Date value in YYYY-MM-DD format
 * - onChange: function - Handler for date change (receives YYYY-MM-DD string)
 * - error: string - Error message to display
 * - required: boolean - Whether the field is required
 * - disabled: boolean - Whether the field is disabled
 * - placeholder: string - Placeholder text
 * - minDate: string - Minimum selectable date (YYYY-MM-DD)
 * - maxDate: string - Maximum selectable date (YYYY-MM-DD)
 * - labelClassName: string - Custom className for label
 * - inputClassName: string - Extra classes for the input (for height/spacing tweaks)
 * - maxYearOffset: number - Extra future years to show in the year dropdown when maxDate is not provided
 * - showIcon: boolean - Whether to show the leading calendar icon
 */
const ModernDatePicker = ({
  label,
  value = "",
  onChange,
  error = "",
  required = false,
  disabled = false,
  placeholder = "Select date",
  minDate,
  maxDate,
  labelClassName = "text-sm font-medium text-gray-700",
  inputClassName = "",
  maxYearOffset = 0,
  showIcon = true,
  name,
  ...props
}) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const datePickerRef = useRef(null);

  // Convert YYYY-MM-DD string to Date object
  useEffect(() => {
    if (value) {
      const [year, month, day] = value.split("-");
      if (year && month && day) {
        const date = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day)
        );
        if (!isNaN(date.getTime())) {
          setSelectedDate(date);
        }
      }
    } else {
      setSelectedDate(null);
    }
  }, [value]);

  // Convert Date object to YYYY-MM-DD string
  const formatDateToString = (date) => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    if (onChange) {
      onChange(formatDateToString(date));
    }
    setIsOpen(false);
  };

  const handleInputClick = () => {
    if (!disabled) {
      setIsOpen(true);
    }
  };

  const clear = (e) => {
    e.stopPropagation();
    if (onChange) {
      onChange("");
    }
    setSelectedDate(null);
    setIsOpen(false);
  };

  // Format date for display
  const formatDateForDisplay = (date) => {
    if (!date) return "";
    const options = { year: "numeric", month: "short", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  // Parse min/max dates
  const parseDate = (dateString) => {
    if (!dateString) return null;
    const [year, month, day] = dateString.split("-");
    if (year && month && day) {
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    return null;
  };

  const minDateObj = parseDate(minDate);
  const maxDateObj = parseDate(maxDate);

  // Custom header component with year/month dropdowns
  const CustomHeader = ({
    date,
    decreaseMonth,
    increaseMonth,
    prevMonthButtonDisabled,
    nextMonthButtonDisabled,
    changeYear,
    changeMonth
  }) => {
    const currentYear = date.getFullYear();
    const currentMonth = date.getMonth();
    const years = [];
    const minYear = minDateObj ? minDateObj.getFullYear() : 1900;
    const maxYear = maxDateObj
      ? maxDateObj.getFullYear()
      : new Date().getFullYear() + maxYearOffset;

    for (let year = minYear; year <= maxYear; year++) {
      years.push(year);
    }

    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ];

    return (
      <div className="flex items-center justify-between px-3 py-2 bg-primary text-white rounded-t-lg">
        <button
          type="button"
          onClick={decreaseMonth}
          disabled={prevMonthButtonDisabled}
          className={`p-1.5 rounded-full hover:bg-primaryDark transition-colors ${
            prevMonthButtonDisabled ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <FaChevronLeft className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center gap-1.5">
          <select
            value={currentMonth}
            onChange={(e) => changeMonth(parseInt(e.target.value))}
            className="modern-datepicker-select bg-primary border border-white/20 text-white rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer hover:bg-primaryDark hover:border-white/40 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/40"
          >
            {months.map((month, index) => (
              <option
                key={index}
                value={index}
                className="bg-white text-gray-900"
              >
                {month}
              </option>
            ))}
          </select>
          <select
            value={currentYear}
            onChange={(e) => changeYear(parseInt(e.target.value))}
            className="modern-datepicker-select bg-primary border border-white/20 text-white rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer hover:bg-primaryDark hover:border-white/40 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/40"
          >
            {years.map((year) => (
              <option
                key={year}
                value={year}
                className="bg-white text-gray-900"
              >
                {year}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={increaseMonth}
          disabled={nextMonthButtonDisabled}
          className={`p-1.5 rounded-full hover:bg-primaryDark transition-colors ${
            nextMonthButtonDisabled ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <FaChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div>
      {label && (
        <div className="mb-2 text-left">
          <label className={labelClassName} htmlFor={name || "date-picker"}>
            {label}
            {required && <span className="text-primary ml-1">*</span>}
          </label>
        </div>
      )}

      <div className="relative">
        <div
          className={`relative flex items-center ${
            disabled ? "cursor-not-allowed" : "cursor-pointer"
          }`}
        >
          {/* Calendar Icon */}
          {showIcon && (
            <div className="absolute left-4 pointer-events-none flex items-center">
              <FaCalendarAlt
                className={`h-4 w-4 transition-colors duration-200 ${
                  isOpen
                    ? "text-primary"
                    : error
                    ? "text-red-500"
                    : "text-gray-400"
                }`}
              />
            </div>
          )}

          {/* Display Input */}
          <input
            type="text"
            readOnly
            value={selectedDate ? formatDateForDisplay(selectedDate) : ""}
            placeholder={placeholder}
            disabled={disabled}
            className={`login-field-input w-full pl-11 pr-4 cursor-pointer ${inputClassName} ${
              disabled
                ? "bg-disabledInput cursor-not-allowed text-black100"
                : selectedDate
                ? "text-gray-900"
                : "text-gray-400"
            } ${
              error
                ? "border-red-500 focus:border-red-500"
                : isOpen
                ? "border-primary"
                : ""
            }`}
            onClick={handleInputClick}
            style={showIcon ? { paddingLeft: "2.75rem" } : undefined}
          />

          {/* DatePicker Popup */}
          {isOpen && !disabled && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 rounded-xl border border-slate-200 shadow-[0_10px_30px_rgba(15,23,42,0.18)] bg-white">
              <DatePicker
                ref={datePickerRef}
                selected={selectedDate}
                onChange={handleDateChange}
                onSelect={handleDateChange}
                minDate={minDateObj}
                maxDate={maxDateObj}
                inline
                renderCustomHeader={CustomHeader}
                showYearDropdown
                showMonthDropdown
                dropdownMode="select"
                scrollableYearDropdown
                yearDropdownItemNumber={100}
                calendarClassName="modern-datepicker-calendar"
                dayClassName={(date) => {
                  if (!selectedDate) return "";
                  const isSelected =
                    date.getDate() === selectedDate.getDate() &&
                    date.getMonth() === selectedDate.getMonth() &&
                    date.getFullYear() === selectedDate.getFullYear();
                  return isSelected ? "modern-datepicker-day-selected" : "";
                }}
                {...props}
              />
              <div className="border-t border-gray-200 p-3 bg-white flex justify-end">
                <button
                  onClick={clear}
                  className="bg-gray-100 py-2 px-4 rounded-md font-medium transition-colors text-sm"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {/* Overlay to close calendar when clicking outside */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
};

ModernDatePicker.propTypes = {
  label: PropTypes.string,
  value: PropTypes.string,
  inputClassName: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
  minDate: PropTypes.string,
  maxDate: PropTypes.string,
  labelClassName: PropTypes.string,
  maxYearOffset: PropTypes.number,
  showIcon: PropTypes.bool,
  name: PropTypes.string
};

export default ModernDatePicker;
