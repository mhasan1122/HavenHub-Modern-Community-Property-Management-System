import React, { useEffect, useState } from "react";
import { FaFacebookF, FaLinkedinIn } from "react-icons/fa";
import Info from "../../../Components/Ui/Info";
import user1 from "../../../assets/user/user.png";
import axios from "axios";
// import LoginCredentialEditView from "./LoginCredentialEditView";
const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_API
});
const MemberSummary = ({ member }) => {
  const [validFacebook, setValidFacebook] = useState(false);
  const [validLinkedin, setValidLinkedin] = useState(false);

  // Function to check if the URL is valid
  const checkLinkValidity = (url) => {
    try {
      const newUrl = new URL(url);
      return newUrl.protocol === "http:" || newUrl.protocol === "https:";
    } catch (e) {
      return false;
    }
  };

  // Function to format URL for clicking
  const formatUrl = (url) => {
    if (!url) return null;
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return null;

    // If it already has http:// or https://, return as is
    if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
      return trimmedUrl;
    }
    // Otherwise, add https://
    return `https://${trimmedUrl}`;
  };

  useEffect(() => {
    if (member?.facebook_profile) {
      setValidFacebook(checkLinkValidity(member?.facebook_profile));
    }
    if (member?.linkedin_profile) {
      setValidLinkedin(checkLinkValidity(member?.linkedin_profile));
    }
  }, [member]);

  return (
    <div className="flex h-full flex-col gap-6">
      <h3 className="text-base font-bold uppercase tracking-wider text-textDark pb-2 pt-2 border-b border-borderLight text-center md:text-left">
        Account Management
      </h3>
      {(() => {
        // Check for photo with proper validation (not null, undefined, or empty string)
        const photo = member?.photo && member.photo.trim() ? member.photo : null;
        const photoLowQuality = member?.photo_low_quality && member.photo_low_quality.trim() ? member.photo_low_quality : null;
        const photoPath = photo || photoLowQuality;

        return photoPath ? (
          <div className="flex justify-center">
            <img
              src={`${api.defaults.baseURL}${photoPath}`}
              alt="User profile photo"
              className="member-profile-image h-40 w-40 md:h-[240px] md:w-[240px] rounded-full border border-borderMid object-cover"
            />
          </div>
        ) : (
          <div className="flex justify-center">
            <img
              src={user1}
              alt="User placeholder"
              className="h-40 w-40 md:h-[240px] md:w-[240px] rounded-full border border-borderMid object-cover"
            />
          </div>
        );
      })()}

      <div className="space-y-2 pt-2 text-center md:text-left">
        <p className="text-xl font-bold text-textDark leading-tight">
          {member?.full_name || "Full Name"}
        </p>
        <p className="text-base font-medium text-textMedium">
          {member?.general_contact || "Contact Number"}
        </p>
      </div>

      <div className="space-y-2 pt-2">
        <Info label="Description">
          <p className="text-base font-normal text-ink leading-relaxed">
            {member?.about_us || "No description available."}
          </p>
        </Info>
      </div>

      <div className="flex items-center justify-center md:justify-start gap-3 pt-6">
        {member?.facebook_profile && member?.facebook_profile.trim() ? (
          <a
            href={formatUrl(member?.facebook_profile)}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${validFacebook
                ? "border-transparent bg-primary text-white hover:bg-primary/90"
                : "border-borderPale bg-surfaceAlt text-gray-400 hover:bg-gray-200"
              }`}
          >
            <FaFacebookF className="text-lg" />
          </a>
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-borderPale bg-surfaceAlt text-gray-400">
            <FaFacebookF className="text-lg" />
          </div>
        )}

        {member?.linkedin_profile && member?.linkedin_profile.trim() ? (
          <a
            href={formatUrl(member?.linkedin_profile)}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${validLinkedin
                ? "border-transparent bg-primary text-white hover:bg-primary/90"
                : "border-borderPale bg-surfaceAlt text-gray-400 hover:bg-gray-200"
              }`}
          >
            <FaLinkedinIn className="text-lg" />
          </a>
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-borderPale bg-surfaceAlt text-gray-400">
            <FaLinkedinIn className="text-lg" />
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberSummary;
