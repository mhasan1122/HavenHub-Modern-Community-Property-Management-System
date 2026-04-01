import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Ionicons from '@expo/vector-icons/Ionicons';

type RootStackParamList = {
  ProfileManagementSettings: undefined;
  TermsAndPrivacy: undefined;
};

type InfoAndSupportNavigationProp = StackNavigationProp<RootStackParamList, 'ProfileManagementSettings'>;

export function InfoAndSupport() {
  const navigation = useNavigation<InfoAndSupportNavigationProp>();

  const handlePhonePress = () => {
    Linking.openURL('tel:+8801817046585');
  };

  const handleEmailPress = () => {
    Linking.openURL('mailto:support@estatelink.cloud');
  };

  const handleTermsAndConditions = () => {
    navigation.navigate('TermsAndPrivacy');
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
            <Ionicons name="arrow-back" size={24} color="#000000" />
            <Text className="font-oxanium-bold text-xl text-gray-900 ml-3">Info and Support</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {/* Estate Link Section */}
          <View className="px-4 pt-6 pb-4">
            <View className="flex-row items-start mb-3">
              {/* Logo */}
              <View className="w-16 h-16 mr-4 items-center justify-center">
                <Image
                  source={require('../../../../assets/Logo.png')}
                  className="w-16 h-16"
                  resizeMode="contain"
                />
              </View>
              
              {/* Company Name and Address */}
              <View className="flex-1">
                <Text className="font-oxanium-bold text-2xl text-gray-900 mb-2">Estate Link</Text>
                <Text className="font-lato text-base text-gray-700">
                  99 Kazi Nazrul Islam Ave{'\n'}Dhaka 1215{'\n'}Bangladesh
                </Text>
              </View>
            </View>
          </View>

          {/* Support Section */}
          <View className="px-4 pt-4 pb-6">
            <View className="border border-primary/60 rounded-lg bg-white p-4">
              <Text className="font-lato-bold text-lg text-gray-900 mb-4">Support</Text>
              
              {/* Phone */}
              <TouchableOpacity
                onPress={handlePhonePress}
                className="flex-row items-center mb-4"
                activeOpacity={0.7}
              >
                <Ionicons name="call-outline" size={20} color="#3C9D9B" />
                <Text className="font-lato text-base text-gray-900 ml-3">+8801817046585</Text>
              </TouchableOpacity>
              
              {/* Email */}
              <TouchableOpacity
                onPress={handleEmailPress}
                className="flex-row items-center"
                activeOpacity={0.7}
              >
                <Ionicons name="mail-outline" size={20} color="#3C9D9B" />
                <Text className="font-lato text-base text-gray-900 ml-3">support@estatelink.cloud</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Terms and Conditions */}
          <View className="px-4 pt-2">
            <TouchableOpacity
              onPress={handleTermsAndConditions}
              className="flex-row items-center justify-between bg-white py-4 border-b border-gray-100"
              activeOpacity={0.7}
            >
              <Text className="font-lato-bold text-lg text-gray-900">Terms and Conditions</Text>
              <Ionicons name="chevron-forward" size={20} color="#374151" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

