import React, { useState, useEffect, useRef } from "react";
import { FaSearch, FaTimes } from "react-icons/fa";
import axios from "axios";
import TableSkeleton from "../Loaders/TableSkeleton";
import useSkeletonLoading from "../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../config/skeletonLoadingConfig";

const baseURL = import.meta.env.VITE_BASE_API || "http://127.0.0.1:8000";

const TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "Community Member", label: "Community Member" },
  { value: "Organization Member", label: "Organization Member" },
  { value: "Company", label: "Company" },
];

const MemberSearchAutocomplete = ({
  value = "",
  memberId = "",
  onSelect,
  unitId = null,
  isOwnerSearch = false,
  disabled = false,
  readOnly = false,
  isDisabled = false,
  hideClearButton = false,
  hideSearchIcon = false,
  radioGroupId = "default"
}) => {
  const [searchTerm, setSearchTerm] = useState(value);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedMember, setSelectedMember] = useState(
    memberId && value ? { id: memberId, full_name: value } : null
  );
  const [selectedType, setSelectedType] = useState("all");
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef(null);

  // Update input from parent on mount or prop change
  useEffect(() => {
    setSearchTerm(value);
    if (memberId && value) {
      setSelectedMember({ id: memberId, full_name: value });
    }
  }, [value, memberId]);

  useEffect(() => {
    // Don't fetch if disabled, has selected member, or not focused
    if (selectedMember || disabled || isDisabled || !isFocused) {
      if (!isFocused) {
        setMembers([]);
        setError("");
      }
      return;
    }

    // Fetch members when focused, even if searchTerm is empty
    const fetchMembers = async () => {
      setLoading(true);
      setError("");
      try {
        // Use searchTerm if available, otherwise use empty string to get all members
        const searchQuery = searchTerm.trim().length > 0 ? searchTerm : "";
        let url = `${baseURL}/towers/add_owner_search/?search=${encodeURIComponent(searchQuery)}`;
        if (isOwnerSearch && unitId) {
          url += `&unit_id=${unitId}`;
        }
        const res = await axios.get(url);
        
        // Group members by ID and combine their roles and locations
        const groupedMembers = res.data?.member_data?.reduce((acc, current) => {
          const existingMember = acc.find(item => item.id === current.id);
          if (!existingMember) {
            // Store locations as array of {tower, unit, role}
            return acc.concat([{
              ...current,
              locations: [{
                tower: current.tower,
                unit: current.unit,
                role: Array.isArray(current.roles) ? current.roles[0] : current.roles
              }]
            }]);
          } else {
            // Add new location with its specific role
            const alreadyExists = existingMember.locations.some(loc =>
              loc.tower === current.tower && loc.unit === current.unit && loc.role === (Array.isArray(current.roles) ? current.roles[0] : current.roles)
            );
            if (!alreadyExists) {
              existingMember.locations.push({
                tower: current.tower,
                unit: current.unit,
                role: Array.isArray(current.roles) ? current.roles[0] : current.roles
              });
            }
            return acc;
          }
        }, []) || [];
        
        setMembers(groupedMembers);
      } catch (err) {
        console.error("Failed to fetch members:", err);
        setMembers([]);
        setError("Failed to load members. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    const delay = setTimeout(fetchMembers, 300);
    return () => clearTimeout(delay);
  }, [searchTerm, selectedMember, isOwnerSearch, unitId, disabled, isDisabled, isFocused]);

  // Ensure a minimum skeleton display time for the popup results
  const showSkeleton = useSkeletonLoading(
    loading,
    members,
    SKELETON_MIN_DISPLAY_TIME
  );

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsFocused(false);
      }
    };

    if (isFocused) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isFocused]);

  const handleSelect = (member) => {
    if (disabled || isDisabled) return;
    setSelectedMember(member);
    setSearchTerm(member.full_name);
    setMembers([]);
    setIsFocused(false);
    if (onSelect) onSelect(member);
  };

  const handleClear = () => {
    if (disabled || isDisabled) return;
    setSelectedMember(null);
    setSearchTerm("");
    setMembers([]);
    setIsFocused(false);
    if (onSelect) onSelect({ id: "", full_name: "" });
  };

  // Helper function to format locations
  const formatLocations = (member) => {
    if (member.locations && member.locations.length > 0) {
      return member.locations.map(loc => 
        `${loc.tower || '—'} / ${loc.unit || '—'}`
      ).join(', ');
    }
    return `${member.tower || '—'} / ${member.unit || '—'}`;
  };

  // Filtered members by selectedType
  const filteredMembers = members.map(member => {
    // Check member's different roles across all locations
    const isCompany = member.locations.some(l => l.role === "Company");
    const isOwner = member.locations.some(l => l.role === "Owner");
    const isOrganizationMember = member.locations.some(l => l.role === "Management");
    const isResident = member.locations.some(l => l.role === "Resident" || l.role === "Resident (Tenant)");
    const isUnitStaff = member.locations.some(l => l.role === "Unit Staff");
    
    // For community members: not a company AND not organization member
    const isCommunityMember = !isCompany && !isOrganizationMember && (isOwner || isResident || isUnitStaff);
    
    const ownerLocation = isOwner ? member.locations.find(l => l.role === "Owner") : null;

    return {
      ...member,
      _isCompany: isCompany, // Store company flag for later use in rendering
      locations: member.locations.filter(loc => {
        // If isOwnerSearch is true, only show owners but respect the radio button filter
        if (isOwnerSearch) {
          // Must be an owner role
          if (loc.role !== "Owner") {
            return false;
          }
          
          // Apply radio button filter on top of owner requirement
          if (selectedType === "all") {
            return true; // Show all owners
          }
          
          if (selectedType === "Community Member") {
            // Show only community member owners (not company, not org member)
            return isCommunityMember;
          }
          
          if (selectedType === "Organization Member") {
            // Show only organization members who are owners
            return isOrganizationMember;
          }
          
          if (selectedType === "Company") {
            // Show only company owners
            return isCompany;
          }
          
          return false;
        }
        
        // Otherwise (isOwnerSearch is false), apply the selected type filter
        if (selectedType === "all") {
          // For companies that are also owners, prefer showing Owner role
          if (isCompany && isOwner) {
            return loc.role === "Owner";
          }
          // Show all non-company roles
          return loc.role !== "Company";
        }
        
        if (selectedType === "Community Member") {
          // Show only community members (not company, not org member)
          // Include Owner, Resident, Resident (Tenant), and Unit Staff roles
          if (!isCommunityMember) {
            return false;
          }
          return (
            loc.role === "Owner" ||
            loc.role === "Resident" ||
            loc.role === "Resident (Tenant)" ||
            loc.role === "Unit Staff"
          );
        }
        
        if (selectedType === "Organization Member") {
          // Show only Management role
          return loc.role === "Management";
        }
        
        if (selectedType === "Company") {
          // Show only companies
          // If company is also an owner, prefer showing Owner role
          if (isCompany && isOwner) {
            return loc.role === "Owner";
          }
          // Otherwise show Company role
          return loc.role === "Company";
        }
        
        return false;
      }).map(loc => {
        // If in Company filter and this is a company-owner, ensure we show "Owner" role
        if (selectedType === "Company" && isCompany && isOwner && loc.role === "Owner") {
          return {
            ...loc,
            tower: loc.tower || ownerLocation?.tower,
            unit: loc.unit || ownerLocation?.unit,
            role: "Owner"
          };
        }
        return loc;
      })
    };
  }).filter(member => member.locations.length > 0);

  return (
    <div ref={containerRef} className="relative bg-white p-0 w-full">
      <div className="relative mb-4">
        {!hideSearchIcon && (
          <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none z-10">
            <FaSearch className={`${disabled || isDisabled ? 'text-gray-400' : 'text-gray-500'}`} size={16} />
          </span>
        )}
        <input
          type="text"
          placeholder="Enter Name"
          value={searchTerm}
          onChange={e => {
            if (disabled || isDisabled) return;
            setSearchTerm(e.target.value);
            setSelectedMember(null);
          }}
          onFocus={() => {
            if (!disabled && !isDisabled && !selectedMember) {
              setIsFocused(true);
            }
          }}
          className={`login-field-input ${hideSearchIcon ? 'pl-4' : 'pl-10'} pr-9 ${disabled || isDisabled ? 'bg-disabledInput cursor-not-allowed text-black100' : ''}`}
          disabled={disabled || isDisabled || !!selectedMember}
          readOnly={readOnly}
          autoFocus={false}
          tabIndex={hideSearchIcon ? 1 : undefined}
        />
        {selectedMember && !disabled && !isDisabled && !hideClearButton && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 z-10"
            onClick={handleClear}
            title="Clear selection"
          >
            <FaTimes />
          </button>
        )}
      </div>

      {isFocused && !selectedMember && !disabled && !isDisabled && (
        <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3">
              {TYPE_OPTIONS.map((option) => {
                const checked = selectedType === option.value;
                return (
                  <label 
                    key={option.value} 
                    className="flex items-center gap-2 cursor-pointer select-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="radio"
                      name={`member-type-filter-${radioGroupId}`}
                      value={option.value}
                      checked={checked}
                      onChange={() => setSelectedType(option.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="peer sr-only"
                    />
                    <span
                      className={`inline-block w-[16px] h-[16px] rounded-full border border-primary ${checked ? 'bg-[radial-gradient(rgb(60,157,155)_6px,transparent_7px)]' : 'bg-transparent'}`}
                    />
                    <span className="text-[15px] [font-family:Inter,ui-sans-serif,system-ui] text-textLabel">
                      {option.label}
                    </span>
                  </label>
                );
              })}
            </div>

          <div className="mb-2">
            <span className="text-[16px] font-bold [font-family:Lato,ui-sans-serif,system-ui] text-textDark">
              Members
            </span>
          </div>

          <div className="rounded-lg max-h-[50vh] overflow-hidden border border-borderTable bg-white w-full max-w-full">
            <div
              className="grid items-center px-4 h-12 bg-gray-50 border-b border-borderTable [grid-template-columns:2fr_1.2fr_1.2fr_0.8fr]"
            >
              <span className="text-[14px] font-bold whitespace-nowrap [font-family:Lato] text-primary">
                Name
              </span>
              <span className="text-[14px] font-bold whitespace-nowrap [font-family:Lato] text-primary">
                Type
              </span>
              <span className="text-[14px] font-bold whitespace-nowrap [font-family:Lato] text-primary">
                Tower
              </span>
              <span className="text-[14px] font-bold whitespace-nowrap [font-family:Lato] text-primary">
                Unit
              </span>
            </div>
            <div className="max-h-[calc(50vh-48px)] overflow-y-auto">
            {showSkeleton ? (
              <div className="p-4">
                <TableSkeleton rows={4} columns={4} />
              </div>
            ) : error ? (
              <div className="py-4 text-center text-sm text-red-500">{error}</div>
            ) : filteredMembers.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">No members found.</div>
            ) : (
              <ul>
                {(() => {
                  // Flatten rows: each location as a row, with group borders between different members
                  const rows = [];
                  filteredMembers.forEach((member, mIdx) => {
                    member.locations.forEach((loc, lIdx) => {
                      rows.push({
                        key: `${member.id}-${loc.tower || ""}-${loc.unit || ""}-${loc.role || ""}-${lIdx}`,
                        member,
                        loc,
                        isGroupStart: lIdx === 0
                      });
                    });
                  });
                  return rows.map((row, idx) => {
                    const showGroupBorderTop = row.isGroupStart && idx !== 0;
                      const showName = row.isGroupStart ? row.member.full_name || "—" : "-";
                    // Check if member is a company and role is Owner
                    const isCompany = row.member._isCompany || false;
                    const displayRole = row.loc.role === "Owner" && isCompany 
                      ? "Owner (Company)" 
                      : (row.loc.role || "—");
                    return (
                      <li
                        key={row.key}
                          className={`grid items-center px-4 h-12 cursor-pointer hover:bg-primaryLight transition-colors duration-150 ${
                            showGroupBorderTop ? "border-t border-borderTable" : ""
                          } [grid-template-columns:2fr_1.2fr_1.2fr_0.8fr]`}
                        onClick={() =>
                          handleSelect({
                            ...row.member,
                            tower: row.loc.tower,
                            unit: row.loc.unit,
                            roles: [row.loc.role]
                          })
                        }
                      >
                          <span className="text-[14px] whitespace-nowrap overflow-hidden text-ellipsis [font-family:Lato] text-textTable">
                            {showName}
                          </span>
                          <span className="text-[14px] whitespace-nowrap overflow-hidden text-ellipsis [font-family:Lato] text-textTable">
                            {displayRole}
                          </span>
                          <span className="text-[14px] whitespace-nowrap overflow-hidden text-ellipsis [font-family:Lato] text-textTable">
                            {row.loc.tower || "—"}
                          </span>
                          <span className="text-[14px] whitespace-nowrap overflow-hidden text-ellipsis [font-family:Lato] text-textTable">
                            {row.loc.unit || "—"}
                          </span>
                      </li>
                    );
                  });
                })()}
              </ul>
            )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MemberSearchAutocomplete;