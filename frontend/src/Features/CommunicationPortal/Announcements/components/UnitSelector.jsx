import React, { useState, useRef, useEffect } from "react";
import { FaCaretDown } from "react-icons/fa6";
import { useDispatch } from "react-redux";
import {
  fetchUnitsByTower,
  fetchTowers
} from "../../../../redux/slices/api/announcementApi";

const UnitSelector = ({
  value,
  onChange,
  selectedTowers = [],
  placeholder = "Select Units",
  hideAll = false,
  showSelected = true,
  units: externalUnits = null,
  onUnitsLoaded = null
}) => {
  const dispatch = useDispatch();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState("bottom");
  const [units, setUnits] = useState(externalUnits || []);
  const [towers, setTowers] = useState([]);
  const [loading, setLoading] = useState(
    !externalUnits && selectedTowers.length > 0
  );
  const [error, setError] = useState(null);
  const selectorRef = useRef(null);
  const inputRef = useRef(null);
  const isInitialMount = useRef(true);
  const lastNotifiedUnits = useRef(null);

  // Fetch towers on component mount
  useEffect(() => {
    const loadTowers = async () => {
      try {
        const result = await dispatch(fetchTowers());
        if (fetchTowers.fulfilled.match(result)) {
          setTowers(result.payload);
        }
      } catch (err) {
        console.error("Error fetching towers:", err);
      }
    };

    loadTowers();
  }, [dispatch]);

  // Debug logging (can be removed in production)
  // console.log('UnitSelector received value:', value);
  // console.log('UnitSelector received selectedTowers:', selectedTowers);

  // Immediately clear units when no towers are selected
  useEffect(() => {
    // Normalize selectedTowers to always be an array for consistent checking
    const towersArray = Array.isArray(selectedTowers)
      ? selectedTowers
      : selectedTowers
      ? [selectedTowers]
      : [];

    if (!towersArray || towersArray.length === 0) {
      setUnits([]);
      // Only clear unit selection if it's not the initial mount AND value is not already empty
      if (!isInitialMount.current && value && value.length > 0) {
        onChange([]);
      }
      return;
    }
  }, [selectedTowers]);

  // Fetch units from backend based on selected towers if not provided externally
  useEffect(() => {
    if (externalUnits) {
      setUnits(externalUnits);
      setLoading(false);
      return;
    }

    const fetchUnits = async () => {
      // Normalize selectedTowers to always be an array
      const towersArray = Array.isArray(selectedTowers)
        ? selectedTowers
        : selectedTowers
        ? [selectedTowers]
        : [];

      if (!towersArray || towersArray.length === 0) {
        return; // Units already cleared by the effect above
      }

      try {
        setLoading(true);
        setError(null);

        // Filter out 'All' from selectedTowers and get actual tower IDs
        const towerIds = towersArray.filter((id) => id !== "All");

        if (towersArray.includes("All")) {
          // If 'All' is selected, we should fetch units from all towers
          if (towerIds.length > 0) {
            const result = await dispatch(fetchUnitsByTower(towerIds));
            if (fetchUnitsByTower.fulfilled.match(result)) {
              setUnits(result.payload);
            }
          } else {
            const result = await dispatch(fetchUnitsByTower(null));
            if (fetchUnitsByTower.fulfilled.match(result)) {
              setUnits(result.payload);
            }
          }
        } else if (towerIds.length > 0) {
          const result = await dispatch(fetchUnitsByTower(towerIds));
          if (fetchUnitsByTower.fulfilled.match(result)) {
            setUnits(result.payload);
          }
        } else {
          setUnits([]);
        }
      } catch (err) {
        console.error("Error fetching units:", err);
        setError("Failed to load units");
        setUnits([]);
        // Don't call onChange here - let the clearing effect handle it
      } finally {
        setLoading(false);
      }
    };

    fetchUnits();
  }, [selectedTowers, externalUnits, dispatch]); // Remove onChange from dependencies

  // Notify parent when units are loaded (for user count when "All" is selected)
  // Only call when units actually change, not when callback changes
  useEffect(() => {
    if (!onUnitsLoaded) return;

    // Create a stable comparison key for the units array
    const unitsKey = units ? units.map(u => u.id).sort().join(',') : '';
    const lastKey = lastNotifiedUnits.current;

    // Only notify if units have actually changed
    if (unitsKey !== lastKey) {
      lastNotifiedUnits.current = unitsKey;
      
      if (units && units.length > 0) {
        onUnitsLoaded(units);
      } else {
        onUnitsLoaded([]);
      }
    }
  }, [units]);

  // Helper function to get tower name by ID
  const getTowerName = (towerId) => {
    const tower = towers.find((t) => t.id === towerId);
    return tower ? tower.tower_name : `Tower ${towerId}`;
  };

  // Helper function to get unit name by ID
  const getUnitName = (unitId) => {
    if (unitId === "All") return "All Units";
    const unit = units.find((u) => u.id === unitId);
    return unit ? unit.unit_name : `Unit ${unitId}`;
  };

  // Group units by tower for hierarchical display
  const getGroupedUnits = () => {
    if (!units.length) return [];

    // Group units by tower
    const groupedByTower = {};

    units.forEach((unit) => {
      const towerId = unit.tower_id;

      if (towerId !== undefined && towerId !== null) {
        if (!groupedByTower[towerId]) {
          groupedByTower[towerId] = [];
        }
        groupedByTower[towerId].push(unit);
      } else {
        console.warn("Unit without tower_id:", unit); // Debug warning
      }
    });

    // Convert to array format for rendering
    const result = [];

    // Add "All" option first
    result.push({ type: "all", id: "All", name: "All" });

    // Sort tower IDs to ensure consistent ordering
    const sortedTowerIds = Object.keys(groupedByTower).sort(
      (a, b) => parseInt(a) - parseInt(b)
    );

    // Add towers and their units
    sortedTowerIds.forEach((towerId) => {
      const towerUnits = groupedByTower[towerId];
      if (towerUnits.length > 0) {
        // Use tower_name from unit data if available, otherwise fallback to getTowerName
        const towerName =
          towerUnits[0].tower_name || getTowerName(parseInt(towerId));

        // Add tower header
        result.push({
          type: "tower",
          id: towerId,
          name: towerName,
          units: towerUnits
        });

        // Add units under this tower (sort by unit name)
        const sortedUnits = towerUnits.sort((a, b) =>
          a.unit_name.localeCompare(b.unit_name)
        );
        sortedUnits.forEach((unit) => {
          result.push({
            type: "unit",
            id: unit.id,
            name: unit.unit_name,
            towerId: towerId
          });
        });
      }
    });

    // If hideAll is true, remove the 'All' option
    if (hideAll) {
      return result.filter((item) => item.type !== "all");
    }

    return result;
  };

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

  // Immediately filter out invalid units when towers change
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // If no towers selected, units already cleared by the effect above
    if (!selectedTowers || selectedTowers.length === 0) {
      return;
    }

    // If we have selected units, filter them immediately based on current towers
    if (value && value.length > 0 && units.length > 0 && !loading) {
      const currentValues = value || [];

      // If "All" is selected in units, keep it only if towers are selected
      if (currentValues.includes("All")) {
        // Keep "All" since we have towers selected
        return;
      }

      // For specific unit selections, validate them against fetched units
      const validUnits = currentValues.filter(
        (unit) => unit === "All" || units.some((u) => u.id === unit)
      );

      // If some units are no longer valid, update the selection immediately
      // But only if there's an actual change to avoid infinite loops
      if (validUnits.length !== currentValues.length) {
        onChange(validUnits);
      }
    }
  }, [selectedTowers, units, loading]);

  const handleUnitChange = (unit, isChecked) => {
    const currentValues = value || [];

    if (unit === "All") {
      if (isChecked) {
        // When "All" is selected, store ONLY "All" marker
        // This tells the backend to send to all units in the selected tower(s)
        onChange(["All"]);
      } else {
        onChange([]);
      }
    } else {
      let newValues;
      if (isChecked) {
        newValues = [...currentValues.filter((v) => v !== "All"), unit];
        // Check if all units are selected
        if (units.every((u) => newValues.includes(u.id))) {
          // Store only "All" marker when all units are selected
          newValues = ["All"];
        }
      } else {
        newValues = currentValues.filter((v) => v !== unit && v !== "All");
      }
      onChange(newValues);
    }
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const getDisplayText = () => {
    // Normalize selectedTowers to always be an array
    const towersArray = Array.isArray(selectedTowers)
      ? selectedTowers
      : selectedTowers
      ? [selectedTowers]
      : [];

    if (!towersArray || towersArray.length === 0) {
      return "Select towers first";
    }
    if (!value || value.length === 0) {
      return placeholder;
    }
    if (value.includes("All")) {
      return units.length > 0
        ? `All Units Selected (${units.length})`
        : "All Units Selected";
    }
    // Count only non-'All' values
    const unitCount = value.filter((unit) => unit !== "All").length;
    return `${unitCount} Unit(s) Selected`;
  };

  const getSelectedDisplay = () => {
    if (!value || value.length === 0) {
      return null;
    }

    // Check if "All" is explicitly selected OR if all available units are selected
    const allUnitsSelected =
      value.includes("All") ||
      (units.length > 0 && units.every((unit) => value.includes(unit.id)));

    if (allUnitsSelected) {
      return (
        <div className="mb-2 p-2 bg-primary bg-opacity-10 rounded-md border border-primary border-opacity-30">
          <div className="text-sm font-medium text-primary mb-1">
            Selected Units:
          </div>
          <div className="text-sm text-gray-700">
            All Units{units.length > 0 ? ` (${units.length})` : ""}
          </div>
        </div>
      );
    }

    return (
      <div className="mb-2 p-2 bg-primary bg-opacity-10 rounded-md border border-primary border-opacity-30">
        <div className="text-sm font-medium text-primary mb-1">
          Selected Units:
        </div>
        <div className="flex flex-wrap gap-1">
          {value
            .filter((unit) => unit !== "All")
            .map((unitId, index) => (
              <span
                key={
                  typeof unitId === "object"
                    ? `unit-${index}-${unitId.id || index}`
                    : unitId
                }
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary text-white"
              >
                {getUnitName(unitId)}
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
        onClick={() => setIsOpen(!isOpen)}
        className={`login-field-input !flex justify-between items-center gap-2 whitespace-nowrap cursor-pointer !py-2 !px-4 !h-[42px] ${
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
                Loading units...
              </div>
            ) : error ? (
              <div className="p-2 text-red-500 text-sm text-center">
                {error}
              </div>
            ) : !selectedTowers || selectedTowers.length === 0 ? (
              <div className="p-2 text-gray-500 text-sm text-center">
                Please select towers first to see available units
              </div>
            ) : units.length === 0 ? (
              <div className="p-2 text-gray-500 text-sm text-center">
                No units available
              </div>
            ) : (
              getGroupedUnits().map((item, index) => {
                if (item.type === "all") {
                  const isSelectedAll = value?.includes("All");
                  return (
                    <label
                      key={`all-${item.id}`}
                      className={`flex items-center space-x-3 px-3 py-2 rounded cursor-pointer transition-colors ${
                        isSelectedAll
                          ? "bg-primary bg-opacity-10 border border-primary border-opacity-40 text-primary"
                          : "hover:bg-gray-50 hover:text-primary"
                      }`}
                    >
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={value?.includes("All") || false}
                          onChange={(e) =>
                            handleUnitChange("All", e.target.checked)
                          }
                          className="sr-only"
                        />
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                            isSelectedAll
                              ? "bg-primary border-primary"
                              : "border-gray-300 bg-white"
                          }`}
                        >
                          {isSelectedAll && (
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
                        className={`text-sm font-medium ${
                          isSelectedAll ? "text-primary" : "text-gray-700"
                        }`}
                      >
                        {item.name}
                      </span>
                    </label>
                  );
                } else if (item.type === "tower") {
                  return (
                    <div
                      key={`tower-${item.id}-${index}`}
                      className="text-sm text-gray-600 font-medium px-2 py-1 bg-gray-50 border-b border-gray-200"
                    >
                      {item.name}
                    </div>
                  );
                } else if (item.type === "unit") {
                  const isSelectedUnit =
                    value?.includes(item.id) || value?.includes("All");
                  return (
                    <label
                      key={`unit-${item.id}-${index}`}
                      className={`flex items-center space-x-3 px-3 py-2 pl-6 rounded cursor-pointer transition-colors ${
                        isSelectedUnit
                          ? "bg-primary bg-opacity-10 border border-primary border-opacity-40 text-primary"
                          : "hover:bg-gray-50 hover:text-primary"
                      }`}
                    >
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={isSelectedUnit || false}
                          onChange={(e) =>
                            handleUnitChange(item.id, e.target.checked)
                          }
                          className="sr-only"
                        />
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                            isSelectedUnit
                              ? "bg-primary border-primary"
                              : "border-gray-300 bg-white"
                          }`}
                        >
                          {isSelectedUnit && (
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
                        className={`text-sm font-medium ${
                          isSelectedUnit ? "text-primary" : "text-gray-700"
                        }`}
                      >
                        {item.name}
                      </span>
                    </label>
                  );
                }
                return null;
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

export default React.memo(UnitSelector);
