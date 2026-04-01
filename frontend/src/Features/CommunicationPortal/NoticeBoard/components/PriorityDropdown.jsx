import React, { useState, useRef, useEffect } from 'react';
import { FaFlag } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import { MdKeyboardArrowDown } from 'react-icons/md';
import ErrorMessage from '../../../../Components/MessageBox/ErrorMessage';

const PRIORITY_OPTIONS = [
  { value: 'urgent', color: 'text-urgent' }, // Using urgent deep red color from config (#B91C1C)
  { value: 'high', color: 'text-warning' }, // Using warning color from config (#D97706)
  { value: 'normal', color: 'text-primary' }, // Using primary color from config (#3C9D9B)
  { value: 'low', color: 'text-textMedium' }, // Using textMedium from config (#666666)
];

const getPriorityColor = (value) => {
  const found = PRIORITY_OPTIONS.find((item) => item.value === value);
  return found ? found.color : 'text-gray-400';
};

const capitalizeFirstLetter = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const PriorityDropdown = ({ value, onChange, error }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (priorityValue) => {
    onChange(priorityValue);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        className={`w-full px-3 py-2 border rounded-md bg-white cursor-pointer flex items-center justify-between transition-colors duration-200 ${
          error ? 'border-error' : 'border-gray-300'
        } hover:border-primary focus-within:ring-2 focus-within:ring-primary`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-2">
          {value && (
            <FaFlag 
              className={`${getPriorityColor(value)} transition-colors duration-200`} 
              size={16}
            />
          )}
          <span className="text-gray-700">{value ? capitalizeFirstLetter(value) : ''}</span>
        </div>
        <div className="flex items-center space-x-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors duration-200"
            >
              <IoClose className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
          <MdKeyboardArrowDown
            className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          <div className="py-1">
            {PRIORITY_OPTIONS.map(({ value: optionValue, color }) => (
              <button
                key={optionValue}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                onClick={() => handleSelect(optionValue)}
              >
                <FaFlag 
                  className={`mr-2 ${color} transition-colors duration-200`} 
                  size={16}
                />
                {capitalizeFirstLetter(optionValue)}
              </button>
            ))}
            <div className="border-t border-gray-100">
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                onClick={handleClear}
              >
                <IoClose className="mr-2 text-gray-500" />
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <ErrorMessage message={error} />}
    </div>
  );
};

export default PriorityDropdown;