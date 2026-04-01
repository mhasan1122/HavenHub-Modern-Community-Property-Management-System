import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import user1 from "../../../assets/user/user.png";
import { setActiveTabs } from "../../../redux/slices/memberSlice";
import { useDispatch } from "react-redux";
import NoData from "../../../Components/Table/NoData";
import ActiveStatusButton from "../../../Components/Buttons/ActiveStatusButton";

const MemberListTable = ({ member, error, highlightMemberId }) => {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const highlightedRowRef = useRef(null);
  
  // Ensure member is always an array
  const membersArray = Array.isArray(member) ? member : [];
  const hasMembers = membersArray.length > 0;
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset to page 1 when member list changes
  useEffect(() => {
    setCurrentPage(1);
  }, [member]);

  // Handle highlighting and pagination when highlightMemberId is provided
  useEffect(() => {
    if (highlightMemberId && membersArray.length > 0) {
      // Find the index of the highlighted member
      const memberIndex = membersArray.findIndex(m => m.id === highlightMemberId);
      
      if (memberIndex !== -1) {
        // Calculate which page the member is on
        const targetPage = Math.floor(memberIndex / itemsPerPage) + 1;
        setCurrentPage(targetPage);
        
        // Scroll to the highlighted row after a short delay
        setTimeout(() => {
          if (highlightedRowRef.current) {
            highlightedRowRef.current.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          }
        }, 100);
      }
    }
  }, [highlightMemberId, membersArray, itemsPerPage]);

  // Pagination calculations
  const totalPages = Math.ceil((membersArray.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMembers = membersArray.slice(startIndex, endIndex);

  return (
    <div className="w-full">
      {/* Desktop Table View */}
      <div className="hidden lg:block relative overflow-x-auto max-h-[70vh] overflow-y-auto custom-scrollbar bg-white">
        <table className="w-full text-base text-left rtl:text-right">
          {/* <thead className="bg-primary shadow-lg border-b border-subprimary sticky top-0"> */}
          <thead className="bg-subprimary  border-b border-subprimary sticky top-0 z-10">
            <tr className="h-11">
              <th className="px-2 py-2 text-base font-bold text-left">Name</th>
              <th className="px-2 py-2 text-base font-bold text-left">
                Contact
              </th>
              <th className="px-2 py-2 text-base font-bold text-left">
                Email
              </th>
              <th className="px-2 py-2 text-base font-bold text-left">Type</th>
              <th className="px-2 py-2 text-base font-bold text-left">Role</th>
              <th className="px-2 py-2 text-base font-bold text-center">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedMembers.length === 0 ? (
              <tr>
                <td colSpan="6">
                  <NoData
                    message={
                      error?.message === "No results found"
                        ? "No results found"
                        : "No members available"
                    }
                  />
                </td>
              </tr>
            ) : (
              paginatedMembers.map((member, index) => {
                const isHighlighted = highlightMemberId && member.id === highlightMemberId;
                return (
                  <tr 
                    key={index} 
                    ref={isHighlighted ? highlightedRowRef : null}
                    className={`border-b transition-all duration-300 h-11 cursor-pointer ${
                      isHighlighted 
                        ? 'bg-primary/20 ring-2 ring-primary ring-inset' 
                        : 'bg-white hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      dispatch(setActiveTabs(1));
                      navigate(`/member-profile/${member.id}`, {
                        state: { from: location.pathname }
                      });
                    }}
                  >
                    <td className="px-2 py-2 text-sm whitespace-nowrap">
                      <div className="flex items-center">
                        <img
                          src={member.photo || user1}
                          alt="User"
                          onError={(e) => {
                            e.target.src = user1;
                          }}
                          className="w-10 h-10 mr-2 rounded-full object-cover"
                        />
                        <span className={isHighlighted ? 'font-semibold' : ''}>
                          {member.full_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-sm whitespace-nowrap">
                      {member.general_contact}
                    </td>
                    <td className="px-2 py-2 text-sm whitespace-nowrap">
                      {member.general_email}
                    </td>
                    <td className="px-2 py-2 text-sm whitespace-nowrap">
                      {member.member_type_name}
                    </td>
                    <td
                      className="px-2 py-2 text-sm whitespace-nowrap"
                      title={member?.member_roles
                        ?.map((role) => role.role_name)
                        .join(", ")}
                    >
                      {(() => {
                        const uniqueRoles = [
                          ...new Map(member?.member_roles?.map(role => [role.role_name, role])).values()
                        ];

                        return uniqueRoles.length > 3
                          ? `${uniqueRoles
                              .slice(0, 3)
                              .map(role => role.role_name)
                              .join(", ")}, ...`
                          : uniqueRoles.map(role => role.role_name).join(", ");
                      })()}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <ActiveStatusButton
                        isActive={Number(member.is_org_member) === 1}
                        className="table-status-button"
                      />
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
            <NoData
              message={
                error?.message === "No results found"
                  ? "No results found"
                  : "No members available"
              }
            />
          </div>
        ) : (
          paginatedMembers.map((member, index) => {
            const isHighlighted = highlightMemberId && member.id === highlightMemberId;
            const uniqueRoles = [
              ...new Map(member?.member_roles?.map(role => [role.role_name, role])).values()
            ];
            
            return (
              <div
                key={index}
                ref={isHighlighted ? highlightedRowRef : null}
                className={`bg-white rounded-lg border-2 p-4 cursor-pointer transition-all duration-300 ${
                  isHighlighted 
                    ? 'border-primary bg-primary/10 ring-2 ring-primary ring-inset' 
                    : 'border-gray-200 hover:border-primary/50 hover:shadow-md'
                }`}
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
                      src={member.photo || user1}
                      alt="User"
                      onError={(e) => {
                        e.target.src = user1;
                      }}
                      className="w-12 h-12 mr-3 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-base font-semibold text-gray-900 truncate ${isHighlighted ? 'font-bold' : ''}`}>
                        {member.full_name}
                      </h3>
                      <div className="mt-1">
                        <ActiveStatusButton
                          isActive={Number(member.is_org_member) === 1}
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
                  {member.member_type_name && (
                    <div className="flex items-center text-sm">
                      <span className="text-gray-500 font-medium w-20 flex-shrink-0">Type:</span>
                      <span className="text-gray-900">{member.member_type_name}</span>
                    </div>
                  )}
                  {uniqueRoles.length > 0 && (
                    <div className="flex items-start text-sm">
                      <span className="text-gray-500 font-medium w-20 flex-shrink-0">Role:</span>
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-1">
                          {uniqueRoles.slice(0, 3).map((role, idx) => (
                            <span
                              key={idx}
                              className="inline-block bg-primary/10 text-primary text-xs px-2 py-1 rounded"
                            >
                              {role.role_name}
                            </span>
                          ))}
                          {uniqueRoles.length > 3 && (
                            <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                              +{uniqueRoles.length - 3} more
                            </span>
                          )}
                        </div>
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
      {membersArray.length > itemsPerPage && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 mt-4 pt-4 border-t border-gray-200">
          <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
            Showing {startIndex + 1} to {Math.min(endIndex, membersArray.length)} of {membersArray.length} members
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
              className={`px-3 py-2 sm:py-1 rounded border text-sm min-h-[44px] sm:min-h-0 ${
                currentPage === 1
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-white text-gray-700 hover:bg-gray-50 active:scale-95"
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
              className={`px-3 py-2 sm:py-1 rounded border text-sm min-h-[44px] sm:min-h-0 ${
                currentPage === totalPages
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-white text-gray-700 hover:bg-gray-50 active:scale-95"
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

export default MemberListTable;
