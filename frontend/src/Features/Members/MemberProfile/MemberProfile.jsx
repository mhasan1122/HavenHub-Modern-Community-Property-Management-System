// import { useState, useEffect } from "react";
// import Button from "../../../Components/FormComponent/ButtonComponent/Button";
// import { FaUserGroup } from "react-icons/fa6";
// import edit2 from "../../../assets/edit-02.png";
// import { Link } from "react-router-dom";
// import Info from "../../../Components/Ui/Info";
// import { Paragraph } from "../../../Components/Ui/Paragraph";
// import { checkPermission } from "../../../utils/permissionUtils";
// import TableSkeleton from "../../../Components/Loaders/TableSkeleton";

// const MemberProfile = ({ member }) => {
//   const [activeTab, setActiveTab] = useState(1);
//   const [hasPermission, setHasPermission] = useState(false);
//   const [loadingPermission, setLoadingPermission] = useState(true);

//   useEffect(() => {
//     const fetchPermission = async () => {
//       const permissionGranted = await checkPermission("org", 3);  
//       setHasPermission(permissionGranted);
//       setLoadingPermission(false);
//     };
//     fetchPermission();
//   }, []);

//   if (loadingPermission) {
//     return (
//       <div className="flex items-center justify-center my-12">
//         <TableSkeleton />
//       </div>
//     );
//   }

  

//   if (!hasPermission) {
//     navigate("/not-authorized");  
//   }

//   console.log(member);

//   return (
//     <div className="p-4 w-[698px] ">
//       <div className="flex  mb-4 bg-subprimary">
//         <button
//           className={`flex-1 w-full py-2  font-[600] ${
//             activeTab === 1 ? "border border-primary " : "border border-white"
//           }`}
//           onClick={() => setActiveTab(1)}
//         >
//           Profile Information
//         </button>
//         <button
//           className={`flex-1 w-full py-2 font-[600] ${
//             activeTab === 2 ? "border border-primary " : "border border-white"
//           }`}
//           onClick={() => setActiveTab(2)}
//         >
//           Organization Member
//         </button>
//         <button
//           className={`flex-1 w-full py-2 font-[600] ${
//             activeTab === 3 ? "border border-primary " : "border border-white"
//           }`}
//           onClick={() => setActiveTab(3)}
//         >
//           Community Member
//         </button>
//       </div>
//       {activeTab === 1 && (
//         <div className="mx-auto border-l rounded-8  p-3  border-[3px] border-subprimary">
//           <div>
//             <div className="flex justify-between mb-4">
//               <h2 className="text-lg font-bold ">Profile Information</h2>
//               <Link to={`/general-information-edit/${member?.id}`}>
//                 <p className="flex align-center  py-1 px-1 rounded-8 border border-grey100">
//                   <span className="text-base pt-2 px-2 text-grey100">
//                     <img src={edit2} alt="edit icon" />
//                   </span>
//                   <span className="px-1 text-base text-primary">Edit</span>
//                 </p>
//               </Link>
//             </div>
//             <div className="grid grid-cols-3 gap-4">
//               <div className="space-y-2">
//                 <Info label="Full Name">{member?.full_name || "---"}</Info>
//                 <Info label="Contact Number">{member?.contact || "---"}</Info>
//                 <Info label="Permanent Address">
//                   {member?.permanent_address || "---"}
//                 </Info>
//                 <Info label="Gender">{member?.gender || "---"}</Info>
//                 <Info label="Occupation">{member?.occupation || "---"}</Info>
//                 <Info label="Religion">{member?.religion || "---"}</Info>
//               </div>

//               <div className="space-y-2">
//                 <Info label="E-Mail">{member?.user_email || "---"}</Info>
//                 <Info label="NID Number">{member?.nid_number || "---"}</Info>
//                 <Info label="Present Address">
//                   {member?.present_address || "---"}
//                 </Info>
//                 <Info label="Date Of Birth">
//                   {member?.date_of_birth || "---"}
//                 </Info>
//                 <Info label="Marital Status">
//                   {member?.marital_status || "---"}
//                 </Info>
//               </div>

