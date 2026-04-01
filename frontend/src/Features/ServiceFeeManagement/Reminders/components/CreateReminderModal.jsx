import { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { RxCross1 } from 'react-icons/rx';
import { FaPaperPlane, FaTimes, FaPlus, FaClock } from 'react-icons/fa';
import { FaCaretDown } from 'react-icons/fa6';
import ErrorMessage from '../../../../Components/MessageBox/ErrorMessage';
import SelectComponent from '../../../../Components/FormComponent/SelectComponent';
import axiosInstance from '../../../../utils/axiosInstance';

const CreateReminderModal = ({ isOpen, onClose, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTime, setTempTime] = useState('');

  const [formData, setFormData] = useState({
    reminderName: '',
    reminderType: 'Scheduled',
    sendWhen: [], // Array of selected timing options
    times: [], // Global times that apply to all selected options
    channels: {
      appNotification: false,
      sms: false,
      email: false
    },
    audience: 'Specific Units', // Default to Specific Units
    towerScope: 'All Towers', // New field for Tower Scope
    paymentStatus: ['Paid', 'Due', 'Overdue'], // Array for multiple selection
    specificTarget: '',
    specificTargetId: null, // Store the selected ID for single selection
    selectedTowers: [], // Store multiple selected towers
    selectedUnits: [], // Store multiple selected units
    selectedResidents: [], // Store multiple selected residents
    searchResults: [],
    messagePreview: ''
    ,
    // Frequency: simple options only
    frequency: 'Monthly'
  });

  // Loading state for search
  const [isSearching, setIsSearching] = useState(false);

  // State for tower dropdown visibility
  const [showTowerDropdown, setShowTowerDropdown] = useState(false);

  // State for units dropdown visibility
  const [showUnitsDropdown, setShowUnitsDropdown] = useState(false);

  // State for residents dropdown visibility
  const [showResidentsDropdown, setShowResidentsDropdown] = useState(false);
  // Expand selected tags inline (show all) toggles
  const [expandTowers, setExpandTowers] = useState(false);
  const [expandUnits, setExpandUnits] = useState(false);
  const [expandResidents, setExpandResidents] = useState(false);

  // Caches for dropdown results to avoid redundant API calls
  const [towerResults, setTowerResults] = useState([]);
  const [unitResults, setUnitResults] = useState([]);
  const [residentResults, setResidentResults] = useState([]);


  // Default quick options - can be expanded (using objects for clean data structure)
  const [quickOptions, setQuickOptions] = useState([
    { type: 'before_due', day: 1, label: '1 day before due' },
    { type: 'before_due', day: 3, label: '3 days before due' },
    { type: 'before_due', day: 5, label: '5 days before due' },
    { type: 'before_due', day: 7, label: '7 days before due' },
    { type: 'on_due', day: 0, label: 'On due date' },
    { type: 'after_due', day: 1, label: '1 day after due' },
    { type: 'after_due', day: 3, label: '3 days after due' },
    { type: 'after_due', day: 5, label: '5 days after due' },
    { type: 'after_due', day: 7, label: '7 days after due' }
  ]);

  // State for adding new quick option
  const [newQuickOption, setNewQuickOption] = useState({
    days: 1,
    type: 'before',
    showForm: false
  });

  // Deduplicate quick options for stable rendering
  const dedupedQuickOptions = useMemo(() => {
    const seen = new Set();
    return quickOptions.filter(opt => {
      const key = `${opt.type}|${opt.day}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [quickOptions]);

  // Function to convert 24-hour time to 12-hour format with AM/PM
  const formatTimeTo12Hour = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };


  // Reset form and clear error when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setError('');
      setFieldErrors({});
      setIsSearching(false);
      setShowTowerDropdown(false);
      setShowUnitsDropdown(false);
      setShowResidentsDropdown(false);
      // Reset form to initial state
      setFormData({
        reminderName: '',
        reminderType: 'Scheduled',
        sendWhen: [], // Array of selected timing options
        times: [], // Global times
        channels: {
          appNotification: false,
          sms: false,
          email: false
        },
        audience: 'Specific Units',
        specificTarget: '',
        specificTargetId: null,
        selectedTowers: [],
        selectedUnits: [],
        selectedResidents: [],
        searchResults: [],
        messagePreview: 'Reminder: Your service fee for Oasis A, Unit A-12 is due on 5 Aug. Please pay via app or payment link. Thank you.'
        ,
        frequency: 'Monthly'
      });
    } else {
      // Clear error and reset form when modal closes
      setError('');
      setFieldErrors({});
      setLoading(false);
      setIsSearching(false);
      setShowTowerDropdown(false);
      setShowUnitsDropdown(false);
      setShowResidentsDropdown(false);
    }
  }, [isOpen]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close dropdowns when clicking outside
      if (showTowerDropdown || showUnitsDropdown || showResidentsDropdown) {
        // Check if click is on a dropdown toggle button
        const isToggleButton = event.target.closest('button')?.textContent?.includes('Click to Select') ||
          event.target.closest('button')?.textContent?.includes('Selected');

        if (isToggleButton) {
          // Don't close if clicking on toggle buttons
          return;
        }

        // Check if click is inside any dropdown container
        const dropdownContainer = event.target.closest('[data-dropdown="tower"], [data-dropdown="units"], [data-dropdown="residents"]');
        if (dropdownContainer) {
          // Don't close if clicking inside dropdown
          return;
        }

        // Check if clicking on a checkbox label inside dropdown
        const isLabelClick = event.target.closest('label');
        const isInsideDropdown = event.target.closest('.shadow-lg.rounded-md, .shadow-lg.rounded-lg');
        if (isLabelClick && isInsideDropdown) {
          return;
        }

        setShowTowerDropdown(false);
        setShowUnitsDropdown(false);
        setShowResidentsDropdown(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, showTowerDropdown, showUnitsDropdown, showResidentsDropdown]);


  // Load data when dropdown opens
  useEffect(() => {
    const loadData = async () => {
      if (showTowerDropdown && towerResults.length === 0) {
        setIsSearching(true);
        try {
          const results = await fetchTowers('');
          setTowerResults(results);
        } catch (error) {
          console.error('Error fetching towers:', error);
          setTowerResults([]);
        } finally {
          setIsSearching(false);
        }
      } else if (showUnitsDropdown && unitResults.length === 0) {
        setIsSearching(true);
        try {
          const towersPromise = towerResults.length > 0 ? Promise.resolve(towerResults) : fetchTowers('');
          const [towers, units] = await Promise.all([
            towersPromise,
            fetchUnits('')
          ]);
          setTowerResults(towers);
          setUnitResults(units);
        } catch (error) {
          console.error('Error fetching units:', error);
          setUnitResults([]);
        } finally {
          setIsSearching(false);
        }
      } else if (showResidentsDropdown && residentResults.length === 0) {
        setIsSearching(true);
        try {
          const results = await fetchResidents('');
          setResidentResults(results);
        } catch (error) {
          console.error('Error fetching residents:', error);
          setResidentResults([]);
        } finally {
          setIsSearching(false);
        }
      }
    };

    loadData();
  }, [showTowerDropdown, showUnitsDropdown, showResidentsDropdown]);

  // API function to fetch towers - using real API endpoint only
  const fetchTowers = async (searchTerm = '') => {
    try {
      console.log('Searching towers with term:', `"${searchTerm}"`);
      const response = await axiosInstance.get(`/api/service-fee-management/api/towers/?search=${encodeURIComponent(searchTerm)}`);

      console.log('Towers data:', response.data);
      const raw = Array.isArray(response.data) ? response.data : (response.data.results || response.data || []);
      const results = Array.isArray(raw) ? raw : [];
      const normalized = results.map(item => ({
        ...item,
        id: item.id || item.tower__id || item.tower_id || null,
        name: item.name || item.tower__tower_name || item.tower_name || item.tower__name || item.display_name || ''
      }));
      return normalized;
    } catch (error) {
      console.error('Error fetching towers:', error);
      throw error; // Re-throw error instead of falling back to mock data
    }
  };
  axiosInstance
  // API function to fetch units - using real API endpoint only
  const fetchUnits = async (searchTerm = '') => {
    try {
      console.log('Searching units with term:', `"${searchTerm}"`);
      const towerIds = Array.isArray(formData.selectedTowers) && formData.selectedTowers.length > 0
        ? formData.selectedTowers.map(t => t.id || t.value || t).filter(Boolean)
        : [];
      const towerParam = towerIds.length > 0 ? `&tower_ids=${encodeURIComponent(towerIds.join(','))}` : '';
      const response = await axiosInstance.get(`/api/service-fee-management/api/units/?search=${encodeURIComponent(searchTerm)}${towerParam}`);
      console.log('Units data:', response.data);
      const raw = Array.isArray(response.data) ? response.data : (response.data.results || response.data || []);
      const results = Array.isArray(raw) ? raw : [];
      const normalized = results.map(item => ({
        ...item,
        id: item.id || item.unit__id || item.unit_id || null,
        name: item.name || item.unit_name || item.unit__name || item.display_name || item.full_name || `${item.tower_name || ''} ${item.unit_name || ''}`.trim()
      }));
      return normalized;
    } catch (error) {
      console.error('Error fetching units:', error);
      throw error; // Re-throw error instead of falling back to mock data
    }
  };

  // API function to fetch residents - using real API endpoint only
  const fetchResidents = async (searchTerm = '') => {
    try {
      console.log('Searching residents with term:', `"${searchTerm}"`);
      const towerIds = Array.isArray(formData.selectedTowers) && formData.selectedTowers.length > 0
        ? formData.selectedTowers.map(t => t.id || t.value || t).filter(Boolean)
        : [];
      const towerParam = towerIds.length > 0 ? `&tower_ids=${encodeURIComponent(towerIds.join(','))}` : '';
      const response = await axiosInstance.get(`/api/service-fee-management/api/residents/?search=${encodeURIComponent(searchTerm)}${towerParam}`);
      console.log('Residents data:', response.data);
      const raw = Array.isArray(response.data) ? response.data : (response.data.results || response.data || []);
      const results = Array.isArray(raw) ? raw : [];
      const normalized = results.map(item => ({
        ...item,
        id: item.id || item.resident__id || item.resident_id || null,
        name: item.name || item.full_name || item.display_name || item.resident_name || ''
      }));
      return normalized;
    } catch (error) {
      console.error('Error fetching residents:', error);
      throw error; // Re-throw error instead of falling back to mock data
    }
  };

  // Handle "Select Tower" button click
  const handleSelectTowerClick = async () => {
    setShowTowerDropdown(!showTowerDropdown);
  };

  // Handle "Select Units" button click
  const handleSelectUnitsClick = async () => {
    setShowUnitsDropdown(!showUnitsDropdown);
  };

  // Handle "Select Residents" button click
  const handleSelectResidentsClick = async () => {
    setShowResidentsDropdown(!showResidentsDropdown);
  };

  // Handle selection from dropdown (for single selection)
  const handleSelectItem = (item) => {
    setFormData(prev => ({
      ...prev,
      specificTarget: item.name,
      specificTargetId: item.id,
      searchResults: [] // Hide dropdown after selection
    }));
  };

  // Handle multiple tower selection
  const handleTowerToggle = (tower) => {
    setFormData(prev => {
      const isSelected = prev.selectedTowers.some(t => t.id === tower.id);
      const newSelectedTowers = isSelected
        ? prev.selectedTowers.filter(t => t.id !== tower.id)
        : [...prev.selectedTowers, tower];

      const towerIds = newSelectedTowers.map(t => t.id);

      // Filter currently selected units/residents to those that belong to the new tower set
      const newSelectedUnits = prev.selectedUnits.filter(u => !u.tower_id || towerIds.length === 0 || towerIds.includes(u.tower_id));
      const newSelectedResidents = prev.selectedResidents.filter(r => !r.tower_id || towerIds.length === 0 || towerIds.includes(r.tower_id));

      return {
        ...prev,
        selectedTowers: newSelectedTowers,
        selectedUnits: newSelectedUnits,
        selectedResidents: newSelectedResidents,
        searchResults: []
      };
    });

    // Clear dependent caches so lists will re-fetch with tower filters as needed
    setUnitResults([]);
    setResidentResults([]);
  };

  // Handle multiple unit selection
  const handleUnitToggle = (unit) => {
    setFormData(prev => {
      const isSelected = prev.selectedUnits.some(u => u.id === unit.id);
      if (isSelected) {
        // Remove unit
        return {
          ...prev,
          selectedUnits: prev.selectedUnits.filter(u => u.id !== unit.id)
        };
      } else {
        // Add unit
        return {
          ...prev,
          selectedUnits: [...prev.selectedUnits, unit]
        };
      }
    });
  };

  // Handle multiple resident selection
  const handleResidentToggle = (resident) => {
    setFormData(prev => {
      const isSelected = prev.selectedResidents.some(r => r.id === resident.id);
      if (isSelected) {
        // Remove resident
        return {
          ...prev,
          selectedResidents: prev.selectedResidents.filter(r => r.id !== resident.id)
        };
      } else {
        // Add resident
        return {
          ...prev,
          selectedResidents: [...prev.selectedResidents, resident]
        };
      }
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: value
      };

      // Clear search-related fields when audience changes (but do NOT clear tower/unit/resident selections)
      if (name === 'audience' && prev.audience !== value) {
        newData.specificTarget = '';
        newData.specificTargetId = null;
        newData.searchResults = [];
        // keep previously-selected towers/units/residents intact
        // Do not auto-close dropdowns here — user controls them
      }

      return newData;
    });

    // Clear field errors when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleChannelChange = (channel) => {
    setFormData(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        [channel]: !prev.channels[channel]
      }
    }));
  };

  // Handler for multiple send when options
  const handleSendWhenChange = (option) => {
    setFormData(prev => {
      const newSendWhen = [...prev.sendWhen];
      // Compare objects by type and day properties
      const index = newSendWhen.findIndex(item => 
        typeof item === 'object' && item.type === option.type && item.day === option.day
      );
      if (index > -1) {
        // Remove the option
        newSendWhen.splice(index, 1);
      } else {
        // Add the option (user must manually add times)
        newSendWhen.push(option);
      }
      console.log('Send When Changed:', newSendWhen);
      return { ...prev, sendWhen: newSendWhen };
    });
  };

  // Handler for adding a global time
  const handleAddTime = () => {
    // Get current time in HH:MM format
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;
    setTempTime(currentTime);
    setShowTimePicker(true);
  };

  // Handler for selecting time from picker
  const handleTimeSelect = (e) => {
    setTempTime(e.target.value);
  };

  // Handler for confirming time selection
  const handleConfirmTime = () => {
    if (tempTime) {
      setFormData(prev => ({
        ...prev,
        times: [...prev.times, tempTime]
      }));
      setShowTimePicker(false);
      setTempTime('');
    }
  };

  // Handler for canceling time selection
  const handleCancelTime = () => {
    setShowTimePicker(false);
    setTempTime('');
  };

  // Handler for removing a global time
  const handleRemoveTime = (timeIndex) => {
    setFormData(prev => {
      const newTimes = [...prev.times];
      newTimes.splice(timeIndex, 1);
      return { ...prev, times: newTimes };
    });
  };

  // Handler for updating a specific time
  const handleTimeChange = (timeIndex, newTime) => {
    setFormData(prev => {
      const newTimes = [...prev.times];
      newTimes[timeIndex] = newTime;
      return { ...prev, times: newTimes };
    });
  };

  // Validation function
  const validateForm = () => {
    const { channels, reminderType, sendWhen, times, reminderName, audience, specificTarget, specificTargetId, selectedTowers, selectedUnits, selectedResidents, messagePreview } = formData;
    const errors = {};

    // Check if reminder name is provided
    if (!reminderName.trim()) {
      errors.reminderName = 'Reminder / notification name is required.';
    }

    // Check if message preview is provided
    if (!messagePreview.trim()) {
      errors.messagePreview = 'Message text is required';
    }

    // Check if "Send When" is required for Scheduled reminders
    if (reminderType === 'Scheduled') {
      if (!sendWhen || sendWhen.length === 0) {
        errors.sendWhen = 'Please select at least one timing option (day) for scheduled reminders';
      }

      // Check if at least one time is set for Scheduled reminders
      if (!times || times.length === 0) {
        errors.sendWhen = errors.sendWhen
          ? errors.sendWhen + ' and at least one time must be set'
          : 'Please set at least one time for scheduled reminders';
      }
    }

    // Check if specific target is required for specific audiences
    if (audience === 'Specific Units') {
      if (selectedUnits.length === 0) {
        errors.audience = 'Please select at least one unit';
      }
    } else if (audience === 'Specific Resident') {
      if (selectedResidents.length === 0) {
        errors.audience = 'Please select at least one resident';
      }
    } else if (['Specific Units', 'Specific Resident'].includes(audience)) {
      if (!specificTarget || !specificTarget.trim()) {
        const targetType = audience.replace('Specific ', '').toLowerCase();
        errors.audience = `Please search and select a ${targetType}`;
      }

      // Check if an item was actually selected (has an ID)
      if (!specificTargetId) {
        const targetType = audience.replace('Specific ', '').toLowerCase();
        errors.audience = `Please select a ${targetType} from the search results`;
      }
    }

    // Check if at least one channel is selected
    const hasAtLeastOneChannel = channels.appNotification || channels.sms || channels.email;
    if (!hasAtLeastOneChannel) {
      errors.channels = 'Please select at least one delivery channel (App Notification, SMS, or Email)';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0 ? null : 'Please fix the validation errors below';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate form before submission
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      // Extract sendWhenType and sendWhenDay arrays from all selected options
      let sendWhenTypes = [];
      let sendWhenDays = [];
      let sendWhenArray = [];
      
      if (Array.isArray(formData.sendWhen) && formData.sendWhen.length > 0) {
        // Extract type and day from each selected option
        formData.sendWhen.forEach(timing => {
          if (typeof timing === 'object' && timing !== null) {
            sendWhenTypes.push(timing.type);
            sendWhenDays.push(timing.day);
            
            // Build sendWhen array in the format expected by the database
            // Convert quick option format to timing string
            let timingString = '';
            if (timing.type === 'on_due') {
              timingString = 'On due date';
            } else if (timing.type === 'before_due') {
              timingString = `${timing.day} day${timing.day > 1 ? 's' : ''} before due`;
            } else if (timing.type === 'after_due') {
              timingString = `${timing.day} day${timing.day > 1 ? 's' : ''} after due`;
            } else if (timing.type === 'specific') {
              timingString = `Specific day: ${timing.day}`;
            }
            
            // Add to sendWhen array with times if available
            sendWhenArray.push({
              timing: timingString,
              times: Array.isArray(formData.times) ? formData.times : []
            });
          }
        });
      }

      const submitData = {
        reminderName: formData.reminderName,
        reminderType: 'Scheduled',
        channels: formData.channels,
        // New database columns - send as arrays
        sendWhen: sendWhenArray, // Add properly formatted sendWhen array
        sendWhenType: sendWhenTypes,
        sendWhenDay: sendWhenDays,
        sendWhenTimes: Array.isArray(formData.times) ? formData.times : [],
        // Send lowercase payment status - exclude any legacy 'all' token
        paymentStatus: (Array.isArray(formData.paymentStatus) ? formData.paymentStatus : []).map(s => 
          (s || '').toString().toLowerCase()
        ).filter(s => s && s !== 'all'),
        // Audience is hidden in Create modal; include units when selected
        audience: formData.audience,
        messagePreview: formData.messagePreview,
        // Frequency
        frequency: formData.frequency,
        // Always send tower IDs if towers are selected (for filtering)
        ...(formData.selectedTowers.length > 0 && { 
          towerIds: formData.selectedTowers.map(t => t.id)
        }),
        // Always include unitIds when units are selected
        ...(formData.selectedUnits && formData.selectedUnits.length > 0 && {
          unitIds: formData.selectedUnits.map(u => u.id),
          selectedUnits: formData.selectedUnits
        }),
        ...(formData.audience === 'Specific Resident' && { 
          residentIds: formData.selectedResidents.map(r => r.id),
          selectedResidents: formData.selectedResidents
        }),
        // Fallback for single selection (backward compatibility)
        ...(formData.selectedUnits && formData.selectedUnits.length === 0 && formData.audience === 'Specific Units' && { unitId: formData.specificTargetId }),
        ...(formData.audience === 'Specific Resident' && formData.selectedResidents.length === 0 && { residentId: formData.specificTargetId })
      };

      console.log('Submitting create reminder payload:', submitData);
      await onSave(submitData);
      // Keep temporary quick options only if they were selected for this reminder
      setQuickOptions(prev => prev.filter(opt => !opt.temporary || formData.sendWhen.some(s => typeof s === 'object' && s.type === opt.type && s.day === opt.day)));
      // Only close modal and reset form if save was successful
      onClose();
      resetForm();
    } catch (error) {
      // Show error message but keep modal open
      let errorMessage = 'Unable to save the reminder. Please try again.';

      // Extract meaningful error message from different error formats
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.response?.data?.errors) {
        // Handle validation errors
        const errors = error.response.data.errors;
        if (typeof errors === 'object') {
          const errorMessages = Object.values(errors).flat();
          errorMessage = errorMessages.join(', ');
        } else {
          errorMessage = errors.toString();
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
      console.error('Error saving reminder:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      reminderName: '',
      reminderType: 'Scheduled',
      sendWhen: [],
      times: [],
      channels: {
        appNotification: false,
        sms: false,
        email: false
      },
        audience: 'All Towers',
      paymentStatus: ['Paid', 'Due', 'Overdue'],
      frequency: 'Monthly',
      specificTarget: '',
      specificTargetId: null,
      selectedTowers: [],
      selectedUnits: [],
      selectedResidents: [],
      searchResults: [],
      messagePreview: 'Reminder: Your service fee for Oasis A, Unit A-12 is due on 5 Aug. Please pay via app or payment link. Thank you.'
    });
    setError('');
    setFieldErrors({});
    setIsSearching(false);
    setShowTowerDropdown(false);
    setShowUnitsDropdown(false);
    setShowResidentsDropdown(false);
  };

  const handleCancel = () => {
    setError('');
    setFieldErrors({});
    setLoading(false);
    // Remove temporary quick options when user cancels
    setQuickOptions(prev => prev.filter(opt => !opt.temporary));
    onClose();
  };

  // Handler for adding new quick option
  const handleAddQuickOption = () => {
    let { days, type } = newQuickOption;
    let dayValue = parseInt(days, 10);
    if (Number.isNaN(dayValue)) dayValue = 1;
    // For non-'due' types enforce 1..31
    if (type !== 'due') {
      dayValue = Math.min(Math.max(dayValue, 1), 31);
    }
    
    // Create object with type, day, and label
    // Treat days > 7 as "specific" instead of before/after due
    let sendWhenType;
    let label;
    let day;

    if (type === 'due') {
      sendWhenType = 'on_due';
      label = 'On due date';
      day = 0;
    } else if (dayValue > 7) {
      // Days beyond 7 are treated as specific dates
      sendWhenType = 'specific';
      label = `Specific Day: ${dayValue}`;
      day = dayValue;  // Use actual day number for specific type
    } else {
      sendWhenType = type === 'before' ? 'before_due' : 'after_due';
      label = `${dayValue} day${dayValue > 1 ? 's' : ''} ${type} due`;
      day = dayValue;
    }

    const newOption = { type: sendWhenType, day: day, label: label, temporary: true };
    
    // Check if option already exists (compare type and day)
    const exists = quickOptions.some(opt => opt.type === newOption.type && opt.day === newOption.day);
    if (!exists) {
      setQuickOptions(prev => [...prev, newOption]);
      // Do not auto-check the new option; user must explicitly check it.
    }

    // Reset and hide form
    setNewQuickOption({
      days: 1,
      type: 'before',
      showForm: false
    });
  };

  const handleSendNow = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate form before sending
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      // Extract sendWhenType and sendWhenDay arrays from all selected options
      let sendWhenTypes = [];
      let sendWhenDays = [];
      let sendWhenArray = [];
      
      if (Array.isArray(formData.sendWhen) && formData.sendWhen.length > 0) {
        // Extract type and day from each selected option
        formData.sendWhen.forEach(timing => {
          if (typeof timing === 'object' && timing !== null) {
            sendWhenTypes.push(timing.type);
            sendWhenDays.push(timing.day);
            
            // Build sendWhen array in the format expected by the database
            // Convert quick option format to timing string
            let timingString = '';
            if (timing.type === 'on_due') {
              timingString = 'On due date';
            } else if (timing.type === 'before_due') {
              timingString = `${timing.day} day${timing.day > 1 ? 's' : ''} before due`;
            } else if (timing.type === 'after_due') {
              timingString = `${timing.day} day${timing.day > 1 ? 's' : ''} after due`;
            } else if (timing.type === 'specific') {
              timingString = `Specific day: ${timing.day}`;
            }
            
            // Add to sendWhen array with times if available
            sendWhenArray.push({
              timing: timingString,
              times: Array.isArray(formData.times) ? formData.times : []
            });
          }
        });
      }

      const sendData = {
        reminderName: formData.reminderName,
        reminderType: formData.reminderType,
        channels: formData.channels,
        // New database columns - send as arrays
        sendWhen: sendWhenArray, // Add properly formatted sendWhen array
        sendWhenType: sendWhenTypes,
        sendWhenDay: sendWhenDays,
        sendWhenTimes: Array.isArray(formData.times) ? formData.times : [],
        // Send lowercase payment status - backend will expand 'all'
        paymentStatus: (Array.isArray(formData.paymentStatus) ? formData.paymentStatus : []).map(s => 
          (s || '').toString().toLowerCase()
        ).filter(Boolean),
        // Audience hidden; include units if selected
        audience: formData.audience,
        messagePreview: formData.messagePreview,
        // Frequency
        frequency: formData.frequency,
        sendImmediately: true,
        // Always send tower IDs if towers are selected (for filtering)
        ...(formData.selectedTowers.length > 0 && { 
          towerIds: formData.selectedTowers.map(t => t.id)
        }),
        // Always include unitIds when units are selected
        ...(formData.selectedUnits && formData.selectedUnits.length > 0 && {
          unitIds: formData.selectedUnits.map(u => u.id),
          selectedUnits: formData.selectedUnits
        }),
        ...(formData.audience === 'Specific Resident' && { 
          residentIds: formData.selectedResidents.map(r => r.id),
          selectedResidents: formData.selectedResidents
        }),
        // Fallback for single selection (backward compatibility)
        ...(formData.selectedUnits && formData.selectedUnits.length === 0 && formData.audience === 'Specific Units' && { unitId: formData.specificTargetId }),
        ...(formData.audience === 'Specific Resident' && formData.selectedResidents.length === 0 && { residentId: formData.specificTargetId })
      };

      console.log('Sending reminder now payload (Create):', sendData);
      await onSave(sendData);
      // Only close modal and reset form if save was successful
      onClose();
      resetForm();
    } catch (error) {
      // Show error message but keep modal open and preserve form data
      let errorMessage = 'Unable to send the reminder. Please try again.';

      // Extract meaningful error message from different error formats
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.response?.data?.errors) {
        // Handle validation errors
        const errors = error.response.data.errors;
        if (typeof errors === 'object') {
          const errorMessages = Object.values(errors).flat();
          errorMessage = errorMessages.join(', ');
        } else {
          errorMessage = errors.toString();
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
      console.error('Error sending reminder:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl relative max-h-[90vh] flex flex-col">
            {/* Close Button */}
            <button
              onClick={handleCancel}
              className="absolute -top-2 -right-2 p-2 rounded-full bg-primary text-white shadow-md hover:bg-primaryHover transition z-20"
            >
              <RxCross1 />
            </button>

            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Create New Reminder</h2>


            </div>

            {/* Modal Body */}
            <form id="createReminderForm" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Form Controls */}
                <div className="space-y-6">
                  {/* Reminder Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reminder / Notification Name <span className="text-primary text-lg">*</span>
                    </label>
                    <input
                      type="text"
                      name="reminderName"
                      value={formData.reminderName}
                      onChange={handleChange}
                      placeholder="Enter reminder name (e.g., Monthly Service Fee Alert)"
                      className={`login-field-input text-sm bg-white ${fieldErrors.reminderName ? 'border-red-500' : ''
                        }`}
                      disabled={loading}
                    />
                    <ErrorMessage message={fieldErrors.reminderName} />
                  </div>

                  {/* Reminder Type - Hidden, auto-set to Scheduled */}
                  {/* <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reminder / Notification Type <span className="text-primary text-lg">*</span>
                    </label>
                    <SelectComponent
                      name="reminderType"
                      value={formData.reminderType}
                      onChange={handleChange}
                      options={[
                        { value: 'Scheduled', label: 'Scheduled' },
                        { value: 'Manual Send', label: 'Manual Send' }
                      ]}
                      width="100%"
                    />
                  </div> */}

                  {/* Select Towers (Multi-select with Select All option) */}
                  <div className="mb-6 relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Towers <span className="text-primary text-lg">*</span>
                    </label>

                    {/* Select Tower Button */}
                    <div className="mb-3">
                          <button
                        type="button"
                        onClick={handleSelectTowerClick}
                        className={`login-field-input !flex justify-between items-center gap-2 whitespace-nowrap ${showTowerDropdown ? '!border-primary !bg-white !shadow-ring-primary cursor-pointer' : 'bg-white cursor-pointer hover:border-primary hover:bg-gray-50'}`}
                      >
                        <span className="flex-1 truncate text-sm overflow-hidden text-left">
                          {formData.selectedTowers.length === 0
                            ? 'Click to Select Towers'
                            : formData.selectedTowers.length === towerResults.length && towerResults.length > 0
                              ? 'All Towers Selected'
                              : `${formData.selectedTowers.length} Tower(s) Selected`
                          }
                        </span>
                        <FaCaretDown className={`flex-shrink-0 text-gray-500 transition-transform ${showTowerDropdown ? 'rotate-180' : ''}`} style={{ width: '16px', height: '16px' }} />
                      </button>
                    </div>

                    {/* Selected Towers Display (show up to 6, +N more opens dropdown) */}
                    {formData.selectedTowers.length > 0 && (
                      <div className="mb-3">
                        <div className="text-sm font-medium text-gray-700 mb-2">Selected Towers:</div>
                        <div className="flex flex-wrap gap-2 items-center">
                          {(() => {
                            const MAX_VISIBLE = 6;
                            const total = Array.isArray(formData.selectedTowers) ? formData.selectedTowers.length : 0;
                            const shouldShowToggle = total > MAX_VISIBLE;
                            const visible = expandTowers ? formData.selectedTowers : formData.selectedTowers.slice(0, MAX_VISIBLE);
                            const hiddenCount = Math.max(0, total - MAX_VISIBLE);
                            return (
                              <>
                                {visible.map((tower) => (
                                  <span
                                    key={tower.id}
                                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary text-white"
                                  >
                                    {tower.name}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTowerToggle(tower);
                                      }}
                                      className="ml-2 focus:outline-none"
                                    >
                                      <RxCross1 className="h-3 w-3" />
                                    </button>
                                  </span>
                                ))}
                                {shouldShowToggle && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandTowers(prev => !prev);
                                    }}
                                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                                  >
                                    {expandTowers ? 'Show less' : `+${hiddenCount} more`}
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Tower Dropdown */}
                    {showTowerDropdown && (
                      <div data-dropdown="tower" className="absolute z-50 mt-1 w-full left-0 top-full bg-white shadow-lg rounded-md border border-gray-200" onClick={(e) => e.stopPropagation()}>
                        {/* Select All Option */}
                          <div className="p-2 border-b border-gray-200">
                          <label
                            className={`flex items-center p-2 cursor-pointer rounded transition-colors ${formData.selectedTowers.length === towerResults.length && towerResults.length > 0
                              ? 'bg-primary text-white'
                              : 'hover:bg-primary hover:text-white'
                              }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              // Toggle select all
                              if (formData.selectedTowers.length === towerResults.length) {
                                setFormData(prev => ({ ...prev, selectedTowers: [] }));
                              } else {
                                setFormData(prev => ({ ...prev, selectedTowers: [...towerResults] }));
                              }
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={formData.selectedTowers.length === towerResults.length && towerResults.length > 0}
                              readOnly
                              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded accent-primary pointer-events-none"
                            />
                            <span className={`ml-3 text-sm font-medium ${formData.selectedTowers.length === towerResults.length && towerResults.length > 0 ? 'text-white' : 'text-gray-700'}`}>Select All Towers</span>
                          </label>
                        </div>
                        {/* Tower List with Checkboxes */}
                        <div className="max-h-60 overflow-y-auto">
                          {towerResults.length > 0 ? (
                            <div className="p-2">
                              {towerResults.map((tower) => {
                                const isSelected = formData.selectedTowers.some(t => t.id === tower.id);
                                return (
                                  <label
                                    key={tower.id}
                                    className={`flex items-center p-2 cursor-pointer rounded transition-colors ${isSelected
                                      ? 'bg-primary text-white'
                                      : 'hover:bg-primary hover:text-white'
                                      }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleTowerToggle(tower);
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      readOnly
                                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded accent-primary pointer-events-none"
                                    />
                                    <span className={`ml-3 text-sm ${isSelected ? 'text-white' : 'text-gray-700'}`}>{tower.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-4 text-center text-gray-500 text-sm">
                              {isSearching ? 'Loading towers...' : 'No towers available'}
                            </div>
                          )}
                        </div>

                        {/* OK and Clear Buttons */}
                        <div className="p-3 border-t border-gray-200 flex justify-between space-x-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormData(prev => ({ ...prev, selectedTowers: [] }));
                            }}
                            className="px-3 py-1 bg-primary text-white text-sm rounded hover:bg-primaryHover transition-colors"
                          >
                            Clear All
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowTowerDropdown(false);
                            }}
                            className="px-3 py-1 bg-primary text-white text-sm rounded hover:bg-primaryHover transition-colors"
                          >
                            OK
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Audience selection intentionally hidden in Create modal.
                      Audience will be inferred automatically from selections
                      and unitIds will always be included in payload when units are selected.
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Audience <span className="text-primary text-lg">*</span>
                    </label>
                    <SelectComponent
                      name="audience"
                      value={formData.audience}
                      onChange={handleChange}
                      options={[
                        { value: 'Specific Units', label: 'Units' },
                        { value: 'Specific Resident', label: 'Residents' }
                      ]}
                      width="100%"
                    />
                    <ErrorMessage message={fieldErrors.audience} />
                  </div>
                  */}

                  {/* Multiple Units Selection */}
                  {formData.audience === 'Specific Units' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Units <span className="text-primary text-lg">*</span>
                      </label>

                      {/* Select Units Button */}
                      <div className="mb-3 relative">
                        <button
                          type="button"
                          onClick={handleSelectUnitsClick}
                          className={`login-field-input !flex justify-between items-center gap-2 whitespace-nowrap ${showUnitsDropdown ? '!border-primary !bg-white !shadow-ring-primary cursor-pointer' : 'bg-white cursor-pointer hover:border-primary hover:bg-gray-50'}`}
                        >
                          <span className="flex-1 truncate text-sm overflow-hidden text-left">
                            {formData.selectedUnits.length > 0
                              ? `${formData.selectedUnits.length} Unit(s) Selected`
                              : 'Click to Select Units'
                            }
                          </span>
                          <FaCaretDown className={`flex-shrink-0 text-gray-500 transition-transform ${showUnitsDropdown ? 'rotate-180' : ''}`} style={{ width: '16px', height: '16px' }} />
                        </button>

                        {/* Units Dropdown (positioned absolutely so it can overflow modal) */}
                        {showUnitsDropdown && (
                          <div className="absolute left-0 right-0 mt-1 z-50 border border-gray-200 rounded-lg bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
                            {/* Units List with Checkboxes */}
                            <div className="max-h-60 overflow-y-auto">
                              {unitResults.length > 0 ? (
                                <div className="p-2">
                                  {/* Select All Units */}
                                  <label
                                    key="select-all-units"
                                    className={`flex items-center p-2 cursor-pointer rounded transition-colors ${formData.selectedUnits.length === unitResults.length && unitResults.length > 0
                                      ? 'bg-primary text-white'
                                      : 'hover:bg-primary hover:text-white'
                                      }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={formData.selectedUnits.length === unitResults.length && unitResults.length > 0}
                                      onChange={() => {
                                        if (formData.selectedUnits.length === unitResults.length && unitResults.length > 0) {
                                          setFormData(prev => ({ ...prev, selectedUnits: [] }));
                                        } else {
                                          setFormData(prev => ({ ...prev, selectedUnits: unitResults.slice() }));
                                        }
                                      }}
                                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded accent-primary"
                                    />
                                    <div className={`ml-3 text-sm ${formData.selectedUnits.length === unitResults.length && unitResults.length > 0 ? 'text-white' : 'text-gray-700'}`}>
                                      <div className="font-medium">Select All Units</div>
                                    </div>
                                  </label>
                                  {unitResults.map((item) => {
                                    const isSelected = formData.selectedUnits.some(u => u.id === item.id);
                                    return (
                                      <label
                                        key={`${item.type}-${item.id}`}
                                        className={`flex items-center p-2 cursor-pointer rounded transition-colors ${isSelected
                                          ? 'bg-primary text-white'
                                          : 'hover:bg-primary hover:text-white'
                                          }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => handleUnitToggle(item)}
                                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded accent-primary"
                                        />
                                        <div className={`ml-3 text-sm ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                                          <div className="font-medium">{item.name}</div>
                                          {item.tower_name && <div className={`text-xs ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>{item.tower_name}</div>}
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="p-3 text-sm text-gray-500">No towers or units available.</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Selected Units Display (show up to 6, +N more opens units dropdown) */}
                      {formData.selectedUnits.length > 0 && (
                        <div className="mb-3">
                          <div className="text-sm font-medium text-gray-700 mb-2">Selected Units:</div>
                          <div className="flex flex-wrap gap-2 items-center">
                            {(() => {
                              const MAX_VISIBLE = 6;
                              const total = Array.isArray(formData.selectedUnits) ? formData.selectedUnits.length : 0;
                              const shouldShowToggle = total > MAX_VISIBLE;
                              const visible = expandUnits ? formData.selectedUnits : formData.selectedUnits.slice(0, MAX_VISIBLE);
                              const hiddenCount = Math.max(0, total - MAX_VISIBLE);
                              return (
                                <>
                                  {visible.map((unit) => (
                                    <span
                                      key={unit.id}
                                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary text-white"
                                    >
                                      {unit.name}
                                      <button
                                        type="button"
                                        onClick={() => handleUnitToggle(unit)}
                                        className="ml-2 text-white hover:text-gray-200 focus:outline-none"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                  {shouldShowToggle && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setExpandUnits(prev => !prev); }}
                                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    >
                                      {expandUnits ? 'Show less' : `+${hiddenCount} more`}
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Units Dropdown */}
                      {showUnitsDropdown && (
                        <div className="border border-gray-200 rounded-lg bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
                          {/* Units List with Checkboxes */}
                          <div className="max-h-60 overflow-y-auto">
                            {unitResults.length > 0 ? (
                              <div className="p-2">
                                {/* Select All Units */}
                                <label
                                  key="select-all-units"
                                  className={`flex items-center p-2 cursor-pointer rounded transition-colors ${formData.selectedUnits.length === unitResults.length && unitResults.length > 0
                                    ? 'bg-primary text-white'
                                    : 'hover:bg-primary hover:text-white'
                                    }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={formData.selectedUnits.length === unitResults.length && unitResults.length > 0}
                                    onChange={() => {
                                      if (formData.selectedUnits.length === unitResults.length && unitResults.length > 0) {
                                        setFormData(prev => ({ ...prev, selectedUnits: [] }));
                                      } else {
                                        setFormData(prev => ({ ...prev, selectedUnits: unitResults.slice() }));
                                      }
                                    }}
                                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded accent-primary"
                                  />
                                  <div className={`ml-3 text-sm ${formData.selectedUnits.length === unitResults.length && unitResults.length > 0 ? 'text-white' : 'text-gray-700'}`}>
                                    <div className="font-medium">Select All Units</div>
                                  </div>
                                </label>
                                {unitResults.map((item) => {
                                  const isSelected = formData.selectedUnits.some(u => u.id === item.id);
                                  return (
                                    <label
                                      key={`${item.type}-${item.id}`}
                                      className={`flex items-center p-2 cursor-pointer rounded transition-colors ${isSelected
                                        ? 'bg-primary text-white'
                                        : 'hover:bg-primary hover:text-white'
                                        }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleUnitToggle(item)}
                                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded accent-primary"
                                      />
                                      <div className={`ml-3 text-sm ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                                        <div className="font-medium">{item.name}</div>
                                        <div className={`text-xs ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                                          {item.type === 'tower' ? 'Tower' : 'Unit'}
                                        </div>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="p-4 text-center text-gray-500 text-sm">
                                {isSearching ? 'Loading towers and units...' : 'No towers or units available'}
                              </div>
                            )}
                          </div>

                          {/* OK and Clear Buttons */}
                          <div className="p-3 border-t border-gray-200 flex justify-between space-x-2">
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, selectedUnits: [] }))}
                              className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200 transition-colors"
                            >
                              Clear All
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowUnitsDropdown(false)}
                              className="px-3 py-1 bg-primary text-white text-sm rounded hover:bg-primaryHover transition-colors"
                            >
                              OK
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Helper text for scheduled reminders */}
                      {formData.reminderType === 'Scheduled' && (
                        <p className="text-xs text-gray-500 mt-2">
                          * Required: Please select at least one timing option for scheduled reminders
                        </p>
                      )}
                    </div>
                  )}

                  {/* Multiple Residents Selection */}
                  {formData.audience === 'Specific Resident' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Residents <span className="text-primary text-lg">*</span>
                      </label>

                      {/* Select Residents Button */}
                      <div className="mb-3">
                        <button
                          type="button"
                          onClick={handleSelectResidentsClick}
                          className={`login-field-input !flex justify-between items-center gap-2 whitespace-nowrap ${showResidentsDropdown ? '!border-primary !bg-white !shadow-ring-primary cursor-pointer' : 'bg-white cursor-pointer hover:border-primary hover:bg-gray-50'}`}
                        >
                          <span className="flex-1 truncate text-sm overflow-hidden text-left">
                            {formData.selectedResidents.length > 0
                              ? `${formData.selectedResidents.length} Resident(s) Selected`
                              : 'Click to Select Residents'
                            }
                          </span>
                          <FaCaretDown className={`flex-shrink-0 text-gray-500 transition-transform ${showResidentsDropdown ? 'rotate-180' : ''}`} style={{ width: '16px', height: '16px' }} />
                        </button>
                      </div>

                      {/* Selected Residents Display (show up to 6, +N more opens residents dropdown) */}
                      {formData.selectedResidents.length > 0 && (
                        <div className="mb-3">
                          <div className="text-sm font-medium text-gray-700 mb-2">Selected Residents:</div>
                          <div className="flex flex-wrap gap-2 items-center">
                            {(() => {
                              const MAX_VISIBLE = 6;
                              const total = Array.isArray(formData.selectedResidents) ? formData.selectedResidents.length : 0;
                              const shouldShowToggle = total > MAX_VISIBLE;
                              const visible = expandResidents ? formData.selectedResidents : formData.selectedResidents.slice(0, MAX_VISIBLE);
                              const hiddenCount = Math.max(0, total - MAX_VISIBLE);
                              return (
                                <>
                                  {visible.map((resident) => (
                                    <span
                                      key={resident.id}
                                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary text-white"
                                    >
                                      {resident.name}
                                      <button
                                        type="button"
                                        onClick={() => handleResidentToggle(resident)}
                                        className="ml-2 text-white hover:text-gray-200 focus:outline-none"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                  {shouldShowToggle && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setExpandResidents(prev => !prev); }}
                                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    >
                                      {expandResidents ? 'Show less' : `+${hiddenCount} more`}
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Residents Dropdown */}
                      {showResidentsDropdown && (
                        <div className="border border-gray-200 rounded-lg bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
                          {/* Residents List with Checkboxes */}
                          <div className="max-h-60 overflow-y-auto">
                            {residentResults.length > 0 ? (
                              <div className="p-2">
                                {/* Select All Residents */}
                                <label
                                  key="select-all-residents"
                                  className={`flex items-center p-2 cursor-pointer rounded transition-colors ${formData.selectedResidents.length === residentResults.length && residentResults.length > 0
                                    ? 'bg-primary text-white'
                                    : 'hover:bg-primary hover:text-white'
                                    }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={formData.selectedResidents.length === residentResults.length && residentResults.length > 0}
                                    onChange={() => {
                                      if (formData.selectedResidents.length === residentResults.length && residentResults.length > 0) {
                                        setFormData(prev => ({ ...prev, selectedResidents: [] }));
                                      } else {
                                        setFormData(prev => ({ ...prev, selectedResidents: residentResults.slice() }));
                                      }
                                    }}
                                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded accent-primary"
                                  />
                                  <div className={`ml-3 text-sm ${formData.selectedResidents.length === residentResults.length && residentResults.length > 0 ? 'text-white' : 'text-gray-700'}`}>
                                    <div className="font-medium">Select All Residents</div>
                                  </div>
                                </label>
                                {residentResults.map((resident) => {
                                  const isSelected = formData.selectedResidents.some(r => r.id === resident.id);
                                  return (
                                    <label
                                      key={resident.id}
                                      className={`flex items-center p-2 cursor-pointer rounded transition-colors ${isSelected
                                        ? 'bg-primary text-white'
                                        : 'hover:bg-primary hover:text-white'
                                        }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleResidentToggle(resident)}
                                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded accent-primary"
                                      />
                                      <div className={`ml-3 text-sm ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                                        <div className="font-medium">{resident.name}</div>
                                        <div className={`text-xs ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                                          Resident
                                        </div>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="p-4 text-center text-gray-500 text-sm">
                                {isSearching ? 'Loading residents...' : 'No residents available'}
                              </div>
                            )}
                          </div>

                          {/* OK and Clear Buttons */}
                          <div className="p-3 border-t border-gray-200 flex justify-between space-x-2">
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, selectedResidents: [] }))}
                              className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200 transition-colors"
                            >
                              Clear All
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowResidentsDropdown(false)}
                              className="px-3 py-1 bg-primary text-white text-sm rounded hover:bg-primaryHover transition-colors"
                            >
                              OK
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment Status - Checkboxes (Multiple Selection) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Status
                    </label>
                    <div className="flex flex-wrap gap-4">
                      {/* Removed 'All' option - keep individual status checkboxes only */}
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Array.isArray(formData.paymentStatus) && formData.paymentStatus.includes('Paid')}
                          onChange={() => {
                            setFormData(prev => {
                              const currentStatus = Array.isArray(prev.paymentStatus) ? prev.paymentStatus : [];
                              const hasPaid = currentStatus.includes('Paid');
                              let newStatus;
                              if (hasPaid) {
                                newStatus = currentStatus.filter(s => s !== 'Paid' && s !== 'All');
                              } else {
                                newStatus = [...currentStatus.filter(s => s !== 'All'), 'Paid'];
                                if (newStatus.includes('Paid') && newStatus.includes('Due') && newStatus.includes('Overdue')) {
                                  newStatus = ['Paid', 'Due', 'Overdue'];
                                }
                              }
                              return { ...prev, paymentStatus: newStatus };
                            });
                          }}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded accent-primary"
                        />
                        <span className="ml-2 text-sm text-gray-700">Paid</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Array.isArray(formData.paymentStatus) && formData.paymentStatus.includes('Due')}
                          onChange={() => {
                            setFormData(prev => {
                              const currentStatus = Array.isArray(prev.paymentStatus) ? prev.paymentStatus : [];
                              const hasDue = currentStatus.includes('Due');
                              let newStatus;
                                if (hasDue) {
                                newStatus = currentStatus.filter(s => s !== 'Due' && s !== 'All');
                              } else {
                                newStatus = [...currentStatus.filter(s => s !== 'All'), 'Due'];
                                if (newStatus.includes('Paid') && newStatus.includes('Due') && newStatus.includes('Overdue')) {
                                  newStatus = ['Paid', 'Due', 'Overdue'];
                                }
                              }
                              return { ...prev, paymentStatus: newStatus };
                            });
                          }}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded accent-primary"
                        />
                        <span className="ml-2 text-sm text-gray-700">Due</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Array.isArray(formData.paymentStatus) && formData.paymentStatus.includes('Overdue')}
                          onChange={() => {
                            setFormData(prev => {
                              const currentStatus = Array.isArray(prev.paymentStatus) ? prev.paymentStatus : [];
                              const hasOverdue = currentStatus.includes('Overdue');
                              let newStatus;
                                if (hasOverdue) {
                                newStatus = currentStatus.filter(s => s !== 'Overdue' && s !== 'All');
                              } else {
                                newStatus = [...currentStatus.filter(s => s !== 'All'), 'Overdue'];
                                if (newStatus.includes('Paid') && newStatus.includes('Due') && newStatus.includes('Overdue')) {
                                  newStatus = ['Paid', 'Due', 'Overdue'];
                                }
                              }
                              return { ...prev, paymentStatus: newStatus };
                            });
                          }}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded accent-primary"
                        />
                        <span className="ml-2 text-sm text-gray-700">Overdue</span>
                      </label>
                    </div>
                    <ErrorMessage message={fieldErrors.paymentStatus} />
                  </div>

                  {/* Send When */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Send When
                      {formData.reminderType === 'Scheduled' && (
                        <span className="text-primary ml-1 text-lg">*</span>
                      )}
                    </label>

                    {/* Predefined Options */}
                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-medium text-gray-600">Quick Options:</h4>
                        <button
                          type="button"
                          onClick={() => setNewQuickOption(prev => (prev.showForm ? { ...prev, showForm: false } : { days: 1, type: 'before', showForm: true }))}
                          className="flex items-center space-x-1 px-2 py-1 text-xs bg-primaryLight text-primary border border-primary rounded hover:bg-primary hover:text-white transition-colors"
                        >
                          <FaPlus className="w-3 h-3" />
                          <span>Add Quick Option</span>
                        </button>
                      </div>

                      {/* Add Quick Option Form */}
                      {newQuickOption.showForm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
                          <div className="bg-white p-4 rounded-lg border-2 border-primary shadow-xl max-w-md w-full mx-4">
                            <h3 className="text-sm font-semibold text-gray-800 mb-3">Add Custom Quick Option</h3>
                            <div className="flex items-center space-x-2 mb-3">
                              <input
                                type="number"
                                min="1"
                                max="31"
                                value={newQuickOption.type === 'due' ? 0 : newQuickOption.days}
                                onChange={(e) => {
                                  const raw = parseInt(e.target.value, 10);
                                  const val = Number.isNaN(raw) ? 1 : raw;
                                  setNewQuickOption(prev => ({ ...prev, days: Math.min(Math.max(val, 1), 31) }));
                                }}
                                className="login-field-input text-sm px-2 py-1 w-16"
                                disabled={newQuickOption.type === 'due'}
                              />
                              <span className="text-sm text-gray-700">days</span>
                              <div className="flex-1">
                                <SelectComponent
                                  name="quickOptionType"
                                  value={newQuickOption.type}
                                  onChange={(e) => setNewQuickOption(prev => ({ ...prev, type: e.target.value }))}
                                  options={[
                                    { value: 'before', label: 'before due' },
                                    { value: 'after', label: 'after due' },
                                    { value: 'due', label: 'on due date' },
                                    { value: 'specific', label: 'on specific day' }
                                  ]}
                                  width="100%"
                                  className="w-full"
                                />
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                type="button"
                                onClick={handleAddQuickOption}
                                className="px-3 py-1 bg-primary text-white text-xs rounded hover:bg-primaryHover transition-colors"
                              >
                                Add Option
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewQuickOption(prev => ({ ...prev, showForm: false }))}
                                className="px-3 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        {/** Render deduplicated quick options */}
                        {dedupedQuickOptions.map((option, index) => (
                          <label key={`${option.type}-${option.day}-${index}`} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.sendWhen.some(item => 
                                typeof item === 'object' && item.type === option.type && item.day === option.day
                              )}
                              onChange={() => handleSendWhenChange(option)}
                              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded accent-primary"
                            />
                            <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <ErrorMessage message={fieldErrors.sendWhen} />
                  </div>
                </div>

                {/* Right Column - Time, Channels, and Message Preview */}
                <div className="space-y-6">
                  {/* Global Time Input Fields */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Set Times <span className="text-primary text-lg">*</span>
                    </label>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-600">Times apply to all selected options</p>
                        <button
                          type="button"
                          onClick={handleAddTime}
                          className="text-xs text-white bg-primary hover:bg-primaryHover px-3 py-1.5 rounded flex items-center space-x-1 transition-colors"
                        >
                          <FaClock className="w-3 h-3" />
                          <span>Add Time</span>
                        </button>
                      </div>

                      {/* Time Picker Popup */}
                      {showTimePicker && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
                          <div className="bg-white p-4 rounded-lg border-2 border-primary shadow-xl">
                            <div className="flex items-center space-x-2">
                              <div className="flex-1 relative">
                                <input
                                  type="time"
                                  value={tempTime}
                                  onChange={handleTimeSelect}
                                  className="login-field-input text-sm px-3 py-2 w-full cursor-pointer"
                                  autoFocus
                                  onClick={(e) => {
                                    if (e.target.showPicker) {
                                      e.target.showPicker();
                                    }
                                  }}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={handleConfirmTime}
                                disabled={!tempTime}
                                className={`px-3 py-2 text-xs rounded transition-colors ${tempTime
                                  ? 'bg-primary text-white hover:bg-primaryHover'
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  }`}
                              >
                                OK
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelTime}
                                className="px-3 py-2 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {formData.times.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {formData.times.map((time, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary text-white"
                            >
                              {formatTimeTo12Hour(time)}
                              <button
                                type="button"
                                onClick={() => handleRemoveTime(index)}
                                className="ml-2 text-white hover:text-gray-200"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Channels */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Channels <span className="text-primary text-lg">*</span>
                    </label>
                    <div className="flex flex-wrap gap-6">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.channels.appNotification}
                          onChange={() => handleChannelChange('appNotification')}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded accent-primary"
                        />
                        <span className="ml-2 text-sm text-gray-700">App Notification</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.channels.sms}
                          onChange={() => handleChannelChange('sms')}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded accent-primary"
                        />
                        <span className="ml-2 text-sm text-gray-700">SMS</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.channels.email}
                          onChange={() => handleChannelChange('email')}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded accent-primary"
                        />
                        <span className="ml-2 text-sm text-gray-700">Email</span>
                      </label>
                    </div>
                    <ErrorMessage message={fieldErrors.channels} />
                  </div>

                  {/* Message Preview */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message Preview <span className="text-primary text-lg">*</span>
                    </label>
                    <textarea
                      name="messagePreview"
                      value={formData.messagePreview}
                      onChange={handleChange}
                      rows={15}
                      className={`login-field-input text-sm resize-none ${fieldErrors.messagePreview ? 'border-red-500' : ''
                        }`}
                      placeholder="Enter your reminder message..."
                    />
                    <ErrorMessage message={fieldErrors.messagePreview} />
                  </div>
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 bg-white flex justify-end space-x-4">
              {/* <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors border border-red-500 flex items-center gap-2"
              >
                <FaTimes className="w-4 h-4" />
                Cancel
              </button> */}
              {/* <button
                type="button"
                onClick={handleSendNow}
                className="px-6 py-2 bg-primary text-white rounded hover:bg-primaryHover transition-colors border border-primary flex items-center gap-2"
              >
                <FaPaperPlane className="w-4 h-4" />
                Manual Send
              </button> */}
              <button
                type="submit"
                form="createReminderForm"
                disabled={loading}
                className={`px-6 py-2 text-white rounded transition-colors flex items-center gap-2 ${loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-primary hover:bg-primaryHover'
                  }`}
              >
                <FaPlus className="w-4 h-4" />
                {loading ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

CreateReminderModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired
};

export default CreateReminderModal; 