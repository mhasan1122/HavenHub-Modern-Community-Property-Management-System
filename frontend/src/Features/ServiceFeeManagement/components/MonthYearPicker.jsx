// ✅ components/MonthYearPicker.jsx
import React, { forwardRef, useState } from 'react';
import DatePicker from 'react-datepicker';
import { FaCaretDown } from 'react-icons/fa6';
import 'react-datepicker/dist/react-datepicker.css';
import './MonthYearPicker.css';

const MonthYearPicker = ({
  label = "Select Month",
  className = "",
  required = false,
  value,
  onChange,
  hideLabel = false,
  levelClass = "",
  showFutureMonths = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedDate =
    value?.year && value?.month
      ? new Date(`${value.year}-${String(value.month).padStart(2, '0')}-01`)
      : null;

  const handleChange = (date) => {
    if (date) {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      onChange({ year, month });
    }
  };

  const handleClear = () => {
    onChange(null);
    setIsOpen(false);
  };

  // Custom input component to match the design of other filter buttons
  const CustomInput = forwardRef(({ value, onClick }, ref) => (
    <button
      type="button"
      onClick={onClick}
      ref={ref}
      className={`w-full h-[42px] px-3 border border-gray-300 rounded-md focus:outline-none focus:border-primary focus:shadow-ring-primary text-sm text-primary font-medium bg-white text-left flex items-center justify-between transition-all hover:border-gray-400 ${className}`}
    >
      <span className="truncate">{value || label}</span>
      <FaCaretDown className={`w-3 h-3 text-primary flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
  ));

  return (
    <div className="relative">
      {!hideLabel && label && (
        <label className={`block text-sm font-medium text-gray-700 mb-2 ${levelClass}`}>
          {label} {required && <span className="text-primary text-lg">*</span>}
        </label>
      )}

      <DatePicker
        selected={selectedDate}
        onChange={handleChange}
        onCalendarOpen={() => setIsOpen(true)}
        onCalendarClose={() => setIsOpen(false)}
        dateFormat="MMMM yyyy"
        showMonthYearPicker
        renderCustomHeader={({ date, decreaseMonth, increaseMonth }) => (
          <div className="flex items-center  justify-between px-4 py-2 bg-primary text-white rounded-t-xl">
            <button
              onClick={decreaseMonth}
              className="text-lg font-extrabold hover:bg-primaryHover rounded-full p-2"
            >
              {'<'}
            </button>
            <span className="text-xl font-semibold">
              {date.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={increaseMonth}
              className="text-lg font-extrabold hover:bg-primaryHover rounded-full p-2"
            >
              {'>'}
            </button>
          </div>
        )}
        maxDate={showFutureMonths ? null : new Date()}
        customInput={<CustomInput />}
        required={required}
        wrapperClassName="w-full"
        popperClassName='react-datepicker-popper'
        calendarClassName='react-datepicker'
        popperPlacement="bottom-start"
      >
        <div className="border-t w-full border-gray-200 p-3 bg-white flex justify-start">
          <button
            type="button"
            onClick={handleClear}
            className="bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 px-4 rounded-md font-medium transition-colors text-sm border border-gray-200"
          >
            Clear
          </button>
        </div>
      </DatePicker>
    </div>
  );
};

export default MonthYearPicker;
