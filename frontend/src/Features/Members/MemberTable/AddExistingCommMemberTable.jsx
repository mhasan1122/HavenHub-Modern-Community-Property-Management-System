import { useEffect, useState, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchAddExistingMembers } from "../../../redux/slices/api/memberApi";
import { Div } from "Components/Ui/Div";
import SearchBar from "Components/Search/SearchBar";
import Heading from "Components/HeadingComponent/Heading";
import FilterSelect2 from "../../../Components/FilterSelect/FilterSelect2";
import TowerSelector from "../../CommunicationPortal/Announcements/components/TowerSelector";
import UnitSelector from "../../CommunicationPortal/Announcements/components/UnitSelector";
import { useSearchParams } from "react-router-dom";
import { fetchMemberTypeOptions } from "./memberTypeList";
import { RxCross1 } from "react-icons/rx";
import TableSkeleton from "../../../Components/Loaders/TableSkeleton";
import useSkeletonLoading from "../../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../../config/skeletonLoadingConfig";
import user1 from "../../../assets/user/user.png";

const AddExistingCommMemberTable = ({ isOpen, onClose, onSelect }) => {
  const BASE_URL = import.meta.env.VITE_BASE_API;
  const dispatch = useDispatch();
  const [selectUnit, setSelectUnit] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter states
  const [filters, setFilters] = useState({
    tower: [],
    unit: []
  });

  const memberState = useSelector((state) => state.member || {});
  const allMemberData = memberState.AddExistingCommMember || {};
  const allMembers = [
    ...(allMemberData.owners || []),
    ...(allMemberData.comm_members || []),
    ...(allMemberData.resident_members || []),
    ...(allMemberData.unit_staff || [])
  ];

  const getMemberValue = (member, key) => {
    if (key === "member_type_name") {
      // Check for unit_staff first (can be string "unit_staff" or boolean/object)
      if (member?.unit_staff || member?.unit_staff === "unit_staff") {
        return "Unit Staff";
      }
      if (member?.resident_member) {
        // Check if it's a tenant (is_resident_or_tenant = false)
        if (member?.is_resident_or_tenant === false) {
          return "Resident (Tenant)";
        }
        return "Resident";
      }
      return member?.member ? "Owner" : "-";
    }
    // For unit_staff, the member data is nested under 'member' key
    // For residents, it's under 'resident_member'
    // For owners, it's under 'member'
    return (
      member?.resident_member?.[key] ||
      member?.member?.[key] ||
      member?.[key] ||
      "-"
    );
  };

  // Extract unique towers and units for the new selectors
  const { towerOptions, unitOptions } = useMemo(() => {
    const towersMap = new Map();
    const unitsMap = new Map();

    allMembers.forEach((member) => {
      const towerName = getMemberValue(member, "tower_name");
      const towerId = member?.tower?.id || member?.tower_id || towerName;

      const unitName = getMemberValue(member, "unit_name");
      const unitId = member?.unit?.id || member?.unit_id || unitName;

      if (towerName && towerName !== "-") {
        if (!towersMap.has(towerId)) {
          towersMap.set(towerId, { id: towerId, name: towerName });
        }

        if (unitName && unitName !== "-") {
          const compositeUnitId = `${towerId}-${unitId}`;
          const unitKey = `${towerId}||${unitId}`;
          if (!unitsMap.has(unitKey)) {
            unitsMap.set(unitKey, {
              id: compositeUnitId,
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

  // Filter unit options based on selected towers
  const filteredUnitOptions = useMemo(() => {
    // If no tower selected or only "All" selected, show all units
    const selectedTowers = filters.tower.filter((t) => t !== "All");
    if (selectedTowers.length === 0) {
      return unitOptions;
    }

    // Filter units that belong to selected towers
    return unitOptions.filter((unit) =>
      selectedTowers.some(
        (towerId) =>
          String(towerId) === String(unit.tower_id) ||
          String(towerId) === String(unit.tower_name)
      )
    );
  }, [unitOptions, filters.tower]);

  const groupedMembers = allMembers.reduce((acc, member) => {
    // Get member ID - handle unit_staff, residents, and owners
    // For unit_staff: member.member.id
    // For residents: member.resident_member.id
    // For owners: member.member.id
    const id = member?.resident_member?.id || member?.member?.id || member?.id;
    if (!id) return acc; // Skip if no valid ID

    if (!acc[id]) {
      acc[id] = {
        id,
        full_name: getMemberValue(member, "full_name"),
        general_contact: getMemberValue(member, "general_contact"),
        general_email: getMemberValue(member, "general_email"),
        // Extract credential fields directly (don't use getMemberValue to avoid "-" defaults)
        login_email: member?.resident_member?.login_email || member?.member?.login_email || member?.login_email || null,
        login_contact: member?.resident_member?.login_contact || member?.member?.login_contact || member?.login_contact || null,
        is_org_member: member?.resident_member?.is_org_member || member?.member?.is_org_member || member?.is_org_member || false,
        is_first_login: member?.resident_member?.is_first_login || member?.member?.is_first_login || member?.is_first_login || false,
        photo:
          member?.photo ||
          member?.resident_member?.photo ||
          member?.member?.photo,
        roles: []
      };
    }
    acc[id].roles.push({
      type: getMemberValue(member, "member_type_name"),
      tower: getMemberValue(member, "tower_name"),
      floor: getMemberValue(member, "floor_no"),
      unit: getMemberValue(member, "unit_name"),
      unitId:
        member?.unit?.id ||
        member?.unit_id ||
        getMemberValue(member, "unit_name"),
      towerId:
        member?.tower?.id ||
        member?.tower_id ||
        getMemberValue(member, "tower_name"),
      status:
        member.status ||
        member?.resident_member?.status ||
        member?.member?.status ||
        "-"
    });
    return acc;
  }, {});

  // Get search and type filters from URL params
  const searchFilter = searchParams.get("search") || "";
  const typeFilter = searchParams.get("member_type")
    ? searchParams
        .get("member_type")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  // Apply client-side filtering for search, type, tower and unit
  const filteredGroupedMembers = useMemo(() => {
    const allGrouped = Object.values(groupedMembers);

    return allGrouped.filter((member) => {
      // Apply search filter (on member name, contact, email)
      if (searchFilter) {
        const searchLower = searchFilter.toLowerCase();
        const matchesSearch =
          (member.full_name || "").toLowerCase().includes(searchLower) ||
          (member.general_contact || "").toLowerCase().includes(searchLower) ||
          (member.general_email || "").toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Apply type filter (check if any role matches the selected types)
      if (typeFilter.length > 0) {
        // Map URL filter values to display names used in the data
        // URL uses: owner, resident, resident_tenant, unit_staff
        // Data uses: Owner, Resident, Resident (Tenant), Unit Staff
        const mapFilterValueToDisplayName = (filterValue) => {
          const value = String(filterValue).toLowerCase().trim();
          const mapping = {
            owner: "owner",
            resident: "resident",
            resident_tenant: "resident (tenant)",
            unit_staff: "unit staff"
          };
          return mapping[value] || value;
        };

        const matchesType = member.roles.some((role) => {
          const roleTypeLower = (role.type || "").toLowerCase().trim();
          return typeFilter.some((selectedType) => {
            const mappedDisplayName = mapFilterValueToDisplayName(selectedType);
            // Exact match between role type (lowercased) and mapped display name
            return roleTypeLower === mappedDisplayName;
          });
        });
        if (!matchesType) return false;
      }

      // Apply tower and unit filters (check if any role matches)
      if (filters.tower.length > 0 || filters.unit.length > 0) {
        const matchesLocation = member.roles.some((role) => {
          const towerMatches =
            filters.tower.length === 0 ||
            filters.tower.some((t) => {
              const towerValue = String(t);
              return (
                towerValue === String(role.towerId) || towerValue === role.tower
              );
            });

          if (!towerMatches) return false;

          // If unit filters are applied, check unit matches
          if (filters.unit.length > 0) {
            const selectedUnitIds = filters.unit.filter((u) => u !== "All");
            if (selectedUnitIds.length > 0) {
              const unitMatches = selectedUnitIds.some(
                (selectedCompositeId) => {
                  const roleCompositeId = `${role.towerId}-${role.unitId}`;
                  return (
                    String(selectedCompositeId) === String(roleCompositeId)
                  );
                }
              );
              return unitMatches;
            }
          }

          return true;
        });
        if (!matchesLocation) return false;
      }

      return true;
    });
  }, [groupedMembers, filters, searchFilter, typeFilter]);

  const groupedArray = filteredGroupedMembers;

  // Apply skeleton loading delay so the popup table skeleton is visible on fast responses
  const showSkeleton = useSkeletonLoading(
    memberState.loading,
    groupedArray,
    SKELETON_MIN_DISPLAY_TIME
  );

  useEffect(() => {
    fetchMemberTypeOptions().then(setSelectUnit);
  }, []);

  useEffect(() => {
    const typeParam = searchParams.get("member_type");
    const searchParam = searchParams.get("search");

    const apiFilters = {
      member_type: typeParam ? typeParam.split(",") : [],
      search: searchParam || ""
    };
    dispatch(fetchAddExistingMembers({ filters: apiFilters }));
  }, [searchParams, dispatch]);

  // Filter handlers
  const handleTowerFilter = useCallback((values) => {
    setFilters((f) => {
      // FilterSelect3 used an array of values, TowerSelector returns an array of IDs (or 'All' string)
      const towerIds = Array.isArray(values)
        ? values
        : values === "All"
          ? ["All"]
          : [values];
      const newFilters = { ...f, tower: towerIds };
      if (towerIds.length === 0) {
        newFilters.unit = [];
      }
      return newFilters;
    });
  }, []);

  const handleUnitFilter = useCallback((unitIds) => {
    setFilters((f) => ({
      ...f,
      unit: Array.isArray(unitIds) ? unitIds : [unitIds]
    }));
  }, []);

  // Reset filters when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFilters({ tower: [], unit: [] });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const renderRows = () =>
    groupedArray.map((member) =>
      member.roles.map((role, idx) => (
        <tr
          key={`${member.id}-${idx}`}
          className={
            idx === 0
              ? "bg-white border-t hover:bg-gray-50"
              : "bg-white hover:bg-gray-50"
          }
        >
          {idx === 0 && (
            <>
              <td
                rowSpan={member.roles.length}
                className="px-4 py-3 border-gray-200"
              >
                <div className="flex items-center gap-2">
                  <img
                    src={member.photo ? `${BASE_URL}${member.photo}` : user1}
                    onError={(e) => (e.target.src = user1)}
                    alt={member.full_name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  {member.full_name}
                </div>
              </td>
              <td
                rowSpan={member.roles.length}
                className="px-4 py-3 border-gray-200"
              >
                {member.general_contact}
              </td>
              <td
                rowSpan={member.roles.length}
                className="px-4 py-3 border-gray-200"
              >
                {member.general_email}
              </td>
            </>
          )}
          <td className="px-4 py-3 capitalize border-gray-200">{role.type}</td>
          <td className="px-4 py-3 border-gray-200">{role.tower}</td>
          <td className="px-4 py-3 border-gray-200">{role.floor}</td>
          <td className="px-4 py-3 capitalize border-gray-200">{role.unit}</td>
          <td className="px-4 py-3 text-center border-gray-200">
            {idx === 0 && (
              <button
                onClick={() => onSelect(member)}
                className="bg-primary hover:bg-primaryDark text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200"
              >
                Add
              </button>
            )}
          </td>
        </tr>
      ))
    );

  return (
    <div className="fixed p-4 inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full md:max-w-[1100px] mx-4 max-h-[90vh] flex flex-col">
        <button
          onClick={() => {
            onClose();
            setSearchParams({});
          }}
          className="absolute -top-[8px] -right-[8px] p-2 rounded-full bg-primary text-white shadow-md hover:bg-primary/90 transition z-20"
        >
          <RxCross1 />
        </button>

        <Div className="flex flex-col gap-4 py-4">
          <Div className="flex justify-between items-center">
            <Heading title="Members List" size="lg" color="text-black" />
          </Div>
          <Div className="grid grid-cols-1 md:flex md:flex-wrap items-center gap-3 justify-start md:justify-end">
            <div className="w-full md:w-auto">
              <FilterSelect2
                placeholder="Select Type"
                options={selectUnit}
                paramKey="member_type"
                useUrlParams={true}
                onApply={(f) => {
                  // Filter is applied via URL params, no need for additional logic
                }}
              />
            </div>
            <div className="w-full md:w-[180px]">
              <TowerSelector
                placeholder="Tower"
                towers={towerOptions}
                value={filters.tower}
                onChange={handleTowerFilter}
                showSelected={false}
                multiSelect={true}
              />
            </div>
            <div className="w-full md:w-[180px]">
              <UnitSelector
                placeholder="Unit"
                units={filteredUnitOptions}
                selectedTowers={filters.tower}
                value={filters.unit}
                showSelected={false}
                onChange={handleUnitFilter}
              />
            </div>
            <div className="w-full md:w-auto">
              <SearchBar />
            </div>
          </Div>
        </Div>

        <div className="overflow-x-auto overflow-y-auto flex-1 mt-2 min-h-0">
          {showSkeleton ? (
            <div className="p-4">
              <TableSkeleton rows={5} columns={8} />
            </div>
          ) : groupedArray.length ? (
            <table className="w-full text-sm text-left rtl:text-right border border-borderLight rounded-lg overflow-hidden">
              <thead className="bg-primaryLight border-b border-primaryLight sticky top-0 z-10">
                <tr>
                  {[
                    "Name",
                    "Contact",
                    "Email",
                    "Type",
                    "Tower",
                    "Floor",
                    "Unit",
                    "Action"
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 font-semibold text-base text-left text-ink"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{renderRows()}</tbody>
            </table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No members available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddExistingCommMemberTable;

// import React, { useEffect, useState } from "react";
// import { FiX } from "react-icons/fi";
// import { useDispatch, useSelector } from "react-redux";
// import { fetchAddExistingMembers } from "../../../redux/slices/api/memberApi";
// import { Div } from "Components/Ui/Div";
// import SearchBar from "Components/Search/SearchBar";
// import Heading from "Components/HeadingComponent/Heading";
// import FilterSelect2 from "../../../Components/FilterSelect/FilterSelect2";
// import { useSearchParams } from "react-router-dom";
// import { fetchMemberTypeOptions } from "./memberTypeList";
// import { RxCross1 } from "react-icons/rx";

// const AddExistingCommMemberTable = ({ isOpen, onClose, onSelect }) => {
//   const BASE_URL = import.meta.env.VITE_BASE_API;
//   const dispatch = useDispatch();
//   const [selectUnit, setSelectUnit] = useState([]);
//   const [filters, setFilters] = useState({ member_type: [], search: "" });
//   const [searchParams, setSearchParams] = useSearchParams();

//   const allMemberData = useSelector((state) => state.member?.AddExistingCommMember) || {};

//   const allMembers = [
//     ...(allMemberData.owners || []),
//     ...(allMemberData.comm_members || []),
//     ...(allMemberData.resident_members || []),
//     ...(allMemberData.unit_staff || []),
//   ];

//   const getMemberValue = (member, key) => {
//     if (key === "member_type_name") {
//       if (member?.resident_member?.[key]) return "Resident";
//       if (member?.member?.[key] && !member?.unit_staff) return "Owner";
//       if (member?.member?.[key] && member?.unit_staff) return "Unit Staff";
//       return member?.[key] || "-";
//     }

//     return member?.resident_member?.[key] || member?.member?.[key] || member?.[key] || "-";
//   };

//   const groupedMembers = allMembers.reduce((acc, member) => {
//     const memberId = member?.id || member?.member?.id || member?.resident_member?.id;
//     if (!acc[memberId]) {
//       acc[memberId] = {
//         ...member,
//         locations: []
//       };
//     }
//     acc[memberId].locations.push({
//       type: getMemberValue(member, "member_type_name"),
//       tower: getMemberValue(member, "tower_name"),
//       floor: getMemberValue(member, "floor_no"),
//       unit: getMemberValue(member, "unit_name")
//     });
//     return acc;
//   }, {});

//   useEffect(() => {
//     const fetchOptions = async () => {
//       const options = await fetchMemberTypeOptions();
//       setSelectUnit(options);
//     };
//     fetchOptions();
//   }, []);

//   useEffect(() => {
//     const roleFilter = searchParams.get("member_type");
//     const searchQuery = searchParams.get("search");

//     const roleFilterArray = roleFilter
//       ? roleFilter.split(",").map((item) => (/^\d+$/.test(item) ? Number(item) : item))
//       : [];

//     const updatedFilters = {
//       member_type: roleFilterArray,
//       search: searchQuery || "",
//     };

//     setFilters(updatedFilters);
//     dispatch(fetchAddExistingMembers({ filters: updatedFilters }));
//   }, [searchParams, dispatch]);

//   if (!isOpen) return null;

//   const handleClose = () => {
//     onClose();
//     setSearchParams({});
//   };

//   const handleFilterApply = (filters) => {
//     if (!filters) {
//       console.error("Filters object is undefined");
//       return;
//     }
//     console.log("Applied Filters:", filters);
//   };

//   const renderMemberRow = (member, location, isMainRow = false) => (
//     <tr key={`${member?.id}-${location.type}-${isMainRow}`} className="bg-white hover:bg-gray-50">
//       {isMainRow ? (
//         <>
//           <td className="px-4 py-3 flex items-center gap-2 border-b border-gray-200">
//             <img
//               src={
//                 member?.photo ||
//                 member?.resident_member?.photo ||
//                 member?.member?.photo
//                   ? `${BASE_URL}${member?.photo || member?.resident_member?.photo || member?.member?.photo}`
//                   : "/user.jpg"
//               }
//               onError={(e) => (e.target.src = "/user.jpg")}
//               alt={getMemberValue(member, "full_name")}
//               className="w-8 h-8 rounded-full object-cover"
//             />
//             {getMemberValue(member, "full_name")}
//           </td>
//           <td className="px-4 py-3 border-b border-gray-200">
//             {getMemberValue(member, "general_contact")}
//           </td>
//           <td className="px-4 py-3 border-b border-gray-200">
//             {getMemberValue(member, "general_email")}
//           </td>
//         </>
//       ) : (
//         <>
//           <td className="px-4 py-3"></td>
//           <td className="px-4 py-3"></td>
//           <td className="px-4 py-3"></td>
//         </>
//       )}
//       <td className="px-4 py-3 capitalize border-b border-gray-200">{location.type}</td>
//       <td className="px-4 py-3 border-b border-gray-200">{location.tower}</td>
//       <td className="px-4 py-3 border-b border-gray-200">{location.floor}</td>
//       <td className="px-4 py-3 capitalize border-b border-gray-200">{location.unit}</td>
//       <td className={`px-4 py-3 text-center ${isMainRow ? 'border-b border-gray-200' : ''}`}>
//         {isMainRow && (
//           <button
//             onClick={() => onSelect(member)}
//             className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded text-sm"
//           >
//             Add
//           </button>
//         )}
//       </td>
//     </tr>
//   );

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
//       <div className="relative bg-white rounded-xl p-6 w-full md:max-w-[1100px] mx-4">
//         <button

//          onClick={() => {
//           onClose();
//           setSearchParams({});
//         }}

//                   className="absolute -top-[8px] -right-[8px] p-2 rounded-full bg-primary text-white shadow-md hover:bg-primary/90 transition z-20"
//         >
//           <RxCross1  />
//         </button>

//         <Div className="flex justify-between items-center py-4">
//           <Heading title="Members List" size="lg" color="text-black" />
//           <Div className="flex items-center space-x-4 px-5">
//             <FilterSelect2
//               placeholder="Select Type"
//               options={selectUnit}
//               paramKey="member_type"
//               onApply={handleFilterApply}
//             />
//             <SearchBar />
//           </Div>
//         </Div>

//         <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
//           {Object.values(groupedMembers).length > 0 ? (
//             <table className="min-w-full text-sm text-left border border-gray-200">
//               <thead className="bg-teal-50">
//                 <tr>
//                   {["Name", "Contact", "Email", "Type", "Tower", "Floor", "Unit", "Action"].map(
//                     (title, i) => (
//                       <th key={i} className="px-4 py-3 font-semibold text-gray-800 border-b">
//                         {title}
//                       </th>
//                     )
//                   )}
//                 </tr>
//               </thead>
//               <tbody>
//                 {Object.values(groupedMembers).map((member) => (
//                   <React.Fragment key={member?.id || member?.member?.id || member?.resident_member?.id}>
//                     {member.locations.map((location, index) =>
//                       renderMemberRow(member, location, index === 0)
//                     )}
//                   </React.Fragment>
//                 ))}
//               </tbody>
//             </table>
//           ) : (
//             <div className="text-center py-8 text-gray-500">No members available</div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// };
// export default AddExistingCommMemberTable;
