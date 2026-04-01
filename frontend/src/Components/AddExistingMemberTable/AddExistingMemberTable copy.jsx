import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FiX } from "react-icons/fi";
import { fetchAddExistingMembers } from "../../redux/slices/residents/residentSlice";
import FilterSelect2 from "../../Components/FilterSelect/FilterSelect2";
const BASE_URL = import.meta.env.VITE_BASE_API;

const AddExistingMemberTable = ({ isOpen, onClose, onSelectMember = false }) => {
  const dispatch = useDispatch();
  const { members, loadingMembers: loading, errorMembers: error } = useSelector((state) => state.resident);
  const [search, setSearch] = useState("");
  const [filteredType, setFilteredType] = useState([]); // member type filter

  // Build filter options:
  // Exclude those with member_type_name "owner" or "resident" (which we'll add explicitly),
  // then add all unique other org member types.
  const orgMemberTypes = Array.from(
    new Map(
      members
        .filter(
          (member) =>
            member.member_type_name.toLowerCase() !== "owner" &&
            member.member_type_name.toLowerCase() !== "resident"
        )
        .map((member) => [
          member.member_type,
          { value: member.member_type, label: member.member_type_name },
        ])
    ).values()
  );

  console.log("Organization Member Types:", orgMemberTypes);

  const filterOptions = [
    { value: "owner", label: "Owner" },
    { value: "resident", label: "Resident" },
    ...orgMemberTypes,
  ];

  console.log("Filter Options:", filterOptions);

  // Fetch members when modal opens.
  useEffect(() => {
    if (isOpen) {
      dispatch(fetchAddExistingMembers());
    }
  }, [isOpen, dispatch]);

  // Log the data when it changes
  useEffect(() => {
    if (isOpen && members.length > 0) {
      console.log("Fetched members:", members);
    }
  }, [isOpen, members]);


  // Filter the member list based on search term and selected types.
  const filterTable = () => {
    return members.filter((member) => {
      const lowerTypeName = member.member_type_name?.toLowerCase() || "";

      const memberFilterValue =
        lowerTypeName === "owner" || lowerTypeName === "resident"
          ? lowerTypeName
          : String(member.member_type); // normalize to string

      const typeMatch =
        filteredType.length > 0
          ? filteredType.map(String).includes(memberFilterValue) // normalize all selected filters
          : true;

      const memberName = member.full_name || "";
      const searchMatch = memberName.toLowerCase().includes(search.toLowerCase());

      return typeMatch && searchMatch;
    });
  };


  // Handler to update filters based on FilterSelect2 selections.
  const handleTypeFilterApply = (selectedTypes) => {
    setFilteredType(selectedTypes);
  };

  if (!isOpen) return null;

  const filteredMembers = filterTable();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center px-4 py-6 overflow-auto">
      <div className="bg-white p-6 rounded-xl w-full max-w-7xl shadow-xl relative">
        <button
          onClick={onClose}
          className="absolute top-0 right-0 text-black bg-primary rounded-xl p-1 text-xl shadow-md transition-colors duration-200"
        >
          <FiX />
        </button>

        {/* Header */}
        <div className="pb-4">
          <div className="flex flex-col md:flex-row md:justify-between items-center py-4 gap-4">
            <p className="text-2xl font-semibold text-gray-800">Members List</p>
            <div className="flex items-center gap-4">
              <FilterSelect2
                placeholder="Select Type"
                options={filterOptions}
                paramKey="member_type"
                onApply={handleTypeFilterApply}
              />
              {/* Search input */}
              <div className="flex items-center border border-gray-300 rounded-md px-3 py-2 bg-white shadow-sm">
                <img
                  src="/filter-icon/filter-2-line.png"
                  alt="Filter Icon"
                  className="w-4 h-4 mr-2"
                />
                <input
                  type="text"
                  name="search"
                  placeholder="Search list..."
                  className="outline-none text-base text-gray-700 placeholder:text-base placeholder-teal-600 bg-transparent"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {/* Extra Filter Icon */}
              <div className="flex items-center cursor-pointer">
                <img
                  src="/filter-icon/filter-3-line.png"
                  alt="Filter Icon"
                  className="w-6 h-6"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Loading and error states */}
        {loading && <div className="text-center py-4 text-gray-600">Loading members...</div>}
        {error && <div className="text-center py-4 text-red-600">Error: {error}</div>}

        {/* Members table */}
        {!loading && !error && (
          <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
            <table className="min-w-full text-sm text-left border border-gray-200">
              <thead className="bg-teal-50">
                <tr>
                  {["Name", "Contact", "Type", "Email", "Occupation", "Tower", "Floor", "Unit", "Action"].map((head, i) => (
                    <th key={i} className="px-4 py-3 font-semibold text-gray-800 border-b">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length > 0 ? (
                  filteredMembers.map((member, index) => {
                    console.log("Rendering member:", member); // 🔍 Logs each member's data

                    return (
                      <tr key={index} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-4 py-3 flex items-center gap-2">
                          <img
                            src={member.photo ? `${BASE_URL}${member.photo}` : "/user.jpg"}
                            onError={(e) => (e.target.src = "/user.jpg")}
                            alt={member.full_name}
                            className="w-8 h-8 rounded-full object-cover"
                          />

                          {member.full_name}
                        </td>
                        <td className="px-4 py-3">{member.general_contact}</td>
                        <td className="px-4 py-3">{member.member_type_name}</td>
                        <td className="px-4 py-3">{member.general_email}</td>
                        <td className="px-4 py-3">{member.occupation || "-"}</td>
                        <td className="px-4 py-3">{member.tower_name || "-"}</td>
                        <td className="px-4 py-3">{member.floor_no || "-"}</td>
                        <td className="px-4 py-3">{member.unit_name || "-"}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => onSelectMember(member)}
                            className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded text-sm"
                          >
                            Add
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" className="px-4 py-6 text-center text-gray-500">
                      No member found
                    </td>
                  </tr>
                )}
              </tbody>

            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddExistingMemberTable;
