import React, { useState, useEffect, useRef } from "react";
import { FaCaretDown, FaCheck } from "react-icons/fa6";

const FilterSelectModal = ({
  placeholder = "Select Filter",
  options = [],
  value = [],
  onApply,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempSelected, setTempSelected] = useState([]);

  const dropdownRef = useRef(null);

  useEffect(() => {
    setTempSelected(Array.isArray(value) ? value.slice() : []);
  }, [value]);

  useEffect(() => {
    const handler = e => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setTempSelected(Array.isArray(value) ? value.slice() : []);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [value]);

  const toggleOption = val => {
    const str = String(val);
    setTempSelected(prev =>
      prev.includes(str)
        ? prev.filter(x => x !== str)
        : [...prev, str]
    );
  };

  const isAllSelected =
    options.length > 0 &&
    tempSelected.length === options.length &&
    options.every(opt => {
      const isObj = typeof opt === 'object' && opt !== null;
      const v = isObj ? opt.value : opt;
      return tempSelected.includes(String(v ?? ""));
    });

  const toggleAll = () => {
    if (isAllSelected) {
      setTempSelected([]);
    } else {
      setTempSelected(options.map(opt => {
        const isObj = typeof opt === 'object' && opt !== null;
        const v = isObj ? opt.value : opt;
        return String(v ?? "");
      }));
    }
  };

  const apply = () => {
    onApply(Array.from(tempSelected));
    setIsOpen(false);
  };

  const clear = () => {
    setTempSelected([]);
    onApply([]);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Trigger Button - Always shows full placeholder */}
      <button
        onClick={() => setIsOpen(open => !open)}
        className="w-full px-4 py-2.5 bg-white border border-[#3D9D9B] rounded-lg flex items-center justify-between text-left hover:bg-gray-50 focus:outline-none transition-all duration-200 min-w-[180px]"
      >
        <div className="flex items-center">
          <span className="text-[#3D9D9B] font-medium text-sm whitespace-nowrap">
            {placeholder}
          </span>
          {value.length > 0 && (
            <span className="ml-2 bg-[#3D9D9B] text-white text-xs font-semibold px-2 py-0.5 rounded-full">
              {value.length}
            </span>
          )}
        </div>
        <FaCaretDown className={`text-[#3D9D9B] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Rest of the dropdown component remains the same */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-hidden min-w-[240px] w-full">
          <div className="max-h-64 overflow-y-auto p-2 bg-white">
            <label className="flex items-center p-3 cursor-pointer hover:bg-gray-50 rounded-md transition-colors duration-150">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isAllSelected}
                  onChange={toggleAll}
                />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isAllSelected
                  ? 'bg-[#3D9D9B] border-[#3D9D9B]'
                  : 'border-gray-400 bg-white hover:border-gray-500'
                  }`}>
                  {isAllSelected && <FaCheck className="text-white text-xs" />}
                </div>
              </div>
              <span className="ml-3 text-gray-900 font-medium text-sm">Select All</span>
            </label>

            <div className="border-b border-gray-100 my-1"></div>

            {options.map((opt, index) => {
              const isObj = typeof opt === 'object' && opt !== null;
              const optValue = isObj ? opt.value : opt;
              const optLabel = isObj ? (opt.label ?? optValue) : opt;
              const strVal = String(optValue ?? "");
              const isSelected = tempSelected.includes(strVal);

              return (
                <label
                  key={`${strVal}-${index}`}
                  className="flex items-center p-3 cursor-pointer hover:bg-gray-50 rounded-md transition-colors duration-150"
                >
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isSelected}
                      onChange={() => toggleOption(strVal)}
                    />
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected
                      ? 'bg-[#3D9D9B] border-[#3D9D9B]'
                      : 'border-gray-400 bg-white hover:border-gray-500'
                      }`}>
                      {isSelected && <FaCheck className="text-white text-xs" />}
                    </div>
                  </div>
                  <span className="ml-3 text-gray-700 text-sm">{optLabel}</span>
                </label>
              );
            })}
          </div>

          <div className="border-t border-gray-200 p-3 bg-white flex justify-between">
            <button
              onClick={clear}
              className="bg-gray-100 py-2 px-4 rounded-md font-medium transition-colors text-sm"
            >
              Clear
            </button>
            <button
              onClick={apply}
              className="bg-[#3D9D9B] text-white py-2 px-6 rounded-md font-medium hover:bg-[#2d7a78] transition-colors text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterSelectModal;