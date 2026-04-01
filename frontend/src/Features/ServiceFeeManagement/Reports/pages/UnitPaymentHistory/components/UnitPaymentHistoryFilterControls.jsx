import PropTypes from 'prop-types';
import { FaCaretDown, FaSearch } from 'react-icons/fa6';
import MonthYearPicker from '../../../../components/MonthYearPicker';

const UnitPaymentHistoryFilterControls = ({
  searchQuery,
  servicePeriodFrom,
  servicePeriodTo,
  selectedTowers,
  selectedStatuses,
  selectedMethods,
  onChange,
  filterOptions,
  showTowerDropdown,
  setShowTowerDropdown,
  showStatusDropdown,
  setShowStatusDropdown,
  showMethodDropdown,
  setShowMethodDropdown,
  tempSelectedTowers,
  setTempSelectedTowers,
  tempSelectedStatuses,
  setTempSelectedStatuses,
  tempSelectedMethods,
  setTempSelectedMethods,
  handleCheckboxChange,
  handleSelectAll,
  isAllSelected,
  getDisplayText,
  handleDone,
  handleClear
}) => {
  return (
    <div className="mb-6 relative z-20 bg-white pb-3 border-b border-borderLight">
      <div className="flex flex-wrap gap-3 items-end w-full">
        {/* Tower Filter */}
        <div className="relative basis-[220px] flex-1">
          <button
            type="button"
            onClick={() => {
              setShowTowerDropdown(!showTowerDropdown);
              setTempSelectedTowers([...selectedTowers]);
            }}
            className="w-full h-[42px] pl-3 pr-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm text-primary bg-white flex items-center justify-between"
          >
            <span className="truncate">
              {getDisplayText(selectedTowers, 'Select Towers')}
            </span>
            <FaCaretDown className="text-primary ml-2" />
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
                  className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primaryHoverAlt transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Search Input */}
        <div className="flex-1 basis-[260px] min-w-[200px]">
          <div className="flex items-center bg-white border border-gray-300 shadow-sm py-2 px-3 rounded-md focus-within:ring-2 focus-within:ring-[#3D9D9B] focus-within:border-[#3D9D9B] h-[42px]">
            <FaSearch className="text-[#3D9D9B] mr-2" />
            <input
              type="text"
              placeholder="Search Residents, units..."
              value={searchQuery}
              onChange={e => onChange('searchQuery', e.target.value)}
              className="outline-none placeholder-primary text-primary w-full"
            />
          </div>
        </div>
        
        {/* Service Period From Filter */}
        <div className="flex-1 basis-[220px]">
          <MonthYearPicker
            className={'text-primary'}
            value={servicePeriodFrom}
            onChange={(value) => onChange('servicePeriodFrom', value)}
            hideLabel={true}
          />
        </div>
        
        {/* Service Period To Filter */}
        <div className="flex-1 basis-[220px]">
          <MonthYearPicker
            className={'text-primary'}
            value={servicePeriodTo}
            onChange={(value) => onChange('servicePeriodTo', value)}
            hideLabel={true}
          />
        </div>

        {/* Status Filter */}
        <div className="relative basis-[220px] flex-1">
          <button
            type="button"
            onClick={() => {
              setShowStatusDropdown(!showStatusDropdown);
              setTempSelectedStatuses([...selectedStatuses]);
            }}
            className="w-full h-[42px] pl-3 pr-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm text-primary bg-white flex items-center justify-between"
          >
            <span className="truncate">
              {getDisplayText(selectedStatuses, 'Select Status')}
            </span>
            <FaCaretDown className="text-primary ml-2" />
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
                  className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primaryHoverAlt transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Payment Method Filter */}
        {/* <div className="relative flex-1">
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
        </div> */}
      </div>
    </div>
  );
};

UnitPaymentHistoryFilterControls.propTypes = {
  searchQuery: PropTypes.string.isRequired,
  servicePeriodFrom: PropTypes.object,
  servicePeriodTo: PropTypes.object,
  selectedTowers: PropTypes.array.isRequired,
  selectedStatuses: PropTypes.array.isRequired,
  selectedMethods: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  filterOptions: PropTypes.object.isRequired,
  showTowerDropdown: PropTypes.bool.isRequired,
  setShowTowerDropdown: PropTypes.func.isRequired,
  showStatusDropdown: PropTypes.bool.isRequired,
  setShowStatusDropdown: PropTypes.func.isRequired,
  showMethodDropdown: PropTypes.bool.isRequired,
  setShowMethodDropdown: PropTypes.func.isRequired,
  tempSelectedTowers: PropTypes.array.isRequired,
  setTempSelectedTowers: PropTypes.func.isRequired,
  tempSelectedStatuses: PropTypes.array.isRequired,
  setTempSelectedStatuses: PropTypes.func.isRequired,
  tempSelectedMethods: PropTypes.array.isRequired,
  setTempSelectedMethods: PropTypes.func.isRequired,
  handleCheckboxChange: PropTypes.func.isRequired,
  handleSelectAll: PropTypes.func.isRequired,
  isAllSelected: PropTypes.func.isRequired,
  getDisplayText: PropTypes.func.isRequired,
  handleDone: PropTypes.func.isRequired,
  handleClear: PropTypes.func.isRequired,
};

export default UnitPaymentHistoryFilterControls;