//               <div className="pt-5">
//                 <div className="py-2 flex justify-end">
//                   <img
//                     src={
//                       member?.nid_front && member?.nid_front !== ""
//                         ? `http://127.0.0.1:8000${member?.nid_front}`
//                         : "/path/to/placeholder-image.jpg"
//                     }
//                     alt="NID Front"
//                     className="rounded-lg shadow-lg member-profile-image h-[254px]"
//                   />
//                 </div>
//                 <div className="py-2 flex justify-end">
//                   <img
//                     src={
//                       member?.nid_back && member?.nid_back !== ""
//                         ? `http://127.0.0.1:8000${member?.nid_back}`
//                         : "/path/to/placeholder-image.jpg"
//                     }
//                     alt="NID Back"
//                     className="rounded-lg shadow-lg member-profile-image h-[254px]"
//                   />
//                   {/* Assuming DottedNidBox is a component; ensure it is imported if used */}
//                   <DottedNidBox />
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {activeTab === 2 && (
//         <div>
//           <div className="mx-auto border-l rounded-8 p-3  border-[3px] border-subprimary">
//             <div>
//               <div className="flex justify-between mb-4">
//                 <h2 className="text-lg font-bold ">Login Credential</h2>
//                 <div className="flex justify-between">
//                   <button className=" mx-2 bg-[#3D9D9B] font-[600]  py-1 px-1 rounded-8 ">
//                     <span className="px-1 text-base text-white">Active</span>
//                   </button>
//                   <Link to={`/login-credential-edit/${member?.id}`}>
//                     <Paragraph className="flex align-center  py-1 px-1 rounded-8 border border-grey100">
//                       <span className="text-base pt-2 px-2 text-grey100">
//                         <img src={edit2} alt="edit icon" />
//                       </span>
//                       <span className="px-1 text-base text-primary">Edit</span>
//                     </Paragraph>
//                   </Link>
//                 </div>
//               </div>
//               <div className="grid grid-cols-3 gap-4">
//                 <div className="col-span-3">
//                   <div className="py-2">
//                     <Info label="User Name">{member?.username || "---"}</Info>
//                   </div>

//                   <div className="py-2">
//                     <Info label="E-mail/Phone number">
//                       {member?.login_email || member?.login_contact || "---"}
//                     </Info>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>
//           <div className="mx-auto border-l  mt-[20px] rounded-8 p-3  border-[3px] border-subprimary">
//             <div>
//               <div className="grid grid-cols-3 gap-4">
//                 <div className="col-span-3">
//                   <div className="flex justify-between my-3 ">
//                     <h2 className="text-lg font-bold ">
//                       Organization Member Information
//                     </h2>

//                     <button className="flex align-center  py-1 px-1 rounded-8 border border-grey100">
//                       <span className="text-base pt-2 px-2 text-grey100">
//                         <img src={edit2} alt="edit icon" />
//                       </span>
//                       <span className="px-1 text-base text-primary">Edit</span>
//                     </button>
//                   </div>
//                   <div className="py-2">
//                     <Info label="Type">
//                       {member?.member_type_name || "---"}
//                     </Info>
//                   </div>
//                   <div className="py-2">
//                     <p className="text-grey100 text-sm pb-1">Role</p>
//                     <div className="flex gap-2">
//                       {member?.member_roles?.length > 0
//                         ? member.member_roles.map((role, index) => (
//                             <Button key={index} size="small" variant="black">
//                               {role.role_name}
//                             </Button>
//                           ))
//                         : "---"}
//                     </div>
//                   </div>
//                   <div className="py-2">
//                     <p className="text-grey100 text-sm">Groups</p>
//                     <p className="text-base font-medium">
//                       {member?.member_groups?.length > 0
//                         ? member.member_groups.map((group, index) => (
//                             <Button key={index} size="small" variant="black">
//                               {group.group_name}
//                             </Button>
//                           ))
//                         : "---"}
//                     </p>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {activeTab === 3 && (
//         <div className="mx-auto border-l rounded-8 p-3  border-[3px] border-subprimary">
//           <div>
//             <div className="flex justify-between mb-4">
//               <h2 className="text-lg font-bold ">Community Member</h2>

//               <p className="flex align-center  py-1 px-1 rounded-8 border border-grey100">
//                 <span className="text-base pt-2 px-2 text-grey100">
//                   <img src={edit2} alt="edit icon" />
//                 </span>
//                 <span className="px-1 text-base text-primary">Edit</span>
//               </p>
//             </div>
//             <div className="grid grid-cols-3  gap-4">
//               <div>
//                 <div className="py-[8px]">
//                   <p className="text-grey100 text-base">Full Name</p>
//                   <p className="text-sm font-medium text-base">
//                     Md. Mahafujul Islam
//                   </p>
//                 </div>
//                 <div className="py-[8px]">
//                   <p className="text-grey100 text-base">Contact Number</p>
//                   <p className="text-sm font-medium text-base">01780963872</p>
//                 </div>
//                 <div className="py-[8px]">
//                   <p className="text-grey100 text-base">Permanent Address</p>
//                   <p className="text-sm font-medium text-base">
//                     84, swamibagh road, 1100, Dhaka
//                   </p>
//                 </div>
//                 <div className="py-[8px]">
//                   <p className="text-grey100 text-base">Gender</p>
//                   <p className="text-sm font-medium text-base">Male</p>
//                 </div>
//                 <div className="py-[8px]">
//                   <p className="text-grey100 text-base">Occupation</p>
//                   <p className="text-sm font-medium text-base">Service</p>
//                 </div>
//                 <div className="py-[8px]">
//                   <p className="text-grey100 text-base">Religion</p>
//                   <p className="text-sm font-medium text-base">Muslim</p>
//                 </div>
//               </div>
//               <div>
//                 <div className="py-[8px]">
//                   <p className="text-grey100 text-base">E-Mail</p>
//                   <p className="text-sm font-medium text-base">
//                     mahfujul.islam000@gmail.com
//                   </p>
//                 </div>

//                 <div className="py-[8px]">
//                   <p className="text-grey100 text-base">NID Number</p>
//                   <p className="text-sm font-medium text-base">
//                     526985236872635
//                   </p>
//                 </div>

//                 <div className="py-[8px]">
//                   <p className="text-grey100 text-base">Present Address</p>
//                   <p className="text-sm font-medium text-base">
//                     #84/3, Middle Pirerbagh, Mirpur, Dhaka
//                   </p>
//                 </div>
//                 <div className="py-[8px]">
//                   <p className="text-grey100 text-base">Age</p>
//                   <p className="text-sm font-medium text-base">28</p>
//                 </div>

//                 <div className="py-[8px]">
//                   <p className="text-grey100 text-base">Marital Status</p>
//                   <p className="text-sm font-medium text-base">Married</p>
//                 </div>
//               </div>
//               <div className="pt-5">
//                 <div className="py-2 flex justify-end">
//                   <img
//                     className="w-[143px] h-[83px]"
//                     src="/nid.png"
//                     alt="NID Image"
//                   />
//                 </div>
//                 <div className="py-2 flex justify-end">
//                   <img
//                     className="w-[143px] h-[83px]"
//                     src="/nid.png"
//                     alt="NID Image"
//                   />
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default MemberProfile;
