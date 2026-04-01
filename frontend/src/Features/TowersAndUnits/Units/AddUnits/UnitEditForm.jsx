import React, { useState, useEffect, useCallback } from "react";
import { FaAddressBook } from "react-icons/fa";
import ErrorMessage from "../../../../Components/MessageBox/ErrorMessage";
import FileDropzone from "../../Owner/Components/FileDropzone";

const UnitEditForm = ({
  selectedUnitDetails,
  onSubmit,
  handleUpload,
  contactType,
  setContactType,
  showModal,
  setShowModal,
  handleContactSelect,
  uploadedImages,
  register,
  handleSubmit,
  setValue,
  errors,
  isDirty
}) => {
  const [files, setFiles] = useState([]);
  const [docLinks, setDocLinks] = useState([]);

  // Convert uploadedImages to files and docLinks format for FileDropzone
  useEffect(() => {
    const newFiles = [];
    const newDocLinks = [];

    uploadedImages.forEach((item) => {
      if (item.isFromBackend) {
        // Backend files go to docLinks
        newDocLinks.push({
          id: item.id,
          url: item.unit_docs || item.preview
        });
      } else {
        // New files go to files
        newFiles.push(item);
      }
    });

    setFiles(newFiles);
    setDocLinks(newDocLinks);
  }, [uploadedImages]);

  // Handle file drop - convert to onUpload format
  const handleDrop = useCallback((droppedFiles) => {
    const newFiles = droppedFiles.map((file) =>
      Object.assign(file, {
        isFromBackend: false
      })
    );
    handleUpload(newFiles, [], []);
  }, [handleUpload]);

  // Handle file removal
  const handleRemove = useCallback((index, type) => {
    if (type === "file") {
      // Remove from files array
      const fileToRemove = files[index];
      const updatedFiles = files.filter((_, i) => i !== index);
      setFiles(updatedFiles);
      handleUpload([], [fileToRemove], []);
    } else if (type === "docLink") {
      // Remove from docLinks array
      const linkToRemove = docLinks[index];
      const updatedDocLinks = docLinks.filter((_, i) => i !== index);
      setDocLinks(updatedDocLinks);
      handleUpload([], [], [linkToRemove.id]);
    }
  }, [files, docLinks, handleUpload]);

  // Handle file update (for replacing existing files)
  const handleUpdate = useCallback((index, newFile) => {
    // This is for replacing files, which we'll handle as remove + add
    const fileToRemove = files[index];
    const updatedFiles = files.filter((_, i) => i !== index);
    setFiles(updatedFiles);

    const newFileObj = Object.assign(newFile, {
      isFromBackend: false
    });
    handleUpload([newFileObj], [fileToRemove], []);
  }, [files, handleUpload]);

  const phoneValidation = {
    validate: (value) =>
      !value ||
      /^(018|019|013|017|015|016|014)\d{8}$/.test(value) ||
      "Invalid Bangladeshi phone number"
  };

  const emailValidation = {
    validate: (value) =>
      !value ||
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/.test(value) ||
      "Enter a valid email address"
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-3 md:p-6 w-full" method="POST">
      <h3 className="text-base text-primary font-bold ">
        General Information
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full lg:w-[687px] mb-3">
        <div className="login-field">
          <div className="mb-2">
            <label className="block ">Area/ sq. ft.</label>
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
            {" "}
            <label className="block ">Number of Rooms</label>
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
            {" "}
            <label className="block ">Number of Bathrooms</label>
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
            <label className="block ">Number of Balconies</label>
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

      {/* Primary Contact */}
      <div className="flex justify-between items-center mt-3">
        <h3 className="text-base text-primary font-bold pb-4 mt-4">
          Primary Contact
        </h3>
        <button
          type="button"
          onClick={() => {
            setContactType("primary");
            setShowModal(true);
          }}
          className="bg-primary text-white rounded text-sm py-2 px-4 m-2 flex items-center"
        >
          <FaAddressBook className="mr-2" />
          Add Contact
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full lg:w-[687px]">
        <div className="login-field">
          <div className="mb-2">
            <label className="block ">Number</label>
          </div>
          <input
            type="text"
            {...register("primary_number", phoneValidation)}
            className="rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="Number"
          />

          {errors.primary_number && (
            <ErrorMessage message={errors.primary_number.message} />
          )}
        </div>
        <div className="login-field">
          <div className="mb-2">
            {" "}
            <label className="block ">Name</label>
          </div>
          <input
            type="text"
            {...register("primary_name")}
            className="rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="Name"
          />
        </div>

        <div className="login-field">
          <div className="mb-2">
            {" "}
            <label className="block ">E-mail</label>
          </div>
          <input
            type="email"
            {...register("primary_email", emailValidation)}
            className="rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="E-mail"
          />

          {errors.primary_email && (
            <ErrorMessage message={errors.primary_email.message} />
          )}
        </div>
        <div className="login-field">
          <div className="mb-2">
            <label className="block ">Relationship</label>
          </div>
          <input
            type="text"
            {...register("primary_relationship")}
            className="rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="Relationship"
          />
        </div>
      </div>

      {/* Secondary Contact */}
      <div className="flex justify-between items-center mt-3">
        <h3 className="text-base text-primary font-bold pb-4 mt-4">
          Secondary Contact
        </h3>
        <button
          type="button"
          onClick={() => {
            setContactType("secondary");
            setShowModal(true);
          }}
          className="bg-primary text-white rounded text-sm py-2 px-4 m-2 flex items-center"
        >
          <FaAddressBook className="mr-2" />
          Add Contact
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full lg:w-[687px]">
        <div className="login-field">
          <div className="mb-2">
            <label className="block ">Number</label>
          </div>
          <input
            type="text"
            {...register("secondary_number", phoneValidation)}
            className="rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="Number"
          />

          {errors.secondary_number && (
            <ErrorMessage message={errors.secondary_number.message} />
          )}
        </div>
        <div className="login-field">
          <div className="mb-2">
            {" "}
            <label className="block ">Name</label>
          </div>
          <input
            type="text"
            {...register("secondary_name")}
            className="rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="Name"
          />
        </div>

        <div className="login-field">
          <div className="mb-2">
            {" "}
            <label className="block ">E-mail</label>
          </div>
          <input
            type="email"
            {...register("secondary_email", emailValidation)}
            className="rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="E-mail"
          />

          {errors.secondary_email && (
            <ErrorMessage message={errors.secondary_email.message} />
          )}
        </div>
        <div className="login-field">
          <div className="mb-2">
            {" "}
            <label className="block ">Relationship</label>
          </div>
          <input
            type="text"
            {...register("secondary_relationship")}
            className="rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="Relationship"
          />
        </div>
      </div>

      {/* Emergency Contact */}
      <h3 className="text-base text-primary font-bold pb-4 mt-4">
        Emergency Contact
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full lg:w-[687px]">
        <div className="login-field">
          <div className="mb-2">
            {" "}
            <label className="block ">Name</label>
          </div>
          <input
            type="text"
            {...register("emergency_name")}
            className="rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="Name"
          />
        </div>
        <div className="login-field">
          <div className="mb-2">
            <label className="block ">Phone Number</label>
          </div>
          <input
            type="text"
            {...register("emergency_number", phoneValidation)}
            className="rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="Phone Number"
          />

          {errors.emergency_number && (
            <ErrorMessage message={errors.emergency_number.message} />
          )}
        </div>

        <div className="login-field">
          <div className="mb-2">
            {" "}
            <label className="block ">Email</label>
          </div>
          <input
            type="email"
            {...register("emergency_email", emailValidation)}
            className="rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="Emergency Email"
          />

          {errors.emergency_email && (
            <ErrorMessage message={errors.emergency_email.message} />
          )}
        </div>
        <div className="login-field">
          <div className="mb-2">
            <label className="block ">Relationship</label>
          </div>
          <input
            type="text"
            {...register("emergency_relationship")}
            className="rounded p-2 w-full login-field-input focus:border-primary focus:outline-none"
            placeholder="Relationship"
          />
        </div>

        <div className="flex justify-left gap-2 pb-5 col-span-2 w-full">
          <div className="w-full">
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
        </div>
      </div>

      <div className="w-full lg:w-[687px] ">
        <button
          type="submit"
          className={`px-4 py-2  font-semibold rounded transition-all duration-200 w-full ${isDirty
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

export default UnitEditForm;
