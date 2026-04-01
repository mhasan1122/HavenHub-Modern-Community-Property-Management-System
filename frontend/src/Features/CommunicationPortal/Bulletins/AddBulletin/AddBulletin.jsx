import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import ArrowHeading from "../../../../Components/HeadingComponent/ArrowHeading";
import PageContainer from "../../../../Components/Ui/PageContainer";
import BulletinPreview from "../components/BulletinPreview";
import AddBulletinForm from "./AddBulletinForm";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";
import useCurrentUser from "../../Announcements/hooks/useCurrentUser";

// Emoji validation function
const containsEmoji = (text) => {
  if (!text) return false;
  // Regex to detect emojis including various Unicode ranges
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]/u;
  return emojiRegex.test(text);
};

// Validation schema (without date/time and priority fields)
const bulletinSchema = yup.object().shape({
  title: yup
    .string()
    .required("Title is required")
    .test("no-emoji", "Emojis are not allowed in title", (value) => {
      if (!value) return true;
      return !containsEmoji(value);
    })
    .test("word-count", "Title must be 10 words or less", (value) => {
      if (!value) return true;
      return value.trim().split(/\s+/).length <= 10;
    }),
  description: yup
    .string()
    .test("no-emoji", "Emojis are not allowed in description", (value) => {
      if (!value) return true;
      return !containsEmoji(value);
    })
    .test("word-count", "Description must be 100 words or less", (value) => {
      if (!value) return true;
      return value.trim().split(/\s+/).length <= 100;
    }),
  postAs: yup.string().required("Post as selection is required"),
  creatorName: yup.string().required("Creator name is required"),
  selectedMemberId: yup.string().when("postAs", {
    is: "Member",
    then: (schema) => schema.required("Please select a member"),
    otherwise: (schema) => schema.notRequired()
  }),
  selectedMemberName: yup.string().when("postAs", {
    is: "Member",
    then: (schema) => schema.required("Please select a member"),
    otherwise: (schema) => schema.notRequired()
  }),
  selectedGroupId: yup.string().when("postAs", {
    is: "Group",
    then: (schema) => schema.required("Please select a group"),
    otherwise: (schema) => schema.notRequired()
  }),
  selectedGroupName: yup.string().when("postAs", {
    is: "Group",
    then: (schema) => schema.required("Please select a group"),
    otherwise: (schema) => schema.notRequired()
  }),
  label: yup.string().required("Label is required"),
  selectedTowers: yup.array().notRequired(),
  selectedUnits: yup.array().notRequired(),
  attachments: yup.array()
});

/**
 * AddBulletin Component
 * Main component for creating bulletins with layout and state management
 */
