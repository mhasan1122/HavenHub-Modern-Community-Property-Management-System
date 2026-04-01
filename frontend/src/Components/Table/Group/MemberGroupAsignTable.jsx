import React, { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchMemberTypes,
  fetchGroupMembers,
  setSelectedMemberIds,
  toggleSelectAll
} from "../../../redux/slices/groups/groupSlice";
import "./GroupTable.css";
import FilterSelect1 from "../../FilterSelect1/FilterSelect1";
import SearchBar from "../../Search/SearchBar";
import Heading from "../../HeadingComponent/Heading";
import CheckboxComponent from "../../FormComponent/CheckboxComponent";
import Status from "Components/Text/Status";
import ActiveStatusButton from "../../Buttons/ActiveStatusButton";
import TableSkeleton from "../../Loaders/TableSkeleton";
import useSkeletonLoading from "../../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../../config/skeletonLoadingConfig";
import user1 from "../../../assets/user/user.png";

const MemberGroupAsignTable = ({
  onSelectionChange,
  setIsFormChangedFirstTab,
  updateChangedFields,
  groupId
}) => {
  const dispatch = useDispatch();

  // Get members, roles, member types, loading flag, and selected member IDs from Redux.
  const members = useSelector((state) => state.group.members);
  const rolesFromRedux = useSelector((state) => state.group.roles);
  const memberTypesFromRedux = useSelector((state) => state.group.memberTypes);
  const [initialSelectedInactive, setInitialSelectedInactive] = useState([]);

  const selectedMemberIds = useSelector(
    (state) => state.group.selectedMemberIds
  );
  const loading = useSelector((state) => state.group.loading);

  // Local state for search and filter controls.
  const [search, setSearch] = useState("");
  const [appliedMemberType, setAppliedMemberType] = useState("");
  const [appliedRole, setAppliedRole] = useState("");
  const [selectAll, setSelectAll] = useState(false);
  const [member_check, setMember_check] = useState([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  // Fetch member types on mount.
  useEffect(() => {
    dispatch(fetchMemberTypes());
  }, [dispatch]);

  // Fetch members whenever filters or search change.
  useEffect(() => {
    dispatch(
      fetchGroupMembers({
        member_type: appliedMemberType,
        role: appliedRole,
        search: search
      })
    )
      .unwrap()
      .catch((error) => {
        console.error("Error fetching group members:", error);
      });
  }, [dispatch, appliedMemberType, appliedRole, search]);

  // --- Selection Handlers ---
 const handleSelectAllToggle = () => {
  const newSelectAll = !selectAll;
  setSelectAll(newSelectAll);

  const newSelected = newSelectAll
    ? members
        .filter((m) => m.is_org_member) // ✅ Only active members
        .map((m) => m.id)
    : [];

  dispatch(toggleSelectAll(newSelected));
  if (onSelectionChange) onSelectionChange(newSelected);

  updateChangedFields(setIsFormChangedFirstTab, "member_check", newSelected);
};


  const handleCheckboxChange = (e, memberId) => {
    e.stopPropagation(); // Prevent row click from firing
    const { checked, name } = e.target;
    let newSelected;
    if (checked) {
      newSelected = [...selectedMemberIds, memberId];
    } else {
      newSelected = selectedMemberIds.filter((id) => id !== memberId);
      setSelectAll(false);
    }
    dispatch(setSelectedMemberIds(newSelected));
    // updateChangedFields(setIsFormChangedFirstTab,'member_check', memberId);
    setMember_check((prev) => {
      let updated;
      if (prev.includes(memberId)) {
        updated = prev.filter((id) => id !== memberId);
      } else {
        updated = [...prev, memberId];
      }

      updateChangedFields(setIsFormChangedFirstTab, "member_check", updated);

      return updated;
    });

    if (onSelectionChange) onSelectionChange(newSelected);
  };

  // Handle row click to toggle checkbox
  const handleRowClick = (memberId) => {
    const isSelected = selectedMemberIds.includes(memberId);
    const newSelected = isSelected
      ? selectedMemberIds.filter((id) => id !== memberId)
      : [...selectedMemberIds, memberId];
    
    if (!isSelected) {
      setSelectAll(false);
    }
    
    dispatch(setSelectedMemberIds(newSelected));
    
    setMember_check((prev) => {
      let updated;
      if (prev.includes(memberId)) {
        updated = prev.filter((id) => id !== memberId);
      } else {
        updated = [...prev, memberId];
      }

      updateChangedFields(setIsFormChangedFirstTab, "member_check", updated);

      return updated;
    });

    if (onSelectionChange) onSelectionChange(newSelected);
  };

  // Build member types options for the filter.
  const memberTypesOptions = memberTypesFromRedux.map((type) => ({
    label: type.type_name,
    value: type.id
  }));

  // Build role options including "Other" and "All" to support new filtering.
  const memberRoleOptions = [
    ...rolesFromRedux
      .filter((role) => role.is_active)
      .map((role) => ({
        label: role.role_name,
        value: role.id.toString()
      })),
    { label: "Other", value: "other" }
  ];





 useEffect(() => {
  if (groupId && members.length > 0 && initialSelectedInactive.length === 0) {
    const selectedInactive = members.filter(
      (member) =>
        !member.is_org_member && selectedMemberIds.includes(member.id)
    );
    setInitialSelectedInactive(selectedInactive.map((m) => m.id));
  }
}, [groupId, members]); // ✅ removed selectedMemberIds






 const filteredMembers = useMemo(() => {
  return members
    .filter((member) => {
      const wasInitiallySelected = initialSelectedInactive.includes(member.id);

      if (groupId) {
        return member.is_org_member || wasInitiallySelected;
      }

      return member.is_org_member;
    })
    .sort((a, b) => {
      // If groupId exists, prioritize selected members at the top
      if (groupId) {
        const aIsSelected = selectedMemberIds.includes(a.id);
        const bIsSelected = selectedMemberIds.includes(b.id);
        
        if (aIsSelected && !bIsSelected) return -1;
        if (!aIsSelected && bIsSelected) return 1;
      }
      return 0; // Maintain original order for non-selected members
    });
}, [members, groupId, selectedMemberIds, initialSelectedInactive]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMembers = filteredMembers.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, appliedMemberType, appliedRole]);

  // Use skeleton loading hook for the table only
  const showSkeleton = useSkeletonLoading(
    loading,
    members,
    SKELETON_MIN_DISPLAY_TIME
  );

  return (
    <div className="bg-white rounded-27 sm:py-[24px] sm:px-[24px]">
      <div className="pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 py-2">
          <Heading color="black" size="lg" title="Select Members" />
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 sm:space-x-0 w-full sm:w-auto">
            <FilterSelect1
              placeholder="Member type"
              options={memberTypesOptions}
              paramKey="member-type"
              useUrlParams={false}
              onApply={setAppliedMemberType}
            />
            <FilterSelect1
              placeholder="Role"
              options={memberRoleOptions}
              paramKey="role"
              useUrlParams={false}
              onApply={setAppliedRole}
            />
            <SearchBar updateUrl={false} onSearch={setSearch} />
          </div>
        </div>
      </div>
      {showSkeleton ? (
        <TableSkeleton rows={10} columns={7} />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block relative overflow-x-auto max-h-[70vh] overflow-y-auto custom-scrollbar bg-white">
            <table className="w-full text-base text-left rtl:text-right">
              <thead className="bg-subprimary border-b border-subprimary sticky top-0 z-10">
                <tr className="h-11">
                  <th className="px-2 py-2 text-base font-bold text-left">
                    <CheckboxComponent
                      checked={selectAll}
                      onChange={handleSelectAllToggle}
                      value="all"
                    />
                  </th>
                  <th className="px-2 py-2 text-base font-bold text-left">
                    Name
                  </th>
                  <th className="px-2 py-2 text-base font-bold text-left">
                    Contact
                  </th>
                  <th className="px-2 py-2 text-base font-bold text-left">
                    Type
                  </th>
                  <th className="px-2 py-2 text-base font-bold text-left">
                    Email
                  </th>
                  <th className="px-2 py-2 text-base font-bold text-center">
                    Status
                  </th>
                  <th className="px-2 py-2 text-base font-bold text-left">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedMembers.length > 0 ? (
                  paginatedMembers.map((member) => (
                    <tr
                      key={member.id}
                      className="bg-white border-b hover:bg-gray-50 transition-colors duration-150 h-11 cursor-pointer"
                      onClick={() => handleRowClick(member.id)}
                    >
                      <td className="px-2 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                        <CheckboxComponent
                          checked={selectedMemberIds.includes(member.id)}
                          onChange={(e) => handleCheckboxChange(e, member.id)}
                          value="all"
                        />
                      </td>
                      <td className="px-2 py-2 text-sm whitespace-nowrap">
                        <div className="flex items-center">
                          <img
                            src={member.image || user1}
                            alt="User"
                            onError={(e) => {
                              e.target.src = user1;
                            }}
                            className="w-10 h-10 mr-2 rounded-full object-cover flex-shrink-0"
                          />
                          {member.name}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-sm whitespace-nowrap">{member.general_contact}</td>
                      <td className="px-2 py-2 text-sm whitespace-nowrap">{member.type}</td>
                      <td className="px-2 py-2 text-sm whitespace-nowrap">{member.general_email}</td>
                      <td className="px-2 py-2 text-center">
                        <ActiveStatusButton
                          isActive={member.is_org_member}
                          className="table-status-button"
                        />
                      </td>
                      <td className="px-2 py-2 text-sm whitespace-nowrap">{member.role}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center py-4">
                      No results found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-3">
            {paginatedMembers.length > 0 ? (
              paginatedMembers.map((member) => {
                const isSelected = selectedMemberIds.includes(member.id);
                return (
                  <div
                    key={member.id}
                    className={`bg-white rounded-lg border-2 p-4 cursor-pointer transition-all duration-300 ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-gray-200 hover:border-primary/50 hover:shadow-md'
                    }`}
                    onClick={() => handleRowClick(member.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center flex-1 min-w-0">
                        <div
                          className="mr-3 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <CheckboxComponent
                            checked={isSelected}
                            onChange={(e) => handleCheckboxChange(e, member.id)}
                            value="all"
                          />
                        </div>
                        <img
                          src={member.image || user1}
                          alt="User"
                          onError={(e) => {
                            e.target.src = user1;
                          }}
                          className="w-12 h-12 mr-3 rounded-full object-cover flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-gray-900 truncate">
                            {member.name}
                          </h3>
                          <div className="mt-1">
                            <ActiveStatusButton
                              isActive={member.is_org_member}
                              size="xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2 pt-3 border-t border-gray-100">
                      {member.general_contact && (
                        <div className="flex items-center text-sm">
                          <span className="text-gray-500 font-medium w-20 flex-shrink-0">Contact:</span>
                          <span className="text-gray-900 truncate">{member.general_contact}</span>
                        </div>
                      )}
                      {member.general_email && (
                        <div className="flex items-center text-sm">
                          <span className="text-gray-500 font-medium w-20 flex-shrink-0">Email:</span>
                          <span className="text-gray-900 truncate">{member.general_email}</span>
                        </div>
                      )}
                      {member.type && (
                        <div className="flex items-center text-sm">
                          <span className="text-gray-500 font-medium w-20 flex-shrink-0">Type:</span>
                          <span className="text-gray-900">{member.type}</span>
                        </div>
                      )}
                      {member.role && (
                        <div className="flex items-center text-sm">
                          <span className="text-gray-500 font-medium w-20 flex-shrink-0">Role:</span>
                          <span className="text-gray-900">{member.role}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-white rounded-lg p-6 text-center text-gray-500">
                No results found
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Pagination - Only show when skeleton is not visible */}
      {!showSkeleton && filteredMembers.length > itemsPerPage && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600 text-center sm:text-left">
            Showing {startIndex + 1} to {Math.min(endIndex, filteredMembers.length)} of {filteredMembers.length} members
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentPage(prev => Math.max(1, prev - 1));
              }}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded border ${
                currentPage === 1
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCurrentPage(page);
                      }}
                      className={`px-3 py-1 rounded border ${
                        currentPage === page
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {page}
                    </button>
                  );
                } else if (
                  page === currentPage - 2 ||
                  page === currentPage + 2
                ) {
                  return <span key={page} className="px-2">...</span>;
                }
                return null;
              })}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentPage(prev => Math.min(totalPages, prev + 1));
              }}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded border ${
                currentPage === totalPages
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberGroupAsignTable;
