import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { FaCaretDown } from 'react-icons/fa6';
import MonthYearPicker from '../../components/MonthYearPicker';

const BillingFilterControls = ({
  searchQuery,
  servicePeriodFrom,
  servicePeriodTo,
  selectedTowers,
  selectedStatuses,
  filterOptions,
  onChange,
  onClearAll
}) => {
  // State for dropdown visibility
  const [showTowerDropdown, setShowTowerDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  
  // Local state for temporary selections (before Done is clicked)
  const [tempSelectedTowers, setTempSelectedTowers] = useState([]);
  const [tempSelectedStatuses, setTempSelectedStatuses] = useState([]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.relative')) {
        setShowTowerDropdown(false);
        setShowStatusDropdown(false);
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
      default:
        return;
    }
    
    // If all are selected, deselect all. Otherwise, select all
    const allValues = allOptions?.map(option => option.value) || [];
    const newSelected = currentSelected.length === allValues.length ? [] : allValues;
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
      default:
        return false;
    }
    
    const allValues = allOptions?.map(option => option.value) || [];
    return allValues.length > 0 && currentSelected.length === allValues.length;
  };

  // Get display text for filter buttons
  const getDisplayText = (selectedItems, defaultText) => {
    const count = selectedItems.length;
    if (count > 0) {
      return `${defaultText} (${count})`;
    }
    return defaultText;
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
      default:
        return;
    }
    
    onChange(setterKey, tempSelected);
  };

  // Handle Clear button click
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
      default:
        return;
    }
    
    onChange(setterKey, []);
  };

  return (
    <div className="space-y-4">
      {/* Filter Section */}
      <div className="flex gap-3 items-end w-full flex-wrap">
        {/* Tower Filter */}
        <div className="relative flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-2 pl-1">
            Select Tower
          </label>
          <button
            type="button"
            onClick={() => {
              setShowTowerDropdown(!showTowerDropdown);
              setTempSelectedTowers([...selectedTowers]);
            }}
            className={`w-full h-[42px] pl-3 pr-3 border rounded-md focus:outline-none text-sm text-primary bg-white flex items-center justify-between ${
              showTowerDropdown 
                ? '!border-primary !shadow-ring-primary' 
                : 'border-gray-300 focus:border-primary focus:shadow-ring-primary'
            }`}
          >
            <span className="truncate">
              {getDisplayText(selectedTowers, 'Select Towers')}
            </span>
            <FaCaretDown className="text-primary ml-2 flex-shrink-0" />
          </button>
          
          {showTowerDropdown && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-3 py-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected('tower', filterOptions?.towers)}
                    onChange={() => handleSelectAll('tower', filterOptions?.towers)}
                    className="mr-3 text-primary focus:ring-primary accent-primary rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Select All</span>
                </label>
              </div>
              
              <div className="px-3 py-2">
                {filterOptions?.towers?.map((tower) => (
                  <label key={tower.value} className="flex items-center py-1">
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
              
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-3 py-2 flex justify-between">
                <button
                  type="button"
                  onClick={() => handleClear('tower')}
                  className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleDone('tower')}
                  className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primaryHover transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Service Period From Filter */}
        <div className="flex-1 min-w-[200px]">
          <MonthYearPicker
            label="Service Period From"
            className={'text-primary'}
            value={servicePeriodFrom}
            onChange={(value) => onChange('servicePeriodFrom', value)}
            hideLabel={false}
            levelClass="pl-1"
          />
        </div>
        
        {/* Service Period To Filter */}
        <div className="flex-1 min-w-[200px]">
          <MonthYearPicker
            label="Service Period To"
            className={'text-primary'}
            value={servicePeriodTo}
            onChange={(value) => onChange('servicePeriodTo', value)}
            hideLabel={false}
            levelClass="pl-1"
          />
        </div>
      
        {/* Status Filter */}
        <div className="relative flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-2 pl-1">
            Select Status
          </label>
          <button
            type="button"
            onClick={() => {
              setShowStatusDropdown(!showStatusDropdown);
              setTempSelectedStatuses([...selectedStatuses]);
            }}
            className={`w-full h-[42px] pl-3 pr-3 border rounded-md focus:outline-none text-sm text-primary bg-white flex items-center justify-between ${
              showStatusDropdown 
                ? '!border-primary !shadow-ring-primary' 
                : 'border-gray-300 focus:border-primary focus:shadow-ring-primary'
            }`}
          >
            <span className="truncate">
              {getDisplayText(selectedStatuses, 'Select Status')}
            </span>
            <FaCaretDown className="text-primary ml-2 flex-shrink-0" />
          </button>
          
          {showStatusDropdown && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-3 py-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected('status', filterOptions?.status_options)}
                    onChange={() => handleSelectAll('status', filterOptions?.status_options)}
                    className="mr-3 text-primary focus:ring-primary accent-primary rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Select All</span>
                </label>
              </div>
              
              <div className="px-3 py-2">
                {filterOptions?.status_options?.map((status) => (
                  <label key={status.value} className="flex items-center py-1">
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
              
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-3 py-2 flex justify-between">
                <button
                  type="button"
                  onClick={() => handleClear('status')}
                  className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleDone('status')}
                  className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primaryHover transition-colors"
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

BillingFilterControls.propTypes = {
  searchQuery: PropTypes.string.isRequired,
  servicePeriodFrom: PropTypes.object,
  servicePeriodTo: PropTypes.object,
  selectedTowers: PropTypes.array.isRequired,
  selectedStatuses: PropTypes.array.isRequired,
  filterOptions: PropTypes.shape({
    towers: PropTypes.array,
    status_options: PropTypes.array,
  }),
  onChange: PropTypes.func.isRequired,
  onClearAll: PropTypes.func.isRequired,
};

export default BillingFilterControls;
