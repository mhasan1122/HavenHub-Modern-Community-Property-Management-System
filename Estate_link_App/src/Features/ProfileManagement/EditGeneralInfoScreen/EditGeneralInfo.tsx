import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
  Image,
  Platform,
  ActionSheetIOS,
  TouchableWithoutFeedback,
  Modal,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useProfile } from '../../../hooks/useProfile';
import { getPhotoURL } from '../../../utils/photoUtils';
import SuccessPopup from '../../../../components/SuccessPopup';
import { ErrorMessage } from '../../../../components/ErrorMessage';
import { Button } from '../../../components/Button';
import { editGeneralInfoSchema } from '../../../validation/schemas';
import { useAppDispatch } from '../../../store/hooks';
import { updateUserData } from '../../../store/slices/authSlice';

type RootStackParamList = {
  ProfileManagementSettings: undefined;
  ProfileManagement: undefined;
};

type EditGeneralInfoNavigationProp = StackNavigationProp<RootStackParamList, 'ProfileManagementSettings'>;

interface FormData {
  fullName: string;
  email: string;
  contactNumber: string;
  nidNumber: string;
  permanentAddress: string;
  presentAddress: string;
  gender: 'Male' | 'Female' | 'Others';
  dateOfBirth: string;
  occupation: string;
  maritalStatus: string;
  religion: string;
  nidFront?: File | { uri: string; type: string; name: string } | null;
  nidBack?: File | { uri: string; type: string; name: string } | null;
  nidFrontUri?: string;
  nidBackUri?: string;
}

