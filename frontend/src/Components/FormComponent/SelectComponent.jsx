import React, { useState, useRef, useEffect } from "react";
import { FaCaretDown } from "react-icons/fa6"; 

function SelectComponent({ options = [], value, onChange, name, label, width="100%",disabled=false,className=''}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Normalize value comparison (handle both string and number)
  const selected = options.find((opt) => {
    const optValue = opt.value;
    const currentValue = value;
    // Compare as strings or numbers
    return String(optValue) === String(currentValue) || optValue === currentValue;
  });

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative  ${className || 'login-field' }`} style={{ width }} ref={dropdownRef}>
      {label && (
        <div className="text-left my-3 mb-3">
          <label className="text-left my-3 mb-3" htmlFor={name}>{label}</label>
        </div>
      )}

      <div
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={`login-field-input !flex justify-between items-center gap-2 whitespace-nowrap ${disabled ? 'bg-disabledInput cursor-not-allowed text-black100' : open ? '!border-primary !bg-white !shadow-ring-primary cursor-pointer' : 'bg-white cursor-pointer'}`}
        style={{ boxSizing: 'border-box', width: '100%' }}
      >
        <span className="flex-1 truncate text-sm overflow-hidden">{selected?.label || "Select an option"}</span>
        <FaCaretDown className={`flex-shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} style={{ width: '16px', height: '16px' }} />
      </div>

      {open && (
        <ul className="absolute z-20 bg-white border border-gray-300 rounded mt-1 shadow-lg w-full max-h-60 overflow-y-auto">
          {options.map((option, index) => {
            const isSelected = String(option.value) === String(value) || option.value === value;
            const isDisabled = option.disabled;
            
            return (
              <li
                key={index}
                className={`px-3 py-2 ${
                  isDisabled 
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                    : `hover:bg-primaryDark hover:text-white cursor-pointer ${
                        isSelected ? "bg-primary text-white" : ""
                      }`
                }`}
                onClick={() => {
                  if (!isDisabled) {
                    const syntheticEvent = { target: { name, value: option.value } };
                    onChange(syntheticEvent);
                    setOpen(false);
                  }
                }}
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default SelectComponent;
