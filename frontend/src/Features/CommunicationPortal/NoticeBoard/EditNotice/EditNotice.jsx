import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import ArrowHeading from '../../../../Components/HeadingComponent/ArrowHeading';
import PageContainer from '../../../../Components/Ui/PageContainer';
import NoticePreview from '../components/NoticePreview';
import EditNoticeForm from './EditNoticeForm';
import MessageBox from '../../../../Components/MessageBox/MessageBox';
import ModernLoadingAnimation from '../../../../Components/Loaders/ModernLoadingAnimation';
import useCurrentUser from '../../Announcements/hooks/useCurrentUser';
import { useNotices } from "../../../../hooks/useNotices";
import { updateNotice } from "../../../../redux/slices/api/noticeApi";
import { fetchTowers } from "../../../../redux/slices/api/announcementApi";
import { formatNoticeForEdit } from "../utils/noticeUtils";



// Validation schema for editing notices (attachments are optional)
const editNoticeSchema = yup.object().shape({
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
    .test('not-empty', 'Priority is required', value => value && value.trim() !== '')
    .test('valid-priority', 'Invalid priority value', value => {
      if (!value || value.trim() === '') return false;
      return ['urgent', 'high', 'normal', 'low'].includes(value);
    }),
  label: yup.string().required('Label is required'),
  startDate: yup.string().required('Start date is required'),
  startTime: yup.string().required('Start time is required'),
  endDate: yup.string().required('End date is required'),
  endTime: yup.string().required('End time is required'),
  selectedTowers: yup.array(), // Made optional for editing
  selectedUnits: yup.array(), // Made optional to match backend
  attachments: yup.array().min(1, "At least one attachment is required") // Required for editing
});

/**
 * EditNotice Component
 * Main component for editing existing notices with real-time preview
 */
