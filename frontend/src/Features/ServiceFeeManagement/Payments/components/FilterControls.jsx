import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import { BiFilter } from 'react-icons/bi';
import { FaCaretDown } from 'react-icons/fa6';
import { FaDownload, FaSearch } from "react-icons/fa";
import MonthYearPicker from '../../components/MonthYearPicker';

const FilterControls = ({
  searchQuery,
  servicePeriod,
  generateMonth,
  selectedTowers,
  selectedStatuses,
  selectedMethods,
  selectedServiceFees,
  onChange,
  onClearAll,
  onFilter
}) => {
  const { filterOptions } = useSelector((state) => state.serviceFeeManagement);

  // Limit status options to only generation statuses for this view
  const generationStatusOptions = [
    { value: 'Generated', label: 'Generated' },
    { value: 'Not Generated', label: 'Not Generated' }
  ];



  // State for dropdown visibility
  const [showTowerDropdown, setShowTowerDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showMethodDropdown, setShowMethodDropdown] = useState(false);
  const [showServiceFeeDropdown, setShowServiceFeeDropdown] = useState(false);


  // Local state for temporary selections (before Done is clicked)
  const [tempSelectedTowers, setTempSelectedTowers] = useState([]);
  const [tempSelectedStatuses, setTempSelectedStatuses] = useState([]);
  const [tempSelectedMethods, setTempSelectedMethods] = useState([]);
  const [tempSelectedServiceFees, setTempSelectedServiceFees] = useState([]);

  // Handle checkbox changes (temporary state)
  const handleCheckboxChange = (filterType, value, isChecked) => {
    let currentSelected, setter;

    switch (filterType) {
      case 'tower':
        currentSelected = [...tempSelectedTowers];
        setter = setTempSelectedTowers;
        break;
      case 'status':
        currentSelected = [...tempSelectedStatuses];
        setter = setTempSelectedStatuses;
        break;
      case 'method':
        currentSelected = [...tempSelectedMethods];
        setter = setTempSelectedMethods;
        break;
      case 'serviceFee':
        currentSelected = [...tempSelectedServiceFees];
        setter = setTempSelectedServiceFees;
        break;
      default:
        return;
    }

    if (isChecked) {
      currentSelected.push(value);
    } else {
      currentSelected = currentSelected.filter(item => item !== value);
    }

    setter(currentSelected);
  };

  // Handle "Select All" functionality (temporary state)
  const handleSelectAll = (filterType, allOptions) => {
    const allValues = allOptions.map(option => option.value);
    let currentSelected, setter;

    switch (filterType) {
      case 'tower':
        currentSelected = tempSelectedTowers;
        setter = setTempSelectedTowers;
        break;
      case 'status':
        currentSelected = tempSelectedStatuses;
        setter = setTempSelectedStatuses;
        break;
      case 'method':
        currentSelected = tempSelectedMethods;
        setter = setTempSelectedMethods;
        break;
      case 'serviceFee':
        currentSelected = tempSelectedServiceFees;
        setter = setTempSelectedServiceFees;
        break;
      default:
        return;
    }

    // If all are selected, deselect all. Otherwise, select all
    const newSelected = currentSelected.length === allValues.length ? [] : allValues;
    setter(newSelected);
  };

  // Check if all options are selected (temporary state)
  const isAllSelected = (filterType, allOptions) => {
    const allValues = allOptions?.map(option => option.value) || [];
    let currentSelected;

    switch (filterType) {
      case 'tower':
        currentSelected = tempSelectedTowers;
        break;
      case 'status':
        currentSelected = tempSelectedStatuses;
        break;
      case 'method':
        currentSelected = tempSelectedMethods;
        break;
      case 'serviceFee':
        currentSelected = tempSelectedServiceFees;
        break;
      default:
        return false;
    }

    return allValues.length > 0 && currentSelected.length === allValues.length;
  };

  // Get display text for filter buttons - Always show placeholder with count
  const getDisplayText = (selectedItems, defaultText) => {
    // Safety check for undefined or null
    if (!selectedItems || !Array.isArray(selectedItems)) {
      return defaultText;
    }
    const count = selectedItems.length;
    if (count > 0) {
      return `${defaultText} (${count})`;
    }
    return defaultText; // Always show placeholder, never show selected values
  };

  // Handle Done button click - Apply temporary selections and call API
  const handleDone = (filterType) => {
    let setterKey = '';
    let tempSelected = [];

    switch (filterType) {
      case 'tower':
        setterKey = 'selectedTowers';
        tempSelected = tempSelectedTowers;
        setShowTowerDropdown(false);
        break;
      case 'status':
        setterKey = 'selectedStatuses';
        tempSelected = tempSelectedStatuses;
        setShowStatusDropdown(false);
        break;
      case 'method':
        setterKey = 'selectedMethods';
        tempSelected = tempSelectedMethods;
        setShowMethodDropdown(false);
        break;
      case 'serviceFee':
        setterKey = 'selectedServiceFees';
        tempSelected = tempSelectedServiceFees;
        setShowServiceFeeDropdown(false);
        break;
      default:
        return;
    }

    onChange(setterKey, tempSelected);
  };

  // Handle Clear button click - Clear all selections and call API
  const handleClear = (filterType) => {
    let setterKey = '';

    switch (filterType) {
      case 'tower':
        setterKey = 'selectedTowers';
        setTempSelectedTowers([]);
        setShowTowerDropdown(false);
        break;
      case 'status':
        setterKey = 'selectedStatuses';
        setTempSelectedStatuses([]);
        setShowStatusDropdown(false);
        break;
      case 'method':
        setterKey = 'selectedMethods';
        setTempSelectedMethods([]);
        setShowMethodDropdown(false);
        break;
      case 'serviceFee':
        setterKey = 'selectedServiceFees';
        setTempSelectedServiceFees([]);
        setShowServiceFeeDropdown(false);
        break;
      default:
        return;
    }

    // Clear all selections and call API
    onChange(setterKey, []);
  };

  // Initialize temp selections when dropdown opens
  const handleDropdownOpen = (filterType) => {
    switch (filterType) {
      case 'tower':
        setTempSelectedTowers([...selectedTowers]);
        setShowTowerDropdown(true);
        break;
      case 'status':
        setTempSelectedStatuses([...selectedStatuses]);
        setShowStatusDropdown(true);
        break;
      case 'method':
        setTempSelectedMethods([...selectedMethods]);
        setShowMethodDropdown(true);
        break;
      case 'serviceFee':
        setTempSelectedServiceFees([...selectedServiceFees]);
        setShowServiceFeeDropdown(true);
        break;
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.filter-dropdown')) {
        setShowTowerDropdown(false);
        setShowStatusDropdown(false);
        setShowMethodDropdown(false);
        setShowServiceFeeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end gap-4 w-full mt-6">
        {/* Tower Filter - Multi-select Dropdown */}
        <div className="relative filter-dropdown flex-1 min-w-[180px]">
          <label className="block text-sm font-medium text-gray-700 mb-2 pl-1">
            Select Tower
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => handleDropdownOpen('tower')}
              className={`w-full h-[42px] px-3 border rounded-md focus:outline-none text-sm bg-white text-left flex items-center justify-between transition-all ${showTowerDropdown
                ? 'border-primary shadow-ring-primary'
                : 'border-gray-300 hover:border-gray-400'
                }`}
            >
              <span className="truncate text-primary font-medium">
                {getDisplayText(selectedTowers, 'Select Towers')}
              </span>
              <FaCaretDown className={`w-3 h-3 text-primary transition-transform duration-200 ${showTowerDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showTowerDropdown && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-300 rounded-md shadow-lg overflow-hidden">
                <div className="max-h-60 overflow-y-auto p-2">
                  {/* Select All Option */}
                  <label className="flex items-center px-2 py-1.5 hover:bg-teal-50 cursor-pointer rounded border-b border-gray-100 mb-1">
                    <input
                      type="checkbox"
                      checked={isAllSelected('tower', filterOptions?.towers)}
                      onChange={() => handleSelectAll('tower', filterOptions?.towers)}
                      className="mr-3 text-primary focus:ring-primary accent-primary rounded"
                    />
                    <span className="text-sm font-semibold text-gray-700">Select All</span>
                  </label>
                  {filterOptions?.towers?.map((tower) => (
                    <label key={tower.value} className="flex items-center px-2 py-1.5 hover:bg-teal-50 cursor-pointer rounded">
                      <input
                        type="checkbox"
                        checked={tempSelectedTowers.includes(tower.value)}
                        onChange={(e) => handleCheckboxChange('tower', tower.value, e.target.checked)}
                        className="mr-3 text-primary focus:ring-primary accent-primary rounded"
                      />
                      <span className="text-sm text-gray-700">{tower.label}</span>
                    </label>
                  ))}
                </div>
                <div className="flex justify-between gap-2 p-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                  <button
                    onClick={() => handleClear('tower')}
                    className="px-3 py-1 text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 rounded transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => handleDone('tower')}
                    className="px-4 py-1 text-xs font-bold bg-primary text-white rounded hover:bg-primaryHover transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Generate Month Picker */}
        <div className="flex-1 min-w-[180px]">
          <MonthYearPicker
            label="Select Month"
            className={'text-primary'}
            value={generateMonth}
            onChange={(value) => onChange('generateMonth', value)}
            hideLabel={false}
            levelClass={'mb-2 pl-1'}
            showFutureMonths={false}
          />
        </div>

        {/* Search Input */}
        <div className="flex-1 min-w-[240px]">
          <label className="block text-sm font-medium text-gray-700 mb-2 pl-1">
            Search
          </label>
          <div className="flex items-center bg-white border border-gray-300 shadow-sm py-2 px-3 h-[42px] rounded-md focus-within:border-primary focus-within:shadow-ring-primary">
            <FaSearch className="text-primary mr-2" />
            <input
              type="text"
              placeholder="Search Residents, Units..."
              value={searchQuery}
              onChange={e => onChange('searchQuery', e.target.value)}
              className="outline-none placeholder-[#3D9D9B] placeholder:text-sm text-primary w-full text-sm"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="relative flex-1 min-w-[180px]">
          <label className="block text-sm font-medium text-gray-700 mb-2 pl-1">
            Select Status
          </label>
          <button
            type="button"
            onClick={() => {
              setShowStatusDropdown(!showStatusDropdown);
              setTempSelectedStatuses([...selectedStatuses]);
            }}
            className={`w-full h-[42px] px-3 border rounded-md focus:outline-none text-sm bg-white text-left flex items-center justify-between transition-all ${showStatusDropdown
              ? 'border-primary shadow-ring-primary'
              : 'border-gray-300 hover:border-gray-400'
              }`}
          >
            <span className="truncate text-primary font-medium">
              {getDisplayText(selectedStatuses, 'Select Status')}
            </span>
            <FaCaretDown className={`w-3 h-3 text-primary transition-transform duration-200 ${showStatusDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showStatusDropdown && (
            <div
              className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg overflow-hidden"
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
            >
              <div className="max-h-60 overflow-y-auto p-2">
                <label className="flex items-center px-2 py-1.5 hover:bg-teal-50 cursor-pointer rounded border-b border-gray-100 mb-1">
                  <input
                    type="checkbox"
                    checked={
                      filterOptions?.status_options?.length > 0 &&
                      tempSelectedStatuses.length === filterOptions.status_options.length
                    }
                    onChange={() => {
                      if (
                        tempSelectedStatuses.length === filterOptions?.status_options?.length
                      ) {
                        setTempSelectedStatuses([]);
                      } else {
                        setTempSelectedStatuses(
                          filterOptions?.status_options?.map((s) => s.value) || []
                        );
                      }
                    }}
                    className="mr-3 text-primary focus:ring-primary accent-primary rounded"
                  />
                  <span className="text-sm font-semibold text-gray-700">Select All</span>
                </label>
                {filterOptions?.status_options?.map((status) => (
                  <label key={status.value} className="flex items-center px-2 py-1.5 hover:bg-teal-50 cursor-pointer rounded">
                    <input
                      type="checkbox"
                      checked={tempSelectedStatuses.includes(status.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setTempSelectedStatuses((prev) =>
                            [...prev, status.value].filter((v, i, arr) => arr.indexOf(v) === i)
                          );
                        } else {
                          setTempSelectedStatuses((prev) =>
                            prev.filter((v) => v !== status.value)
                          );
                        }
                      }}
                      className="mr-3 text-primary focus:ring-primary accent-primary rounded"
                    />
                    <span className="text-sm text-gray-700">{status.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-between gap-2 p-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setTempSelectedStatuses([]);
                    onChange('selectedStatuses', []);
                    setShowStatusDropdown(false);
                  }}
                  className="px-3 py-1 text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 rounded transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange('selectedStatuses', tempSelectedStatuses);
                    setShowStatusDropdown(false);
                  }}
                  className="px-4 py-1 text-xs font-bold bg-primary text-white rounded hover:bg-primaryHover transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

FilterControls.propTypes = {
  searchQuery: PropTypes.string.isRequired,
  servicePeriod: PropTypes.object,
  generateMonth: PropTypes.object,
  selectedTowers: PropTypes.array.isRequired,
  selectedStatuses: PropTypes.array.isRequired,
  selectedMethods: PropTypes.array.isRequired,
  selectedServiceFees: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  onClearAll: PropTypes.func.isRequired,
  onFilter: PropTypes.func.isRequired,
  onGenerate: PropTypes.func.isRequired,
  buttonConfig: PropTypes.shape({
    text: PropTypes.string,
    className: PropTypes.string
  })
};

export default FilterControls;
