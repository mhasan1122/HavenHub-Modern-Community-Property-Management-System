import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import ArrowHeading from '../../../../Components/HeadingComponent/ArrowHeading';
import PageContainer from '../../../../Components/Ui/PageContainer';
import AnnouncementPreview from '../components/AnnouncementPreview';
import EditAnnouncementForm from './EditAnnouncementForm';
import MessageBox from '../../../../Components/MessageBox/MessageBox';
import ModernLoadingAnimation from '../../../../Components/Loaders/ModernLoadingAnimation';
import useCurrentUser from '../hooks/useCurrentUser';
import { useAnnouncementEdit } from "../../../../hooks/useAnnouncements";
import { updateAnnouncement, fetchTowers } from "../../../../redux/slices/api/announcementApi";
import { fetchUnreadCount, fetchNotifications } from "../../../../redux/slices/api/notificationApi";
import { formatAnnouncementForEdit } from "../utils/announcementUtils";
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
    .required('Title is required')
    .test('no-emoji', 'Emojis are not allowed in title', (value) => {
      if (!value) return true;
      return !containsEmoji(value);
    })
    .test('word-count', 'Title must be 10 words or less', (value) => {
      if (!value) return true;
      return value.trim().split(/\s+/).length <= 10;
    }),
  description: yup
    .string()
    .test('no-emoji', 'Emojis are not allowed in description', (value) => {
      if (!value) return true;
      return !containsEmoji(value);
    })
    .test('word-count', 'Description must be 100 words or less', (value) => {
      if (!value) return true;
      return value.trim().split(/\s+/).length <= 100;
    }),
  postAs: yup.string().required('Post as selection is required'),
  creatorName: yup.string().required('Creator name is required'),
  selectedMemberId: yup.string().when('postAs', {
    is: 'Member',
    then: (schema) => schema.required('Please select a member'),
    otherwise: (schema) => schema.notRequired()
  }),
  selectedMemberName: yup.string().when('postAs', {
    is: 'Member',
    then: (schema) => schema.required('Please select a member'),
    otherwise: (schema) => schema.notRequired()
  }),
  selectedGroupId: yup.string().when('postAs', {
    is: 'Group',
    then: (schema) => schema.required('Please select a group'),
    otherwise: (schema) => schema.notRequired()
  }),
  selectedGroupName: yup.string().when('postAs', {
    is: 'Group',
    then: (schema) => schema.required('Please select a group'),
    otherwise: (schema) => schema.notRequired()
  }),
  priority: yup
    .string()
    .required('Priority is required')
    .oneOf(['urgent', 'high', 'normal', 'low'], 'Invalid priority value'),
  label: yup.string().required('Label is required'),
  startDate: yup.string().required('Start date is required'),
  startTime: yup.string().required('Start time is required'),
  endDate: yup.string().required('End date is required'),
  endTime: yup.string().required('End time is required'),
  selectedTowers: yup.array(), // Made optional to match backend
  selectedUnits: yup.array(), // Made optional to match backend
  attachments: yup.array()
});

/**
 * EditAnnouncement Component
 * Main component for editing existing announcements with real-time preview
 */
