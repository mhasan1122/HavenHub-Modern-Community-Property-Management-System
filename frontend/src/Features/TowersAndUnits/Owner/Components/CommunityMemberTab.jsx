import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchUnitOwnershipByMember } from "../../../../redux/slices/owner/ownerSlice";
import EditButton from "../../../../Components/Buttons/EditButton";
import { GrDownload } from "react-icons/gr";
import { handleDownload } from "../../../../utils/handleDownload";
import { generateFileName, withExtension } from "../../../../utils/fileNameUtils";

const DOCUMENT_PAGE_NAME = "community_member_document";

const CommunityMemberTab = ({ owner }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const baseURL = import.meta.env.VITE_BASE_API;

  const loginCredential = {
    userName: owner.member?.username || "N/A",
    email: owner.member?.login_email,
    contact: owner.member?.login_contact,
  };


  const {
    unitOwnership,
    unitOwnershipLoading,
    unitOwnershipError,
  } = useSelector((state) => state.owner);

  useEffect(() => {
    if (owner.member?.id) {
      dispatch(fetchUnitOwnershipByMember(owner.member.id));
    }
  }, [dispatch, owner.member?.id]);

  const handleEditLogin = () => {
    navigate(`/login-credential-edit/${owner.member.id}`);
  };

  const isImage = (docPath) => {
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif"];
    return imageExtensions.some((ext) => docPath?.toLowerCase().endsWith(ext));
  };

  const getFullDocURL = (path) => `${baseURL}${path}`;
  const getDocExtension = (docPath) => {
    const match = docPath?.match(/\.([a-zA-Z0-9]+)$/);
    return match ? match[1] : "";
  };

  const getDownloadFileName = (docPath) => {
    const baseName = generateFileName(DOCUMENT_PAGE_NAME);
    const extension = getDocExtension(docPath);
    return withExtension(baseName, extension ? `.${extension}` : "");
  };

  return (
    <div className="space-y-6">
      {/* Login Credential */}
      <div className="border border-gray-200 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Login Credential</h2>
          {/* <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium text-white ${
                owner.is_active ? "bg-teal-600" : "bg-red-500"
              }`}
            >
              {owner.is_active ? "Active" : "Inactive"}
            </span>
            <EditButton id={owner.member.id} onClick={handleEditLogin} />
          </div> */}
        </div>
        <div className="space-y-2">
          <div>
            <p className="text-sm text-gray-500">User Name</p>
            <p className="text-base font-medium text-gray-800">{loginCredential.userName}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">E-mail / Phone number</p>
            <p className="text-base font-medium text-gray-800">
              {loginCredential?.email}  {loginCredential?.contact}
            </p>
          </div>
        </div>
      </div>

      {/* Unit Ownership List */}
      <div className="space-y-4">
        {unitOwnershipLoading ? (
          <p className="text-gray-600">Loading unit ownership data...</p>
        ) : unitOwnershipError ? (
          <p className="text-red-500">{unitOwnershipError}</p>
        ) : unitOwnership.length === 0 ? (
          <p className="text-gray-500">No unit ownership data available.</p>
        ) : (
          unitOwnership.map((unit, index) => (
            <div key={index} className="border border-gray-200 rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Unit {unit.unit_name}</h2>
                {/* <EditButton id={unit.unit_id} onClick={() => navigate(`/unit-information-edit/${unit.unit_id}`)} /> */}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-500">Tower Name</p>
                  <p className="text-base font-medium text-gray-800">{unit.tower_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tower Number</p>
                  <p className="text-base font-medium text-gray-800">{unit.tower_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ownership Date</p>
                  <p className="text-base font-medium text-gray-800">{unit.date_of_ownership}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ownership Percentage</p>
                  <p className="text-base font-medium text-gray-800">{unit.ownership_percentage}%</p>
                </div>
              </div>
              {/* Owner Documents */}
              {unit.docs?.length > 0 && (
                <div className="mt-6">
                  <p className="text-sm text-gray-500 mb-2">Documents</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {unit.docs.map((doc, docIndex) => {
                      const docUrl = getFullDocURL(doc);
                      return (
                        <div key={docIndex} className="relative group">
                          <div className="block border rounded overflow-hidden relative">
                            {isImage(doc) ? (
                              <img
                                src={docUrl}
                                alt={`Owner Doc ${docIndex + 1}`}
                                className="w-full h-48 object-cover"
                              />
                            ) : (
                              <div className="flex items-center justify-center h-48 bg-gray-100 text-sm">
                                View PDF
                              </div>
                            )}
                            <button
                              onClick={() =>
                                handleDownload(
                                  docUrl,
                                  getDownloadFileName(doc)
                                )
                              }
                              className="absolute top-2 right-2 p-1 bg-white rounded-full shadow hover:bg-gray-100"
                            >
                              <GrDownload className="text-teal-600 text-lg" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CommunityMemberTab;
