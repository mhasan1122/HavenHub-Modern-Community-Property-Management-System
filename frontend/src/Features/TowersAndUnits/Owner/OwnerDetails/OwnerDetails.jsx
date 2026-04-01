import { useEffect, useState } from "react";
import { BiArrowBack } from "react-icons/bi";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import axios from "axios";
import { fetchOwnerDetails, clearOwnerDetails } from "../../../../redux/slices/owner/ownerSlice";
import ProfileInformationTab from "../Components/ProfileInformationTab";
import CommunityMemberTab from "../Components/CommunityMemberTab";
import DottedNidBox from "../../../../Components/ImageBox/DottedNidBox";
import MemberSummary from "../../../../Features/Members/MemberProfile/MemberSummary";
import ProfileInformationView from "../../../Members/MemberProfile/ProfileInformationView";

const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_API
});

const OwnerDetails = () => {
  const { unitId, ownerId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState(1);
  const [profileImgError, setProfileImgError] = useState(false);

  const { ownerDetails, loadingOwnerDetails, errorOwnerDetails } = useSelector(
    (state) => state.owner
  );

  useEffect(() => {
    if (unitId && ownerId) {
      dispatch(clearOwnerDetails());
      dispatch(fetchOwnerDetails({ unitId, ownerId }));
    }
    
    return () => {
      dispatch(clearOwnerDetails());
    };
  }, [dispatch, unitId, ownerId]);

  const imgUrl = (path) => (path ? `${api.defaults.baseURL}${path}` : "");

  const profileData = ownerDetails?.member
    ? {
      id: ownerDetails.member.id,
      full_name: ownerDetails.member.full_name,
      general_contact: ownerDetails.member.general_contact,
      permanent_address: ownerDetails.member.permanent_address,
      gender: ownerDetails.member.gender,
      occupation: ownerDetails.member.occupation,
      religion: ownerDetails.member.religion,
      general_email: ownerDetails.member.general_email,
      nid_number: ownerDetails.member.nid_number,
      present_address: ownerDetails.member.present_address,
      date_of_birth: ownerDetails.member.date_of_birth,
      marital_status: ownerDetails.member.marital_status,
      nid_front: ownerDetails.member.nid_front,
      nid_back: ownerDetails.member.nid_back,
      about_us: ownerDetails.member.about_us,
      facebook_profile: ownerDetails.member.facebook_profile,
      linkedin_profile: ownerDetails.member.linkedin_profile
    }
    : {};

  if (loadingOwnerDetails)
    return <div className="p-4">Loading owner details...</div>;
  if (errorOwnerDetails)
    return <div className="p-4 text-red-500">{errorOwnerDetails}</div>;
  if (!ownerDetails)
    return <div className="p-4">No owner details available.</div>;

  return (
    <div className="p-4 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center mb-6">
          <BiArrowBack
            className="text-2xl text-gray-700 cursor-pointer mr-3"
            onClick={() => navigate(-1)}
          />
          <h1 className="text-2xl font-semibold text-gray-800">
            Profile Details
          </h1>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          {/* <div className="bg-white rounded-xl shadow-md p-6 w-full md:w-80 text-center">
            {!profileImgError && ownerDetails?.member?.photo_low_quality ? (
              <img
                src={imgUrl(ownerDetails.member.photo_low_quality)}
                alt="Owner"
                className="rounded-xl h-52 w-full object-cover"
                onError={() => setProfileImgError(true)}
              />
            ) : (
              <DottedNidBox title="User Profile" />
            )}

            <h2 className="text-lg font-semibold mt-4">{profileData.fullName}</h2>
            <p className="text-gray-500 text-sm">{profileData.contactNumber}</p>

            <div className="mt-4">
              <p className="text-gray-500 text-sm font-medium mb-1">Description</p>
              <p className="text-sm text-gray-700">
                {profileData.aboutUs || "No Description info"}
              </p>
            </div>

            <div className="mt-4 space-y-1 text-sm text-blue-600">
              {profileData.facebookProfile && (
                <a href={profileData.facebookProfile} target="_blank" rel="noreferrer" className="block hover:underline">
                  Facebook
                </a>
              )}
              {profileData.linkedinProfile && (
                <a href={profileData.linkedinProfile} target="_blank" rel="noreferrer" className="block hover:underline">
                  LinkedIn
                </a>
              )}
            </div>
          </div> */}
          <div className="bg-white rounded-xl shadow-md p-6 w-full md:w-80 ">
            {" "}
            <MemberSummary member={ownerDetails?.member} />
          </div>

          {/* Main content */}
          <div className="flex-1 bg-white rounded-xl shadow-md p-6">
            <div className="flex border border-gray-300 rounded-lg overflow-hidden mb-6">
              <button
                className={`w-1/2 py-2 font-medium transition-all ${activeTab === 1
                    ? "bg-teal-600 text-white"
                    : "bg-white text-gray-700"
                  }`}
                onClick={() => setActiveTab(1)}
              >
                Profile Information
              </button>
              <button
                className={`w-1/2 py-2 font-medium transition-all ${activeTab === 2
                    ? "bg-teal-600 text-white"
                    : "bg-white text-gray-700"
                  }`}
                onClick={() => setActiveTab(2)}
              >
                Community Member
              </button>
            </div>

            {activeTab === 1 ? (
              <div>
                {/* <ProfileInformationTab profileData={profileData} /> */}
                <ProfileInformationView memberData={profileData} />
              </div>
            ) : (
              <CommunityMemberTab owner={ownerDetails} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerDetails;
