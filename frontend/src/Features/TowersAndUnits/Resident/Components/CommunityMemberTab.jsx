// import React from "react";
// import { useNavigate } from "react-router-dom";
// import EditButton from "../../../../Components/Buttons/EditButton";
// import FilePreviewWithDownload from "../../UnitDetails/components/FilePreviewWithDownload";
// import { changeOrgMemberStatus, fetchMemberById } from "../../../../redux/slices/api/memberApi";
// import { useDispatch, useSelector } from "react-redux";

// const baseURL = import.meta.env.VITE_BASE_API;

// const CommunityMemberTab = ({ resident }) => {
//   const navigate = useNavigate();
//   const dispatch = useDispatch();

//   // Prepare login credential info.
//   // console.log("resident",resident);
//   const loginCredential = {
//     userName: resident.username,
//     email: resident.member.login_email,
//     contact: resident.member.login_contact
//   };

//   const unitInfo = {
//     unitName: resident.unit_name || "N/A",
//     type: resident.is_resident_or_tenant === false ? "Tenant" : "Flat Owner",
//     unitRentFee:
//       resident.unit_rent_fee !== undefined ? resident.unit_rent_fee : "N/A",
//     advancePayment:
//       resident.advance_payment !== undefined ? resident.advance_payment : "N/A",
//     noticePeriod:
//       resident.notice_period !== undefined ? resident.notice_period : "N/A"
//   };

//   // Handler for editing login credentials.
//   const handleEditLogin = () => {
//     navigate(`/login-credential-edit/${resident.member.id}`);
//   };

//   // New handler for editing unit/resident information.
//   const handleEditUnit = () => {
//     // Use the resident record id (from the payload "id": 37) to load resident check.
//     navigate(`/resident_info_edit/${resident.id}`);
//   };

//   // Helper function: Check if a document is an image based on its file extension.
//   const isImage = (docPath) => {
//     const imageExtensions = [".jpg", ".jpeg", ".png", ".gif"];
//     return imageExtensions.some((ext) => docPath.toLowerCase().endsWith(ext));
//   };

//   // Build full URL from a given document path.
//   const getFullDocURL = (docPath) => `${baseURL}${docPath}`;

//   const handleStatusChange = (is_comm_member, member_type = "org") => {
//       if (!resident) return;

//       dispatch(
//         changeOrgMemberStatus({ id: resident.id, is_comm_member, member_type })
//       ).then(() => {
//         dispatch(fetchMemberById(resident?.id));
//       });
//     };

//     // Check permission before changing status
//     const handleStatusClick = async (newStatus) => {
//       if (statusLoading) return;
//       const permission = await checkPermission("org", 2);
//       if (permission) {
//         handleStatusChange(newStatus);
//       } else {
//         navigate("/not-authorized");
//       }
//     };

//   return (
//     <div>
//       {/* Login Credential Section */}
//       <div className="border rounded-lg p-5 border-gray-200 mt-2">
//         <div className="flex justify-between mb-4">
//           <h2 className="text-lg font-bold">Login Credential</h2>
//           <div className="flex items-center gap-2">
//             {/* <span
//               className={`px-2 py-1 rounded-full text-xs text-white ${
//                 resident.is_active ? "bg-[#3D9D9B]" : "bg-[#D9534F]"
//               }`}
//             >
//               {resident.is_active ? "Active" : "Inactive"}
//             </span> */}
//             {resident?.is_comm_member == 1 ? (
//                 <button
//                   className="mx-2 font-[600] py-1 px-2 rounded-8 bg-primary text-white"
//                   onClick={() => handleStatusClick(0)}
//                 >
//                   {statusLoading ? "Updating..." : "Active"}
//                 </button>
//               ) : (
//                 <button
//                   className="mx-2 font-[600] py-1 px-2 rounded-8 bg-red-600 text-white"
//                   onClick={() => handleStatusClick(1)}
//                 >
//                   {statusLoading ? "Updating..." : "Inactive"}
//                 </button>
//               )}
//             <EditButton id={resident.member.id} onClick={handleEditLogin} />
//           </div>
//         </div>
//         <div>
//           <p className="text-gray-500 text-sm">User Name</p>
//           <p className="text-base font-medium">{loginCredential.userName}</p>
//         </div>
//         <div className="mt-2">
//           <p className="text-gray-500 text-sm">E-mail / Phone number</p>
//           <p className="text-base font-medium">
//             {loginCredential.email || loginCredential.contact || "---"}
//           </p>
//         </div>
//       </div>