const AddBulletin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { currentUser, manualRefresh } = useCurrentUser(); // Use custom hook for current user
  const [attachments, setAttachments] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [fileUploadError, setFileUploadError] = useState("");
  const [apiError, setApiError] = useState("");
  const [towerError, setTowerError] = useState("");
  const [unitError, setUnitError] = useState("");
  const [formError, setFormError] = useState("");
  const [titleError, setTitleError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");
  const [labelError, setLabelError] = useState("");
  const [creatorNameError, setCreatorNameError] = useState("");
  const [postAsError, setPostAsError] = useState("");
  const [titleWordLimitError, setTitleWordLimitError] = useState("");


  // Get the source tab from location state (passed from BulletinList)
  const sourceTab = location.state?.sourceTab || null;

  // Get saved postAs preference from localStorage
  const getSavedPostAsPreference = () => {
    try {
      return localStorage.getItem("bulletinPostAs") || "";
    } catch (error) {
      console.error("Error getting saved postAs preference:", error);
      return "";
    }
  };

  // Save postAs preference to localStorage
  const savePostAsPreference = (value) => {
    localStorage.setItem("bulletinPostAs", value);
  };

  // Form setup with validation
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isValid }
  } = useForm({
    resolver: yupResolver(bulletinSchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      description: "",
      postAs: getSavedPostAsPreference(),
      creatorName: "",
      selectedMemberId: "",
      selectedMemberName: "",
      selectedGroupId: "",
      selectedGroupName: "",
      label: "",
      selectedTowers: [],
      selectedUnits: [],
      attachments: []
    }
  });

  // Handle title input change to limit words
  const handleTitleChange = (value, onChange) => {
    // Always update the input value to allow normal typing
    onChange(value);

    if (!value || value.trim() === "") {
      setTitleWordLimitError("");
      return;
    }

    const words = value.trim().split(/\s+/);
    if (words.length <= 10) {
      setTitleWordLimitError("");
    } else {
      // Show error message when trying to exceed 10 words
      setTitleWordLimitError("Cannot write more than 10 words");
      // The validation will prevent form submission
    }
  };

  // Get current word count for title
  const getTitleWordCount = (value) => {
    if (!value || value.trim() === "") return 0;
    return value.trim().split(/\s+/).length;
  };

  // Check if all required fields are filled
  const isFormValid = () => {
    const values = getValues();
    return (
      values.title &&
      values.creatorName &&
      values.label &&
      (values.postAs === "Creator" ||
        (values.postAs === "Group" && values.selectedGroupId) ||
        (values.postAs === "Member" && values.selectedMemberId))
    );
  };

  // Watch all form values for real-time preview
  const watchedValues = watch();

  // Watch creator name for auto-sync
  const creatorName = watch("creatorName");

  // Watch selected towers for unit filtering
  const selectedTowers = watch("selectedTowers");

  // Clear tower/unit errors when selections change
  useEffect(() => {
    if (selectedTowers && selectedTowers.length > 0) {
      setTowerError("");
    }
  }, [selectedTowers]);

  const selectedUnits = watch("selectedUnits");
  useEffect(() => {
    if (selectedUnits && selectedUnits.length > 0) {
      setUnitError("");
    }
  }, [selectedUnits]);

  // Clear form errors when user starts typing
  const watchedFields = watch([
    "title",
    "description",
    "label",
    "creatorName",
    "postAs"
  ]);
  useEffect(() => {
    setFormError("");
  }, [watchedFields]);

  // Clear specific field errors when user starts typing in those fields
  const title = watch("title");
  useEffect(() => {
    if (title) {
      setTitleError("");
      // Clear word limit error when user starts typing again
      const wordCount = getTitleWordCount(title);
      if (wordCount <= 10) {
        setTitleWordLimitError("");
      }
    }
  }, [title]);

  const description = watch("description");
  useEffect(() => {
    if (description) setDescriptionError("");
  }, [description]);

  const label = watch("label");
  useEffect(() => {
    if (label) setLabelError("");
  }, [label]);

  useEffect(() => {
    if (creatorName) setCreatorNameError("");
  }, [creatorName]);

  const postAs = watch("postAs");
  useEffect(() => {
    if (postAs) setPostAsError("");
  }, [postAs]);

  // Handle member selection
  const handleMemberSelect = (memberData) => {
    if (memberData) {
      setValue("selectedMemberId", memberData.id);
      setValue("selectedMemberName", memberData.name);
      // Keep creator name as current user - don't change it to selected member
      // The creator should always be the logged-in user
    } else {
      setValue("selectedMemberId", "");
      setValue("selectedMemberName", "");
      // Creator name remains unchanged as current user
    }
  };

  // Handle group selection
  const handleGroupSelect = (groupData) => {
    if (groupData) {
      setValue("selectedGroupId", groupData.id);
      setValue("selectedGroupName", groupData.name);
      // Set creator name to current user when group is selected
      if (currentUser) {
        setValue(
          "creatorName",
          currentUser.full_name || currentUser.fullName || "Current User"
        );
      }
    } else {
      setValue("selectedGroupId", "");
      setValue("selectedGroupName", "");
    }
  };

  // Initialize form with saved preferences and current user data
  useEffect(() => {
    // Load saved post type preference
    const savedPostAs = localStorage.getItem("bulletinPostAs");
    if (savedPostAs) {
      setValue("postAs", savedPostAs);
      // Set creator name to current user for all modes (Creator, Group, Member)
      if (currentUser) {
        setValue(
          "creatorName",
          currentUser.full_name || currentUser.fullName || "Current User"
        );
      }
    } else {
      // Default to Creator mode and set creator name
      setValue("postAs", "Creator");
      if (currentUser) {
        setValue(
          "creatorName",
          currentUser.full_name || currentUser.fullName || "Current User"
        );
      }
    }
  }, [setValue, currentUser]);

  // Update creator name when current user changes (from custom hook)
  useEffect(() => {
    if (currentUser) {
      const currentPostAs = watch("postAs");
      if (currentPostAs === "Creator" || currentPostAs === "Group") {
        setValue(
          "creatorName",
          currentUser.full_name || currentUser.fullName || "Current User"
        );
      }
    }
  }, [currentUser, setValue, watch]);

  // Listen for window focus to refresh user data when returning to the page
  useEffect(() => {
    const handleWindowFocus = () => {
      console.log('Window focused, refreshing user data...');
      manualRefresh();
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [manualRefresh]);

  // Helper function to clear all error messages
  const clearAllErrors = () => {
    setApiError("");
    setFileUploadError("");
    setTowerError("");
    setUnitError("");
    setFormError("");
    setTitleError("");
    setDescriptionError("");
    setLabelError("");
    setCreatorNameError("");
    setPostAsError("");
    setTitleWordLimitError("");
  };

  // Handle form validation errors
  const onError = (errors) => {
    console.log("Form validation errors:", errors);

    // Clear all errors first
    clearAllErrors();

    // Set specific error messages for each field
    if (errors.creatorName) {
      setCreatorNameError("Creator name is required.");
    }

    if (errors.postAs) {
      setPostAsError("Please select how you want to post this bulletin.");
    }

    if (errors.title) {
      setTitleError(errors.title.message || "Title is required.");
    }

    if (errors.description) {
      setDescriptionError(errors.description.message || "Description is required.");
    }

    if (errors.label) {
      setLabelError("Label is required.");
    }

    // Set a general form error message
    const errorFields = Object.keys(errors);
    if (errorFields.length > 0) {
      setFormError(
        "Please fill in all required fields correctly before submitting."
      );
    }
  };

  // Handle back navigation
  const handleBack = () => {
    // Navigate back to the same tab the user came from
    const targetTab = sourceTab || 2; // Default to pending tab if no source tab
    navigate("/bulletins", {
      state: { activeTab: targetTab },
      replace: true
    });
  };





  // Utility function to convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);

    // Clear previous errors
    setFileUploadError("");

    // Check if adding these files would exceed the 5-file limit
    if (attachments.length + files.length > 5) {
      setFileUploadError(
        "Maximum 5 files allowed. Please remove some files and try again."
      );
      // Reset the file input
      event.target.value = "";
      return;
    }

    // Check file types and sizes
    const validFiles = [];
    const invalidFiles = [];

    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const isPDF = file.type === "application/pdf";
      const isDoc =
        file.type === "application/msword" ||
        file.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      if (!isImage && !isPDF && !isDoc) {
        invalidFiles.push(file.name);
        continue;
      }

      // Check file size: 5MB for all files
      if (file.size > 5 * 1024 * 1024) {
        setFileUploadError(
          `File "${file.name}" exceeds the 5MB size limit. Please choose a smaller file.`
        );
        // Reset the file input
        event.target.value = "";
        return;
      }

      validFiles.push(file);
    }

    if (invalidFiles.length > 0) {
      setFileUploadError(
        `Invalid file type(s): ${invalidFiles.join(
          ", "
        )}. Only images (JPG, PNG), PDF, and DOC files are allowed.`
      );
      // Reset the file input
      event.target.value = "";
      return;
    }

    // Clear any previous error
    setFileUploadError("");

    try {
      const newAttachments = await Promise.all(
        validFiles.map(async (file) => {
          const base64 = await fileToBase64(file);
          return {
            id: Date.now() + Math.random(),
            file,
            url: base64, // Use base64 instead of blob URL
            base64: base64, // Store base64 for saving
            name: file.name,
            type: file.type
          };
        })
      );

      setAttachments((prev) => [...prev, ...newAttachments]);
    } catch (error) {
      console.error("Error processing files:", error);
    }

    // Reset the file input to allow selecting the same file again
    event.target.value = "";
  };

  // Remove attachment
  const removeAttachment = (id) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id));
  };







  // Handle form submission
  const onSubmit = async (data) => {
    try {
      // Clear all previous errors
      clearAllErrors();
      setApiError("");
      setFormError("");

      // Validate form data
      let hasErrors = false;
      let errorMessages = [];

      if (!data.title) {
        errorMessages.push("Title is required.");
        hasErrors = true;
      }

      // Check title word limit
      if (data.title && getTitleWordCount(data.title) > 10) {
        errorMessages.push("Title cannot be more than 10 words.");
        hasErrors = true;
      }

      if (!data.creatorName) {
        errorMessages.push("Creator name is required.");
        hasErrors = true;
      }

      if (!data.label) {
        errorMessages.push("Label is required.");
        hasErrors = true;
      }

      // Check post as validation
      if (data.postAs === "Group" && !data.selectedGroupId) {
        errorMessages.push("Please select a group.");
        hasErrors = true;
      }

      if (data.postAs === "Member" && !data.selectedMemberId) {
        errorMessages.push("Please select a member.");
        hasErrors = true;
      }

      // Validate post_as specific fields
      if (data.postAs === "Group" && !data.selectedGroupId) {
        setPostAsError("Please select a group when posting as a group.");
        hasErrors = true;
      } else if (data.postAs === "Member" && !data.selectedMemberId) {
        setPostAsError("Please select a member when posting as a member.");
        hasErrors = true;
      }

      // If there are validation errors, stop submission
      if (hasErrors) {
        setFormError(
          `Please fix the following errors:\n• ${errorMessages.join("\n• ")}`
        );
        return;
      }

      // Import the utilities and Redux API
      const { formatBulletinForApi } = await import(
        "../utils/bulletinUtils"
      );
      const { createBulletin } = await import(
        "../../../../redux/slices/api/bulletinApi"
      );

      try {
        // Debug: Log the data being passed to formatBulletinForApi
        console.log('AddBulletin - Data passed to formatBulletinForApi:', data);
        console.log('AddBulletin - Attachments:', attachments);

        // Format data for API (this now handles selectedTowers and selectedUnits correctly)
        const apiData = formatBulletinForApi(data, attachments);

        // Create bulletin via Redux API
        const result = await dispatch(createBulletin(apiData));

        if (createBulletin.fulfilled.match(result)) {
          // Success case
          const createdBulletin = result.payload;

          // Clear all error states on success
          clearAllErrors();

          // Dispatch custom event to refresh notifications
          window.dispatchEvent(new Event('bulletinCreated'));

          // Show success message
          setSuccessMessage("Bulletin has been successfully created for review.");
        } else {
          // Handle Redux rejection
          const errorMessage = typeof result.payload === 'string'
            ? result.payload
            : result.payload?.message || JSON.stringify(result.payload) || "Failed to create bulletin";
          throw new Error(errorMessage);
        }
      } catch (error) {
        console.error("Error creating bulletin:", error);

        // Handle validation errors from formatBulletinForApi
        if (error.message && !error.response) {
          setApiError(error.message);
          return;
        }

        // Handle API errors
        if (error.response?.status === 400) {
          const errorDetails = error.response?.data?.details;
          if (errorDetails) {
            const fieldErrors = [];

            // Map backend field names to frontend field names
            const fieldMapping = {
              title: "title",
              description: "description",
              label: "label",
              post_as: "postAs",
              posted_group: "selectedGroupId",
              posted_member: "selectedMemberId",
              target_tower_ids: "selectedTowers",
              target_unit_ids: "selectedUnits"
            };

            // Process each error field
            Object.entries(errorDetails).forEach(([field, messages]) => {
              const frontendField = fieldMapping[field] || field;
              const errorMessage = Array.isArray(messages)
                ? messages.join(", ")
                : messages;

              fieldErrors.push(`${field}: ${errorMessage}`);
            });

            if (fieldErrors.length > 0) {
              setApiError(
                `Please fix the following errors:\n• ${fieldErrors.join(
                  "\n• "
                )}`
              );
            }
          } else {
            setApiError(
              "Invalid data. Please check your inputs and try again."
            );
          }
        } else if (error.response?.status === 401) {
          setApiError("You are not authorized. Please log in again.");
        } else if (error.response?.status === 500) {
          setApiError("Server error. Please try again later.");
        } else if (error.message?.includes("Network Error")) {
          setApiError(
            "Network error. Please check your connection and try again."
          );
        } else {
          setApiError("Failed to create bulletin. Please try again.");
        }
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      setApiError("An unexpected error occurred. Please try again.");
    }
  };

  // Clear success message
  const clearMessage = () => {
    setSuccessMessage("");
  };

  // Handle success message OK button
  const handleSuccessOk = () => {
    // Always navigate to Pending Bulletin tab (tab 2) after successful save
    navigate("/bulletins", {
      state: {
        activeTab: 2, // Always redirect to Pending Bulletin tab
        bulletinId: Date.now() // Trigger refresh by passing a timestamp
      },
      replace: true
    });
  };

  // Prepare data for preview component
  const previewData = {
    title: watchedValues.title,
    description: watchedValues.description,
    postAs: watchedValues.postAs,
    authorName: watchedValues.creatorName,
    selectedGroupName: watchedValues.selectedGroupName,
    selectedMemberName: watchedValues.selectedMemberName,
    label: watchedValues.label,
    selectedTowers: watchedValues.selectedTowers || [],
    selectedUnits: watchedValues.selectedUnits || [],
    attachments: attachments.map((att) => ({
      preview: att.base64 || att.url, // Use base64 for preview
      url: att.url || att.base64, // Fallback for modal
      base64: att.base64, // Include base64 for modal fallback
      name: att.name,
      type: att.type,
      id: att.id
    }))
  };

  return (
    <PageContainer className="min-h-screen bg-surfaceMuted px-4 sm:px-6 lg:px-[13px]">
      <div className="md:sticky md:top-0 z-20 mb-3 flex items-center justify-between gap-3 bg-surfaceMuted/95 py-4 backdrop-blur -mx-4 sm:-mx-6 lg:-mx-[13px] px-4 sm:px-6 lg:px-[13px]">
        <div
          onClick={handleBack}
          className="inline-flex cursor-pointer items-center gap-3 text-[#0F172A] transition-colors hover:text-primary"
        >
          <ArrowHeading title="Create Bulletin" size="2xl" color="text-black" />
        </div>
      </div>

      <div className="max-h-[calc(100vh-180px)] overflow-y-auto">
        <section className="mt-2 w-full max-w-[1400px] rounded-[24px] sm:rounded-[32px] border border-borderLight bg-white px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          {/* Main Content */}
          <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column - Preview */}
          <div className="order-2 lg:order-1 lg:w-full lg:col-span-4 hidden lg:block">
            <div className="bg-white p-6 lg:sticky lg:top-8 h-screen lg:h-[calc(100vh-6rem)] overflow-y-auto border-r-2 ">
              <BulletinPreview
                data={previewData}
                currentUser={currentUser}
              />
            </div>
          </div>

          {/* Right Column - Form (wider) */}
          <div className="order-1 lg:order-2 lg:col-span-8 bg-white rounded-lg shadow-sm">
            <AddBulletinForm
              // Form props
              control={control}
              handleSubmit={handleSubmit}
              watch={watch}
              setValue={setValue}
              errors={errors}
              isSubmitting={isSubmitting}
              onSubmit={onSubmit}
              onError={onError}
              // State props
              currentUser={currentUser}
              attachments={attachments}
              // Error states
              titleError={titleError}
              descriptionError={descriptionError}
              labelError={labelError}
              postAsError={postAsError}
              fileUploadError={fileUploadError}
              towerError={towerError}
              unitError={unitError}
              formError={formError}
              apiError={apiError}
              titleWordLimitError={titleWordLimitError}
              // Handlers
              handleTitleChange={handleTitleChange}
              getTitleWordCount={getTitleWordCount}
              handleFileUpload={handleFileUpload}
              removeAttachment={removeAttachment}
              handleMemberSelect={handleMemberSelect}
              handleGroupSelect={handleGroupSelect}
              savePostAsPreference={savePostAsPreference}
              isFormValid={isFormValid}
              // Watched values
              postAs={postAs}
              selectedTowers={selectedTowers}
            />
          </div>
        </div>
          </div>
        </section>
      </div>

      {/* Success Message Box */}
      <MessageBox
        message={successMessage}
        clearMessage={clearMessage}
        onOk={handleSuccessOk}
      />
    </PageContainer>
  );
};

export default AddBulletin;
