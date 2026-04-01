import React, { useEffect } from "react";
import { FiX } from "react-icons/fi";
import axios from "axios";
// import { showCompanyList } from "./../../../../redux/slices/api/companyApi";
// import SearchBar from "Components/Search/SearchBar";
import SearchBar from "../../../../Components/Search/SearchBar";
import { Div } from "../../../../Components/Ui/Div";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { showCompanyList } from "../../../../redux/slices/api/companyApi";
import user1 from "../../../../assets/user/user.png";

const BASE_URL = import.meta.env.VITE_BASE_API;

const CompanyList = ({
  isOpen,
  onClose,

  company_data = {},
  onSelect,
}) => {
  if (!isOpen) return null;

  const [searchParams, setSearchParams] = useSearchParams();
  //   const dispatch = useDispatch();

  //   useEffect(() => {

  //          dispatch(showCompanyList(searchParams.get("search")));


  // }, [searchParams.get("search")!=null || searchParams.get("search")!=undefined || searchParams.get("search")!=""]);



  // company_data.map((items, index) => (

  //   console.log(items)


  // ))
  // console.log(company_data)
  // Merge and tag each member with their contact_type
  // const allMembers = [
  //   ...owners.map((member) => ({ ...member, contact_type: "owner" })),
  //   ...residents.map((member) => ({ ...member, contact_type: "resident" })),
  // ];
  // company_data.map((member, index) => (

  //   // console.log(member.company_name)
  //   // console.log(member.company_name)
  //   console.log(member)



  // ));


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative bg-white rounded-xl p-6 w-full md:max-w-[1000px] mx-0 sm:mx-4">
        <button
          onClick={() => {
            onClose();
            setSearchParams('');
          }}
          className="absolute top-0 right-0 text-white bg-primary rounded-md"
        >
          <FiX size={24} />
        </button>
        <Div className="flex items-center justify-between p-5">
          {/* Close button */}


          <h2 className="text-xl font-bold text-primary ">
            Company List
          </h2>

          <SearchBar />

        </Div>

        {/* Members Table */}
        <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
          {company_data.length > 0 ? (
            <table className="min-w-full text-sm text-left border border-gray-200">
              <thead className="bg-teal-50">
                <tr>
                  {[
                    "Name",
                    "Contact",
                    "Email",
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
                {company_data.map((items, index) => {
                  const member = items.member;

                  return (
                    <tr key={index} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-4 py-3 flex items-center gap-2">
                        <img
                          src={
                            member?.photo
                              ? `${BASE_URL}${member.photo}`
                              : user1
                          }
                          onError={(e) => (e.target.src = user1)}
                          alt={member?.full_name || "N/A"}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <span>{items.company_name}</span>
                      </td>
                      <td className="px-4 py-3">{member?.general_contact || "N/A"}</td>
                      <td className="px-4 py-3">{member?.general_email || "N/A"}</td>
                      <td className="px-4 py-3 capitalize">
                        {items?.company_member_type || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => onSelect && onSelect(items)}
                          className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Add
                        </button>
                      </td>
                    </tr>
                  );
                })}

              </tbody>
            </table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No Company available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanyList;