const EditAnnouncement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const dispatch = useDispatch();
  const { currentUser, manualRefresh } = useCurrentUser(); // Use custom hook for current user
  const [attachments, setAttachments] = useState([]);
  const [attachmentsToDelete, setAttachmentsToDelete] = useState([]);
  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [fileUploadError, setFileUploadError] = useState('');
  const [error, setError] = useState(null);
  const [titleWordLimitError, setTitleWordLimitError] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [dateOrderError, setDateOrderError] = useState("");
  const [hasFormBeenModified, setHasFormBeenModified] = useState(false);
  const [originalFormData, setOriginalFormData] = useState(null);
  const [towers, setTowers] = useState([]);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [availableUnits, setAvailableUnits] = useState([]); // Units from UnitSelector for user count when "All" selected
  const [initialUnitsCheckDone, setInitialUnitsCheckDone] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const verifyPermission = async () => {
      try {
        const allowed = await checkPermission(
          "org",
          PERMISSIONS.EDIT_ANNOUNCEMENTS
        );
        if (!isMounted) return;
        setHasPermission(allowed);
        if (!allowed) {
          setError("You are not authorized to edit announcements.");
          navigate("/not-authorized");
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Error checking announcement edit permission:", err);
        setError("Unable to verify permissions for editing announcements.");
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

  // Redux hooks for announcement editing
  const {
    selectedAnnouncement,
    loading: announcementLoading,
    updating,
    updateError,
    updateSuccess,
    message,
    error: loadError,
    loadAnnouncement,
    clearAllState
  } = useAnnouncementEdit();

  // Reset Redux state when component mounts to clear any previous state
  useEffect(() => {
    clearAllState();
    setSuccessMessage('');
    setError(null);
    setHasSubmitted(false);
    setJustUpdated(false);
  }, [clearAllState]);

  // Debug: Monitor attachments state changes
  useEffect(() => {
    console.log("=== ATTACHMENTS STATE CHANGED ===");
    console.log("Current attachments:", attachments);
    console.log("Attachments count:", attachments.length);
  }, [attachments]);

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      clearAllState();
      setSuccessMessage('');
      setError(null);
      setHasSubmitted(false);
      setAttachments([]);
      setAttachmentsToDelete([]);
      setAnnouncementLoaded(false);
      setJustUpdated(false);
    };
  }, [clearAllState]);

  // Load towers for normalization
  useEffect(() => {
    if (!hasPermission) {
      return;
    }
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
  }, [dispatch, hasPermission]);

  // Form setup with validation
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: yupResolver(announcementSchema),
    mode: 'onChange',
    defaultValues: {
      title: '',
      description: '',
      postAs: 'Creator',
      creatorName: '',
      autoName: '',
      selectedMemberId: '',
      selectedMemberName: '',
      selectedGroupId: '',
      selectedGroupName: '',
      priority: 'normal',
      label: '',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      selectedTowers: [],
      selectedUnits: [],
      attachments: []
    }
  });

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
      (values.postAs === 'Creator' ||
        (values.postAs === 'Group' && values.selectedGroupId) ||
        (values.postAs === 'Member' && values.selectedMemberId))
    );
  };

  // Watch all form values for real-time preview
  const watchedValues = watch();

  // Watch creator name for auto-sync
  const creatorName = watch('creatorName');

  // Watch selected towers for unit filtering
  const selectedTowers = watch('selectedTowers');

  // Watch selected units for user count calculation
  const selectedUnits = watch('selectedUnits');

  // Clear title word limit error when user starts typing again
  const title = watch('title');
  useEffect(() => {
    if (title && getTitleWordCount(title) <= 10) {
      setTitleWordLimitError('');
    }
  }, [title]);

  // Watch date/time fields for real-time validation
  const startDate = watch('startDate');
  const startTime = watch('startTime');
  const endDate = watch('endDate');
  const endTime = watch('endTime');

  useEffect(() => {
    // Clear error first
    setDateOrderError('');

    // Only validate if all fields have values
    if (startDate && startTime && endDate && endTime) {
      const start = new Date(`${startDate}T${startTime}`);
      const end = new Date(`${endDate}T${endTime}`);

      if (start >= end) {
        setDateOrderError('End date/time must be after start date/time');
      }
    }
  }, [startDate, startTime, endDate, endTime]);

  // State to track if announcement data has been loaded
  const [announcementLoaded, setAnnouncementLoaded] = useState(false);

  // State to track if units have been initially restored
  const [unitsInitiallyRestored, setUnitsInitiallyRestored] = useState(false);

  // State to track if we just completed an update (to prevent form reset)
  const [justUpdated, setJustUpdated] = useState(false);

  // Restore original units only once when announcement data is loaded
  useEffect(() => {
    if (announcementLoaded && announcement && !unitsInitiallyRestored) {
      const originalUnits = announcement.target_units_data?.map(unit => Number(unit.id)) || [];

      // Only restore original units once on initial load
      if (originalUnits.length > 0) {
        console.log('Initial restore of original units:', originalUnits);

        // Set units immediately with proper data types
        setValue('selectedUnits', originalUnits);
        setUnitsInitiallyRestored(true);

        // Single verification attempt after a short delay to ensure units are set
        const timer = setTimeout(() => {
          const verifyUnits = (getValues('selectedUnits') || []).map(u => Number(u));
          if (verifyUnits.length === 0 && originalUnits.length > 0) {
            console.log('Units verification: restoring units again', originalUnits);
            setValue('selectedUnits', originalUnits);
          } else {
            console.log('Units verification: units are present', verifyUnits);
          }
        }, 200);

        return () => clearTimeout(timer);
      } else {
        // If no original units, mark as restored to prevent future auto-fills
        setUnitsInitiallyRestored(true);
      }
    }
  }, [announcementLoaded, announcement, unitsInitiallyRestored, setValue, getValues]);

  // Update autoName when creatorName changes
  useEffect(() => {
    setValue('autoName', creatorName);
  }, [creatorName, setValue]);

  // Helper function to normalize tower arrays for comparison
  // Helper function to normalize tower arrays for comparison
  const normalizeTowerArray = (towerArray, allTowers) => {
    if (!towerArray || towerArray.length === 0) return [];

    // Get all available tower IDs (excluding 'All')
    const allTowerIds = allTowers.map(t => Number(t.id)).sort();

    // FIXED: Handle "All" selection BEFORE filtering
    // If array contains "All", treat it as all towers selected
    if (towerArray.includes('All')) {
      return allTowerIds;
    }

    // Convert array to numbers and filter out 'All' (safety check)
    const numericTowers = towerArray
      .filter(t => t !== 'All')
      .map(t => Number(t))
      .sort();

    // If all towers are selected individually, normalize to the same format
    if (numericTowers.length === allTowerIds.length &&
      allTowerIds.every(id => numericTowers.includes(id))) {
      return allTowerIds;
    }

    return numericTowers;
  };

  // Watch for form changes to determine if form has been modified
  useEffect(() => {
    if (originalFormData && announcementLoaded) {
      const currentValues = getValues();

      // For tower comparison, use direct comparison first, then normalize if towers are loaded
      let towersChanged = false;

      if (towers.length > 0) {
        // Towers are loaded - use normalized comparison
        const currentTowersNormalized = normalizeTowerArray(currentValues.selectedTowers || [], towers);
        const originalTowersNormalized = normalizeTowerArray(originalFormData.selectedTowers || [], towers);
        towersChanged = JSON.stringify(currentTowersNormalized) !== JSON.stringify(originalTowersNormalized);

        // Debug logging
        console.log('[Form Change Detection - Normalized]');
        console.log('  Current towers:', currentValues.selectedTowers);
        console.log('  Current normalized:', currentTowersNormalized);
        console.log('  Original towers:', originalFormData.selectedTowers);
        console.log('  Original normalized:', originalTowersNormalized);
        console.log('  Towers changed:', towersChanged);
      } else {
        // Towers not loaded yet - use direct comparison
        const currentTowersStr = JSON.stringify((currentValues.selectedTowers || []).sort());
        const originalTowersStr = JSON.stringify((originalFormData.selectedTowers || []).sort());
        towersChanged = currentTowersStr !== originalTowersStr;

        console.log('[Form Change Detection - Direct]');
        console.log('  Current towers:', currentValues.selectedTowers);
        console.log('  Original towers:', originalFormData.selectedTowers);
        console.log('  Towers changed:', towersChanged);
      }

      // Compare units
      const currentUnitsStr = JSON.stringify((currentValues.selectedUnits || []).map(u => String(u)).sort());
      const originalUnitsStr = JSON.stringify((originalFormData.selectedUnits || []).map(u => String(u)).sort());
      const unitsChanged = currentUnitsStr !== originalUnitsStr;
      console.log('  Units changed:', unitsChanged);

      // Compare current form values with original data
      const hasChanged =
        currentValues.title !== originalFormData.title ||
        currentValues.description !== originalFormData.description ||
        currentValues.postAs !== originalFormData.postAs ||
        currentValues.creatorName !== originalFormData.creatorName ||
        currentValues.selectedMemberId !== originalFormData.selectedMemberId ||
        currentValues.selectedGroupId !== originalFormData.selectedGroupId ||
        currentValues.priority !== originalFormData.priority ||
        currentValues.label !== originalFormData.label ||
        currentValues.startDate !== originalFormData.startDate ||
        currentValues.startTime !== originalFormData.startTime ||
        currentValues.endDate !== originalFormData.endDate ||
        currentValues.endTime !== originalFormData.endTime ||
        towersChanged ||
        unitsChanged ||
        attachments.length !== originalFormData.attachments.length ||
        attachmentsToDelete.length > 0;

      console.log('  Has form been modified:', hasChanged);
      setHasFormBeenModified(hasChanged);
    }
  }, [watchedValues, originalFormData, announcementLoaded, attachments, attachmentsToDelete, getValues, setHasFormBeenModified, towers]);



  // Initialize form with saved preferences and current user data
  useEffect(() => {
    // Load saved post type preference
    const savedPostAs = localStorage.getItem('announcementPostAs');
    if (savedPostAs) {
      setValue('postAs', savedPostAs);
    }

    // Set default creator name if current user is available
    if (currentUser) {
      setValue('creatorName', currentUser.full_name || currentUser.fullName || 'Current User');
    }
  }, [setValue, currentUser]);

  // Update creator name when current user changes (from custom hook)
  useEffect(() => {
    if (currentUser) {
      const currentPostAs = watch('postAs');
      if (currentPostAs === 'Creator' || currentPostAs === 'Group') {
        setValue('creatorName', currentUser.full_name || currentUser.fullName || 'Current User');
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

  // Handle member selection
  const handleMemberSelect = (memberData) => {
    if (memberData) {
      setValue('selectedMemberId', memberData.id);
      setValue('selectedMemberName', memberData.name);
      // Keep creator name as current user - don't change it to selected member
      // The creator should always be the logged-in user
    } else {
      setValue('selectedMemberId', '');
      setValue('selectedMemberName', '');
      // Creator name remains unchanged as current user
    }
  };

  // Handle group selection
  const handleGroupSelect = (groupData) => {
    if (groupData) {
      setValue('selectedGroupId', groupData.id);
      setValue('selectedGroupName', groupData.name);
      // Set creator name to current user when group is selected
      if (currentUser) {
        setValue('creatorName', currentUser.full_name || currentUser.fullName || 'Current User');
      }
    } else {
      setValue('selectedGroupId', '');
      setValue('selectedGroupName', '');
    }
  };

  // Load announcement data using Redux
  useEffect(() => {
    if (!hasPermission) {
      return;
    }
    if (id) {
      // Reset state when loading a new announcement
      clearAllState();
      setSuccessMessage('');
      setError(null);
      setHasSubmitted(false);
      setAttachments([]);
      setAttachmentsToDelete([]);
      setAnnouncementLoaded(false);
      setJustUpdated(false);

      console.log('Loading announcement with ID:', id);
      loadAnnouncement(id).catch((error) => {
        console.error('Error loading announcement:', error);
        setError('Failed to load announcement. Please try again.');
        setLoading(false);
      });
    }
  }, [id, loadAnnouncement, clearAllState, hasPermission]);

  // Handle announcement data when it's loaded from Redux
  useEffect(() => {
    if (selectedAnnouncement) {
      console.log('Selected announcement loaded:', selectedAnnouncement);
      setAnnouncement(selectedAnnouncement);
      setLoading(false);

      // Skip form reset if we just completed an update
      if (justUpdated) {
        console.log('Skipping form reset - just completed update');
        setJustUpdated(false);
        return;
      }

      try {
        // Format announcement data for the form
        const formData = formatAnnouncementForEdit(selectedAnnouncement);

        if (formData) {
          console.log('Formatted form data:', formData);

          // FIXED: Use formData.towers and formData.units which already processed the data correctly
          const originalTowers = formData.towers?.map(tower => Number(tower.id)) || [];
          const originalUnits = formData.units?.map(unit => Number(unit.id)) || [];

          console.log('Original towers from formData:', originalTowers);
          console.log('Original units from formData:', originalUnits);

          // Populate form with existing data
          reset({
            title: formData.title,
            description: formData.description,
            postAs: formData.postAs, // Already converted by formatAnnouncementForEdit
            creatorName: selectedAnnouncement.creator_name || '',
            autoName: selectedAnnouncement.creator_name || '',
            selectedMemberId: selectedAnnouncement.posted_member || '',
            selectedMemberName: selectedAnnouncement.member_name || '',
            selectedGroupId: selectedAnnouncement.posted_group || '',
            selectedGroupName: selectedAnnouncement.group_name || '',
            priority: formData.priority,
            label: formData.label,
            startDate: formData.startDate,
            startTime: formData.startTime,
            endDate: formData.endDate,
            endTime: formData.endTime,
            selectedTowers: originalTowers,
            selectedUnits: originalUnits,
            attachments: selectedAnnouncement.attachments || []
          });

          // Ensure towers and units are set after a brief delay to handle any race conditions
          setTimeout(() => {
            const currentTowers = (getValues('selectedTowers') || []).map(t => Number(t));
            const currentUnits = (getValues('selectedUnits') || []).map(u => Number(u));

            if (originalTowers.length > 0 && currentTowers.length === 0) {
              console.log('Re-setting towers after delay:', originalTowers);
              setValue('selectedTowers', originalTowers);
            }

            if (originalUnits.length > 0 && currentUnits.length === 0) {
              console.log('Re-setting units after delay:', originalUnits);
              setValue('selectedUnits', originalUnits);
            }
          }, 100);

          setInitialUnitsCheckDone(false); // Reset check for new announcement

          // Set attachments if they exist
          if (selectedAnnouncement.attachments) {
            console.log('=== SETTING ATTACHMENTS FROM SELECTED ANNOUNCEMENT ===');
            console.log('selectedAnnouncement.attachments:', selectedAnnouncement.attachments);
            const existingAttachments = selectedAnnouncement.attachments.map((att, index) => ({
              id: att.id || index,
              url: att.file_url,
              name: att.file_name,
              type: att.file_type,
              isExisting: true // Mark as existing attachment
            }));
            console.log('existingAttachments:', existingAttachments);
            setAttachments(existingAttachments);
          } else {
            console.log('=== NO ATTACHMENTS IN SELECTED ANNOUNCEMENT ===');
            console.log('selectedAnnouncement.attachments:', selectedAnnouncement.attachments);
            setAttachments([]);
          }

          // Store original form data for comparison (use the same processed data as reset)
          setOriginalFormData({
            title: formData.title,
            description: formData.description,
            postAs: formData.postAs,
            creatorName: selectedAnnouncement.creator_name || '',
            selectedMemberId: selectedAnnouncement.posted_member || '',
            selectedMemberName: selectedAnnouncement.member_name || '',
            selectedGroupId: selectedAnnouncement.posted_group || '',
            selectedGroupName: selectedAnnouncement.group_name || '',
            priority: formData.priority,
            label: formData.label,
            startDate: formData.startDate,
            startTime: formData.startTime,
            endDate: formData.endDate,
            endTime: formData.endTime,
            selectedTowers: originalTowers, // FIXED: Use the same originalTowers from formData
            selectedUnits: originalUnits,
            attachments: selectedAnnouncement.attachments || []
          });

          // Mark announcement as loaded
          setAnnouncementLoaded(true);
        } else {
          console.error('Failed to format announcement data');
          setError('Failed to load announcement data. Please try again.');
        }
      } catch (error) {
        console.error('Error processing announcement data:', error);
        setError('Failed to process announcement data. Please try again.');
      }
    }
  }, [selectedAnnouncement, reset, justUpdated]);

  // Handle loading and error states from Redux
  useEffect(() => {
    setLoading(announcementLoading);
  }, [announcementLoading]);

  useEffect(() => {
    if (updateError) {
      console.error('Update error:', updateError);
      setError(updateError);
    }
  }, [updateError]);

  useEffect(() => {
    if (loadError) {
      console.error('Load error:', loadError);
      setError(loadError);
      setLoading(false);
    }
  }, [loadError]);

  // Add timeout for loading announcement
  useEffect(() => {
    if (id && loading) {
      const timeout = setTimeout(() => {
        if (loading && !selectedAnnouncement) {
          console.error('Timeout loading announcement');
          setError('Failed to load announcement. Please check your connection and try again.');
          setLoading(false);
        }
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
  }, [id, loading, selectedAnnouncement]);

  // Handle success message only after form submission
  useEffect(() => {
    if (updateSuccess && message && !loading && announcementLoaded && hasSubmitted) {
      // Only show success message if we're not in initial loading state,
      // the announcement has been loaded, we've submitted the form, and we're not currently updating
      if (announcement && selectedAnnouncement && !updating) {
        setSuccessMessage(message);
        setHasSubmitted(false); // Reset the flag
      }
    }
  }, [updateSuccess, message, loading, announcement, selectedAnnouncement, announcementLoaded, updating, hasSubmitted]);

  // Utility function to convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
    console.log("=== EDIT ANNOUNCEMENT FILE UPLOAD DEBUG ===");
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
      console.log(`=== FILE VALIDATION DEBUG ===`);
      console.log(`File: ${file.name}`);
      console.log(`File type: ${file.type}`);
      console.log(`File size: ${file.size}`);

      const isImage = file.type.startsWith('image/');
      const isPDF = file.type === 'application/pdf';
      const isDoc = file.type === 'application/msword' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      console.log(`Is image: ${isImage}`);
      console.log(`Is PDF: ${isPDF}`);
      console.log(`Is Doc: ${isDoc}`);

      if (!isImage && !isPDF && !isDoc) {
        console.log(`File ${file.name} rejected - invalid type`);
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
    }

    // Reset the file input to allow selecting the same file again
    event.target.value = '';
  };

  // Remove attachment
  const removeAttachment = (id) => {
    const attachmentToRemove = attachments.find(att => att.id === id);

    if (attachmentToRemove && attachmentToRemove.isExisting) {
      // If it's an existing attachment, add to deletion list
      setAttachmentsToDelete(prev => [...prev, id]);
    }

    // Remove from current attachments list
    setAttachments(prev => prev.filter(att => att.id !== id));
  };



  // Handle title input change to limit words
  const handleTitleChange = (value, onChange) => {
    // Always update the input value to allow normal typing
    onChange(value);

    if (!value || value.trim() === '') {
      setTitleWordLimitError('');
      return;
    }

    const words = value.trim().split(/\s+/);
    if (words.length <= 10) {
      setTitleWordLimitError('');
    } else {
      // Show error message when trying to exceed 10 words
      setTitleWordLimitError('Cannot write more than 10 words');
      // The validation will prevent form submission
    }
  };

  // Get current word count for title
  const getTitleWordCount = (value) => {
    if (!value || value.trim() === '') return 0;
    return value.trim().split(/\s+/).length;
  };

  // Handle form submission
  const onSubmit = async (data) => {
    if (!hasPermission) {
      setError("You are not authorized to edit announcements.");
      return;
    }
    setDateOrderError("");
    const start = new Date(`${data.startDate}T${data.startTime}`);
    const end = new Date(`${data.endDate}T${data.endTime}`);
    if (start > end) {
      setDateOrderError("Start date/time must be before end date/time");
      return;
    }

    try {
      setError(null);
      setHasSubmitted(true);

      // Validate title word limit
      if (data.title && getTitleWordCount(data.title) > 10) {
        setTitleWordLimitError('Cannot write more than 10 words');
        setError('Please fix the title word limit before submitting.');
        setHasSubmitted(false);
        return;
      }

      // Prepare form data for API
      const formData = new FormData();

      // Map frontend field names to backend field names
      const fieldMapping = {
        'startDate': 'start_date',
        'startTime': 'start_time',
        'endDate': 'end_date',
        'endTime': 'end_time',
        'postAs': 'post_as',
        'selectedMemberId': 'posted_member',
        'selectedGroupId': 'posted_group'
      };

      // Append all simple fields with proper field name mapping
      Object.keys(data).forEach(key => {
        if (key !== 'attachments' && key !== 'selectedTowers' && key !== 'selectedUnits' &&
          key !== 'selectedMemberName' && key !== 'selectedGroupName' && key !== 'autoName' &&
          key !== 'creatorName') {
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

      // Helper to expand 'All' selection to actual IDs
      function expandAllSelection(arr, allItems) {
        if (!arr || arr.length === 0) return [];
        // If array contains 'All', return all item IDs
        if (arr.includes('All')) {
          if (!allItems || allItems.length === 0) {
            console.warn('Cannot expand "All" selection - items not loaded');
            return [];
          }
          return allItems.map(item => Number(item.id));
        }
        return arr;
      }

      // Expand 'All' selections before flattening
      const expandedTowers = expandAllSelection(data.selectedTowers, towers);
      const expandedUnits = expandAllSelection(data.selectedUnits, availableUnits);

      // Append tower and unit IDs individually (not as comma-separated strings)
      const flatTowerIds = flattenAndConvert(expandedTowers);
      console.log('DEBUG: Expanded towers:', expandedTowers);
      console.log('DEBUG: Flat tower IDs to send:', flatTowerIds);

      if (flatTowerIds.length > 0) {
        flatTowerIds.forEach(towerId => {
          formData.append('target_tower_ids', towerId.toString());
        });
      } else {
        // Send empty array indicator to clear tower selections
        formData.append('target_tower_ids', '');
      }

      const flatUnitIds = flattenAndConvert(expandedUnits);
      console.log('DEBUG: Expanded units:', expandedUnits);
      console.log('DEBUG: Flat unit IDs to send:', flatUnitIds);
      if (flatUnitIds.length > 0) {
        flatUnitIds.forEach(unitId => {
          formData.append('target_unit_ids', unitId.toString());
        });
      } else {
        // Send empty array indicator to clear unit selections
        formData.append('target_unit_ids', '');
      }

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
      const result = await dispatch(updateAnnouncement({ id, data: formData }));

      if (updateAnnouncement.fulfilled.match(result)) {
        // Set flag to prevent form reset when Redux updates selectedAnnouncement
        setJustUpdated(true);

        setSuccessMessage('Announcement updated successfully');
        setAttachmentsToDelete([]);

        // Update the local announcement state with the updated data
        setAnnouncement(result.payload);

        // Reset form modification state since the form has been successfully saved
        setHasFormBeenModified(false);

        // Ensure towers and units are properly restored after update with the backend response
        const updatedTowers = result.payload.target_towers_data?.map(tower => Number(tower.id)) || [];
        const updatedUnits = result.payload.target_units_data?.map(unit => Number(unit.id)) || [];

        // Get the current form values for towers and units (what the user just submitted)
        const currentTowers = data.selectedTowers || [];
        const currentUnits = data.selectedUnits || [];

        // Use backend response if available, otherwise use current form values
        const finalTowers = updatedTowers.length > 0 ? updatedTowers : currentTowers;
        const finalUnits = updatedUnits.length > 0 ? updatedUnits : currentUnits;

        console.log('After update - finalTowers:', finalTowers);
        console.log('After update - finalUnits:', finalUnits);

        if (finalTowers.length > 0) {
          console.log('Restoring towers after update:', finalTowers);
          setValue('selectedTowers', finalTowers);
        }

        if (finalUnits.length > 0) {
          console.log('Restoring units after update:', finalUnits);
          setValue('selectedUnits', finalUnits);
        }

        // Update original form data with the new saved values (including restored towers/units)
        const currentValues = getValues();
        setOriginalFormData({
          ...currentValues,
          selectedTowers: finalTowers,
          selectedUnits: finalUnits,
          attachments: attachments
        });

        // Refresh notifications if status changed or priority changed
        // This ensures recipients get notified about announcement updates
        const oldStatus = announcement?.status;
        const newStatus = result.payload?.status;
        const oldPriority = announcement?.priority;
        const newPriority = result.payload?.priority;

        const statusChanged = (oldStatus !== 'ongoing' && newStatus === 'ongoing') ||
          (oldStatus !== 'upcoming' && newStatus === 'upcoming');
        const priorityChanged = oldPriority && newPriority &&
          oldPriority.toLowerCase() !== newPriority.toLowerCase();

        if (statusChanged || priorityChanged) {
          // Dispatch custom event for immediate notification update
          window.dispatchEvent(new Event('announcementCreated'));

          if (priorityChanged) {
            console.log(`Priority changed from ${oldPriority} to ${newPriority}, triggering notification refresh`);
          }

          setTimeout(() => {
            dispatch(fetchUnreadCount());
            dispatch(fetchNotifications({ page_size: 100 }));
          }, 500);
        }
      } else {
        setHasSubmitted(false);
        setError({
          message: result.payload?.error || 'Failed to update announcement',
          details: result.payload?.details || {}
        });
      }
    } catch (error) {
      console.error('Error updating announcement:', error);
      setHasSubmitted(false);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  // Handle back navigation
  const handleBack = () => {
    // Reset state before navigating
    clearAllState();
    setSuccessMessage('');

    // Navigate back to the same tab the user came from
    const targetTab = sourceTab || 1; // Default to ongoing tab if no source tab
    navigate('/announcements', {
      state: {
        activeTab: targetTab,
        announcementId: id // Pass the announcement ID to trigger refresh
      },
      replace: true
    });
  };

  // Clear success message
  const clearMessage = () => {
    setSuccessMessage('');
  };

  // Handle success message OK button
  const handleSuccessOk = () => {
    // Reset state before navigating
    clearAllState();
    setSuccessMessage('');

    // Navigate back to announcements list with the correct tab
    const targetTab = sourceTab || 1; // Default to ongoing tab if no source tab
    navigate('/announcements', {
      state: {
        activeTab: targetTab,
        announcementId: id // Pass the announcement ID to trigger refresh
      },
      replace: true
    });
  };

  // Show loading state
  if (loading) {
    return <ModernLoadingAnimation className="min-h-screen" />;
  }

  // Show error state
  if (error) {
    const errorMessage = typeof error === 'object' ? error.message : error;
    const errorDetails = typeof error === 'object' ? error.details : null;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            {errorMessage}
            {errorDetails && Object.keys(errorDetails).length > 0 && (
              <div className="mt-2 text-sm">
                <div className="font-semibold">Details:</div>
                {Object.entries(errorDetails).map(([field, messages]) => {
                  // Handle nested error objects
                  const formatMessages = (msgs) => {
                    if (typeof msgs === 'string') return msgs;
                    if (Array.isArray(msgs)) return msgs.join(', ');
                    if (typeof msgs === 'object') {
                      return Object.entries(msgs).map(([key, value]) => {
                        if (Array.isArray(value)) {
                          return `${key}: ${value.join(', ')}`;
                        }
                        return `${key}: ${value}`;
                      }).join('; ');
                    }
                    return String(msgs);
                  };

                  return (
                    <div key={field} className="mt-1">
                      <span className="font-medium">{field}:</span> {formatMessages(messages)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('/announcements', {
              state: {
                activeTab: sourceTab || 1,
                announcementId: id
              }
            })}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-[#2d7a78] transition-colors"
          >
            Back to Announcements
          </button>
        </div>
      </div>
    );
  }

  // Prepare data for preview component
  // When "All" units selected, pass expanded unit IDs for user count calculation
  const previewSelectedUnits = watchedValues.selectedUnits || [];
  const targetUnitIdsForPreview =
    previewSelectedUnits.includes('All') && availableUnits.length > 0
      ? availableUnits.map((u) => u.id)
      : previewSelectedUnits.filter((id) => id !== 'All');

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
    selectedUnits: watchedValues.selectedUnits,
    targetUnitIds: targetUnitIdsForPreview,
    attachments: attachments.map(att => ({
      preview: att.base64 || att.url, // Use base64 for preview
      url: att.url || att.base64, // Fallback for modal
      base64: att.base64, // Include base64 for modal fallback
      name: att.name,
      type: att.type
    }))
  };

  return (
    <PageContainer className="min-h-screen bg-surfaceMuted">
      <div
        className="md:sticky md:top-0 z-20 mb-3 flex items-center justify-between gap-3 bg-surfaceMuted/95 py-3 sm:py-4 backdrop-blur -mx-4 sm:-mx-6 px-4 sm:px-6"
        onClick={handleBack}
      >
        <div className="inline-flex cursor-pointer items-center gap-3 text-[#0F172A] transition-colors hover:text-primary">
          <ArrowHeading title="Edit Announcement" size="2xl" color="text-black" />
        </div>
      </div>

      <div className="max-h-[calc(100vh-180px)] overflow-y-auto">
        <section className="mx-auto w-full max-w-[1400px] rounded-[24px] sm:rounded-[32px] border border-borderLight bg-white px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          {/* Main Content */}
          <div className="max-w-7xl mx-auto px-0 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column - Preview */}
              <div className="order-2 lg:order-1 lg:w-full lg:col-span-4 hidden lg:block">
                <div className="bg-white rounded-lg shadow-sm p-6 lg:sticky lg:top-8 h-screen lg:h-[calc(100vh-6rem)] overflow-y-auto border-2">
                  <AnnouncementPreview data={previewData} currentUser={currentUser} />
                </div>
              </div>

              {/* Right Column - Form (wider) */}
              <div className="order-1 lg:order-2 lg:col-span-8 bg-white rounded-lg shadow-sm p-4 sm:p-6">
                <EditAnnouncementForm
                  // Form props
                  control={control}
                  handleSubmit={handleSubmit}
                  watch={watch}
                  setValue={setValue}
                  errors={errors}
                  isSubmitting={isSubmitting}
                  onSubmit={onSubmit}

                  // State props
                  currentUser={currentUser}
                  attachments={attachments}
                  announcement={announcement}
                  hasFormBeenModified={hasFormBeenModified}

                  // Callbacks
                  onUnitsLoaded={(units) => {
                    setAvailableUnits(units);

                    // Logic to detect if we should use ['All'] for selectedUnits
                    if (!initialUnitsCheckDone && units.length > 0 && id) {
                      const currentSelectedUnits = getValues('selectedUnits') || [];

                      // If the IDs we have match the total units in the towers, it's effectively "All"
                      // This is important because changing towers should persist the "All" state
                      const allUnitIds = units.map(u => Number(u.id));
                      const selectedIds = currentSelectedUnits.map(id => Number(id));

                      const isAllSelected = allUnitIds.length > 0 &&
                        allUnitIds.every(id => selectedIds.includes(id)) &&
                        selectedIds.length >= allUnitIds.length;

                      if (isAllSelected) {
                        console.log('[EditAnnouncement] Detected all units selected, switching to ["All"] marker');
                        setValue('selectedUnits', ['All']);
                      }
                      setInitialUnitsCheckDone(true);
                    }
                  }}

                  // Error states
                  titleWordLimitError={titleWordLimitError}
                  fileUploadError={fileUploadError}
                  dateOrderError={dateOrderError}

                  // Handlers
                  handleTitleChange={handleTitleChange}
                  getTitleWordCount={getTitleWordCount}
                  handleFileUpload={handleFileUpload}
                  removeAttachment={removeAttachment}
                  handleMemberSelect={handleMemberSelect}
                  handleGroupSelect={handleGroupSelect}
                  isFormValid={isFormValid}

                  // Watched values
                  watchedValues={watchedValues}
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

export default EditAnnouncement;
