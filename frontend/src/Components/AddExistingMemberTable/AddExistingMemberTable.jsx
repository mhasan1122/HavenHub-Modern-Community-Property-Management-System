// import React, { useState, useEffect } from "react";
// import { useDispatch, useSelector } from "react-redux";
// import { FiX } from "react-icons/fi";
// import { fetchAddExistingMembers } from "../../redux/slices/residents/residentSlice";
// import FilterSelect2 from "../../Components/FilterSelect/FilterSelect2";
// import { RxCross1 } from "react-icons/rx";

// const BASE_URL = import.meta.env.VITE_BASE_API;

// const AddExistingMemberTable = ({ isOpen, onClose, onSelectMember = false }) => {
//   const dispatch = useDispatch();
//   const { members, loadingMembers: loading, errorMembers: error } = useSelector((state) => state.resident);
//   const [search, setSearch] = useState("");
//   const [filteredType, setFilteredType] = useState([]);

//   // Function to capitalize first letter
//   const capitalizeFirstLetter = (string) => {
//     if (!string) return "-";
//     return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
//   };

//   // Build filter options:
//   const orgMemberTypes = Array.from(
//     new Map(
//       members
//         .filter(
//           (member) =>
//             member.member_type_name.toLowerCase() !== "owner" &&
//             member.member_type_name.toLowerCase() !== "resident" &&
//             member.member_type_name.toLowerCase() !== "unitstaff"
//         )
//         .map((member) => [
//           member.member_type,
//           { value: member.member_type, label: member.member_type_name },
//         ])
//     ).values()
//   );

//   const filterOptions = [
//     { value: "owner", label: "Owner" },
//     { value: "resident", label: "Resident" },
//     { value: "unitstaff", label: "Unit Staff" },
//     ...orgMemberTypes,
//   ];

//   useEffect(() => {
//     if (isOpen) {
//       dispatch(fetchAddExistingMembers());
//     }
//   }, [isOpen, dispatch]);

//   const filterTable = () => {
//     const filtered = members.filter((member) => {
//       const lowerTypeName = member.member_type_name?.toLowerCase() || "";

//       const memberFilterValue =
//         lowerTypeName === "owner" || lowerTypeName === "resident" || lowerTypeName === "unitstaff"
//           ? lowerTypeName
//           : String(member.member_type);

//       const typeMatch =
//         filteredType.length > 0
//           ? filteredType.map(String).includes(memberFilterValue)
//           : true;

//       const memberName = member.full_name || "";
//       const searchMatch = memberName.toLowerCase().includes(search.toLowerCase());

//       return typeMatch && searchMatch;
//     });

//     const groupedMembers = filtered.reduce((acc, member) => {
//       if (!acc[member.id]) {
//         acc[member.id] = {
//           ...member,
//           locations: []
//         };
//       }
//       acc[member.id].locations.push({
//         tower_name: member.tower_name || "-",
//         floor_no: member.floor_no || "-",
//         unit_name: member.unit_name || "-",
//         member_type_name: member.member_type_name || "-",
//         member_type: member.member_type
//       });
//       return acc;
//     }, {});

//     return Object.values(groupedMembers);
//   };

//   const handleTypeFilterApply = (selectedTypes) => {
//     setFilteredType(selectedTypes);
//   };

//   if (!isOpen) return null;

//   const filteredMembers = filterTable();

//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center px-4 py-6 overflow-auto">
//       <div className="bg-white p-6 rounded-xl w-full max-w-7xl  relative">
//         {/* <button
//           onClick={onClose}
//           className="absolute top-0 right-0 m-2 bg-primary rounded-xl p-2 text-white text-xl shadow-md transition-colors duration-200"
//         >
//           <FiX className="text-white" />
//         </button> */}
//   <button
//                         onClick={onClose}
//                         className="absolute -top-[8px] -right-[8px] p-2 rounded-full bg-primary text-white shadow-md hover:bg-primary/90 transition z-20"
//                       >
//                         <RxCross1  />
//                       </button>
//         <div className="pb-4">
//           <div className="flex flex-col md:flex-row md:justify-between items-center py-4 gap-4">
//             <p className="text-2xl font-semibold text-gray-800">Members List</p>
//             <div className="flex items-center gap-4">
//               <FilterSelect2
//                 placeholder="Select Type"
//                 options={filterOptions}
//                 paramKey="member_type"
//                 onApply={handleTypeFilterApply}
//                 value={filteredType}
//                 useUrlParams={false}
//               />

