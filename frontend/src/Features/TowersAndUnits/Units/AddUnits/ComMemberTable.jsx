import React from "react";
import { FiX } from "react-icons/fi";
import { useSelector } from "react-redux";
import TableSkeleton from "../../../../Components/Loaders/TableSkeleton";
import useSkeletonLoading from "../../../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../../../config/skeletonLoadingConfig";

const BASE_URL = import.meta.env.VITE_BASE_API;

const ComMemberTable = ({
  isOpen,
  onClose,
  contactType,
  commMembers = {},
  onSelect,
}) => {
  if (!isOpen) return null;

  // Use unit slice loading flag to drive skeleton, with a minimum display delay
  const { loading: unitLoading } = useSelector((state) => state.unit || {});

  const { owners = [], residents = [], tower_name, floor_name } = commMembers;

  // Normalize tenant/resident flag from API (handles boolean, number, and string variants)
  // Treat only explicit tenant flags as tenant; default to resident otherwise.
  // Tenant indicators we honor: false, 0, "0", "false", "tenant"
  // Explicit resident indicators: true, 1, "1", "true", "resident"
  const isTenantFlag = (value) => {
    const normalized = String(value).toLowerCase();
    const tenantSignals = [false, 0, "0", "false", "tenant"];
    if (tenantSignals.includes(value) || tenantSignals.includes(normalized)) {
      return true;
    }
    return false;
  };

  // Merge and tag each member with their contact_type
  const allMembers = [
    ...owners.map((member) => ({ 
      ...member, 
      contact_type: "owner",
      tower: tower_name,
      floor: floor_name 
    })),
    ...residents.map((member) => ({ 
      ...member, 
      contact_type: isTenantFlag(member.is_resident_or_tenant)
        ? "resident_tenant"
        : "resident",
      tower: tower_name,
      floor: floor_name 
    })),
  ];

  // Display-friendly type, prioritizing resident_tenant when present
  const formatType = (roles = []) => {
    const hasTenant = roles.some((r) => r.type === "resident_tenant");
    if (hasTenant) return "Resident (Tenant)";
    const firstType = roles[0]?.type;
    if (firstType === "resident") return "Resident";
    if (firstType === "owner") return "Owner";
    if (firstType === "staff") return "Staff";
    if (firstType === "resident_tenant") return "Resident (Tenant)";
    return firstType || "-";
  };

  // Group members by ID
  const groupedMembers = allMembers.reduce((acc, member) => {
    if (!acc[member.id]) {
      acc[member.id] = {
        ...member,
        roles: []
      };
    }
    
    // Only add role if it doesn't already exist
    const roleExists = acc[member.id].roles.some(
      role => role.type === member.contact_type
    );
    
    if (!roleExists) {
      acc[member.id].roles.push({
        type: member.contact_type,
        tower: member.tower,
        floor: member.floor
      });
    }
    
    return acc;
  }, {});

  // Apply skeleton loading delay so the popup table skeleton is visible on fast responses
  const showSkeleton = useSkeletonLoading(
    unitLoading,
    Object.values(groupedMembers),
    SKELETON_MIN_DISPLAY_TIME
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative bg-white rounded-xl p-6 w-full md:max-w-[1000px] mx-0 sm:mx-4 max-h-[90vh] overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <FiX size={24} />
        </button>

        <h2 className="text-xl font-bold text-primary mb-4">
          Community Member Profile 
        </h2>

        {/* Members Table */}
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          {showSkeleton ? (
            <div className="p-4">
              <TableSkeleton rows={5} columns={8} />
            </div>
          ) : Object.values(groupedMembers).length > 0 ? (
            <table className="min-w-full text-sm text-left border border-gray-200">
              <thead className="bg-teal-50 sticky top-0">
                <tr>
                  {[
                    "Name",
                    "Contact",
                    "Email",
                    "Occupation",
                    "Tower",
                    "Floor",
                    "Type",
                    "Action",
                  ].map((head, i) => (
                    <th
                      key={i}
                      className="px-4 py-3 font-semibold text-gray-800 border-b"
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.values(groupedMembers).map((member) => (
                  <React.Fragment key={member.id}>
                    {/* Main member row */}
                    <tr className="bg-white border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3 flex items-center gap-2">
                        <img
                          src={
                            member.photo
                              ? `${BASE_URL}${member.photo}`
                              : "/user.jpg"
                          }
                          alt={member.full_name}
                          className="w-8 h-8 rounded-full"
                        />
                        {member.full_name}
                      </td>
                      <td className="px-4 py-3">{member.general_contact || "-"}</td>
                      <td className="px-4 py-3">{member.general_email || "-"}</td>
                      <td className="px-4 py-3">{member.occupation || "-"}</td>
                      <td className="px-4 py-3">{member.roles[0]?.tower || "-"}</td>
                      <td className="px-4 py-3">{member.roles[0]?.floor || "-"}</td>
                      <td className="px-4 py-3 capitalize">
                        {formatType(member.roles)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => onSelect(member)}
                          className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Add
                        </button>
                      </td>
                    </tr>

                    {/* Additional rows for other roles */}
                    {member.roles.slice(1).map((role, index) => (
                      <tr
                        key={`${member.id}-${index}`}
                        className="bg-white hover:bg-gray-50"
                      >
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3">{role.tower || "-"}</td>
                        <td className="px-4 py-3">{role.floor || "-"}</td>
                        <td className="px-4 py-3 capitalize">
                          {role.type === "resident_tenant" 
                            ? "Resident (Tenant)" 
                            : role.type || "-"}
                        </td>
                        <td className="px-4 py-3"></td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No members available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComMemberTable;