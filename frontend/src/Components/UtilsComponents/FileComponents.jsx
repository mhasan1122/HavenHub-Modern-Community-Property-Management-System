import { useState, useEffect } from "react";
import { RxCross2 } from "react-icons/rx";
import { FaCloudUploadAlt } from "react-icons/fa";
import SingleImageUpload from "../../utils/SingleImageUpload";
import { Div } from "../Ui/Div";
import ErrorMessage from "../MessageBox/ErrorMessage";
import front from "../../assets/nid/front_nid.png";
import back from "../../assets/nid/back_nid.png";

const FileComponents = ({
  onFileChange,
  savedFront,
  savedBack,
  allowedTypes,
  errorMessage = "Please upload a valid image",disabled = false
}) => {
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [file1error, setFile1error] = useState("");
  const [file2error, setFile2error] = useState("");

  useEffect(() => {
    if (savedFront) {
      setFile1(savedFront);
    }
  }, [savedFront]);

  useEffect(() => {
    if (savedBack) {
      setFile2(savedBack);
    }
  }, [savedBack]);

  // const handleFileChange1 = (e) => {
  //   const file = e.target.files[0];
  //   if (!file) return;

  //   if (file && !allowedTypes.includes(file.type)) {
  //     setFile1error(errorMessage);
  //     setFile1(null);
  //     return;
  //   }

  //   setFile1error("");
  //   setFile1(file);
  //   onFileChange("nid_front", file);
  // };

  // const handleFileChange2 = (e) => {
  //   const file = e.target.files[0];
  //   if (!file) return;

  //   if (file && !allowedTypes.includes(file.type)) {
  //     setFile2error(errorMessage);
  //     setFile2(null);
  //     return;
  //   }

  //   setFile2error("");
  //   setFile2(file);
  //   onFileChange("nid_back", file);
  // };
  const handleFileChange1 = (e) => {
    const file = e.target.files[0];
    if (!file) return;
  
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (!allowedTypes.includes(file.type) || file.size > maxSize) {
      setFile1error("Only JPG, JPEG, PNG files under 5MB are allowed.");
      setFile1(null);
      return;
    }
  
    setFile1error("");
    setFile1(file);
    onFileChange("nid_front", file);
  };
  
  const handleFileChange2 = (e) => {
    const file = e.target.files[0];
    if (!file) return;
  
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (!allowedTypes.includes(file.type) || file.size > maxSize) {
      setFile2error("Only JPG, JPEG, PNG files under 5MB are allowed.");
      setFile2(null);
      return;
    }
  
    setFile2error("");
    setFile2(file);
    onFileChange("nid_back", file);
  };
  
  const removeFile1 = () => {
    setFile1(null);
    onFileChange("nid_front", null);
  };

  const removeFile2 = () => {
    setFile2(null);
    onFileChange("nid_back", null);
  };

  return (
    <Div className="flex justify-center gap-3 pt-5">
      <Div className="flex justify-center gap-2 pb-5 lg:w-[687px]">
        {/* NID Front */}
        <Div className="profile-picture flex flex-col items-center space-4 px-5 border border-dashed border-[#D0D5DD] rounded-lg bg-white">
          {file1error && <ErrorMessage message={file1error} />}
          <label
            htmlFor="nid_front"
            className="w-full cursor-pointer"
          >
            {file1 ? (
              <Div className="my-[20px] flex justify-center items-center">
                <Div className="relative py-1">
                  <SingleImageUpload
                    file={file1}
                    altImg={front}
                    customClass="member_doc object-cover"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      if (disabled) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                      e.preventDefault();
                      e.stopPropagation();
                      removeFile1();
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
              accept={allowedTypes.join(",")}
              className="hidden"
              onChange={handleFileChange1}
              disabled={disabled}
            />
          </label>
        </Div>

        {/* NID Back */}
        <Div className="profile-picture flex flex-col items-center space-4 px-5 border border-dashed border-[#D0D5DD] rounded-lg bg-white">
          {file2error && <ErrorMessage message={file2error} />}
          <label
            htmlFor="nid_back"
            className="w-full cursor-pointer"
          >
            {file2 ? (
              <Div className="my-[20px] flex justify-center items-center">
                <Div className="relative py-1">
                  <SingleImageUpload
                    file={file2}
                    altImg={back}
                    customClass="member_doc object-cover"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      if (disabled) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                      e.preventDefault();
                      e.stopPropagation();
                      removeFile2();
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
              accept={allowedTypes.join(",")}
              className="hidden"
              onChange={handleFileChange2}
              disabled={disabled}
            />
          </label>
        </Div>
      </Div>
    </Div>
  );
};

export default FileComponents;