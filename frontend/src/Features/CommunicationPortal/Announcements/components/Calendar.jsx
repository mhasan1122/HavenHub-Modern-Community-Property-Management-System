import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

const Calendar = ({ value, onChange, placeholder = "Select Date" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : null);
  const [dropdownPosition, setDropdownPosition] = useState('bottom');
  const calendarRef = useRef(null);
  const inputRef = useRef(null);

  // Memoize static data
  const months = useMemo(() => [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ], []);

  const daysOfWeek = useMemo(() => ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], []);

  // Calculate dropdown position
  const calculatePosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const calendarHeight = 400; // Approximate height of calendar

      setDropdownPosition(spaceBelow < calendarHeight && spaceAbove > spaceBelow ? 'top' : 'bottom');
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      calculatePosition();
      window.addEventListener('scroll', calculatePosition);
      window.addEventListener('resize', calculatePosition);

      return () => {
        window.removeEventListener('scroll', calculatePosition);
        window.removeEventListener('resize', calculatePosition);
      };
    }
  }, [isOpen, calculatePosition]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (value) {
      try {
        const dateObj = new Date(value);
        // Check if the date is valid
        if (!isNaN(dateObj.getTime())) {
          setSelectedDate(dateObj);
          setCurrentDate(dateObj);
        }
      } catch (error) {
        console.warn('Invalid date value:', value);
      }
    } else {
      // Clear selection if value is empty
      setSelectedDate(null);
    }
  }, [value]);

  const formatDate = useCallback((date) => {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }, []);

  const getDaysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      const prevMonthDay = new Date(year, month, 0 - (startingDayOfWeek - 1 - i));
      days.push({
        date: prevMonthDay,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false
      });
    }

    // Add days of the current month
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isToday = date.toDateString() === today.toDateString();
      const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();

      days.push({
        date,
        isCurrentMonth: true,
        isToday,
        isSelected
      });
    }

    // Add days from next month to fill the grid
    const remainingCells = 42 - days.length;
    for (let day = 1; day <= remainingCells; day++) {
      const nextMonthDay = new Date(year, month + 1, day);
      days.push({
        date: nextMonthDay,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false
      });
    }

    return days;
  }, [currentDate, selectedDate]);

  const handleDateClick = useCallback((date) => {
    if (!date) return;

    setSelectedDate(date);

    // Format date as YYYY-MM-DD for form compatibility
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    // Call onChange with the formatted date
    onChange(formattedDate);
    setIsOpen(false);
  }, [onChange]);

  const navigateMonth = useCallback((direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  }, []);

  const handleMonthChange = useCallback((monthIndex) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(monthIndex);
      return newDate;
    });
  }, []);

  const handleYearChange = useCallback((year) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setFullYear(year);
      return newDate;
    });
  }, []);

  const days = getDaysInMonth;
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  return (
    <div className="relative" ref={calendarRef}>
      {/* Input Field */}
      <div
        ref={inputRef}
        className="w-full min-w-[140px] h-[42px] px-3 border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white cursor-pointer flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedDate ? 'text-primary text-sm' : 'text-primary text-sm'}>
          {selectedDate ? formatDate(selectedDate) : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-primary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div
          className={`absolute z-50 ${
            dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
          } bg-white border border-gray-300 rounded-lg shadow-lg p-4 w-80`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            </button>

            <div className="flex items-center space-x-2">
              {/* Month Dropdown */}
              <select
                value={currentMonth}
                onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                className="text-lg font-semibold bg-transparent border-none focus:outline-none cursor-pointer"
              >
                {months.map((month, index) => (
                  <option key={month} value={index}>
                    {month}
                  </option>
                ))}
              </select>

              {/* Year Dropdown */}
              <select
                value={currentYear}
                onChange={(e) => handleYearChange(parseInt(e.target.value))}
                className="text-lg font-semibold bg-transparent border-none focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 21 }, (_, i) => currentYear - 10 + i).map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => navigateMonth(1)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {daysOfWeek.map(day => (
              <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => (
              <button
                key={index}
                type="button"
                onClick={() => day.isCurrentMonth && handleDateClick(day.date)}
                className={`
                  h-8 w-8 text-sm rounded flex items-center justify-center transition-colors
                  ${day.isCurrentMonth
                    ? 'text-gray-900 hover:bg-gray-100 cursor-pointer'
                    : 'text-gray-300 cursor-not-allowed'
                  }
                  ${day.isSelected
                    ? 'bg-primary text-white hover:bg-primaryHover'
                    : ''
                  }
                  ${day.isToday && !day.isSelected
                    ? 'bg-blue-100 text-blue-600'
                    : ''
                  }
                `}
                disabled={!day.isCurrentMonth}
              >
                {day.date.getDate()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(Calendar);
