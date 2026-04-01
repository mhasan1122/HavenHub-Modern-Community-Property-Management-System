// Components/FilterSelect/FilterSelect2.jsx

import React, { useState, useEffect, useRef } from "react";
import Button from "../FormComponent/ButtonComponent/Button";
import { FaCaretDown } from "react-icons/fa6";

const FilterSelect3 = ({
  placeholder = "Select Filter",
  options = [],
  value = [],         // externally controlled array of selected values (strings)
  onApply,              // callback: new array of selected values
  className = ""       // optional className for wrapper
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempSelected, setTempSelected] = useState([]);

  const dropdownRef = useRef(null);

  // whenever parent `value` changes, sync our tempSelected
  useEffect(() => {
    setTempSelected(Array.isArray(value) ? value.slice() : []);
  }, [value]);

  // close on outside click
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
    options.every(opt => tempSelected.includes(String(opt.value)));

  const toggleAll = () => {
    if (isAllSelected) {
      setTempSelected([]);
    } else {
      setTempSelected(options.map(opt => String(opt.value)));
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
    <div className={`relative block sm:inline-block ${className}`} ref={dropdownRef}>
      <Button
        size="medium"
        variant={value.length ? "transparent" : "filter"}
        icon={FaCaretDown}
        iconPosition="right"
        onClick={() => setIsOpen(open => !open)}
        className={`justify-between sm:justify-start text-sm h-[42px] !px-4 w-full sm:!w-auto ${isOpen ? "!border-primary !bg-white !shadow-ring-primary" : ""}`}
      >
        <span className="flex items-center text-sm">
          {placeholder}
          {value.length > 0 && <span className="ml-1">({value.length})</span>}
        </span>
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border shadow-lg rounded z-50 overflow-hidden flex flex-col max-h-60">
          <div className="overflow-y-auto p-2">
            <label className="flex items-center p-1 cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                className="mr-3 accent-primary w-6 h-6"
                checked={isAllSelected}
                onChange={toggleAll}
              />
              All
            </label>

            {options.map(opt => {
              const strVal = String(opt.value);
              return (
                <label
                  key={strVal}
                  className="flex items-center p-1 cursor-pointer hover:bg-gray-100"
                >
                  <input
                    type="checkbox"
                  className="mr-3 accent-primary w-6 h-6"
                    checked={tempSelected.includes(strVal)}
                    onChange={() => toggleOption(strVal)}
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>

          <div className="pt-2 pb-2 px-2 border-t bg-white flex justify-between sticky bottom-0">
            <button
              className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded"
              onClick={clear}
            >
              Clear
            </button>
            <button
              className="px-3 py-1 bg-primary text-white rounded"
              onClick={apply}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterSelect3;
