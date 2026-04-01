import React, { useEffect, useState, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import {
  updateOwner,
  fetchOwnerDetails,
  clearMessage,
  clearOwnerDetails
} from "../../../../redux/slices/owner/ownerSlice";

import {
  formatDate,
  ownerEditValidationSchema,
  parseOwnerError
} from "../utils/ownerUtils";

import { Paragraph } from "../../../../Components/Ui/Paragraph";
import FileDropzone from "../Components/FileDropzone";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import SubmitButton from "../../../../Components/FormComponent/ButtonComponent/SubmitButton";

const EditOwnerForm = ({ unitId, ownerId }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const ownerState = useSelector((state) => state.owner);
  const [searchTerm, setSearchTerm] = useState("");
  const [localError, setLocalError] = useState(null);
  const [isFormChanged, setIsFormChanged] = useState(false);
  const [existingFiles, setExistingFiles] = useState([]);
  const [docLinks, setDocLinks] = useState([]);
  const [docsToDelete, setDocsToDelete] = useState([]);
  const [originalFileCount, setOriginalFileCount] = useState(0);
  const [originalValues, setOriginalValues] = useState({
    memberId: "",
    ownershipPercentage: "",
    dateofOwnership: "",
    docLinks: []
  });
  const [isFormInitialized, setIsFormInitialized] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
    watch
  } = useForm({
    resolver: yupResolver(ownerEditValidationSchema),
    defaultValues: {
      memberId: "",
      ownershipPercentage: "",
      dateofOwnership: "",
      document: [],
      docLinks: []
    }
  });

  // Clear messages when component mounts and unmounts
  useEffect(() => {
    dispatch(clearMessage());
    dispatch(clearOwnerDetails()); // Clear any previous owner details
    setIsFormInitialized(false); // Reset initialization flag
    return () => {
      dispatch(clearMessage());
      dispatch(clearOwnerDetails()); // Clear owner details when unmounting
    };
  }, [dispatch]);

  // Fetch owner details when component mounts
  useEffect(() => {
    if (unitId && ownerId) {
      dispatch(clearOwnerDetails()); // Clear previous owner details before fetching new ones
      setIsFormInitialized(false); // Reset initialization flag
      dispatch(fetchOwnerDetails({ unitId, ownerId }));
    }
  }, [dispatch, unitId, ownerId]);

  // Set form values when owner details are loaded
  useEffect(() => {
    if (ownerState.ownerDetails) {
      const owner = ownerState.ownerDetails;
      console.log("🔍 Owner details received:", owner);
      console.log("🔍 Owner docs:", owner.docs);
      
      const memberId = owner.member?.id || "";
      const ownershipPercentage = owner.ownership_percentage?.toString() || "";
      const dateofOwnership = owner.date_of_ownership ? new Date(owner.date_of_ownership).toISOString().split('T')[0] : "";
      
      setValue("memberId", memberId);
      setValue("ownershipPercentage", ownershipPercentage);
      setValue("dateofOwnership", dateofOwnership);
      setSearchTerm(owner.member?.full_name || "");

      // Set original values for comparison
      const newOriginalValues = {
        memberId,
        ownershipPercentage,
        dateofOwnership,
        docLinks: []
      };
      setOriginalValues(newOriginalValues);

      // Set existing files if any - using 'docs' field from backend response
      if (owner.docs && owner.docs.length > 0) {
        const docs = owner.docs.map(doc => ({
          id: doc.id,
          url: doc.url
        }));
        console.log("🔍 Processed docs:", docs);
        setExistingFiles(docs);
        setDocLinks(docs);
        setOriginalFileCount(docs.length);
        setValue("docLinks", docs);
        
        // Update original values with docLinks
        setOriginalValues(prev => ({
          ...prev,
          docLinks: docs
        }));
      } else {
        console.log("🔍 No docs found in owner details");
        setOriginalFileCount(0);
      }

      // Mark form as initialized after everything is set
      setIsFormInitialized(true);
    }
  }, [ownerState.ownerDetails, setValue]);

  const watchedValues = watch();

  // Check for form changes - only after form is initialized
  useEffect(() => {
    if (!isFormInitialized) {
      return; // Don't run change detection until form is initialized
    }

    const subscription = watch((value) => {
      const currentFileCount = docLinks.length + (value.document?.length || 0);
      
      // Compare current values with original values
      const hasDateChanged = value.dateofOwnership !== originalValues.dateofOwnership;
      const hasNewFiles = value.document && value.document.length > 0;
      const hasFileCountChanged = currentFileCount !== originalFileCount;
      
      // Note: hasFilesDeleted is handled in a separate effect below
      const hasChanged = hasDateChanged || hasNewFiles || hasFileCountChanged;
      
      console.log("🔍 Form change detection:", {
        currentDate: value.dateofOwnership,
        originalDate: originalValues.dateofOwnership,
        hasDateChanged,
        hasNewFiles,
        hasFileCountChanged,
        currentFileCount,
        originalFileCount,
        hasChanged
      });
      
      setIsFormChanged(hasChanged);
    });

    return () => subscription.unsubscribe();
  }, [watch, docLinks, originalFileCount, originalValues, isFormInitialized]);

  // Monitor docsToDelete changes separately since it's not a form field
  useEffect(() => {
    if (!isFormInitialized) {
      return; // Don't run until form is initialized
    }

    const hasFilesDeleted = docsToDelete.length > 0;
    console.log("🔍 docsToDelete change detection:", {
      docsToDeleteLength: docsToDelete.length,
      hasFilesDeleted
    });

    if (hasFilesDeleted) {
      setIsFormChanged(true);
    } else {
      // Check if there are other changes when docsToDelete is empty
      const currentFileCount = docLinks.length + (watchedValues.document?.length || 0);
      const hasDateChanged = watchedValues.dateofOwnership !== originalValues.dateofOwnership;
      const hasNewFiles = watchedValues.document && watchedValues.document.length > 0;
      const hasFileCountChanged = currentFileCount !== originalFileCount;
      
      const hasOtherChanges = hasDateChanged || hasNewFiles || hasFileCountChanged;
      setIsFormChanged(hasOtherChanges);
    }
  }, [docsToDelete, isFormInitialized, docLinks, watchedValues, originalValues, originalFileCount]);

  // Reset form change detection after success
  useEffect(() => {
    if (ownerState.successMessage) {
      setIsFormChanged(false);
      setDocsToDelete([]); // Clear docs to delete after successful update
      // Update original file count to reflect the new state
      const currentFileCount = docLinks.length + (watchedValues.document?.length || 0);
      setOriginalFileCount(currentFileCount);
      
      // Update original values to reflect the new state
      setOriginalValues({
        memberId: watchedValues.memberId || "",
        ownershipPercentage: watchedValues.ownershipPercentage || "",
        dateofOwnership: watchedValues.dateofOwnership || "",
        docLinks: [...docLinks]
      });
    }
  }, [ownerState.successMessage, docLinks, watchedValues]);

  // Debug: Monitor docsToDelete changes
  useEffect(() => {
    console.log("🔍 docsToDelete state changed:", docsToDelete);
  }, [docsToDelete]);

  // Function to clear all states
  const clearAllStates = () => {
    setDocsToDelete([]);
    setLocalError(null);
    setIsFormChanged(false);
    // Reset form values for new files only - this will trigger FileDropzone cleanup
    setValue("document", []);
    console.log("🧹 States cleared for next operation");
  };

  // Handle image loading errors
  const handleImageError = (failedUrl) => {
    console.log("🔍 Image failed to load, removing from list:", failedUrl);
    setDocLinks(prevLinks => prevLinks.filter(link => {
      const linkUrl = typeof link === 'string' ? link : link.url;
      return linkUrl !== failedUrl;
    }));
  };

  const onSubmit = (data) => {
    const formData = new FormData();
    formData.append("member", data.memberId);
    formData.append("unit", parseInt(unitId, 10));
    formData.append("ownership_percentage", parseFloat(data.ownershipPercentage));
    formData.append("date_of_ownership", formatDate(data.dateofOwnership));

    // Handle file uploads
    if (data.document && data.document.length > 0) {
      data.document.forEach((file) => {
        if (file instanceof File) {
          formData.append("owner_docs_upload", file);
        }
      });
    }

    // Handle docs to delete
    docsToDelete.forEach(docId => {
      formData.append("docs_to_delete[]", docId);
    });

    // Debug: Log the FormData contents
    console.log("🔍 FormData contents:");
    for (let [key, value] of formData.entries()) {
      console.log(`  ${key}: ${value}`);
    }

    console.log(`📦 Payload for Update Owner:`, {
      member: data.memberId,
      unit: unitId,
      ownershipPercentage: data.ownershipPercentage,
      date_of_ownership: formatDate(data.dateofOwnership),
      documents: data.document?.length || 0,
      docsToDelete: docsToDelete,
      docLinks: data.docLinks
    });

    dispatch(updateOwner({ ownerId, formData }));
  };

  if (ownerState.ownerDetailsLoading) {
    return <div className="p-[20px]">Loading owner details...</div>;
  }

  if (ownerState.ownerDetailsError) {
    return <div className="p-[20px] text-red-500">{ownerState.ownerDetailsError}</div>;
  }

  if (!ownerState.ownerDetails) {
    return <div className="p-[20px]">No owner details available.</div>;
  }

  return (
    <>
      {(localError || ownerState.successMessage || ownerState.error) && (
        <MessageBox
          message={
            localError || 
            ownerState.successMessage || 
            parseOwnerError(ownerState.error)
          }
          error={!!(localError || ownerState.error)}
          clearMessage={() => {
            if (localError) {
              setLocalError(null);
            } else {
              dispatch(clearMessage());
            }
            // Clear states when message is cleared
            clearAllStates();
          }}
          onOk={() => {
            if (localError) {
              setLocalError(null);
            } else {
              dispatch(clearMessage());
              if (ownerState.successMessage) {
                // Clear all states before navigation
                setDocsToDelete([]);
                setDocLinks([]);
                setExistingFiles([]);
                setLocalError(null);
                setIsFormChanged(false);
                setOriginalFileCount(0);
                setSearchTerm("");
                setValue("memberId", "");
                setValue("ownershipPercentage", "");
                setValue("dateofOwnership", "");
                setValue("document", []);
                setValue("docLinks", []);
                console.log("🧹 All states cleared before navigation");
                navigate(`/unit-details/${unitId}?tab=2`);
              }
            }
            // Clear states when user clicks OK
            clearAllStates();
          }}
        />
      )}

      <div className="w-full md:w-3/4 p-6 flex flex-col min-w-0">
        <div className="max-w-xl">
          <form onSubmit={handleSubmit(onSubmit)} className="relative">
            <div className="mb-6">
              <h4 className="text-base font-medium mb-4 text-green">Edit Ownership Details</h4>

              <div className="grid grid-cols-1 gap-3">
            <div className="login-field !mt-0">
              <div className="mb-2 text-left">
                <label className="text-sm font-medium text-gray-900">
                  Unit Owner Name*
                </label>
              </div>
              <input
                type="text"
                value={searchTerm}
                className="w-full border px-3 py-2 rounded bg-gray-100 cursor-not-allowed"
                disabled={true}
                readOnly={true}
              />
              {errors.memberId && (
                <p className="text-red-500 text-sm">
                  {errors.memberId.message}
                </p>
              )}
            </div>
          </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <div className="login-field !mt-0">
              <div className="mb-2 text-left">
                <label className="text-sm font-medium text-gray-900">
                  Ownership Percentage*
                </label>
              </div>
              <Controller
                name="ownershipPercentage"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    className="w-full border px-3 py-2 rounded bg-gray-100 cursor-not-allowed"
                    disabled={true}
                    readOnly={true}
                  />
                )}
              />
              {errors.ownershipPercentage && (
                <p className="text-red-500 text-sm">
                  {errors.ownershipPercentage.message}
                </p>
              )}
            </div>

            <div className="login-field !mt-0">
              <div className="mb-2 text-left">
                <label className="text-sm font-medium text-gray-900">
                  Date of Ownership*
                </label>
              </div>
              <input
                type="date"
                {...register("dateofOwnership")}
                className="w-full border px-3 py-2 rounded bg-gray-100 cursor-not-allowed"
                disabled={true}
                readOnly={true}
              />
              {errors.dateofOwnership && (
                <p className="text-red-500 text-sm">
                  {errors.dateofOwnership.message}
                </p>
              )}
            </div>

            <div className="login-field sm:col-span-2 !mt-0">
              <div className="mb-2 text-left">
                <label className="text-sm font-medium text-gray-900">
                  Upload Ownership Documents
                </label>
              </div>

              {/* File count indicator */}
              <div className="mb-2 text-sm text-gray-600">
                Files: {docLinks.length + (watchedValues.document?.length || 0)}/5
              </div>

              {docLinks && docLinks.length > 0 && (
                <div className="mb-4">
                  <Paragraph className="my-3 text-sm font-medium text-gray-600">
                    Existing Ownership Documents
                  </Paragraph>
                  {console.log("🔍 Rendering existing docs FileDropzone with:", docLinks)}
                  <FileDropzone
                    files={[]}
                    docLinks={docLinks}
                    onDrop={() => {}}
                    onRemove={(fileIndex, type) => {
                      if (type === "docLink") {
                        const removedDoc = docLinks[fileIndex];
                        if (removedDoc && removedDoc.id) {
                          setDocsToDelete(prev => {
                            const newDocsToDelete = [...prev, removedDoc.id];
                            console.log("🔍 File removed:", {
                              removedDocId: removedDoc?.id,
                              updatedDocLinks: docLinks.filter((_, i) => i !== fileIndex),
                              docsToDelete: newDocsToDelete
                            });
                            return newDocsToDelete;
                          });
                        }
                        const updated = docLinks.filter((_, i) => i !== fileIndex);
                        setDocLinks(updated);
                        setValue("docLinks", updated, {
                          shouldDirty: true,
                          shouldValidate: true
                        });
                      }
                    }}
                    onImageError={handleImageError}
                    showRemoveButton={true}
                    showUploadButton={false}
                    showDropzone={false}
                    hideDropzoneMessage={true}
                  />
                </div>
              )}

              <FileDropzone
                files={watchedValues.document || []}
                docLinks={[]}
                onDrop={(acceptedFiles) => {
                  const currentFiles = watchedValues.document || [];
                  const existingFilesCount = docLinks.length;
                  const totalFiles = existingFilesCount + currentFiles.length + acceptedFiles.length;

                  if (totalFiles > 5) {
                    setError("document", {
                      type: "manual",
                      message: `You can upload a maximum of 5 documents total. You currently have ${existingFilesCount} existing files and ${currentFiles.length} new files.`
                    });
                    return;
                  }

                  setValue("document", [...currentFiles, ...acceptedFiles], {
                    shouldDirty: true,
                    shouldValidate: true
                  });
                  clearErrors("document");
                }}
                onRemove={(fileIndex, type) => {
                  if (type === "file") {
                    const updated = (watchedValues.document || []).filter((_, i) => i !== fileIndex);
                    setValue("document", updated, {
                      shouldDirty: true,
                      shouldValidate: true
                    });
                    if (updated.length + docLinks.length <= 5) {
                      clearErrors("document");
                    }
                  }
                }}
                onImageError={handleImageError}
                showRemoveButton={true}
                showUploadButton={docLinks.length + (watchedValues.document?.length || 0) < 5}
                showDropzone={docLinks.length + (watchedValues.document?.length || 0) < 5}
              />
              {errors.document && (
                <div className="text-red-500 text-sm mt-2">
                  {errors.document.message}
                </div>
              )}
            </div>
          </div>
        </div>

            <SubmitButton
              text={ownerState.loading ? "Updating..." : "Update Owner"}
              width="full"
              disabled={ownerState.loading || !isFormChanged}
            />
          </form>
        </div>
      </div>
    </>
  );
};

export default EditOwnerForm; 