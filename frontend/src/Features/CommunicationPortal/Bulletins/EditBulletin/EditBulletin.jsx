import React, { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import ArrowHeading from "../../../../Components/HeadingComponent/ArrowHeading";
import PageContainer from "../../../../Components/Ui/PageContainer";
import BulletinPreview from "../components/BulletinPreview";
import EditBulletinForm from "./EditBulletinForm";
import MessageBox from "../../../../Components/MessageBox/MessageBox";
import ModernLoadingAnimation from "../../../../Components/Loaders/ModernLoadingAnimation";
import useCurrentUser from "../../Announcements/hooks/useCurrentUser";
import { useBulletinEdit } from "../../../../hooks/useBulletins";
import { formatBulletinForEdit } from "../utils/bulletinUtils";
import { updateBulletin } from "../../../../redux/slices/api/bulletinApi";
import { fetchTowers } from "../../../../redux/slices/api/announcementApi";
import { base64ToBlob } from "../../Announcements/utils/announcementUtils";

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
 * EditBulletin Component
 * Main component for editing bulletins with layout and state management
 */
const EditBulletin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { id } = useParams();
  const { currentUser, manualRefresh } = useCurrentUser();
  
  // Use bulletin edit hook
  const {
    bulletin,
    loading,
    updating,
    updateError,
    updateSuccess,
    updateBulletin: updateBulletinAction,
    resetUpdate
  } = useBulletinEdit(id);

  const [attachments, setAttachments] = useState([]);
  const [attachmentsToDelete, setAttachmentsToDelete] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [fileUploadError, setFileUploadError] = useState("");
  const [apiError, setApiError] = useState("");
  const [towerError, setTowerError] = useState("");
  const [unitError, setUnitError] = useState("");
  const [formError, setFormError] = useState("");

  const [titleWordLimitError, setTitleWordLimitError] = useState("");

  // State for tracking form changes
  const [originalFormData, setOriginalFormData] = useState(null);
  const [hasFormBeenModified, setHasFormBeenModified] = useState(false);
  const [bulletinLoaded, setBulletinLoaded] = useState(false);
  const [towers, setTowers] = useState([]);

  // Debug: Monitor attachments state changes
  useEffect(() => {
    console.log("=== BULLETIN ATTACHMENTS STATE CHANGED ===");
    console.log("Current attachments:", attachments);
    console.log("Attachments count:", attachments.length);
  }, [attachments]);

  // Load towers for normalization
  useEffect(() => {
    const loadTowers = async () => {
      try {
        const result = await dispatch(fetchTowers());
        if (fetchTowers.fulfilled.match(result)) {
          setTowers(result.payload);
        }
      } catch (error) {
        console.error('Error loading towers:', error);
      }
    };

    loadTowers();
  }, [dispatch]);

  // Prevent flickering by stabilizing attachment state
  const [isAttachmentUpdating, setIsAttachmentUpdating] = useState(false);

  // Get saved postAs preference from localStorage
  const getSavedPostAsPreference = () => {
    try {
      return localStorage.getItem("bulletinPostAs") || "";
    } catch (error) {
      console.error("Error getting saved postAs preference:", error);
      return "";
    }
  };

  // Save postAs preference to localStorage (for new bulletins only)
  const savePostAsPreference = (value) => {
    // In edit mode, postAs is locked and cannot be changed
    // This function is kept for compatibility but does nothing in edit mode
    localStorage.setItem("bulletinPostAs", value);
  };

  // Form setup with validation
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting, isValid }
  } = useForm({
    resolver: yupResolver(bulletinSchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      description: "",
      postAs: "Creator", // Use default instead of localStorage for edit mode
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
  const areFieldsValid = () => {
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

  // Check if form is valid for submission (fields valid AND form modified)
  const isFormValid = () => {
    return areFieldsValid() && hasFormBeenModified;
  };

  // Watch all form values for real-time preview
  const watchedValues = watch();

  // Watch creator name for auto-sync
  const creatorName = watch("creatorName");

  // Watch selected towers for unit filtering
  const selectedTowers = watch("selectedTowers");

  // Watch form values for preview and change detection
  const postAs = watch("postAs");

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

  // Handle tower changes - immediately clear units when towers are removed
  useEffect(() => {
    // Skip on initial load or if selectedTowers is undefined
    if (selectedTowers === undefined) return;

    const currentUnits = getValues("selectedUnits") || [];

    // If no towers are selected, immediately clear all units
    if (selectedTowers.length === 0) {
      if (currentUnits.length > 0) {
        setValue("selectedUnits", []);
      }
      return;
    }

    // The UnitSelector component will handle detailed filtering of units
    // based on available towers from the API response
  }, [selectedTowers, setValue, getValues]);

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

  // Clear title word limit error when user starts typing again
  const title = watch("title");
  useEffect(() => {
    if (title) {
      const wordCount = getTitleWordCount(title);
      if (wordCount <= 10) {
        setTitleWordLimitError("");
      }
    }
  }, [title]);

  // Initialize form with saved preferences and current user data (only for new bulletins)
  useEffect(() => {
    // Skip initialization if bulletin is already loaded to prevent overriding bulletin data
    if (bulletinLoaded || bulletin) {
      return;
    }

    // Load saved post type preference only for new bulletins
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
  }, [setValue, currentUser, bulletinLoaded, bulletin]);

  // Update creator name when current user changes (from custom hook) - only if bulletin not loaded yet
  useEffect(() => {
    if (currentUser && !bulletinLoaded) {
      const currentPostAs = watch("postAs");
      if (currentPostAs === "Creator" || currentPostAs === "Group") {
        setValue(
          "creatorName",
          currentUser.full_name || currentUser.fullName || "Current User"
        );
      }
    }
  }, [currentUser, setValue, watch, bulletinLoaded]);

  // Load bulletin data when component mounts or bulletin changes
  useEffect(() => {
    if (bulletin && !loading) {
      const formattedData = formatBulletinForEdit(bulletin);

      // Use reset to set all form values at once - more reliable than individual setValue calls
      reset(formattedData);

      // Store original form data for change detection
      setOriginalFormData({
        ...formattedData,
        attachments: bulletin.attachments || []
      });

      // Set attachments if they exist (matching EditAnnouncement pattern)
      if (bulletin.attachments) {
        console.log('=== SETTING ATTACHMENTS FROM BULLETIN ===');
        console.log('bulletin.attachments:', bulletin.attachments);
        const existingAttachments = bulletin.attachments.map((att, index) => ({
          id: att.id || index,
          url: att.file_url,
          name: att.file_name,
          type: att.file_type,
          isExisting: true // Mark as existing attachment
        }));
        console.log('existingAttachments:', existingAttachments);
        setAttachments(existingAttachments);
      } else {
        console.log('=== NO ATTACHMENTS IN BULLETIN ===');
        setAttachments([]);
      }

      setAttachmentsToDelete([]); // Clear deletion list

      // Reset form state
      clearAllErrors();
      setBulletinLoaded(true);
      setHasFormBeenModified(false);
    }
  }, [bulletin, loading, reset]);

  // Helper function to normalize tower arrays for comparison
  const normalizeTowerArray = (towerArray, allTowers) => {
    if (!towerArray || towerArray.length === 0) return [];

    // Get all available tower IDs (excluding 'All')
    const allTowerIds = allTowers.map(t => Number(t.id)).sort();

    // Convert array to numbers and filter out 'All'
    const numericTowers = towerArray
      .filter(t => t !== 'All')
      .map(t => Number(t))
      .sort();

    // If all towers are selected, normalize to just the tower IDs
    if (numericTowers.length === allTowerIds.length &&
        allTowerIds.every(id => numericTowers.includes(id))) {
      return allTowerIds;
    }

    return numericTowers;
  };

  // Watch for form changes to enable/disable Send button
  useEffect(() => {
    if (originalFormData && bulletinLoaded) {
      const currentValues = getValues();

      // Normalize tower arrays for proper comparison
      const currentTowersNormalized = normalizeTowerArray(currentValues.selectedTowers || [], towers);
      const originalTowersNormalized = normalizeTowerArray(originalFormData.selectedTowers || [], towers);

      // Compare tower arrays
      const towersChanged = JSON.stringify(currentTowersNormalized) !== JSON.stringify(originalTowersNormalized);

      // Compare form values with original data
      const hasChanged =
        currentValues.title !== originalFormData.title ||
        currentValues.description !== originalFormData.description ||
        currentValues.label !== originalFormData.label ||
        towersChanged ||
        JSON.stringify(currentValues.selectedUnits?.sort()) !== JSON.stringify(originalFormData.selectedUnits?.sort()) ||
        attachments.length !== originalFormData.attachments.length ||
        attachmentsToDelete.length > 0;

      setHasFormBeenModified(hasChanged);
    }
  }, [watchedValues, originalFormData, bulletinLoaded, attachments, attachmentsToDelete, towers]);



  // Handle update success
  useEffect(() => {
    if (updateSuccess) {
      setSuccessMessage("Bulletin updated successfully and is now under admin review!");
      // Don't auto-navigate, let user click OK button
    }
  }, [updateSuccess]);

  // Handle update error
  useEffect(() => {
    if (updateError) {
      setApiError(updateError.message || "Failed to update bulletin");
    }
  }, [updateError]);

  // Helper function to clear all error messages
  const clearAllErrors = () => {
    setApiError("");
    setFileUploadError("");
    setTowerError("");
    setUnitError("");
    setFormError("");
    setTitleWordLimitError("");
  };

  // Handle back navigation
  const handleBack = () => {
    const targetTab = location.state?.sourceTab || location.state?.activeTab || 1;
    navigate("/bulletins", { state: { activeTab: targetTab } });
  };



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
    console.log("=== EDIT BULLETIN FILE UPLOAD DEBUG ===");
    console.log("handleFileUpload function called!");
    console.log("Event:", event);
    console.log("Event target:", event.target);
    console.log("Files from event:", event.target.files);

    if (!event.target.files || event.target.files.length === 0) {
      console.log("No files selected");
      return;
    }

    const files = Array.from(event.target.files);
    console.log("Files array:", files);
    console.log("Number of files selected this time:", files.length);
    console.log("File names:", files.map(f => f.name));
    console.log("Current attachments length:", attachments.length);

    // Check if adding these files would exceed the 5-file limit
    if (attachments.length + files.length > 5) {
      console.log("File limit exceeded");
      setFileUploadError('Please upload maximum 5 files to proceed.');
      // Reset the file input
      event.target.value = '';
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

      console.log(`File ${file.name} accepted`);

      // Check file size: 5MB for all files
      if (file.size > 5 * 1024 * 1024) {
        console.log(`File ${file.name} rejected - size too large: ${file.size} bytes`);
        setFileUploadError(`File "${file.name}" exceeds 5MB limit.`);
        // Reset the file input
        event.target.value = '';
        return;
      }

      validFiles.push(file);
    }

    if (invalidFiles.length > 0) {
      setFileUploadError(`Invalid file types: ${invalidFiles.join(', ')}. Only images, PDF, and DOC files are allowed.`);
      // Reset the file input
      event.target.value = '';
      return;
    }

    // Clear any previous error
    setFileUploadError('');
    console.log("Valid files to process:", validFiles);

    try {
      setIsAttachmentUpdating(true);
      const newAttachments = await Promise.all(
        validFiles.map(async (file) => {
          console.log("Processing file:", file.name);
          const base64 = await fileToBase64(file);
          console.log("Base64 conversion successful for:", file.name);
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

      console.log("New attachments created:", newAttachments);
      setAttachments(prev => {
        const updated = [...prev, ...newAttachments];
        console.log("Updated attachments state:", updated);
        return updated;
      });
    } catch (error) {
      console.error('Error processing files:', error);
      setFileUploadError('Error processing files. Please try again.');
    } finally {
      setIsAttachmentUpdating(false);
    }

    // Reset the file input to allow selecting the same file again
    event.target.value = '';
  };

  // Remove attachment
  const removeAttachment = (id) => {
    console.log("=== REMOVING ATTACHMENT ===");
    console.log("Attachment ID to remove:", id);
    console.log("Current attachments before removal:", attachments);

    const attachmentToRemove = attachments.find(att => att.id === id);
    console.log("Attachment to remove:", attachmentToRemove);

    if (attachmentToRemove && attachmentToRemove.isExisting) {
      // If it's an existing attachment, add to deletion list
      console.log("Adding existing attachment to deletion list");
      setAttachmentsToDelete(prev => {
        const updated = [...prev, id];
        console.log("Updated deletion list:", updated);
        return updated;
      });
    }

    // Remove from current attachments list immediately for real-time UI update
    setAttachments(prev => {
      const filtered = prev.filter(att => att.id !== id);
      console.log("Attachments after removal:", filtered);
      return filtered;
    });

    // Clear any file upload errors
    setFileUploadError('');
  };



  // Handle form validation errors
  const onError = (errors) => {
    console.log("Form validation errors:", errors);

    // Set a general form error message
    const errorFields = Object.keys(errors);
    if (errorFields.length > 0) {
      setFormError(
        "Please fill in all required fields correctly before submitting."
      );
    }
  };

  // Handle form submission
  const onSubmit = async (data) => {
    try {
      // Clear all previous errors
      clearAllErrors();
      setApiError("");
      setFormError("");

      console.log("=== BULLETIN UPDATE SUBMIT ===");
      console.log("Current attachments:", attachments);
      console.log("Attachments to delete:", attachmentsToDelete);

      // Validate title word limit
      if (data.title && getTitleWordCount(data.title) > 10) {
        setTitleWordLimitError('Cannot write more than 10 words');
        setFormError('Please fix the title word limit before submitting.');
        return;
      }

      // Prepare form data for API
      const formData = new FormData();

      // Add source tab information to track where the edit came from
      const sourceTab = location.state?.sourceTab || location.state?.activeTab || 1;
      console.log(`[EditBulletin] Adding source_tab to form data: ${sourceTab} (from location.state:`, location.state, ')');
      formData.append('source_tab', sourceTab);

      // Map frontend field names to backend field names
      const fieldMapping = {
        'postAs': 'post_as',
        'selectedMemberId': 'posted_member',
        'selectedGroupId': 'posted_group'
      };

      // Append all simple fields with proper field name mapping
      Object.keys(data).forEach(key => {
        if (key !== 'attachments' && key !== 'selectedTowers' && key !== 'selectedUnits' &&
            key !== 'selectedMemberName' && key !== 'selectedGroupName' && key !== 'creatorName') {
          const backendKey = fieldMapping[key] || key;
          let value = data[key];

          // Convert postAs value to lowercase to match backend choices
          if (key === 'postAs') {
            value = value.toLowerCase();
          }

          formData.append(backendKey, value);
        }
      });

      // Utility to flatten and convert to integer
      function flattenAndConvert(arr) {
        return (arr || [])
          .flat(Infinity)  // Flatten any nested arrays
          .filter(id => id !== 'All' && id !== '' && !isNaN(id))
          .map(id => parseInt(id, 10));
      }

      // Append tower and unit IDs individually (not as comma-separated strings)
      const flatTowerIds = flattenAndConvert(data.selectedTowers);
      if (flatTowerIds.length > 0) {
        flatTowerIds.forEach(towerId => {
          formData.append('target_tower_ids', towerId.toString());
        });
      } else {
        // Send empty array indicator to clear tower selections
        formData.append('target_tower_ids', '');
      }

      const flatUnitIds = flattenAndConvert(data.selectedUnits);
      if (flatUnitIds.length > 0) {
        flatUnitIds.forEach(unitId => {
          formData.append('target_unit_ids', unitId.toString());
        });
      } else {
        // Send empty array indicator to clear unit selections
        formData.append('target_unit_ids', '');
      }

      // Debug log: show what unit IDs are being sent
      console.log('DEBUG: Sending unit IDs to backend (edit bulletin):', flatUnitIds);

      // Append attachments to delete
      attachmentsToDelete.forEach(id => formData.append('attachments_to_delete', id));

      // Append new attachments
      const newAttachments = attachments.filter(att => !att.isExisting);
      newAttachments.forEach((att) => {
        if (att.file) {
          formData.append('attachments', att.file);
        } else if (att.base64) {
          const blob = base64ToBlob(att.base64, att.type);
          formData.append('attachments', blob, att.name);
        }
      });

      // Make the API call
      console.log("DEBUG: Making API call to update bulletin with ID:", id);
      const result = await dispatch(updateBulletin({ id, data: formData }));
      console.log("DEBUG: API call result:", result);

      if (updateBulletin.fulfilled.match(result)) {
        console.log("DEBUG: Update successful, setting success message");
        setSuccessMessage('Bulletin updated successfully and is now under admin review');

        // Dispatch custom event to refresh notifications (for pending bulletin updates)
        window.dispatchEvent(new Event('bulletinCreated'));

        // Capture the deletion list before clearing it
        const deletedIds = [...attachmentsToDelete];

        // Clear the deletion list since deletions have been processed
        setAttachmentsToDelete([]);

        // Update attachments state: only keep attachments that weren't deleted and mark new ones as existing
        setAttachments(prev => {
          const remainingAttachments = prev.filter(att => !deletedIds.includes(att.id));
          return remainingAttachments.map(att => ({
            ...att,
            isExisting: true // Mark all remaining attachments as existing after successful save
          }));
        });
      } else {
        setApiError(result.payload?.error || 'Failed to update bulletin');
      }
    } catch (error) {
      console.error('Error updating bulletin:', error);
      setApiError('An unexpected error occurred. Please try again.');
    }
  };

  // Clear success message
  const clearMessage = () => {
    setSuccessMessage("");
  };

  // Handle success message OK button
  const handleSuccessOk = () => {
    // Always navigate to Pending Bulletin tab (tab 2) after successful save
    // Use a timestamp to ensure unique navigation state
    navigate("/bulletins", {
      state: {
        activeTab: 2, // Always redirect to Pending Bulletin tab
        bulletinId: id,
        timestamp: Date.now() // Add timestamp to make state unique
      },
      replace: true
    });
  };

  // Prepare data for preview component (memoized to prevent unnecessary re-renders)
  // This must be called before any conditional returns to follow Rules of Hooks
  const previewData = useMemo(() => {
    // Filter out attachments that are marked for deletion for real-time preview
    const activeAttachments = attachments.filter(att => !attachmentsToDelete.includes(att.id));

    return {
      title: watchedValues.title,
      description: watchedValues.description,
      postAs: watchedValues.postAs,
      authorName: watchedValues.creatorName,
      selectedGroupName: watchedValues.selectedGroupName,
      selectedMemberName: watchedValues.selectedMemberName,
      label: watchedValues.label,
      selectedTowers: watchedValues.selectedTowers || [],
      selectedUnits: watchedValues.selectedUnits || [],
      createdAt: bulletin?.created_at || bulletin?.createdAt, // Include original creation date for preview
      attachments: activeAttachments.map(att => ({
        preview: att.base64 || att.url, // Use base64 for preview
        url: att.url || att.base64, // Fallback for modal
        name: att.name,
        type: att.type,
        id: att.id
      }))
    };
  }, [watchedValues, attachments, attachmentsToDelete, bulletin]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ModernLoadingAnimation />
      </div>
    );
  }

  // Show error if bulletin not found
  if (!bulletin && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Bulletin Not Found</h2>
          <p className="text-gray-600 mb-4">The bulletin you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate("/bulletins")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Back to Bulletins
          </button>
        </div>
      </div>
    );
  }

  return (
    <PageContainer className="min-h-screen bg-surfaceMuted px-4 sm:px-6 lg:px-[13px]">
      <div
        className="md:sticky md:top-0 z-20 mb-3 flex items-center justify-between gap-3 bg-surfaceMuted/95 py-3 sm:py-4 backdrop-blur -mx-4 sm:-mx-6 px-4 sm:px-6"
        onClick={handleBack}
      >
        <div className="inline-flex cursor-pointer items-center gap-3 text-[#0F172A] transition-colors hover:text-primary">
          <ArrowHeading title="Edit Bulletin" size="2xl" color="text-black" />
        </div>
      </div>

      <div className="max-h-[calc(100vh-180px)] overflow-y-auto">
        <section className="mx-auto w-full max-w-[1400px] rounded-[24px] sm:rounded-[32px] border border-borderLight bg-white px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          {/* Main Content */}
          <div className="max-w-7xl mx-auto px-0 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column - Preview */}
          <div className="order-2 lg:order-1 lg:w-full lg:col-span-4 hidden lg:block">
            <div className="bg-white rounded-lg shadow-sm p-6 lg:sticky lg:top-8 h-screen lg:h-[calc(100vh-6rem)] overflow-y-auto border-2 ">
              <BulletinPreview
                data={previewData}
                currentUser={currentUser}
              />
            </div>
          </div>

          {/* Right Column - Form (wider) */}
          <div className="order-1 lg:order-2 lg:col-span-8 bg-white rounded-lg shadow-sm p-4 sm:p-6">
            <EditBulletinForm
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
              attachmentsToDelete={attachmentsToDelete}
              // Error states
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
              // Edit-specific props
              updating={updating}
              isAttachmentUpdating={isAttachmentUpdating}
              hasFormBeenModified={hasFormBeenModified}
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

export default EditBulletin;

