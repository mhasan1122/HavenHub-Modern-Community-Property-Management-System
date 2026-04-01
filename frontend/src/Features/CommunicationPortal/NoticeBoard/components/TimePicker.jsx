import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Clock, ChevronDown } from 'lucide-react';

const TimePicker = ({ value, onChange, placeholder = "Select Time" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState('');
  const [selectedMinute, setSelectedMinute] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('AM');
  const [dropdownPosition, setDropdownPosition] = useState('bottom');
  const [currentTime, setCurrentTime] = useState({ hour: '', minute: '', period: 'AM' });
  const [hasUserSelected, setHasUserSelected] = useState(false);
  const timePickerRef = useRef(null);
  const inputRef = useRef(null);
  const intervalRef = useRef(null);

  // Get current time in 12-hour format
  const getCurrentTime12Hour = () => {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const period = hours >= 12 ? 'PM' : 'AM';

    // Convert to 12-hour format
    if (hours === 0) {
      hours = 12;
    } else if (hours > 12) {
      hours = hours - 12;
    }

    return {
      hour: hours.toString(),
      minute: minutes.toString().padStart(2, '0'),
      period: period
    };
  };

  // Calculate dropdown position
  const calculatePosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 250; // Reduced from 300 to 250

      setDropdownPosition(spaceBelow < dropdownHeight && spaceAbove > spaceBelow ? 'top' : 'bottom');
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      calculatePosition();
      window.addEventListener('scroll', calculatePosition);
      window.addEventListener('resize', calculatePosition);

      // Start real-time clock when dropdown opens
      const updateCurrentTime = () => {
        const time = getCurrentTime12Hour();
        setCurrentTime(time);

        // Only set current time as selected if no value exists AND user hasn't made a selection
        if (!value && !hasUserSelected) {
          setSelectedHour(time.hour);
          setSelectedMinute(time.minute);
          setSelectedPeriod(time.period);
        }
      };

      // Update immediately
      updateCurrentTime();

      // Update every second only if user hasn't selected a time
      if (!hasUserSelected) {
        intervalRef.current = setInterval(updateCurrentTime, 1000);
      }

      return () => {
        window.removeEventListener('scroll', calculatePosition);
        window.removeEventListener('resize', calculatePosition);
        // Clear interval when dropdown closes
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [isOpen, calculatePosition, value, hasUserSelected]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (timePickerRef.current && !timePickerRef.current.contains(event.target)) {
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
      const [hours, minutes] = value.split(':');
      const hour24 = parseInt(hours);
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const period = hour24 >= 12 ? 'PM' : 'AM';

      setSelectedHour(hour12.toString());
      setSelectedMinute(minutes);
      setSelectedPeriod(period);
      setHasUserSelected(true); // Mark that user has selected a time
    } else {
      // Reset when value is cleared
      setHasUserSelected(false);
    }
  }, [value]);

  const formatTime = (hour, minute, period) => {
    if (!hour || !minute) return '';
    return `${hour.padStart(2, '0')}:${minute} ${period}`;
  };

  const handleTimeSelect = (hour, minute, period) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    setSelectedPeriod(period);
    setHasUserSelected(true); // Mark that user has made a selection

    // Convert to 24-hour format for form submission
    let hour24 = parseInt(hour);
    if (period === 'PM' && hour24 !== 12) {
      hour24 += 12;
    } else if (period === 'AM' && hour24 === 12) {
      hour24 = 0;
    }

    const timeString = `${hour24.toString().padStart(2, '0')}:${minute}`;
    onChange(timeString);
    setIsOpen(false);

    // Clear the interval since user has made a selection
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  return (
    <div className="relative" ref={timePickerRef}>
      {/* Input Field */}
      <div
        ref={inputRef}
        className="w-full h-[38px] px-3 border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white cursor-pointer flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedHour && selectedMinute ? 'text-gray-900 text-sm' : 'text-gray-400 text-sm'}>
          {selectedHour && selectedMinute
            ? formatTime(selectedHour, selectedMinute, selectedPeriod)
            : placeholder
          }
        </span>
        <ChevronDown className={`h-4 w-4 text-primary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* Time Picker Dropdown */}
      {isOpen && (
        <div 
          className={`absolute z-50 ${
            dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
          } bg-white border border-gray-300 rounded-lg shadow-lg p-2.5 w-52`}
        >
          <div className="flex space-x-1">
            {/* Hours */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Hour</label>
              <div className="max-h-24 overflow-y-auto border border-gray-200 rounded">
                {hours.map(hour => (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => {
                      setSelectedHour(hour);
                      setHasUserSelected(true);
                      // Clear interval when user starts selecting
                      if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                      }
                    }}
                    className={`w-full px-2 py-0.5 text-xs text-left  ${
                      selectedHour === hour ? 'bg-primary text-white' : 'text-gray-700'
                    }`}
                  >
                    {hour}
                  </button>
                ))}
              </div>
            </div>

            {/* Minutes */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Minute</label>
              <div className="max-h-24 overflow-y-auto border border-gray-200 rounded">
                {minutes.filter((_, index) => index % 5 === 0).map(minute => (
                  <button
                    key={minute}
                    type="button"
                    onClick={() => {
                      setSelectedMinute(minute);
                      setHasUserSelected(true);
                      // Clear interval when user starts selecting
                      if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                      }
                    }}
                    className={`w-full px-2 py-0.5 text-xs text-left  ${
                      selectedMinute === minute ? 'bg-primary text-white' : 'text-gray-700'
                    }`}
                  >
                    {minute}
                  </button>
                ))}
              </div>
            </div>

            {/* AM/PM */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Period</label>
              <div className="space-y-1">
                {['AM', 'PM'].map(period => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => {
                      setSelectedPeriod(period);
                      setHasUserSelected(true);
                      // Clear interval when user starts selecting
                      if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                      }
                    }}
                    className={`w-full px-2 py-0.5 text-xs text-left  border border-gray-200 rounded ${
                      selectedPeriod === period ? 'bg-primary text-white' : 'text-gray-700'
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Apply Button */}
          <div className="mt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2 py-0.5 text-xs text-gray-600 "
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedHour && selectedMinute) {
                  handleTimeSelect(selectedHour, selectedMinute, selectedPeriod);
                }
              }}
              disabled={!selectedHour || !selectedMinute}
              className="px-2 py-0.5 text-xs bg-primary text-white rounded  disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(TimePicker);
