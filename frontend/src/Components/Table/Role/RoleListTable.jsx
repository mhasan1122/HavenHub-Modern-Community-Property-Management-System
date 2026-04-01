import React, { useEffect, useState } from "react";
import { FaPlus } from "react-icons/fa6";
import { MdAdminPanelSettings } from "react-icons/md";
import { GoPlus } from "react-icons/go";
import { useLocation, useNavigate, useNavigationType, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchRoles } from "../../../redux/slices/roles/rolesSlice";
import FilterSelect1 from "../../../Components/FilterSelect1/FilterSelect1";
import SearchBar from "../../../Components/Search/SearchBar";
import Status from "../../Text/Status";
import ActiveStatusButton from "../../../Components/Buttons/ActiveStatusButton";
import Button from "../../FormComponent/ButtonComponent/Button";
import Heading from "Components/HeadingComponent/Heading";
import TableSkeleton from "../../Loaders/TableSkeleton";
import useSkeletonLoading from "../../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../../config/skeletonLoadingConfig";
import EmptyState from "../../Ui/EmptyState";

// Sample status options for FilterSelect1
const statusOptions = [
  { label: "Active", value: "1" },
  { label: "Inactive", value: "0" }
];

const RoleListTable = ({ addRole, roleProfile }) => {
  const dispatch = useDispatch();
  const { roles, loading, error } = useSelector((state) => state.role);
  const navigate = useNavigate();
  // Local states for filters
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState([]); // expects an array of "1" or "0"

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navType = useNavigationType();
  useEffect(() => {
    if (navType !== 'POP') return;

    const newParams = new URLSearchParams();
    setSearchParams(newParams, { replace: true });

  }, [location.pathname, navType, setSearchParams]);

  // Called when the search button in SearchBar is clicked.
  const handleSearch = (value) => {
    // Only update the applied search if the term is empty or has at least 3 characters.
    if (value.length === 0 || value.length >= 3) {
      setAppliedSearch(value);
    }
  };

  // Fetch roles whenever the status filter or applied search term changes.
  useEffect(() => {
    const filters = {};
    if (statusFilter && statusFilter.length > 0) {
      filters.status = statusFilter;
    }
    if (appliedSearch) {
      filters.search = appliedSearch;
    }
    dispatch(fetchRoles(filters));
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [dispatch, statusFilter, appliedSearch]);

  // Pagination calculations
  const totalPages = Math.ceil((roles?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRoles = roles?.slice(startIndex, endIndex) || [];

  // Use skeleton loading hook to ensure minimum display time and data validation
  // Ensure roles is always an array (default to empty array if undefined)
  const rolesData = Array.isArray(roles) ? roles : [];
  const showSkeleton = useSkeletonLoading(
    loading,
    rolesData,
    SKELETON_MIN_DISPLAY_TIME
  );

  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center py-2 sm:py-3 lg:py-4 mb-2 sm:mb-3 lg:mb-4 gap-3 sm:gap-4 lg:gap-0">
        <Heading title="Role List" size="xl" color="text-black" />
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4 lg:space-x-0">
          <Button
            icon={FaPlus}
            size="large"
            iconSize="medium"
            onClick={() => {
              navigate("/addRole");
            }}
          >
            Add Role
          </Button>
        </div>
      </div>

      <div className="bg-white flex flex-col lg:flex-row lg:justify-end lg:items-center gap-2 sm:gap-2 lg:gap-2 lg:space-x-4 mb-4 pb-0 lg:pb-4 lg:pt-2">
        <div className="flex gap-2 sm:gap-3 lg:gap-4 w-full lg:w-auto">
          <div className="flex-1 lg:flex-none min-w-0">
            <FilterSelect1
              placeholder="Status"
              options={statusOptions}
              paramKey="status"
              onApply={(selected) => setStatusFilter(selected)}
            />
          </div>
        </div>
        <div className="w-full lg:w-auto mt-2 lg:mt-0">
          <SearchBar
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={handleSearch}
            placeholder="Search list..."
            updateUrl={false}
          />
        </div>
      </div>

      {showSkeleton ? (
        <div><TableSkeleton /></div>
      ) : error ? (
        <p>Error: {error}</p>
      ) : (
        <div className="w-full">
          {/* Desktop Table View */}
          <div className="hidden lg:block w-full max-h-[70vh] overflow-auto bg-white">
            <table className="min-w-[900px] w-full text-base text-left">
              <thead className="bg-subprimary  border-b border-subprimary  sticky top-0 z-10">
                <tr className="h-11">
                  <th className="px-2 py-2 text-base font-bold ">Role Name</th>
                  <th className="px-2 py-2 text-base font-bold ">
                    Role Description
                  </th>
                  <th className="px-2 py-2 text-base font-bold ">Permissions</th>
                  <th className="px-2 py-2 text-base font-bold text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRoles && paginatedRoles.length > 0 ? (
                  paginatedRoles.map((role) => (
                    <tr
                      key={role.id}
                      className="bg-white border-b hover:bg-gray-50 transition-colors duration-150 h-11 cursor-pointer"
                      onClick={() => navigate(`/${roleProfile}/${role.id}`)}
                    >
                      <td className="px-2 py-2 text-sm whitespace-nowrap">
                        {typeof role.role_name === "object"
                          ? role.role_name.role_name
                          : role.role_name}
                      </td>
                      {/* <td className="px-2 py-2 text-sm whitespace-nowrap">
                      {role.role_description}
                    </td> */}
                      <td
                        className="px-2 py-2 text-sm whitespace-nowrap"
                        title={role.role_description} // Tooltip e full description
                      >
                        {
                          role.role_description.split(' ').length > 5
                            ? role.role_description.split(' ').slice(0, 5).join(' ') + '...'
                            : role.role_description
                        }
                      </td>

                      <td
                        className="px-2 py-2 text-sm whitespace-nowrap"
                        title={role.permissions_list?.join(", ")}
                      >
                        {role.permissions_list && role.permissions_list.length > 3
                          ? `${role.permissions_list.slice(0, 3).join(", ")}, ...`
                          : role.permissions_list?.join(", ")}
                      </td>

                      <td className="px-2 py-2 text-center">
                        <ActiveStatusButton
                          isActive={role.is_active}
                          className="table-status-button"
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-12">
                      <EmptyState
                        icon={MdAdminPanelSettings}
                        title="No Role Found"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-3">
            {paginatedRoles.length === 0 ? (
              <div className="bg-white rounded-lg p-6">
                <EmptyState
                  icon={MdAdminPanelSettings}
                  title="No Role Found"
                />
              </div>
            ) : (
              paginatedRoles.map((role) => (
                <div
                  key={role.id}
                  className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-300"
                  onClick={() => navigate(`/${roleProfile}/${role.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {typeof role.role_name === "object"
                          ? role.role_name.role_name
                          : role.role_name}
                      </h3>
                      <div className="mt-1">
                        <ActiveStatusButton
                          isActive={role.is_active}
                          size="xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-gray-100">
                    {role.role_description && (
                      <div className="flex items-start text-sm">
                        <span className="text-gray-500 font-medium w-24 flex-shrink-0">Description:</span>
                        <span className="text-gray-900 line-clamp-2">{role.role_description}</span>
                      </div>
                    )}

                    {role.permissions_list && role.permissions_list.length > 0 && (
                      <div className="flex items-start text-sm">
                        <span className="text-gray-500 font-medium w-24 flex-shrink-0">Permissions:</span>
                        <div className="flex-1">
                          <div className="flex flex-wrap gap-1">
                            {role.permissions_list.slice(0, 3).map((perm, idx) => (
                              <span
                                key={idx}
                                className="inline-block bg-primary/10 text-primary text-xs px-2 py-1 rounded"
                              >
                                {perm}
                              </span>
                            ))}
                            {role.permissions_list.length > 3 && (
                              <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                                +{role.permissions_list.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {roles && roles.length > itemsPerPage && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                Showing {startIndex + 1} to {Math.min(endIndex, roles.length)} of {roles.length} roles
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
      )}
    </div>
  );
};

export default RoleListTable;
