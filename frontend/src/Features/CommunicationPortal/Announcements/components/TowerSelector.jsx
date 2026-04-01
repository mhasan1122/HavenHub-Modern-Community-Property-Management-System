import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { FaCaretDown } from "react-icons/fa6";
import { useDispatch } from "react-redux";
import { fetchTowers } from "../../../../redux/slices/api/announcementApi";

const TowerSelector = ({
  value,
  onChange,
  placeholder = "Select Towers",
  multiSelect = true,
  hideAll = false,
  towers: externalTowers = null,
  showSelected = true,
  disabled = false
}) => {
  const dispatch = useDispatch();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState("bottom");
  const [towers, setTowers] = useState(externalTowers || []);
  const [loading, setLoading] = useState(!externalTowers);
  const [error, setError] = useState(null);
  const selectorRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch towers from backend if not provided externally
  useEffect(() => {
    if (externalTowers) {
      setTowers(externalTowers);
      setLoading(false);
      return;
    }

    const loadTowers = async () => {
      try {
        setLoading(true);
        const result = await dispatch(fetchTowers());
        if (fetchTowers.fulfilled.match(result)) {
          setTowers(result.payload);
          setError(null);
        } else {
          setError("Failed to load towers");
          // Fallback to dummy data if API fails
          setTowers([
            { id: 1, tower_name: "Tower 1", tower_number: 1 },
            { id: 2, tower_name: "Tower 2", tower_number: 2 },
            { id: 3, tower_name: "Tower 3", tower_number: 3 },
            { id: 4, tower_name: "Tower 4", tower_number: 4 },
            { id: 5, tower_name: "Tower 5", tower_number: 5 }
          ]);
        }
      } catch (err) {
        console.error("Error fetching towers:", err);
        setError("Failed to load towers");
        // Fallback to dummy data if API fails
        setTowers([
          { id: 1, tower_name: "Tower 1", tower_number: 1 },
          { id: 2, tower_name: "Tower 2", tower_number: 2 },
          { id: 3, tower_name: "Tower 3", tower_number: 3 },
          { id: 4, tower_name: "Tower 4", tower_number: 4 },
          { id: 5, tower_name: "Tower 5", tower_number: 5 }
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadTowers();
  }, [dispatch, externalTowers]);

  // Create tower options with or without 'All' option based on hideAll prop
  const regularTowers = towers.map((tower) => tower.id);
  const allTowers =
    towers.length > 0 && !hideAll ? ["All", ...regularTowers] : regularTowers;

  // Calculate dropdown position
  const calculatePosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 300;

      setDropdownPosition(
        spaceBelow < dropdownHeight && spaceAbove > spaceBelow
          ? "top"
          : "bottom"
      );
    }
  };

  useEffect(() => {
    if (isOpen) {
      calculatePosition();
      window.addEventListener("scroll", calculatePosition);
      window.addEventListener("resize", calculatePosition);

      return () => {
        window.removeEventListener("scroll", calculatePosition);
        window.removeEventListener("resize", calculatePosition);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Auto-add "All" when all individual towers are selected
  useEffect(() => {
    if (towers.length > 0 && value && value.length > 0 && !loading) {
      const regularTowers = towers.map((tower) => tower.id);
      const currentValues = value || [];

      // Check if all regular towers are selected but "All" is not in the array
      if (
        regularTowers.every((towerId) => currentValues.includes(towerId)) &&
        !currentValues.includes("All")
      ) {
        // Replace with just "All" marker instead of including all IDs
        onChange(["All"]);
      }
    }
  }, [towers, value, loading, onChange]);

  const handleTowerChange = (tower, isChecked) => {
    if (disabled) return;
    if (!multiSelect) {
      // Single select mode: just set the selected tower ID or empty string
      onChange(isChecked ? tower : "");
      setIsOpen(false); // Close dropdown after selection in single-select mode
      return;
    }

    // Multi-select mode logic
    const currentValues = value || [];

    if (tower === "All") {
      if (isChecked) {
        // When "All" is selected, store ONLY "All" marker
        // This tells the backend to send to ALL towers
        onChange(["All"]);
      } else {
        onChange([]);
      }
    } else {
      let newValues;
      if (isChecked) {
        newValues = [...currentValues.filter((v) => v !== "All"), tower];
        if (!hideAll && regularTowers.every((t) => newValues.includes(t))) {
          // Store only "All" marker when all towers are selected
          newValues = ["All"];
        }
      } else {
        newValues = currentValues.filter((v) => v !== tower && v !== "All");
      }
      onChange(newValues);
    }
  };

  // Helper function to get tower name by ID
  const getTowerName = (towerId) => {
    if (towerId === "All") return "All Towers";
    // Use String comparison to handle both numeric and string IDs
    const tower = towers.find((t) => String(t.id) === String(towerId));
    // Support both tower_name and name fields
    return tower ? tower.tower_name || tower.name : `Tower ${towerId}`;
  };

  const handleClearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  const getDisplayText = () => {
    if (!multiSelect) {
      // Single select mode
      if (!value) {
        return placeholder;
      }
      return getTowerName(value);
    }

    // Multi-select mode
    if (!value || value.length === 0) {
      return placeholder;
    }
    if (value.includes("All")) {
      return "All Towers Selected";
    }
    return `${value.length} Tower(s) Selected`;
  };

  const getSelectedDisplay = () => {
    if (!multiSelect) {
      // No display box for single select mode
      return null;
    }

    // Multi-select mode display
    if (!value || value.length === 0) {
      return null;
    }

    if (value.includes("All")) {
      return (
        <div className="mb-2 p-2 bg-primary bg-opacity-10 rounded-md border border-primary border-opacity-30">
          <div className="text-sm font-medium text-primary mb-1">
            Selected Towers:
          </div>
          <div className="text-sm text-gray-700">All Towers</div>
        </div>
      );
    }

    return (
      <div className="mb-2 p-2 bg-primary bg-opacity-10 rounded-md border border-primary border-opacity-30">
        <div className="text-sm font-medium text-primary mb-1">
          Selected Towers:
        </div>
        <div className="flex flex-wrap gap-1">
          {value
            .filter((tower) => tower !== "All")
            .map((towerId) => (
              <span
                key={towerId}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary text-white"
              >
                {getTowerName(towerId)}
              </span>
            ))}
        </div>
      </div>
    );
  };

  return (
    <div className="relative" ref={selectorRef}>
      {/* Selected Values Display */}
      {showSelected && getSelectedDisplay()}

      {/* Input Field */}
      <div
        ref={inputRef}
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
        }}
        className={`login-field-input !flex justify-between items-center gap-2 whitespace-nowrap !py-2 !px-4 !h-[42px] ${
          disabled
            ? "bg-disabledInput cursor-not-allowed opacity-80"
            : "cursor-pointer"
        } ${
          isOpen ? "!border-primary !bg-white !shadow-ring-primary" : "bg-white"
        }`}
      >
        <span
          className={`flex-1 truncate text-sm ${
            value && value.length > 0 ? "text-primary" : "text-primary"
          }`}
        >
          {getDisplayText()}
        </span>
        <FaCaretDown
          className={`flex-shrink-0 w-4 h-4 text-gray-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </div>

      {/* Dropdown content */}
      {isOpen && (
        <div
          className={`absolute z-20 ${
            dropdownPosition === "top" ? "bottom-full mb-1" : "top-full mt-1"
          } w-full bg-white border border-gray-300 rounded shadow-lg`}
        >
          <div className="max-h-60 overflow-y-auto p-3">
            {loading ? (
              <div className="p-2 text-gray-500 text-sm text-center">
                Loading towers...
              </div>
            ) : error ? (
              <div className="p-2 text-red-500 text-sm text-center">
                {error}
              </div>
            ) : allTowers.length === 0 ? (
              <div className="p-2 text-gray-500 text-sm text-center">
                No towers available
              </div>
            ) : (
              allTowers.map((tower) => {
                const isSelected = multiSelect
                  ? value?.some((v) => String(v) === String(tower))
                  : String(value) === String(tower);
                const inputType = multiSelect ? "checkbox" : "radio";
                return (
                  <label
                    key={tower}
                    className={`flex items-center space-x-3 px-3 py-2 rounded cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-primary bg-opacity-10 border border-primary border-opacity-40 text-primary"
                        : "hover:bg-gray-50 hover:text-primary"
                    }`}
                  >
                    <div className="relative">
                      <input
                        type={inputType}
                        checked={isSelected || false}
                        onChange={(e) =>
                          handleTowerChange(tower, e.target.checked)
                        }
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-2.5 h-2.5 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-sm ${
                        isSelected
                          ? "text-primary font-medium"
                          : "text-gray-700"
                      }`}
                    >
                      {getTowerName(tower)}
                    </span>
                  </label>
                );
              })
            )}
          </div>
          <div className="border-t border-gray-200 p-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClearAll}
                className="flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
                title="Clear All"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 bg-primary text-white py-2 px-4 rounded-md hover:bg-primaryHover transition-colors text-sm font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(TowerSelector);
