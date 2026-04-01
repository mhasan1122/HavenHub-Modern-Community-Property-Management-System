import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchCommMembers } from "../../../redux/slices/commMember/commMemberSlice";
import FilterSelect3 from "Components/FilterSelect/FilterSelect3";
import SearchBar from "Components/Search/SearchBar";
import CommunityMemberListTable from "Components/Table/Member/CommunityMemberListTable";
import TableSkeleton from "Components/Loaders/TableSkeleton";
import useSkeletonLoading from "../../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../../config/skeletonLoadingConfig";
import Heading from "Components/HeadingComponent/Heading";
import { Div } from "Components/Ui/Div";
import Button from "../../../Components/FormComponent/ButtonComponent/Button";
import { FaPrint, FaDownload } from "react-icons/fa";
import { IoPeople } from "react-icons/io5";
import { FiUpload } from "react-icons/fi";
import {
  exportToExcel,
  printCommunityMemberList
} from "utils/exportPrintExcel";
import { generateFileName, withExtension } from "utils/fileNameUtils";
import logo from "./../../../assets/user/user.png";
import FilterButton from "../../../Components/FormComponent/ButtonComponent/FilterButton";
import { checkPermission } from "../../../utils/permissionUtils";
import {
  useLocation,
  useNavigate,
  useNavigationType,
  useSearchParams
} from "react-router-dom";
import PageContainer from "../../../Components/Ui/PageContainer";
import ContentBox from "../../../Components/Ui/ContentBox";
import CommunityMemberImportModal from "./CommunityMemberImportModal";
import EmptyState from "../../../Components/Ui/EmptyState";
import TowerSelector from "../../CommunicationPortal/Announcements/components/TowerSelector";
import UnitSelector from "../../CommunicationPortal/Announcements/components/UnitSelector";

