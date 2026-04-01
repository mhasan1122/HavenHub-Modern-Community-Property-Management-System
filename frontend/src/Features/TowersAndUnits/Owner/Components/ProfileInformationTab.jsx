import { Link } from "react-router-dom";
import DottedNidBox from "../../../../Components/ImageBox/DottedNidBox";
import Info from "../../../../Components/Ui/Info";
import edit2 from "../../../../assets/edit-02.png";
import { GrDownload } from "react-icons/gr";
import { handleDownload } from "../../../../utils/handleDownload";

const ProfileInformationTab = ({ profileData = {} }) => {
  const { memberId, nidFront, nidBack } = profileData;

  const personalInfo = [
    { label: "Full Name", value: profileData.fullName },
    { label: "Contact Number", value: profileData.contactNumber },
    { label: "Permanent Address", value: profileData.permanentAddress },
    { label: "Gender", value: profileData.gender },
    { label: "Occupation", value: profileData.occupation },
    { label: "Religion", value: profileData.religion },
  ];

  const identityInfo = [
    { label: "E-Mail", value: profileData.email },
    { label: "NID Number", value: profileData.nidNumber },
    { label: "Present Address", value: profileData.presentAddress },
    { label: "Date Of Birth", value: profileData.dateOfBirth },
    { label: "Marital Status", value: profileData.maritalStatus },
  ];

  const nidImages = [
    { label: "NID Front", src: nidFront, fileName: "nid_front.jpg" },
    { label: "NID Back", src: nidBack, fileName: "nid_back.jpg" },
  ];

  const handleImageDownload = (url, name) => {
    if (url) {
      handleDownload(url, name);
    }
  };

  return (
    <div className="border rounded-xl p-6 border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Profile Information</h2>
        <Link to={`/general-information-edit/${memberId}`}>
          <button className="flex items-center gap-2 py-1 px-3 rounded border border-gray-300 hover:bg-gray-100">
            <img src={edit2} alt="edit icon" className="w-4 h-4" />
            <span className="text-sm text-gray-700">Edit</span>
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Personal Info */}
        <div className="space-y-3">
          {personalInfo.map(({ label, value }) => (
            <Info key={label} label={label}>
              {value || "---"}
            </Info>
          ))}
        </div>

        {/* Identity Info */}
        <div className="space-y-3">
          {identityInfo.map(({ label, value }) => (
            <Info key={label} label={label}>
              {value || "---"}
            </Info>
          ))}
        </div>

        {/* NID Images */}
        <div className="space-y-5">
          {nidImages.map(({ label, src, fileName }) => (
            <div key={label} className="relative w-full h-60 rounded-md border border-gray-300 shadow-sm">
              {src ? (
                <>
                  <img
                    src={src}
                    alt={label}
                    className="w-full h-full object-contain rounded-md"
                  />
                  <button
                    onClick={() => handleImageDownload(src, fileName)}
                    className="absolute top-2 right-2 bg-white rounded-full p-2 shadow-md hover:bg-gray-100"
                    title={`Download ${label}`}
                  >
                    <GrDownload className="text-lg text-teal-600" />
                  </button>
                </>
              ) : (
                <DottedNidBox title={label} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfileInformationTab;