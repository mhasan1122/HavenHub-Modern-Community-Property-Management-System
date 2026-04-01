import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Image,
  Alert,
  RefreshControl,
  Platform,
  Linking,
  ActionSheetIOS,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { logout, updateUserPhoto, logoutUser } from '../../store/slices/authSlice';
import { useProfile } from '../../hooks/useProfile';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { getPhotoURL, getInitialLetter } from '../../utils/photoUtils';
import { LogoutConfirmationModal } from '../../../components';
import SuccessPopup from '../../../components/SuccessPopup';
import { ImageWithFallback } from '../../components/ImageWithFallback';
import { ProfileData } from '../../types/profile';

type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  ProfileManagement: undefined;
  ProfileManagementSettings: undefined;
  EditGeneralInfo: undefined;
  EditLoginInfo: undefined;
  PaymentSettings: undefined;
};

type ProfileManagementNavigationProp = StackNavigationProp<RootStackParamList, 'ProfileManagement'>;

export function ProfileManagement() {
  const navigation = useNavigation<ProfileManagementNavigationProp>();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { profile, owners, residents, staff, loading, error, refetchProfile, updateUserProfile } = useProfile();
  
  // Debug logging for profile state
  console.log('📱 ProfileManagement useProfile result:', {
    profile: profile ? 'exists' : 'null',
    loading,
    error,
    hasUpdateUserProfile: typeof updateUserProfile === 'function'
  });

  // Debug logging for unit relationships
  console.log('🏠 ProfileManagement unit relationships:', {
    owners: owners,
    residents: residents,
    staff: staff,
    ownersCount: owners?.length || 0,
    residentsCount: residents?.length || 0,
    staffCount: staff?.length || 0
  });
  const [activeTab, setActiveTab] = useState<'general' | 'activity'>('general');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingImage, setDownloadingImage] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  // Debug logging
  console.log('📱 ProfileManagement render:', {
    user,
    profile,
    loading,
    error
  });
  
  // Photo display logging
  console.log('📸 Photo display values:', {
    'user?.photo': user?.photo,
    'profile?.photo': profile?.photo,
    'display photo': profile?.photo || user?.photo,
    'getPhotoURL result': getPhotoURL(profile?.photo || user?.photo)
  });

  // Show loading state only when we have NO data to display (no user from auth, no cached profile)
  // If we have user from auth, show profile instantly with that data while profile loads in background
  const hasUserData = !!(user?.full_name || user?.id);
  const hasCachedProfile = !!(profile?.full_name || profile?.id);
  if (loading && !hasUserData && !hasCachedProfile) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <Text className="font-lato text-xl text-gray-600">Loading profile...</Text>
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-white px-4">
        <Text className="font-lato text-xl text-red-600 text-center mb-4">Error loading profile</Text>
        <Text className="font-lato text-base text-gray-600 text-center">{error}</Text>
      </View>
    );
  }

  // Use profile from API, or fall back to auth user data for instant display while profile loads
  const profileData: ProfileData = profile || {
    id: user?.id ? Number(user.id) : 0,
    full_name: user?.full_name ?? '',
    general_contact: user?.phone ?? '',
    general_email: user?.email ?? '',
    photo: user?.photo ?? undefined,
    is_org_member: false,
    is_comm_member: false,
    is_first_login: false,
    member_roles: [],
    member_groups: [],
    occupation: '',
    gender: '',
    religion: '',
    nid_number: '',
    marital_status: '',
    present_address: '',
    permanent_address: '',
    date_of_birth: '',
  };

  const handleLogOut = () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = async () => {
    try {
      console.log('🚪 Starting logout process...');
      
      // Dispatch logoutUser thunk to handle backend cleanup and local state
      // @ts-ignore - Redux type inference issue with thunk
      await dispatch(logoutUser()).unwrap();
      
      // Navigate to Login screen and reset stack to prevent going back
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
      
      console.log('✅ Logout completed successfully');
    } catch (error) {
      console.error('❌ Error during logout:', error);
      // Fallback: Force local logout and reset navigation
      dispatch(logout());
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  };

  const handleSettingsPress = () => {
    navigation.navigate('ProfileManagementSettings');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      console.log('🔄 ProfileManagement refresh triggered');
      // Refresh profile data
      await refetchProfile();
      console.log('✅ Profile data refreshed successfully');

      // Add a small delay to show refresh indicator
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('❌ Error during profile refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const downloadImage = async (imageUri: string, fileName: string, imageType: string) => {
    if (downloadingImage) return;

    try {
      setDownloadingImage(imageType);
      console.log('Starting image download:', { imageUri, fileName, imageType });

      // Use the same URL construction logic as getPhotoURL
      const fullImageUri = getPhotoURL(imageUri);
      
      if (!fullImageUri) {
        Alert.alert('Error', 'Image URL is not available.');
        return;
      }

      console.log('Full image URI:', fullImageUri);

      // Simple approach: Open the image URL in browser for download
      const canOpen = await Linking.canOpenURL(fullImageUri);
      if (canOpen) {
        await Linking.openURL(fullImageUri);
        
        Alert.alert(
          'Image Opened',
          `${imageType} has been opened in your browser. You can save it by long-pressing the image and selecting "Save Image" or "Download Image".`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Cannot open the image URL.');
      }
    } catch (error) {
      console.error('Image Download Error:', error);
      Alert.alert(
        'Download Failed',
        'Unable to open the image. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setDownloadingImage(null);
    }
  };

  const handlePhotoChange = async () => {
    if (uploadingPhoto) return;

    const showActionSheet = () => {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Take Photo', 'Choose from Gallery'],
            cancelButtonIndex: 0,
          },
          (buttonIndex) => {
            if (buttonIndex === 1) {
              openCamera();
            } else if (buttonIndex === 2) {
              openGallery();
            }
          }
        );
      } else {
        Alert.alert(
          'Change Profile Photo',
          'Choose an option',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Take Photo', onPress: openCamera },
            { text: 'Choose from Gallery', onPress: openGallery },
          ]
        );
      }
    };

    const openCamera = async () => {
      try {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Camera permission is required to take photos.');
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
          await uploadPhoto(result.assets[0].uri);
        }
      } catch (error) {
        console.error('Camera error:', error);
        Alert.alert('Error', 'Failed to open camera. Please try again.');
      }
    };

    const openGallery = async () => {
      try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Gallery permission is required to select photos.');
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
          await uploadPhoto(result.assets[0].uri);
        }
      } catch (error) {
        console.error('Gallery error:', error);
        Alert.alert('Error', 'Failed to open gallery. Please try again.');
      }
    };

    showActionSheet();
  };

  const uploadPhoto = async (photoUri: string) => {
    try {
      setUploadingPhoto(true);
      
      if (!profile?.id) {
        Alert.alert('Error', 'Profile information not available. Please try again.');
        return;
      }

      if (!updateUserProfile || typeof updateUserProfile !== 'function') {
        Alert.alert('Error', 'Update function not available. Please try again.');
        return;
      }

      console.log('📸 Starting photo upload for profile ID:', profile.id);
      console.log('📸 Photo URI:', photoUri);
      console.log('📸 Current profile photo before upload:', profile?.photo);
      console.log('📸 Current user photo before upload:', user?.photo);

      // Create a file object that React Native can handle
      const file = {
        uri: photoUri,
        type: 'image/jpeg',
        name: 'profile_photo.jpg',
      } as any;

      console.log('📸 Calling updateUserProfile with file:', file);
      
      // Use existing updateUserProfile from useProfile hook
      const result = await updateUserProfile({ photo: file });
      
      console.log('✅ Photo upload successful, result:', result);
      console.log('📸 Profile photo after upload (before refresh):', profile?.photo);
      console.log('📸 User photo after upload (before refresh):', user?.photo);
      
      // Refresh profile data to get the new photo path
      console.log('🔄 Refreshing profile data...');
      const updatedProfile = await refetchProfile();
      console.log('✅ Profile data refreshed, updated profile:', updatedProfile);
      
      // Update the user photo in auth state with the new photo from the refreshed profile
      if (updatedProfile?.photo) {
        console.log('📸 Updating auth state with new photo:', updatedProfile.photo);
        dispatch(updateUserPhoto(updatedProfile.photo));
        console.log('📸 Auth state updated with photo:', updatedProfile.photo);
      } else {
        console.log('❌ No profile photo found after refresh');
      }
      
      // Show success popup instead of alert
      setShowSuccessPopup(true);
      
    } catch (error) {
      console.error('❌ Photo upload error:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        error: error
      });
      
      Alert.alert(
        'Upload Failed', 
        error instanceof Error ? error.message : 'Failed to upload photo. Please try again.'
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const ProfileInfoRow = ({ label, value }: { label: string; value: string }) => {
    // Check if this is an address field that should wrap
    const isAddressField = label === 'Present Address' || label === 'Permanent Address';
    
    // Display dash if value is empty, null, or undefined
    const displayValue = value && value.trim() !== '' ? value : '—';
    
    return (
      <View className="py-3 mb-4">
        <View className="flex-row items-start">
          <Text className="font-lato-bold text-base text-gray-900 w-1/3 pr-2">
            {label}
          </Text>
          <Text
            className="font-lato text-black w-2/3 text-left"
            numberOfLines={isAddressField ? undefined : 1}
            adjustsFontSizeToFit={!isAddressField}
            minimumFontScale={!isAddressField ? 0.6 : 1}
            ellipsizeMode={isAddressField ? undefined : "tail"}
          >
            {displayValue}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="flex-row items-center">
            <Ionicons name="arrow-back" size={24} color="#3C9D9B" />
            <Text className="font-oxanium-bold text-xl text-gray-900 ml-2">Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSettingsPress}>
            <Ionicons name="settings-outline" size={24} color="#3C9D9B" />
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#3C9D9B']}
              tintColor="#3C9D9B"
            />
          }>
          {/* Profile Header */}
          <View className="items-center py-8 bg-primary-customTeal">
            <View className="relative">
              {(profile?.photo || user?.photo) ? (
                <Image
                  source={{ uri: getPhotoURL(profile?.photo || user?.photo)! }}
                  className="w-24 h-24 rounded-full border-4 border-gray-400"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-24 h-24 rounded-full bg-primary items-center justify-center border-4 border-gray-400">
                  <Text className="font-lato-bold text-3xl text-white">
                    {getInitialLetter(profileData.full_name)}
                  </Text>
                </View>
              )}
              
              {/* Camera Icon Overlay */}
              <TouchableOpacity
                className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full items-center justify-center border-2 border-gray-300 shadow-sm"
                onPress={handlePhotoChange}
                disabled={uploadingPhoto}
                activeOpacity={0.8}
              >
                {uploadingPhoto ? (
                  <Ionicons name="hourglass-outline" size={16} color="#6B7280" />
                ) : (
                  <Ionicons name="camera-outline" size={16} color="#6B7280" />
                )}
              </TouchableOpacity>
            </View>

            <Text className="font-lato-bold text-4xl text-black mt-4">
              {profileData.full_name}
            </Text>
            <Text className="font-lato-bold text-xl text-black mt-1">
              {profileData.general_contact}
            </Text>
            <Text className="font-lato-bold text-xl text-black">
              {profileData.general_email}
            </Text>
          </View>

          {/* Membership Badges */}
          <View className="px-4 py-4 bg-white">
            <View className="flex-row flex-wrap" style={{ gap: 12 }}>
              {profileData.is_org_member && (
                <View className="flex-row items-center bg-primary-customTeal px-3 py-2 rounded-lg flex-1" style={{ minWidth: '45%' }}>
                  <Ionicons name="business-outline" size={22} color="#3C9D9B" />
                  <Text className="font-lato text-lg text-black ml-2 flex-shrink-1">
                    Organization Member
                  </Text>
                </View>
              )}
              {profileData.is_comm_member && (
                <View className="flex-row items-center bg-primary-customTeal px-3 py-2 rounded-lg flex-1" style={{ minWidth: '45%' }}>
                  <Ionicons name="people-outline" size={22} color="#3C9D9B" />
                  <Text className="font-lato text-lg text-black ml-2 flex-shrink-1">
                    Community Member
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Position and Unit Info */}
          <View className="px-4" style={{ marginBottom: 24 }}>
            {/* First Row: Position and Primary Unit */}
            <View className="flex-row" style={{ gap: 12, marginBottom: 20 }}>
              {/* Position Card (Left) */}
              <View className="flex-1 bg-white rounded-lg border border-gray-200 p-4">
                <Text className="font-lato text-lg text-gray-600 mb-1">Position</Text>
                <Text className="font-lato-bold text-lg text-gray-900">
                  {profileData.member_roles?.map((role: any) => role.role_name).join(', ') || 'Not specified'}
                </Text>
              </View>

              {/* Primary Unit Card (Right) */}
              <View className="flex-1 bg-white rounded-lg border border-gray-200 p-4">
                {(() => {
                  // Create a combined list of all unit relationships
                  const allUnits = [
                    ...owners.map(owner => ({ ...owner, type: 'owner', priority: 1 })),
                    ...residents.map(resident => ({ ...resident, type: 'resident', priority: 2 })),
                    ...staff.map(staffMember => ({ ...staffMember, type: 'staff', priority: 3 }))
                  ];
                  
                  // Sort by priority (owners first, then residents, then staff)
                  allUnits.sort((a, b) => a.priority - b.priority);
                  
                  if (allUnits.length === 0) {
                    return (
                      <>
                        <Text className="font-lato-bold text-xl text-gray-900 mb-1">No unit assigned</Text>
                        <Text className="font-lato text-lg text-gray-600">Unit details</Text>
                      </>
                    );
                  }
                  
                  const primaryUnit = allUnits[0];
                  
                  if (primaryUnit.type === 'owner') {
                    return (
                      <>
                        <Text className="font-lato-bold text-xl text-gray-900 mb-1">{primaryUnit.unit_name}</Text>
                        <Text className="font-lato text-lg text-gray-600">
                          Owner
                        </Text>
                      </>
                    );
                  } else if (primaryUnit.type === 'resident') {
                    return (
                      <>
                        <Text className="font-lato-bold text-xl text-gray-900 mb-1">{primaryUnit.unit_name}</Text>
                        <Text className="font-lato text-lg text-gray-600">
                          {primaryUnit.is_resident_or_tenant ? 'Resident' : 'Tenant'}
                        </Text>
                      </>
                    );
                  } else if (primaryUnit.type === 'staff') {
                    return (
                      <>
                        <Text className="font-lato-bold text-xl text-gray-900 mb-1">{primaryUnit.unit_name}</Text>
                        <Text className="font-lato text-lg text-gray-600">
                          {primaryUnit.unit_staff_status ? 'Live-in Staff' : 'Part-time Staff'}
                        </Text>
                      </>
                    );
                  }
                })()}
              </View>
            </View>

            {/* Second Row: Group Name and Secondary Unit */}
            <View className="flex-row" style={{ gap: 12 }}>
              {/* Group Name Card (Left) */}
              <View className="flex-1 bg-white rounded-lg border border-gray-200 p-4">
                <Text className="font-lato text-lg text-gray-600 mb-1">Group Name</Text>
                <Text className="font-lato-bold text-lg text-gray-900">
                  {profileData.member_groups?.map((group: any) => group.group_name).join(', ') || 'No group assigned'}
                </Text>
              </View>

              {/* Additional Units Card (Right) */}
              <View className="flex-1 bg-white rounded-lg border border-gray-200 p-4">
                {(() => {
                  // Create a combined list of all unit relationships
                  const allUnits = [
                    ...owners.map(owner => ({ ...owner, type: 'owner', priority: 1 })),
                    ...residents.map(resident => ({ ...resident, type: 'resident', priority: 2 })),
                    ...staff.map(staffMember => ({ ...staffMember, type: 'staff', priority: 3 }))
                  ];
                  
                  // Sort by priority (owners first, then residents, then staff)
                  allUnits.sort((a, b) => a.priority - b.priority);
                  
                  if (allUnits.length <= 1) {
                    return (
                      <>
                        <Text className="font-lato-bold text-xl text-gray-900 mb-1">No additional unit</Text>
                        <Text className="font-lato text-lg text-gray-600">Additional unit</Text>
                      </>
                    );
                  }
                  
                  // Get all units except the first one (which is shown in primary card)
                  const additionalUnits = allUnits.slice(1);
                  
                  if (additionalUnits.length === 0) {
                    return (
                      <>
                        <Text className="font-lato-bold text-xl text-gray-900 mb-1">No additional unit</Text>
                        <Text className="font-lato text-lg text-gray-600">Additional unit</Text>
                      </>
                    );
                  }
                  
                  return (
                    <> 
                      {additionalUnits.map((unit, index) => (
                        <View key={`additional-${unit.type}-${unit.id}`} className="mb-1 last:mb-0">
                          <Text className="font-lato-bold text-lg text-gray-900">{unit.unit_name}</Text>
                        <Text className="font-lato text-base text-gray-600">
                          {unit.type === 'owner' && 'Owner'}
                          {unit.type === 'resident' && (unit.is_resident_or_tenant ? 'Resident' : 'Tenant')}
                          {unit.type === 'staff' && (unit.unit_staff_status ? 'Live-in Staff' : 'Part-time Staff')}
                        </Text>
                        </View>
                      ))}
                    </>
                  );
                })()}
              </View>
            </View>
          </View>

          {/* Tab Navigation */}
          <View className="mx-4 mb-4">
            <View className="flex-row">
              <TouchableOpacity
                className="flex-1 pb-3"
                onPress={() => setActiveTab('general')}>
                <Text className={`text-center font-lato-bold text-xl ${activeTab === 'general' ? 'text-black' : 'text-gray-600'}`}>
                  General Info
                </Text>
                {activeTab === 'general' && (
                  <View className="h-0.5 bg-teal-600 mt-2" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 pb-3"
                onPress={() => setActiveTab('activity')}>
                <Text className={`text-center font-lato-bold text-xl ${activeTab === 'activity' ? 'text-black' : 'text-gray-600'}`}>
                  Activity
                </Text>
                {activeTab === 'activity' && (
                  <View className="h-0.5 bg-teal-600 mt-2" />
                )}
              </TouchableOpacity>
            </View>
            <View className="h-px bg-gray-200" />
          </View>

          {/* Tab Content */}
          {activeTab === 'general' && (
            <View className="bg-white mx-4 rounded-lg border border-gray-200 p-4 mb-4">
              <ProfileInfoRow label="Full Name" value={profileData.full_name} />
              <ProfileInfoRow label="E-Mail" value={profileData.general_email} />
              <ProfileInfoRow label="Contact Number" value={profileData.general_contact} />
              <ProfileInfoRow label="Occupation" value={profileData.occupation || ''} />
              <ProfileInfoRow label="Date of Birth" value={profileData.date_of_birth || ''} />
              <ProfileInfoRow label="Gender" value={profileData.gender || ''} />
              <ProfileInfoRow label="Religion" value={profileData.religion || ''} />
              <ProfileInfoRow label="NID Number" value={profileData.nid_number || ''} />
              <ProfileInfoRow label="Marital Status" value={profileData.marital_status || ''} />
              <ProfileInfoRow label="Present Address" value={profileData.present_address || ''} />
              <ProfileInfoRow label="Permanent Address" value={profileData.permanent_address || ''} />
            </View>
          )}

          {activeTab === 'activity' && (
            <View className="bg-white mx-4 rounded-lg border border-gray-200 p-4 mb-4">
              <View className="items-center py-8">
                <Ionicons name="time-outline" size={48} color="#9CA3AF" />
                <Text className="font-lato text-gray-500 mt-4 text-center text-lg">
                  No recent activity to display
                </Text>
              </View>
            </View>
          )}

          {/* ID Card Images */}
          <View className="bg-white mx-4 rounded-lg border border-gray-200 p-4 mb-4">
            <Text className="font-lato-bold text-xl text-gray-900 mb-4">ID Card Images</Text>
            <View className="flex-row" style={{ gap: 12 }}>
              {/* NID Front Image */}
              <View className="flex-1">
                <Text className="font-lato-bold text-base text-gray-700 mb-2 text-center">
                  Front Side
                </Text>
                {profileData.nid_front ? (
                  <TouchableOpacity
                    className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden"
                    style={{ minHeight: 120 }}
                    activeOpacity={0.8}>
                    <ImageWithFallback
                      file={profileData.nid_front}
                      fileName="NID Front"
                      fallbackIcon="card-outline"
                      fallbackText="Front Side"
                      debugName="ProfileManagement-NIDFront"
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                    <TouchableOpacity 
                      className="absolute bottom-2 right-2 flex-row items-center bg-black bg-opacity-60 px-2 py-1 rounded"
                      onPress={() => {
                        if (profileData.nid_front) {
                          downloadImage(profileData.nid_front, 'NID_Front', 'NID Front Side');
                        }
                      }}
                      disabled={downloadingImage === 'NID Front Side'}
                      activeOpacity={0.8}
                    >
                      <Feather 
                        name={downloadingImage === 'NID Front Side' ? "clock" : "download"} 
                        size={16} 
                        color="#3C9D9B" 
                      />
                      <Text className="font-lato-bold text-white text-sm ml-1">
                        {downloadingImage === 'NID Front Side' ? 'Opening...' : 'View'}
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ) : (
                  <View className="bg-gray-50 rounded-lg border border-gray-200 p-4 items-center justify-center" style={{ minHeight: 120 }}>
                    <Ionicons name="card-outline" size={32} color="#9CA3AF" />
                    <Text className="font-lato text-sm text-gray-500 mt-2 text-center">
                      No image available
                    </Text>
                  </View>
                )}
              </View>

              {/* NID Back Image */}
              <View className="flex-1">
                <Text className="font-lato-bold text-base text-gray-700 mb-2 text-center">
                  Back Side
                </Text>
                {profileData.nid_back ? (
                  <TouchableOpacity
                    className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden"
                    style={{ minHeight: 120 }}
                    activeOpacity={0.8}>
                    <ImageWithFallback
                      file={profileData.nid_back}
                      fileName="NID Back"
                      fallbackIcon="card-outline"
                      fallbackText="Back Side"
                      debugName="ProfileManagement-NIDBack"
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                    <TouchableOpacity 
                      className="absolute bottom-2 right-2 flex-row items-center bg-black bg-opacity-60 px-2 py-1 rounded"
                      onPress={() => {
                        if (profileData.nid_back) {
                          downloadImage(profileData.nid_back, 'NID_Back', 'NID Back Side');
                        }
                      }}
                      disabled={downloadingImage === 'NID Back Side'}
                      activeOpacity={0.8}
                    >
                      <Feather 
                        name={downloadingImage === 'NID Back Side' ? "clock" : "download"} 
                        size={16} 
                        color="#3C9D9B" 
                      />
                      <Text className="font-lato-bold text-white text-sm ml-1">
                        {downloadingImage === 'NID Back Side' ? 'Opening...' : 'View'}
                      </Text>
                    </TouchableOpacity>

                  </TouchableOpacity>
                ) : (
                  <View className="bg-gray-50 rounded-lg border border-gray-200 p-4 items-center justify-center" style={{ minHeight: 120 }}>
                    <Ionicons name="card-outline" size={32} color="#9CA3AF" />
                    <Text className="font-lato text-sm text-gray-500 mt-2 text-center">
                      No image available
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Log Out Button */}
          <View className="mx-4 mb-8">
            <TouchableOpacity
              className="bg-primary rounded-lg py-4 flex-row items-center justify-center"
              onPress={handleLogOut}>
              <Text className="font-lato-bold text-white text-center mr-2 text-lg">Log Out</Text>
              <Ionicons name="log-out-outline" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmationModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
      />

      {/* Success Popup for Photo Upload */}
      <SuccessPopup
        visible={showSuccessPopup}
        onClose={() => setShowSuccessPopup(false)}
        title="Success!"
        message="Profile photo updated successfully!"
        buttonText="OK"
      />
    </View>
  );
}