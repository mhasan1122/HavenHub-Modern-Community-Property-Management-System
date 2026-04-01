import { useEffect, useState } from "react";
import axios from "axios";
import { FaRegClock } from "react-icons/fa";
import { BiArrowBack } from "react-icons/bi";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";

import ProfileInformationTab from "../Components/ProfileInformationTab";
import CommunityMemberTab from "../Components/CommunityMemberTab";
import DottedNidBox from "../../../../Components/ImageBox/DottedNidBox";
import { fetchResidentDetails } from "../../../../redux/slices/residents/residentSlice";
import MemberSummary from "../../../Members/MemberProfile/MemberSummary";
import ProfileInformationView from "../../../Members/MemberProfile/ProfileInformationView";

const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_API
});

const ResidentDetails = () => {
  const { unitId, residentId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();

  // use location.state.activeTab if provided, otherwise default to 1
  const [activeTab, setActiveTab] = useState(location.state?.activeTab ?? 1);

  // Local state for the profile image error
  const [profileImgError, setProfileImgError] = useState(false);

  const { residentDetails, loadingResidentDetails, errorResidentDetails } =
    useSelector((state) => state.resident);

  useEffect(() => {
    if (unitId && residentId) {
      dispatch(fetchResidentDetails({ unitId, residentId }));
    }
  }, [dispatch, unitId, residentId]);

  // Create image URL using api.defaults.baseURL if path exists
  const imgUrl = (path) => (path ? `${api.defaults.baseURL}${path}` : "");

  if (loadingResidentDetails) {
    return (
      <div className="p-4">
        <p>Loading resident details...</p>
      </div>
    );
  }
  if (errorResidentDetails) {
    return (
      <div className="p-4">
        <p className="text-red-500">{errorResidentDetails}</p>
      </div>
    );
  }
  if (!residentDetails) {
    return (
      <div className="p-4">
        <p>No resident details available.</p>
      </div>
    );
  }

  // Include the member id from residentDetails.member so it can be passed to the edit page.
  const profileData = {
    id: residentDetails.member.id, // Added memberId here
    full_name: residentDetails.member.full_name,
    general_contact: residentDetails.member.general_contact,
    permanent_address: residentDetails.member.permanent_address,
    gender: residentDetails.member.gender,
    occupation: residentDetails.member.occupation,
    religion: residentDetails.member.religion,
    general_email: residentDetails.member.general_email,
    nid_number: residentDetails.member.nid_number,
    present_address: residentDetails.member.present_address,
    date_of_birth: residentDetails.member.date_of_birth,
    marital_status: residentDetails.member.marital_status,
    nid_front: residentDetails.member.nid_front,
    nid_back: residentDetails.member.nid_back,
    about_us: residentDetails.member.about_us,
    facebook_profile: residentDetails.member.facebook_profile,
    linkedin_profile: residentDetails.member.linkedin_profile
  };
  // console.log("residentDetails",residentDetails.member)
  return (
    <div className="p-4 h-full">
      <div className="container">
        <div className="py-4">
          <Link
            to="/addmember"
            className="flex items-center text-xl font-medium"
          >
            <BiArrowBack
              className="mr-2 text-gray-600 cursor-pointer"
              onClick={() => navigate(-1)}
            />
            Profile
          </Link>
        </div>
        <div className="md:flex rounded-lg max-w-5xl bg-white">
          {/* Sidebar */}

          <MemberSummary member={residentDetails?.member} />

          {/* Main Content */}
          <div className="p-6 flex-1">
            <div className="flex bg-subprimary rounded-lg">
              <button
                className={`flex-1 py-2 font-semibold border ${
                  activeTab === 1 ? "border-teal-600" : "border-transparent"
                }`}
                onClick={() => setActiveTab(1)}
              >
                Profile Information
              </button>
              <button
                className={`flex-1 py-2 font-semibold border ${
                  activeTab === 2 ? "border-teal-600" : "border-transparent"
                }`}
                onClick={() => setActiveTab(2)}
              >
                Community Member
              </button>
            </div>
            <div className="mt-6">
              {activeTab === 1&&  (
                <div>
                  <ProfileInformationView memberData={profileData} />
                </div>
              ) }{activeTab === 2 && (
                <CommunityMemberTab resident={residentDetails} unitId={unitId}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResidentDetails;
