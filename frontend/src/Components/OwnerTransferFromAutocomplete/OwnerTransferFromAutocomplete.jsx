import React, { useState, useEffect, useRef } from "react";
import { FaSearch, FaTimes, FaCaretDown } from "react-icons/fa";
import { formatDate } from "../../Features/TowersAndUnits/Owner/utils/ownerUtils";

// Format display value with ownership percentage
const formatDisplayValue = (owner) => {
  if (!owner) return "";
  const percentage = owner.ownership_percentage || 0;
  return `${owner.member?.full_name || ""} (${percentage}% Ownership)`;
};

const OwnerTransferFromAutocomplete = ({
  value = "",
  memberId = "",
  onSelect,
  owners = [],
  disabled = false,
  hideClearButton = false,
  hideSearchIcon = false
}) => {
  const [searchTerm, setSearchTerm] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOwners, setFilteredOwners] = useState([]);
  const [selectedOwner, setSelectedOwner] = useState(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const justSelectedRef = useRef(false);

  // Update input from parent on mount or prop change
  useEffect(() => {
    if (value && memberId) {
      // Find the owner matching the memberId
      const owner = owners.find(o => o.member?.id === memberId);
      if (owner) {
        setSelectedOwner(owner);
        setSearchTerm(formatDisplayValue(owner));
      } else {
        setSearchTerm(value);
        setSelectedOwner(null);
      }
    } else {
      setSearchTerm(value);
      setSelectedOwner(null);
    }
  }, [value, memberId, owners]);

  // Filter owners based on search term
  useEffect(() => {
    if (disabled) {
      setFilteredOwners([]);
      setIsOpen(false);
      return;
    }

    // Don't auto-open if we just made a selection
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    if (!searchTerm.trim()) {
      // Show all owners when search is empty (for dropdown display)
      setFilteredOwners(owners);
      // Don't auto-open when empty, only when focused
      return;
    }

    // When searching, remove the ownership percentage part for filtering
    const searchText = searchTerm.replace(/\s*\(\d+% Ownership\)\s*$/, "").trim();
    const searchLower = searchText.toLowerCase();
    const filtered = owners.filter((owner) => {
      const ownerName = owner.member?.full_name?.toLowerCase() || "";
      return ownerName.includes(searchLower);
    });

    setFilteredOwners(filtered);
    // Auto-open when there are filtered results
    if (filtered.length > 0) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [searchTerm, owners, disabled]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelect = (owner) => {
    if (disabled) return;
    
    const member = {
      id: owner.member.id,
      full_name: owner.member.full_name
    };
    
    // Mark that we just made a selection to prevent immediate reopening
    justSelectedRef.current = true;
    
    // Set selected owner and format display value with ownership percentage
    setSelectedOwner(owner);
    setSearchTerm(formatDisplayValue(owner));
    setIsOpen(false);
    setFilteredOwners([]);
    
    // Blur the input to ensure dropdown stays closed
    if (inputRef.current) {
      inputRef.current.blur();
    }
    
    if (onSelect) onSelect(member);
  };

  const handleClear = () => {
    if (disabled) return;
    setSearchTerm("");
    setSelectedOwner(null);
    setIsOpen(false);
    setFilteredOwners([]);
    if (onSelect) onSelect({ id: "", full_name: "" });
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    
    // If user is typing and it doesn't match the formatted value, clear selection
    if (selectedOwner && newValue !== formatDisplayValue(selectedOwner)) {
      setSelectedOwner(null);
    }
    
    // If input is cleared, clear selection
    if (!newValue.trim()) {
      setSelectedOwner(null);
      if (onSelect) onSelect({ id: "", full_name: "" });
    }
  };

  const handleInputFocus = () => {
    // Don't open if we just made a selection
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    
    if (!disabled && owners.length > 0) {
      setIsOpen(true);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        {/* Search Icon */}
        {!hideSearchIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none z-10">
            <FaSearch className="text-gray-400 w-4 h-4" />
          </div>
        )}

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder="Search owner..."
          disabled={disabled}
          className={`login-field-input w-full ${
            hideSearchIcon ? "pl-4" : "pl-10"
          } pr-10 ${disabled ? "bg-disabledInput cursor-not-allowed" : ""}`}
        />

        {/* Clear Button */}
        {!hideClearButton && searchTerm && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
          >
            <FaTimes className="w-4 h-4" />
          </button>
        )}

        {/* Dropdown Arrow */}
        {!searchTerm && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none z-10">
            <FaCaretDown className="text-gray-400 w-4 h-4" />
          </div>
        )}
      </div>

      {/* Dropdown List */}
      {isOpen && !disabled && filteredOwners.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredOwners.map((owner, index) => {
            const isSelected = owner.member?.id === memberId;
            return (
              <div
                key={owner.member?.id || index}
                onClick={() => handleSelect(owner)}
                className={`px-4 py-3 cursor-pointer hover:bg-primary hover:text-white group transition-colors ${
                  isSelected
                    ? "bg-primary text-white"
                    : "bg-white text-gray-900"
                }`}
              >
                <div className="flex flex-col">
                  <div className="font-medium text-sm">
                    {owner.member?.full_name || "Unknown Owner"}
                  </div>
                  <div className={`flex gap-4 mt-1 text-xs ${
                    isSelected
                      ? "text-white"
                      : "text-gray-600 group-hover:text-white"
                  }`}>
                    <span>
                      Ownership: {owner.ownership_percentage || 0}%
                    </span>
                    <span>
                      Start Date: {owner.date_of_ownership 
                        ? formatDate(owner.date_of_ownership) 
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No results message */}
      {isOpen && !disabled && searchTerm.trim() && filteredOwners.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
          <div className="px-4 py-3 text-gray-500 text-sm">
            No owners found
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerTransferFromAutocomplete;

