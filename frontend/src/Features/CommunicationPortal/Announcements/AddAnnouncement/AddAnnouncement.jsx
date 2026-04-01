import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useNavigate, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import ArrowHeading from "../../../../Components/HeadingComponent/ArrowHeading";
import PageContainer from "../../../../Components/Ui/PageContainer";
import AnnouncementPreview from "../components/AnnouncementPreview";
import AddAnnouncementForm from "./AddAnnouncementForm";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";
import useCurrentUser from "../hooks/useCurrentUser";
import { checkPermission } from "../../../../utils/permissionUtils";
import { PERMISSIONS } from "../../../../constants/permissions";

// Emoji validation function
const containsEmoji = (text) => {
  if (!text) return false;
  // Regex to detect emojis including various Unicode ranges
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]/u;
  return emojiRegex.test(text);
};

// Validation schema
const announcementSchema = yup.object().shape({
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
  priority: yup
    .string()
    .required("Priority is required")
    .oneOf(["low", "normal", "high", "urgent"], "Invalid priority value"),
  label: yup.string().required("Label is required"),
  startDate: yup.string().required("Start date is required"),
  startTime: yup.string().required("Start time is required"),
  endDate: yup.string().required("End date is required"),
  endTime: yup.string().required("End time is required"),
  selectedTowers: yup.array().notRequired(),
  selectedUnits: yup.array().notRequired(),
  attachments: yup.array()
});

/**
 * AddAnnouncement Component
 * Main component for creating announcements with layout and state management
 */
