import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StatusBar,
  TextInput as RNTextInput,
  Image,
  Alert,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector } from '../../store/hooks';
import { useBulletinsRedux } from '../../hooks/useBulletinsRedux';
import { useBulletinValidation } from '../../hooks/useBulletinValidation';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { getPhotoURL } from '../../utils/photoUtils';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { CreateBulletinData, getLabels } from '../../services/bulletinService';
import { getBackendURL } from '../../config/environment';
import { ErrorMessage } from '../../../components/ErrorMessage';
import SuccessPopup from '../../../components/SuccessPopup';
import ErrorPopup from '../../../components/ErrorPopup';
import TextInput from '../../../components/TextInput';
import { OptimizedImage } from '../../components/OptimizedImage';

type RootStackParamList = {
  Login: undefined;
  Dashboard:
  | {
    screen: 'AnnouncementNotice';
    params: { activeTab?: string; announcementId?: number; showPendingBulletins?: boolean };
  }
  | undefined;
  AnnouncementNotice: { activeTab?: string; announcementId?: number; showPendingBulletins?: boolean } | undefined;
  NoticeBoard: undefined;
  CreateBulletin: undefined;
  Info: undefined;
  Services: undefined;
  Feed: undefined;
  Activity: undefined;
};

type CreateBulletinScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CreateBulletin'>;

interface CreateBulletinFormProps {
  onBulletinCreated?: () => void; // Callback to refresh bulletin lists
}

interface Attachment {
  id: string;
  file: string;
  file_name: string;
  file_type: string;
}

interface UserTowerUnit {
  tower_id: number;
  tower_name: string;
  unit_id: number;
  unit_name: string;
}

interface Tower {
  id: number;
  tower_name: string;
  tower_number: number;
}

interface Unit {
  id: number;
  unit_name: string;
  tower_id: number;
  tower_name: string;
}

