import { FaUserGroup } from "react-icons/fa6";
import { HiMiniUserGroup } from "react-icons/hi2";
import Button from "../../../Components/FormComponent/ButtonComponent/Button";
import { Div } from "../../../Components/Ui/Div";
import { Paragraph } from "../../../Components/Ui/Paragraph";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { checkPermission } from "../../../utils/permissionUtils"; 
import ActiveStatusButton from "../../../Components/Buttons/ActiveStatusButton";
import user1 from "../../../assets/user/user.png";
import EmptyState from "../../../Components/Ui/EmptyState";

const GroupProfile = ({ groupDetail }) => {
  const navigate = useNavigate();
  
  // Permission state
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { group_name, group_description, roles, members, is_active } = groupDetail;
  
  // Pagination calculations
  const totalPages = Math.ceil((members?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMembers = members?.slice(startIndex, endIndex) || [];
  
  // Reset to page 1 when members change
  useEffect(() => {
    setCurrentPage(1);
  }, [members]);

  useEffect(() => {
    const fetchPermission = async () => {
      // Check if the user has permission to view the group
      const permissionGranted = await checkPermission("org", 9); // You can adjust the arguments as needed
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };
    fetchPermission();
  }, []);

  if (loadingPermission) {
    return <div></div>;  
  }

  if (!hasPermission) {
    navigate("/not-authorized");  
  }

  return (
    <>
      <Div className="py-2 sm:py-3 lg:py-4">
        <Paragraph className="text-grey100 text-xs sm:text-sm">Group Name</Paragraph>
        <Paragraph className="text-sm sm:text-base font-medium">{group_name}</Paragraph>
      </Div>
      <Div className="py-2 sm:py-3 lg:py-4">
        <Paragraph className="text-grey100 text-xs sm:text-sm">Group Description</Paragraph>
        <Paragraph className="text-sm sm:text-base font-medium">
          {group_description?.length === 0 ? (
            <p className="text-xs sm:text-sm text-gray-500">--</p>
          ) : (
            group_description
          )}
        </Paragraph>
      </Div>
      <Div className="py-2 sm:py-3 lg:py-4">
        <Paragraph className="text-grey100 text-xs sm:text-sm pb-1 sm:pb-2">Roles</Paragraph>
        <Div className="flex flex-wrap gap-2 sm:gap-3">
          {roles && roles.length > 0 ? (
            roles.map((role) => (
              <Button key={role.id} size="small" variant="black" className="text-xs sm:text-sm">
                {role.role_name}{" "}
                <span className="px-1 sm:px-2 text-textMedium">
                  <FaUserGroup />
                </span>
              </Button>
            ))
          ) : (
            <Paragraph className="text-xs sm:text-sm">No roles assigned</Paragraph>
          )}
        </Div>
      </Div>
      <Div className="py-2 sm:py-3 lg:py-4">
        <Paragraph className="text-grey100 text-xs sm:text-sm pb-1 sm:pb-2">Group Members</Paragraph>
      </Div>

      <Div className="relative bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Desktop Table View */}
        <Div className="hidden lg:block relative overflow-x-auto max-h-[70vh] overflow-y-auto custom-scrollbar bg-white">
          <table className="w-full text-base text-left rtl:text-right">
            <thead className="bg-subprimary border-b border-subprimary sticky top-0 z-10">
              <tr className="h-11">
                <th className="px-2 sm:px-3 py-2 text-base font-bold text-left">Name</th>
                <th className="px-2 sm:px-3 py-2 text-base font-bold text-left">Member Type</th>
                <th className="px-2 sm:px-3 py-2 text-base font-bold text-left">Contact</th>
                <th className="px-2 sm:px-3 py-2 text-base font-bold text-left">Email</th>
                <th className="px-2 sm:px-3 py-2 text-base font-bold text-center">Status</th>
                <th className="px-2 sm:px-3 py-2 text-base font-bold text-left">Role</th>
              </tr>
            </thead>
            <tbody>
              {paginatedMembers.length > 0 ? (
                paginatedMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="bg-white border-b hover:bg-gray-50 transition-colors duration-150 h-11 cursor-pointer"
                    onClick={() => navigate(`/member-profile/${member.id}`)}
                  >
                    <td className="px-2 sm:px-3 py-2 text-sm whitespace-nowrap">
                      <div className="flex items-center">
                        <img
                          src={member.photo || user1}
                          alt="User"
                          onError={(e) => {
                            e.target.src = user1;
                          }}
                          className="w-10 h-10 mr-2 rounded-full object-cover flex-shrink-0"
                        />
                        {member.full_name}
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-sm whitespace-nowrap">
                      {member.member_type || "N/A"}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-sm whitespace-nowrap">
                      {member.general_contact}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-sm whitespace-nowrap">
                      {member.general_email}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-center">
                      <ActiveStatusButton
                        isActive={member.is_org_member}
                        className="table-status-button"
                      />
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-sm whitespace-nowrap">
                      {member.roles && member.roles.length > 0
                        ? [...new Set(member.roles)].join(", ")
                        : "N/A"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-4 text-gray-500">
                    <EmptyState 
                    icon={HiMiniUserGroup}
                    title="No Members Found"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Div>

        {/* Mobile Card View */}
        <Div className="lg:hidden space-y-3 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
          {paginatedMembers.length > 0 ? (
            paginatedMembers.map((member) => {
              const memberRoles = member.roles && member.roles.length > 0
                ? [...new Set(member.roles)]
                : [];
              
              return (
                <div
                  key={member.id}
                  className="bg-white rounded-lg border-2 border-gray-200 hover:border-primary/50 hover:shadow-md p-4 cursor-pointer transition-all duration-300"
                  onClick={() => navigate(`/member-profile/${member.id}`)}
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
                        <h3 className="text-base font-semibold text-gray-900 truncate">
                          {member.full_name}
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
                    {member.member_type && (
                      <div className="flex items-center text-sm">
                        <span className="text-gray-500 font-medium w-24 flex-shrink-0">Member Type:</span>
                        <span className="text-gray-900 truncate">{member.member_type}</span>
                      </div>
                    )}
                    {member.general_contact && (
                      <div className="flex items-center text-sm">
                        <span className="text-gray-500 font-medium w-24 flex-shrink-0">Contact:</span>
                        <span className="text-gray-900 truncate">{member.general_contact}</span>
                      </div>
                    )}
                    {member.general_email && (
                      <div className="flex items-center text-sm">
                        <span className="text-gray-500 font-medium w-24 flex-shrink-0">Email:</span>
                        <span className="text-gray-900 truncate">{member.general_email}</span>
                      </div>
                    )}
                    {memberRoles.length > 0 && (
                      <div className="flex items-start text-sm">
                        <span className="text-gray-500 font-medium w-24 flex-shrink-0">Role:</span>
                        <div className="flex-1">
                          <div className="flex flex-wrap gap-1">
                            {memberRoles.slice(0, 3).map((role, idx) => (
                              <span
                                key={idx}
                                className="inline-block bg-primary/10 text-primary text-xs px-2 py-1 rounded"
                              >
                                {role}
                              </span>
                            ))}
                            {memberRoles.length > 3 && (
                              <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                                +{memberRoles.length - 3} more
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
          ) : (
            <div className="bg-white rounded-lg p-6">
              <EmptyState 
                icon={HiMiniUserGroup}
                title="No Members Found"
              />
            </div>
          )}
        </Div>
      </Div>
      
      {/* Pagination */}
      {members && members.length > itemsPerPage && (
        <div className="flex flex-col sm:flex-row items-center justify-between mt-4 pt-4 border-t border-gray-200 gap-3 sm:gap-0">
          <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
            Showing {startIndex + 1} to {Math.min(endIndex, members.length)} of {members.length} members
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentPage(prev => Math.max(1, prev - 1));
              }}
              disabled={currentPage === 1}
              className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded border ${
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
                      className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded border ${
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
                  return <span key={page} className="px-1 sm:px-2 text-xs sm:text-sm">...</span>;
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
              className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded border ${
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
    </>
  );
};

export default GroupProfile;
