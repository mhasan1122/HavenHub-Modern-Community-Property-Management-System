import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import { FaCaretDown } from 'react-icons/fa6';

const ReminderFilterControls = ({
  searchQuery,
  selectedStatus,
  selectedReminderType,
  selectedSendWhen,
  selectedChannels,
  selectedAudience,
  onChange,
}) => {
  // State for dropdown visibility
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showScheduleDropdown, setShowScheduleDropdown] = useState(false);
  const [showChannelsDropdown, setShowChannelsDropdown] = useState(false);
  const [showAudienceDropdown, setShowAudienceDropdown] = useState(false);

  // Local state for temporary selections (before Done is clicked)
  const [tempSelectedStatus, setTempSelectedStatus] = useState([]);
  const [tempSelectedTypes, setTempSelectedTypes] = useState([]);
  const [tempSelectedSchedules, setTempSelectedSchedules] = useState([]);
  const [tempSelectedChannels, setTempSelectedChannels] = useState([]);
  const [tempSelectedAudience, setTempSelectedAudience] = useState([]);

  // Convert current selections to arrays for multi-select
  const selectedStatusArray = Array.isArray(selectedStatus) ? selectedStatus :
    (selectedStatus && selectedStatus !== 'All Status' ? [selectedStatus] : []);
  const selectedTypeArray = Array.isArray(selectedReminderType) ? selectedReminderType :
    (selectedReminderType && selectedReminderType !== 'All Types' ? [selectedReminderType] : []);
  const selectedScheduleArray = Array.isArray(selectedSendWhen) ? selectedSendWhen :
    (selectedSendWhen && selectedSendWhen !== 'All Schedules' ? [selectedSendWhen] : []);
  const selectedChannelsArray = Array.isArray(selectedChannels) ? selectedChannels :
    (selectedChannels && selectedChannels !== 'All Channels' ? [selectedChannels] : []);
  const selectedAudienceArray = Array.isArray(selectedAudience) ? selectedAudience :
    (selectedAudience && selectedAudience !== 'All Audiences' ? [selectedAudience] : []);

  // Static filter options for reminders
  const statusOptions = [
    { value: 'Active', label: 'Active' },
    { value: 'Paused', label: 'Paused' }
  ];

  const reminderTypeOptions = [
    { value: 'Scheduled', label: 'Scheduled' },
    { value: 'Manual Send', label: 'Manual Send' }
  ];

  const sendWhenOptions = [
    { value: '1 day before due', label: '1 day before due' },
    { value: '3 days before due', label: '3 days before due' },
    { value: '7 days before due', label: '7 days before due' },
    { value: 'On due date', label: 'On due date' },
    { value: '1 day after due', label: '1 day after due' },
    { value: 'on specific day', label: 'On specific day' }
  ];

  const channelOptions = [
    { value: 'App', label: 'App Notification' },
    { value: 'SMS', label: 'SMS' },
    { value: 'Email', label: 'Email' }
  ];

  const audienceOptions = [
    { value: 'All Tower', label: 'All Tower' },
    { value: 'All Residents', label: 'All Residents' },
    { value: 'Specific Tower', label: 'Specific Tower' },
    { value: 'Specific Units', label: 'Specific Units' },
    { value: 'Specific Resident', label: 'Specific Resident' },
    { value: 'Paid Only', label: 'Paid Only' },
    { value: 'Due Only', label: 'Due Only' },
    { value: 'Overdue Only', label: 'Overdue Only' }
  ];

  // Handle checkbox changes (temporary state)
  const handleCheckboxChange = (filterType, value, isChecked) => {
    let currentSelected = [];
    let setter = null;

    switch (filterType) {
      case 'status':
        currentSelected = [...tempSelectedStatus];
        setter = setTempSelectedStatus;
        break;
      case 'type':
        currentSelected = [...tempSelectedTypes];
        setter = setTempSelectedTypes;
        break;
      case 'schedule':
        currentSelected = [...tempSelectedSchedules];
        setter = setTempSelectedSchedules;
        break;
      case 'channels':
        currentSelected = [...tempSelectedChannels];
        setter = setTempSelectedChannels;
        break;
      case 'audience':
        currentSelected = [...tempSelectedAudience];
        setter = setTempSelectedAudience;
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
      case 'status':
        currentSelected = tempSelectedStatus;
        setter = setTempSelectedStatus;
        break;
      case 'type':
        currentSelected = tempSelectedTypes;
        setter = setTempSelectedTypes;
        break;
      case 'schedule':
        currentSelected = tempSelectedSchedules;
        setter = setTempSelectedSchedules;
        break;
      case 'channels':
        currentSelected = tempSelectedChannels;
        setter = setTempSelectedChannels;
        break;
      case 'audience':
        currentSelected = tempSelectedAudience;
        setter = setTempSelectedAudience;
        break;
      default:
        return;
    }

    // If all are selected, deselect all. Otherwise, select all
    const allValues = allOptions.map(option => option.value);
    const newSelected = currentSelected.length === allValues.length ? [] : allValues;
    setter(newSelected);
  };

  // Check if all options are selected (temporary state)
  const isAllSelected = (filterType, allOptions) => {
    let currentSelected = [];

    switch (filterType) {
      case 'status':
        currentSelected = tempSelectedStatus;
        break;
      case 'type':
        currentSelected = tempSelectedTypes;
        break;
      case 'schedule':
        currentSelected = tempSelectedSchedules;
        break;
      case 'channels':
        currentSelected = tempSelectedChannels;
        break;
      case 'audience':
        currentSelected = tempSelectedAudience;
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
      case 'status':
        setterKey = 'selectedStatus';
        tempSelected = tempSelectedStatus;
        setShowStatusDropdown(false);
        break;
      case 'type':
        setterKey = 'selectedReminderType';
        tempSelected = tempSelectedTypes;
        setShowTypeDropdown(false);
        break;
      case 'schedule':
        setterKey = 'selectedSendWhen';
        tempSelected = tempSelectedSchedules;
        setShowScheduleDropdown(false);
        break;
      case 'channels':
        setterKey = 'selectedChannels';
        tempSelected = tempSelectedChannels;
        setShowChannelsDropdown(false);
        break;
      case 'audience':
        setterKey = 'selectedAudience';
        tempSelected = tempSelectedAudience;
        setShowAudienceDropdown(false);
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
      case 'status':
        setterKey = 'selectedStatus';
        setTempSelectedStatus([]);
        setShowStatusDropdown(false);
        break;
      case 'type':
        setterKey = 'selectedReminderType';
        setTempSelectedTypes([]);
        setShowTypeDropdown(false);
        break;
      case 'schedule':
        setterKey = 'selectedSendWhen';
        setTempSelectedSchedules([]);
        setShowScheduleDropdown(false);
        break;
      case 'channels':
        setterKey = 'selectedChannels';
        setTempSelectedChannels([]);
        setShowChannelsDropdown(false);
        break;
      case 'audience':
        setterKey = 'selectedAudience';
        setTempSelectedAudience([]);
        setShowAudienceDropdown(false);
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
      case 'status':
        setTempSelectedStatus([...selectedStatusArray]);
        setShowStatusDropdown(true);
        break;
      case 'type':
        setTempSelectedTypes([...selectedTypeArray]);
        setShowTypeDropdown(true);
        break;
      case 'schedule':
        setTempSelectedSchedules([...selectedScheduleArray]);
        setShowScheduleDropdown(true);
        break;
      case 'channels':
        setTempSelectedChannels([...selectedChannelsArray]);
        setShowChannelsDropdown(true);
        break;
      case 'audience':
        setTempSelectedAudience([...selectedAudienceArray]);
        setShowAudienceDropdown(true);
        break;
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.filter-dropdown')) {
        setShowStatusDropdown(false);
        setShowTypeDropdown(false);
        setShowScheduleDropdown(false);
        setShowChannelsDropdown(false);
        setShowAudienceDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="mb-6">
      <div className="flex gap-3 items-end">
        {/* Status Filter - Multi-select Dropdown */}
        <div className="relative filter-dropdown w-48">
          <button
            type="button"
            onClick={() => handleDropdownOpen('status')}
            className={`w-full h-[42px] pl-3 pr-3 rounded-md focus:outline-none text-sm bg-white text-left flex items-center justify-between ${
              showStatusDropdown 
                ? '!border-primary !shadow-ring-primary border' 
                : 'border-gray-300 focus:border-primary focus:shadow-ring-primary border'
            }`}
          >
            <span className="truncate text-[#3D9D9B]">
              {getDisplayText(selectedStatusArray, 'Select Status')}
            </span>
            <FaCaretDown className={`w-3 h-3 text-[#3D9D9B] transition-transform ${showStatusDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showStatusDropdown && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-300 rounded-md shadow-lg overflow-hidden">
              <div className="max-h-40 overflow-y-auto p-2">
                {/* Select All Option */}
                <label className="flex items-center px-2 py-1 hover:bg-gray-50 cursor-pointer rounded border-b border-gray-100 mb-1">
                  <input
                    type="checkbox"
                    checked={isAllSelected('status', statusOptions)}
                    onChange={() => handleSelectAll('status', statusOptions)}
                    className="mr-3 text-[#3D9D9B] focus:ring-[#3D9D9B] accent-[#3D9D9B] rounded"
                  />
                  <span className="text-sm text-gray-700">Select All</span>
                </label>
                {statusOptions.map((status) => (
                  <label key={status.value} className="flex items-center px-2 py-1 hover:bg-gray-50 cursor-pointer rounded">
                    <input
                      type="checkbox"
                      checked={tempSelectedStatus.includes(status.value)}
                      onChange={(e) => handleCheckboxChange('status', status.value, e.target.checked)}
                      className="mr-3 text-[#3D9D9B] focus:ring-[#3D9D9B] accent-[#3D9D9B] rounded"
                    />
                    <span className="text-sm text-gray-700">{status.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-between gap-2 p-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                <button
                  onClick={() => handleClear('status')}
                  className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => handleDone('status')}
                  className="px-3 py-1 text-sm bg-[#3D9D9B] text-white rounded hover:bg-[#2A7D7B] transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Reminder Type Filter - COMMENTED OUT */}
        {/* <div className="relative filter-dropdown flex-1">
          ... Type filter code ...
        </div> */}

        {/* Send When Filter - COMMENTED OUT */}
        {/* <div className="relative filter-dropdown flex-1">
          ... Schedule filter code ...
        </div> */}

        {/* Channels Filter - COMMENTED OUT */}
        {/* <div className="relative filter-dropdown flex-1">
          ... Channels filter code ...
        </div> */}

        {/* Audience Filter - COMMENTED OUT */}
        {/* <div className="relative filter-dropdown flex-1">
          ... Audience filter code ...
        </div> */}

        {/* Search Input */}
        <div className="w-64">
          <div className="flex items-center bg-white border border-gray-300 shadow-sm py-2 px-3 rounded-md focus-within:ring-2 focus-within:ring-[#3D9D9B] focus-within:border-[#3D9D9B]">
            <input
              type="text"
              placeholder="Search Reminders..."
              value={searchQuery}
              onChange={e => onChange('searchQuery', e.target.value)}
              className="outline-none placeholder-[#3D9D9B] text-[#3D9D9B] text-sm w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

ReminderFilterControls.propTypes = {
  searchQuery: PropTypes.string.isRequired,
  selectedStatus: PropTypes.oneOfType([PropTypes.string, PropTypes.array]).isRequired,
  selectedReminderType: PropTypes.oneOfType([PropTypes.string, PropTypes.array]).isRequired,
  selectedSendWhen: PropTypes.oneOfType([PropTypes.string, PropTypes.array]).isRequired,
  selectedChannels: PropTypes.oneOfType([PropTypes.string, PropTypes.array]).isRequired,
  selectedAudience: PropTypes.oneOfType([PropTypes.string, PropTypes.array]).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default ReminderFilterControls;