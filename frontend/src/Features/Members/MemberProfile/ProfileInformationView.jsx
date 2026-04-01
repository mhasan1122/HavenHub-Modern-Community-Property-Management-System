import React from "react";
import { Link } from "react-router-dom";
// import { Info } from "Components/Ui/Info";
import DottedNidBox from "Components/ImageBox/DottedNidBox";
import { GrDownload } from "react-icons/gr";
import edit2 from "../../../assets/edit-02.png";
import { handleDownload } from "../../../utils/handleDownload";
import axios from "axios";
import Info from "../../../Components/Ui/Info";
import DynamicEditLink from "./DynamicLinkEditButton";

// Axios instance for base API URL
const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_API
});

/**
 * ProfileInformation Component
 * Extracted first-tab UI for displaying member profile details.
 *
 * @param {Object} props
 * @param {Object} props.memberData - Member data object
 * @param {Function} props.onEditClick - Handler for edit button click
 */
const ProfileInformationView = ({ memberData = {}, onEditClick }) => {
  // Destructure relevant fields with fallbacks
  const {
    id,
    full_name,
    general_contact,
    permanent_address,
    gender,
    occupation,
    religion,
    general_email,
    nid_number,
    present_address,
    date_of_birth,
    marital_status,
    nid_front,
    nid_back
  } = memberData;

  // Helper for downloading files
  const downloadFile = (path, filename) => {
    handleDownload(`${api.defaults.baseURL}${path}`, filename);
  };

  return (
    <div className="my-6">
      <div className="border border-borderLight rounded-lg p-4 md:p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-textDark">Profile Information</h3>
          <DynamicEditLink basePath="general-information-edit" resourceId={id} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <Info label="Full Name">{full_name}</Info>
            <Info label="Permanent Address">{permanent_address}</Info>
            <Info label="Occupation">{occupation}</Info>
            <Info label="E-Mail">{general_email}</Info>
            <Info label="Present Address">{present_address}</Info>
            <Info label="Marital Status">{marital_status}</Info>
          </div>

          <div>
            <Info label="Contact Number">{general_contact}</Info>
            <Info label="Gender">{gender}</Info>
            <Info label="Religion">{religion}</Info>
            <Info label="NID Number">{nid_number}</Info>
            <Info label="Date Of Birth">{date_of_birth}</Info>
          </div>

          <div className="md:pt-5 space-y-6 flex flex-col items-start md:items-end">
            {/* NID Front */}
            <div className="flex flex-col items-start md:items-end w-full">
              <p className="text-sm font-semibold text-textDark uppercase tracking-wide mb-3">
                NID Front
              </p>
              {nid_front ? (
                <div className="relative group">
                  <button
                    className="absolute -top-2 -right-2 z-10 cursor-pointer bg-white p-2 rounded-full shadow-lg hover:bg-primary hover:text-white transition-all duration-200"
                    onClick={() => downloadFile(nid_front, "nid_front_image.jpg")}
                    title="Download NID Front"
                  >
                    <GrDownload className="text-primary group-hover:text-white font-bold" />
                  </button>
                  <img
                    src={`${api.defaults.baseURL}${nid_front}`}
                    alt="NID Front"
                    className="rounded-lg border-2 border-borderLight object-cover w-32 h-32 md:w-28 md:h-28 shadow-sm"
                  />
                </div>
              ) : (
                <DottedNidBox title="NID Front" />
              )}
            </div>

            {/* NID Back */}
            <div className="flex flex-col items-start md:items-end w-full">
              <p className="text-sm font-semibold text-textDark uppercase tracking-wide mb-3">
                NID Back
              </p>
              {nid_back ? (
                <div className="relative group">
                  <button
                    className="absolute -top-2 -right-2 z-10 cursor-pointer bg-white p-2 rounded-full shadow-lg hover:bg-primary hover:text-white transition-all duration-200"
                    onClick={() => downloadFile(nid_back, "nid_back_image.jpg")}
                    title="Download NID Back"
                  >
                    <GrDownload className="text-primary group-hover:text-white font-bold" />
                  </button>
                  <img
                    src={`${api.defaults.baseURL}${nid_back}`}
                    alt="NID Back"
                    className="rounded-lg border-2 border-borderLight object-cover w-32 h-32 md:w-28 md:h-28 shadow-sm"
                  />
                </div>
              ) : (
                <DottedNidBox title="NID Back" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileInformationView;