//       {/* Unit Information Section */}
//       <div className="border rounded-lg p-5 border-gray-200 mt-2">
//         <div className="flex justify-between items-center mb-4">
//           <h2 className="text-md font-bold"> {unitInfo.unitName}</h2>
//           <div className="flex items-center gap-2">
//             <EditButton id={resident.unit} onClick={handleEditUnit} />
//           </div>
//         </div>
//         <div className="grid grid-cols-3 gap-4">
//           {/* Left Column: Unit Details */}
//           <div className="space-y-3">
//             <div>
//               <p className="text-gray-500 text-sm">Type</p>
//               <p className="text-base font-medium">{unitInfo.type}</p>
//             </div>
//             <div>
//               <p className="text-gray-500 text-sm">Unit Name</p>
//               <p className="text-base font-medium">{unitInfo.unitName}</p>
//             </div>
//             <div>
//               <p className="text-gray-500 text-sm">Unit Rent Fee</p>
//               <p className="text-base font-medium">{unitInfo.unitRentFee}</p>
//             </div>
//             <div>
//               <p className="text-gray-500 text-sm">Notice Period</p>
//               <p className="text-base font-medium">
//                 {unitInfo.noticePeriod} month(s)
//               </p>
//             </div>
//           </div>

//           {/* Middle Column: Tower Details */}
//           <div className="space-y-3">
//             <div>
//               <p className="text-gray-500 text-sm">Tower Name</p>
//               <p className="text-base font-medium">
//                 {resident.tower && resident.tower.tower_name
//                   ? resident.tower.tower_name
//                   : "N/A"}
//               </p>
//             </div>
//             <div>
//               <p className="text-gray-500 text-sm">Tower Number</p>
//               <p className="text-base font-medium">
//                 {resident.tower && resident.tower.tower_number
//                   ? resident.tower.tower_number
//                   : "N/A"}
//               </p>
//             </div>
//             <div>
//               <p className="text-gray-500 text-sm">Advance Payment</p>
//               <p className="text-base font-medium">{unitInfo.advancePayment}</p>
//             </div>
//           </div>

//           {/* Right Column: Resident Docs */}
//           <div className="space-y-3">
//             <p className="text-gray-500 text-sm">Resident Docs</p>
//             {/* <div className="flex flex-row gap-2 overflow-x-auto">
//               {resident.resident_docs && resident.resident_docs.length > 0 ? (
//                 resident.resident_docs.map((docObj, index) => {
//                   const fullDocURL = getFullDocURL(docObj.rental_docs);
//                   return (
//                     <a
//                       key={index}
//                       href={fullDocURL}
//                       download
//                       target="_blank"
//                       rel="noopener noreferrer"
//                       className="border p-2 rounded hover:bg-gray-100 flex flex-col items-center"
//                     >
//                       {isImage(docObj.rental_docs) ? (
//                         <img
//                           src={fullDocURL}
//                           alt={`Resident Doc ${index + 1}`}
//                           className="w-24 h-24 object-cover rounded"
//                         />
//                       ) : (
//                         <div className="w-24 h-24 flex items-center justify-center">
//                           <span className="text-blue-500 font-medium text-center">
//                             View PDF
//                           </span>
//                         </div>
//                       )}
//                     </a>
//                   );
//                 })
//               ) : (
//                 <p className="text-sm text-gray-500">No documents available</p>
//               )}
//             </div> */}
//             <div className="flex flex-row gap-2 overflow-x-auto">
//               {resident.resident_docs && resident.resident_docs.length > 0 ? (
//                 resident.resident_docs.map((docObj, index) => (
//                   <FilePreviewWithDownload
//                     key={index}
//                     filePath={docObj.rental_docs}
//                   />
//                 ))
//               ) : (
//                 <p className="text-sm text-gray-500">No documents available</p>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default CommunityMemberTab;

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import EditButton from "../../../../Components/Buttons/EditButton";
import ActiveStatusButton from "../../../../Components/Buttons/ActiveStatusButton";
import FilePreviewWithDownload from "../../UnitDetails/components/FilePreviewWithDownload";
import {
  changeOrgMemberStatus,
  fetchMemberById
} from "../../../../redux/slices/api/memberApi";
import { fetchResidentDetails } from "../../../../redux/slices/residents/residentSlice";

const baseURL = import.meta.env.VITE_BASE_API;