const CommunityMemberList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  // Permission state
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);

  // All other hooks must be called before any early return
  const { items: members, loading, error } = useSelector((s) => s.commMember);
  const [searchTerm, setSearchTerm] = useState("");
  const [allMembers, setAllMembers] = useState([]);
  const [filters, setFilters] = useState({
    type: [],
    tower: [],
    unit: [],
    status: []
  });

  const [showFilters, setShowFilters] = useState(true); // Open by default

  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const navType = useNavigationType();
  const lastParamsRef = useRef(""); // Track last API parameters for de-duplication

  // Get user information from Redux for role change detection
  const user = useSelector((state) => state.auth.user);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);

  // Function to reset all filters to default state
  const resetAllFilters = useCallback(() => {
    setFilters({
      type: [],
      tower: [],
      unit: [],
      status: []
    });
    setSearchTerm("");
    setShowFilters(true); // Keep filters open by default
    setSearchParams(new URLSearchParams(), { replace: true });

    // Reset allMembers to force re-fetch of full dataset
    setAllMembers([]);
  }, [setSearchParams]);

  // Consolidated initialization logic to prevent redundant resets
  const isInitialized = useRef(false);

  useEffect(() => {
    // Only run initialization once or when forced
    if (isInitialized.current) return;

    // Check if we are ready to initialize (permission check done)
    if (loadingPermission) return;

    // If we have back navigation, auth change, or fresh load
    // We should ensure a clean state
    resetAllFilters();
    isInitialized.current = true;
  }, [loadingPermission, user?.id, resetAllFilters]);

  // Handle back navigation specifically if it happens after initialization
  useEffect(() => {
    if (navType === "POP" && isInitialized.current) {
      resetAllFilters();
    }
  }, [navType, resetAllFilters]);

  // Global event listener for logout and auth changes
  useEffect(() => {
    const handleAuthChange = () => {
      resetAllFilters();
      // Also reset member data on logout/auth changes
      setAllMembers([]);
    };

    // Listen for logout events
    window.addEventListener("logout", handleAuthChange);

    // Listen for storage changes (localStorage auth changes)
    const handleStorageChange = (e) => {
      if (e.key === "access_token" || e.key === "user") {
        handleAuthChange();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("logout", handleAuthChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [resetAllFilters]);

  useEffect(() => {
    const fetchPermission = async () => {
      const permissionGranted = await checkPermission("org", 24);
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };
    fetchPermission();
  }, []);

  // Extract tower and unit options for TowerSelector and UnitSelector
  const { towerOptions, unitOptions } = useMemo(() => {
    const towersMap = new Map();
    const unitsMap = new Map();

    allMembers.forEach((member) => {
      const towerName =
        typeof member.tower === "string" ? member.tower : member.tower?.name;
      const towerId = member.tower?.id || towerName;

      const unitName = member.unit;
      const unitId = member.unit_id || unitName;

      if (towerName) {
        if (!towersMap.has(towerId)) {
          towersMap.set(towerId, { id: towerId, tower_name: towerName });
        }

        if (unitName) {
          // Create a composite ID to ensure uniqueness across towers
          // Schema: {towerId}-{unitId || unitName}
          const compositeUnitId = `${towerId}-${unitId}`;
          const unitKey = `${towerId}||${unitId}`;

          if (!unitsMap.has(unitKey)) {
            unitsMap.set(unitKey, {
              id: compositeUnitId, // Use composite ID for selection
              original_id: unitId,
              unit_name: unitName,
              tower_id: towerId,
              tower_name: towerName
            });
          }
        }
      }
    });

    return {
      towerOptions: Array.from(towersMap.values()),
      unitOptions: Array.from(unitsMap.values())
    };
  }, [allMembers]);

  // seed allMembers with full dataset when filters are empty
  useEffect(() => {
    // Check if we're receiving unfiltered data (all filters are empty)
    const hasActiveFilters =
      filters.type.length > 0 ||
      filters.tower.length > 0 ||
      filters.unit.length > 0 ||
      filters.status.length > 0 ||
      searchTerm.length >= 3;

    // Update allMembers when:
    // 1. We have members from API
    // 2. Not currently loading (prevents seeding with stale data)
    // 3. No filters are active (receiving full dataset)
    // 4. allMembers is empty (needs initial seed or was reset)
    if (
      members.length > 0 &&
      !loading &&
      !hasActiveFilters &&
      allMembers.length === 0
    ) {
      setAllMembers(members);
    }
  }, [
    members,
    allMembers,
    loading,
    filters.type,
    filters.tower,
    filters.unit,
    filters.status,
    searchTerm
  ]);

  // fetch whenever any filter array OR the debounced search changes
  useEffect(() => {
    // Transform filters back to API expected format (Names/Original Values)
    // The UI now uses IDs/Composite IDs for robustness, but the API likely expects Names based on legacy behavior.

    const apiTowerFilters = filters.tower.map((id) => {
      if (id === "All") return "All";
      const option = towerOptions.find((t) => String(t.id) === String(id));
      return option ? option.tower_name : id;
    });

    const apiUnitFilters = filters.unit.map((compositeId) => {
      if (compositeId === "All") return "All";
      // Find the option using the composite ID
      const option = unitOptions.find(
        (u) => String(u.id) === String(compositeId)
      );
      // Fallback to unit_name if original_id is not available (or assume original behavior used names)
      return option ? option.unit_name || option.original_id : compositeId;
    });

    const params = {
      ...filters,
      tower: apiTowerFilters,
      unit: apiUnitFilters,
      // only send search if ≥ 3 chars
      ...(searchTerm.length >= 3 ? { search: searchTerm } : {})
    };

    // De-duplication check: Skip if parameters are identical to the last request
    const paramsString = JSON.stringify(params);
    if (lastParamsRef.current === paramsString) {
      return;
    }
    lastParamsRef.current = paramsString;

    dispatch(fetchCommMembers(params));
  }, [
    dispatch,
    filters.type,
    filters.tower,
    filters.unit,
    filters.status,
    searchTerm,
    towerOptions,
    unitOptions
  ]);

  // Enhanced client-side filtering for tower-unit combination
  // This now uses precise tower-unit combinations for accurate filtering
  // Use skeleton loading hook to ensure minimum display time and data validation
  const showSkeleton = useSkeletonLoading(
    loading || loadingPermission,
    members,
    SKELETON_MIN_DISPLAY_TIME
  );

  const filteredMembers = useMemo(() => {
    if (!members || members.length === 0) return [];

    // First, filter by type if type filters are applied
    let typeFiltered = members;
    if (filters.type && filters.type.length > 0) {
      typeFiltered = members.filter((member) => {
        // Get the filter values as strings for comparison
        const selectedTypes = filters.type.map((t) =>
          typeof t === "object" ? String(t.value) : String(t)
        );
        const memberType = String(member.type || "");
        return selectedTypes.includes(memberType);
      });
    }

    // If no tower filters are applied, return type-filtered members
    if (filters.tower.length === 0) {
      return typeFiltered;
    }

    // Get selected tower names
    const selectedTowerNames = filters.tower.map((t) =>
      typeof t === "object" ? t.value : String(t)
    );

    // Filter members based on tower-unit combination
    const filtered = typeFiltered.filter((member) => {
      const memberTower =
        typeof member.tower === "string" ? member.tower : member.tower?.name;
      const memberUnit = member.unit;

      // Check if this member's tower is in the selected towers
      const towerMatches = selectedTowerNames.includes(memberTower);

      // If unit filters are applied, check unit matches within selected towers
      if (filters.unit.length > 0) {
        // Filter out 'All' from unit filters
        const unitIds = filters.unit.filter((u) => u !== "All");
        if (unitIds.length > 0) {
          const unitMatches = unitIds.some((selectedCompositeId) => {
            const memberTowerId = member.tower?.id || memberTower;
            const memberUnitId = member.unit_id || memberUnit;
            // Reconstruct the composite ID for the current member to compare
            const currentMemberCompositeId = `${memberTowerId}-${memberUnitId}`;
            return (
              String(selectedCompositeId) === String(currentMemberCompositeId)
            );
          });
          return towerMatches && unitMatches;
        }
        // If 'All' units is selected, just check tower match
        return towerMatches;
      }

      // Only tower filtering
      return towerMatches;
    });

    // Debug logging to verify filtering is working correctly
    console.log("Filtering debug:", {
      totalMembers: members.length,
      typeFiltered: typeFiltered.length,
      filteredMembers: filtered.length,
      selectedTypes: filters.type,
      selectedTowers: selectedTowerNames,
      selectedUnits: filters.unit,
      sampleFiltered: filtered.slice(0, 3).map((m) => ({
        name: m.full_name,
        type: m.type,
        tower: m.tower,
        unit: m.unit
      }))
    });

    return filtered;
  }, [members, filters.type, filters.tower, filters.unit]);

  // options (memoized)
  const memberTypeOptions = useMemo(
    () => [
      { value: "owner", label: "Owner" },
      { value: "resident", label: "Resident" },
      { value: "resident_tenant", label: "Resident (Tenant)" },
      { value: "staff", label: "Staff" }
    ],
    []
  );

  // Filter unit options based on selected towers
  const filteredUnitOptions = useMemo(() => {
    // If no tower selected or only "All" selected, show all units
    const selectedTowers = filters.tower.filter((t) => t !== "All");
    if (selectedTowers.length === 0) {
      return unitOptions;
    }

    // Filter units that belong to selected towers
    // We compare tower_id matching the IDs in filters.tower
    return unitOptions.filter((unit) =>
      selectedTowers.some(
        (towerId) =>
          String(towerId) === String(unit.tower_id) ||
          String(towerId) === String(unit.tower_name)
      )
    );
  }, [unitOptions, filters.tower]);

  const statusOptions = useMemo(
    () => [
      { value: "Active", label: "Active" },
      { value: "Inactive", label: "Inactive" }
    ],
    []
  );

  const handlePrint = useCallback(() => {
    const fileName = withExtension(
      generateFileName("community_member_list"),
      ".pdf"
    );
    printCommunityMemberList(
      filteredMembers,
      "Community member list ",
      logo,
      fileName
    );
  }, [filteredMembers, logo]);

  const exportData = useMemo(() => {
    // Group members by ID and combine their properties
    const memberGroups = filteredMembers.reduce((groups, member) => {
      if (!groups[member.id]) {
        groups[member.id] = {
          ...member,
          types: new Set(),
          towers: new Set(),
          units: new Set()
        };
      }

      // Add current member's properties to the sets
      groups[member.id].types.add(member.type);
      groups[member.id].towers.add(member.tower);
      groups[member.id].units.add(member.unit);

      return groups;
    }, {});

    // Prepare data for Excel export
    return Object.values(memberGroups).map((member) => ({
      Name: member.full_name || "N/A",
      Email: member.general_email || "N/A",
      Contact: member.general_contact || "N/A",
      Type: Array.from(member.types)
        .map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
        .join(", "),
      Tower: Array.from(member.towers).join(", "),
      Unit: Array.from(member.units).join(", "),
      Status:
        member.status ||
        (Number(member.is_org_member) === 1 ? "Active" : "Inactive")
    }));
  }, [filteredMembers]);
  const handleExport = useCallback(() => {
    const fileName = generateFileName("community_member_list");
    exportToExcel(exportData, fileName, "Community Member List");
  }, [exportData]);

  // Handler for tower filter
  const handleTowerFilter = useCallback((values) => {
    setFilters((f) => {
      const towerIds = Array.isArray(values)
        ? values
        : values === "All"
          ? ["All"]
          : [values];
      const newFilters = { ...f, tower: towerIds };
      // Clear units when towers change
      if (towerIds.length === 0) {
        newFilters.unit = [];
      }
      return newFilters;
    });
  }, []);

  // Handler for unit filter
  const handleUnitFilter = useCallback((unitIds) => {
    setFilters((f) => ({
      ...f,
      unit: Array.isArray(unitIds) ? unitIds : [unitIds]
    }));
  }, []);

  const toggleFilters = () => {
    setShowFilters((prev) => !prev);
  };

  // Once permission check is done, redirect unauthorized users
  if (!loadingPermission && !hasPermission) {
    navigate("/not-authorized");
    return null;
  }

  return (
    <div>
      <PageContainer>
        <ContentBox>
          <CommunityMemberImportModal
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
          />
          <Div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-4 mb-4">
            <Heading
              title="Community Members List"
              size="xl"
              color="text-black"
            />

            <Div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <button
                className="flex flex-row justify-center items-center gap-1.5 w-auto min-w-[120px] h-12 px-4 bg-primary text-white rounded-lg text-base font-medium leading-[140%]"
                style={{
                  boxShadow:
                    "inset 0px 7px 12px rgba(255, 255, 255, 0.08), inset 0px -2px 2px rgba(48, 48, 48, 0.1)"
                }}
                onClick={() => setShowImportModal(true)}
              >
                <FiUpload className="w-4 h-4" />
                <span className="hidden sm:inline">Import Data</span>
                <span className="sm:hidden">Import</span>
              </button>
              <Button
                icon={FaDownload}
                variant="download"
                size="large"
                onClick={handleExport}
                disabled={!filteredMembers.length}
                iconSize="medium"
                tooltip="Excel " // Only shows when this is passed
                tooltipId="com-member-excel-tooltip"
              ></Button>
              <Button
                variant="download"
                size="large"
                icon={FaPrint}
                onClick={handlePrint}
                disabled={!filteredMembers.length}
                iconSize="medium"
                tooltip="Print " // Only shows when this is passed
                tooltipId="com-member-print-tooltip"
              ></Button>
              <FilterButton active={showFilters} onClick={toggleFilters}>
                Filter
              </FilterButton>
            </Div>
          </Div>
          {showFilters && (
            <Div className="mt-4 pb-4">
              {/* Search Bar - Full width on mobile, positioned at top */}
              <div className="w-full mb-4 sm:hidden">
                <SearchBar
                  placeholder="Search name or email…"
                  updateUrl={false}
                  onSearch={(text) => setSearchTerm(text.trim())}
                  debounceMs={300}
                />
              </div>

              {/* Filters - Single column on mobile, flex row on desktop */}
              <Div className="flex flex-col sm:flex-row sm:flex-nowrap gap-3 sm:gap-3 sm:justify-end sm:items-center">
                <div className="w-full sm:w-auto sm:flex-shrink-0">
                  <FilterSelect3
                    placeholder="Member Type"
                    options={memberTypeOptions}
                    value={filters.type}
                    onApply={(val) => setFilters((f) => ({ ...f, type: val }))}
                  />
                </div>
                <div className="w-full sm:w-[220px] sm:flex-shrink-0">
                  <TowerSelector
                    placeholder="Tower"
                    towers={towerOptions}
                    value={filters.tower}
                    onChange={handleTowerFilter}
                    showSelected={false}
                    multiSelect={true}
                  />
                </div>
                <div className="w-full sm:w-[220px] sm:flex-shrink-0">
                  <UnitSelector
                    placeholder="Unit"
                    units={filteredUnitOptions}
                    selectedTowers={filters.tower}
                    value={filters.unit}
                    showSelected={false}
                    onChange={handleUnitFilter}
                  />
                </div>
                <div className="w-full sm:w-auto sm:flex-shrink-0">
                  <FilterSelect3
                    placeholder="Status"
                    options={statusOptions}
                    value={filters.status}
                    onApply={(val) =>
                      setFilters((f) => ({ ...f, status: val }))
                    }
                  />
                </div>
                {/* SearchBar for desktop - hidden on mobile */}
                <div className="hidden sm:block sm:w-[220px] sm:flex-shrink-0">
                  <SearchBar
                    placeholder="Search name or email…"
                    updateUrl={false}
                  onSearch={(text) => setSearchTerm(text.trim())}
                  debounceMs={300}
                  />
                </div>
              </Div>
            </Div>
          )}

          {/* Loading and Error Handling */}
          {showSkeleton ? (
            <div className="flex items-center justify-center my-12">
              <TableSkeleton />
            </div>
          ) : filteredMembers.length === 0 ? (
            <EmptyState icon={IoPeople} title="No Community Members Found" />
          ) : (
            <CommunityMemberListTable members={filteredMembers} error={error} />
          )}
        </ContentBox>
      </PageContainer>
    </div>
  );
};

export default CommunityMemberList;
