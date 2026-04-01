import React from "react";
import { RxCross2 } from "react-icons/rx";
import { FaFacebookF, FaLinkedinIn } from "react-icons/fa";
import TextareaComponent from "../../../../Components/FormComponent/TextareaComponent";
import TextInputComponent from "../../../../Components/FormComponent/TextInputComponent";
import Heading from "../../../../Components/HeadingComponent/Heading";
import { Div } from "../../../../Components/Ui/Div";
import SingleImageUpload from "../../../../utils/SingleImageUpload";
import nid from "../../../../../public/nid.png";
import user from "../../../../assets/user/user.png";
import ErrorMessage from "../../../../Components/MessageBox/ErrorMessage";
const SideSectionEdit = ({
  formData,
  handleChange,
  handleFileChange,
  removeFile,
  fileErrors,
}) => {
  return (
    <Div className="p-4 md:p-7 md:pe-12 bg-white w-full md:w-auto">
      <Div className="text-center mb-4">
        <Heading title="Upload Picture" size="lg" color="text-black" />
      </Div>
      {/* Profile Picture Upload */}
      <Div className="my-[20px] flex justify-center items-center">
        <Div className="relative">
          <Div className="h-[150px] w-[150px] md:h-[240px] md:w-[240px] rounded-full border border-borderMid overflow-hidden bg-graySurface">
            <SingleImageUpload
              file={formData.photo}
              altImg={user}
              customClass="!rounded-full !shadow-none object-cover scale-110"
              wrapperClassName="h-full w-full"
            />
          </Div>
          {formData.photo && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeFile("photo");
              }}
              className="absolute top-0 right-0 p-1 rounded-full bg-primary text-white"
            >
              <RxCross2 />
            </button>
          )}
        </Div>
      </Div>
      {/* File Upload Input */}
      {fileErrors.photo && <ErrorMessage message={fileErrors.photo} />}

      <Div className="my-[10px]">
        <label
          htmlFor="photo"
          className="cursor-pointer bg-primary text-white py-2 px-4 rounded w-full block text-center"
        >
          {formData.photo ? "Change Photo" : "Upload Photo"}
        </label>
        <input
          id="photo"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileChange(e, "photo")}
        />
      </Div>
      {/* Additional Fields */}
      <Div>
        <TextareaComponent
          value={formData.about_us}
          onChange={handleChange}
          name="about_us"
          label="Description"
          rows={6}
          placeholder="Write description"
        />

        {/* Facebook Profile */}
        <div className="my-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Facebook
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <FaFacebookF
                className={`text-lg ${formData.facebook_profile && formData.facebook_profile.trim() !== ""
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
              className="w-full pl-10 pr-4 py-2 border rounded-[10px] focus:outline-none bg-stroke text-black transition-all duration-200 border-borderSecondary hover:border-borderMid hover:bg-white focus:border-primary focus:bg-white focus:shadow-ring-primary"
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
                className={`text-lg ${formData.linkedin_profile && formData.linkedin_profile.trim() !== ""
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
              className="w-full pl-10 pr-4 py-2 border rounded-[10px] focus:outline-none bg-stroke text-black transition-all duration-200 border-borderSecondary hover:border-borderMid hover:bg-white focus:border-primary focus:bg-white focus:shadow-ring-primary"
            />
          </div>
        </div>
      </Div>
    </Div>
  );
};
export default SideSectionEdit;