//               <div className="flex items-center border border-gray-300 rounded-md px-3 py-2 bg-white shadow-sm">
//                 <img
//                   src="/filter-icon/filter-2-line.png"
//                   alt="Filter Icon"
//                   className="w-4 h-4 mr-2"
//                 />
//                 <input
//                   type="text"
//                   name="search"
//                   placeholder="Search list..."
//                   className="outline-none text-base text-gray-700 placeholder:text-base placeholder-teal-600 bg-transparent"
//                   value={search}
//                   onChange={(e) => setSearch(e.target.value)}
//                 />
//               </div>
//               <div className="flex items-center cursor-pointer">
//                 <img
//                   src="/filter-icon/filter-3-line.png"
//                   alt="Filter Icon"
//                   className="w-6 h-6"
//                 />
//               </div>
//             </div>
//           </div>
//         </div>

//         {loading && <div className="text-center py-4 text-gray-600">Loading members...</div>}
//         {error && <div className="text-center py-4 text-red-600">Error: {error}</div>}

//         {!loading && !error && (
//           <div className="overflow-x-auto overflow-y-auto max-h-[500px] rounded-lg ">
//             <table className="min-w-full text-sm text-left">
//               <thead className="bg-teal-50">
//                 <tr>
//                   {["Name", "Contact", "Email", "Type", "Tower", "Floor", "Unit", "Action"].map((head, i) => (
//                     <th key={i} className="px-4 py-3 font-semibold text-gray-800 border-b">
//                       {head}
//                     </th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody>
//                 {filteredMembers.length > 0 ? (
//                   filteredMembers.map((member, index) => (
//                     <React.Fragment key={member.id}>
//                       {/* Common information row */}
//                       <tr className="bg-white hover:bg-gray-50">
//                         <td className="px-6 py-4">
//                           <div className="flex items-center gap-3">
//                             <img
//                               src={member.photo ? `${BASE_URL}${member.photo}` : "/user.jpg"}
//                               onError={(e) => (e.target.src = "/user.jpg")}
//                               alt={member.full_name}
//                               className="w-10 h-10 rounded-full object-cover ring-2 ring-teal-100"
//                             />
//                             <span className="font-medium text-gray-900">{member.full_name}</span>
//                           </div>
//                         </td>
//                         <td className="px-6 py-4 text-gray-600">
//                           {member.general_contact}
//                         </td>
//                         <td className="px-6 py-4 text-gray-600">
//                           {member.general_email}
//                         </td>
//                         <td className="px-6 py-4 border-b">
//                           <span className="px-3 py-1 text-sm font-medium rounded-full bg-teal-50 text-teal-700">
//                             {capitalizeFirstLetter(member.locations[0].member_type_name)}
//                           </span>
//                         </td>
//                         <td className="px-6 py-4 border-b">
//                           <span className="text-gray-700">{member.locations[0].tower_name}</span>
//                         </td>
//                         <td className="px-6 py-4 border-b">
//                           <span className="text-gray-700">{member.locations[0].floor_no}</span>
//                         </td>
//                         <td className="px-6 py-4 border-b">
//                           <span className="text-gray-700">{member.locations[0].unit_name}</span>
//                         </td>
//                         <td className="px-6 py-4 text-center">
//                           <button
//                             onClick={() => onSelectMember(member)}
//                             className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 shadow-sm hover:shadow-md"
//                           >
//                             Add
//                           </button>
//                         </td>
//                       </tr>
//                       {/* Additional locations */}
//                       {member.locations.slice(1).map((location, locIndex) => (
//                         <tr key={`${member.id}-${locIndex + 1}`} className="bg-white hover:bg-gray-50">
//                           <td className="px-6 py-4"></td>
//                           <td className="px-6 py-4"></td>
//                           <td className="px-6 py-4"></td>
//                           <td className="px-6 py-4 border-b">
//                             <span className="px-3 py-1 text-sm font-medium rounded-full bg-teal-50 text-teal-700">
//                               {capitalizeFirstLetter(location.member_type_name)}
//                             </span>
//                           </td>
//                           <td className="px-6 py-4 border-b">
//                             <span className="text-gray-700">{location.tower_name}</span>
//                           </td>
//                           <td className="px-6 py-4 border-b">
//                             <span className="text-gray-700">{location.floor_no}</span>
//                           </td>
//                           <td className="px-6 py-4 border-b">
//                             <span className="text-gray-700">{location.unit_name}</span>
//                           </td>
//                           <td className="px-6 py-4"></td>
//                         </tr>
//                       ))}
//                     </React.Fragment>
//                   ))
//                 ) : (
//                   <tr>
//                     <td colSpan="8" className="px-6 py-8 text-center text-gray-500 bg-gray-50">
//                       <div className="flex flex-col items-center justify-center">
//                         <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
//                         </svg>
//                         <p className="text-lg font-medium">No members found</p>
//                         <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
//                       </div>
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default AddExistingMemberTable;





