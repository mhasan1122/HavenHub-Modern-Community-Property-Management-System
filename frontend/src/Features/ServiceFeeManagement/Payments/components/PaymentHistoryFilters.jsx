import PropTypes from 'prop-types';
import { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { FaSearch, FaTimes } from 'react-icons/fa';
import { BiFilter } from 'react-icons/bi';
import { FaCaretDown } from 'react-icons/fa6';
import axiosInstance from '../../../../utils/axiosInstance';

const PaymentHistoryFilters = ({
    searchQuery,
    selectedTowers,
    selectedMethods,
    selectedUnits,
    minAmount,
    maxAmount,
    advanceFilter,
    onChange,
    onClearAll,
    totalCount = 0
}) => {
    const { towers } = useSelector((state) => state.tower);
    const { filterOptions } = useSelector((state) => state.serviceFeeManagement);

    // Use payment_methods from API response (fallback to empty)
    const paymentMethods = filterOptions?.payment_methods || [];

    // Use towers for display, falling back to filterOptions if towers state is empty
    const displayTowers = (towers && towers.length > 0) ? towers : (filterOptions?.towers || []);

    const [openDropdown, setOpenDropdown] = useState(null);
    const [tempSelections, setTempSelections] = useState({});
    const [unitOptions, setUnitOptions] = useState([]);
    const dropdownRef = useRef(null);

    // Fetch units dynamically based on selected towers
    useEffect(() => {
        const fetchFiltersUnits = async () => {
            try {
                const params = {};
                if (selectedTowers && selectedTowers.length > 0) {
                    // Pass selected tower IDs to filter units server-side
                    params.tower_ids = selectedTowers.join(',');
                }
                const response = await axiosInstance.get('/api/service-fee-management/filter-options-units/', { params });
                if (response.data.success) {
                    setUnitOptions(response.data.data);
                }
            } catch (error) {
                console.error('Failed to fetch units for filter:', error);
                setUnitOptions([]);
            }
        };

        fetchFiltersUnits();
    }, [selectedTowers]);

    const advanceOptions = [
        { value: 'all', label: 'All Payments' },
        { value: 'with_advance', label: 'With Advance' },
        { value: 'without_advance', label: 'Without Advance' }
    ];

    // Handle checkbox changes
    const handleCheckboxChange = (filterType, value, isChecked) => {
        setTempSelections(prev => {
            const current = prev[filterType] || [];
            if (isChecked) {
                return { ...prev, [filterType]: [...current, value] };
            } else {
                return { ...prev, [filterType]: current.filter(item => item !== value) };
            }
        });
    };

    // Handle Select All
    const handleSelectAll = (filterType, allOptions) => {
        const allValues = allOptions.map(opt => opt.value || opt.id);
        setTempSelections(prev => ({ ...prev, [filterType]: allValues }));
    };

    // Check if all selected
    const isAllSelected = (filterType, allOptions) => {
        const current = tempSelections[filterType] || [];
        return allOptions?.length > 0 && current.length === allOptions.length;
    };

    // Get display text
    const getDisplayText = (selectedItems, defaultText) => {
        if (!selectedItems || selectedItems.length === 0) {
            return defaultText;
        }
        return `${defaultText} (${selectedItems.length})`;
    };

    // Handle Done
    const handleDone = (filterType) => {
        const keyMap = {
            towers: 'selectedTowers',
            methods: 'selectedMethods',
            units: 'selectedUnits'
        };

        onChange(keyMap[filterType], tempSelections[filterType]);
        setOpenDropdown(null);
    };

    // Handle Clear
    const handleClear = (filterType) => {
        setTempSelections(prev => ({ ...prev, [filterType]: [] }));
        const keyMap = {
            towers: 'selectedTowers',
            methods: 'selectedMethods',
            units: 'selectedUnits'
        };
        onChange(keyMap[filterType], []);
        setOpenDropdown(null);
    };

    // Initialize temp selections when dropdown opens
    const handleDropdownOpen = (filterType) => {
        const currentValue = {
            towers: selectedTowers,
            methods: selectedMethods,
            units: selectedUnits
        }[filterType] || [];

        setTempSelections(prev => ({ ...prev, [filterType]: currentValue }));
        setOpenDropdown(openDropdown === filterType ? null : filterType);
    };

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setOpenDropdown(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Count active filters
    const activeFiltersCount = [
        searchQuery ? 1 : 0,
        selectedTowers?.length || 0,
        selectedMethods?.length || 0,
        selectedUnits?.length || 0,
        minAmount ? 1 : 0,
        maxAmount ? 1 : 0,
        advanceFilter !== 'all' ? 1 : 0
    ].reduce((a, b) => a + b, 0);

    return (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 mb-6" ref={dropdownRef}>
            {/* Header Section */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <BiFilter className="w-5 h-5 text-gray-700" />
                        <span className="text-lg font-bold text-gray-900">Filters</span>
                    </div>
                    {(totalCount > 0 || activeFiltersCount > 0) && (
                        <div className="px-3 py-1 bg-gray-50 border border-gray-200 rounded-full">
                            <span className="text-xs font-bold text-gray-600">
                                {totalCount} {totalCount === 1 ? 'payment' : 'payments'} found
                            </span>
                        </div>
                    )}
                </div>
                {activeFiltersCount > 0 && (
                    <button
                        onClick={onClearAll}
                        className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-red-600 transition-colors"
                    >
                        <FaTimes className="w-3 h-3" />
                        Clear All
                    </button>
                )}
            </div>

            {/* Body Section */}
            <div className="space-y-6">
                {/* Search Bar - Full Width */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                        Search by Receipt Number or Transaction ID
                    </label>
                    <div className="relative group">
                        <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Enter receipt or transaction ID..."
                            value={searchQuery}
                            onChange={(e) => onChange('searchQuery', e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-gray-400 text-gray-700 font-medium"
                        />
                    </div>
                </div>

                {/* Grid Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Tower Filter */}
                    <div className="relative">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Tower</label>
                        <button
                            type="button"
                            onClick={() => handleDropdownOpen('towers')}
                            className={`w-full h-12 px-4 bg-gray-50 border border-transparent rounded-xl flex items-center justify-between transition-all group hover:bg-gray-100 ${openDropdown === 'towers'
                                ? 'bg-white !border-primary ring-4 ring-primary/10'
                                : ''
                                }`}
                        >
                            <span className={`truncate font-medium ${selectedTowers.length > 0 ? 'text-primary' : 'text-gray-600'}`}>
                                {getDisplayText(selectedTowers, 'All Towers')}
                            </span>
                            <FaCaretDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${openDropdown === 'towers' ? 'rotate-180 text-primary' : ''}`} />
                        </button>

                        {openDropdown === 'towers' && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[280px]">
                                <div className="max-h-64 overflow-y-auto pt-2 pb-1">
                                    <label className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer group transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={isAllSelected('towers', displayTowers)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    handleSelectAll('towers', displayTowers);
                                                } else {
                                                    setTempSelections(prev => ({ ...prev, towers: [] }));
                                                }
                                            }}
                                            className="w-5 h-5 text-primary focus:ring-primary accent-primary rounded cursor-pointer border-gray-300"
                                        />
                                        <span className="ml-4 text-[15px] font-bold text-[#374151]">Select All</span>
                                    </label>
                                    <div className="h-px bg-gray-100 mx-4 mb-1"></div>
                                    {displayTowers.map((tower) => (
                                        <label key={tower.id || tower.value} className="flex items-center px-4 py-2.5 hover:bg-gray-50 cursor-pointer group transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={(tempSelections.towers || []).includes(tower.value || tower.id)}
                                                onChange={(e) => handleCheckboxChange('towers', tower.value || tower.id, e.target.checked)}
                                                className="w-5 h-5 text-primary focus:ring-primary accent-primary rounded cursor-pointer border-gray-300"
                                            />
                                            <span className="ml-4 text-[15px] text-[#4B5563] group-hover:text-gray-900">{tower.name || tower.label || tower.tower_name}</span>
                                        </label>
                                    ))}
                                </div>
                                <div className="flex justify-between gap-3 p-4 bg-white border-t border-gray-100">
                                    <button
                                        onClick={() => handleClear('towers')}
                                        className="px-6 py-2 text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                    >
                                        Clear
                                    </button>
                                    <button
                                        onClick={() => handleDone('towers')}
                                        className="px-8 py-2 text-sm font-bold bg-primary text-white rounded-lg hover:bg-primaryHover shadow-sm transition-colors"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Unit Filter */}
                    <div className="relative">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Unit</label>
                        <button
                            type="button"
                            onClick={() => handleDropdownOpen('units')}
                            className={`w-full h-12 px-4 bg-gray-50 border border-transparent rounded-xl flex items-center justify-between transition-all group hover:bg-gray-100 ${openDropdown === 'units'
                                ? 'bg-white !border-primary ring-4 ring-primary/10'
                                : ''
                                }`}
                        >
                            <span className={`truncate font-medium ${selectedUnits.length > 0 ? 'text-primary' : 'text-gray-600'}`}>
                                {getDisplayText(selectedUnits, 'All Units')}
                            </span>
                            <FaCaretDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${openDropdown === 'units' ? 'rotate-180 text-primary' : ''}`} />
                        </button>

                        {openDropdown === 'units' && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[280px]">
                                {unitOptions.length > 0 ? (
                                    <>
                                        <div className="max-h-64 overflow-y-auto pt-2 pb-1">
                                            <label className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer group transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={isAllSelected('units', unitOptions)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            handleSelectAll('units', unitOptions);
                                                        } else {
                                                            setTempSelections(prev => ({ ...prev, units: [] }));
                                                        }
                                                    }}
                                                    className="w-5 h-5 text-primary focus:ring-primary accent-primary rounded cursor-pointer border-gray-300"
                                                />
                                                <span className="ml-4 text-[15px] font-bold text-[#374151]">Select All</span>
                                            </label>
                                            <div className="h-px bg-gray-100 mx-4 mb-1"></div>
                                            {unitOptions.map((unit) => (
                                                <label key={unit.value} className="flex items-center px-4 py-2.5 hover:bg-gray-50 cursor-pointer group transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={(tempSelections.units || []).includes(unit.value)}
                                                        onChange={(e) => handleCheckboxChange('units', unit.value, e.target.checked)}
                                                        className="w-5 h-5 text-primary focus:ring-primary accent-primary rounded cursor-pointer border-gray-300"
                                                    />
                                                    <span className="ml-4 text-[15px] text-[#4B5563] group-hover:text-gray-900">{unit.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                        <div className="flex justify-between gap-3 p-4 bg-white border-t border-gray-100">
                                            <button
                                                onClick={() => handleClear('units')}
                                                className="px-6 py-2 text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                            >
                                                Clear
                                            </button>
                                            <button
                                                onClick={() => handleDone('units')}
                                                className="px-8 py-2 text-sm font-bold bg-primary text-white rounded-lg hover:bg-primaryHover shadow-sm transition-colors"
                                            >
                                                Done
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-8 text-sm text-gray-400 text-center font-medium italic">No units found</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Payment Method Filter */}
                    <div className="relative">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Payment Method</label>
                        <button
                            type="button"
                            onClick={() => handleDropdownOpen('methods')}
                            className={`w-full h-12 px-4 bg-gray-50 border border-transparent rounded-xl flex items-center justify-between transition-all group hover:bg-gray-100 ${openDropdown === 'methods'
                                ? 'bg-white !border-primary ring-4 ring-primary/10'
                                : ''
                                }`}
                        >
                            <span className={`truncate font-medium ${selectedMethods.length > 0 ? 'text-primary' : 'text-gray-600'}`}>
                                {getDisplayText(selectedMethods, 'All Methods')}
                            </span>
                            <FaCaretDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${openDropdown === 'methods' ? 'rotate-180 text-primary' : ''}`} />
                        </button>

                        {openDropdown === 'methods' && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[280px]">
                                <div className="max-h-64 overflow-y-auto pt-2 pb-1">
                                    <label className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer group transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={isAllSelected('methods', paymentMethods)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    handleSelectAll('methods', paymentMethods);
                                                } else {
                                                    setTempSelections(prev => ({ ...prev, methods: [] }));
                                                }
                                            }}
                                            className="w-5 h-5 text-primary focus:ring-primary accent-primary rounded cursor-pointer border-gray-300"
                                        />
                                        <span className="ml-4 text-[15px] font-bold text-[#374151]">Select All</span>
                                    </label>
                                    <div className="h-px bg-gray-100 mx-4 mb-1"></div>
                                    {paymentMethods.map((method) => (
                                        <label key={method.value} className="flex items-center px-4 py-2.5 hover:bg-gray-50 cursor-pointer group transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={(tempSelections.methods || []).includes(method.value)}
                                                onChange={(e) => handleCheckboxChange('methods', method.value, e.target.checked)}
                                                className="w-5 h-5 text-primary focus:ring-primary accent-primary rounded cursor-pointer border-gray-300"
                                            />
                                            <span className="ml-4 text-[15px] text-[#4B5563] group-hover:text-gray-900">{method.label}</span>
                                        </label>
                                    ))}
                                </div>
                                <div className="flex justify-between gap-3 p-4 bg-white border-t border-gray-100">
                                    <button
                                        onClick={() => handleClear('methods')}
                                        className="px-6 py-2 text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                    >
                                        Clear
                                    </button>
                                    <button
                                        onClick={() => handleDone('methods')}
                                        className="px-8 py-2 text-sm font-bold bg-primary text-white rounded-lg hover:bg-primaryHover shadow-sm transition-colors"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Second Row Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Advances Filter */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Advances</label>
                        <div className="relative group">
                            <select
                                value={advanceFilter}
                                onChange={(e) => onChange('advanceFilter', e.target.value)}
                                className="w-full h-12 pl-4 pr-10 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none text-gray-700 font-medium cursor-pointer"
                            >
                                {advanceOptions.map(option => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <FaCaretDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none transition-colors group-focus-within:text-primary" />
                        </div>
                    </div>

                    {/* Min Amount */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Min Amount (৳)</label>
                        <input
                            type="number"
                            placeholder="0"
                            value={minAmount}
                            onChange={(e) => onChange('minAmount', e.target.value)}
                            className="w-full h-12 px-4 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-gray-400 text-gray-700 font-bold"
                        />
                    </div>

                    {/* Max Amount */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Max Amount (৳)</label>
                        <input
                            type="number"
                            placeholder="Unlimited"
                            value={maxAmount}
                            onChange={(e) => onChange('maxAmount', e.target.value)}
                            className="w-full h-12 px-4 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-gray-400 text-gray-700 font-bold"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

PaymentHistoryFilters.propTypes = {
    searchQuery: PropTypes.string,
    selectedTowers: PropTypes.array,
    selectedMethods: PropTypes.array,
    selectedUnits: PropTypes.array,
    minAmount: PropTypes.string,
    maxAmount: PropTypes.string,
    advanceFilter: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    onClearAll: PropTypes.func.isRequired,
    totalCount: PropTypes.number
};

export default PaymentHistoryFilters;
