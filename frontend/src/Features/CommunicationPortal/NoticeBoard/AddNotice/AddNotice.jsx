import React, { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import ArrowHeading from "../../../../Components/HeadingComponent/ArrowHeading";
import PageContainer from "../../../../Components/Ui/PageContainer";
import { createNotice, fetchTowers } from "../../../../redux/slices/api/noticeApi";
import NoticePreview from "../components/NoticePreview";
import AddNoticeForm from "./AddNoticeForm";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";
import useCurrentUser from "../../Announcements/hooks/useCurrentUser";

// Emoji validation function
const containsEmoji = (text) => {
  if (!text) return false;
  // Regex to detect emojis including various Unicode ranges
  const emojiRegex =
    /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]/u;
  return emojiRegex.test(text);
};

// Validation schema
const noticeSchema = yup.object().shape({
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
  priority: yup
    .string()
    .required("Priority is required")
    .test(
      "not-empty",
      "Priority is required",
      (value) => value && value.trim() !== ""
    )
    .test("valid-priority", "Invalid priority value", (value) => {
      if (!value || value.trim() === "") return false;
      return ["urgent", "high", "normal", "low"].includes(value);
    }),
  label: yup.string().required("Label is required"),
  startDate: yup.string().required("Start date is required"),
  startTime: yup.string().required("Start time is required"),
  endDate: yup.string().required("End date is required"),
  endTime: yup.string().required("End time is required"),
  selectedTowers: yup.array().notRequired(),
  selectedUnits: yup.array().notRequired(),
  attachments: yup.array().min(1, "At least one attachment is required")
});

/**
 * AddNotice Component
 * Main component for creating notices with layout and state management
 */
