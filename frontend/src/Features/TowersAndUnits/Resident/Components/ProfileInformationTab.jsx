import React from "react";
import { useNavigate } from "react-router-dom";
import { GrDownload } from "react-icons/gr";
import EditButton from "../../../../Components/Buttons/EditButton";
import DottedNidBox from "../../../../Components/ImageBox/DottedNidBox";
import { handleDownload,  } from "utils/handleDownload";

const ProfileInformationTab = ({ profileData }) => {
  const navigate = useNavigate();

  // Navigate to the edit route
  const handleEdit = () => {
    navigate(`/general-information-edit/${profileData.memberId}`);
  };

  // Helper to get full URL for NID images
  const getFullUrl = (path) => {
    if (!path) return null;
    // If path already includes http, return as-is, otherwise prepend baseURL
    return path.startsWith("http") ? path : `${baseURL}${path}`;
  };

  const fieldsLeft = [
    { label: "Full Name", value: profileData?.fullName },
    { label: "Contact Number", value: profileData?.contactNumber },
    { label: "Permanent Address", value: profileData?.permanentAddress },
    { label: "Gender", value: profileData?.gender },
    { label: "Occupation", value: profileData?.occupation },
    { label: "Religion", value: profileData?.religion },
  ];

  const fieldsMiddle = [
    { label: "E-Mail", value: profileData?.email },
    { label: "NID Number", value: profileData?.nidNumber },
    { label: "Present Address", value: profileData?.presentAddress },
    { label: "Date Of Birth", value: profileData?.dateOfBirth },
    { label: "Marital Status", value: profileData?.maritalStatus },
  ];

  const images = [
    { alt: "NID Front", path: profileData?.nidFront },
    { alt: "NID Back", path: profileData?.nidBack },
  ];

  return (
    <div className="mt-2">
      <div className="mx-auto border border-gray-100 rounded-lg p-5">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold">Profile Information</h2>
          <EditButton id={profileData.memberId} onClick={handleEdit} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            {fieldsLeft.map(({ label, value }) => (
              <div key={label} className="py-2">
                <p className="text-gray-600 text-sm">{label}</p>
                <p className="text-base font-medium">{value || "---"}</p>
              </div>
            ))}
          </div>

          <div>
            {fieldsMiddle.map(({ label, value }) => (
              <div key={label} className="py-2">
                <p className="text-gray-600 text-sm">{label}</p>
                <p className="text-base font-medium">{value || "---"}</p>
              </div>
            ))}
          </div>

          <div className="pt-5">
            {images.map(({ alt, path }) => {
              const url = getFullUrl(path);
              return (
                <div key={alt} className="py-2 flex flex-col items-end">
                  {url ? (
                    <>
                      <button
                        onClick={() => handleDownload(url, `${alt.toLowerCase().replace(/\s+/g, "_")}.jpg`)}
                      >
                        <GrDownload className="text-primary font-bold" />
                      </button>
                      <img
                        src={url}
                        alt={alt}
                        className="rounded-lg shadow-lg h-[64px] mt-1"
                      />
                    </>
                  ) : (
                    <DottedNidBox title={alt} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileInformationTab;
