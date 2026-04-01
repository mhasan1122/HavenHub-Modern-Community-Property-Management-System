import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { FaRegClock } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import ArrowHeading from "../../../../Components/HeadingComponent/ArrowHeading";
import PageContainer from "../../../../Components/Ui/PageContainer";

import Button from "../../../../Components/FormComponent/ButtonComponent/Button";
import UnitTowerInfo from "../../UnitDetails/components/UnitTowerInfo";
import {
  unitDetails,
  addExistingContact,
  unitUpdate
} from "../../../../redux/slices/units/unitSlice";
import AddUnitContactModal from "./AddUnitContactModal";
import MessageBox from "../../../../Components/MessageBox/MessageBox";

import UnitEditForm from "./UnitEditForm";
import { checkPermission } from "utils/permissionUtils";
 

const UnitEdit = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
     const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);

  const { selectedUnitDetails } = useSelector(
    (state) => state.unit
  );
  const [initialFiles, setInitialFiles] = useState([]);

  const [uploadedImages, setUploadedImages] = useState([]);
  const [filesToRemove, setFilesToRemove] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [contactType, setContactType] = useState(null);
  const [filesDirty, setFilesDirty] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    // formState: { errors },
    reset,
    formState: { errors, isDirty }
  } = useForm({
    defaultValues: {
      area: 0,
      number_of_rooms: 0,
      number_of_bathrooms: 0,
      number_of_balconies: 0
    }
  });
 

  useEffect(() => {
    const fetchPermission = async () => {
      const permissionGranted = await checkPermission("org", 14);
      setHasPermission(permissionGranted);
      setLoadingPermission(false);
    };
    fetchPermission();
  }, []);

  useEffect(() => {
    if (!loadingPermission && !hasPermission) {
      navigate("/not-authorized");
    }
  }, [loadingPermission, hasPermission, navigate]);

  useEffect(() => {
    if (id) {
      dispatch(unitDetails(id));
      dispatch(addExistingContact(id));
    }
  }, [id, dispatch]);

  // Existing useEffect for initial data load
  useEffect(() => {
    if (selectedUnitDetails && selectedUnitDetails.id) {
      reset({
        area: selectedUnitDetails.area || 0,
        number_of_rooms: selectedUnitDetails.number_of_rooms || 0,
        number_of_bathrooms: selectedUnitDetails.number_of_bathrooms || 0,
        number_of_balconies: selectedUnitDetails.number_of_balconies || 0,
        primary_name: selectedUnitDetails.primary_name,
        primary_number: selectedUnitDetails.primary_number,
        primary_email: selectedUnitDetails.primary_email,
        primary_relationship: selectedUnitDetails.primary_relationship,
        secondary_name: selectedUnitDetails.secondary_name,
        secondary_number: selectedUnitDetails.secondary_number,
        secondary_email: selectedUnitDetails.secondary_email,
        secondary_relationship: selectedUnitDetails.secondary_relationship,
        emergency_name: selectedUnitDetails.emergency_name,
        emergency_number: selectedUnitDetails.emergency_number,
        emergency_email: selectedUnitDetails.emergency_email,
        emergency_relationship: selectedUnitDetails.emergency_relationship
      });
      const existing = selectedUnitDetails.docs || [];
      setUploadedImages(existing);
      setInitialFiles(existing); // Set initial files here
      setFilesDirty(false);
    }
  }, [selectedUnitDetails, reset]);

  useEffect(() => {
    const hasChanges = !(
      initialFiles.length === uploadedImages.length &&
      initialFiles.every((initialFile, index) => {
        const currentFile = uploadedImages[index];
        if (!currentFile) return false;

        // Compare backend files by ID
        if (initialFile.isFromBackend && currentFile.isFromBackend) {
          return initialFile.id === currentFile.id;
        }

        // Compare new files by name and size
        return (
          initialFile.name === currentFile.name &&
          initialFile.size === currentFile.size
        );
      })
    );

    setFilesDirty(hasChanges);
  }, [uploadedImages, initialFiles]);

  const handleContactSelect = (contact) => {
    if (contactType === "primary") {
      setValue("primary_name", contact.full_name, { shouldDirty: true });
      setValue("primary_number", contact.general_contact, {
        shouldDirty: true
      });
      setValue("primary_email", contact.general_email, { shouldDirty: true });
    } else if (contactType === "secondary") {
      setValue("secondary_name", contact.full_name, { shouldDirty: true });
      setValue("secondary_number", contact.general_contact, {
        shouldDirty: true
      });
      setValue("secondary_email", contact.general_email, { shouldDirty: true });
    }
    setShowModal(false);
  };

  const onSubmit = async (data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });

    uploadedImages.forEach((file) => {
      if (file.isFromBackend) {
        formData.append("existing_data", file.id);
      } else if (file instanceof Blob) {
        formData.append("docs", file, file.name);
      }
    });

    filesToRemove.forEach((id) => {
      formData.append("filesToRemove", id);
    });

    try {
      await dispatch(unitUpdate({ id, data: formData })).unwrap();
      setMessage("Unit Information has been successfully added.");
      setShowSuccess(true);
    } catch (err) {
      setError(err.message || "Failed to update unit.");
    }
  };

  const handleUpload = (newFiles = [], removedFiles = [], removedIds = []) => {
    setUploadedImages((prev) => {
      const updated = prev.filter(
        (file) =>
          !removedIds.includes(file.id) &&
          !removedFiles.some(
            (f) =>
              !file.isFromBackend &&
              f.name === file.name &&
              f.size === file.size
          )
      );

      const filesToAdd = newFiles.filter(
        (newFile) =>
          !updated.some(
            (existing) =>
              (newFile.isFromBackend &&
                existing.isFromBackend &&
                newFile.id === existing.id) ||
              (!newFile.isFromBackend &&
                !existing.isFromBackend &&
                newFile.name === existing.name &&
                newFile.size === existing.size)
          )
      );

      return [...updated, ...filesToAdd];
    });

    // mark dirty when files change
    if (newFiles.length > 0 || removedIds.length > 0) {
      setFilesDirty(true);
    }

    setFilesToRemove((prev) => [...new Set([...prev, ...removedIds])]);
  };

  const handleOk = () => {
    navigate(`/unit-details/${id}`);
  };
  const combinedDirty = isDirty || filesDirty;

  // Only block rendering if permission is still loading
  // Don't use skeleton loading hook here as it causes infinite loading
  if (loadingPermission) {
    return null; // Or a simple loading spinner if preferred
  }

  // Don't render if no permission and navigation is pending
  if (!hasPermission) {
    return null;
  }

  return (
    <PageContainer className="bg-surfaceMuted">
      <AddUnitContactModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSelect={handleContactSelect}
        unitId={id}
      />

      <MessageBox
        message={message}
        error={error}
        clearMessage={() => setShowSuccess(false)}
        onOk={handleOk}
      />

      <div className="sticky top-0 z-20 mb-1.5 flex items-center justify-between gap-3 bg-surfaceMuted/95 py-4 backdrop-blur">
        <div
          onClick={() => navigate(`/unit-details/${id}`)}
          className="inline-flex cursor-pointer items-center gap-3 text-ink transition-colors hover:text-primary"
        >
          <ArrowHeading title="Unit details" size="2xl" color="text-black" />
        </div>
        <div className="flex items-center gap-6">
          <button
            className="flex flex-row justify-center items-center gap-1.5 w-[106px] h-12 p-4 bg-primary text-white rounded-lg text-base font-medium leading-[140%]"
            style={{
              boxShadow: 'inset 0px 7px 12px rgba(255, 255, 255, 0.08), inset 0px -2px 2px rgba(48, 48, 48, 0.1)'
            }}
          >
            <FaRegClock className="w-4 h-4" />
            History
          </button>
        </div>
      </div>

      <section className="mx-auto w-full rounded-[32px] border border-borderLight bg-white px-8 py-10">
        <div className="flex flex-col md:flex-row">
          <UnitTowerInfo id={id} />
          <div className="hidden md:block w-px bg-borderLight" />
          <UnitEditForm
            selectedUnitDetails={selectedUnitDetails}
            onSubmit={onSubmit}
            handleUpload={handleUpload}
            contactType={contactType}
            setContactType={setContactType}
            showModal={showModal}
            setShowModal={setShowModal}
            handleContactSelect={handleContactSelect}
            uploadedImages={uploadedImages}
            register={register}
            handleSubmit={handleSubmit}
            setValue={setValue}
            errors={errors}
            isDirty={combinedDirty}
          />
        </div>
      </section>
    </PageContainer>
  );
};

export default UnitEdit;