const AddNotice = () => {
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
  
  // Track all available towers and units for "All" selection
  const [allTowers, setAllTowers] = useState([]);
  const [allUnits, setAllUnits] = useState([]);

  const [priorityError, setPriorityError] = useState("");
  const [labelError, setLabelError] = useState("");
  const [startDateError, setStartDateError] = useState("");
  const [startTimeError, setStartTimeError] = useState("");
  const [endDateError, setEndDateError] = useState("");
  const [endTimeError, setEndTimeError] = useState("");
  const [creatorNameError, setCreatorNameError] = useState("");
  const [postAsError, setPostAsError] = useState("");

  const [dateOrderError, setDateOrderError] = useState("");

  // Get the source tab from location state (passed from NoticeBoard)
  const sourceTab = location.state?.sourceTab || null;

  // Get saved postAs preference from localStorage
  const getSavedPostAsPreference = () => {
    try {
      return localStorage.getItem("noticePostAs") || "";
    } catch (error) {
      console.error("Error getting saved postAs preference:", error);
      return "";
    }
  };

  // Save postAs preference to localStorage
  const savePostAsPreference = (value) => {
    localStorage.setItem("noticePostAs", value);
  };

  // Form setup with validation
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    clearErrors,
    formState: { errors, isSubmitting, isValid }
  } = useForm({
    resolver: yupResolver(noticeSchema),
    mode: "onChange",
    defaultValues: (() => {
      // Get current date and time
      const now = new Date();
      // const currentDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
      // const currentTime = now.toTimeString().slice(0, 5); // HH:MM

      // // Calculate end date/time (48 hours from now)
      // const endDateTime = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      // const endDate = endDateTime.toISOString().split("T")[0]; // YYYY-MM-DD
      // const endTime = endDateTime.toTimeString().slice(0, 5); // HH:MM

      const formatDate = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      const formatTime = (date) =>
        `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

      const currentDate = formatDate(now);
      const currentTime = formatTime(now);

      const endDateTime = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const endDate = formatDate(endDateTime);
      const endTime = formatTime(endDateTime);

      return {
        postAs: getSavedPostAsPreference(),
        creatorName: "",
        selectedMemberId: "",
        selectedMemberName: "",
        selectedGroupId: "",
        selectedGroupName: "",
        priority: "normal",
        label: "",
        startDate: currentDate,
        startTime: currentTime,
        endDate: endDate,
        endTime: endTime,
        selectedTowers: [],
        selectedUnits: [],
        attachments: []
      };
    })()
  });

  // Check if all required fields are filled
  const isFormValid = () => {
    const values = getValues();
    return (
      values.creatorName &&
      values.priority &&
      values.label &&
      values.startDate &&
      values.startTime &&
      values.endDate &&
      values.endTime &&
      values.attachments &&
      values.attachments.length > 0 &&
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
    "priority",
    "label",
    "startDate",
    "startTime",
    "endDate",
    "endTime",
    "creatorName",
    "postAs"
  ]);
  useEffect(() => {
    setFormError("");
  }, [watchedFields]);

  const priority = watch("priority");
  useEffect(() => {
    if (priority) setPriorityError("");
  }, [priority]);

  const label = watch("label");
  useEffect(() => {
    if (label) setLabelError("");
  }, [label]);

  const startDate = watch("startDate");
  useEffect(() => {
    if (startDate) setStartDateError("");
  }, [startDate]);

  const startTime = watch("startTime");
  useEffect(() => {
    if (startTime) setStartTimeError("");
  }, [startTime]);

  const endDate = watch("endDate");
  useEffect(() => {
    if (endDate) setEndDateError("");
  }, [endDate]);

  const endTime = watch("endTime");
  useEffect(() => {
    if (endTime) setEndTimeError("");
  }, [endTime]);

  // Real-time date/time validation
  useEffect(() => {
    // Clear error first
    setDateOrderError("");

    // Only validate if all fields have values
    if (startDate && startTime && endDate && endTime) {
      const start = new Date(`${startDate}T${startTime}`);
      const end = new Date(`${endDate}T${endTime}`);

      if (start >= end) {
        setDateOrderError("End date/time must be after start date/time");
      }
    }
  }, [startDate, startTime, endDate, endTime]);

  useEffect(() => {
    if (creatorName) setCreatorNameError("");
  }, [creatorName]);

  const postAs = watch("postAs");
  useEffect(() => {
    if (postAs) setPostAsError("");
  }, [postAs]);

  // Clear attachment validation error when attachments are added
  useEffect(() => {
    // Update form field with current attachments
    setValue("attachments", attachments);

    if (attachments.length > 0) {
      setFileUploadError("");
      clearErrors("attachments");
    }
  }, [attachments, clearErrors, setValue]);

  // Fetch all towers on component mount
  useEffect(() => {
    const loadTowers = async () => {
      try {
        const result = await dispatch(fetchTowers());
        if (fetchTowers.fulfilled.match(result)) {
          setAllTowers(result.payload || []);
        }
      } catch (error) {
        console.error("Error fetching towers:", error);
      }
    };
    loadTowers();
  }, [dispatch]);

  // Listen for window focus to refresh user data when returning to the page
  useEffect(() => {
    const handleWindowFocus = () => {
      console.log("Window focused, refreshing user data...");
      manualRefresh();
    };

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [manualRefresh]);

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
    const savedPostAs = localStorage.getItem("noticePostAs");
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

  // Update creator name when current user changes
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
      setFileUploadError("Please upload maximum 5 files to proceed.");
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

      if (!isImage && !isPDF) {
        invalidFiles.push(file.name);
        continue;
      }

      // Check file size: 10MB for all files
      if (file.size > 10 * 1024 * 1024) {
        setFileUploadError(
          `File "${file.name}" exceeds the 10MB size limit. Please choose a smaller file.`
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
        )}. Only images and PDFs are allowed for notices.`
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

  // Helper function to clear all error messages
  const clearAllErrors = () => {
    setApiError("");
    setFileUploadError("");
    setTowerError("");
    setUnitError("");
    setFormError("");

    setPriorityError("");
    setLabelError("");
    setStartDateError("");
    setStartTimeError("");
    setEndDateError("");
    setEndTimeError("");
    setCreatorNameError("");
    setPostAsError("");

    setDateOrderError("");
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

      if (!data.creatorName) {
        errorMessages.push("Creator name is required.");
        hasErrors = true;
      }

      if (!data.priority) {
        errorMessages.push("Priority is required.");
        hasErrors = true;
      }

      if (!data.label) {
        errorMessages.push("Label is required.");
        hasErrors = true;
      }

      if (!data.startDate) {
        errorMessages.push("Start date is required.");
        hasErrors = true;
      }

      if (!data.startTime) {
        errorMessages.push("Start time is required.");
        hasErrors = true;
      }

      if (!data.endDate) {
        errorMessages.push("End date is required.");
        hasErrors = true;
      }

      if (!data.endTime) {
        errorMessages.push("End time is required.");
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

      // Validate date/time order
      if (data.startDate && data.startTime && data.endDate && data.endTime) {
        const start = new Date(`${data.startDate}T${data.startTime}`);
        const end = new Date(`${data.endDate}T${data.endTime}`);
        if (start >= end) {
          setDateOrderError("End date/time must be after start date/time");
          hasErrors = true;
        }
      }

      // If there are validation errors, stop submission
      if (hasErrors) {
        setFormError(
          `Please fix the following errors:\n• ${errorMessages.join("\n• ")}`
        );
        return;
      }

      // Prepare form data for API submission
      const formData = new FormData();

      // Add basic fields
      formData.append("priority", data.priority);
      formData.append("label", data.label);
      formData.append("start_date", data.startDate);
      formData.append("start_time", data.startTime);
      formData.append("end_date", data.endDate);
      formData.append("end_time", data.endTime);
      formData.append("post_as", data.postAs.toLowerCase());

      // Add post as specific fields
      if (data.postAs === "Group" && data.selectedGroupId) {
        formData.append("posted_group", data.selectedGroupId);
        formData.append("group_name", data.selectedGroupName);
      }
      if (data.postAs === "Member" && data.selectedMemberId) {
        formData.append("posted_member", data.selectedMemberId);
        formData.append("member_name", data.selectedMemberName);
      }

      // Add target towers and units as JSON arrays to avoid exceeding field limit
      // Handle "All" selection by using all available IDs
      let towerIds = [];
      if (data.selectedTowers && data.selectedTowers.includes("All")) {
        // If "All" is selected, use all available tower IDs
        towerIds = allTowers.map((tower) => tower.id);
      } else {
        // Otherwise, filter out invalid values and convert to integers
        towerIds = (data.selectedTowers || [])
          .filter((id) => id && id !== "All" && !isNaN(id))
          .map((id) => parseInt(id, 10));
      }

      let unitIds = [];
      if (data.selectedUnits && data.selectedUnits.includes("All")) {
        // If "All" is selected, use all available unit IDs
        unitIds = allUnits.map((unit) => unit.id);
      } else {
        // Otherwise, filter out invalid values and convert to integers
        unitIds = (data.selectedUnits || [])
          .filter((id) => id && id !== "All" && !isNaN(id))
          .map((id) => parseInt(id, 10));
      }

      // Send as JSON arrays instead of individual fields
      if (towerIds.length > 0) {
        formData.append("target_tower_ids", JSON.stringify(towerIds));
      }
      if (unitIds.length > 0) {
        formData.append("target_unit_ids", JSON.stringify(unitIds));
      }

      // Add attachments
      const base64Attachments = [];
      attachments.forEach((attachment) => {
        if (attachment.file) {
          // Regular file upload
          formData.append("attachments", attachment.file);
        } else if (attachment.base64) {
          // Base64 attachment - collect for JSON submission
          base64Attachments.push({
            base64: attachment.base64,
            name: attachment.name,
            type: attachment.type
          });
        }
      });

      // Add base64 attachments as JSON
      if (base64Attachments.length > 0) {
        formData.append(
          "base64_attachments",
          JSON.stringify(base64Attachments)
        );
      }

      // Submit to API
      const result = await dispatch(createNotice(formData));

      if (createNotice.fulfilled.match(result)) {
        // Dispatch custom event to refresh notifications
        window.dispatchEvent(new Event("noticeCreated"));

        setSuccessMessage("Notice created successfully!");
      } else {
        throw new Error(result.payload || "Failed to create notice");
      }
    } catch (error) {
      setApiError("Failed to create notice. Please try again.");
    }
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
      setPostAsError("Please select how you want to post this notice.");
    }

    if (errors.priority) {
      setPriorityError("Please select a priority level.");
    }

    if (errors.label) {
      setLabelError("Label is required.");
    }

    if (errors.startDate) {
      setStartDateError("Start date is required.");
    }

    if (errors.startTime) {
      setStartTimeError("Start time is required.");
    }

    if (errors.endDate) {
      setEndDateError("End date is required.");
    }

    if (errors.endTime) {
      setEndTimeError("End time is required.");
    }

    if (errors.attachments) {
      setFileUploadError(
        errors.attachments.message || "At least one attachment is required."
      );
    }

    // Set a general form error message
    const errorFields = Object.keys(errors);
    if (errorFields.length > 0) {
      setFormError(
        "Please fill in all required fields correctly before submitting."
      );
    }
  };

  const handleBack = () => {
    const targetTab = sourceTab || 1;
    navigate("/notice-board", {
      state: { activeTab: targetTab },
      replace: true
    });
  };

  // Clear success message
  const clearMessage = () => {
    setSuccessMessage("");
  };

  // Handle success message OK button
  const handleSuccessOk = () => {
    const targetTab = sourceTab || 1;
    navigate("/notice-board", {
      state: {
        activeTab: targetTab,
        noticeId: Date.now()
      },
      replace: true
    });
  };

  // Clear error message
  const clearErrorMessage = () => {
    setApiError("");
  };

  // Handle units loaded callback from UnitSelector
  // Use useCallback to prevent infinite re-renders
  const handleUnitsLoaded = useCallback((units) => {
    setAllUnits(units || []);
  }, []);

  return (
    <PageContainer className="min-h-screen bg-surfaceMuted px-4 sm:px-6 lg:px-[13px]">
      <div className="md:sticky md:top-0 z-20 mb-3 flex items-center justify-between gap-3 bg-surfaceMuted/95 py-4 backdrop-blur -mx-4 sm:-mx-6 lg:-mx-[13px] px-4 sm:px-6 lg:px-[13px]">
        <div
          onClick={handleBack}
          className="inline-flex cursor-pointer items-center gap-3 text-[#0F172A] transition-colors hover:text-primary"
        >
          <ArrowHeading title="Create Notice" size="2xl" color="text-black" />
        </div>
      </div>

      <div className="max-h-[calc(100vh-180px)] overflow-y-auto">
        <section className="mt-2 w-full max-w-[1400px] rounded-[24px] sm:rounded-[32px] border border-borderLight bg-white py-6 sm:py-8 lg:px-8 lg:py-10">
          {/* Main Content */}
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column - Preview */}
              <div className="order-2 lg:order-1 lg:w-full lg:col-span-4 hidden lg:block">
                <div className="bg-white p-6 lg:sticky lg:top-8 h-screen lg:h-[calc(100vh-6rem)] overflow-y-auto border-r-2">
                  <NoticePreview
                    data={{
                      postAs: watchedValues.postAs,
                      authorName: watchedValues.creatorName,
                      selectedGroupName: watchedValues.selectedGroupName,
                      selectedMemberName: watchedValues.selectedMemberName,
                      priority: watchedValues.priority,
                      label: watchedValues.label,
                      startDate: watchedValues.startDate,
                      startTime: watchedValues.startTime,
                      endDate: watchedValues.endDate,
                      endTime: watchedValues.endTime,
                      selectedTowers: watchedValues.selectedTowers || [],
                      // Pass actual unit IDs for correct user count calculation
                      selectedUnits: 
                        watchedValues.selectedUnits && watchedValues.selectedUnits.includes("All") && allUnits.length > 0
                          ? allUnits.map(unit => unit.id)
                          : (watchedValues.selectedUnits || []),
                      attachments: attachments.map((att) => ({
                        preview: att.base64 || att.url,
                        url: att.url || att.base64,
                        base64: att.base64,
                        name: att.name,
                        type: att.type
                      }))
                    }}
                    currentUser={currentUser}
                  />
                </div>
              </div>

              {/* Right Column - Form (wider) */}
              <div className="order-1 lg:order-2 lg:col-span-8 bg-white rounded-lg shadow-sm">
                <AddNoticeForm
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
                  priorityError={priorityError}
                  labelError={labelError}
                  startDateError={startDateError}
                  startTimeError={startTimeError}
                  endDateError={endDateError}
                  endTimeError={endTimeError}
                  postAsError={postAsError}
                  fileUploadError={fileUploadError}
                  towerError={towerError}
                  unitError={unitError}
                  formError={formError}
                  apiError={apiError}
                  dateOrderError={dateOrderError}
                  // Handlers
                  handleFileUpload={handleFileUpload}
                  removeAttachment={removeAttachment}
                  handleMemberSelect={handleMemberSelect}
                  handleGroupSelect={handleGroupSelect}
                  savePostAsPreference={savePostAsPreference}
                  isFormValid={isFormValid}
                  onUnitsLoaded={handleUnitsLoaded}
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

      {/* Error Message */}
      {apiError && (
        <MessageBox error={apiError} clearMessage={clearErrorMessage} />
      )}
    </PageContainer>
  );
};

export default AddNotice;
