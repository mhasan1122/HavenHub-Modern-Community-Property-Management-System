import React, { useState, useEffect, useCallback } from "react";
import ErrorMessage from "../../../../Components/MessageBox/ErrorMessage";
import FileDropzone from "../../Owner/Components/FileDropzone";

const UnitGeneralInfoEditForm = ({
  selectedUnitDetails,
  onSubmit,
  handleUpload,
  uploadedImages,
  register,
  handleSubmit,
  errors,
  isDirty
}) => {
  const [files, setFiles] = useState([]);
  const [docLinks, setDocLinks] = useState([]);

  useEffect(() => {
    const newFiles = [];
    const newDocLinks = [];

    uploadedImages.forEach((item) => {
      if (item.isFromBackend) {
        newDocLinks.push({
          id: item.id,
          url: item.unit_docs || item.preview
        });
      } else {
        newFiles.push(item);
      }
    });

    setFiles(newFiles);
    setDocLinks(newDocLinks);
  }, [uploadedImages]);

  const handleDrop = useCallback((droppedFiles) => {
    const newFiles = droppedFiles.map((file) =>
      Object.assign(file, {
        isFromBackend: false
      })
    );
    handleUpload(newFiles, [], []);
  }, [handleUpload]);

  const handleRemove = useCallback((index, type) => {
    if (type === "file") {
      const fileToRemove = files[index];
      const updatedFiles = files.filter((_, i) => i !== index);
      setFiles(updatedFiles);
      handleUpload([], [fileToRemove], []);
    } else if (type === "docLink") {
      const linkToRemove = docLinks[index];
      const updatedDocLinks = docLinks.filter((_, i) => i !== index);
      setDocLinks(updatedDocLinks);
      handleUpload([], [], [linkToRemove.id]);
    }
  }, [files, docLinks, handleUpload]);

  const handleUpdate = useCallback((index, newFile) => {
    const fileToRemove = files[index];
    const updatedFiles = files.filter((_, i) => i !== index);
    setFiles(updatedFiles);

    const newFileObj = Object.assign(newFile, {
      isFromBackend: false
    });
    handleUpload([newFileObj], [fileToRemove], []);
  }, [files, handleUpload]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-3 md:p-6 w-full" method="POST">
      <h3 className="text-base text-primary font-bold">
        General Information
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full lg:w-[687px] mb-3">
        <div className="login-field">
          <div className="mb-2">
            <label className="block">Area/ sq. ft.</label>
          </div>
          <input
            type="text"
            {...register("area", {
              validate: (value) => {
                if (value && !/^\d+$/.test(value)) {
                  return "Only numbers are allowed";
                }
                return true;
              }
            })}
            className="border rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="Area"
          />
          {errors.area && <ErrorMessage message={errors.area.message} />}
        </div>

        <div className="login-field">
          <div className="mb-2">
            <label className="block">Number of Rooms</label>
          </div>
          <input
            type="text"
            {...register("number_of_rooms", {
              validate: (value) => {
                if (value && !/^\d+$/.test(value)) {
                  return "Only numbers are allowed";
                }
                return true;
              }
            })}
            className="border rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="Number of Rooms"
          />
          {errors.number_of_rooms && (
            <ErrorMessage message={errors.number_of_rooms.message} />
          )}
        </div>

        <div className="login-field">
          <div className="mb-2">
            <label className="block">Number of Bathrooms</label>
          </div>
          <input
            type="text"
            {...register("number_of_bathrooms", {
              validate: (value) => {
                if (value && !/^\d+$/.test(value)) {
                  return "Only numbers are allowed";
                }
                return true;
              }
            })}
            className="border rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="Number of Bathrooms"
          />
          {errors.number_of_bathrooms && (
            <ErrorMessage message={errors.number_of_bathrooms.message} />
          )}
        </div>

        <div className="login-field">
          <div className="mb-2">
            <label className="block">Number of Balconies</label>
          </div>
          <input
            type="text"
            {...register("number_of_balconies", {
              validate: (value) => {
                if (value && !/^\d+$/.test(value)) {
                  return "Only numbers are allowed";
                }
                return true;
              }
            })}
            className="border rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="Number of Balconies"
          />
          {errors.number_of_balconies && (
            <ErrorMessage message={errors.number_of_balconies.message} />
          )}
        </div>
      </div>

      <div className="w-full lg:w-[687px] mt-4 pb-4">
        <FileDropzone
          onDrop={handleDrop}
          files={files}
          docLinks={docLinks}
          onRemove={handleRemove}
          onUpdate={handleUpdate}
          showDropzone={true}
          showRemoveButton={true}
          showUploadButton={false}
        />
      </div>

      <div className="w-full lg:w-[687px]">
        <button
          type="submit"
          className={`px-4 py-2 font-semibold rounded transition-all duration-200 w-full ${
            isDirty
              ? "bg-primary text-white"
              : "bg-white cursor-not-allowed border border-primary text-primary"
          }`}
          disabled={!isDirty}
        >
          Save
        </button>
      </div>
    </form>
  );
};

export default UnitGeneralInfoEditForm;
