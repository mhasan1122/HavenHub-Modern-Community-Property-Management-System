import React, { useState, useRef, useEffect } from 'react';
import { FaFlag } from 'react-icons/fa';
import { IoClose } from 'react-icons/io5';
import { FaCaretDown } from 'react-icons/fa6';

const PRIORITY_OPTIONS = [
  { value: 'urgent', color: 'text-urgent' },
  { value: 'high', color: 'text-warning' },
  { value: 'normal', color: 'text-primary' },
  { value: 'low', color: 'text-textMedium' },
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

  const isSelected = (optionValue) => value === optionValue;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        className={`login-field-input !flex justify-between items-center gap-2 whitespace-nowrap cursor-pointer ${
          error ? 'border-error' : isOpen ? '!border-primary !bg-white !shadow-ring-primary' : 'bg-white'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 flex-1 truncate">
          {value && (
            <FaFlag 
              className={`${getPriorityColor(value)} transition-colors duration-200 flex-shrink-0`} 
              size={16}
            />
          )}
          <span className="text-sm overflow-hidden">{value ? capitalizeFirstLetter(value) : 'Select an option'}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors duration-200"
            >
              <IoClose className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
          <FaCaretDown className={`flex-shrink-0 w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <ul className="absolute z-20 bg-white border border-gray-300 rounded mt-1 shadow-lg w-full max-h-60 overflow-y-auto">
          {PRIORITY_OPTIONS.map(({ value: optionValue, color }) => (
            <li
              key={optionValue}
              className={`px-3 py-2 cursor-pointer flex items-center ${
                isSelected(optionValue) 
                  ? 'bg-primary text-white' 
                  : 'hover:bg-primary hover:text-white'
              }`}
              onClick={() => handleSelect(optionValue)}
            >
              <FaFlag 
                className={`mr-2 ${isSelected(optionValue) ? 'text-white' : color} transition-colors duration-200`} 
                size={16}
              />
              <span className="text-sm">{capitalizeFirstLetter(optionValue)}</span>
            </li>
          ))}
          <li className="border-t border-gray-100">
            <button
              className="flex items-center w-full px-3 py-2 hover:bg-primary hover:text-white cursor-pointer"
              onClick={handleClear}
            >
              <IoClose className="mr-2" />
              <span className="text-sm">Clear</span>
            </button>
          </li>
        </ul>
      )}

      {error && <p className="mt-1 text-sm text-error">{error}</p>}
    </div>
  );
};

export default PriorityDropdown;