import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import Button from "../FormComponent/ButtonComponent/Button";
import { FaCaretDown } from "react-icons/fa6";

const FilterSelect2 = ({
  placeholder = "Select Filter",
  options = [],
  paramKey = "filter",
  useUrlParams = true,
  onApply,
  value,
  className = "left-0",
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [tempSelected, setTempSelected] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Load from URL on mount if useUrlParams is true
  useEffect(() => {
    if (useUrlParams) {
      const urlVal = searchParams.get(paramKey);
      if (urlVal) {
        const parsed = urlVal.split(",").filter(Boolean);
        setSelectedFilters(parsed);
        setTempSelected(parsed);
      } else {
        setSelectedFilters([]);
        setTempSelected([]);
      }
    }
  }, [searchParams, paramKey, useUrlParams]);

  // Sync internal state with value prop if passed
  useEffect(() => {
    if (!useUrlParams && Array.isArray(value)) {
      setSelectedFilters(value);
      setTempSelected(value);
    }
  }, [value, useUrlParams]);

  // Close dropdown on outside click
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

  const toggleFilter = (value) => {
    if (value === "all") {
      const allValues = options.map((opt) => String(opt.value));
      setTempSelected((prev) =>
        prev.length === options.length ? [] : allValues
      );
    } else {
      const strVal = String(value);
      setTempSelected((prev) =>
        prev.includes(strVal)
          ? prev.filter((v) => v !== strVal)
          : [...prev, strVal]
      );
    }
  };

  const applyFilters = () => {
    if (useUrlParams) {
      const params = new URLSearchParams(searchParams);
      if (tempSelected.length > 0) {
        params.set(paramKey, tempSelected.join(","));
      } else {
        params.delete(paramKey);
      }
      setSearchParams(params);
    }

    setSelectedFilters([...tempSelected]);
    onApply?.(tempSelected);
    setIsOpen(false);
  };

  const resetFilters = () => {
    if (useUrlParams) {
      const params = new URLSearchParams(searchParams);
      params.delete(paramKey);
      setSearchParams(params);
    }

    setSelectedFilters([]);
    setTempSelected([]);
    onApply?.([]);
    setIsOpen(false);
  };

  const isAllSelected =
    options.length > 0 &&
    tempSelected.length === options.length &&
    options.every((opt) => tempSelected.includes(String(opt.value)));

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        size="medium"
        variant={selectedFilters.length ? "transparent" : "filter"}
        onClick={() => setIsOpen(!isOpen)}
        icon={FaCaretDown}
        iconPosition="right"
        className={`whitespace-nowrap !text-sm lg:!text-base ${isOpen ? "!border-primary !bg-white !shadow-ring-primary" : ""}`}
        iconSize="medium"
      >
        {placeholder}
        {selectedFilters.length > 0 && (
          <span className="ml-1">({selectedFilters.length})</span>
        )}
      </Button>

      {isOpen && (
        <div className={`absolute top-full ${className} mt-2 w-48 max-h-60 bg-white shadow-lg border rounded z-20 flex flex-col`}>
          <div className="overflow-y-auto p-2 flex-1">
            <label className="flex items-center p-1 cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={() => toggleFilter("all")}
                className="mr-3 accent-primary w-5 h-5"
              />
              All
            </label>

            {options.map((option) => {
              const valStr = String(option.value);
              return (
                <label
                  key={valStr}
                  className="flex items-center p-1 cursor-pointer hover:bg-gray-100"
                >
                  <input
                    type="checkbox"
                    checked={tempSelected.includes(valStr)}
                    onChange={() => toggleFilter(valStr)}
                    className="mr-3 accent-primary w-5 h-5"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>

          <div className="pt-2 pb-2 px-2 border-t border-gray-300 bg-white sticky bottom-0">
            <div className="flex justify-between">
              <Button size="small" onClick={applyFilters}>
                Done
              </Button>
              <button
                className="text-sm py-1 px-2 rounded bg-slate-100 hover:bg-slate-200"
                onClick={resetFilters}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterSelect2;