const EditNotice = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const dispatch = useDispatch();
  const { currentUser, manualRefresh } = useCurrentUser(); // Use custom hook for current user
  const [attachments, setAttachments] = useState([]);
  const [attachmentsToDelete, setAttachmentsToDelete] = useState([]);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [fileUploadError, setFileUploadError] = useState('');
  const [error, setError] = useState(null);

  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [dateOrderError, setDateOrderError] = useState("");
  const [formChanged, setFormChanged] = useState(false);
  const [isAttachmentUpdating, setIsAttachmentUpdating] = useState(false);
  const [towers, setTowers] = useState([]);

  // State to track if notice data has been loaded
  const [noticeLoaded, setNoticeLoaded] = useState(false);

  // Store original form data for comparison
  const [originalFormData, setOriginalFormData] = useState(null);

  // Get the source tab from location state (passed from NoticeList)
  const sourceTab = location.state?.sourceTab || null;

  // Redux hooks for notice editing
  const {
    selectedNotice,
    loading: noticeLoading,
    updating,
    updateError,
    updateSuccess,
    message,
    error: loadError,
    loadNotice,
    clearAllStates
  } = useNotices();

  // Reset Redux state when component mounts to clear any previous state
  useEffect(() => {
    clearAllStates();
    setSuccessMessage('');
    setError(null);
    setHasSubmitted(false);
  }, []); // Empty dependency array since this should only run once on mount

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

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      clearAllStates();
      setSuccessMessage('');
      setError(null);
      setHasSubmitted(false);
      setAttachments([]);
      setAttachmentsToDelete([]);
      setNoticeLoaded(false);
    };
  }, []); // Empty dependency array since this should only run once on mount/unmount

  // Form setup with validation
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    clearErrors,
    trigger,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: yupResolver(editNoticeSchema),
    mode: 'onChange',
    defaultValues: {
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
    const hasAttachments = attachments.length > 0;

    const isValid = (
      values.creatorName &&
      values.priority &&
      values.label &&
      values.startDate &&
      values.startTime &&
      values.endDate &&
      values.endTime &&
      hasAttachments &&
      (values.postAs === 'Creator' ||
        (values.postAs === 'Group' && values.selectedGroupId) ||
        (values.postAs === 'Member' && values.selectedMemberId))
    );

    console.log('🔍 Form validation check:', {
      isValid,
      hasAttachments,
      attachmentsLength: attachments.length,
      values: {
        creatorName: values.creatorName,
        priority: values.priority,
        label: values.label,
        startDate: values.startDate,
        startTime: values.startTime,
        endDate: values.endDate,
        endTime: values.endTime,
        attachments: attachments.length,
        postAs: values.postAs,
        selectedGroupId: values.selectedGroupId,
        selectedMemberId: values.selectedMemberId
      }
    });

    return isValid;
  };

  // Watch all form values for real-time preview
  const watchedValues = watch();

  // Debug: Log priority changes
  useEffect(() => {
    if (noticeLoaded && originalFormData) {
      console.log('👀 WATCHED VALUES CHANGED - Priority:', watchedValues.priority);
    }
  }, [watchedValues.priority, noticeLoaded, originalFormData]);

  // Watch creator name for auto-sync
  const creatorName = watch('creatorName');

  // Watch selected towers for unit filtering
  const selectedTowers = watch('selectedTowers');

  // Watch selected units for user count calculation
  const selectedUnits = watch('selectedUnits');

  // Force re-evaluation when tower selections change
  useEffect(() => {
    if (noticeLoaded && originalFormData) {
      console.log('🔄 Tower selection changed, forcing form change re-evaluation:', {
        selectedTowers,
        originalTowers: originalFormData.selectedTowers,
        towersEqual: JSON.stringify(selectedTowers) === JSON.stringify(originalFormData.selectedTowers)
      });
      // Trigger form validation
      trigger(['selectedTowers', 'selectedUnits']);
    }
  }, [selectedTowers, noticeLoaded, originalFormData, trigger]);

  // Debug: Monitor attachments state changes and clear validation errors
  useEffect(() => {
    console.log("=== ATTACHMENTS STATE CHANGED ===");
    console.log("Current attachments:", attachments);
    console.log("Attachments count:", attachments.length);

    // Update form field with current attachments
    setValue("attachments", attachments);

    // Validate attachments and show/hide error messages
    if (attachments.length > 0) {
      setFileUploadError("");
      clearErrors("attachments");
    } else {
      setFileUploadError("At least one attachment is required.");
    }
  }, [attachments, clearErrors, setValue]);

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

  // State to track if units have been initially restored
  const [unitsInitiallyRestored, setUnitsInitiallyRestored] = useState(false);

  // Restore original units only once when notice data is loaded
  useEffect(() => {
    if (noticeLoaded && notice && !unitsInitiallyRestored) {
      const originalUnits = notice.target_units_data?.map(unit => Number(unit.id)) || [];

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
  }, [noticeLoaded, notice, unitsInitiallyRestored, setValue, getValues]);

  // Update autoName when creatorName changes
  useEffect(() => {
    setValue('autoName', creatorName);
  }, [creatorName, setValue]);

  // Set original form data when notice is loaded
  useEffect(() => {
    if (noticeLoaded && notice && !originalFormData) {
      // Helper function to convert backend post_as to frontend format
      const convertPostAsToFrontend = (backendValue) => {
        const mapping = {
          'creator': 'Creator',
          'group': 'Group',
          'member': 'Member'
        };
        return mapping[backendValue] || 'Creator';
      };

      const originalData = {
        postAs: convertPostAsToFrontend(notice.post_as), // Convert to match form values
        selectedMemberId: notice.posted_member || '',
        selectedMemberName: notice.member_name || '',
        selectedGroupId: notice.posted_group || '',
        selectedGroupName: notice.group_name || '',
        priority: notice.priority || 'normal',
        label: notice.label || '',
        startDate: notice.start_date || '',
        startTime: notice.start_time || '',
        endDate: notice.end_date || '',
        endTime: notice.end_time || '',
        selectedTowers: notice.target_towers_data?.map(tower => Number(tower.id)) || [],
        selectedUnits: notice.target_units_data?.map(unit => Number(unit.id)) || [],
        attachments: attachments
      };

      console.log('Setting original form data:', originalData);
      console.log('🔧 ORIGINAL FORM DATA SET - Priority:', originalData.priority);
      setOriginalFormData(originalData);
      setFormChanged(false); // Reset form changed state
    }
  }, [noticeLoaded, notice, attachments]);

  // Helper function to normalize tower arrays for comparison
  const normalizeTowerArray = (towerArray, allTowers) => {
    if (!towerArray || towerArray.length === 0) return [];

    // Get all available tower IDs (excluding 'All')
    const allTowerIds = allTowers.map(t => Number(t.id)).sort();

    // Convert array to numbers and filter out 'All'
    const numericTowers = towerArray
      .filter(t => t !== 'All')
      .map(t => Number(t))
      .filter(t => !isNaN(t)) // Filter out any NaN values
      .sort();

    // If "All" is present in the array, or if all individual towers are selected,
    // normalize to all tower IDs
    if (towerArray.includes('All') ||
      (numericTowers.length === allTowerIds.length &&
        allTowerIds.every(id => numericTowers.includes(id)))) {
      return allTowerIds;
    }

    return numericTowers;
  };

  // Real-time change detection by comparing current values with original
  useEffect(() => {
    if (noticeLoaded && originalFormData) {
      const currentValues = watchedValues;

      // Compare tower arrays - use normalization if towers are loaded, otherwise simple comparison
      let towersChanged = false;
      if (towers.length > 0) {
        // Normalize tower arrays for proper comparison when towers are loaded
        const currentTowersNormalized = normalizeTowerArray(currentValues.selectedTowers || [], towers);
        const originalTowersNormalized = normalizeTowerArray(originalFormData.selectedTowers || [], towers);
        towersChanged = JSON.stringify(currentTowersNormalized) !== JSON.stringify(originalTowersNormalized);
      } else {
        // Fallback to simple comparison when towers aren't loaded yet
        // Normalize both arrays to handle "All" vs individual tower selections
        const normalizeFallback = (arr) => {
          if (!arr || arr.length === 0) return [];
          // If "All" is present, treat it as selecting all available towers
          if (arr.includes('All')) {
            return arr.filter(t => t !== 'All').map(t => String(t)).sort();
          }
          return arr.map(t => String(t)).sort();
        };

        const currentTowersSorted = JSON.stringify(normalizeFallback(currentValues.selectedTowers || []));
        const originalTowersSorted = JSON.stringify(normalizeFallback(originalFormData.selectedTowers || []));
        towersChanged = currentTowersSorted !== originalTowersSorted;
      }

      // Compare all form fields
      const priorityChanged = currentValues.priority !== originalFormData.priority;

      // Check for attachment changes (including replacements)
      const originalExistingAttachments = originalFormData.attachments.filter(att => att.isExisting);
      const currentExistingAttachments = attachments.filter(att => att.isExisting);
      const newAttachments = attachments.filter(att => !att.isExisting);

      // Check if any existing attachments were replaced (removed and new ones added)
      const existingAttachmentsChanged = originalExistingAttachments.length !== currentExistingAttachments.length;

      // Check if there are new attachments (which could be replacements)
      const hasNewAttachments = newAttachments.length > 0;

      // Check if attachments were deleted
      const hasDeletedAttachments = attachmentsToDelete.length > 0;

      // Check if total count changed
      const attachmentCountChanged = attachments.length !== originalFormData.attachments.length;

      // Any attachment-related change
      const attachmentsChanged = existingAttachmentsChanged || hasNewAttachments || hasDeletedAttachments || attachmentCountChanged;

      // Debug attachment changes
      if (existingAttachmentsChanged || hasNewAttachments || hasDeletedAttachments || attachmentCountChanged) {
        console.log('📎 ATTACHMENT CHANGE DETECTED:', {
          existingAttachmentsChanged,
          hasNewAttachments,
          hasDeletedAttachments,
          attachmentCountChanged,
          attachmentsChanged,
          originalExistingCount: originalExistingAttachments.length,
          currentExistingCount: currentExistingAttachments.length,
          newAttachmentsCount: newAttachments.length,
          deletedAttachmentsCount: attachmentsToDelete.length,
          totalOriginalCount: originalFormData.attachments.length,
          totalCurrentCount: attachments.length
        });
      }

      // Check for label changes specifically
      const labelChanged = currentValues.label !== originalFormData.label;

      // Debug label changes specifically
      if (labelChanged) {
        console.log('🏷️ LABEL CHANGE DETECTED:', {
          currentLabel: currentValues.label,
          originalLabel: originalFormData.label,
          labelChanged,
          currentLabelType: typeof currentValues.label,
          originalLabelType: typeof originalFormData.label
        });
      }

      const hasChanged =
        currentValues.postAs !== originalFormData.postAs ||
        currentValues.selectedMemberId !== originalFormData.selectedMemberId ||
        currentValues.selectedMemberName !== originalFormData.selectedMemberName ||
        currentValues.selectedGroupId !== originalFormData.selectedGroupId ||
        currentValues.selectedGroupName !== originalFormData.selectedGroupName ||
        priorityChanged ||
        labelChanged ||
        currentValues.startDate !== originalFormData.startDate ||
        currentValues.startTime !== originalFormData.startTime ||
        currentValues.endDate !== originalFormData.endDate ||
        currentValues.endTime !== originalFormData.endTime ||
        towersChanged ||
        JSON.stringify((currentValues.selectedUnits || []).map(u => String(u)).sort()) !==
        JSON.stringify((originalFormData.selectedUnits || []).map(u => String(u)).sort()) ||
        attachmentsChanged;

      // Debug priority changes specifically
      if (priorityChanged) {
        console.log('🚨 PRIORITY CHANGE DETECTED:', {
          currentPriority: currentValues.priority,
          originalPriority: originalFormData.priority,
          priorityChanged,
          hasChanged
        });
      }

      console.log('🏗️ Tower Change Detection:', {
        currentTowers: currentValues.selectedTowers,
        originalTowers: originalFormData.selectedTowers,
        towersChanged,
        availableTowers: towers.length,
        usingNormalization: towers.length > 0,
        currentTowersLength: (currentValues.selectedTowers || []).length,
        originalTowersLength: (originalFormData.selectedTowers || []).length
      });

      console.log('🔍 NOTICE FORM CHANGE DETECTION:', {
        hasChanged,
        labelChanged,
        towersChanged,
        attachmentsChanged,
        formChanged,
        isFormValid: isFormValid(),
        currentValues: {
          postAs: currentValues.postAs,
          priority: currentValues.priority,
          label: currentValues.label,
          startDate: currentValues.startDate,
          startTime: currentValues.startTime,
          endDate: currentValues.endDate,
          endTime: currentValues.endTime,
          selectedTowers: currentValues.selectedTowers,
          selectedUnits: currentValues.selectedUnits
        },
        originalFormData: {
          postAs: originalFormData.postAs,
          priority: originalFormData.priority,
          label: originalFormData.label,
          startDate: originalFormData.startDate,
          startTime: originalFormData.startTime,
          endDate: originalFormData.endDate,
          endTime: originalFormData.endTime,
          selectedTowers: originalFormData.selectedTowers,
          selectedUnits: originalFormData.selectedUnits
        },
        attachments: {
          currentLength: attachments.length,
          originalLength: originalFormData.attachments.length,
          toDeleteLength: attachmentsToDelete.length,
          existingCount: currentExistingAttachments.length,
          originalExistingCount: originalExistingAttachments.length,
          newCount: newAttachments.length
        }
      });

      setFormChanged(hasChanged);
    }
  }, [watchedValues, originalFormData, noticeLoaded, attachments, attachmentsToDelete, towers, selectedTowers, selectedUnits]);



  // Initialize form with saved preferences and current user data (only for new notices)
  useEffect(() => {
    // Skip initialization if notice is already loaded to prevent overriding notice data
    if (noticeLoaded || notice) {
      return;
    }

    // Load saved post type preference only for new notices
    const savedPostAs = localStorage.getItem('noticePostAs');
    if (savedPostAs) {
      setValue('postAs', savedPostAs);
    }

    // Set default creator name if current user is available
    if (currentUser) {
      setValue('creatorName', currentUser.full_name || currentUser.fullName || 'Current User');
    }
  }, [setValue, currentUser, noticeLoaded, notice]);

  // Update creator name when current user changes (from custom hook) - only if notice not loaded yet
  useEffect(() => {
    if (currentUser && !noticeLoaded) {
      const currentPostAs = watch('postAs');
      if (currentPostAs === 'Creator' || currentPostAs === 'Group') {
        setValue('creatorName', currentUser.full_name || currentUser.fullName || 'Current User');
      }
    }
  }, [currentUser, setValue, watch, noticeLoaded]);

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
    // Don't allow changes when editing a notice
    if (noticeLoaded) {
      return;
    }

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
    // Don't allow changes when editing a notice
    if (noticeLoaded) {
      return;
    }

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

  // Load notice data using Redux
  useEffect(() => {
    if (id) {
      // Reset state when loading a new notice
      clearAllStates();
      setSuccessMessage('');
      setError(null);
      setHasSubmitted(false);
      setAttachments([]);
      setAttachmentsToDelete([]);
      setNoticeLoaded(false);

      console.log('Loading notice with ID:', id);
      loadNotice(id).catch((error) => {
        console.error('Error loading notice:', error);
        setError('Failed to load notice. Please try again.');
        setLoading(false);
      });
    }
  }, [id, loadNotice]);

  // Handle notice data when it's loaded from Redux
  useEffect(() => {
    if (selectedNotice) {
      console.log('Selected notice loaded:', selectedNotice);
      setNotice(selectedNotice);
      setLoading(false);

      try {
        // Format notice data for the form
        const formData = formatNoticeForEdit(selectedNotice);

        if (formData) {
          console.log('Formatted form data:', formData);
          // Store original units for restoration
          const originalUnits = selectedNotice.target_units_data?.map(unit => unit.id) || [];

          // Populate form with existing data
          reset({
            postAs: formData.postAs, // Already converted by formatNoticeForEdit
            creatorName: selectedNotice.creator_name || '',
            autoName: selectedNotice.creator_name || '',
            selectedMemberId: selectedNotice.posted_member || '',
            selectedMemberName: selectedNotice.member_name || '',
            selectedGroupId: selectedNotice.posted_group || '',
            selectedGroupName: selectedNotice.group_name || '',
            priority: formData.priority,
            label: formData.label,
            startDate: formData.startDate,
            startTime: formData.startTime,
            endDate: formData.endDate,
            endTime: formData.endTime,
            selectedTowers: selectedNotice.target_towers_data?.map(tower => Number(tower.id)) || [],
            selectedUnits: originalUnits,
            attachments: selectedNotice.attachments || []
          });

          // Ensure units are set after a brief delay to handle any race conditions
          setTimeout(() => {
            const currentUnits = (getValues('selectedUnits') || []).map(u => Number(u));
            if (originalUnits.length > 0 && currentUnits.length === 0) {
              console.log('Re-setting units after delay:', originalUnits);
              setValue('selectedUnits', originalUnits);
            }
          }, 100);

          // Set attachments if they exist
          if (selectedNotice.attachments) {
            console.log('=== SETTING ATTACHMENTS FROM SELECTED NOTICE ===');
            console.log('selectedNotice.attachments:', selectedNotice.attachments);
            const existingAttachments = selectedNotice.attachments.map((att, index) => ({
              id: att.id || index,
              url: att.file_url,
              name: att.file_name,
              type: att.file_type,
              isExisting: true // Mark as existing attachment
            }));
            console.log('existingAttachments:', existingAttachments);
            setAttachments(existingAttachments);
          } else {
            console.log('=== NO ATTACHMENTS IN SELECTED NOTICE ===');
            console.log('selectedNotice.attachments:', selectedNotice.attachments);
            setAttachments([]);
          }

          // Reset form change state when form is loaded
          setFormChanged(false);

          // Mark notice as loaded
          setNoticeLoaded(true);
        } else {
          console.error('Failed to format notice data');
          setError('Failed to load notice data. Please try again.');
        }
      } catch (error) {
        console.error('Error processing notice data:', error);
        setError('Failed to process notice data. Please try again.');
      }
    }
  }, [selectedNotice, reset]);

  // Handle loading and error states from Redux
  useEffect(() => {
    setLoading(noticeLoading);
  }, [noticeLoading]);

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

  // Add timeout for loading notice
  useEffect(() => {
    if (id && loading) {
      const timeout = setTimeout(() => {
        if (loading && !selectedNotice) {
          console.error('Timeout loading notice');
          setError('Failed to load notice. Please check your connection and try again.');
          setLoading(false);
        }
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
  }, [id, loading, selectedNotice]);

  // Handle success message only after form submission
  useEffect(() => {
    if (updateSuccess && message && !loading && noticeLoaded && hasSubmitted) {
      // Only show success message if we're not in initial loading state,
      // the notice has been loaded, we've submitted the form, and we're not currently updating
      if (notice && selectedNotice && !updating) {
        setSuccessMessage(message);
        setHasSubmitted(false); // Reset the flag
      }
    }
  }, [updateSuccess, message, loading, notice, selectedNotice, noticeLoaded, updating, hasSubmitted]);

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
    console.log("=== EDIT NOTICE FILE UPLOAD DEBUG ===");
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

      console.log(`Is image: ${isImage}`);
      console.log(`Is PDF: ${isPDF}`);

      if (!isImage && !isPDF) {
        console.log(`File ${file.name} rejected - invalid type`);
        invalidFiles.push(file.name);
        continue;
      }

      console.log(`File ${file.name} accepted`);

      // Check file size: 10MB for all files (increased to match AddNotice)
      if (file.size > 10 * 1024 * 1024) {
        console.log(`File ${file.name} rejected - size too large: ${file.size} bytes`);
        setFileUploadError(`File "${file.name}" exceeds the 10MB size limit. Please choose a smaller file.`);
        // Reset the file input
        event.target.value = '';
        return;
      }

      validFiles.push(file);
    }

    if (invalidFiles.length > 0) {
      setFileUploadError(`Invalid file types: ${invalidFiles.join(', ')}. Only images and PDFs are allowed for notices.`);
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
    setAttachments(prev => {
      const updatedAttachments = prev.filter(att => att.id !== id);

      // Validate attachments after removal
      if (updatedAttachments.length === 0) {
        setFileUploadError("At least one attachment is required.");
      } else {
        setFileUploadError("");
      }

      return updatedAttachments;
    });
  };



  // Handle form submission
  const onSubmit = async (data) => {
    console.log('🚀 Form submission started with data:', data);
    console.log('🚀 Form errors:', errors);
    console.log('🚀 Form is valid:', Object.keys(errors).length === 0);

    // Clear previous errors
    setDateOrderError("");
    setFileUploadError("");

    // Validate date order
    const start = new Date(`${data.startDate}T${data.startTime}`);
    const end = new Date(`${data.endDate}T${data.endTime}`);
    if (start > end) {
      setDateOrderError("Start date/time must be before end date/time");
      return;
    }

    // Validate attachments
    if (attachments.length === 0) {
      setFileUploadError("At least one attachment is required.");
      return;
    }

    try {
      console.log('🚀 Form is valid, proceeding with submission');
      setError(null);
      setHasSubmitted(true);



      console.log('✅ All validations passed, preparing form data');
      console.log('✅ Form data keys:', Object.keys(data));
      console.log('✅ Form data values:', data);

      // Prepare form data for API
      const formData = new FormData();
      console.log('📝 Preparing FormData for API submission');

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

          console.log(`📝 Adding field: ${backendKey} = ${value}`);
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

      // Send tower and unit IDs as JSON arrays to avoid exceeding field limit
      const flatTowerIds = flattenAndConvert(data.selectedTowers);
      console.log('📝 Tower IDs:', flatTowerIds);
      if (flatTowerIds.length > 0) {
        // Send as JSON array instead of individual fields
        formData.append('target_tower_ids', JSON.stringify(flatTowerIds));
      } else {
        // Send empty array indicator to clear tower selections
        console.log('📝 No tower IDs, sending empty string');
        formData.append('target_tower_ids', '');
      }

      const flatUnitIds = flattenAndConvert(data.selectedUnits);
      console.log('📝 Unit IDs:', flatUnitIds);
      if (flatUnitIds.length > 0) {
        // Send as JSON array instead of individual fields
        formData.append('target_unit_ids', JSON.stringify(flatUnitIds));
      } else {
        // Send empty array indicator to clear unit selections
        console.log('📝 No unit IDs, sending empty string');
        formData.append('target_unit_ids', '');
      }

      // Debug log: show what unit IDs are being sent
      console.log('DEBUG: Sending unit IDs to backend (edit):', flatUnitIds);

      // Append attachments to delete
      console.log('📝 Attachments to delete:', attachmentsToDelete);
      attachmentsToDelete.forEach(id => {
        console.log(`📝 Adding attachment to delete: ${id}`);
        formData.append('attachments_to_delete', id);
      });

      // Append new attachments
      const newAttachments = attachments.filter(att => !att.isExisting);
      console.log('📝 New attachments to add:', newAttachments);
      newAttachments.forEach((att) => {
        if (att.file) {
          console.log(`📝 Adding file attachment: ${att.name}`);
          formData.append('attachments', att.file);
        } else if (att.base64) {
          console.log(`📝 Adding base64 attachment: ${att.name}`);
          const blob = base64ToBlob(att.base64, att.type);
          formData.append('attachments', blob, att.name);
        }
      });

      // Make the API call
      console.log('📡 Making API call to update notice with ID:', id);
      console.log('📡 FormData contents:', Array.from(formData.entries()));
      console.log('📡 FormData size:', formData.entries().length);
      const result = await dispatch(updateNotice({ id, data: formData }));

      console.log('📡 API call result:', result);
      if (updateNotice.fulfilled.match(result)) {
        console.log('✅ API call successful');
        setSuccessMessage('Notice updated successfully');
        setAttachmentsToDelete([]);

        // Update the local notice state with the updated data
        setNotice(result.payload);

        // Reset form change state since the form has been successfully saved
        setFormChanged(false);

        // Ensure units are properly restored after update
        const updatedUnits = result.payload.target_units_data?.map(unit => unit.id) || [];
        if (updatedUnits.length > 0) {
          console.log('Restoring units after update:', updatedUnits);
          setValue('selectedUnits', updatedUnits);
        }
      } else {
        console.log('❌ API call failed:', result);
        console.log('❌ Error payload:', result.payload);
        setHasSubmitted(false);
        setError({
          message: result.payload?.error || 'Failed to update notice',
          details: result.payload?.details || {}
        });
      }
    } catch (error) {
      console.error('❌ Error updating notice:', error);
      console.error('❌ Error details:', error.message);
      console.error('❌ Error stack:', error.stack);
      setHasSubmitted(false);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  // Handle form validation errors
  const onError = (errors) => {
    console.log("Form validation errors:", errors);

    if (errors.attachments) {
      setFileUploadError(errors.attachments.message || "At least one attachment is required.");
    }
  };

  // Validate attachments when they change
  const validateAttachments = () => {
    if (attachments.length === 0) {
      setFileUploadError("At least one attachment is required.");
      return false;
    }
    setFileUploadError("");
    return true;
  };

  // Handle back navigation
  const handleBack = () => {
    // Reset state before navigating
    clearAllStates();
    setSuccessMessage('');

    // Navigate back to the same tab the user came from
    const targetTab = sourceTab || 1; // Default to ongoing tab if no source tab
    navigate('/notice-board', {
      state: {
        activeTab: targetTab,
        noticeId: id // Pass the notice ID to trigger refresh
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
    clearAllStates();
    setSuccessMessage('');

    // Navigate back to notices list with the correct tab
    const targetTab = sourceTab || 1; // Default to ongoing tab if no source tab
    navigate('/notice-board', {
      state: {
        activeTab: targetTab,
        noticeId: id // Pass the notice ID to trigger refresh
      },
      replace: true
    });
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ModernLoadingAnimation />
      </div>
    );
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
            onClick={() => navigate('/notice-board', {
              state: {
                activeTab: sourceTab || 1,
                noticeId: id
              }
            })}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primaryDark transition-colors"
          >
            Back to Notices
          </button>
        </div>
      </div>
    );
  }

  // Convert base64 to Blob
  const base64ToBlob = (base64, contentType = '') => {
    const byteCharacters = atob(base64.split(',')[1] || base64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);

      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: contentType });
  };

  // Prepare data for preview component
  const previewData = {
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
    selectedUnits: watchedValues.selectedUnits, // Add selectedUnits for user count calculation
    attachments: attachments.map(att => ({
      preview: att.base64 || att.url, // Use base64 for preview
      url: att.url || att.base64, // Fallback for modal
      base64: att.base64, // Include base64 for modal fallback
      name: att.name,
      type: att.type
    }))
  };

  return (
    <PageContainer className="min-h-screen bg-surfaceMuted px-4 sm:px-6 lg:px-[13px]">
      <div
        className="md:sticky md:top-0 z-20 mb-3 flex items-center justify-between gap-3 bg-surfaceMuted/95 py-4 backdrop-blur -mx-4 sm:-mx-6 lg:-mx-[13px] px-4 sm:px-6 lg:px-[13px]"
        onClick={handleBack}
      >
        <div className="inline-flex cursor-pointer items-center gap-3 text-[#0F172A] transition-colors hover:text-primary">
          <ArrowHeading title="Edit Notice" size="2xl" color="text-black" />
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
                  <NoticePreview data={previewData} currentUser={currentUser} />
                </div>
              </div>

              {/* Right Column - Form (wider) */}
              <div className="order-1 lg:order-2 lg:col-span-8 bg-white rounded-lg shadow-sm">
                <EditNoticeForm
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
                  notice={notice}
                  formChanged={formChanged}

                  // Edit-specific props
                  updating={updating}
                  isAttachmentUpdating={isAttachmentUpdating}
                  hasFormBeenModified={formChanged}

                  // Error states
                  fileUploadError={fileUploadError}
                  dateOrderError={dateOrderError}

                  // Handlers
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

      {/* Error Message */}
      {error && (
        <MessageBox
          error={typeof error === 'string' ? error : error.message}
          clearMessage={() => setError(null)}
        />
      )}
    </PageContainer>
  );
};

export default EditNotice;
