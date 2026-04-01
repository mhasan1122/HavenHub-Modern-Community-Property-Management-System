import React, { useMemo, useState, useEffect, useRef } from "react";
import NoData from "../../../Components/Table/NoData";
import UserThumbnailGroup from "../../../Components/Thumbnails/UserThumbnailGroup";
import { useNavigate } from "react-router-dom";
import Status from "../../../Components/Text/Status";
import ActiveStatusButton from "../../../Components/Buttons/ActiveStatusButton";
import TableCellText from "../../../Components/Table/TableCellText";
import TableCell from "../../../Components/Table/TableCell";

const GroupTable = ({ groupList, highlightGroupId, highlightTimestamp }) => {
  const navigate = useNavigate();
  const highlightRef = useRef(null);
  const [highlightedId, setHighlightedId] = useState(null);

  // ✅ Memoize sorted data to avoid unnecessary sorting on re-renders
  const sortedGroups = useMemo(() => {
    return [...groupList].sort((a, b) => b.id - a.id); // or sort by created_at
  }, [groupList]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset to page 1 when groupList changes
  useEffect(() => {
    setCurrentPage(1);
  }, [groupList]);

  // Handle highlighting when navigating from notification
  useEffect(() => {
    if (highlightGroupId && highlightTimestamp) {
      setHighlightedId(highlightGroupId);

      // Find the group and calculate which page it's on
      const groupIndex = sortedGroups.findIndex(g => g.id === highlightGroupId);
      if (groupIndex !== -1) {
        const pageNumber = Math.floor(groupIndex / itemsPerPage) + 1;
        setCurrentPage(pageNumber);
      }

      // Scroll to the highlighted row after a short delay to ensure rendering
      setTimeout(() => {
        if (highlightRef.current) {
          highlightRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }, 100);

      // Remove highlight after 3 seconds
      const timer = setTimeout(() => {
        setHighlightedId(null);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [highlightGroupId, highlightTimestamp, sortedGroups, itemsPerPage]);

  // Pagination calculations
  const totalPages = Math.ceil((sortedGroups?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedGroups = sortedGroups?.slice(startIndex, endIndex) || [];

  return (
    <div className="w-full">
      {/* Desktop Table View */}
      <div className="hidden lg:block relative overflow-x-auto max-h-[70vh] overflow-y-auto bg-white">
        <table className="w-full text-sm text-left rtl:text-right">
          <thead className="bg-subprimary border-b border-subprimary sticky top-0 z-10">
            <tr className="h-11">
              <th className="px-2 font-[700] py-2 text-base">Members</th>
              <th className="px-2 font-[700] py-2 text-base">Group Name</th>
              <th className="px-2 font-[700] py-2 text-base">Group Description</th>
              <th className="px-2 font-[700] py-2 text-base">Roles</th>
              <th className="px-2 font-[700] py-2 text-base text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {paginatedGroups.length === 0 ? (
              <NoData message="There are no groups" />
            ) : (
              paginatedGroups.map((group) => {
                const isHighlighted = highlightedId === group.id;
                return (
                  <tr
                    key={group.id}
                    ref={isHighlighted ? highlightRef : null}
                    className={`border-b cursor-pointer h-11 transition-all duration-500 ${isHighlighted
                      ? 'bg-primary/20'
                      : 'bg-white hover:bg-gray-50'
                      }`}
                    onClick={() => navigate(`/groupProfile/${group.id}`)}
                  >
                    <TableCell>
                      {group?.members?.length === 0 ? (
                        <p className="py-1 text-sm text-gray-500">No members</p>
                      ) : (
                        <UserThumbnailGroup
                          userPhotos={group.members.map((member) => member.photo_low_quality)}
                        />
                      )}
                    </TableCell>
                    <TableCellText data={group?.group_name} />
                    <TableCellText data={group?.group_description} />
                    <TableCellText data={group?.roles.map((role) => role.role_name)} />
                    <TableCell className="text-center">
                      <ActiveStatusButton
                        isActive={group.is_active}
                        className="table-status-button"
                      />
                    </TableCell>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {paginatedGroups.length === 0 ? (
          <div className="bg-white rounded-lg p-6">
            <NoData message="There are no groups" />
          </div>
        ) : (
          paginatedGroups.map((group) => {
            const isHighlighted = highlightedId === group.id;
            const roles = group?.roles?.map((role) => role.role_name) || [];

            return (
              <div
                key={group.id}
                ref={isHighlighted ? highlightRef : null}
                className={`bg-white rounded-lg border p-4 cursor-pointer transition-all duration-300 ${isHighlighted
                    ? 'border-primary bg-primary/10 ring-2 ring-primary ring-inset'
                    : 'border-gray-200 hover:border-primary/50 hover:shadow-md'
                  }`}
                onClick={() => navigate(`/groupProfile/${group.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-base font-semibold text-gray-900 truncate ${isHighlighted ? 'font-bold' : ''}`}>
                      {group?.group_name}
                    </h3>
                    <div className="mt-1">
                      <ActiveStatusButton
                        isActive={group.is_active}
                        size="xs"
                      />
                    </div>
                  </div>
                  <div className="pl-3 flex-shrink-0">
                    {group?.members?.length === 0 ? (
                      <span className="text-xs text-gray-500 italic">No members</span>
                    ) : (
                      <UserThumbnailGroup
                        userPhotos={group.members.map((member) => member.photo_low_quality)}
                        size="small"
                        max={3}
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-gray-100">
                  {group.group_description && (
                    <div className="flex items-start text-sm">
                      <span className="text-gray-500 font-medium w-24 flex-shrink-0">Description:</span>
                      <span className="text-gray-900 line-clamp-2">{group.group_description}</span>
                    </div>
                  )}

                  {roles.length > 0 && (
                    <div className="flex items-start text-sm">
                      <span className="text-gray-500 font-medium w-24 flex-shrink-0">Roles:</span>
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-1">
                          {roles.slice(0, 3).map((role, idx) => (
                            <span
                              key={idx}
                              className="inline-block bg-primary/10 text-primary text-xs px-2 py-1 rounded"
                            >
                              {role}
                            </span>
                          ))}
                          {roles.length > 3 && (
                            <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                              +{roles.length - 3} more
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
      {sortedGroups && sortedGroups.length > itemsPerPage && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 mt-4 pt-4 border-t border-gray-200">
          <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
            Showing {startIndex + 1} to {Math.min(endIndex, sortedGroups.length)} of {sortedGroups.length} groups
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
              className={`px-3 py-2 sm:py-1 rounded border text-sm min-h-[44px] sm:min-h-0 ${currentPage === 1
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
                      className={`px-3 py-2 sm:py-1 rounded border text-sm min-h-[44px] sm:min-h-0 active:scale-95 ${currentPage === page
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
              className={`px-3 py-2 sm:py-1 rounded border text-sm min-h-[44px] sm:min-h-0 ${currentPage === totalPages
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

export default GroupTable;
