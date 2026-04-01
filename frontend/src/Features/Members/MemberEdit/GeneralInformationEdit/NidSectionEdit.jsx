import React from "react";
import { RxCross2 } from "react-icons/rx";
import { FaCloudUploadAlt } from "react-icons/fa";
import { Div } from "../../../../Components/Ui/Div";
import SingleImageUpload from "../../../../utils/SingleImageUpload";
// import nid from '../../../../../public/nid.png'
import front from "../../../../../src/assets/nid/front_nid.png";
import back from "../../../../../src/assets/nid/back_nid.png";
import ErrorMessage from "../../../../Components/MessageBox/ErrorMessage";

const NidSectionEdit = ({ formData, handleChange, handleFileChange, removeFile, fileErrors }) => {
  return (
    <div>
      <Div className="flex justify-center gap-3 py-2">
        <Div className="flex flex-col md:flex-row justify-center gap-4 pb-5 w-full max-w-[687px]">
          {/* NID Front */}
          <Div className="profile-picture flex flex-col items-center space-4 px-5 border border-dashed border-[#D0D5DD] rounded-lg bg-white">
            {fileErrors.nid_front && <ErrorMessage message={fileErrors.nid_front} />}

            <label
              htmlFor="nid_front"
              className="w-full cursor-pointer"
            >
              {formData.nid_front ? (
                <Div className="my-[20px] flex justify-center items-center">
                  <Div className="relative py-1">
                    <SingleImageUpload
                      file={formData.nid_front}
                      altImg={front}
                      customClass="member_doc object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeFile("nid_front");
                      }}
                      className="absolute top-0 right-0 p-1 rounded-full bg-primary text-white"
                    >
                      <RxCross2 />
                    </button>
                  </Div>
                </Div>
              ) : (
                <Div className="flex flex-col items-center justify-center py-6 px-4 min-h-[140px]">
                  <FaCloudUploadAlt className="text-3xl text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-600">Upload NID Front Side</p>
                </Div>
              )}
              <input
                id="nid_front"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, "nid_front")}
              />
            </label>
          </Div>
          {/* {fileErrors.nid_front && <p className="text-red-500">{fileErrors.nid_front}</p>} */}


          {/* NID Back */}
          <Div className="profile-picture flex flex-col items-center space-4 px-5 border border-dashed border-[#D0D5DD] rounded-lg bg-white">
            {fileErrors.nid_back && <ErrorMessage message={fileErrors.nid_back} />}

            <label
              htmlFor="nid_back"
              className="w-full cursor-pointer"
            >
              {formData.nid_back ? (
                <Div className="my-[20px] flex justify-center items-center">
                  <Div className="relative py-1">
                    <SingleImageUpload
                      file={formData.nid_back}
                      altImg={back}
                      customClass="member_doc object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeFile("nid_back");
                      }}
                      className="absolute top-0 right-0 p-1 rounded-full bg-primary text-white"
                    >
                      <RxCross2 />
                    </button>
                  </Div>
                </Div>
              ) : (
                <Div className="flex flex-col items-center justify-center py-6 px-4 min-h-[140px]">
                  <FaCloudUploadAlt className="text-3xl text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-600">Upload NID Back Side</p>
                </Div>
              )}
              <input
                id="nid_back"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, "nid_back")}
              />
            </label>
          </Div>
        </Div>
      </Div>
    </div>
  );
};

export default NidSectionEdit;
