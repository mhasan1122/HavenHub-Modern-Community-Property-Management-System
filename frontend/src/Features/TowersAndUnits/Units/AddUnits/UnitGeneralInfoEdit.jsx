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
  unitUpdate
} from "../../../../redux/slices/units/unitSlice";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import UnitGeneralInfoEditForm from "./UnitGeneralInfoEditForm";
import { checkPermission } from "utils/permissionUtils";

const UnitGeneralInfoEdit = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [hasPermission, setHasPermission] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);

  const { selectedUnitDetails } = useSelector((state) => state.unit);
  const [initialFiles, setInitialFiles] = useState([]);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [filesToRemove, setFilesToRemove] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [filesDirty, setFilesDirty] = useState(false);

  const {
    register,
    handleSubmit,
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
    }
  }, [id, dispatch]);

  useEffect(() => {
    if (selectedUnitDetails && selectedUnitDetails.id) {
      reset({
        area: selectedUnitDetails.area || 0,
        number_of_rooms: selectedUnitDetails.number_of_rooms || 0,
        number_of_bathrooms: selectedUnitDetails.number_of_bathrooms || 0,
        number_of_balconies: selectedUnitDetails.number_of_balconies || 0
      });
      // Normalize existing docs coming from backend so the
      // form & uploader can reliably distinguish them from
      // newly added client-side files.
      const existing = (selectedUnitDetails.docs || []).map((doc) => ({
        ...doc,
        // Flag as coming from backend so:
        // - UnitGeneralInfoEditForm shows them as `docLinks`
        // - onSubmit can keep them unless explicitly removed
        isFromBackend: true
      }));
      setUploadedImages(existing);
      setInitialFiles(existing);
      setFilesDirty(false);
    }
  }, [selectedUnitDetails, reset]);

  useEffect(() => {
    const hasChanges = !(
      initialFiles.length === uploadedImages.length &&
      initialFiles.every((initialFile, index) => {
        const currentFile = uploadedImages[index];
        if (!currentFile) return false;

        if (initialFile.isFromBackend && currentFile.isFromBackend) {
          return initialFile.id === currentFile.id;
        }

        return (
          initialFile.name === currentFile.name &&
          initialFile.size === currentFile.size
        );
      })
    );

    setFilesDirty(hasChanges);
  }, [uploadedImages, initialFiles]);

  const onSubmit = async (data) => {
    const formData = new FormData();
    
    // Only include general information fields
    formData.append("area", data.area || 0);
    formData.append("number_of_rooms", data.number_of_rooms || 0);
    formData.append("number_of_bathrooms", data.number_of_bathrooms || 0);
    formData.append("number_of_balconies", data.number_of_balconies || 0);

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
      setMessage("General Information has been successfully updated.");
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

    if (newFiles.length > 0 || removedIds.length > 0) {
      setFilesDirty(true);
    }

    setFilesToRemove((prev) => [...new Set([...prev, ...removedIds])]);
  };

  const handleOk = () => {
    navigate(`/unit-details/${id}?tab=1`);
  };
  const combinedDirty = isDirty || filesDirty;

  if (loadingPermission) {
    return null;
  }

  if (!hasPermission) {
    return null;
  }

  return (
    <PageContainer className="bg-surfaceMuted">
      <MessageBox
        message={message}
        error={error}
        clearMessage={() => setShowSuccess(false)}
        onOk={handleOk}
      />

      <div className="sticky top-0 z-20 mb-1.5 flex items-center justify-between gap-3 bg-surfaceMuted/95 py-4 backdrop-blur">
        <div
          onClick={() => navigate(`/unit-details/${id}?tab=1`)}
          className="inline-flex cursor-pointer items-center gap-3 text-ink transition-colors hover:text-primary"
        >
          <ArrowHeading title="Edit General Information" size="2xl" color="text-black" />
        </div>
        <div className="flex items-center gap-6">
          <button
            className="flex flex-row justify-center items-center gap-1.5 w-[106px] h-12 p-4 bg-primary text-white rounded-lg text-base font-medium leading-[140%]"
            style={{
              boxShadow: 'inset 0px 7px 12px rgba(255, 255, 255, 0.08), inset 0px -2px 2px rgba(48, 48, 48, 0.1)'
            }}
            onClick={() => navigate(`/unit-history/${id}`)}
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
          <UnitGeneralInfoEditForm
            selectedUnitDetails={selectedUnitDetails}
            onSubmit={onSubmit}
            handleUpload={handleUpload}
            uploadedImages={uploadedImages}
            register={register}
            handleSubmit={handleSubmit}
            errors={errors}
            isDirty={combinedDirty}
          />
        </div>
      </section>
    </PageContainer>
  );
};

export default UnitGeneralInfoEdit;
