import React, { useState, useEffect, useRef } from 'react';
import { MdOutlineArrowDropDown } from "react-icons/md";

const FilterSelect = ({
  label = 'Select Member Type',
  data,
  optionKey = 'name',
  valueKey = 'value',
  onChange,
  selectedOptions = [],
  isMultiSelect = true,
  onDoneClick,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValues, setSelectedValues] = useState(selectedOptions);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = () => setIsOpen(!isOpen);

  const handleSelectionChange = (option) => {
    let updatedSelection = [...selectedValues];
    if (isMultiSelect) {
      if (updatedSelection.includes(option)) {
        updatedSelection = updatedSelection.filter((item) => item !== option);
      } else {
        updatedSelection.push(option);
      }
    } else {
      updatedSelection = [option];
    }
    setSelectedValues(updatedSelection);
    if (onChange) onChange(updatedSelection);
  };

  const handleSelectAllChange = (e) => {
    const checked = e.target.checked;
    const allValues = checked ? data.map(option => option[valueKey]) : [];
    setSelectedValues(allValues);
    if (onChange) onChange(allValues);
  };

  const handleDoneClick = () => {
    setIsOpen(false);
    if (onDoneClick) onDoneClick();
  };

  return (
    <div className="relative w-[250px]" ref={dropdownRef}>
      <div
        className="flex items-center bg-white rounded border border-borderLight shadow-sm py-2 px-3 cursor-pointer"
        onClick={toggleDropdown}
      >
        <p className="pr-4 text-base text-primary">{label}</p>
        <MdOutlineArrowDropDown className='text-primary text-[30px]' />
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-2 bg-white border rounded shadow-sm max-h-60 overflow-y-auto">
          {data.length === 0 ? (
            <div className="px-3 py-2">No options available</div>
          ) : (
            <div className="max-w-full overflow-x-auto">
              <div className="flex items-center px-3 py-2">
                <input
                  type="checkbox"
                  id="selectAll"
                  checked={selectedValues.length === data.length}
                  onChange={handleSelectAllChange}
                  className="mr-2 accent-[#3C9D9B] w-6 h-6"
                />
                <label htmlFor="selectAll" className="text-sm text-black cursor-pointer">
                  All
                </label>
              </div>
              {data.map((option, index) => (
                <label key={index} className="flex items-center px-3 py-2 cursor-pointer">
                  <input
                    type={isMultiSelect ? 'checkbox' : 'radio'}
                    checked={selectedValues.includes(option[valueKey])}
                    onChange={() => handleSelectionChange(option[valueKey])}
                    className="mr-2 accent-[#3C9D9B] w-6 h-6"
                  />
                  <span className="text-sm text-black">{option[optionKey]}</span>
                </label>
              ))}
            </div>
          )}
          <div className="px-3 py-2 border-t border-gray-300">
            {selectedValues.length > 0 && (
              <button
                className="py-2 px-4 text-sm text-white bg-primary rounded"
                onClick={handleDoneClick}
              >
                Done
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterSelect;
