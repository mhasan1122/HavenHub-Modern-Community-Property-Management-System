import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Ionicons from '@expo/vector-icons/Ionicons';

type RootStackParamList = {
  ProfileManagement: undefined;
  EditGeneralInfo: undefined;
  EditLoginInfo: undefined;
  InfoAndSupport: undefined;
  BlockedMembers: undefined;
};

type ProfileManagementSettingsNavigationProp = StackNavigationProp<RootStackParamList, 'ProfileManagement'>;

export function ProfileManagementSettings() {
  const navigation = useNavigation<ProfileManagementSettingsNavigationProp>();

  const handleEditGeneralInfo = () => {
    navigation.navigate('EditGeneralInfo');
  };

  const handleEditLoginInfo = () => {
    navigation.navigate('EditLoginInfo');
  };

  const handleInfoAndSupport = () => {
    navigation.navigate('InfoAndSupport');
  };

  const handleBlockedMembers = () => {
    navigation.navigate('BlockedMembers');
  };

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
            <Text className="font-oxanium-bold text-xl text-gray-900 ml-3">Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Settings Options */}
        <View className="flex-1 bg-gray-50">
          {/* Edit General Info */}
          <TouchableOpacity
            className="bg-white flex-row items-center justify-between px-4 py-4 border-b border-gray-100"
            onPress={handleEditGeneralInfo}
            activeOpacity={0.7}
          >
            <Text className="font-lato-bold text-xl text-gray-900">Edit General Info</Text>
            <Ionicons name="chevron-forward" size={20} color="#374151" />
          </TouchableOpacity>

          {/* Edit Login Info */}
          <TouchableOpacity
            className="bg-white flex-row items-center justify-between px-4 py-4 border-b border-gray-100"
            onPress={handleEditLoginInfo}
            activeOpacity={0.7}
          >
            <Text className="font-lato-bold text-xl text-gray-900">Edit Login Info</Text>
            <Ionicons name="chevron-forward" size={20} color="#374151" />
          </TouchableOpacity>

          {/* Info and Support */}
          <TouchableOpacity
            className="bg-white flex-row items-center justify-between px-4 py-4 border-b border-gray-100"
            onPress={handleInfoAndSupport}
            activeOpacity={0.7}
          >
            <Text className="font-lato-bold text-xl text-gray-900">Info and Support</Text>
            <Ionicons name="chevron-forward" size={20} color="#374151" />
          </TouchableOpacity>

          {/* Blocked Members */}
          <TouchableOpacity
            className="bg-white flex-row items-center justify-between px-4 py-4 border-b border-gray-100"
            onPress={handleBlockedMembers}
            activeOpacity={0.7}
          >
            <Text className="font-lato-bold text-xl text-gray-900">Blocked Members</Text>
            <Ionicons name="chevron-forward" size={20} color="#374151" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
