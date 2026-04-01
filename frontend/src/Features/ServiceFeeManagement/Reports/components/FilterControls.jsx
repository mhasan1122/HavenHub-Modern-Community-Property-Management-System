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
    <div className="space-y-4">
      {/* Filter Section - Always visible when component is rendered */}
      <div className="flex gap-3 items-end w-full">
        {/* Tower Filter */}
        <div className="relative flex-1">
          <button
            type="button"
            onClick={() => {
              setShowTowerDropdown(!showTowerDropdown);
              setTempSelectedTowers([...selectedTowers]);
            }}
            className="w-full h-[42px] pl-3 pr-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3D9D9B] focus:border-[#3D9D9B] text-sm text-[#3D9D9B] bg-white flex items-center justify-between"
          >
          <span className="truncate">
            {getDisplayText(selectedTowers, 'Select Towers')}
          </span>
          <FaCaretDown className="text-[#3D9D9B] ml-2" />
        </button>
        
        {showTowerDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-3 py-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isAllSelected('tower', filterOptions?.towers)}
                  onChange={() => handleSelectAll('tower', filterOptions?.towers)}
                  className="mr-3 text-[#3D9D9B] focus:ring-[#3D9D9B] accent-[#3D9D9B] rounded"
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
                    className="mr-3 text-[#3D9D9B] focus:ring-[#3D9D9B] accent-[#3D9D9B] rounded"
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
                className="px-3 py-1 text-sm bg-[#3D9D9B] text-white rounded hover:bg-[#2f7c7a] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Search Input */}
      <div className="flex-1">
        <div className="flex items-center bg-white border border-gray-300 shadow-sm py-2 px-3 rounded-md focus-within:ring-2 focus-within:ring-[#3D9D9B] focus-within:border-[#3D9D9B]">
          <input
            type="text"
            placeholder="Search Residents, units..."
            value={searchQuery}
            onChange={e => onChange('searchQuery', e.target.value)}
            className="outline-none placeholder-[#3D9D9B] text-[#3D9D9B] w-full"
          />
        </div>
      </div>
      
      {/* Service Period From Filter */}
      <div className="flex-1">
        <MonthYearPicker
          className={'text-[#3D9D9B]'}
          value={servicePeriodFrom}
          onChange={(value) => onChange('servicePeriodFrom', value)}
          hideLabel={true}
        />
      </div>
      
      {/* Service Period To Filter */}
      <div className="flex-1">
        <MonthYearPicker
          className={'text-[#3D9D9B]'}
          value={servicePeriodTo}
          onChange={(value) => onChange('servicePeriodTo', value)}
          hideLabel={true}
        />
      </div>
    
      {/* Status Filter */}
      <div className="relative flex-1">
        <button
          type="button"
          onClick={() => {
            setShowStatusDropdown(!showStatusDropdown);
            setTempSelectedStatuses([...selectedStatuses]);
          }}
          className="w-full h-[42px] pl-3 pr-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3D9D9B] focus:border-[#3D9D9B] text-sm text-[#3D9D9B] bg-white flex items-center justify-between"
        >
          <span className="truncate">
            {getDisplayText(selectedStatuses, 'Select Status')}
          </span>
          <FaCaretDown className="text-[#3D9D9B] ml-2" />
        </button>
        
        {showStatusDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-3 py-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isAllSelected('status', filterOptions?.status_options)}
                  onChange={() => handleSelectAll('status', filterOptions?.status_options)}
                  className="mr-3 text-[#3D9D9B] focus:ring-[#3D9D9B] accent-[#3D9D9B] rounded"
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
                    className="mr-3 text-[#3D9D9B] focus:ring-[#3D9D9B] accent-[#3D9D9B] rounded"
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
                className="px-3 py-1 text-sm bg-[#3D9D9B] text-white rounded hover:bg-[#2f7c7a] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Payment Method Filter */}
      <div className="relative flex-1">
        <button
          type="button"
          onClick={() => {
            setShowMethodDropdown(!showMethodDropdown);
            setTempSelectedMethods([...selectedMethods]);
          }}
          className="w-full h-[42px] pl-3 pr-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3D9D9B] focus:border-[#3D9D9B] text-sm text-[#3D9D9B] bg-white flex items-center justify-between"
        >
          <span className="truncate">
            {getDisplayText(selectedMethods, 'Select Methods')}
          </span>
          <FaCaretDown className="text-[#3D9D9B] ml-2" />
        </button>
        
        {showMethodDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-3 py-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isAllSelected('method', filterOptions?.payment_methods)}
                  onChange={() => handleSelectAll('method', filterOptions?.payment_methods)}
                  className="mr-3 text-[#3D9D9B] focus:ring-[#3D9D9B] accent-[#3D9D9B] rounded"
                />
                <span className="text-sm font-medium text-gray-700">Select All</span>
              </label>
            </div>
            
            <div className="px-3 py-2">
              {filterOptions?.payment_methods?.map((method) => (
                <label key={method.value} className="flex items-center py-1">
                  <input
                    type="checkbox"
                    checked={tempSelectedMethods.includes(method.value)}
                    onChange={(e) => handleCheckboxChange('method', method.value, e.target.checked)}
                    className="mr-3 text-[#3D9D9B] focus:ring-[#3D9D9B] accent-[#3D9D9B] rounded"
                  />
                  <span className="text-sm text-gray-700">{method.label}</span>
                </label>
              ))}
            </div>
            
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-3 py-2 flex justify-between">
              <button
                type="button"
                onClick={() => handleClear('method')}
                className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleDone('method')}
                className="px-3 py-1 text-sm bg-[#3D9D9B] text-white rounded hover:bg-[#2f7c7a] transition-colors"
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
