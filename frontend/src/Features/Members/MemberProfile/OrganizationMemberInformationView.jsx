import { useEffect, useRef, useState } from "react";
import Button from "../../../Components/FormComponent/ButtonComponent/Button";
import DynamicEditLink from "./DynamicLinkEditButton";
import { MdGroup } from "react-icons/md";
import { checkPermission } from "../../../utils/permissionUtils";

// Normalized type display, including the "Resident (Tenant)" case
const formatMemberType = (member = {}) => {
  const typeMap = {
    owner: "Owner",
    resident: "Resident",
    resident_tenant: "Resident (Tenant)",
    staff: "Staff"
  };

  if (member.member_type && typeMap[member.member_type]) {
    return typeMap[member.member_type];
  }

  if (
    member.member_type_name &&
    typeof member.member_type_name === "string" &&
    typeMap[member.member_type_name.toLowerCase()]
  ) {
    return typeMap[member.member_type_name.toLowerCase()];
  }

  // Fallback: show provided name or a dash
  if (member.member_type_name) return member.member_type_name;
  return "--";
};

const OrganizationMemberInformationView = ({ member, highlightRoleId, highlightRole }) => {
  const highlightedRoleRef = useRef(null);
  const [hasEditPermission, setHasEditPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);

  // Check if user has EDIT_MEMBER permission (permission ID 2)
  useEffect(() => {
    const checkEditPermission = async () => {
      try {
        const permissionGranted = await checkPermission("org", 2);
        setHasEditPermission(permissionGranted);
      } catch (error) {
        console.error("Error checking edit permission:", error);
        setHasEditPermission(false);
      } finally {
        setLoadingPermission(false);
      }
    };
    checkEditPermission();
  }, []);

  // Debug logging
  console.log('[OrganizationMember] Component props:', {
    highlightRole,
    highlightRoleId,
    memberRolesCount: member?.member_roles?.length
  });

  // Scroll to and highlight the role when component mounts
  useEffect(() => {
    if (highlightRole && highlightedRoleRef.current) {
      console.log('[OrganizationMember] Highlighting and scrolling to role');
      // Scroll into view
      highlightedRoleRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      
      // Add pulse animation
      highlightedRoleRef.current.classList.add('animate-pulse-highlight');
      
      // Remove animation after 3 seconds
      const timeout = setTimeout(() => {
        if (highlightedRoleRef.current) {
          highlightedRoleRef.current.classList.remove('animate-pulse-highlight');
        }
      }, 3000);
      
      return () => clearTimeout(timeout);
    }
  }, [highlightRole, highlightRoleId]);

  // Collect all unique group names from both direct group membership and role-based groups
  const getAllGroupNames = () => {
    const groupNamesSet = new Set();
    
    // Add groups from direct membership
    if (member?.member_groups?.length) {
      member.member_groups.forEach((group) => {
        if (group.group_name) {
          groupNamesSet.add(group.group_name);
        }
      });
    }
    
    // Add groups from roles that have groups
    if (member?.member_roles?.length) {
      member.member_roles.forEach((role) => {
        if (role.is_group && role.group_names?.length) {
          role.group_names.forEach((name) => groupNamesSet.add(name));
        }
      });
    }
    
    return Array.from(groupNamesSet);
  };

  const allGroupNames = getAllGroupNames();

  return (
    <div className="my-6">
      <div className="border border-borderLight rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-textDark">
            Organization Member Information
          </h3>
          {!loadingPermission && hasEditPermission && (
            <DynamicEditLink
              basePath="MemberTypeAndRoleEdit"
              resourceId={member?.id}
            />
          )}
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-xs font-normal text-gray-700 tracking-wide mb-0.5">
              Type
            </p>
            <p className="text-base font-normal text-gray-900 min-h-[24px] leading-normal">
              {formatMemberType(member)}
            </p>
          </div>

          <div>
            <p className="text-xs font-normal text-gray-700 tracking-wide mb-0.5">
              Role
            </p>
            <div className="flex flex-wrap gap-2">
              {member?.member_roles?.length > 0 ? (
                member.member_roles.map((role, idx) => {
                  const key = role.assignment_id || `${role.id}-${idx}`;
                  // Ensure both IDs are compared as numbers
                  const isHighlighted = highlightRole && highlightRoleId && Number(role.id) === Number(highlightRoleId);
                  
                  // Debug logging
                  if (highlightRole) {
                    console.log('[OrganizationMember] Role comparison:', {
                      roleName: role.role_name,
                      roleId: role.id,
                      highlightRoleId: highlightRoleId,
                      isHighlighted: isHighlighted,
                      bothAsNumbers: `${Number(role.id)} === ${Number(highlightRoleId)}`
                    });
                  }
                  
                  return (
                    <div
                      key={key}
                      ref={isHighlighted ? highlightedRoleRef : null}
                      className={`transition-all duration-300 ${
                        isHighlighted ? 'ring-2 ring-primary ring-offset-2 rounded-lg' : ''
                      }`}
                    >
                      <Button
                        size="small"
                        variant="black"
                        className="whitespace-nowrap flex items-center gap-2"
                      >
                        <span>{role.role_name}</span>
                        {role.is_group && (
                          <MdGroup className="w-4 h-4 text-gray-600" />
                        )}
                      </Button>
                    </div>
                  );
                })
              ) : (
                <p className="text-base font-normal text-gray-400">--</p>
              )}
            </div>
          </div>

          {allGroupNames.length > 0 && (
            <div>
              <p className="text-xs font-normal text-gray-700 tracking-wide mb-0.5">
                Groups
              </p>
              <p className="text-base font-normal text-gray-900 min-h-[24px] leading-normal">
                {allGroupNames.join(", ")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrganizationMemberInformationView;
