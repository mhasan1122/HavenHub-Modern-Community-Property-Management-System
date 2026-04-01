import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Button from "../FormComponent/ButtonComponent/Button";
import { FaCaretDown } from "react-icons/fa6";
import CheckboxComponent from "../FormComponent/CheckboxComponent";

const FilterSelect1 = ({
  placeholder = "Select Filter",
  options,
  paramKey = "filter",
  useUrlParams = true, // if false use local state only
  onApply
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [tempSelected, setTempSelected] = useState([...selectedFilters]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Load filters from URL or default state
  useEffect(() => {
    if (useUrlParams) {
      const urlFilters = searchParams.get(paramKey)?.split(",") || [];
      const validFilters =
        urlFilters.length > 0 && urlFilters[0] !== "" ? urlFilters : [];
      setSelectedFilters(validFilters);
      setTempSelected(validFilters);
    }
  }, [searchParams, paramKey, useUrlParams]);

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setTempSelected([...selectedFilters]);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedFilters]);

  // Toggle selection of a filter
  const toggleFilter = (value) => {
    if (value === "all") {
      // If "All" is clicked, select or deselect all filters
      setTempSelected(
        tempSelected.length === options.length
          ? [] // Deselect all if all are selected
          : options.map((opt) => opt.value) // Select all
      );
    } else {
      // Toggle individual filter selection
      setTempSelected((prev) =>
        prev.includes(value)
          ? prev.filter((f) => f !== value) // Deselect if already selected
          : [...prev, value] // Select if not already selected
      );
    }
  };

  // Apply filters
  const applyFilters = () => {
    if (useUrlParams) {
      const params = new URLSearchParams(searchParams);
      if (tempSelected.length) {
        params.set(paramKey, tempSelected.join(","));
      } else {
        params.delete(paramKey);
      }
      setSearchParams(params);
    }

    setSelectedFilters([...tempSelected]);
    onApply && onApply(tempSelected);
    setIsOpen(false);
  };

  // Reset filters
  const resetFilters = () => {
    if (useUrlParams) {
      const params = new URLSearchParams(searchParams);
      if (params.size > 0) {
        params.delete(paramKey);
        setSearchParams(params);
      }
    }
    setSelectedFilters([]);
    setTempSelected([]);
    onApply && onApply([]);
    setIsOpen(false);
  };

  // Check if all filters are selected
  const isAllSelected = tempSelected.length === options.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        size="medium"
        variant={selectedFilters.length ? "transparent" : "filter"}
        onClick={() => setIsOpen(!isOpen)}
        icon={FaCaretDown}
        iconPosition="right"
        className={isOpen ? "!border-primary !bg-white !shadow-ring-primary" : ""}
      >
        {placeholder}
        {selectedFilters.length > 0 && (
          <span className="ml-1">({selectedFilters.length})</span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-white shadow-lg border rounded z-50 flex flex-col max-h-60">
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            <label className="flex items-center p-1 cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={isAllSelected} // This will check the "All" checkbox if all are selected
                onChange={() => toggleFilter("all")}
                className="mr-3 accent-primary w-6 h-6"
              />
              All
            </label>
            {options.map((option) => (
              <label
                key={option.value}
                className="flex items-center p-1 cursor-pointer hover:bg-gray-100 rounded-md"
              >
                <input
                  type="checkbox"
                  checked={tempSelected.includes(option.value)}
                  onChange={() => toggleFilter(option.value)}
                  className="mr-3 accent-primary w-6 h-6 "
                />
                {option.label}
              </label>
            ))}
          </div>
          <div className="pt-2 pb-2 px-2 border-t border-gray-300 bg-white sticky bottom-0">
            <div className="flex justify-between gap-2">
              <Button 
                size="small" 
                onClick={applyFilters}
                className="flex-1 text-center justify-center"
              >
                Done
              </Button>
              <Button 
                size="small" 
                variant="transparent"
                onClick={resetFilters}
                className="flex-1 text-center justify-center"
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterSelect1;