export default function CreateBulletinForm({ onBulletinCreated }: CreateBulletinFormProps) {
  const navigation = useNavigation<CreateBulletinScreenNavigationProp>();
  const { user, accessToken } = useAppSelector((state) => state.auth);

  // Use the bulletin hook for creating bulletins
  const { createNewBulletin, addBulletinOptimistically } = useBulletinsRedux();

  // Use YUP validation hook
  const {
    errors: validationErrors,
    clearError,
    clearAllErrors,
    validateTitleRealtime,
    validateDescriptionRealtime,
    validateLabelsRealtime,
    validateNewLabel,
    validateAttachments,
    validateForm,
  } = useBulletinValidation();

  // Platform-specific constants
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const isIOS = Platform.OS === 'ios';
  const isAndroid = Platform.OS === 'android';

  // Responsive constants
  const isSmallScreen = screenHeight < 700;
  const isMediumScreen = screenHeight >= 700 && screenHeight < 800;
  const isLargeScreen = screenHeight >= 800;

  // Responsive padding and spacing
  const getResponsiveSpacing = () => ({
    formPadding: isSmallScreen ? 16 : 24,
    sectionMargin: isSmallScreen ? 16 : 24,
    buttonPadding: isSmallScreen ? 14 : 16,
    inputPadding: isSmallScreen ? 12 : 16,
  });

  const responsiveSpacing = getResponsiveSpacing();

  // Form state
  const [creatorName, setCreatorName] = useState(user?.full_name || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [priority, setPriority] = useState<'urgent' | 'high' | 'normal' | 'low'>('normal'); // Default priority
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]); // Selected labels array

  // Label management state
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [isLoadingLabels, setIsLoadingLabels] = useState(false);
  const [labelSearch, setLabelSearch] = useState('');
  const [showCreateLabel, setShowCreateLabel] = useState(false);
  const [newLabelText, setNewLabelText] = useState('');
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);

  // Error state (now using YUP validation)
  const [generalError, setGeneralError] = useState('');

  // User tower and unit state (kept for pre-selection logic)
  const [userTowerUnit, setUserTowerUnit] = useState<UserTowerUnit | null>(null);
  const [isLoadingTowerUnit, setIsLoadingTowerUnit] = useState(true);

  // Tower and Unit selection state
  const [towers, setTowers] = useState<Tower[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedTowerIds, setSelectedTowerIds] = useState<number[]>([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([]);
  const [isLoadingTowers, setIsLoadingTowers] = useState(false);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);

  // Cache for fetched units to prevent redundant API calls
  const [cachedTowerIds, setCachedTowerIds] = useState<string>('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingAttachment, setIsProcessingAttachment] = useState(false);
  const [showTowerDropdown, setShowTowerDropdown] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [errorPopupMessage, setErrorPopupMessage] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Refs for TextInputs
  const descriptionInputRef = useRef<RNTextInput>(null);

  // Ref to track when we need to validate after attachment removal
  const shouldValidateAttachments = useRef(false);

  // Ref to always have the latest attachments state
  const attachmentsRef = useRef<Attachment[]>(attachments);

  // Keyboard dismissal handler
  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
    // Also blur any focused inputs
    descriptionInputRef.current?.blur();
  }, []);

  // Platform-specific styles
  const getPlatformStyles = () => ({
    inputPadding: isIOS ? 16 : 14,
    buttonPadding: isIOS ? 16 : 14,
    borderRadius: isIOS ? 10 : 8,
    shadowColor: isIOS ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.3)',
    shadowOffset: isIOS ? { width: 0, height: 2 } : { width: 0, height: 1 },
    shadowOpacity: isIOS ? 0.1 : 0.3,
    shadowRadius: isIOS ? 8 : 4,
    elevation: isAndroid ? 4 : 0,
  });

  const platformStyles = getPlatformStyles();

  // Font fallback system
  const getFontFamily = (fontName: string) => {
    const fontMap: Record<string, string> = {
      'Oxanium-Regular': 'Oxanium-Regular',
      'Oxanium-Medium': 'Oxanium-Medium',
      'Oxanium-SemiBold': 'Oxanium-SemiBold',
      'Oxanium-Bold': 'Oxanium-Bold',
    };

    // Return the mapped font or fallback to system font
    return fontMap[fontName] || (isIOS ? 'System' : 'sans-serif');
  };

  // Fetch available labels from API
  const fetchLabels = useCallback(async () => {
    try {
      setIsLoadingLabels(true);
      console.log('🏷️ Fetching labels...');
      const labels = await getLabels(accessToken || undefined);
      setAvailableLabels(labels);
      console.log('✅ Labels fetched:', labels);
    } catch (error) {
      console.error('❌ Error fetching labels:', error);
    } finally {
      setIsLoadingLabels(false);
    }
  }, [accessToken]);

  // Handle label selection/deselection
  const handleLabelToggle = useCallback(
    async (labelName: string) => {
      setSelectedLabels((prev) => {
        if (prev.includes(labelName)) {
          // Remove label if already selected
          const newLabels = prev.filter((label) => label !== labelName);
          validateLabelsRealtime(newLabels);
          return newLabels;
        } else {
          // Check if we're at the limit before adding
          if (prev.length >= MAX_LABELS) {
            return prev; // Don't add the label
          }
          const newLabels = [...prev, labelName];
          validateLabelsRealtime(newLabels);
          return newLabels;
        }
      });

      // Clear general errors when user interacts with form
      if (generalError) setGeneralError('');
    },
    [generalError, validateLabelsRealtime]
  );

  // Handle adding new label
  const handleAddNewLabel = useCallback(async () => {
    const trimmedLabel = newLabelText.trim();
    if (!trimmedLabel) return;

    // Validate new label using YUP
    const validation = await validateNewLabel(trimmedLabel);
    if (!validation.isValid) {
      return; // Error is handled by YUP validation
    }

    // Check if we're at the label selection limit
    if (selectedLabels.length >= MAX_LABELS) {
      return;
    }

    // Check if label already exists
    if (availableLabels.includes(trimmedLabel)) {
      // If exists, just select it (if not already selected)
      if (!selectedLabels.includes(trimmedLabel)) {
        const newLabels = [...selectedLabels, trimmedLabel];
        setSelectedLabels(newLabels);
        validateLabelsRealtime(newLabels);
      }
    } else {
      // Add to available labels and select it
      setAvailableLabels((prev) => [...prev, trimmedLabel]);
      const newLabels = [...selectedLabels, trimmedLabel];
      setSelectedLabels(newLabels);
      validateLabelsRealtime(newLabels);
    }

    // Reset state
    setNewLabelText('');
    setShowCreateLabel(false);

    // Clear general errors when user interacts with form
    if (generalError) setGeneralError('');
  }, [
    newLabelText,
    availableLabels,
    selectedLabels,
    generalError,
    validateNewLabel,
    validateLabelsRealtime,
  ]);

  // Filter labels based on search
  const filteredLabels = availableLabels.filter((label) =>
    label.toLowerCase().includes(labelSearch.toLowerCase())
  );

  // Remove selected label
  const handleRemoveSelectedLabel = useCallback(
    async (labelToRemove: string) => {
      const newLabels = selectedLabels.filter((label) => label !== labelToRemove);
      setSelectedLabels(newLabels);
      validateLabelsRealtime(newLabels);
    },
    [selectedLabels, validateLabelsRealtime]
  );

  // Fetch all towers using the towers endpoint
  const fetchTowers = useCallback(async () => {
    try {
      setIsLoadingTowers(true);
      console.log('🔍 Fetching towers from:', `${getBackendURL()}/towers/community_towers/`);
      console.log('🔍 Using access token:', accessToken ? 'Present' : 'Missing');

      const response = await fetch(`${getBackendURL()}/towers/community_towers/`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      console.log('🔍 Response status:', response.status);
      console.log('🔍 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch towers:', response.status, errorText);
        return;
      }

      const data = await response.json();
      console.log('🔍 Towers data received:', data);
      setTowers(data);
    } catch (error) {
      console.error('Error fetching towers:', error);
    } finally {
      setIsLoadingTowers(false);
    }
  }, [accessToken]);

  // Fetch units based on selected towers
  const fetchUnits = useCallback(
    async (towerIds: number[]) => {
      try {
        if (towerIds.length === 0) {
          setUnits([]);
          setCachedTowerIds('');
          return;
        }

        // Check if we already have units for these towers (cache check)
        const towerIdsKey = towerIds.sort().join(',');
        if (towerIdsKey === cachedTowerIds && units.length > 0) {
          console.log('✅ Using cached units for towers:', towerIdsKey);
          return; // Use cached data
        }

        setIsLoadingUnits(true);

        // Use the community units endpoint with tower filtering
        const towerIdsParam = towerIds.join(',');
        console.log('🔍 Fetching units for towers:', towerIdsParam);
        console.log(
          '🔍 From URL:',
          `${getBackendURL()}/towers/community_units/?tower_ids=${towerIdsParam}`
        );

        const response = await fetch(
          `${getBackendURL()}/towers/community_units/?tower_ids=${towerIdsParam}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
          }
        );

        console.log('🔍 Units response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to fetch units:', response.status, errorText);
          return;
        }

        const data = await response.json();
        console.log('🔍 Units data received:', data);
        setUnits(data);
        setCachedTowerIds(towerIdsKey); // Cache the tower IDs
      } catch (error) {
        console.error('Error fetching units:', error);
      } finally {
        setIsLoadingUnits(false);
      }
    },
    [accessToken, cachedTowerIds, units.length]
  );

  // Handle tower selection
  const handleTowerSelection = useCallback(
    (towerId: number) => {
      let newSelectedTowerIds: number[];

      if (selectedTowerIds.includes(towerId)) {
        // Remove tower if already selected
        newSelectedTowerIds = selectedTowerIds.filter((id) => id !== towerId);
      } else {
        // Add tower if not selected
        newSelectedTowerIds = [...selectedTowerIds, towerId];
      }

      setSelectedTowerIds(newSelectedTowerIds);

      // Clear unit selection when towers change
      setSelectedUnitIds([]);

      // Clear general errors when user interacts with form
      if (generalError) setGeneralError('');

      // Clear units if no towers selected
      if (newSelectedTowerIds.length === 0) {
        setUnits([]);
        setCachedTowerIds('');
      }
    },
    [selectedTowerIds, generalError]
  );

  // Handle select all towers
  const handleSelectAllTowers = useCallback(() => {
    if (selectedTowerIds.length === towers.length) {
      // If all are selected, deselect all
      setSelectedTowerIds([]);
      setUnits([]);
      setCachedTowerIds('');
    } else {
      // Select all towers
      const allTowerIds = towers.map((tower) => tower.id);
      setSelectedTowerIds(allTowerIds);
    }

    // Clear unit selection when towers change
    setSelectedUnitIds([]);

    // Clear general errors when user interacts with form
    if (generalError) setGeneralError('');
  }, [selectedTowerIds, towers, generalError]);

  // Handle select all units
  const handleSelectAllUnits = useCallback(() => {
    if (selectedUnitIds.length === units.length) {
      // If all are selected, deselect all
      setSelectedUnitIds([]);
    } else {
      // Select all units
      const allUnitIds = units.map((unit) => unit.id);
      setSelectedUnitIds(allUnitIds);
    }

    // Clear general errors when user interacts with form
    if (generalError) setGeneralError('');
  }, [selectedUnitIds, units, generalError]);

  // Handle unit selection
  const handleUnitSelection = useCallback(
    (unitId: number) => {
      if (selectedUnitIds.includes(unitId)) {
        setSelectedUnitIds(selectedUnitIds.filter((id) => id !== unitId));
      } else {
        setSelectedUnitIds([...selectedUnitIds, unitId]);
      }

      // Clear general errors when user interacts with form
      if (generalError) setGeneralError('');
    },
    [selectedUnitIds, generalError]
  );

  // Keep dropdowns open until user clicks Done button
  // Removed auto-close logic

  // Close dropdowns when form is submitted
  useEffect(() => {
    if (isSubmitting) {
      setShowTowerDropdown(false);
      setShowUnitDropdown(false);
      setShowPriorityDropdown(false);
    }
  }, [isSubmitting]);

  // Handle priority dropdown state changes
  useEffect(() => {
    if (!showPriorityDropdown) {
      // When priority dropdown closes, ensure description input doesn't get refocused
      setTimeout(() => {
        descriptionInputRef.current?.blur();
      }, 100);
    }
  }, [showPriorityDropdown]);

  // Fetch user's tower and unit information
  useEffect(() => {
    const fetchUserTowerUnit = async () => {
      try {
        if (!accessToken) {
          console.error('No access token available');
          setIsLoadingTowerUnit(false);
          return;
        }

        const response = await fetch(`${getBackendURL()}/user/user_tower_unit/`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch user tower/unit info');
          return;
        }

        const data = await response.json();
        setUserTowerUnit(data);
      } catch (error) {
        console.error('Error fetching user tower/unit info:', error);
      } finally {
        setIsLoadingTowerUnit(false);
      }
    };

    if (user && accessToken) {
      fetchUserTowerUnit();
    } else if (!accessToken) {
      setIsLoadingTowerUnit(false);
    }
  }, [user, accessToken]);

  // Fetch towers on component mount
  useEffect(() => {
    if (accessToken) {
      fetchTowers();
    }
  }, [accessToken, fetchTowers]);

  // Fetch labels on component mount
  useEffect(() => {
    if (accessToken) {
      fetchLabels();
    }
  }, [accessToken, fetchLabels]);

  // Fetch units when selected towers change
  useEffect(() => {
    if (selectedTowerIds.length > 0) {
      fetchUnits(selectedTowerIds);
    } else {
      setUnits([]);
      setSelectedUnitIds([]);
      setCachedTowerIds('');
    }
  }, [selectedTowerIds, fetchUnits]);

  // Keyboard visibility detection with height
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        setIsKeyboardVisible(true);
        setKeyboardHeight(event.endCoordinates.height);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  // Don't auto-select user's tower and unit - keep initially empty
  // Removed auto-selection logic

  // Keep ref in sync with state
  useEffect(() => {
    attachmentsRef.current = attachments;
    console.log('🔍 Attachments ref updated:', attachments.length, attachments);
  }, [attachments]);

  // Validate attachments after removal
  useEffect(() => {
    if (shouldValidateAttachments.current && attachments.length >= 0) {
      shouldValidateAttachments.current = false;
      console.log('🔍 Validating attachments after removal...');
      validateAttachments(attachments);
    }
  }, [attachments, validateAttachments]);

  const handleTakePhoto = async () => {
    try {
      // Clear previous attachment errors
      clearError('attachments');

      // Check attachment count limit
      if (attachments.length >= MAX_ATTACHMENTS) {
        setErrorPopupMessage(`Maximum ${MAX_ATTACHMENTS} attachments allowed.`);
        setShowErrorPopup(true);
        return;
      }

      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert(
          'Permission Required',
          'Camera permission is required to take photos. Note: Full functionality requires a development build instead of Expo Go.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newAttachment: Attachment = {
          id: Date.now().toString(),
          file: result.assets[0].uri,
          file_name: `Photo_${Date.now()}.jpg`,
          file_type: 'image/jpeg',
        };

        // Validate total size with new attachment
        const newAttachmentSize = await getFileSize(newAttachment.file);
        const currentTotalSize = await calculateTotalSize(attachments);
        const newTotalSize = currentTotalSize + newAttachmentSize;

        if (newTotalSize > MAX_TOTAL_SIZE_BYTES) {
          const currentSizeFormatted = formatFileSize(currentTotalSize);
          const newAttachmentSizeFormatted = formatFileSize(newAttachmentSize);
          setErrorPopupMessage(
            `Total attachment size would exceed ${MAX_TOTAL_SIZE_MB}MB limit. Current: ${currentSizeFormatted}, New photo: ${newAttachmentSizeFormatted}`
          );
          setShowErrorPopup(true);
          return;
        }

        const newAttachments = [...attachments, newAttachment];
        setAttachments(newAttachments);
        await validateAttachments(newAttachments);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handleChooseFromLibrary = async () => {
    try {
      // Clear previous attachment errors
      clearError('attachments');

      // Check attachment count limit
      if (attachments.length >= MAX_ATTACHMENTS) {
        setErrorPopupMessage(`Maximum ${MAX_ATTACHMENTS} attachments allowed.`);
        setShowErrorPopup(true);
        return;
      }

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert(
          'Permission Required',
          'Photo library permission is required. Note: Full functionality requires a development build instead of Expo Go.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets) {
        // Calculate how many attachments we can add
        const availableSlots = MAX_ATTACHMENTS - attachments.length;
        const assetsToAdd = result.assets.slice(0, availableSlots);

        if (result.assets.length > availableSlots) {
          setErrorPopupMessage(
            `You can only add ${availableSlots} more attachment(s). Selected ${result.assets.length}, but only ${availableSlots} will be added.`
          );
          setShowErrorPopup(true);
        }

        const newAttachments: Attachment[] = assetsToAdd.map((asset, index) => ({
          id: Date.now().toString() + index,
          file: asset.uri,
          file_name: asset.fileName || `File_${Date.now()}_${index}`,
          file_type: asset.type || 'image/jpeg',
        }));

        // Validate total size with new attachments
        let newAttachmentsSize = 0;
        for (const attachment of newAttachments) {
          newAttachmentsSize += await getFileSize(attachment.file);
        }

        const currentTotalSize = await calculateTotalSize(attachments);
        const newTotalSize = currentTotalSize + newAttachmentsSize;

        if (newTotalSize > MAX_TOTAL_SIZE_BYTES) {
          const currentSizeFormatted = formatFileSize(currentTotalSize);
          const newAttachmentsSizeFormatted = formatFileSize(newAttachmentsSize);
          setErrorPopupMessage(
            `Total attachment size would exceed ${MAX_TOTAL_SIZE_MB}MB limit. Current: ${currentSizeFormatted}, New files: ${newAttachmentsSizeFormatted}`
          );
          setShowErrorPopup(true);
          return;
        }

        const updatedAttachments = [...attachments, ...newAttachments];
        setAttachments(updatedAttachments);
        await validateAttachments(updatedAttachments);
      }
    } catch (error) {
      console.error('Error choosing from library:', error);
      Alert.alert('Error', 'Failed to choose from library');
    }
  };

  // Validation constants
  const TITLE_MAX_WORDS = 10;
  const DESCRIPTION_MAX_WORDS = 100;
  const MAX_ATTACHMENTS = 5;
  const MAX_TOTAL_SIZE_MB = 5;
  const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024; // 5MB in bytes
  const MAX_LABELS = 5;
  const MAX_LABEL_WORDS = 5;

  // Helper to count words
  const countWords = (text: string): number => {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  };

  // Helper function to get file size
  const getFileSize = async (uri: string): Promise<number> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return blob.size;
    } catch (error) {
      console.warn('Could not get file size for:', uri);
      return 0;
    }
  };

  // Helper function to calculate total attachment size
  const calculateTotalSize = async (attachmentList: Attachment[]): Promise<number> => {
    let totalSize = 0;
    for (const attachment of attachmentList) {
      const size = await getFileSize(attachment.file);
      totalSize += size;
    }
    return totalSize;
  };

  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const removeAttachment = useCallback((attachmentId: string) => {
    console.log('🗑️ Removing attachment:', attachmentId);

    // Mark as processing to prevent premature submission
    setIsProcessingAttachment(true);

    // Use functional update to avoid stale closure issues
    setAttachments((prevAttachments) => {
      const newAttachments = prevAttachments.filter((att) => att.id !== attachmentId);
      console.log('🗑️ New attachments after removal:', newAttachments);
      console.log('🗑️ Filtered count:', newAttachments.length);

      // Mark that we need to validate after this state update
      shouldValidateAttachments.current = true;

      return newAttachments;
    });

    clearError('attachments');

    // Allow submission after state settles
    setTimeout(() => {
      setIsProcessingAttachment(false);
    }, 100);
  }, [clearError]);

  const handleSubmit = async () => {
    // Prevent submission if attachments are being processed
    if (isProcessingAttachment) {
      console.log('⏳ Waiting for attachment processing to complete...');
      return;
    }

    // Clear previous errors
    clearAllErrors();
    setGeneralError('');

    // Check if user is authenticated
    if (!accessToken) {
      setGeneralError('Please log in to create bulletins.');
      return;
    }

    // Wait for state to settle
    await new Promise(resolve => setTimeout(resolve, 150));

    // Read from ref to get the LATEST state (not stale closure)
    const currentAttachments = attachmentsRef.current;

    console.log('📤 Reading from ref (latest state):');
    console.log('📤 Current attachments:', currentAttachments.length, currentAttachments);

    // Prepare form data for validation using ref value
    const formData = {
      title,
      description,
      priority,
      selectedLabels,
      attachments: currentAttachments,
      target_tower_ids: selectedTowerIds,
      target_unit_ids: selectedUnitIds,
    };

    // Validate entire form using YUP
    const validation = await validateForm(formData);
    if (!validation.isValid) {
      return; // Errors are handled by YUP validation
    }

    setIsSubmitting(true);

    try {
      // Use ref value for submission data
      const bulletinData: CreateBulletinData = {
        title: title.trim(),
        description: description.trim() || undefined, // Send undefined if empty
        attachments: currentAttachments,
        target_tower_ids: selectedTowerIds,
        target_unit_ids: selectedUnitIds,
        priority: priority, // Use the selected priority
        label: selectedLabels.join(', ') || undefined, // Join selected labels with comma, Send undefined if empty
      };

      // Create optimistic bulletin object for immediate display
      const optimisticBulletin = {
        id: Date.now(), // Temporary ID
        title: bulletinData.title,
        description: bulletinData.description || '',
        creator: { id: Number(user?.id) || 0, full_name: user?.full_name || '' },
        priority: bulletinData.priority || 'normal',
        label: bulletinData.label || '',
        status: 'pending', // New bulletins are pending
        target_towers: [],
        target_units: [],
        attachments: bulletinData.attachments,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Add the bulletin optimistically for immediate display
      addBulletinOptimistically(optimisticBulletin);

      // Use the hook to create the bulletin
      const createdBulletin = await createNewBulletin(bulletinData);

      // Call the refresh callback if provided
      if (onBulletinCreated) {
        onBulletinCreated();
      }

      // Show success popup instead of Alert
      setShowSuccessPopup(true);
    } catch (error) {
      console.error('Error creating bulletin:', error);
      setGeneralError('Failed to create bulletin. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      <SafeAreaView className="flex-1 bg-white">
        {/* Simple Header with Back Button and Title */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: '#f3f4f6',
            backgroundColor: 'white',
            paddingHorizontal: 16,
            paddingVertical: isIOS ? 16 : 12,
          }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mr-4"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={22} color="#3C9D9B" />
          </TouchableOpacity>
          <Text className="flex-1 font-oxanium-bold text-xl">Create Bulletin Post</Text>
        </View>

        {/* Form Content */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0} // Account for header height
          enabled={true}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: responsiveSpacing.formPadding,
              paddingVertical: responsiveSpacing.formPadding,
              paddingBottom: (() => {
                // Calculate dynamic padding based on platform and keyboard state
                const baseBottomPadding = Platform.OS === 'ios' ? 100 : 80;
                const keyboardAdjustment = isKeyboardVisible
                  ? Platform.OS === 'ios'
                    ? Math.max(keyboardHeight * 0.1, 20) // iOS: small adjustment
                    : Math.max(keyboardHeight * 0.2, 40) // Android: more adjustment
                  : 0;

                return baseBottomPadding + keyboardAdjustment;
              })(),
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScrollBeginDrag={dismissKeyboard} // Dismiss keyboard when user starts scrolling
            automaticallyAdjustKeyboardInsets={false} // Let our KeyboardAvoidingView handle it
            nestedScrollEnabled={true}
            scrollEventThrottle={16}
            bounces={true}
            contentInsetAdjustmentBehavior="automatic">
            {/* General Error Message */}
            <ErrorMessage message={generalError} visible={!!generalError} />

            {/* Bulletin Post Author Section */}
            <View style={{ marginBottom: responsiveSpacing.sectionMargin }}>
              <Text className="mb-6 font-lato-bold text-xl text-primary ">
                Bulletin Post Author
              </Text>
              <TextInput
                label="Creator Name"
                required
                value={creatorName}
                onChangeText={setCreatorName}
                placeholder="Enter creator name"
                editable={false}
              />
            </View>

            {/* Bulletin Information Section */}
            <View className="mb-6">
              <Text className="mb-6 font-lato-bold text-xl text-primary ">
                Bulletin Information
              </Text>

              <TextInput
                containerClassName="mb-4"
                label="Title"
                required
                value={title}
                onChangeText={async (text) => {
                  setTitle(text);
                  await validateTitleRealtime(text);
                  if (generalError) setGeneralError('');
                }}
                placeholder="Enter bulletin title"
                error={validationErrors.title}
              />

              <TextInput
                ref={descriptionInputRef}
                label="Description"
                value={description}
                onChangeText={async (text) => {
                  setDescription(text);
                  await validateDescriptionRealtime(text);
                  if (generalError) setGeneralError('');
                }}
                placeholder="Enter bulletin description"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                inputClassName="min-h-[100px] text-top"
                error={validationErrors.description}
              />

              <View className="mt-6">
                <Text className="mb-4 font-lato-semibold text-xl">
                  Priority
                  <Text className="text-primary">*</Text>
                </Text>
                <View className="rounded-md border border-gray-200 bg-gray-50 p-4 text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary">
                  <TouchableOpacity
                    className="flex-row items-center justify-between"
                    onPress={() => {
                      // Dismiss keyboard and blur description input before opening dropdown
                      dismissKeyboard();
                      setShowPriorityDropdown(!showPriorityDropdown);
                    }}>
                    <Text
                      style={{
                        fontFamily: 'Oxanium-Regular',
                        color:
                          priority === 'urgent'
                            ? '#ef4444'
                            : priority === 'high'
                              ? '#f59e0b'
                              : priority === 'normal'
                                ? '#3C9D9B'
                                : '#6b7280',
                        fontSize: 16,
                        textTransform: 'capitalize',
                      }}>
                      {priority}
                    </Text>
                    <Ionicons
                      name={showPriorityDropdown ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="#6b7280"
                    />
                  </TouchableOpacity>
                  {showPriorityDropdown && (
                    <View className="rounded-md border border-gray-200 bg-gray-50 p-4 text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary">
                      {(['low', 'normal', 'high', 'urgent'] as const).map((level) => (
                        <TouchableOpacity
                          key={level}
                          style={{
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            backgroundColor: priority === level ? '#f3f4f6' : 'transparent',
                            borderBottomWidth: level !== 'urgent' ? 1 : 0,
                            borderBottomColor: '#f3f4f6',
                          }}
                          onPress={() => {
                            setPriority(level);
                            if (generalError) setGeneralError('');
                            setShowPriorityDropdown(false);
                          }}
                          activeOpacity={0.7}>
                          <Text
                            style={{
                              fontFamily: 'Oxanium-Regular',
                              fontSize: 16,
                              textTransform: 'capitalize',
                              color:
                                level === 'urgent'
                                  ? '#ef4444'
                                  : level === 'high'
                                    ? '#f59e0b'
                                    : level === 'normal'
                                      ? '#3C9D9B'
                                      : '#6b7280',
                            }}>
                            {level}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Label Section */}
            <View className="mb-6">
              <Text className="mb-6 font-lato-semibold text-xl">
                Labels
                <Text className="text-primary">*</Text>
              </Text>

              {/* Label Error Message */}
              <ErrorMessage
                message={validationErrors.selectedLabels || ''}
                visible={!!validationErrors.selectedLabels}
              />

              {/* Selected Labels Display Box */}
              <View className="mb-4 min-h-12 rounded-md border border-primary bg-gray-50 p-4 text-red-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary">
                {selectedLabels.length > 0 ? (
                  <View className="flex-row flex-wrap gap-2">
                    {selectedLabels.map((label, index) => (
                      <View key={index} className="flex-row items-center rounded-md bg-primary p-2">
                        <Text className="mr-2 font-lato text-sm text-white">{label}</Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveSelectedLabel(label)}
                          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}>
                          <Ionicons name="close" size={16} color="white" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="font-lato text-base text-gray-500">No labels selected</Text>
                )}
              </View>

              {/* Select Labels Dropdown */}
              <TouchableOpacity
                className="mb-4 min-h-12 rounded-md border border-gray-200 bg-gray-50 p-4"
                onPress={() => {
                  dismissKeyboard();
                  setShowLabelDropdown(!showLabelDropdown);
                }}
                activeOpacity={0.7}>
                <View className="flex-row items-center justify-between">
                  <Text className="font-lato text-base text-gray-700">
                    {selectedLabels.length > 0
                      ? `${selectedLabels.length} label(s) selected`
                      : 'Select labels...'}
                  </Text>
                  <Ionicons
                    name={showLabelDropdown ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#6b7280"
                  />
                </View>
              </TouchableOpacity>

              {/* Labels Interface Container - Only shows when dropdown is open */}
              {showLabelDropdown && (
                <View className="mb-4 min-h-12 rounded-md border border-gray-200 bg-gray-50 p-4 text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary">
                  {/* Create New Label Button */}
                  <TouchableOpacity
                    className="flex-row items-center"
                    onPress={() => setShowCreateLabel(!showCreateLabel)}
                    activeOpacity={0.7}>
                    <Ionicons name="add" size={20} color="#3C9D9B" className="mb-4 mr-2" />
                    <Text className="mb-4 font-lato-bold text-base font-semibold text-primary">
                      Create New Label
                    </Text>
                  </TouchableOpacity>

                  {/* Create Label Input - Shows when Create Label is clicked */}
                  {showCreateLabel && (
                    <View className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-4">
                      <RNTextInput
                        className="font-lato mb-4 rounded-md border border-gray-200 bg-gray-50 p-4 text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                        value={newLabelText}
                        onChangeText={async (text) => {
                          setNewLabelText(text);
                          // Real-time validation using YUP
                          if (text.trim()) {
                            const validation = await validateNewLabel(text);
                            if (!validation.isValid) {
                              // Error is handled by YUP validation hook
                            }
                          }
                        }}
                        placeholder="Enter new label name"
                        placeholderTextColor="#9ca3af"
                      />
                      <View className="items-center">
                        <TouchableOpacity
                          className="rounded-md bg-primary px-6 py-3"
                          onPress={handleAddNewLabel}
                          disabled={!newLabelText.trim()}
                          activeOpacity={0.8}>
                          <Text className="font-lato-bold text-lg text-white">Add</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Search Box */}
                  <RNTextInput
                    className="mb-2 mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                    value={labelSearch}
                    onChangeText={setLabelSearch}
                    placeholder="Search labels..."
                    placeholderTextColor="#9ca3af"
                  />

                  {/* Labels List with Checkboxes */}
                  {isLoadingLabels ? (
                    <View className="items-center p-4">
                      <Text className="font-lato text-base text-gray-500">
                        Loading labels...
                      </Text>
                    </View>
                  ) : (
                    <ScrollView
                      style={{ maxHeight: 200 }}
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}>
                      {filteredLabels.length > 0 ? (
                        filteredLabels.map((label, index) => {
                          // Generate a color for each label based on the label name
                          const labelColors = [
                            '#f59e0b',
                            '#ef4444',
                            '#8b5cf6',
                            '#10b981',
                            '#06b6d4',
                            '#f97316',
                          ];
                          const colorIndex = label.length % labelColors.length;
                          const labelColor = labelColors[colorIndex];

                          return (
                            <TouchableOpacity
                              key={index}
                              className="mb-2 flex-row items-center rounded-md border border-gray-200 bg-gray-50 p-2"
                              onPress={() => handleLabelToggle(label)}
                              activeOpacity={0.7}>
                              {/* Checkbox */}
                              <View
                                className={`mr-2 h-6 w-6 items-center justify-center rounded-md border-2 ${selectedLabels.includes(label)
                                    ? 'border-primary bg-primary'
                                    : 'border-gray-300 bg-transparent'
                                  }`}>
                                {selectedLabels.includes(label) && (
                                  <Ionicons name="checkmark" size={14} color="white" />
                                )}
                              </View>

                              {/* Label Text */}
                              <Text className="flex-1 font-lato text-base text-gray-700">
                                {label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })
                      ) : (
                        <Text className="p-4 text-center font-lato text-base text-gray-500">
                          {labelSearch
                            ? 'No labels found matching your search'
                            : 'No labels available'}
                        </Text>
                      )}
                    </ScrollView>
                  )}

                  {/* Done Button */}
                  <View className="mt-2 border-t border-gray-200 pt-6">
                    <TouchableOpacity
                      className="items-center rounded-md bg-primary px-6 py-3"
                      onPress={() => setShowLabelDropdown(false)}
                      activeOpacity={0.8}>
                      <Text className="font-lato-bold text-lg text-white">Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Attachments Section */}
            <View className="mb-6">
              <Text className="mb-3 font-lato-semibold text-xl">Attachments</Text>
              <Text className="mb-4 font-lato text-base text-gray-500">
                Maximum {MAX_ATTACHMENTS} files, total size limit: {MAX_TOTAL_SIZE_MB}MB
              </Text>

              {/* Attachment Error Message */}
              <ErrorMessage
                message={validationErrors.attachments || ''}
                visible={!!validationErrors.attachments}
              />

              {/* Current Attachments */}
              {attachments.length > 0 && (
                <View className="mb-6">
                  <View className="mb-4 flex-row items-center justify-between">
                    <Text className="font-lato text-base text-gray-700">
                      {attachments.length} of {MAX_ATTACHMENTS} files
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap gap-4">
                    {attachments.map((attachment) => (
                      <View key={attachment.id} style={{ position: 'relative', width: 96, height: 96 }}>
                        <OptimizedImage
                          source={{ uri: attachment.file }}
                          resizeMode="cover"
                          showLoadingIndicator={true}
                          loadingIndicatorSize="small"
                          loadingIndicatorColor="#3C9D9B"
                          containerClassName="w-24 h-24 rounded-md border border-primary"
                        />
                        <TouchableOpacity
                          className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs"
                          onPress={() => removeAttachment(attachment.id)}
                          hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}>
                          <Ionicons name="close" size={14} color="white" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Attachment Buttons */}
              <View style={{ gap: 12 }}>
                <TouchableOpacity
                  style={{
                    backgroundColor: attachments.length >= MAX_ATTACHMENTS ? '#9ca3af' : '#3C9D9B',
                    paddingVertical: 16,
                    paddingHorizontal: 24,
                    borderRadius: platformStyles.borderRadius,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...(isAndroid && {
                      elevation:
                        attachments.length >= MAX_ATTACHMENTS ? 0 : platformStyles.elevation,
                    }),
                    ...(isIOS &&
                      attachments.length < MAX_ATTACHMENTS && {
                      shadowColor: platformStyles.shadowColor,
                      shadowOffset: platformStyles.shadowOffset,
                      shadowOpacity: platformStyles.shadowOpacity,
                      shadowRadius: platformStyles.shadowRadius,
                    }),
                  }}
                  onPress={handleTakePhoto}
                  activeOpacity={attachments.length >= MAX_ATTACHMENTS ? 1 : 0.8}
                  disabled={attachments.length >= MAX_ATTACHMENTS}>
                  <Ionicons name="camera" size={20} color="white" className="mr-2" />
                  <Text className="font-lato-bold text-lg text-white">
                    Take Photo ({attachments.length}/{MAX_ATTACHMENTS})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`flex-row items-center justify-center rounded-md border-2 border-dashed px-6 py-4 ${attachments.length >= MAX_ATTACHMENTS
                      ? 'border-gray-400 bg-gray-100'
                      : 'border-primary bg-gray-50'
                    }`}
                  onPress={handleChooseFromLibrary}
                  activeOpacity={attachments.length >= MAX_ATTACHMENTS ? 1 : 0.8}
                  disabled={attachments.length >= MAX_ATTACHMENTS}>
                  <Ionicons
                    name="images"
                    size={20}
                    color={attachments.length >= MAX_ATTACHMENTS ? '#9ca3af' : '#3C9D9B'}
                    className="mr-2"
                  />
                  <Text
                    className={`font-lato-bold text-lg ${attachments.length >= MAX_ATTACHMENTS ? 'text-gray-400' : 'text-primary'
                      }`}>
                    Choose from Library ({attachments.length}/{MAX_ATTACHMENTS})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bulletin Visibility Section */}
            <View className="mb-6">
              <Text className="mb-4 font-lato-bold text-xl">Bulletin Visibility</Text>

              {/* Tower Selection */}
              <View className="mb-6">
                <Text className="mb-4 font-lato text-base">Select Towers</Text>
                {isLoadingTowers ? (
                  <View className="mb-4 min-h-12 rounded-md border border-gray-200 bg-gray-50 p-4 text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary">
                    <Text className="font-lato text-base text-gray-500">Loading towers...</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    className="min-h-12 justify-center rounded-md border border-gray-200 bg-gray-50 p-4"
                    onPress={() => {
                      dismissKeyboard();
                      setShowTowerDropdown(!showTowerDropdown);
                    }}
                    activeOpacity={0.7}>
                    <View className="flex-row items-center justify-between">
                      <Text
                        className={`font-lato text-base ${selectedTowerIds.length === 0 ? 'text-gray-500' : 'text-gray-700'
                          }`}>
                        {selectedTowerIds.length === 0
                          ? 'Select towers'
                          : selectedTowerIds.length === towers.length
                            ? 'All towers selected'
                            : `${selectedTowerIds.length} tower(s) selected`}
                      </Text>
                      <Ionicons
                        name={showTowerDropdown ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="#6b7280"
                      />
                    </View>
                  </TouchableOpacity>
                )}

                {/* Tower Dropdown */}
                {showTowerDropdown && towers.length > 0 && (
                  <View className="mt-1 max-h-72 rounded-md border border-gray-200 bg-white shadow-lg">
                    {/* Header with All Towers Option */}
                    <TouchableOpacity
                      className={`flex-row items-center border-b border-gray-200 px-4 py-3 ${selectedTowerIds.length === towers.length
                          ? 'bg-primary'
                          : 'bg-transparent'
                        }`}
                      onPress={() => handleSelectAllTowers()}
                      activeOpacity={0.7}>
                      <View
                        className={`mr-3 h-5 w-5 items-center justify-center rounded-full border-2 ${selectedTowerIds.length === towers.length
                            ? 'border-white bg-white'
                            : 'border-primary bg-transparent'
                          }`}>
                        {selectedTowerIds.length === towers.length && (
                          <View className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </View>
                      <Text
                        className={`font-lato text-base font-semibold ${selectedTowerIds.length === towers.length
                            ? 'text-white'
                            : 'text-gray-700'
                          }`}>
                        All Towers
                      </Text>
                    </TouchableOpacity>

                    {/* Virtualized Tower List */}
                    <FlatList
                      data={towers}
                      keyExtractor={(item) => item.id.toString()}
                      style={{ maxHeight: 200 }}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                      initialNumToRender={20}
                      maxToRenderPerBatch={20}
                      windowSize={10}
                      removeClippedSubviews={Platform.OS === 'android'}
                      updateCellsBatchingPeriod={50}
                      renderItem={({ item: tower }) => (
                        <TouchableOpacity
                          className={`flex-row items-center border-b border-gray-200 px-4 py-3 ${selectedTowerIds.includes(tower.id) ? 'bg-primary' : 'bg-transparent'
                            }`}
                          onPress={() => handleTowerSelection(tower.id)}
                          activeOpacity={0.7}>
                          <View
                            className={`mr-3 h-5 w-5 items-center justify-center rounded-full border-2 ${selectedTowerIds.includes(tower.id)
                                ? 'border-white bg-white'
                                : 'border-primary bg-transparent'
                              }`}>
                            {selectedTowerIds.includes(tower.id) && (
                              <View className="h-2 w-2 rounded-full bg-primary" />
                            )}
                          </View>
                          <Text
                            className={`flex-1 font-lato text-base ${selectedTowerIds.includes(tower.id) ? 'text-white' : 'text-gray-700'
                              }`}>
                            {tower.tower_name}
                          </Text>
                        </TouchableOpacity>
                      )}
                    />

                    {/* Done Button */}
                    <View className="border-t border-gray-200 px-4 py-3">
                      <TouchableOpacity
                        className="items-center rounded-md bg-primary px-6 py-3"
                        onPress={() => setShowTowerDropdown(false)}
                        activeOpacity={0.8}>
                        <Text className="font-lato-bold text-lg text-white">Done</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* Unit Selection */}
              <View className="mb-4">
                <Text className="mb-1 font-lato text-base">Select Units</Text>
                {isLoadingUnits ? (
                  <View className="items-center rounded-md border border-gray-200 bg-gray-50 p-4">
                    <Text className="font-lato text-base text-gray-500">Loading units...</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    className={`min-h-12 justify-center rounded-md border border-gray-200 p-4 ${selectedTowerIds.length === 0 ? 'bg-gray-100' : 'bg-gray-50'
                      }`}
                    onPress={() => {
                      if (selectedTowerIds.length > 0) {
                        dismissKeyboard();
                        setShowUnitDropdown(!showUnitDropdown);
                      }
                    }}
                    activeOpacity={selectedTowerIds.length === 0 ? 1 : 0.7}
                    disabled={selectedTowerIds.length === 0}>
                    <View className="flex-row items-center justify-between">
                      <Text
                        className={`font-lato text-base ${selectedTowerIds.length === 0 ? 'text-gray-400' : 'text-gray-700'
                          }`}>
                        {selectedTowerIds.length === 0
                          ? 'Please select towers first'
                          : selectedUnitIds.length === 0
                            ? 'Select units'
                            : selectedUnitIds.length === units.length && units.length > 0
                              ? 'All units selected'
                              : `${selectedUnitIds.length} unit(s) selected`}
                      </Text>
                      {selectedTowerIds.length > 0 && (
                        <Ionicons
                          name={showUnitDropdown ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#6b7280"
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                )}

                {/* Unit Dropdown */}
                {showUnitDropdown && selectedTowerIds.length > 0 && units.length > 0 && (
                  <View className="mt-1 max-h-72 rounded-md border border-gray-200 bg-white shadow-lg">
                    {/* Header with All Units Option */}
                    <TouchableOpacity
                      className={`flex-row items-center border-b border-gray-200 px-4 py-3 ${selectedUnitIds.length === units.length ? 'bg-primary' : 'bg-transparent'
                        }`}
                      onPress={() => handleSelectAllUnits()}
                      activeOpacity={0.7}>
                      <View
                        className={`mr-3 h-5 w-5 items-center justify-center rounded-full border-2 ${selectedUnitIds.length === units.length
                            ? 'border-white bg-white'
                            : 'border-primary bg-transparent'
                          }`}>
                        {selectedUnitIds.length === units.length && (
                          <View className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </View>
                      <Text
                        className={`font-lato text-base font-semibold ${selectedUnitIds.length === units.length ? 'text-white' : 'text-gray-700'
                          }`}>
                        All Units
                      </Text>
                    </TouchableOpacity>

                    {/* Virtualized Unit List */}
                    <FlatList
                      data={units}
                      keyExtractor={(item) => item.id.toString()}
                      style={{ maxHeight: 200 }}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                      initialNumToRender={20}
                      maxToRenderPerBatch={20}
                      windowSize={10}
                      removeClippedSubviews={Platform.OS === 'android'}
                      updateCellsBatchingPeriod={50}
                      renderItem={({ item: unit }) => (
                        <TouchableOpacity
                          className={`flex-row items-center border-b border-gray-200 px-4 py-3 ${selectedUnitIds.includes(unit.id) ? 'bg-primary' : 'bg-transparent'
                            }`}
                          onPress={() => handleUnitSelection(unit.id)}
                          activeOpacity={0.7}>
                          <View
                            className={`mr-3 h-5 w-5 items-center justify-center rounded-full border-2 ${selectedUnitIds.includes(unit.id)
                                ? 'border-white bg-white'
                                : 'border-primary bg-transparent'
                              }`}>
                            {selectedUnitIds.includes(unit.id) && (
                              <View className="h-2 w-2 rounded-full bg-primary" />
                            )}
                          </View>
                          <Text
                            className={`flex-1 font-lato text-base ${selectedUnitIds.includes(unit.id) ? 'text-white' : 'text-gray-700'
                              }`}>
                            {unit.unit_name} - {unit.tower_name}
                          </Text>
                        </TouchableOpacity>
                      )}
                    />

                    {/* Done Button */}
                    <View className="border-t border-gray-200 px-4 py-3 pt-3">
                      <TouchableOpacity
                        className="items-center rounded-md bg-primary px-6 py-3"
                        onPress={() => setShowUnitDropdown(false)}
                        activeOpacity={0.8}>
                        <Text className="font-lato-bold text-lg text-white">Done</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              <Text className="mt-2 font-lato text-base text-gray-500">
                {/* {selectedTowerIds.length > 0 || selectedUnitIds.length > 0 
                                ? 'This bulletin will be visible to members in the selected towers and units.'
                                : 'This bulletin will be visible to all community members. Select specific towers or units to limit visibility.'
                            } */}
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Send Button - Fixed at bottom with keyboard awareness */}
        <View
          className="border-t border-gray-200 bg-white shadow-lg"
          style={{
            position: 'absolute',
            bottom: isKeyboardVisible && Platform.OS === 'android'
              ? Math.max(keyboardHeight - 50, 0)
              : 0,
            left: 0,
            right: 0,
            zIndex: 50,
            paddingHorizontal: responsiveSpacing.formPadding,
            paddingVertical: isSmallScreen ? 12 : 16,
            paddingBottom: (() => {
              if (isKeyboardVisible) {
                return Platform.OS === 'ios'
                  ? (isSmallScreen ? 16 : 20)
                  : (isSmallScreen ? 12 : 16);
              }
              return Platform.OS === 'ios'
                ? (isSmallScreen ? 24 : 32)
                : (isSmallScreen ? 16 : 20);
            })(),
            // Add subtle elevation/shadow
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
              },
              android: {
                elevation: 8,
              },
            }),
          }}>
          <TouchableOpacity
            className={`rounded-md py-5 px-6 ${isSubmitting || isProcessingAttachment || !accessToken ? 'bg-gray-400' : 'bg-primary'
              }`}
            onPress={handleSubmit}
            disabled={isSubmitting || isProcessingAttachment || !accessToken}
            activeOpacity={0.8}
            style={{
              // Add shadow to button itself
              ...Platform.select({
                ios: {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                },
                android: {
                  elevation: 4,
                },
              }),
            }}>
            <Text
              className={`text-center font-lato-bold text-white ${isSmallScreen ? 'text-base' : 'text-lg'
                }`}>
              {isSubmitting ? 'Creating...' : isProcessingAttachment ? 'Processing...' : 'Send'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Success Popup */}
      <SuccessPopup
        visible={showSuccessPopup}
        onClose={() => {
          setShowSuccessPopup(false);
          // Navigate back to Dashboard (BottomTabNavigator) and then to AnnouncementNotice tab with params
          navigation.navigate('Dashboard', {
            screen: 'AnnouncementNotice',
            params: {
              activeTab: 'bulletin',
              showPendingBulletins: true
            }
          });
        }}
        title="Congratulations!"
        message="Thanks for your Bulletin post! It's been submitted to admins for approval."
        buttonText="OK"
      />

      {/* Error Popup */}
      <ErrorPopup
        visible={showErrorPopup}
        onClose={() => setShowErrorPopup(false)}
        title="Attachment Error"
        message={errorPopupMessage}
        buttonText="OK"
      />
    </View>
  );
}
