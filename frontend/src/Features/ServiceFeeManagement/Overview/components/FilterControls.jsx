import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import { FaCaretDown } from 'react-icons/fa6';
import MonthYearPicker from '../../components/MonthYearPicker';

const FilterControls = ({
  searchQuery,
  servicePeriodFrom,
  servicePeriodTo,
  selectedTowers,
  selectedStatuses,
  selectedMethods,
  onChange,
  onClearAll
}) => {
  const { filterOptions } = useSelector((state) => state.serviceFeeManagement);

  // State for dropdown visibility
  const [showTowerDropdown, setShowTowerDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showMethodDropdown, setShowMethodDropdown] = useState(false);

  // Local state for temporary selections (before Done is clicked)
  const [tempSelectedTowers, setTempSelectedTowers] = useState([]);
  const [tempSelectedStatuses, setTempSelectedStatuses] = useState([]);
  const [tempSelectedMethods, setTempSelectedMethods] = useState([]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.relative')) {
        setShowTowerDropdown(false);
        setShowStatusDropdown(false);
        setShowMethodDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle checkbox changes (temporary state)
  const handleCheckboxChange = (filterType, value, isChecked) => {
    let currentSelected = [];
    let setter = null;

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
    console.log('handleSelectAll called:', { filterType, allOptions, filterOptionsLength: allOptions?.length });

    let currentSelected = [];
    let setter = null;

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
      default:
        return;
    }

    // If all are selected, deselect all. Otherwise, select all
    const allValues = allOptions?.map(option => option.value) || [];
    const newSelected = currentSelected.length === allValues.length ? [] : allValues;
    console.log('Select all logic:', { currentSelected, allValues, newSelected });
    setter(newSelected);
  };

  // Check if all options are selected (temporary state)
  const isAllSelected = (filterType, allOptions) => {
    let currentSelected = [];

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
      default:
        return false;
    }

    const allValues = allOptions?.map(option => option.value) || [];
    return allValues.length > 0 && currentSelected.length === allValues.length;
  };

  // Get display text for filter buttons - Always show placeholder with count
  const getDisplayText = (selectedItems, defaultText) => {
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
      default:
        return;
    }

    onChange(setterKey, []);
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end gap-4 w-full mt-6">
        {/* Tower Filter */}
        <div className="relative flex-1 min-w-[180px] z-[40]">
          <label className="block text-sm font-medium text-gray-700 mb-2 pl-1">
            Select Tower
          </label>
          <button
            type="button"
            onClick={() => {
              setShowTowerDropdown(!showTowerDropdown);
              setTempSelectedTowers([...selectedTowers]);
            }}
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
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg overflow-hidden">
              <div className="max-h-60 overflow-y-auto p-2">
                <div className="sticky top-0 bg-white border-b border-gray-100 px-2 py-1.5 mb-1">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAllSelected('tower', filterOptions?.towers)}
                      onChange={() => handleSelectAll('tower', filterOptions?.towers)}
                      className="mr-3 text-primary focus:ring-primary accent-primary rounded"
                    />
                    <span className="text-sm font-semibold text-gray-700">Select All</span>
                  </label>
                </div>

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
                  type="button"
                  onClick={() => handleClear('tower')}
                  className="px-3 py-1 text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 rounded transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleDone('tower')}
                  className="px-4 py-1 text-xs font-bold bg-primary text-white rounded hover:bg-primaryHover transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Service Period From Filter */}
        <div className="flex-1 min-w-[180px] relative z-[35]">
          <MonthYearPicker
            label="From"
            className={'text-primary'}
            value={servicePeriodFrom}
            onChange={(value) => onChange('servicePeriodFrom', value)}
            hideLabel={false}
            levelClass="pl-1"
          />
        </div>

        {/* Service Period To Filter */}
        <div className="flex-1 min-w-[180px] relative z-[30]">
          <MonthYearPicker
            label="To"
            className={'text-primary'}
            value={servicePeriodTo}
            onChange={(value) => onChange('servicePeriodTo', value)}
            hideLabel={false}
            levelClass="pl-1"
          />
        </div>

        {/* Status Filter */}
        <div className="relative flex-1 min-w-[180px] z-[25]">
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
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg overflow-hidden">
              <div className="max-h-60 overflow-y-auto p-2">
                <div className="sticky top-0 bg-white border-b border-gray-100 px-2 py-1.5 mb-1">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAllSelected('status', filterOptions?.status_options)}
                      onChange={() => handleSelectAll('status', filterOptions?.status_options)}
                      className="mr-3 text-primary focus:ring-primary accent-primary rounded"
                    />
                    <span className="text-sm font-semibold text-gray-700">Select All</span>
                  </label>
                </div>

                {filterOptions?.status_options?.map((status) => (
                  <label key={status.value} className="flex items-center px-2 py-1.5 hover:bg-teal-50 cursor-pointer rounded">
                    <input
                      type="checkbox"
                      checked={tempSelectedStatuses.includes(status.value)}
                      onChange={(e) => handleCheckboxChange('status', status.value, e.target.checked)}
                      className="mr-3 text-primary focus:ring-primary accent-primary rounded"
                    />
                    <span className="text-sm text-gray-700">{status.label}</span>
                  </label>
                ))}
              </div>

              <div className="flex justify-between gap-2 p-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleClear('status')}
                  className="px-3 py-1 text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 rounded transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleDone('status')}
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
  servicePeriodFrom: PropTypes.object,
  servicePeriodTo: PropTypes.object,
  selectedTowers: PropTypes.array.isRequired,
  selectedStatuses: PropTypes.array.isRequired,
  selectedMethods: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  onClearAll: PropTypes.func.isRequired,
};

export default FilterControls;