import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RxCross1 } from "react-icons/rx";
import { fetchAddExistingMembers } from "../../redux/slices/residents/residentSlice";
import FilterSelect2 from "../../Components/FilterSelect/FilterSelect2";
import Heading from "../../Components/HeadingComponent/Heading";
import { Div } from "../../Components/Ui/Div";
import TableSkeleton from "../../Components/Loaders/TableSkeleton";
import useSkeletonLoading from "../../hooks/useSkeletonLoading";
import { SKELETON_MIN_DISPLAY_TIME } from "../../config/skeletonLoadingConfig";
import user1 from "../../assets/user/user.png";

const BASE_URL = import.meta.env.VITE_BASE_API;

const AddExistingMemberTable = ({ isOpen, onClose, onSelectMember = false }) => {
  const dispatch = useDispatch();
  const { members, loadingMembers: loading, errorMembers: error } = useSelector((state) => state.resident);
  const [search, setSearch] = useState("");
  const [filteredType, setFilteredType] = useState([]);

  const capitalizeFirstLetter = (string) => {
    if (!string) return "-";
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
  };

  const orgMemberTypes = Array.from(
    new Map(
      members
        .filter(
          (member) => {
            const lowerTypeName = member.member_type_name?.toLowerCase() || "";
            return (
              lowerTypeName !== "owner" &&
              lowerTypeName !== "resident" &&
              lowerTypeName !== "resident (tenant)" &&
              lowerTypeName !== "unitstaff" &&
              lowerTypeName !== "unit staff"
            );
          }
        )
        .map((member) => [
          member.member_type,
          { value: member.member_type, label: member.member_type_name },
        ])
    ).values()
  );

  const filterOptions = [
    { value: "owner", label: "Owner" },
    { value: "resident", label: "Resident" },
    { value: "resident_tenant", label: "Resident (Tenant)" },
    { value: "unitstaff", label: "Unit Staff" },
    ...orgMemberTypes,
  ];

  useEffect(() => {
    if (isOpen) {
      dispatch(fetchAddExistingMembers());
    }
  }, [isOpen, dispatch]);

  const groupMembers = () => {
    const filtered = members.filter((member) => {
      const lowerTypeName = member.member_type_name?.toLowerCase() || "";

      // Map display names to filter values
      let memberFilterValue;
      if (lowerTypeName === "owner") {
        memberFilterValue = "owner";
      } else if (lowerTypeName === "resident") {
        memberFilterValue = "resident";
      } else if (lowerTypeName === "resident (tenant)") {
        memberFilterValue = "resident_tenant";
      } else if (lowerTypeName === "unitstaff" || lowerTypeName === "unit staff") {
        memberFilterValue = "unitstaff";
      } else {
        memberFilterValue = String(member.member_type);
      }

      const typeMatch =
        filteredType.length > 0 ? filteredType.map(String).includes(memberFilterValue) : true;

      const searchMatch = (member.full_name || "").toLowerCase().includes(search.toLowerCase());

      return typeMatch && searchMatch;
    });

    const grouped = filtered.reduce((acc, member) => {
      const id = member.id;
      if (!acc[id]) {
        acc[id] = {
          id,
          full_name: member.full_name,
          general_contact: member.general_contact,
          general_email: member.general_email,
          photo: member.photo,
          roles: [],
        };
      }
      acc[id].roles.push({
        type: member.member_type_name,
        tower: member.tower_name,
        floor: member.floor_no,
        unit: member.unit_name,
        status: member.status,
      });
      return acc;
    }, {});

    return Object.values(grouped);
  };

  const handleTypeFilterApply = (selectedTypes) => {
    setFilteredType(selectedTypes);
  };

  const groupedMembers = groupMembers();

  // Apply skeleton loading delay - MUST be called before any conditional returns
  const showSkeleton = useSkeletonLoading(
    loading,
    groupedMembers,
    SKELETON_MIN_DISPLAY_TIME
  );

  if (!isOpen) return null;

  const renderRows = () =>
    groupedMembers.map((member) =>
      member.roles.map((role, idx) => (
        <tr
          key={`${member.id}-${idx}`}
          className={idx === 0 ? "bg-white border-t hover:bg-gray-50" : "bg-white hover:bg-gray-50"}
        >
          {idx === 0 && (
            <>
              <td rowSpan={member.roles.length} className="px-4 py-3 border-gray-200">
                <div className="flex items-center gap-2">
                  <img
                    src={member.photo ? `${BASE_URL}${member.photo}` : user1}
                    onError={(e) => (e.target.src = user1)}
                    alt={member.full_name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  {member.full_name}
                </div>
              </td>
              <td rowSpan={member.roles.length} className="px-4 py-3 border-gray-200">{member.general_contact}</td>
              <td rowSpan={member.roles.length} className="px-4 py-3 border-gray-200">{member.general_email}</td>
            </>
          )}
          <td className="px-4 py-3 capitalize border-gray-200">
            {role.type?.toLowerCase() === "unitstaff" || role.type?.toLowerCase() === "unit staff" 
              ? "Unit Staff" 
              : role.type}
          </td>
          <td className="px-4 py-3 border-gray-200">{role.tower}</td>
          <td className="px-4 py-3 border-gray-200">{role.floor}</td>
          <td className="px-4 py-3 capitalize border-gray-200">{role.unit}</td>
          <td className="px-4 py-3 text-center border-gray-200">
            {idx === 0 && (
              <button
                onClick={() => onSelectMember(member)}
                className="bg-primary hover:bg-primaryDark text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200"
              >
                Add
              </button>
            )}
          </td>
        </tr>
      ))
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full md:max-w-[1100px] mx-4 max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute -top-[8px] -right-[8px] p-2 rounded-full bg-primary text-white shadow-md hover:bg-primary/90 transition z-20"
        >
          <RxCross1 />
        </button>

        <Div className="flex flex-col gap-4 py-4">
          <Div className="flex justify-between items-center">
            <Heading title="Members List" size="lg" color="text-black" />
          </Div>
          <Div className="flex flex-wrap items-center gap-3 justify-end">
            <FilterSelect2
              placeholder="Select Type"
              options={filterOptions}
              paramKey="member_type"
              onApply={handleTypeFilterApply}
              value={filteredType}
              useUrlParams={false}
            />
            <div className="flex items-center border border-gray-300 rounded-md px-3 py-2 bg-white shadow-sm">
              <img src="/filter-icon/filter-2-line.png" alt="Filter Icon" className="w-4 h-4 mr-2" />
              <input
                type="text"
                name="search"
                placeholder="Search list..."
                className="outline-none text-base text-gray-700 placeholder:text-base placeholder-teal-600 bg-transparent"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </Div>
        </Div>

        <div className="overflow-x-auto overflow-y-auto flex-1 mt-2 min-h-0">
          {showSkeleton ? (
            <div className="p-4">
              <TableSkeleton rows={5} columns={8} />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">Error: {error}</div>
          ) : groupedMembers.length ? (
            <table className="w-full text-sm text-left rtl:text-right border border-borderLight rounded-lg overflow-hidden">
              <thead className="bg-primaryLight border-b border-primaryLight sticky top-0 z-10">
                <tr>
                  {["Name", "Contact", "Email", "Type", "Tower", "Floor", "Unit", "Action"].map(
                    (h) => (
                      <th key={h} className="px-4 py-3 font-semibold text-base text-left text-ink">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>{renderRows()}</tbody>
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

export default AddExistingMemberTable;

