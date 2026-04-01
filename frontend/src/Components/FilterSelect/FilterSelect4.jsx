
import PropTypes from "prop-types";
import Button from "../FormComponent/ButtonComponent/Button";
import { FaCaretDown } from "react-icons/fa6";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const FilterSelect4 = ({
  placeholder = "Select Unit",
  members = [],
  selectedTowers = [],
  value = [],
  towerUnitCombinations = [],
  onApply,
  unitSelectionCache = {},
  setUnitSelectionCache = () => {},
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempSelected, setTempSelected] = useState([]);
  const dropdownRef = useRef(null);
  const tempSelectedRef = useRef(tempSelected);

  // Keep a ref to the latest cache to avoid infinite loop on update
  const cacheRef = useRef(unitSelectionCache);

  // Update cacheRef whenever unitSelectionCache changes
  useEffect(() => {
    cacheRef.current = unitSelectionCache;
  }, [unitSelectionCache]);

  // Memoize selected tower values as strings for stable deps
  const selectedTowerValues = useMemo(
    () =>
      selectedTowers.map((t) =>
        t && typeof t === "object" ? t.value : String(t)
      ),
    [selectedTowers]
  );

  // Memoize grouped units by tower with alphanumeric sorting
  const groupedUnits = useMemo(() => {
    const result = {};
    if (selectedTowerValues.length === 0) return result;

    members.forEach((m) => {
      const towerName =
        typeof m.tower === "string" ? m.tower : m.tower?.name || "";
      const unitId = m.unit;
      const unitName = m.unitName || unitId;

      if (towerName && unitId && selectedTowerValues.includes(towerName)) {
        if (!result[towerName]) result[towerName] = new Map();
        result[towerName].set(unitId, unitName);
      }
    });
    
    // Sort units within each tower alphanumerically
    const sortedResult = {};
    Object.keys(result)
      .sort((a, b) => {
        // Alphanumeric sort: numbers first, then strings
        const aNum = /^\d+/.exec(a);
        const bNum = /^\d+/.exec(b);
        if (aNum && bNum) {
          return parseInt(aNum[0]) - parseInt(bNum[0]);
        }
        if (aNum) return -1;
        if (bNum) return 1;
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
      })
      .forEach((tower) => {
        const units = result[tower];
        const sortedUnits = new Map(
          [...units.entries()].sort(([idA, nameA], [idB, nameB]) => {
            // Sort by unit name (or unit ID if name not available) alphanumerically
            // Use natural sort to handle compound strings like "7 - 1A" vs "7 - 6A"
            const name1 = String(nameA || idA);
            const name2 = String(nameB || idB);
            return name1.localeCompare(name2, undefined, { 
              numeric: true, 
              sensitivity: 'base',
              ignorePunctuation: false
            });
          })
        );
        sortedResult[tower] = sortedUnits;
      });
    
    return sortedResult;
  }, [members, selectedTowerValues]);

  // Serialize groupedUnits and unitSelectionCache for stable deps
  const groupedUnitsJSON = useMemo(
    () =>
      JSON.stringify(
        Object.entries(groupedUnits).map(([tower, units]) => [
          tower,
          [...units.keys()].sort(),
        ])
      ),
    [groupedUnits]
  );

  const unitSelectionCacheJSON = useMemo(
    () =>
      JSON.stringify(
        Object.entries(unitSelectionCache).map(([tower, units]) => [
          tower,
          [...units].sort(),
        ])
      ),
    [unitSelectionCache]
  );

  // Calculate initial selected keys "<tower>||<unit>" based on priorities
  const initialKeys = useMemo(() => {
    const keys = [];

    // Priority 1: towerUnitCombinations
    if (towerUnitCombinations.length > 0) {
      towerUnitCombinations.forEach(({ tower, unit }) => {
        if (groupedUnits[tower]?.has(unit)) {
          keys.push(`${tower}||${unit}`);
        }
      });
      return keys;
    }

    // Priority 2: value units matched to groupedUnits
    if (value.length > 0) {
      Object.entries(groupedUnits).forEach(([tower, units]) => {
        for (let unitId of units.keys()) {
          if (value.includes(unitId)) {
            keys.push(`${tower}||${unitId}`);
          }
        }
      });
      return keys;
    }

    // Priority 3: cache
    Object.entries(groupedUnits).forEach(([tower, units]) => {
      if (unitSelectionCache[tower]) {
        unitSelectionCache[tower].forEach((cachedUnit) => {
          if (units.has(cachedUnit)) {
            keys.push(`${tower}||${cachedUnit}`);
          }
        });
      }
    });

    return keys;
  }, [towerUnitCombinations, value, groupedUnits, unitSelectionCache]);

  // Helper: shallow compare arrays ignoring order
  const arraysEqualUnordered = (a, b) => {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((v, i) => v === sortedB[i]);
  };

  // Sync tempSelected state with initialKeys, only if changed
  useEffect(() => {
    if (!arraysEqualUnordered(initialKeys, tempSelectedRef.current)) {
      setTempSelected(initialKeys);
      tempSelectedRef.current = initialKeys;

      if (process.env.NODE_ENV === "development") {
        console.log("FilterSelect4: State restored:", {
          initialKeys,
          value,
          towerUnitCombinations,
          selectedTowers: selectedTowerValues,
          cacheKeys: Object.keys(unitSelectionCache),
        });
      }
    }
  }, [initialKeys, value, towerUnitCombinations, selectedTowerValues, unitSelectionCache]);

  // Cache cleanup effect - only update cache if it really changed
  useEffect(() => {
    if (selectedTowers.length === 0) {
      if (Object.keys(cacheRef.current).length !== 0) {
        setUnitSelectionCache({});
        cacheRef.current = {};
      }
      return;
    }

    const currentTowerNames = selectedTowerValues;

    // Build newCache based on currentTowerNames and previous cacheRef.current
    const newCache = {};
    currentTowerNames.forEach((towerName) => {
      if (cacheRef.current[towerName]) {
        newCache[towerName] = cacheRef.current[towerName];
      }
    });

    // Shallow compare keys and sets to avoid unnecessary updates
    const prevKeys = Object.keys(cacheRef.current).sort();
    const newKeys = Object.keys(newCache).sort();

    const keysEqual =
      prevKeys.length === newKeys.length &&
      prevKeys.every((k, i) => k === newKeys[i]);

    const setsEqual = keysEqual
      ? prevKeys.every((key) => {
          const prevSet = cacheRef.current[key];
          const newSet = newCache[key];
          if (prevSet.size !== newSet.size) return false;
          for (let item of prevSet) {
            if (!newSet.has(item)) return false;
          }
          return true;
        })
      : false;

    if (!keysEqual || !setsEqual) {
      setUnitSelectionCache(newCache);
      cacheRef.current = newCache;
    }
  }, [selectedTowerValues, selectedTowers, setUnitSelectionCache]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Memo all unit keys "<tower>||<unit>"
  const allKeys = useMemo(
    () =>
      Object.entries(groupedUnits).flatMap(([tower, units]) =>
        [...units.keys()].map((unit) => `${tower}||${unit}`)
      ),
    [groupedUnits]
  );

  const isAllSelected =
    allKeys.length > 0 && allKeys.every((k) => tempSelected.includes(k));

  // Toggle all select/deselect
  const toggleAll = useCallback(() => {
    if (isAllSelected) {
      setTempSelected([]);
      setUnitSelectionCache({});
    } else {
      setTempSelected(allKeys);
      const newCache = {};
      Object.entries(groupedUnits).forEach(([tower, units]) => {
        newCache[tower] = new Set([...units.keys()]);
      });
      setUnitSelectionCache(newCache);
    }
    if (process.env.NODE_ENV === "development") {
      console.log("FilterSelect4: toggleAll called", { isAllSelected, allKeys });
    }
  }, [isAllSelected, allKeys, groupedUnits, setUnitSelectionCache]);

  // Toggle single unit
  const toggleOption = useCallback(
    (tower, unit) => {
      const key = `${tower}||${unit}`;
      setTempSelected((prev) => {
        const next = prev.includes(key)
          ? prev.filter((x) => x !== key)
          : [...prev, key];

        setUnitSelectionCache((prevCache) => {
          const newCache = { ...prevCache };
          if (!newCache[tower]) newCache[tower] = new Set();

          if (next.includes(key)) {
            newCache[tower].add(unit);
          } else {
            newCache[tower].delete(unit);
            if (newCache[tower].size === 0) delete newCache[tower];
          }
          return newCache;
        });

        return next;
      });
    },
    [setUnitSelectionCache]
  );

  // Apply selected units callback
  const apply = useCallback(() => {
    const selectedTowerUnits = tempSelected.map((k) => {
      const [tower, unit] = k.split("||");
      return { tower, unit };
    });
    const selectedUnits = Array.from(
      new Set(tempSelected.map((k) => k.split("||")[1]))
    );

    onApply(selectedUnits, selectedTowerUnits);
    setIsOpen(false);
  }, [tempSelected, onApply]);

  // Clear all selections
  const clear = useCallback(() => {
    setTempSelected([]);
    setUnitSelectionCache({});
    onApply([]);
    setIsOpen(false);
  }, [onApply, setUnitSelectionCache]);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <Button
        size="medium"
        variant={value.length ? "transparent" : "filter"}
        icon={FaCaretDown}
        iconPosition="right"
        onClick={() => setIsOpen((o) => !o)}
        className={isOpen ? "!border-primary !bg-white !shadow-ring-primary" : ""}
      >
        {placeholder}
        {value.length > 0 && <span className="ml-1">({value.length})</span>}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-60 bg-white border shadow-lg rounded z-50 overflow-hidden flex flex-col max-h-64">
          <div className="overflow-y-auto p-2">
            <label className="flex items-center p-1 cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                className="mr-3 accent-primary w-5 h-5"
                checked={isAllSelected}
                onChange={toggleAll}
              />
              All
            </label>

            {Object.entries(groupedUnits).map(([tower, units]) => (
              <div key={tower} className="mt-2 border-t pt-2">
                <p className="text-primary font-semibold text-sm mb-1">
                  Tower: {tower}
                </p>
                {[...units.entries()].map(([unitId, unitName]) => {
                  const key = `${tower}||${unitId}`;
                  return (
                    <label
                      key={key}
                      className="flex items-center p-1 cursor-pointer hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        className="mr-3 accent-primary w-5 h-5"
                        checked={tempSelected.includes(key)}
                        onChange={() => toggleOption(tower, unitId)}
                      />
                      {unitName}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="pt-2 pb-2 px-2 border-t bg-white flex justify-between sticky bottom-0">
            <button
              className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded"
              onClick={clear}
            >
              Clear
            </button>
            <button
              className="px-3 py-1 bg-primary text-white rounded"
              onClick={apply}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

FilterSelect4.propTypes = {
  placeholder: PropTypes.string,
  members: PropTypes.array,
  selectedTowers: PropTypes.array,
  value: PropTypes.array,
  towerUnitCombinations: PropTypes.array,
  onApply: PropTypes.func.isRequired,
  unitSelectionCache: PropTypes.object,
  setUnitSelectionCache: PropTypes.func,
};

export default FilterSelect4;

