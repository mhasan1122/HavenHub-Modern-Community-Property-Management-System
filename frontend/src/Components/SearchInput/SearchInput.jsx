import React, { useState, useEffect } from 'react';
import { BiSearch } from 'react-icons/bi';
import { MdClose } from 'react-icons/md';

/**
 * A reusable debounced search input component.
 * @param {string} value - The current search value (controlled).
 * @param {function} onChange - Callback fired when value changes (after debounce).
 * @param {string} placeholder - Placeholder text.
 * @param {number} debounceTime - Time in ms to wait before firing onChange.
 * @param {string} className - Additional CSS classes for the container.
 * @param {string} inputClassName - Additional CSS classes for the input.
 */
const SearchInput = ({
    value,
    onChange,
    placeholder = "Search...",
    className = "",
    inputClassName = ""
}) => {
    const [displayValue, setDisplayValue] = useState(value || "");

    // Update local state if prop changes from outside
    useEffect(() => {
        if (value !== displayValue) {
            setDisplayValue(value || "");
        }
    }, [value]);

    // Debounced execution of onChange
    useEffect(() => {
        // Skip the first run if value is initial empty string
        if (displayValue === value) return;

        onChange(displayValue);

    }, [displayValue, onChange]);

    const handleClear = () => {
        setDisplayValue("");
        onChange("");
    };

    return (
        <div className={`relative ${className}`}>
            <BiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary w-4 h-4 pointer-events-none z-10" />

            <input
                type="text"
                placeholder={placeholder}
                className={`w-full h-[42px] pl-10 pr-10 border border-primary rounded-lg focus:outline-none focus:border-primary focus:shadow-ring-primary text-sm text-primary placeholder:text-sm placeholder-primary bg-white transition-all ${inputClassName}`}
                value={displayValue}
                onChange={(e) => setDisplayValue(e.target.value)}
            />

            {displayValue && (
                <button
                    type="button"
                    onClick={handleClear}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-primary transition-colors focus:outline-none z-10 p-1"
                    aria-label="Clear search"
                >
                    <MdClose className="w-5 h-5" />
                </button>
            )}
        </div>
    );
};

export default SearchInput;