const CommunityMemberTab = ({ resident, unitId }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [statusLoading, setStatusLoading] = useState(false);
  // Local state to reflect membership status instantly
  const [isCommMember, setIsCommMember] = useState(
    resident?.member?.is_comm_member == 1
  );

  useEffect(() => {
    // Sync local state when prop changes
    setIsCommMember(resident?.member?.is_comm_member == 1);
  }, [resident?.member?.is_comm_member]);

  // Prepare login credential info
  const loginCredential = {
    userName: resident?.username || "---",
    email: resident?.member?.login_email || "",
    contact: resident?.member?.login_contact || ""
  };


  // Prepare unit information

  const unitInfo = {
    unitName: resident?.unit_name || "N/A",
    type: resident?.is_resident_or_tenant ? "Flat Owner" : "Tenant",
    unitRentFee: resident?.unit_rent_fee ?? "N/A",
    advancePayment: resident?.advance_payment ?? "N/A",
    noticePeriod: resident?.notice_period ?? "N/A"
  };

  // Helper: check if file is image
  const isImage = (docPath) => {
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif"];
    return imageExtensions.some((ext) => docPath.toLowerCase().endsWith(ext));
  };

  // Helper: build full URL
  const getFullDocURL = (docPath) => `${baseURL}${docPath}`;

  // Navigation handlers
  const handleEditLogin = () => {
    navigate(`/login-credential-edit/${resident?.member?.id}`);
  };

  const handleEditUnit = () => {
    navigate(`/resident_info_edit/${resident?.id}`);
  };

  // Change community-member status with optimistic UI
  const handleStatusChange = async (newStatus) => {
    if (!resident) return;
    setStatusLoading(true);
    const prevStatus = isCommMember;
    setIsCommMember(newStatus === 1);
    try {
      await dispatch(
        changeOrgMemberStatus({
          id: resident?.member?.id,
          is_org_member: newStatus,
          member_type: "comm"
        })
      ).unwrap();
      await dispatch(fetchResidentDetails({ unitId: unitId, residentId: resident?.id }));
    } catch (error) {
      console.error("Status update failed", error);
      setIsCommMember(prevStatus);
    } finally {
      setStatusLoading(false);
    }
  };


  const handleStatusClick = (newStatus) => {
    if (statusLoading) return;
    handleStatusChange(newStatus);
  };
  // console.log("resident?.id",resident?.id)
  return (
    <div>
      {/* Login Credential Section */}
      <div className="border rounded-lg p-5 border-gray-200 mt-2">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold">Login Credential</h2>
          <div className="flex items-center gap-2">
            <ActiveStatusButton
              isActive={isCommMember}
              activeLabel={statusLoading ? "Updating..." : "Active"}
              inactiveLabel={statusLoading ? "Updating..." : "Inactive"}
              onClick={() => handleStatusClick(isCommMember ? 0 : 1)}
              disabled={statusLoading}
              className="mx-2"
              size="sm"
            />
            <EditButton id={resident?.member?.id} onClick={handleEditLogin} />
          </div>
        </div>
        <div>
          <p className="text-gray-500 text-sm">User Name</p>
          <p className="text-base font-medium">{loginCredential.userName}</p>
        </div>
        <div className="mt-2">
          <p className="text-gray-500 text-sm">E-mail / Phone number</p>
          <p className="text-base font-medium">
            {loginCredential.email || loginCredential.contact || "---"}
          </p>
        </div>
      </div>

      {/* Unit Information Section */}

      <div className="border rounded-lg p-5 border-gray-200 mt-2">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-md font-bold">{unitInfo.unitName}</h2>
          <div className="flex items-center gap-2">
            <EditButton id={resident?.id} onClick={handleEditUnit} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {/* Left Column: Unit Details */}
          <div className="space-y-3">
            <div>
              <p className="text-gray-500 text-sm">Type</p>
              <p className="text-base font-medium">{unitInfo.type}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Unit Name</p>
              <p className="text-base font-medium">{unitInfo.unitName}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Unit Rent Fee</p>
              <p className="text-base font-medium">{unitInfo.unitRentFee}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Notice Period</p>
              <p className="text-base font-medium">
                {unitInfo.noticePeriod} month(s)
              </p>
            </div>
          </div>

          {/* Middle Column: Tower Details */}
          <div className="space-y-3">
            <div>
              <p className="text-gray-500 text-sm">Tower Name</p>
              <p className="text-base font-medium">
                {resident?.tower?.tower_name || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Tower Number</p>
              <p className="text-base font-medium">
                {resident?.tower?.tower_number || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Move-In Date</p>
              <p className="text-base font-medium">
                {resident?.move_in_date ? new Date(resident.move_in_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Move-Out Date</p>
              <p className="text-base font-medium">
                {resident?.move_out_date ? new Date(resident.move_out_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : (resident?.is_active ? "Active" : "N/A")}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Advance Payment</p>
              <p className="text-base font-medium">{unitInfo.advancePayment}</p>
            </div>
          </div>

          {/* Right Column: Resident Docs */}
          <div className="space-y-3">
            <p className="text-gray-500 text-sm">Resident Docs</p>
            <div className="flex flex-row gap-2 overflow-x-auto">
              {resident?.resident_docs?.length > 0 ? (
                resident.resident_docs.map((docObj, index) => (
                  <FilePreviewWithDownload
                    key={index}
                    filePath={docObj.rental_docs}
                  />
                ))
              ) : (
                <p className="text-sm text-gray-500">No documents available</p>
              )}
            </div>
          </div>
        </div>
      </div>


    </div>
  );
};

export default CommunityMemberTab;
