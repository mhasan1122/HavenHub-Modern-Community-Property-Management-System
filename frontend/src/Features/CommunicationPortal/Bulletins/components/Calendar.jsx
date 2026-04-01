import React, { useState } from 'react';
import { FaChevronLeft, FaChevronRight, FaTimes } from 'react-icons/fa';

/**
 * Calendar Component
 * Simple calendar for date selection in bulletins
 */
const Calendar = ({ onDateSelect, onClose, selectedDate }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get first day of the month
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const firstDayWeekday = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  // Generate calendar days
  const calendarDays = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayWeekday; i++) {
    calendarDays.push(null);
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  // Navigate to next month
  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Handle date selection
  const handleDateClick = (day) => {
    if (day) {
      const selectedDateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dateString = selectedDateObj.toISOString().split('T')[0]; // YYYY-MM-DD format
      onDateSelect(dateString);
    }
  };

  // Check if a date is selected
  const isDateSelected = (day) => {
    if (!day || !selectedDate) return false;
    const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateString = dateObj.toISOString().split('T')[0];
    return dateString === selectedDate;
  };

  // Check if a date is today
  const isToday = (day) => {
    if (!day) return false;
    const today = new Date();
    const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return dateObj.toDateString() === today.toDateString();
  };

  return (
    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 p-4 w-80">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <FaChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        
        <h3 className="text-lg font-semibold text-gray-900">
          {months[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h3>
        
        <div className="flex items-center gap-1">
          <button
            onClick={goToNextMonth}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <FaChevronRight className="w-4 h-4 text-gray-600" />
          </button>
          
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded ml-2"
          >
            <FaTimes className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {daysOfWeek.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-gray-500 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => (
          <button
            key={index}
            onClick={() => handleDateClick(day)}
            disabled={!day}
            className={`
              h-8 w-8 text-sm rounded flex items-center justify-center transition-colors
              ${!day 
                ? 'cursor-default' 
                : isDateSelected(day)
                  ? 'bg-blue-600 text-white'
                  : isToday(day)
                    ? 'bg-blue-100 text-blue-600 font-medium'
                    : 'hover:bg-gray-100 text-gray-700'
              }
            `}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>Click a date to select</span>
          {selectedDate && (
            <button
              onClick={() => onDateSelect(null)}
              className="text-blue-600 hover:text-blue-700"
            >
              Clear selection
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Calendar;
