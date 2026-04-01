import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import TextInputComponent from "Components/FormComponent/TextInputComponent";
import TextareaComponent from "Components/FormComponent/TextareaComponent";
import SingleImageUpload from "../../../utils/SingleImageUpload";
import { RxCross2 } from "react-icons/rx";
import { FaFacebookF, FaLinkedinIn } from "react-icons/fa";
import Heading from "Components/HeadingComponent/Heading";
import { Div } from "Components/Ui/Div";
import img1 from "../../../../public/login.jpg";
import user1 from "../../../assets/user/user.png";
import ErrorMessage from "../../../Components/MessageBox/ErrorMessage";

const MemberSideForm = ({
  memberFields,
  formData,
  setFormData,
  handleChange,
  onFileChange,
  allowedTypes,
  errorMessage = "Please upload a valid image",
  savedPhoto,
  disabled=false,
  activeTab = 1
}) => {
  const [fileObj, setFileObj] = useState(null); // for File or string (URL)
  const [previewUrl, setPreviewUrl] = useState(""); // always a string
  const [fileError, setFileError] = useState("");

  // Clear file error when navigating away from tab 1
  useEffect(() => {
    if (activeTab !== 1) {
      setFileError("");
    }
  }, [activeTab]);

  // Handle external savedPhoto (string URL)
  useEffect(() => {
    if (savedPhoto && typeof savedPhoto === "string" && savedPhoto.startsWith("http")) {
      setFileObj(null); // no File, just a URL
      setPreviewUrl(savedPhoto);
    } else if (!savedPhoto && !fileObj) {
      // Clear preview when savedPhoto is removed and no file is selected
      setPreviewUrl("");
    }
  }, [savedPhoto, fileObj]);

  // When fileObj changes to a File, make a preview URL
  useEffect(() => {
    if (fileObj && fileObj instanceof File) {
      const url = URL.createObjectURL(fileObj);
      setPreviewUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    } else if (!fileObj) {
      setPreviewUrl(""); // if cleared
    }
  }, [fileObj]);

  // Handle file input
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type) || file.size > maxSize) {
      setFileError("Only JPG, JPEG, PNG files under 5MB are allowed.");
      setFileObj(null);
      setFormData((prev) => ({ ...prev, photo: "" }));
      onFileChange("photo", "");
      return;
    }

    setFileError("");
    setFileObj(file);
    setFormData((prev) => ({ ...prev, photo: file }));
    onFileChange("photo", file);
  };

  // Remove file & preview
  const removeFile = () => {
    setFileObj(null);
    setFileError("");
    setFormData((prev) => ({ ...prev, photo: "" }));
    onFileChange("photo", "");
  };

  return (
<Div className="bg-white h-full">
   <div className="mb-2 text-center">   <Heading title="Upload Picture" size="lg" color="text-black" /></div>
      <Div className="flex justify-center">
        {previewUrl ? (
          <Div className="my-[20px] relative inline-block">
            <div className="h-[180px] w-[180px] sm:h-[240px] sm:w-[240px] rounded-full overflow-hidden border border-borderMid">
              <img
                src={previewUrl}
                alt="Profile"
                className="member-profile-image11 h-full w-full object-cover scale-110"
              />
            </div>
            <button
              type="button"
              onClick={removeFile}
              className="absolute top-0 right-0 p-1 rounded-full bg-primary text-white"
            >
              <RxCross2 />
            </button>
          </Div>
        ) : (
          <div className="my-[20px] flex justify-center">
            <img
              src={user1}
              alt="Profile placeholder"
              className="h-[180px] w-[180px] sm:h-[240px] sm:w-[240px] rounded-full border border-borderMid object-cover"
            />
          </div>
        )}
      </Div>
      {fileError && <ErrorMessage message={fileError} />}
      <Div className="w-full my-[20px]">
     

     <label
        htmlFor="photo"
        className={`  py-2 px-4 rounded w-full block text-center
          ${disabled ? 'bg-disabledInput cursor-not-allowed text-black100' : ' bg-primary cursor-pointer text-white'}
        `}
        onClick={e => disabled && e.preventDefault()} // prevent click if disabled
       >
        Upload Photo
      </label>


        <input
          id="photo"
          type="file"
          accept="image/jpeg, image/png, image/jpg"
          className="hidden"
          onChange={handleFileChange}
        />
      </Div>
      <Div>
        <TextareaComponent
          value={formData.about_us}
          onChange={handleChange}
          name={memberFields.about_us.name}
          label={memberFields.about_us.label}
          rows={memberFields.about_us.rows || 6}
          field={memberFields.about_us}
          disabled={disabled}
          placeholder="Enter Description Here"
        />
        
        {/* Facebook Profile */}
        <div className="my-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Facebook
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <FaFacebookF 
                className={`text-lg ${
                  formData.facebook_profile && formData.facebook_profile.trim() !== ""
                    ? "text-primary"
                    : "text-gray-400"
                }`}
              />
            </div>
            <input
              type="text"
              value={formData.facebook_profile || ""}
              onChange={handleChange}
              name="facebook_profile"
              placeholder="Facebook Profile"
              disabled={disabled}
              className={`w-full pl-10 pr-4 py-2 border rounded-[10px] focus:outline-none transition-all duration-200 border-borderSecondary hover:border-borderMid focus:border-primary focus:shadow-ring-primary ${
                disabled 
                  ? "bg-disabledInput cursor-not-allowed text-grey100 border-borderSecondary" 
                  : "bg-stroke text-black hover:bg-white focus:bg-white"
              }`}
            />
          </div>
        </div>

        {/* LinkedIn Profile */}
        <div className="my-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Linkedin
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <FaLinkedinIn 
                className={`text-lg ${
                  formData.linkedin_profile && formData.linkedin_profile.trim() !== ""
                    ? "text-primary"
                    : "text-gray-400"
                }`}
              />
            </div>
            <input
              type="text"
              value={formData.linkedin_profile || ""}
              onChange={handleChange}
              name="linkedin_profile"
              placeholder="LinkedIn Profile"
              disabled={disabled}
              className={`w-full pl-10 pr-4 py-2 border rounded-[10px] focus:outline-none transition-all duration-200 border-borderSecondary hover:border-borderMid focus:border-primary focus:shadow-ring-primary ${
                disabled 
                  ? "bg-disabledInput cursor-not-allowed text-grey100 border-borderSecondary" 
                  : "bg-stroke text-black hover:bg-white focus:bg-white"
              }`}
            />
          </div>
        </div>
      </Div>
    </Div>
  );
};

MemberSideForm.propTypes = {
  memberFields: PropTypes.object.isRequired,
  formData: PropTypes.object.isRequired,
  setFormData: PropTypes.func.isRequired,
  handleChange: PropTypes.func.isRequired,
  onFileChange: PropTypes.func.isRequired,
  allowedTypes: PropTypes.array.isRequired,
  errorMessage: PropTypes.string,
  savedPhoto: PropTypes.string,
  activeTab: PropTypes.number
};

export default MemberSideForm;