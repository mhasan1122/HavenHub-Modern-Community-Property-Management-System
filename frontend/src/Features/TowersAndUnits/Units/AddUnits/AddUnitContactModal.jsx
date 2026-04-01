import { useEffect, useState, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchUnitContacts } from "../../../../redux/slices/api/memberApi";
import { Div } from "Components/Ui/Div";
import SearchBar from "Components/Search/SearchBar";
import Heading from "Components/HeadingComponent/Heading";
import FilterSelect2 from "../../../../Components/FilterSelect/FilterSelect2";
import { useSearchParams } from "react-router-dom";
import { fetchMemberTypeOptions } from "../../../Members/MemberTable/memberTypeList";
import { RxCross1 } from "react-icons/rx";
import TableSkeleton from "../../../../Components/Loaders/TableSkeleton";
import useSkeletonLoading from "../../../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../../../config/skeletonLoadingConfig";
import user1 from "../../../../assets/user/user.png";

const AddUnitContactModal = ({ isOpen, onClose, onSelect, unitId }) => {
  const BASE_URL = import.meta.env.VITE_BASE_API;
  const dispatch = useDispatch();
  const [selectUnit, setSelectUnit] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Cache the fetched data to avoid refetching on every search change
  const cachedAllMembersRef = useRef([]);
  const hasFetchedRef = useRef(false);

  const memberState = useSelector((state) => state.member || {});
  const allMemberData = memberState.AddExistingCommMember || {};
  
  // The API returns nested structures: owners/residents/unit_staff contain member and unit info
  // We need to check unit ID from the owner/resident/unit_staff object, not the member
  // fetchAddExistingMembers already includes resident_members, so we don't need a separate fetch
  const allMembersFromAPI = [
    ...(allMemberData.owners || []),
    ...(allMemberData.comm_members || []),
    ...(allMemberData.resident_members || []),
    ...(allMemberData.unit_staff || []),
  ];
  
  // Cache the data when it's first loaded
  useEffect(() => {
    if (allMembersFromAPI.length > 0) {
      cachedAllMembersRef.current = allMembersFromAPI;
      hasFetchedRef.current = true;
    }
  }, [allMembersFromAPI.length]);
  
  // Use cached data if available, otherwise use API data
  // This allows us to do client-side filtering without refetching
  const allMembers = cachedAllMembersRef.current.length > 0 
    ? cachedAllMembersRef.current 
    : allMembersFromAPI;

  const getMemberValue = (member, key) => {
    if (key === "member_type_name") {
      // API already provides member_type_name correctly for all types (Owner, Resident, Resident (Tenant), Unit Staff)
      if (member?.member_type_name) {
        return member.member_type_name;
      }
      // Fallback logic if member_type_name is not provided (shouldn't happen with current API)
      if (member?.resident_member) {
        // Check if it's a tenant (is_resident_or_tenant = false)
        if (member?.is_resident_or_tenant === false) {
          return "Resident (Tenant)";
        }
        return "Resident";
      }
      // If no resident_member and has member, could be owner or unit staff
      // But since API should provide member_type_name, this is just a fallback
      return member?.member ? "Owner" : "-";
    }
    return member?.resident_member?.[key] || member?.member?.[key] || member?.[key] || "-";
  };

  // Get search and filter params for client-side filtering
  const searchQuery = searchParams.get("search") || "";
  const typeParam = searchParams.get("member_type");
  const memberTypeFilters = typeParam ? typeParam.split(",") : [];

  // Filter members to only show those associated with the current unit
  // Also apply client-side search and type filtering for better performance
  const unitMembers = useMemo(() => {
    if (!unitId || allMembers.length === 0) return [];
    
    let filtered = allMembers.filter((item) => {
      // The API response structure (after adding unit_id to serializers):
      // - owners: { member: {...}, unit_id: 123, unit_name: "...", ... }
      // - resident_members: { resident_member: {...}, unit_id: 123, unit_name: "...", ... }
      // - unit_staff: { member: {...}, unit_id: 123, unit_name: "...", ... }
      
      // Check unit ID from various possible locations
      const memberUnitId = 
        item?.unit_id ||            // Direct unit_id field (now added to serializers)
        item?.unit?.id ||           // Direct unit object (fallback)
        item?.resident_member?.unit_id ||   // From resident_member.unit_id
        item?.resident_member?.unit?.id ||  // From resident_member.unit (fallback)
        item?.member?.unit_id ||    // From member.unit_id (if nested)
        item?.member?.unit?.id;     // From member.unit (if nested, fallback)
      
      // Convert both to strings for comparison (handle both number and string IDs)
      const unitIdStr = String(unitId);
      const memberUnitIdStr = memberUnitId ? String(memberUnitId) : null;
      
      return memberUnitIdStr === unitIdStr;
    });
    
    // Apply client-side search filtering (works for any length, not just 3+ chars)
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((item) => {
        const fullName = getMemberValue(item, "full_name")?.toLowerCase() || "";
        const contact = getMemberValue(item, "general_contact")?.toLowerCase() || "";
        const email = getMemberValue(item, "general_email")?.toLowerCase() || "";
        return fullName.includes(searchLower) || 
               contact.includes(searchLower) || 
               email.includes(searchLower);
      });
    }
    
    // Apply client-side member type filtering
    if (memberTypeFilters.length > 0) {
      // Map URL filter values to display names used in the data
      // URL uses: owner, resident, resident_tenant, unit_staff
      // Data uses: Owner, Resident, Resident (Tenant), Unit Staff
      const mapFilterValueToDisplayName = (filterValue) => {
        const value = String(filterValue).toLowerCase().trim();
        const mapping = {
          "owner": "owner",
          "resident": "resident",
          "resident_tenant": "resident (tenant)",
          "unit_staff": "unit staff"
        };
        return mapping[value] || value;
      };

      filtered = filtered.filter((item) => {
        const memberTypeName = getMemberValue(item, "member_type_name")?.toLowerCase().trim() || "";
        return memberTypeFilters.some((selectedType) => {
          const mappedDisplayName = mapFilterValueToDisplayName(selectedType);
          // Exact match between role type (lowercased) and mapped display name
          return memberTypeName === mappedDisplayName;
        });
      });
    }
    
    return filtered;
  }, [allMembers, unitId, searchQuery, memberTypeFilters]);

  const groupedMembers = useMemo(() => {
    return unitMembers.reduce((acc, item) => {
      // Get member ID from various possible locations
      const id = item?.resident_member?.id || item?.member?.id || item?.id;
      if (!acc[id]) {
        acc[id] = {
          id,
          full_name: getMemberValue(item, "full_name"),
          general_contact: getMemberValue(item, "general_contact"),
          general_email: getMemberValue(item, "general_email"),
          photo: item?.photo || item?.resident_member?.photo || item?.member?.photo,
          roles: [],
        };
      }
      acc[id].roles.push({
        type: getMemberValue(item, "member_type_name"),
        tower: getMemberValue(item, "tower_name"),
        floor: getMemberValue(item, "floor_no"),
        unit: getMemberValue(item, "unit_name"),
        unitId: item?.unit?.id || item?.unit_id || getMemberValue(item, "unit_name"),
        status: item.status || item?.resident_member?.status || item?.member?.status || "-",
      });
      return acc;
    }, {});
  }, [unitMembers, allMembers.length]);

  const groupedArray = Object.values(groupedMembers);

  // Apply skeleton loading delay so the popup table skeleton is visible on fast responses
  const showSkeleton = useSkeletonLoading(
    memberState.loading,
    groupedArray,
    SKELETON_MIN_DISPLAY_TIME
  );

  useEffect(() => {
    fetchMemberTypeOptions().then(setSelectUnit);
  }, []);

  // Fetch data only once when modal opens (not on every search/filter change)
  // Using the optimized unit-specific endpoint for much better performance
  useEffect(() => {
    if (isOpen && unitId) {
      // Only fetch if we don't have cached data yet
      if (!hasFetchedRef.current || cachedAllMembersRef.current.length === 0) {
        // Use the optimized endpoint that filters by unit_id at database level
        // This is much faster than fetching all records and filtering client-side
        dispatch(fetchUnitContacts({ 
          unitId, 
          filters: { member_type: [], search: "" } 
        }));
      }
    }
  }, [isOpen, unitId, dispatch]);

  // Reset cache and flags when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Clear cache when modal closes so fresh data is fetched next time
      cachedAllMembersRef.current = [];
      hasFetchedRef.current = false;
      setSearchParams({});
    }
  }, [isOpen, setSearchParams]);

  if (!isOpen) return null;

  const renderRows = () =>
    groupedArray.map((member) =>
      member.roles.map((role, idx) => (
        <tr
          key={`${member.id}-${idx}`}
          className={idx === 0 ? "bg-white border-t hover:bg-gray-50" : "bg-white hover:bg-gray-50"}
        >
          {idx === 0 && (
            <>
              <td rowSpan={member.roles.length} className="px-4 py-3 border-gray-200">
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
              <td rowSpan={member.roles.length} className="px-4 py-3 border-gray-200">{member.general_contact}</td>
              <td rowSpan={member.roles.length} className="px-4 py-3 border-gray-200">{member.general_email}</td>
            </>
          )}
          <td className="px-4 py-3 capitalize border-gray-200">{role.type}</td>
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
    <div className="fixed inset-0 z-50 flex items-center px-2 justify-center bg-black bg-opacity-50 backdrop-blur-sm">
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
            <Heading title="Unit Contacts" size="lg" color="text-black" />
          </Div>
          <Div className="flex flex-wrap items-center gap-3 justify-end">
            <FilterSelect2
              placeholder="Select Type"
              options={selectUnit}
              paramKey="member_type"
              onApply={(f) => console.log("Filter Applied:", f)}
            />
            <SearchBar />
          </Div>
        </Div>

        <div className="overflow-x-auto overflow-y-auto flex-1 mt-2 min-h-0">
          {showSkeleton ? (
            <div className="p-4">
              <TableSkeleton rows={5} columns={5} />
            </div>
          ) : groupedArray.length ? (
            <table className="w-full text-sm text-left rtl:text-right border border-borderLight rounded-lg overflow-hidden">
              <thead className="bg-primaryLight border-b border-primaryLight sticky top-0 z-10">
                <tr>
                  {["Name", "Contact", "Email", "Type", "Action"].map(
                    (h) => (
                      <th key={h} className="px-4 py-3 font-semibold text-base text-left text-ink">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>{renderRows()}</tbody>
            </table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No members available for this unit
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddUnitContactModal;

