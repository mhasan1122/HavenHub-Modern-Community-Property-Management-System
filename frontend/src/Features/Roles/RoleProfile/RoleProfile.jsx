import { useState, useEffect } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { BiArrowBack } from "react-icons/bi";
import { useDispatch, useSelector } from "react-redux";
import ArrowHeading from "../../../Components/HeadingComponent/ArrowHeading";
import PageContainer from "../../../Components/Ui/PageContainer";
import editIcon from "../../../assets/edit/edit-02.png";
import user1 from "../../../assets/user/user.png";
import { fetchRoleDetails } from "../../../redux/slices/roles/rolesSlice";
import { checkPermission } from "../../../utils/permissionUtils";
import CheckboxComponent from "../../../Components/FormComponent/CheckboxComponent";
import { PERMISSION_GROUPS } from "../../../constants/permissions";
import AnimatedTabs from "../../../Components/Tabs/AnimatedTabs";
import { setActiveTabs } from "../../../redux/slices/memberSlice";
const baseURL = import.meta.env.VITE_BASE_API;

const RoleProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { roleDetails, loading, error } = useSelector((state) => state.role);
  const [activeTab, setActiveTab] = useState(1);
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Tab configuration
  const tabConfig = [
    { id: 1, label: "Role Details" },
    { id: 2, label: "Role Assigned Member" }
  ];

  useEffect(() => {
    // Check if the user has permission to view role details
    const checkUserPermissions = async () => {
      const permissionGranted = await checkPermission("org", 6);
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };

    checkUserPermissions();
  }, []);

  // Fetch role details if the user has permission
  useEffect(() => {
    if (hasPermission && id) {
      dispatch(fetchRoleDetails(id));
    }
  }, [dispatch, id, hasPermission]);

  // Reset to page 1 when assigned_members change
  useEffect(() => {
    setCurrentPage(1);
  }, [roleDetails?.assigned_members]);

  if (loadingPermission) {
    return null;
  }

  if (!hasPermission) {
    return <div>You are not authorized to view this page.</div>;
  }

  if (loading) return <p></p>;
  if (error) return <p>Error: {error}</p>;
  if (!roleDetails) return null;

  const {
    role_name,
    role_description,
    selected_permissions,
    all_permissions,
    assigned_members
  } = roleDetails;
  console.log("roleDetails---", roleDetails);

  // Pagination calculations
  const totalPages = Math.ceil((assigned_members?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMembers = assigned_members?.slice(startIndex, endIndex) || [];

  const filterPermissionsByGroup = (allPerms, group) => {
    // Filter ONLY by IDs to prevent duplicate permissions appearing in multiple groups
    // Names are kept for fallback/display purposes only
    if (group.ids && group.ids.length > 0) {
      return allPerms.filter((perm) => group.ids.some(id => Number(id) === Number(perm.id)));
    }
    // Fallback to name matching only if no IDs are specified (shouldn't happen)
    if (group.names && group.names.length > 0) {
      return allPerms.filter((perm) => group.names.includes(perm.permission_name));
    }
    return [];
  };

  return (
    <PageContainer className="h-full bg-surfaceMuted flex flex-col min-h-0">
      <div className="flex-shrink-0 sticky top-0 z-20 mb-1.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surfaceMuted/95 py-2 md:py-4 backdrop-blur">
        <div
          onClick={() => navigate("/role-list")}
          className="inline-flex cursor-pointer items-center gap-2 sm:gap-3 text-[#0F172A] transition-colors hover:text-primary"
        >
          <ArrowHeading title="View Role" size="2xl" color="text-black" />
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Link to={`/addRole/${id}`} className="w-full sm:w-auto">
            <button
              className="flex items-center justify-center bg-primary rounded-lg py-2.5 sm:py-2 px-4 text-sm sm:text-base font-medium text-white cursor-pointer whitespace-nowrap w-full sm:w-auto hover:bg-primaryDark transition-colors"
            >
              <span className="text-base sm:text-lg mr-2">
                <img src={editIcon} alt="Edit" className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
              <span>Edit</span>
            </button>
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto role-profile-scrollbar min-h-0">
        <section className="mx-auto w-full  rounded-[32px] border border-borderLight bg-white px-8 py-10">
          <div className="p-4">
            {/* Tab Navigation */}
            <AnimatedTabs
              tabs={tabConfig}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              sticky={true}
              className="mb-8"
            />

            {/* Tab Content */}
            <div className="mx-auto">
              {activeTab === 1 && (
                <div>
                  <div className="pb-[10px]">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-3">
                        <div className="py-2">
                          <p className="text-[#1B1F26B8] text-sm">Role Name</p>
                          <p className="text-base font-medium">
                            {role_name?.trim() !== "" ? role_name : "---"}
                          </p>
                        </div>

                        <div className="py-2">
                          <p className="text-[#1B1F26B8] text-sm">Role Description</p>
                          <p className="text-base font-medium">
                            {role_description?.trim() !== "" ? role_description : "---"}
                          </p>
                        </div>

                        {/* <div className="py-2">
                          <p className="text-[#1B1F26B8] text-sm">Status</p>
                          <p className="text-base font-medium">
                            {is_active ? "Active" : "Inactive"}
                          </p>
                        </div> */}
                      </div>
                    </div>
                  </div>
                  {/* Permission List */}

                  {/* {all_permissions &&

                          all_permissions.map((perm) => (
                            <CheckboxComponent
                              key={perm.id}
                              name={`permission-${perm.id}`}
                              label={perm.permission_name}
                              checked={selected_permissions.includes(perm.id)}
                            // disabled={true} // disable checkbox since in your code disabled
                            />
                          ))} */}
                  {all_permissions && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {(!selected_permissions || selected_permissions.length === 0) ? (
                        <p className="col-span-full text-[#1B1F26B8] py-4">No permissions assigned to this role.</p>
                      ) : (
                        PERMISSION_GROUPS.map((group) => {
                          const groupPerms = filterPermissionsByGroup(all_permissions, group);
                          // Only show permissions that are selected for this role
                          const selectedGroupPerms = groupPerms.filter((perm) =>
                            selected_permissions?.includes(perm.id)
                          );
                          // Only render the group if it has selected permissions
                          if (selectedGroupPerms.length === 0) return null;

                          return (
                            <div key={group.title} className="p-4">
                              <div className="mb-2">
                                <h2 className="text-base font-semibold p-2 text-center bg-subprimary rounded-8 ">
                                  {group.title}
                                </h2>
                              </div>
                              <div className="space-y-2 w-full max-h-[290px] overflow-y-auto rounded-8 p-4 bg-white border role-profile-scrollbar">
                                {selectedGroupPerms.map((perm) => (
                                  <CheckboxComponent
                                    key={perm.id}
                                    name={`permission-${perm.id}`}
                                    label={perm.permission_name}
                                    checked={true}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 2 && (
                <div>
                  <div className="bg-white">
                    <div className="relative overflow-x-auto max-h-[50vh] overflow-y-auto rounded-lg border border-gray-200 role-profile-scrollbar">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-subprimary border-b border-gray-200 sticky top-0 z-10">
                          <tr className="h-11">
                            <th className="px-2 font-[700] py-2 text-base text-left">
                              Name
                            </th>
                            <th className="px-2 font-[700] py-2 text-base text-left">
                              Contact
                            </th>
                            <th className="px-2 font-[700] py-2 text-base text-left">
                              Type
                            </th>
                            <th className="px-2 font-[700] py-2 text-base text-left">
                              Email
                            </th>
                            <th className="px-2 font-[700] py-2 text-base text-left">
                              Role
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedMembers.length > 0 ? (
                            paginatedMembers.map((member) => (
                              <tr
                                key={member.id}
                                className="bg-white border-b hover:bg-gray-50 h-11 cursor-pointer transition-colors"
                                onClick={() => {
                                  dispatch(setActiveTabs(1));
                                  navigate(`/member-profile/${member.id}`, {
                                    state: { from: location.pathname }
                                  });
                                }}
                              >
                                <td className="px-2 py-2 text-sm text-left">

                                  <div className="flex items-center">
                                    <img
                                      src={
                                        member.photo
                                          ? `${baseURL}${member.photo}`
                                          : user1
                                      }
                                      alt="User"
                                      className="w-6 h-6 rounded-full mr-2"
                                    />
                                    <span>{member.full_name}</span>
                                  </div>
                                </td>
                                <td className="px-2 py-2 text-sm text-left">
                                  {member.general_contact}
                                </td>
                                <td className="px-2 py-2 text-sm text-left">
                                  {member.member_type}
                                </td>
                                <td className="px-2 py-2 text-sm text-left">
                                  {member.general_email}
                                </td>
                                <td className="px-2 py-2 text-sm text-left">

                                  {role_name}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="5" className="text-center py-4">
                                No members assigned to this role
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {assigned_members && assigned_members.length > itemsPerPage && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                        <div className="text-sm text-gray-600">
                          Showing {startIndex + 1} to {Math.min(endIndex, assigned_members.length)} of {assigned_members.length} members
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
                            className={`px-3 py-1 rounded border ${currentPage === 1
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
                                    className={`px-3 py-1 rounded border ${currentPage === page
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
                            className={`px-3 py-1 rounded border ${currentPage === totalPages
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
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  );
};

export default RoleProfile;
