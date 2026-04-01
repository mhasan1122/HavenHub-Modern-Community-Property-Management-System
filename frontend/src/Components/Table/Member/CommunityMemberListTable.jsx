import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useLocation, useNavigate } from "react-router-dom";
import user1 from "../../../assets/user/user.png";
import { setActiveTabs } from "../../../redux/slices/memberSlice";
import { useDispatch } from "react-redux";
import NoData from "../NoData";
import ActiveStatusButton from "../../../Components/Buttons/ActiveStatusButton";

const baseURL = import.meta.env.VITE_BASE_API;

// Helper function to format member type for display
const formatMemberType = (type) => {
  if (!type) return "—";
  
  const typeMap = {
    owner: "Owner",
    resident: "Resident",
    resident_tenant: "Resident (Tenant)",
    staff: "Staff"
  };
  
  return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
};

const CommunityMemberListTable = ({ members }) => {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const hasMembers = Array.isArray(members) && members.length > 0;

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Group members by ID and collect their locations
  const groupedMembers = members.reduce((acc, member) => {
    if (!acc[member.id]) {
      acc[member.id] = {
        ...member,
        locations: []
      };
    }
    acc[member.id].locations.push({
      type: member.type,
      tower: member.tower,
      unit: member.unit
    });
    return acc;
  }, {});

  const groupedMembersArray = Object.values(groupedMembers);

  // Reset to page 1 when members list changes
  useEffect(() => {
    setCurrentPage(1);
  }, [members]);

  // Pagination calculations based on grouped members
  const totalPages = Math.ceil((groupedMembersArray?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMembers = groupedMembersArray?.slice(startIndex, endIndex) || [];

  // Flatten rows: each location as a row, with group borders between different members
  const flattenedRows = [];
  paginatedMembers.forEach((member, mIdx) => {
    member.locations.forEach((loc, lIdx) => {
      flattenedRows.push({
        key: `${member.id}-${loc.tower || ""}-${loc.unit || ""}-${lIdx}`,
        member,
        location: loc,
        isGroupStart: lIdx === 0,
        memberIndex: mIdx
      });
    });
  });

  return (
    <div className="w-full">
      {/* Desktop Table View */}
      <div className="hidden lg:block relative overflow-x-auto max-h-[70vh] custom-scrollbar overflow-y-auto bg-white">
        <table className="w-full text-base text-left rtl:text-right">
          <thead className="bg-subprimary border-b border-subprimary sticky top-0 z-10">
            <tr className="h-11">
              <th className="px-2 py-2 text-base font-bold text-left">Name</th>
              <th className="px-2 py-2 text-base font-bold text-left">
                Contact
              </th>
              <th className="px-2 py-2 text-base font-bold text-left">
                Email
              </th>
              <th className="px-2 py-2 text-base font-bold text-left">Type</th>
              {/* <th className="px-2 py-2 text-base font-bold text-left">
                Occupation
              </th> */}
              <th className="px-2 py-2 text-base font-bold text-left">
                Tower
              </th>
              <th className="px-2 py-2 text-base font-bold text-left">Unit</th>
              <th className="px-2 py-2 text-base font-bold text-center">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {flattenedRows.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-4">
                  <NoData />
                </td>
              </tr>
            ) : (
              flattenedRows.map((row, idx) => {
                const showGroupBorderTop = row.isGroupStart && idx !== 0;
                const showName = row.isGroupStart ? row.member.full_name || "—" : "—";
                const showContact = row.isGroupStart ? row.member.general_contact || "—" : "—";
                const showEmail = row.isGroupStart ? row.member.general_email || "—" : "—";
                const showStatus = row.isGroupStart;

                return (
                  <tr
                    key={row.key}
                    className={`bg-white hover:bg-gray-50 transition-colors duration-150 h-11 cursor-pointer ${
                      showGroupBorderTop ? "border-t border-borderTable" : ""
                    }`}
                    onClick={() => {
                      dispatch(setActiveTabs(1));
                      navigate(`/member-profile/${row.member.id}`, {
                        state: { from: location.pathname }
                      });
                    }}
                  >
                    <td className="px-2 py-2 text-sm whitespace-nowrap">
                      {row.isGroupStart ? (
                        <div className="flex items-center">
                          <img
                            src={
                              row.member.photo ? `${baseURL}${row.member.photo}` : user1
                            }
                            alt="User"
                            className="w-10 h-10 rounded-full mr-2 object-cover"
                          />
                          {showName}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-sm whitespace-nowrap">
                      {showContact !== "—" ? showContact : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-2 py-2 text-sm whitespace-nowrap">
                      {showEmail !== "—" ? showEmail : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-2 py-2 text-sm whitespace-nowrap">
                      {formatMemberType(row.location.type)}
                    </td>
                    <td className="px-2 py-2 text-sm whitespace-nowrap">
                      {row.location.tower || "—"}
                    </td>
                    <td className="px-2 py-2 text-sm whitespace-nowrap">
                      {row.location.unit || "—"}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {showStatus ? (
                        <ActiveStatusButton
                          isActive={row.member.status === "Active"}
                          className="table-status-button"
                          size="sm"
                        />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {paginatedMembers.length === 0 ? (
          <div className="bg-white rounded-lg p-6">
            <NoData />
          </div>
        ) : (
          paginatedMembers.map((member, index) => {
            return (
              <div
                key={member.id}
                className="bg-white rounded-lg border-2 border-gray-200 hover:border-primary/50 hover:shadow-md p-4 cursor-pointer transition-all duration-300"
                onClick={() => {
                  dispatch(setActiveTabs(1));
                  navigate(`/member-profile/${member.id}`, {
                    state: { from: location.pathname }
                  });
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center flex-1 min-w-0">
                    <img
                      src={member.photo ? `${baseURL}${member.photo}` : user1}
                      alt="User"
                      onError={(e) => {
                        e.target.src = user1;
                      }}
                      className="w-12 h-12 mr-3 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {member.full_name || "—"}
                      </h3>
                      <div className="mt-1">
                        <ActiveStatusButton
                          isActive={member.status === "Active"}
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
                  
                  {/* Locations Section */}
                  {member.locations && member.locations.length > 0 && (
                    <div className="flex items-start text-sm pt-2">
                      <span className="text-gray-500 font-medium w-20 flex-shrink-0">Locations:</span>
                      <div className="flex-1 space-y-2">
                        {member.locations.map((loc, locIdx) => (
                          <div key={locIdx} className="flex flex-wrap gap-2 items-center">
                            {loc.type && (
                              <span className="inline-block bg-primary/10 text-primary text-xs px-2 py-1 rounded">
                                {formatMemberType(loc.type)}
                              </span>
                            )}
                            {loc.tower && (
                              <span className="text-gray-900 text-xs">
                                <span className="text-gray-500">Tower:</span> {typeof loc.tower === 'string' ? loc.tower : loc.tower.name || loc.tower}
                              </span>
                            )}
                            {loc.unit && (
                              <span className="text-gray-900 text-xs">
                                <span className="text-gray-500">Unit:</span> {loc.unit}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      
      {/* Pagination */}
      {groupedMembersArray && groupedMembersArray.length > itemsPerPage && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 mt-4 pt-4 border-t border-gray-200">
          <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
            Showing {startIndex + 1} to {Math.min(endIndex, groupedMembersArray.length)} of {groupedMembersArray.length} members
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentPage(prev => Math.max(1, prev - 1));
              }}
              disabled={currentPage === 1}
              className={`px-3 py-2 sm:py-1 rounded border text-sm min-h-[44px] sm:min-h-0 active:scale-95 ${
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
                      className={`px-3 py-2 sm:py-1 rounded border text-sm min-h-[44px] sm:min-h-0 active:scale-95 ${
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
              className={`px-3 py-2 sm:py-1 rounded border text-sm min-h-[44px] sm:min-h-0 active:scale-95 ${
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

CommunityMemberListTable.propTypes = {
  members: PropTypes.array.isRequired
};

export default CommunityMemberListTable;
