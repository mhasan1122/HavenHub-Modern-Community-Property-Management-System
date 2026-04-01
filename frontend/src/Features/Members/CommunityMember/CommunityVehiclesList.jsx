import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FaPrint, FaDownload } from "react-icons/fa";
import { fetchAllVehicles } from "../../../redux/slices/vehicle/vehicleSlice";
import axiosInstance from "../../../utils/axiosInstance";

import { Div } from "../../../Components/Ui/Div";
import { Heading } from "../../../Components/Ui/Heading";
import Button from "../../../Components/FormComponent/ButtonComponent/Button";
import FilterButton from "../../../Components/FormComponent/ButtonComponent/FilterButton";
import FilterSelect3 from "../../../Components/FilterSelect/FilterSelect3";
import SearchBar from "../../../Components/Search/SearchBar";
import FilterSelect4 from "../../../Components/FilterSelect/FilterSelect4";
import { exportToExcel, printTable } from "../../../utils/exportPrintExcel";
import { generateFileName, withExtension } from "../../../utils/fileNameUtils";
import VehiclesTable from "../../TowersAndUnits/Vehicles/VehiclesTable";

const PAGE_NAME = "Vehicle List";

const CommunityVehiclesList = () => {
  const dispatch = useDispatch();

  // Filters state
  const [filters, setFilters] = useState({
    tower: [],
    unit: [],
    status: [],
    numberplate: ""
  });
  const [showFilters, setShowFilters] = useState(false);
  const [filterActive, setFilterActive] = useState(false);

  // Redux data
  const {
    vehiclesList = [],
    loading,
    error
  } = useSelector((state) => state.vehicle);

  // Tower/Unit dropdown data
  const [towerUnitList, setTowerUnitList] = useState([]);

  // Add unit selection cache to maintain unit filter state
  const [unitSelectionCache, setUnitSelectionCache] = useState({});

  // Track previous filter for API calls
  const prevSerialized = useRef("");

  // Load towers and units once on mount
  useEffect(() => {
    axiosInstance
      .get("towers/vehicles/tower-units")
      .then((res) => {
        setTowerUnitList(res.data.data || []);
      })
      .catch((err) => console.error("Towers load error:", err));
  }, []);

  // Cleanup effect to reset filters when component unmounts
  useEffect(() => {
    return () => {
      // Reset filters and cache on unmount
      setFilters({
        tower: [],
        unit: [],
        status: [],
        numberplate: ""
      });
      setUnitSelectionCache({});
    };
  }, []);

  useEffect(() => {
    if (Object.keys(unitSelectionCache).length > 0) {
      const selectedTowerNames = filters.tower;

      // Build new cache with only towers currently selected
      const newCache = {};
      selectedTowerNames.forEach((towerName) => {
        if (unitSelectionCache[towerName]) {
          newCache[towerName] = new Set(unitSelectionCache[towerName]);
        }
      });

      // Compare keys and sets shallowly to avoid unnecessary updates
      const prevKeys = Object.keys(unitSelectionCache).sort();
      const newKeys = Object.keys(newCache).sort();

      const keysEqual =
        prevKeys.length === newKeys.length &&
        prevKeys.every((k, i) => k === newKeys[i]);

      const setsEqual = keysEqual
        ? prevKeys.every((key) => {
            const prevSet = unitSelectionCache[key];
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
      }
    }
    // IMPORTANT: remove unitSelectionCache from deps to prevent infinite loop
  }, [filters.tower, filters.unit]);

  // Helper: map unit IDs to unit IDs (API now expects unit IDs)
  const getUnitIdsFromValues = (unitValues = []) => {
    // Since we're now using unit IDs as values, just return them directly
    return unitValues;
  };

  const unitIds = getUnitIdsFromValues(filters.unit);

  // Serialize filters for API call tracking
  const serialized = JSON.stringify({
    tower: filters.tower.length ? filters.tower.join(",") : null,
    unit: unitIds.length ? unitIds.join(",") : null,
    status: filters.status.length ? filters.status.join(",") : null,
    numberplate: filters.numberplate || null
  });

  // Trigger API call on filters change
  useEffect(() => {
    if (prevSerialized.current !== serialized) {
      const tower = filters.tower.length ? filters.tower.join(",") : null;
      const unit = unitIds.length ? unitIds.join(",") : null; // send unit IDs
      const status = filters.status.length ? filters.status.join(",") : null;
      const numberplate = filters.numberplate;

      dispatch(fetchAllVehicles({ tower, unit, status, numberplate }));
      prevSerialized.current = serialized;
    }
  }, [dispatch, serialized]);

  // Handlers for filter changes
  const handleTowerFilter = useCallback((values) => {
    setFilters((f) => {
      const newFilters = { ...f, tower: values };

      // If we have units selected, check if they're still valid for the new towers
      if (f.unit.length > 0 && values.length > 0) {
        // Keep the units - they will be filtered by the backend based on tower selection
        // The cache will handle UI state preservation
        // Don't clear units here - let the backend handle filtering
      } else if (values.length === 0) {
        // No towers selected, clear units and cache
        newFilters.unit = [];
        setUnitSelectionCache({});
      }
      return newFilters;
    });
  }, []);

  const handleUnitFilter = useCallback((values, towerUnits) => {
    setFilters((f) => ({ ...f, unit: values }));

    // Update unit selection cache to maintain state
    if (towerUnits && towerUnits.length > 0) {
      const newCache = {};
      towerUnits.forEach(({ tower, unit }) => {
        if (!newCache[tower]) newCache[tower] = new Set();
        newCache[tower].add(unit);
      });

      // Merge with existing cache to preserve other tower selections
      setUnitSelectionCache((prevCache) => {
        const mergedCache = { ...prevCache };
        Object.entries(newCache).forEach(([tower, units]) => {
          if (!mergedCache[tower]) mergedCache[tower] = new Set();
          units.forEach((unit) => mergedCache[tower].add(unit));
        });
        return mergedCache;
      });
    } else if (values.length === 0) {
      // If no units selected, clear the cache
      setUnitSelectionCache({});
    }
  }, []);

  const handleStatusFilter = useCallback(
    (values) => setFilters((f) => ({ ...f, status: values })),
    []
  );

  const handlePlateSearch = useCallback(
    (text) => setFilters((f) => ({ ...f, numberplate: text })),
    []
  );

  // Toggle filter panel
  const toggleFilters = useCallback(() => {
    setShowFilters((show) => !show);
    setFilterActive((active) => !active);
  }, []);

  const towerOptions = useMemo(() => {
    return towerUnitList.map((t) => ({
      value: t.tower_name,
      label: t.tower_name
    }));
  }, [towerUnitList]);

  const statusOptions = [
    { value: "Active", label: "Active" },
    { value: "Inactive", label: "Inactive" }
  ];

  const hasVehicles = vehiclesList.length > 0;

  const handleExport = useCallback(() => {
    const exportData = vehiclesList.map((vehicle) => ({
      "License Plate": vehicle.license_plate,
      Type: vehicle.vehicle_type,
      Brand: vehicle.brand,
      Color: vehicle.color,
      Status: vehicle.status === "active" ? "Active" : "Inactive"
    }));

    const fileName = generateFileName(PAGE_NAME);
    exportToExcel(exportData, fileName, PAGE_NAME);
  }, [vehiclesList]);

  const handlePrint = useCallback(async () => {
    try {
      const title = "Vehicle List";
      const logoUrl = "";
      const fileName = withExtension(generateFileName(PAGE_NAME), ".pdf");

      const columns = [
        { header: "License Plate", accessor: (item) => item.license_plate },
        { header: "Type", accessor: (item) => item.vehicle_type },
        { header: "Brand", accessor: (item) => item.brand },
        { header: "Color", accessor: (item) => item.color },
        {
          header: "Status",
          accessor: (item) => (item.status == "active" ? "Active" : "Inactive")
        }
      ];

      await printTable(vehiclesList, columns, title, logoUrl, fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  }, [vehiclesList]);

  // console.log(towerUnitList, "towerUnitList----------------------");
  const members = useMemo(
    () =>
      towerUnitList.flatMap((t) =>
        t.units.map((u) => ({
          tower: t.tower_name,
          unit: u.id,
          unitName: u.unit_name
        }))
      ),
    [towerUnitList]
  );

  const towerUnitCombinations = useMemo(
    () =>
      filters.tower.length && filters.unit.length
        ? filters.tower.flatMap((towerName) =>
            filters.unit.map((unitId) => ({ tower: towerName, unit: unitId }))
          )
        : [],
    [filters.tower, filters.unit]
  );

  return (
    <Div className="p-2">
      <Div className="container">
        <Div className="relative shadow rounded-27 bg-white py-4 px-4">
          {/* Header */}
          <Div className="flex justify-between items-center py-4 mb-4">
            <Heading title="Members List" size="xl" color="text-black" />
            <Div className="flex items-center space-x-4">
              <Button
                icon={FaDownload}
                variant="download"
                size="large"
                onClick={handleExport}
                iconSize="medium"
                tooltip="Excel "
                tooltipId="org-member-excel-tooltip"
              />
              <Button
                variant="download"
                size="large"
                icon={FaPrint}
                onClick={handlePrint}
                iconSize="medium"
                tooltip="Print "
                tooltipId="org-member-print-tooltip"
              />
              <FilterButton active={filterActive} onClick={toggleFilters}>
                Filter
              </FilterButton>
            </Div>
          </Div>

          {/* Filters */}
          {showFilters && (
            <Div className="flex justify-end items-center py-4 mb-4 space-x-3">
              <FilterSelect3
                placeholder="Tower"
                options={towerOptions}
                value={filters.tower}
                onApply={handleTowerFilter}
              />
              <FilterSelect4
                placeholder="Unit"
                members={towerUnitList.flatMap((t) =>
                  t.units.map((u) => ({
                    tower: t.tower_name,
                    unit: u.id, // Use unit ID for filtering
                    unitName: u.unit_name // Include unit name for display
                  }))
                )}
                value={filters.unit}
                onApply={handleUnitFilter}
                selectedTowers={filters.tower.map((t) => ({ value: t }))}
                towerUnitCombinations={
                  filters.tower.length && filters.unit.length
                    ? filters.tower.flatMap((towerName) =>
                        filters.unit.map((unitId) => ({
                          tower: towerName,
                          unit: unitId
                        }))
                      )
                    : []
                }
                unitSelectionCache={unitSelectionCache}
                setUnitSelectionCache={setUnitSelectionCache}
              />
              <FilterSelect3
                placeholder="Status"
                options={statusOptions}
                value={filters.status}
                onApply={handleStatusFilter}
              />
              <SearchBar
                placeholder="License plate..."
                onSearch={handlePlateSearch}
                updateUrl={false}
              />
            </Div>
          )}
          <div className="relative overflow-x-auto max-h-[70vh] overflow-y-auto custom-scrollbar bg-white">
            <VehiclesTable
              loading={loading}
              error={error}
              vehiclesList={vehiclesList}
            />
          </div>
        </Div>
      </Div>
    </Div>
  );
};

export default CommunityVehiclesList;