const AddAnnouncement = () => {
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
  const [priorityError, setPriorityError] = useState("");
  const [labelError, setLabelError] = useState("");
  const [startDateError, setStartDateError] = useState("");
  const [startTimeError, setStartTimeError] = useState("");
  const [endDateError, setEndDateError] = useState("");
  const [endTimeError, setEndTimeError] = useState("");
  const [creatorNameError, setCreatorNameError] = useState("");
  const [postAsError, setPostAsError] = useState("");
  const [titleWordLimitError, setTitleWordLimitError] = useState("");
  const [dateOrderError, setDateOrderError] = useState("");
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [createdAnnouncement, setCreatedAnnouncement] = useState(null); // Store created announcement info
  const [availableUnits, setAvailableUnits] = useState([]); // Units from UnitSelector for user count when "All" selected

  useEffect(() => {
    let isMounted = true;
    const verifyPermission = async () => {
      try {
        const allowed = await checkPermission(
          "org",
          PERMISSIONS.ADD_ANNOUNCEMENTS
        );
        if (!isMounted) return;
        setHasPermission(allowed);
        if (!allowed) {
          navigate("/not-authorized");
        }
      } catch (error) {
        console.error("Error checking add announcement permission:", error);
        if (isMounted) {
          setApiError("Unable to verify permissions for adding announcements.");
        }
      } finally {
        if (isMounted) {
          setPermissionLoading(false);
        }
      }
    };

    verifyPermission();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  // Get the source tab from location state (passed from AnnouncementList)
  const sourceTab = location.state?.sourceTab || null;

  // Get saved postAs preference from localStorage
  const getSavedPostAsPreference = () => {
    try {
      return localStorage.getItem("announcementPostAs") || "";
    } catch (error) {
      console.error("Error getting saved postAs preference:", error);
      return "";
    }
  };

  // Save postAs preference to localStorage
  const savePostAsPreference = (value) => {
    localStorage.setItem("announcementPostAs", value);
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
    resolver: yupResolver(announcementSchema),
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
        title: "",
        description: "",
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

  // Handle title input change to limit words
  const handleTitleChange = (value, onChange) => {
    if (!value || value.trim() === "") {
      onChange("");
      setTitleWordLimitError("");
      return;
    }

    const words = value.trim().split(/\s+/);
    if (words.length <= 10) {
      onChange(value);
      setTitleWordLimitError("");
    } else {
      // Show error message when trying to exceed 10 words
      setTitleWordLimitError("Cannot write more than 10 words");
      // Don't update the input value - let user see what they typed but show error
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
      values.priority &&
      values.label &&
      values.startDate &&
      values.startTime &&
      values.endDate &&
      values.endTime &&
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
    const savedPostAs = localStorage.getItem("announcementPostAs");
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
      console.log("Window focused, refreshing user data...");
      manualRefresh();
    };

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [manualRefresh]);

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
      // Create placeholder attachments immediately for instant UI feedback
      const placeholderAttachments = validFiles.map((file, index) => ({
        id: Date.now() + Math.random() + index,
        file,
        url: null, // Will be filled when base64 is ready
        base64: null,
        name: file.name,
        type: file.type,
        loading: true // Flag to show loading state
      }));

      // Add placeholders immediately
      setAttachments((prev) => [...prev, ...placeholderAttachments]);

      // Process files in background and update as they complete
      validFiles.forEach(async (file, index) => {
        try {
          const base64 = await fileToBase64(file);
          const attachmentId = placeholderAttachments[index].id;

          // Update the specific attachment with base64 data
          setAttachments((prev) =>
            prev.map(att =>
              att.id === attachmentId
                ? { ...att, url: base64, base64, loading: false }
                : att
            )
          );
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
          // Remove failed attachment
          const attachmentId = placeholderAttachments[index].id;
          setAttachments((prev) => prev.filter(att => att.id !== attachmentId));
        }
      });
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
    setTitleError("");
    setDescriptionError("");
    setPriorityError("");
    setLabelError("");
    setStartDateError("");
    setStartTimeError("");
    setEndDateError("");
    setEndTimeError("");
    setCreatorNameError("");
    setPostAsError("");
    setTitleWordLimitError("");
    setDateOrderError("");
  };

  // Handle form submission
  const onSubmit = async (data) => {
    if (!hasPermission) {
      setApiError("You are not authorized to create announcements.");
      return;
    }
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

      if (!data.startDate) {
        setStartDateError("Start date is required.");
        hasErrors = true;
      }

      if (!data.startTime) {
        setStartTimeError("Start time is required.");
        hasErrors = true;
      }

      if (!data.endDate) {
        setEndDateError("End date is required.");
        hasErrors = true;
      }

      if (!data.endTime) {
        setEndTimeError("End time is required.");
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
      const { formatAnnouncementForApi } = await import(
        "../utils/announcementUtils"
      );
      const { createAnnouncement } = await import(
        "../../../../redux/slices/api/announcementApi"
      );
      const { fetchUnreadCount, fetchNotifications } = await import(
        "../../../../redux/slices/api/notificationApi"
      );

      try {
        // Format data for API (this now handles selectedTowers and selectedUnits correctly)
        const apiData = await formatAnnouncementForApi(data, attachments);

        // Create announcement via Redux API
        const result = await dispatch(createAnnouncement(apiData));

        if (createAnnouncement.fulfilled.match(result)) {
          // Success case
          const createdAnnouncementData = result.payload;

          // Store created announcement info for navigation
          setCreatedAnnouncement({
            id: createdAnnouncementData.id,
            status: createdAnnouncementData.status
          });

          // Clear all error states on success
          clearAllErrors();

          // Show success message
          setSuccessMessage("Announcement has been successfully created.");

          // Dispatch custom event for immediate notification update
          window.dispatchEvent(new Event("announcementCreated"));

          // Immediately refresh notification count and list
          // This ensures the notification bell icon updates right away
          setTimeout(() => {
            dispatch(fetchUnreadCount());
            dispatch(fetchNotifications({ page_size: 100 }));
          }, 500); // Small delay to ensure backend notifications are created
        } else {
          // Handle Redux rejection
          throw new Error(result.payload || "Failed to create announcement");
        }
      } catch (error) {
        console.error("Error creating announcement:", error);

        // Handle validation errors from formatAnnouncementForApi
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
              priority: "priority",
              label: "label",
              start_date: "startDate",
              start_time: "startTime",
              end_date: "endDate",
              end_time: "endTime",
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

              // Set specific field error if it exists in our mapping
              if (frontendField in fieldMapping) {
                const setterName = `set${frontendField.charAt(0).toUpperCase() + frontendField.slice(1)
                  }Error`;
                if (typeof this[setterName] === "function") {
                  this[setterName](errorMessage);
                }
              }

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
          setApiError("Failed to create announcement. Please try again.");
        }
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      setApiError("An unexpected error occurred. Please try again.");
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
      setPostAsError("Please select how you want to post this announcement.");
    }

    if (errors.title) {
      setTitleError(errors.title.message || "Title is required.");
    }

    if (errors.description) {
      setDescriptionError(errors.description.message || "Description is required.");
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
    const targetTab = sourceTab || 1; // Default to ongoing tab if no source tab
    navigate("/announcements", {
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
    // Determine which tab to navigate to based on the created announcement's status
    let targetTab = 1; // Default to Ongoing tab

    if (createdAnnouncement) {
      // Navigate to the tab that matches the announcement's status
      if (createdAnnouncement.status === "upcoming") {
        targetTab = 2; // Upcoming tab
      } else if (createdAnnouncement.status === "ongoing") {
        targetTab = 1; // Ongoing tab
      } else if (createdAnnouncement.status === "expired") {
        targetTab = 3; // Expired tab
      }

      // Navigate back to announcements list with the correct tab and highlight the created announcement
      navigate("/announcements", {
        state: {
          activeTab: targetTab,
          announcementId: createdAnnouncement.id // Pass the announcement ID to highlight it
        },
        replace: true
      });
    } else {
      // Fallback: use sourceTab if createdAnnouncement is not available
      const fallbackTab = sourceTab || 1;
      navigate("/announcements", {
        state: {
          activeTab: fallbackTab,
          announcementId: Date.now() // Trigger refresh by passing a timestamp
        },
        replace: true
      });
    }
  };

  // Prepare data for preview component
  // When "All" units selected, pass expanded unit IDs for user count calculation
  const previewSelectedUnits = watchedValues.selectedUnits || [];
  const targetUnitIdsForPreview =
    previewSelectedUnits.includes("All") && availableUnits.length > 0
      ? availableUnits.map((u) => u.id)
      : previewSelectedUnits.filter((id) => id !== "All");

  const previewData = {
    title: watchedValues.title,
    description: watchedValues.description,
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
    selectedUnits: watchedValues.selectedUnits || [],
    targetUnitIds: targetUnitIdsForPreview,
    attachments: attachments.map((att) => ({
      preview: att.base64 || att.url, // Use base64 for preview
      url: att.url || att.base64, // Fallback for modal
      base64: att.base64, // Include base64 for modal fallback
      name: att.name,
      type: att.type
    }))
  };

  if (permissionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ModernLoadingAnimation />
      </div>
    );
  }

  if (!hasPermission) {
    return null;
  }

  return (
    <PageContainer className="min-h-screen bg-surfaceMuted px-4 sm:px-6 lg:px-[13px]">
      <div className="md:sticky md:top-0 z-20 mb-3 flex items-center justify-between gap-3 bg-surfaceMuted/95 py-3 sm:py-4 backdrop-blur">
        <div
          onClick={handleBack}
          className="inline-flex cursor-pointer items-center gap-3 text-[#0F172A] transition-colors hover:text-primary"
        >
          <ArrowHeading title="Create Announcement" size="2xl" color="text-black" />
        </div>
      </div>

      <div className="max-h-[calc(100vh-180px)] overflow-y-auto">
        <section className="mt-2 w-full max-w-[1400px] rounded-[24px] sm:rounded-[32px] border border-borderLight bg-white px-2 py-6 lg:px-8 lg:py-10">
          {/* Main Content */}
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column - Preview */}
              <div className="order-2 lg:order-1 lg:w-full lg:col-span-4 hidden lg:block">
                <div className="bg-white  p-6 lg:sticky lg:top-8 h-screen lg:h-[calc(100vh-6rem)] overflow-y-auto border-r-2">
                  <AnnouncementPreview
                    data={previewData}
                    currentUser={currentUser}
                  />
                </div>
              </div>

              {/* Right Column - Form (wider) */}
              <div className="order-1 lg:order-2 lg:col-span-8 bg-white rounded-lg shadow-sm">
                <AddAnnouncementForm
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
                  titleWordLimitError={titleWordLimitError}
                  dateOrderError={dateOrderError}
                  // Callbacks
                  onUnitsLoaded={setAvailableUnits}
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

export default AddAnnouncement;