export function EditGeneralInfo() {
  const navigation = useNavigation<EditGeneralInfoNavigationProp>();
  const dispatch = useAppDispatch();
  const { profile, loading, updateUserProfile, refetchProfile } = useProfile();
  const [updating, setUpdating] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [isFormInitialized, setIsFormInitialized] = useState(false);
  const [showMaritalStatusDropdown, setShowMaritalStatusDropdown] = useState(false);
  const [showReligionDropdown, setShowReligionDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [initialFormData, setInitialFormData] = useState<FormData | null>(null);

  // Dropdown options
  const maritalStatusOptions = ['', 'Single', 'Married', 'Divorced', 'Widowed'];
  const religionOptions = ['', 'Islam', 'Christianity', 'Hinduism', 'Buddhism', 'Judaism', 'Other'];

  // Form data initialized from profile
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    contactNumber: '',
    nidNumber: '',
    permanentAddress: '',
    presentAddress: '',
    gender: 'Male',
    dateOfBirth: '', 
    occupation: '',
    maritalStatus: '',
    religion: '',
    nidFront: null,
    nidBack: null,
    nidFrontUri: '',
    nidBackUri: '',
  });

  // Debug logging for form data
  console.log('📝 EditGeneralInfo render - formData:', formData);
  console.log('📝 EditGeneralInfo render - isFormInitialized:', isFormInitialized);

  // Ensure profile data is fetched when component mounts
  useEffect(() => {
    if (!profile && !loading) {
      // Call refetchProfile asynchronously (no need to await in useEffect)
      refetchProfile().catch(error => {
        console.error('❌ EditGeneralInfo profile fetch failed:', error);
      });
    }
  }, []);

  // Load profile data when it becomes available (only once)
  useEffect(() => {
    if (profile && !isFormInitialized) {
      console.log('📝 Initializing form with profile data:', profile);
      console.log('📝 Profile NID number:', profile.nid_number, 'Type:', typeof profile.nid_number);
      
      // Handle NID number properly - ensure it's a string
      const nidValue = profile.nid_number !== null && profile.nid_number !== undefined ? 
        String(profile.nid_number) : '';
      console.log('📝 NID value for form:', nidValue);
      
      const dateOfBirth = profile.date_of_birth || '';
      
      const newFormData = {
        fullName: profile.full_name || '',
        email: profile.general_email || '',
        contactNumber: profile.general_contact || '',
        nidNumber: nidValue,
        permanentAddress: profile.permanent_address || '',
        presentAddress: profile.present_address || '',
        gender: (profile.gender as 'Male' | 'Female' | 'Others') || 'Male',
        dateOfBirth: dateOfBirth,
        occupation: profile.occupation || '',
        maritalStatus: profile.marital_status || '',
        religion: profile.religion || '',
        nidFront: null,
        nidBack: null,
        nidFrontUri: profile.nid_front ? getPhotoURL(profile.nid_front) || '' : '',
        nidBackUri: profile.nid_back ? getPhotoURL(profile.nid_back) || '' : '',
      };
      
      // Set the selected date for the date picker
      if (dateOfBirth) {
        setSelectedDate(parseDateFromString(dateOfBirth));
      }
      
      console.log('📝 Setting form data with NID:', newFormData.nidNumber);
      setFormData(newFormData);
      setInitialFormData(newFormData); // Store initial data for comparison
      setIsFormInitialized(true);
      console.log('📝 Form initialized successfully');
    }
  }, [profile, isFormInitialized]);

  // Removed the useEffect that was causing issues with empty NID values
  // The form should only be initialized once and then allow free editing

  // Function to check if form has been modified
  const hasFormChanged = (): boolean => {
    if (!initialFormData) return false;
    
    // Compare all text fields
    const textFieldsChanged = 
      formData.fullName !== initialFormData.fullName ||
      formData.email !== initialFormData.email ||
      formData.contactNumber !== initialFormData.contactNumber ||
      formData.nidNumber !== initialFormData.nidNumber ||
      formData.permanentAddress !== initialFormData.permanentAddress ||
      formData.presentAddress !== initialFormData.presentAddress ||
      formData.gender !== initialFormData.gender ||
      formData.dateOfBirth !== initialFormData.dateOfBirth ||
      formData.occupation !== initialFormData.occupation ||
      formData.maritalStatus !== initialFormData.maritalStatus ||
      formData.religion !== initialFormData.religion;
    
    // Check if new images have been selected
    const imagesChanged = formData.nidFront !== null || formData.nidBack !== null;
    
    return textFieldsChanged || imagesChanged;
  };

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleMaritalStatusSelect = (status: string) => {
    updateFormData('maritalStatus', status);
    setShowMaritalStatusDropdown(false);
    // Clear validation error for marital status
    if (validationErrors.maritalStatus) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.maritalStatus;
        return newErrors;
      });
    }
  };

  const handleReligionSelect = (religion: string) => {
    updateFormData('religion', religion);
    setShowReligionDropdown(false);
    // Clear validation error for religion
    if (validationErrors.religion) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.religion;
        return newErrors;
      });
    }
  };

  const closeAllDropdowns = () => {
    setShowMaritalStatusDropdown(false);
    setShowReligionDropdown(false);
  };

  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return '';
    // If it's already in DD-MMM-YYYY format, return as is
    if (dateString.match(/^\d{2}-[A-Za-z]{3}-\d{4}$/)) {
      return dateString;
    }
    // Try to parse and format the date
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      // Format date to DD-MMM-YYYY with 3-letter month abbreviations
      const day = date.getDate().toString().padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return dateString;
    }
  };

  const parseDateFromString = (dateString: string): Date => {
    if (!dateString) return new Date();
    try {
      // Handle DD-MMM-YYYY format
      if (dateString.match(/^\d{2}-[A-Za-z]{3}-\d{4}$/)) {
        const [day, month, year] = dateString.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndex = monthNames.indexOf(month);
        if (monthIndex !== -1) {
          return new Date(parseInt(year), monthIndex, parseInt(day));
        }
      }
      // Try to parse as regular date
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? new Date() : date;
    } catch {
      return new Date();
    }
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (date) {
      setSelectedDate(date);
      // Format date to DD-MMM-YYYY with 3-letter month abbreviations
      const day = date.getDate().toString().padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      const formattedDate = `${day}-${month}-${year}`;
      
      console.log('📅 Date formatted:', formattedDate);
      updateFormData('dateOfBirth', formattedDate);
      
      // Clear validation error for date of birth
      if (validationErrors.dateOfBirth) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.dateOfBirth;
          return newErrors;
        });
      }
    }
  };

  const confirmDateSelection = () => {
    setShowDatePicker(false);
  };

  const cancelDateSelection = () => {
    setShowDatePicker(false);
  };

  const showDatePickerModal = () => {
    setShowDatePicker(true);
  };

  const validateForm = async (): Promise<boolean> => {
    try {
      await editGeneralInfoSchema.validate(formData, { abortEarly: false });
      setValidationErrors({});
      return true;
    } catch (error: any) {
      if (error.inner) {
        const errors: Record<string, string> = {};
        error.inner.forEach((err: any) => {
          if (err.path) {
            errors[err.path] = err.message;
          }
        });
        setValidationErrors(errors);
      }
      return false;
    }
  };

  const handleImagePicker = (type: 'front' | 'back') => {
    const showActionSheet = () => {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Take Photo', 'Choose from Gallery'],
            cancelButtonIndex: 0,
          },
          (buttonIndex) => {
            if (buttonIndex === 1) {
              openCamera(type);
            } else if (buttonIndex === 2) {
              openGallery(type);
            }
          }
        );
      } else {
        Alert.alert(
          'Select ID Card Image',
          'Choose an option',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Take Photo', onPress: () => openCamera(type) },
            { text: 'Choose from Gallery', onPress: () => openGallery(type) },
          ]
        );
      }
    };

    showActionSheet();
  };

  const openCamera = async (type: 'front' | 'back') => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 10],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await handleImageSelection(result.assets[0].uri, type);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera. Please try again.');
    }
  };

  const openGallery = async (type: 'front' | 'back') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Gallery permission is required to select photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 10],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await handleImageSelection(result.assets[0].uri, type);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Error', 'Failed to open gallery. Please try again.');
    }
  };

  const handleImageSelection = async (imageUri: string, type: 'front' | 'back') => {
    try {
      // Create a file object that React Native can handle
      const file = {
        uri: imageUri,
        type: 'image/jpeg',
        name: `nid_${type}.jpg`,
      } as any;

      if (type === 'front') {
        setFormData(prev => ({ 
          ...prev, 
          nidFront: file,
          nidFrontUri: imageUri 
        }));
      } else {
        setFormData(prev => ({ 
          ...prev, 
          nidBack: file,
          nidBackUri: imageUri 
        }));
      }
    } catch (error) {
      console.error('Image selection error:', error);
      Alert.alert('Error', 'Failed to process selected image.');
    }
  };

  const handleConfirm = async () => {
    if (!profile?.id) {
      Alert.alert('Error', 'Profile information not available.');
      return;
    }

    // Validate form using Yup schema
    const isValid = await validateForm();
    if (!isValid) {
      // Validation errors are already displayed inline
      return;
    }

    try {
      setUpdating(true);
      
      // Prepare update data
      const updateData: any = {
        full_name: formData.fullName,
        general_email: formData.email,
        general_contact: formData.contactNumber,
        permanent_address: formData.permanentAddress,
        present_address: formData.presentAddress,
        gender: formData.gender,
        date_of_birth: formData.dateOfBirth,
        occupation: formData.occupation,
        marital_status: formData.maritalStatus || null,
        religion: formData.religion || null,
      };

      // Handle NID number
      // Ensure we send null for empty strings to properly clear the field
      updateData.nid_number = formData.nidNumber.trim() !== '' ? formData.nidNumber.trim() : null;

      // Add images if selected
      if (formData.nidFront) {
        updateData.nid_front = formData.nidFront;
      }
      if (formData.nidBack) {
        updateData.nid_back = formData.nidBack;
      }

      console.log('📝 Updating profile with data:', updateData);
      console.log('📝 NID number being sent:', updateData.nid_number, 'Type:', typeof updateData.nid_number);
      
      await updateUserProfile(updateData);
      console.log('📝 Profile update completed');
      
      // Refetch profile data to ensure we have the latest data
      console.log('📝 Profile update successful, refetching profile data...');
      const updated = await refetchProfile();
      // Sync updated name to auth state so Header reflects changes immediately
      if (updated?.full_name) {
        dispatch(updateUserData({ full_name: updated.full_name }));
      }
      console.log('📝 Profile refetch completed, current profile:', profile);
      console.log('📝 Profile NID after refetch:', profile?.nid_number);
      
      // Show success popup instead of alert
      setShowSuccessPopup(true);
      
    } catch (error) {
      console.error('❌ Profile update error:', error);
      
      // Set appropriate error message based on the error
      let errorMsg = 'Failed to update profile. Please try again.';
      
      if (error instanceof Error) {
        // Check if it's a validation error from backend
        if (error.message.includes('NID Number must be')) {
          errorMsg = 'NID Number must be 10, 13, or 17 digits.';
        } else if (error.message.includes('Failed to update profile')) {
          // Extract the specific validation error from the message
          const match = error.message.match(/\{.*\}/);
          if (match) {
            try {
              const errorObj = JSON.parse(match[0]);
              const firstError = Object.values(errorObj)[0];
              if (Array.isArray(firstError) && firstError.length > 0) {
                errorMsg = firstError[0];
              }
            } catch (parseError) {
              // If parsing fails, use the original message
              errorMsg = error.message;
            }
          }
        } else {
          errorMsg = error.message;
        }
      }
      
      Alert.alert('Error', errorMsg);
    } finally {
      setUpdating(false);
    }
  };

  const handleSuccessPopupClose = () => {
    setShowSuccessPopup(false);
    // Navigate directly to ProfileManagement screen
    navigation.navigate('ProfileManagement');
  };

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder?: string,
    multiline?: boolean,
    required?: boolean,
    fieldName?: keyof FormData
  ) => {
    const hasError = fieldName && validationErrors[fieldName];
    
    return (
      <View className="mb-4">
        <Text className="font-lato-bold text-lg text-gray-900 mb-2">
          {label}
          {required && <Text className="text-red-500">*</Text>}
        </Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          keyboardType={label === 'NID Number' ? 'numeric' : 'default'}
          className={`px-4 py-3 rounded-lg font-lato text-lg text-gray-900 ${
            multiline ? 'h-20 text-top' : 'h-14 pt-2'
          } ${
            hasError 
              ? 'bg-red-50 border-2 border-red-300' 
              : 'bg-gray-100 border border-transparent'
          }`}
          placeholderTextColor="#9CA3AF"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
        />
        <ErrorMessage 
          message={validationErrors[fieldName!] || ''} 
          visible={!!hasError} 
        />
      </View>
    );
  };


  const renderGenderSelection = () => (
    <View className="mb-4">
      <Text className="font-lato-bold text-lg text-gray-900 mb-2">Gender</Text>
      <View className="flex-row items-center space-x-6">
        {['Male', 'Female', 'Others'].map((gender) => (
          <TouchableOpacity
            key={gender}
            className="flex-row items-center mr-6"
            onPress={() => updateFormData('gender', gender as 'Male' | 'Female' | 'Others')}
          >
            <View className="w-5 h-5 rounded-full border-2 border-gray-400 mr-2 items-center justify-center">
              {formData.gender === gender && (
                <View className="w-3 h-3 rounded-full bg-teal-500" />
              )}
            </View>
            <Text className="font-lato text-lg text-gray-900">{gender}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Show loading state while profile data is being fetched
  if (loading && !profile) {
    return (
      <View className="flex-1 bg-white">
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <SafeAreaView className="flex-1 bg-white">
          {/* Header */}
          <View className="flex-row items-center px-4 py-4 border-b border-gray-100">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="flex-row items-center"
            >
              <Ionicons name="arrow-back" size={24} color="#3C9D9B" />
              <Text className="font-oxanium-bold text-2xl text-gray-900 ml-3">Edit General Info</Text>
            </TouchableOpacity>
          </View>
          
          <View className="flex-1 justify-center items-center">
            <Text className="font-lato text-xl text-gray-600">Loading profile data...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      
      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center px-4 py-4 border-b border-gray-100">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="flex-row items-center"
          >
            <Ionicons name="arrow-back" size={24} color="#3C9D9B" />
            <Text className="font-oxanium-bold text-2xl text-gray-900 ml-3">Edit General Info</Text>
          </TouchableOpacity>
        </View>

        <TouchableWithoutFeedback onPress={closeAllDropdowns}>
          <KeyboardAwareScrollView
            className="flex-1 px-6 pt-4"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid={true}
            enableAutomaticScroll={true}
            extraScrollHeight={20}
            keyboardOpeningTime={0}
            contentContainerStyle={{ paddingBottom: 100 }}
            nestedScrollEnabled={true}
            bounces={true}
          >
            {/* Full Name */}
            {renderInput(
              'Full Name',
              formData.fullName,
              (text) => updateFormData('fullName', text),
              'Enter your full name',
              false,
              true,
              'fullName'
            )}

          {/* Email */}
          {renderInput(
            'E-Mail',
            formData.email,
            (text) => updateFormData('email', text),
            'Enter your email address',
            false,
            true,
            'email'
          )}

          {/* Contact Number */}
          {renderInput(
            'Contact Number',
            formData.contactNumber,
            (text) => updateFormData('contactNumber', text),
            'Enter your contact number',
            false,
            false,
            'contactNumber'
          )}

          {/* NID Number */}
          {renderInput(
            'NID Number',
            formData.nidNumber,
            (text) => updateFormData('nidNumber', text),
            'Enter your NID number',
            false,
            false,
            'nidNumber'
          )}

          {/* Permanent Address */}
          {renderInput(
            'Permanent Address',
            formData.permanentAddress,
            (text) => updateFormData('permanentAddress', text),
            'Enter your permanent address',
            true,
            false,
            'permanentAddress'
          )}

          {/* Present Address */}
          {renderInput(
            'Present Address',
            formData.presentAddress,
            (text) => updateFormData('presentAddress', text),
            'Enter your present address',
            true,
            false,
            'presentAddress'
          )}

          {/* Gender */}
          {renderGenderSelection()}

          {/* Date of Birth and Occupation Row */}
          <View className="flex-row mb-4 gap-4">
            <View className="flex-1 min-w-0">
              <Text className="font-lato-bold text-lg text-gray-900 mb-2">Date of Birth</Text>
              <TouchableOpacity
                className={`px-4 py-3 rounded-lg h-14 flex-row items-center justify-between ${
                  validationErrors.dateOfBirth 
                    ? 'bg-red-50 border-2 border-red-300' 
                    : 'bg-gray-100 border border-transparent'
                }`}
                onPress={showDatePickerModal}
              >
                <Text className="font-lato text-lg text-gray-900">
                  {formData.dateOfBirth || 'Select date'}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="black" />
              </TouchableOpacity>
              <ErrorMessage 
                message={validationErrors.dateOfBirth || ''} 
                visible={!!validationErrors.dateOfBirth} 
              />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="font-lato-bold text-lg text-gray-900 mb-2">Occupation</Text>
              <TextInput
                value={formData.occupation}
                onChangeText={(text) => updateFormData('occupation', text)}
                className={`px-4 py-3 rounded-lg h-14 font-lato text-lg text-gray-900 pt-2 ${
                  validationErrors.occupation 
                    ? 'bg-red-50 border-2 border-red-300' 
                    : 'bg-gray-100 border border-transparent'
                }`}
                placeholderTextColor="#9CA3AF"
                placeholder="Enter occupation"
              />
              <ErrorMessage 
                message={validationErrors.occupation || ''} 
                visible={!!validationErrors.occupation} 
              />
            </View>
          </View>

          {/* Marital Status and Religion Row */}
          <View className="flex-row mb-6 gap-4">
            {/* Marital Status Dropdown */}
            <View className="flex-1 min-w-0">
              <Text className="font-lato-bold text-lg text-gray-900 mb-2">Marital Status</Text>
              <View className="relative">
                <TouchableOpacity 
                  className={`px-4 py-3 rounded-lg h-14 flex-row items-center justify-between ${
                    validationErrors.maritalStatus 
                      ? 'bg-red-50 border-2 border-red-300' 
                      : 'bg-gray-100 border border-transparent'
                  }`}
                  onPress={() => setShowMaritalStatusDropdown(!showMaritalStatusDropdown)}
                >
                  <Text className="font-lato text-lg text-gray-900">
                    {formData.maritalStatus || 'Select status'}
                  </Text>
                  <Ionicons 
                    name={showMaritalStatusDropdown ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="black" 
                  />
                </TouchableOpacity>
                
                {showMaritalStatusDropdown && (
                  <View className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg mt-1 z-10 shadow-lg">
                    {maritalStatusOptions.map((option, index) => (
                      <TouchableOpacity
                        key={option || 'empty'}
                        className={`px-4 py-3 ${index !== maritalStatusOptions.length - 1 ? 'border-b border-gray-100' : ''}`}
                        onPress={() => handleMaritalStatusSelect(option)}
                      >
                        <Text className="font-lato text-lg text-gray-900">
                          {option || 'Select status'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <ErrorMessage 
                message={validationErrors.maritalStatus || ''} 
                visible={!!validationErrors.maritalStatus} 
              />
            </View>
            
            {/* Religion Dropdown */}
            <View className="flex-1 min-w-0">
              <Text className="font-lato-bold text-lg text-gray-900 mb-2">Religion</Text>
              <View className="relative">
                <TouchableOpacity 
                  className={`px-4 py-3 rounded-lg h-14 flex-row items-center justify-between ${
                    validationErrors.religion 
                      ? 'bg-red-50 border-2 border-red-300' 
                      : 'bg-gray-100 border border-transparent'
                  }`}
                  onPress={() => setShowReligionDropdown(!showReligionDropdown)}
                >
                  <Text className="font-lato text-lg text-gray-900">
                    {formData.religion || 'Select religion'}
                  </Text>
                  <Ionicons 
                    name={showReligionDropdown ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="black" 
                  />
                </TouchableOpacity>
                
                {showReligionDropdown && (
                  <View className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg mt-1 z-10 shadow-lg">
                    {religionOptions.map((option, index) => (
                      <TouchableOpacity
                        key={option || 'empty'}
                        className={`px-4 py-3 ${index !== religionOptions.length - 1 ? 'border-b border-gray-100' : ''}`}
                        onPress={() => handleReligionSelect(option)}
                      >
                        <Text className="font-lato text-lg text-gray-900">
                          {option || 'Select religion'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <ErrorMessage 
                message={validationErrors.religion || ''} 
                visible={!!validationErrors.religion} 
              />
            </View>
          </View>

          {/* ID Card Images */}
          <View className="mb-6">
            <Text className="font-lato-bold text-lg text-gray-900 mb-4">ID Card Images</Text>
            
            {/* Image Preview Row */}
            <View className="flex-row mb-4 gap-3">
              {/* NID Front */}
              <View className="flex-1 bg-gray-100 rounded-lg overflow-hidden" style={{ aspectRatio: 1.6 }}>
                {formData.nidFrontUri ? (
                  <Image
                    source={{ uri: formData.nidFrontUri }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-full items-center justify-center">
                    <Ionicons name="card-outline" size={32} color="black" />
                    <Text className="font-lato text-sm text-gray-500 mt-1">Front Side</Text>
                  </View>
                )}
              </View>
              
              {/* NID Back */}
              <View className="flex-1 bg-gray-100 rounded-lg overflow-hidden" style={{ aspectRatio: 1.6 }}>
                {formData.nidBackUri ? (
                  <Image
                    source={{ uri: formData.nidBackUri }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-full items-center justify-center">
                    <Ionicons name="card-outline" size={32} color="black" />
                    <Text className="font-lato text-sm text-gray-500 mt-1">Back Side</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Action Buttons */}
            <View className="flex-row mb-3 gap-4">
              <TouchableOpacity
                className="flex-1 bg-primary py-3 rounded-lg flex-row items-center justify-center"
                onPress={() => handleImagePicker('front')}
              >
                <Ionicons name="camera" size={16} color="white" />
                <Text className="font-lato-bold text-base text-white ml-2">Front Side</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className="flex-1 bg-white border-2 border-primary py-3 rounded-lg flex-row items-center justify-center"
                onPress={() => handleImagePicker('back')}
              >
                <Ionicons name="camera" size={16} color="#3C9D9B" />
                <Text className="font-lato-bold text-base text-primary ml-2">Back Side</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Button */}
          <Button
            title={updating ? 'Updating...' : 'Confirm'}
            onPress={handleConfirm}
            disabled={updating || loading || !hasFormChanged()}
            loading={updating}
            variant="primary"
            size="large"
            fullWidth={true}
            className="mb-8"
          />
          </KeyboardAwareScrollView>
        </TouchableWithoutFeedback>
      </SafeAreaView>

      {/* Success Popup */}
      <SuccessPopup
        visible={showSuccessPopup}
        onClose={handleSuccessPopupClose}
        title="Congratulations!"
        message="General info updated successfully."
        buttonText="OK"
      />

      {/* Date Picker */}
      {Platform.OS === 'ios' ? (
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="slide"
        >
          <View className="flex-1 justify-end bg-black/50">
            <View className="bg-white rounded-t-3xl">
              {/* Header */}
              <View className="flex-row justify-between items-center px-6 py-4 border-b border-gray-200">
                <TouchableOpacity onPress={cancelDateSelection}>
                  <Text className="font-lato-bold text-lg text-gray-600">Cancel</Text>
                </TouchableOpacity>
                <Text className="font-lato-bold text-xl text-gray-900">Select Date</Text>
                <TouchableOpacity onPress={confirmDateSelection}>
                  <Text className="font-lato-bold text-lg text-teal-500">Done</Text>
                </TouchableOpacity>
              </View>
              
              {/* Date Picker */}
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                maximumDate={new Date()}
                minimumDate={new Date(1900, 0, 1)}
                className="h-48"
              />
              
              {/* Safe area for bottom */}
              <View className="h-8" />
            </View>
          </View>
        </Modal>
      ) : (
        showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            maximumDate={new Date()}
            minimumDate={new Date(1900, 0, 1)}
          />
        )
      )}
    </View>
  );
}
