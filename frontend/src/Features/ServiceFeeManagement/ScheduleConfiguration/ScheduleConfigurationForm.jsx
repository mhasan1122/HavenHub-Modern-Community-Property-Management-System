import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RxCross1 } from 'react-icons/rx';
import { FaSave } from 'react-icons/fa';
import { MdCheck } from 'react-icons/md';
import axiosInstance from '../../../utils/axiosInstance';

const ScheduleConfigurationForm = ({ isOpen, onClose, schedule = null, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [towers, setTowers] = useState([]);
  const [serviceFees, setServiceFees] = useState([]);
  const [loadingTowers, setLoadingTowers] = useState(false);
  const [loadingServiceFees, setLoadingServiceFees] = useState(false);

  const [formData, setFormData] = useState({
    schedule_name: '',
    towers: [], // Multiple towers
    service_fees: [], // Multiple service fees
    generation_date: '',
    generation_time: '',
    recurring_frequencies: [], // Multiple recurring frequencies: daily, weekly, monthly
    is_recurring: true,
    status: 'active'
  });

  // Dropdown states
  const [showTowerDropdown, setShowTowerDropdown] = useState(false);
  const [showServiceFeeDropdown, setShowServiceFeeDropdown] = useState(false);
  const [showRecurringFrequencyDropdown, setShowRecurringFrequencyDropdown] = useState(false);

  // Refs for dropdown positioning
  const towerButtonRef = useRef(null);
  const serviceFeeButtonRef = useRef(null);
  const recurringFrequencyButtonRef = useRef(null);
  const [towerDropdownPosition, setTowerDropdownPosition] = useState({ top: 0, left: 0, width: 0, position: 'below' });
  const [serviceFeeDropdownPosition, setServiceFeeDropdownPosition] = useState({ top: 0, left: 0, width: 0, position: 'below' });
  const [recurringFrequencyDropdownPosition, setRecurringFrequencyDropdownPosition] = useState({ top: 0, left: 0, width: 0, position: 'below' });

  // Refs
  const timeInputRef = useRef(null);
  const initializedRef = useRef(false);

  // Recurring frequency options
  const recurringFrequencyOptions = [
    { value: 'daily', label: 'Every Day' },
    { value: 'weekly', label: 'Every Week' },
    { value: 'monthly', label: 'Every Month' }
  ];

  // Load towers and service fees on mount
  useEffect(() => {
    if (isOpen) {
      loadTowers();
      setErrors({});
    }
  }, [isOpen]);

  // Initialize form once per open; do not reset after user starts interacting
  useEffect(() => {
    if (!isOpen) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;

    if (schedule) {
      const today = new Date();
      const generationDay = schedule.generation_day || 1;
      const scheduleDate = new Date(today.getFullYear(), today.getMonth(), generationDay);

      const towerId = schedule.tower
        ? String(typeof schedule.tower === 'object' && schedule.tower.id ? schedule.tower.id : schedule.tower)
        : null;

      const serviceFeeId = schedule.service_fee
        ? String(typeof schedule.service_fee === 'object' && schedule.service_fee.id ? schedule.service_fee.id : schedule.service_fee)
        : null;

      let recurringFreqs = ['monthly'];
      if (Array.isArray(schedule.recurring_frequencies_all) && schedule.recurring_frequencies_all.length > 0) {
        recurringFreqs = schedule.recurring_frequencies_all;
      } else if (schedule.recurring_frequency) {
        recurringFreqs = [schedule.recurring_frequency];
      }

      setFormData({
        schedule_name: schedule.schedule_name || '',
        towers: towerId ? [towerId] : [],
        service_fees: serviceFeeId ? [serviceFeeId] : [],
        generation_date: scheduleDate.toISOString().split('T')[0],
        generation_time: `${String(schedule.generation_hour || 14).padStart(2, '0')}:${String(schedule.generation_minute || 0).padStart(2, '0')}`,
        recurring_frequencies: recurringFreqs,
        is_recurring: schedule.is_recurring !== undefined ? schedule.is_recurring : true,
        status: schedule.status || 'active'
      });

      // Load service fees if tower is selected
      if (towerId) {
        loadServiceFees([parseInt(towerId)]);
      }
    } else {
      const today = new Date();
      const defaultDate = new Date(today.getFullYear(), today.getMonth(), 1);
      setFormData({
        schedule_name: '',
        towers: [],
        service_fees: [],
        generation_date: defaultDate.toISOString().split('T')[0],
        generation_time: '14:00',
        recurring_frequencies: ['monthly'],
        is_recurring: true,
        status: 'active'
      });
    }

    initializedRef.current = true;
  }, [isOpen, schedule]);

  const loadTowers = async () => {
    setLoadingTowers(true);
    try {
      const response = await axiosInstance.get('/api/service-fee-management/towers/tower_list/');
      const towersData = response.data.results || response.data.data || response.data;
      const towersArray = Array.isArray(towersData) ? towersData : [];
      // Normalize tower data: map 'name' to 'tower_name' for compatibility
      const normalizedTowers = towersArray.map(t => ({
        ...t,
        tower_name: t.tower_name || t.name
      }));
      setTowers(normalizedTowers);
    } catch (error) {
      console.error('Error loading towers:', error);
      setTowers([]);
    } finally {
      setLoadingTowers(false);
    }
  };

  const loadServiceFees = async (selectedTowerIds = []) => {
    setLoadingServiceFees(true);
    try {
      const params = { is_active: 'true' };
      if (Array.isArray(selectedTowerIds) && selectedTowerIds.length > 0) {
        params.tower_ids = selectedTowerIds.join(',');
      }
      const response = await axiosInstance.get('/api/service-fee-management/service-fee-options/', { params });
      const feesData = response.data.data || response.data.results || response.data;
      const feesArray = Array.isArray(feesData) ? feesData : [];
      // Sort service fees by tower name then amount/currency for stable ordering
      const sortedFees = feesArray.sort((a, b) => {
        const aTowers = (a.tower_names || []).join(', ') || 'All Towers';
        const bTowers = (b.tower_names || []).join(', ') || 'All Towers';
        if (aTowers !== bTowers) return aTowers.localeCompare(bTowers);
        const aAmt = parseFloat(a.fee_amount || 0);
        const bAmt = parseFloat(b.fee_amount || 0);
        if (aAmt !== bAmt) return aAmt - bAmt;
        return (a.currency || '').localeCompare(b.currency || '');
      });
      setServiceFees(sortedFees);
    } catch (error) {
      console.error('Error loading service fees:', error);
      setServiceFees([]);
    } finally {
      setLoadingServiceFees(false);
    }
  };

  // Note: Service fees will be loaded explicitly on Tower "Done" click

  // Group service fees by tower for display - filter by selected towers
  const getGroupedServiceFees = () => {
    const grouped = {};
    const selectedTowerIds = formData.towers.map(id => parseInt(id));
    const selectedTowerNames = formData.towers.length > 0 
      ? towers.filter(t => selectedTowerIds.includes(t.id)).map(t => t.tower_name)
      : [];
    
    // Filter service fees based on selected towers
    const filteredFees = serviceFees.filter(fee => {
      // If no towers selected, show all service fees
      if (formData.towers.length === 0) {
        return true;
      }
      
      const feeTowerIds = fee.tower_id_list || [];
      const feeTowerNames = fee.tower_names || [];
      
      // If service fee has no specific towers (applies to all), show it
      if (feeTowerIds.length === 0 && feeTowerNames.length === 0) {
        return true;
      }
      
      // Check if any of the selected towers match the service fee's towers
      const hasMatchingTower = selectedTowerIds.some(towerId => 
        feeTowerIds.includes(towerId)
      ) || selectedTowerNames.some(towerName => 
        feeTowerNames.includes(towerName)
      );
      
      return hasMatchingTower;
    });
    
    filteredFees.forEach(fee => {
      const towerNames = fee.tower_names || [];
      
      if (towerNames.length === 0) {
        // Service fee with no specific towers (applies to all)
        if (!grouped['All Towers']) {
          grouped['All Towers'] = [];
        }
        grouped['All Towers'].push(fee);
      } else {
        // Group by each tower - only show towers that are selected (or all if none selected)
        towerNames.forEach(towerName => {
          // If towers are selected, only show this tower's group if it's selected
          if (formData.towers.length > 0) {
            const tower = towers.find(t => t.tower_name === towerName);
            if (!tower || !selectedTowerIds.includes(tower.id)) {
              return; // Skip this tower if not selected
            }
          }
          
          if (!grouped[towerName]) {
            grouped[towerName] = [];
          }
          // Only add if not already in this tower's group (avoid duplicates)
          if (!grouped[towerName].find(f => f.id === fee.id)) {
            grouped[towerName].push(fee);
          }
        });
      }
    });
    
    // Sort tower names alphabetically
    const sortedTowerNames = Object.keys(grouped).sort((a, b) => {
      if (a === 'All Towers') return -1;
      if (b === 'All Towers') return 1;
      return a.localeCompare(b);
    });

    // Sort fees within each tower by fee_amount ascending, then by currency as tie-breaker
    sortedTowerNames.forEach(name => {
      grouped[name].sort((a, b) => {
        const aAmt = parseFloat(a.fee_amount || 0);
        const bAmt = parseFloat(b.fee_amount || 0);
        if (aAmt !== bAmt) return aAmt - bAmt;
        const aCur = (a.currency || '').toString();
        const bCur = (b.currency || '').toString();
        return aCur.localeCompare(bCur);
      });
    });
    
    return { grouped, sortedTowerNames };
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Handle tower selection
  const handleTowerToggle = (towerId) => {
    setFormData(prev => {
      const isSelected = prev.towers.includes(towerId);
      return {
        ...prev,
        towers: isSelected
          ? prev.towers.filter(id => id !== towerId)
          : [...prev.towers, towerId]
      };
    });
  };

  // Handle service fee selection
  const handleServiceFeeToggle = (serviceFeeId) => {
    setFormData(prev => {
      const isSelected = prev.service_fees.includes(serviceFeeId);
      return {
        ...prev,
        service_fees: isSelected
          ? prev.service_fees.filter(id => id !== serviceFeeId)
          : [...prev.service_fees, serviceFeeId]
      };
    });
  };

  // Handle select all towers
  const handleSelectAllTowers = () => {
    if (formData.towers.length === towers.length) {
      setFormData(prev => ({ ...prev, towers: [] }));
    } else {
      setFormData(prev => ({ ...prev, towers: towers.map(t => t.id) }));
    }
  };

  // Handle select all service fees - based on filtered/grouped fees
  const handleSelectAllServiceFees = () => {
    const { grouped, sortedTowerNames } = getGroupedServiceFees();
    const allFilteredFeeIds = sortedTowerNames.flatMap(towerName => 
      grouped[towerName].map(fee => fee.id)
    );
    
    // Check if all filtered fees are selected
    const allSelected = allFilteredFeeIds.length > 0 && 
      allFilteredFeeIds.every(id => formData.service_fees.includes(id));
    
    if (allSelected) {
      // Deselect all filtered fees (but keep others that might be selected)
      setFormData(prev => ({ 
        ...prev, 
        service_fees: prev.service_fees.filter(id => !allFilteredFeeIds.includes(id))
      }));
    } else {
      // Select all filtered fees
      setFormData(prev => ({ 
        ...prev, 
        service_fees: [...new Set([...prev.service_fees, ...allFilteredFeeIds])]
      }));
    }
  };

  // Handle recurring frequency selection
  const handleRecurringFrequencyToggle = (frequency) => {
    setFormData(prev => {
      const isSelected = prev.recurring_frequencies.includes(frequency);
      return {
        ...prev,
        recurring_frequencies: isSelected
          ? prev.recurring_frequencies.filter(f => f !== frequency)
          : [...prev.recurring_frequencies, frequency]
      };
    });
  };

  // Handle select all recurring frequencies
  const handleSelectAllRecurringFrequencies = () => {
    if (formData.recurring_frequencies.length === recurringFrequencyOptions.length) {
      setFormData(prev => ({ ...prev, recurring_frequencies: [] }));
    } else {
      setFormData(prev => ({ ...prev, recurring_frequencies: recurringFrequencyOptions.map(f => f.value) }));
    }
  };

  // Calculate smart dropdown position (below if space, otherwise above)
  const calculateDropdownPosition = (buttonRef) => {
    if (!buttonRef.current) return { top: 0, left: 0, width: 0, position: 'below' };
    
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = 240; // max-h-60 = 240px
    const gap = 4;
    
    // Use getBoundingClientRect which gives position relative to viewport
    // For fixed positioning, we use viewport coordinates directly
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // Check if button is in lower third of viewport (likely near bottom of modal)
    const isInLowerThird = rect.bottom > window.innerHeight * 0.66;
    
    // Check if dropdown would fit below
    const fitsBelow = spaceBelow >= dropdownHeight + gap;
    // Check if dropdown would fit above
    const fitsAbove = spaceAbove >= dropdownHeight + gap;
    
    let top, position;
    
    // If in lower third and has less space below than above, prefer above
    if (isInLowerThird && spaceBelow < spaceAbove) {
      // Show above - more space available above
      position = 'above';
      top = rect.top - dropdownHeight - gap;
    } else if (fitsBelow) {
      // Show below if it fits
      position = 'below';
      top = rect.bottom + gap;
    } else if (fitsAbove) {
      // Show above if it fits
      position = 'above';
      top = rect.top - dropdownHeight - gap;
    } else {
      // Neither fits perfectly, choose the side with more space
      if (spaceAbove > spaceBelow) {
        // More space above, show above (may be clipped but better than below)
        position = 'above';
        top = Math.max(gap, rect.top - dropdownHeight - gap);
      } else {
        // More space below, show below (may be clipped but better than above)
        position = 'below';
        top = rect.bottom + gap;
      }
    }
    
    return {
      top: Math.max(gap, top), // Ensure it doesn't go above viewport
      left: rect.left,
      width: rect.width,
      position
    };
  };

  // Update dropdown positions when they open or window changes
  useEffect(() => {
    if (showTowerDropdown) {
      setTowerDropdownPosition(calculateDropdownPosition(towerButtonRef));
    }
  }, [showTowerDropdown]);

  useEffect(() => {
    if (showServiceFeeDropdown) {
      setServiceFeeDropdownPosition(calculateDropdownPosition(serviceFeeButtonRef));
    }
  }, [showServiceFeeDropdown]);

  // Calculate if all filtered service fees are selected (for Select All checkbox)
  const areAllFilteredServiceFeesSelected = () => {
    const { grouped, sortedTowerNames } = getGroupedServiceFees();
    const allFilteredFeeIds = sortedTowerNames.flatMap(towerName => 
      grouped[towerName].map(fee => fee.id)
    );
    return allFilteredFeeIds.length > 0 && 
      allFilteredFeeIds.every(id => formData.service_fees.includes(id));
  };

  useEffect(() => {
    if (showRecurringFrequencyDropdown) {
      setRecurringFrequencyDropdownPosition(calculateDropdownPosition(recurringFrequencyButtonRef));
    }
  }, [showRecurringFrequencyDropdown]);

  // Recalculate positions on scroll or resize when dropdowns are open
  useEffect(() => {
    const handleRecalculate = () => {
      if (showTowerDropdown) {
        setTowerDropdownPosition(calculateDropdownPosition(towerButtonRef));
      }
      if (showServiceFeeDropdown) {
        setServiceFeeDropdownPosition(calculateDropdownPosition(serviceFeeButtonRef));
      }
      if (showRecurringFrequencyDropdown) {
        setRecurringFrequencyDropdownPosition(calculateDropdownPosition(recurringFrequencyButtonRef));
      }
    };

    if (showTowerDropdown || showServiceFeeDropdown || showRecurringFrequencyDropdown) {
      window.addEventListener('scroll', handleRecalculate, true);
      window.addEventListener('resize', handleRecalculate);
      return () => {
        window.removeEventListener('scroll', handleRecalculate, true);
        window.removeEventListener('resize', handleRecalculate);
      };
    }
  }, [showTowerDropdown, showServiceFeeDropdown, showRecurringFrequencyDropdown]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const isInDropdown = event.target.closest('.dropdown-portal');
      const isInButton = event.target.closest('.multi-select-dropdown');
      
      if (!isInDropdown && !isInButton) {
        setShowTowerDropdown(false);
        setShowServiceFeeDropdown(false);
        setShowRecurringFrequencyDropdown(false);
      }
    };

    if (isOpen && (showTowerDropdown || showServiceFeeDropdown || showRecurringFrequencyDropdown)) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, showTowerDropdown, showServiceFeeDropdown, showRecurringFrequencyDropdown]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.schedule_name.trim()) {
      newErrors.schedule_name = 'Schedule name is required';
    }

    // Tower and service fee are optional (can be empty for "all")

    if (!formData.generation_date) {
      newErrors.generation_date = 'Generation date is required';
    }

    if (!formData.generation_time) {
      newErrors.generation_time = 'Generation time is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Parse date and time
      const dateObj = new Date(formData.generation_date);
      const [hours, minutes] = formData.generation_time.split(':').map(Number);
      
      // Prepare payload - backend expects single tower and service_fee (not arrays)
      // For create: if multiple selected, create multiple schedules
      // For update: use first selection only
      const selectedTowers = formData.towers.length > 0 ? formData.towers : [null];
      const selectedServiceFees = formData.service_fees.length > 0 ? formData.service_fees : [null];

      let response;
      if (schedule) {
        // Update existing schedule.
        // If multiple selections are provided, update the first combination
        // and create additional schedules for remaining combinations.
        const generationDay = dateObj.getDate();
        if (!generationDay || generationDay < 1 || generationDay > 31) {
          setErrors({ submit: 'Generation day must be between 1 and 31' });
          setLoading(false);
          return;
        }
        
        const towersForUpdate = selectedTowers.length > 0 ? selectedTowers : [null];
        const serviceFeesForUpdate = selectedServiceFees.length > 0 ? selectedServiceFees : [null];
        const frequenciesForUpdate = formData.recurring_frequencies && formData.recurring_frequencies.length > 0 
          ? formData.recurring_frequencies 
          : ['monthly'];
        
        // Prepare all combinations
        const combinations = [];
        for (const t of towersForUpdate) {
          for (const s of serviceFeesForUpdate) {
            for (const f of frequenciesForUpdate) {
              combinations.push({
                tower: t ? parseInt(t) : null,
                service_fee: s ? parseInt(s) : null,
                recurring_frequency: f
              });
            }
          }
        }
        
        // Update the first combination on the current schedule
        const first = combinations.shift();
        const updatePayload = {
          schedule_name: formData.schedule_name.trim(),
          tower: first.tower,
          service_fee: first.service_fee,
          generation_day: generationDay,
          generation_hour: hours,
          generation_minute: minutes,
          recurring_frequency: first.recurring_frequency,
          is_recurring: formData.is_recurring,
          status: formData.status
        };
        
        await axiosInstance.patch(
          `/api/service-fee-management/generation-schedules/${schedule.id}/`,
          updatePayload
        );
        
        // Create remaining combinations as brand new schedules
        if (combinations.length > 0) {
          const createPromises = combinations.map((combo, idx) => {
            // Append a short suffix to distinguish if multiple created
            const suffixParts = [];
            if (combo.tower) suffixParts.push(`Tower ${combo.tower}`);
            if (combo.service_fee) suffixParts.push(`Fee ${combo.service_fee}`);
            if (frequenciesForUpdate.length > 1) suffixParts.push(combo.recurring_frequency.charAt(0).toUpperCase() + combo.recurring_frequency.slice(1));
            const nameSuffix = suffixParts.length > 0 ? ` - ${suffixParts.join(' - ')}` : '';
            
            const createPayload = {
              schedule_name: `${formData.schedule_name.trim()}${nameSuffix}`,
              tower: combo.tower,
              service_fee: combo.service_fee,
              generation_day: generationDay,
              generation_hour: hours,
              generation_minute: minutes,
              recurring_frequency: combo.recurring_frequency,
              is_recurring: formData.is_recurring,
              status: formData.status
            };
            return axiosInstance.post('/api/service-fee-management/generation-schedules/', createPayload);
          });
          await Promise.all(createPromises);
        }
        
        response = { data: { success: true } };
      } else {
        // Create: if multiple towers/service fees/frequencies selected, create multiple schedules
        const schedulesToCreate = [];
        const selectedFrequencies = formData.recurring_frequencies && formData.recurring_frequencies.length > 0 
          ? formData.recurring_frequencies 
          : ['monthly'];
        
        for (const towerId of selectedTowers) {
          for (const serviceFeeId of selectedServiceFees) {
            for (const frequency of selectedFrequencies) {
              // Build schedule name with suffixes if multiple selections
              let scheduleName = formData.schedule_name.trim();
              const hasMultipleTowers = formData.towers.length > 1;
              const hasMultipleServiceFees = formData.service_fees.length > 1;
              const hasMultipleFrequencies = selectedFrequencies.length > 1;
              
              if (hasMultipleTowers || hasMultipleServiceFees || hasMultipleFrequencies) {
                const suffixes = [];
                if (hasMultipleTowers && towerId) {
                  suffixes.push(`Tower ${towerId}`);
                }
                if (hasMultipleServiceFees && serviceFeeId) {
                  suffixes.push(`Fee ${serviceFeeId}`);
                }
                if (hasMultipleFrequencies) {
                  suffixes.push(frequency.charAt(0).toUpperCase() + frequency.slice(1));
                }
                if (suffixes.length > 0) {
                  scheduleName = `${scheduleName} - ${suffixes.join(' - ')}`;
                }
              }
              
              schedulesToCreate.push({
                schedule_name: scheduleName,
                tower: towerId ? parseInt(towerId) : null,
                service_fee: serviceFeeId ? parseInt(serviceFeeId) : null,
                generation_day: dateObj.getDate(), // Day of month (1-31)
                generation_hour: hours,
                generation_minute: minutes,
                recurring_frequency: frequency,
                is_recurring: formData.is_recurring,
                status: formData.status
              });
            }
          }
        }

        // Create multiple schedules if needed
        const promises = schedulesToCreate.map(payload =>
          axiosInstance.post('/api/service-fee-management/generation-schedules/', payload)
        );
        const responses = await Promise.all(promises);
        response = {
          data: {
            success: responses.every(r => r.data.success),
            message: `Successfully created ${responses.length} schedule(s)`,
            data: responses.map(r => r.data.data)
          }
        };
      }

      if (response.data.success) {
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      } else {
        setErrors({ submit: response.data.message || 'Failed to save schedule' });
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.errors || 
                          'Unable to save the schedule. Please try again.';
      setErrors({ submit: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto" style={{ overflow: 'hidden' }}>
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl relative max-h-[95vh] flex flex-col" style={{ overflow: 'visible', position: 'relative' }}>
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute -top-2 -right-2 p-2 rounded-full bg-primary text-white shadow-md hover:bg-primaryHover transition z-20"
            >
              <RxCross1 />
            </button>

            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">
                {schedule ? 'Edit Schedule Configuration' : 'Create Schedule Configuration'}
              </h2>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto overflow-x-visible relative">
              <form onSubmit={handleSubmit} className="p-4 relative">
                {/* Schedule Name */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Schedule Name <span className="text-primary text-lg">*</span>
                  </label>
                  <input
                    type="text"
                    name="schedule_name"
                    value={formData.schedule_name}
                    onChange={handleChange}
                    placeholder="e.g., Tower 1 Monthly Generation"
                    className={`w-full h-[42px] pl-3 pr-3 border rounded-md focus:outline-none text-sm transition-all duration-200 ${
                      errors.schedule_name ? 'border-red-500' : 'border-borderNeutral bg-surfaceMuted hover:border-borderMid hover:bg-white focus:border-primary focus:bg-white focus:shadow-[0_0_0_3px_rgba(60,157,155,0.15)]'
                    }`}
                  />
                  {errors.schedule_name && (
                    <p className="mt-1 text-xs text-red-600">{errors.schedule_name}</p>
                  )}
                </div>

                {/* Tower Selection - Multi-select with checkboxes */}
                <div className="mb-4 multi-select-dropdown relative z-50">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tower
                  </label>
                  <div className="relative z-50">
                    <button
                      ref={towerButtonRef}
                      type="button"
                      onClick={() => {
                        setShowTowerDropdown(!showTowerDropdown);
                        setShowServiceFeeDropdown(false);
                        setShowRecurringFrequencyDropdown(false);
                      }}
                      className={`w-full h-[42px] pl-3 pr-3 border rounded-md focus:outline-none text-sm text-left flex items-center justify-between transition-all duration-200 ${
                        errors.towers ? 'border-red-500' : showTowerDropdown ? 'border-primary bg-white shadow-[0_0_0_3px_rgba(60,157,155,0.15)]' : 'border-borderNeutral bg-surfaceMuted hover:border-borderMid hover:bg-white'
                      }`}
                      disabled={loadingTowers}
                    >
                      <span className="flex-1">
                        {formData.towers.length === 0
                          ? 'Select Towers'
                          : formData.towers.length === 1
                          ? towers.find(t => t.id === formData.towers[0])?.tower_name || '1 tower selected'
                          : `${formData.towers.length} towers selected`}
                      </span>
                      <svg className="w-5 h-5 ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {showTowerDropdown && createPortal(
                      <div 
                        className="fixed z-[99999] bg-white border border-primary rounded-md shadow-xl flex flex-col dropdown-portal"
                        style={{ 
                          top: `${towerDropdownPosition.top}px`,
                          left: `${towerDropdownPosition.left}px`,
                          width: `${towerDropdownPosition.width}px`,
                          maxHeight: '240px',
                          position: 'fixed'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="p-2 border-b border-gray-200 flex-shrink-0">
                          <label 
                            className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={formData.towers.length === towers.length && towers.length > 0}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleSelectAllTowers();
                                }}
                                className="sr-only"
                              />
                              <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                                formData.towers.length === towers.length && towers.length > 0
                                  ? 'bg-primary border-primary'
                                  : 'border-gray-300 bg-white'
                              }`}>
                                {formData.towers.length === towers.length && towers.length > 0 && (
                                  <MdCheck className="w-3 h-3 text-white" />
                                )}
                              </div>
                            </div>
                            <span className="text-sm font-medium text-primary">Select All</span>
                          </label>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                          {loadingTowers ? (
                            <div className="p-2 text-center text-gray-500 text-sm">Loading towers...</div>
                          ) : towers.length === 0 ? (
                            <div className="p-2 text-center text-gray-500 text-sm">No towers available</div>
                          ) : (
                            towers.map(tower => {
                              const isChecked = formData.towers.includes(String(tower.id));
                              return (
                                <label
                                  key={tower.id}
                                  className="flex items-center space-x-2 p-2 hover:bg-[#EBF5F5] rounded cursor-pointer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="relative">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        handleTowerToggle(String(tower.id));
                                      }}
                                      className="sr-only"
                                    />
                                    <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                                      isChecked
                                        ? 'bg-primary border-primary'
                                        : 'border-gray-300 bg-white'
                                    }`}>
                                      {isChecked && (
                                        <MdCheck className="w-3 h-3 text-white" />
                                      )}
                                    </div>
                                  </div>
                                  <span className="text-sm text-gray-700">{tower.tower_name}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                        <div className="p-2 border-t border-gray-200 flex justify-end gap-2 flex-shrink-0 bg-white">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormData(prev => ({ ...prev, towers: [] }));
                              setServiceFees([]);
                            }}
                            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const ids = (formData.towers || []).map(id => parseInt(id)).filter(Boolean);
                              if (ids.length > 0) {
                                loadServiceFees(ids);
                              } else {
                                setServiceFees([]);
                              }
                              setShowTowerDropdown(false);
                            }}
                            className="px-3 py-1.5 text-sm bg-primary text-white hover:bg-primaryHover rounded"
                          >
                            Done
                          </button>
                        </div>
                      </div>,
                      document.body
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Select one or more towers (leave empty for all towers)</p>
                </div>

                {/* Service Fee Selection - Multi-select with checkboxes */}
                <div className="mb-4 multi-select-dropdown relative z-50">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service Fee
                  </label>
                  <div className="relative z-50">
                    <button
                      ref={serviceFeeButtonRef}
                      type="button"
                      onClick={() => {
                        if (formData.towers.length === 0) return; // prevent opening when no towers selected
                        setShowServiceFeeDropdown(!showServiceFeeDropdown);
                        setShowTowerDropdown(false);
                        setShowRecurringFrequencyDropdown(false);
                      }}
                      className={`w-full h-[42px] pl-3 pr-3 border rounded-md focus:outline-none text-sm text-left flex items-center justify-between transition-all duration-200 ${
                        errors.service_fees ? 'border-red-500' : showServiceFeeDropdown ? 'border-primary bg-white shadow-[0_0_0_3px_rgba(60,157,155,0.15)]' : 'border-borderNeutral bg-surfaceMuted hover:border-borderMid hover:bg-white'
                      }`}
                      disabled={loadingServiceFees}
                    >
                      <span className="flex-1">
                        {formData.towers.length === 0
                          ? 'Select Towers first'
                          : formData.service_fees.length === 0
                          ? 'Select Service Fees'
                          : formData.service_fees.length === 1
                          ? (() => {
                              const selectedFee = serviceFees.find(f => String(f.id) === String(formData.service_fees[0]));
                              return selectedFee 
                                ? `${selectedFee.fee_amount || ''}`
                                : '1 service fee selected';
                            })()
                          : `${formData.service_fees.length} service fees selected`}
                      </span>
                      <svg className="w-5 h-5 ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {showServiceFeeDropdown && createPortal(
                      <div 
                        className="fixed z-[99999] bg-white border border-primary rounded-md shadow-xl flex flex-col dropdown-portal"
                        style={{ 
                          top: `${serviceFeeDropdownPosition.top}px`,
                          left: `${serviceFeeDropdownPosition.left}px`,
                          width: `${serviceFeeDropdownPosition.width}px`,
                          maxHeight: '240px',
                          position: 'fixed'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="p-2 border-b border-gray-200 flex-shrink-0">
                          <label 
                            className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={areAllFilteredServiceFeesSelected()}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleSelectAllServiceFees();
                                }}
                                className="sr-only"
                              />
                              <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                                areAllFilteredServiceFeesSelected()
                                  ? 'bg-primary border-primary'
                                  : 'border-gray-300 bg-white'
                              }`}>
                                {areAllFilteredServiceFeesSelected() && (
                                  <MdCheck className="w-3 h-3 text-white" />
                                )}
                              </div>
                            </div>
                            <span className="text-sm font-medium text-primary">Select All</span>
                          </label>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                          {loadingServiceFees ? (
                            <div className="p-2 text-center text-gray-500 text-sm">Loading service fees...</div>
                          ) : serviceFees.length === 0 ? (
                            <div className="p-2 text-center text-gray-500 text-sm">No service fees available</div>
                          ) : (() => {
                            const { grouped, sortedTowerNames } = getGroupedServiceFees();
                            return sortedTowerNames.map(towerName => {
                              const feesInTower = grouped[towerName];
                              return (
                                <div key={towerName} className="mb-2">
                                  {/* Tower Header */}
                                  <div className="px-2 py-1 bg-gray-100 text-xs font-semibold text-gray-700 sticky top-0 z-10">
                                    {towerName}
                                  </div>
                                  {/* Service Fees in this Tower */}
                                  {feesInTower.map(fee => {
                                    const isChecked = formData.service_fees.includes(String(fee.id));
                                    return (
                                      <label
                                        key={fee.id}
                                        className="flex items-center space-x-2 p-2 pl-4 hover:bg-[#EBF5F5] rounded cursor-pointer"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="relative">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) => {
                                              e.stopPropagation();
                                              handleServiceFeeToggle(String(fee.id));
                                            }}
                                            className="sr-only"
                                          />
                                          <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                                            isChecked
                                              ? 'bg-primary border-primary'
                                              : 'border-gray-300 bg-white'
                                          }`}>
                                            {isChecked && (
                                              <MdCheck className="w-3 h-3 text-white" />
                                            )}
                                          </div>
                                        </div>
                                        <span className="text-sm text-gray-700">
                                          {fee.fee_amount} {fee.tower_names?.length > 1 ? `(${fee.tower_names.length} towers)` : ''}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              );
                            });
                          })()}
                        </div>
                        <div className="p-2 border-t border-gray-200 flex justify-end gap-2 flex-shrink-0 bg-white">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormData(prev => ({ ...prev, service_fees: [] }));
                            }}
                            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowServiceFeeDropdown(false);
                            }}
                            className="px-3 py-1.5 text-sm bg-primary text-white hover:bg-primaryHover rounded"
                          >
                            Done
                          </button>
                        </div>
                      </div>,
                      document.body
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Select one or more service fees (leave empty for all service fees)</p>
                </div>

                {/* Date and Time */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Generation Day */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Generation Day <span className="text-primary text-lg">*</span>
                    </label>
                    <select
                      name="generation_day"
                      value={formData.generation_date ? new Date(formData.generation_date).getDate() : (schedule?.generation_day || '')}
                      onChange={(e) => {
                        const day = parseInt(e.target.value);
                        if (!day || day < 1 || day > 31) {
                          setErrors(prev => ({ ...prev, generation_date: 'Please select a valid day (1-31)' }));
                          return;
                        }
                        const today = new Date();
                        const newDate = new Date(today.getFullYear(), today.getMonth(), day);
                        setFormData(prev => ({
                          ...prev,
                          generation_date: newDate.toISOString().split('T')[0]
                        }));
                        // Clear error if valid
                        if (errors.generation_date) {
                          setErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.generation_date;
                            return newErrors;
                          });
                        }
                      }}
                      className={`w-full h-[42px] pl-3 pr-3 border rounded-md focus:outline-none text-sm transition-all duration-200 ${
                        errors.generation_date ? 'border-red-500' : 'border-borderNeutral bg-surfaceMuted hover:border-borderMid hover:bg-white focus:border-primary focus:bg-white focus:shadow-[0_0_0_3px_rgba(60,157,155,0.15)]'
                      }`}
                    >
                      <option value="">Select Day</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>
                          Day {day}
                        </option>
                      ))}
                    </select>
                    {errors.generation_date && (
                      <p className="mt-1 text-xs text-red-600">{errors.generation_date}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">Day of month (1-31)</p>
                  </div>

                  {/* Generation Time */}
                  <div
                    onClick={() => {
                      // Clicking anywhere in the block opens the native time picker
                      if (timeInputRef.current) {
                        // showPicker is supported by modern Chromium
                        try {
                          if (typeof timeInputRef.current.showPicker === 'function') {
                            timeInputRef.current.showPicker();
                          } else {
                            timeInputRef.current.focus();
                          }
                        } catch {
                          timeInputRef.current.focus();
                        }
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Generation Time <span className="text-primary text-lg">*</span>
                    </label>
                    <input
                      type="time"
                      name="generation_time"
                      value={formData.generation_time}
                      onChange={handleChange}
                      className={`w-full h-[42px] pl-3 pr-3 border rounded-md focus:outline-none text-sm transition-all duration-200 ${
                        errors.generation_time ? 'border-red-500' : 'border-borderNeutral bg-surfaceMuted hover:border-borderMid hover:bg-white focus:border-primary focus:bg-white focus:shadow-[0_0_0_3px_rgba(60,157,155,0.15)]'
                      }`}
                    />
                    {errors.generation_time && (
                      <p className="mt-1 text-xs text-red-600">{errors.generation_time}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">Hour:Minute (24-hour format)</p>
                  </div>
                </div>

                {/* Recurring Options - Multi-select with checkboxes */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recurring Frequency
                  </label>
                  <div className="flex items-center gap-4 mb-2">
                    <label className="flex items-center cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          name="is_recurring"
                          checked={formData.is_recurring}
                          onChange={handleChange}
                          className="sr-only"
                        />
                        <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                          formData.is_recurring
                            ? 'bg-primary border-primary'
                            : 'border-gray-300 bg-white'
                        }`}>
                          {formData.is_recurring && (
                            <MdCheck className="w-3 h-3 text-white" />
                          )}
                        </div>
                      </div>
                      <span className="ml-2 text-sm text-gray-700">Enable Recurring</span>
                    </label>
                  </div>
                  {formData.is_recurring && (
                    <div className="multi-select-dropdown relative z-50">
                      <div className="relative z-50">
                        <button
                          ref={recurringFrequencyButtonRef}
                          type="button"
                          onClick={() => {
                            setShowRecurringFrequencyDropdown(!showRecurringFrequencyDropdown);
                            setShowTowerDropdown(false);
                            setShowServiceFeeDropdown(false);
                          }}
                          className={`w-full h-[42px] pl-3 pr-3 border rounded-md focus:outline-none text-sm text-left flex items-center justify-between transition-all duration-200 ${
                            showRecurringFrequencyDropdown ? 'border-primary bg-white shadow-[0_0_0_3px_rgba(60,157,155,0.15)]' : 'border-borderNeutral bg-surfaceMuted hover:border-borderMid hover:bg-white'
                          }`}
                        >
                          <span className="flex-1">
                            {formData.recurring_frequencies.length === 0
                              ? 'Select Recurring Frequencies'
                              : formData.recurring_frequencies.length === 1
                              ? recurringFrequencyOptions.find(f => f.value === formData.recurring_frequencies[0])?.label || '1 frequency selected'
                              : `${formData.recurring_frequencies.length} frequencies selected`}
                          </span>
                          <svg className="w-5 h-5 ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {showRecurringFrequencyDropdown && createPortal(
                          <div 
                            className="fixed z-[9999] bg-white border border-primary rounded-md shadow-xl flex flex-col dropdown-portal"
                            style={{ 
                              top: `${recurringFrequencyDropdownPosition.top}px`,
                              left: `${recurringFrequencyDropdownPosition.left}px`,
                              width: `${recurringFrequencyDropdownPosition.width}px`,
                              maxHeight: '240px'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="p-2 border-b border-gray-200 flex-shrink-0">
                              <label 
                                className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="relative">
                                  <input
                                    type="checkbox"
                                    checked={formData.recurring_frequencies.length === recurringFrequencyOptions.length && recurringFrequencyOptions.length > 0}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      handleSelectAllRecurringFrequencies();
                                    }}
                                    className="sr-only"
                                  />
                                  <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                                    formData.recurring_frequencies.length === recurringFrequencyOptions.length && recurringFrequencyOptions.length > 0
                                      ? 'bg-primary border-primary'
                                      : 'border-gray-300 bg-white'
                                  }`}>
                                    {formData.recurring_frequencies.length === recurringFrequencyOptions.length && recurringFrequencyOptions.length > 0 && (
                                      <MdCheck className="w-3 h-3 text-white" />
                                    )}
                                  </div>
                                </div>
                                <span className="text-sm font-medium text-primary">Select All</span>
                              </label>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2">
                              {recurringFrequencyOptions.map(frequency => {
                                const isChecked = formData.recurring_frequencies.includes(frequency.value);
                                return (
                                  <label
                                    key={frequency.value}
                                    className="flex items-center space-x-2 p-2 hover:bg-[#EBF5F5] rounded cursor-pointer"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="relative">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          handleRecurringFrequencyToggle(frequency.value);
                                        }}
                                        className="sr-only"
                                      />
                                      <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                                        isChecked
                                          ? 'bg-primary border-primary'
                                          : 'border-gray-300 bg-white'
                                      }`}>
                                        {isChecked && (
                                          <MdCheck className="w-3 h-3 text-white" />
                                        )}
                                      </div>
                                    </div>
                                    <span className="text-sm text-gray-700">{frequency.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <div className="p-2 border-t border-gray-200 flex justify-end gap-2 flex-shrink-0 bg-white">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFormData(prev => ({ ...prev, recurring_frequencies: [] }));
                                }}
                                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                              >
                                Clear
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowRecurringFrequencyDropdown(false);
                                }}
                                className="px-3 py-1.5 text-sm bg-primary text-white hover:bg-primaryHover rounded"
                              >
                                Done
                              </button>
                            </div>
                          </div>,
                          document.body
                        )}
                      </div>
                    </div>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Select one or more recurring frequencies (currently supports monthly generation)
                  </p>
                </div>

                {/* Status - Checkbox */}
                <div className="mb-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        name="status"
                        checked={formData.status === 'active'}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev,
                            status: e.target.checked ? 'active' : 'inactive'
                          }));
                        }}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                        formData.status === 'active'
                          ? 'bg-primary border-primary'
                          : 'border-gray-300 bg-white'
                      }`}>
                        {formData.status === 'active' && (
                          <MdCheck className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                  <p className="mt-1 text-xs text-gray-500">Uncheck to set status as inactive</p>
                </div>

                {/* Error Message */}
                {errors.submit && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{errors.submit}</p>
                  </div>
                )}

                {/* Modal Footer */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 text-sm bg-primary text-white rounded-md hover:bg-primaryHover transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FaSave className="w-4 h-4" />
                    {loading ? 'Saving...' : schedule ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ScheduleConfigurationForm;

