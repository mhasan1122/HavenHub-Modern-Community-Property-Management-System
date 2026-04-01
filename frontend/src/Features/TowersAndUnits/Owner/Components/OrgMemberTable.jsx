import React from "react";
import { FiX } from "react-icons/fi";
import axios from "axios";
import user1 from "../../../../assets/user/user.png";

const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_API
});
const OrgMemberTable = ({
  isOpen,
  onClose,
  contactType,
  commMembers = [],
  onSelect
}) => {
  if (!isOpen) return null;


  const members = commMembers?.org_members || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative bg-white rounded-xl p-6 w-full md:max-w-[900px] mx-0 sm:mx-4">
        {/* Close cross icon positioned at the top right */}
        <button
          onClick={onClose}
          className="absolute top-0 right-0 text-white bg-primary  rounded-md"
        >
          <FiX size={24} />
        </button>

        <h2 className="text-xl font-bold text-primary mb-4">
          {/* {contactType === "primary" ? "Primary" : "Secondary"} Contact */}

          Community Member Profile
        </h2>

        <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
          {members.length > 0 ? (
            <table className="min-w-full text-sm text-left border border-gray-200">
              <thead className="bg-teal-50">
                <tr>
                  {[
                    "Name",
                    "Contact",
                    "Type",
                    "Email",
                    "Occupation",
                    "Tower",
                    "Action"
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
                {members.map((member, index) => (
                  <tr
                    key={index}
                    className="bg-white border-b hover:bg-gray-50"
                  >
                    {/* Name & Image */}
                    <td className="px-4 py-3 flex items-center gap-2">
                      <img
                        src={
                          member.photo ? `${api.defaults.baseURL}${member.photo}` : user1
                        }
                        onError={(e) => (e.target.src = user1)}
                        alt={member.full_name}
                        className="w-8 h-8 rounded-full object-cover"
                      />

                      {member.full_name}
                    </td>
                    {/* Contact */}
                    <td className="px-4 py-3">{member.general_contact}</td>
                    {/* Type */}
                    <td className="px-4 py-3">{member.member_type_name}</td>
                    {/* Email */}
                    <td className="px-4 py-3">{member.general_email}</td>
                    {/* Occupation */}
                    <td className="px-4 py-3">{member.occupation || "-"}</td>
                    {/* Tower */}
                    <td className="px-4 py-3">{member.tower_name || "-"}</td>
                    {/* Action */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onSelect(member)}
                        className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Add
                      </button>
                    </td>
                  </tr>
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

export default OrgMemberTable;
