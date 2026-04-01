import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { fetchContacts } from '../../store/slices/contactSlice';
import { Contact } from '../../types/contact';
import { getPhotoURL, getInitialLetter } from '../../utils/photoUtils';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSwipeToHome } from '../../hooks/useSwipeToHome';

export const ContactScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { contacts, loading, error, hasLoadedOnce } = useAppSelector((state) => state.contacts);
  const [failedImageIds, setFailedImageIds] = useState<Set<number>>(new Set());
  const panGesture = useSwipeToHome();

  useEffect(() => {
    if (!hasLoadedOnce) {
      dispatch(fetchContacts());
    }
  }, [dispatch, hasLoadedOnce]);

  // Auto-reload contacts whenever the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      setFailedImageIds(new Set());
      dispatch(fetchContacts());
    }, [dispatch])
  );

  const handlePhonePress = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleEmailPress = (email: string) => {
    Linking.openURL(`mailto:${email}`);
  };

  const handleImageError = (contactId: number) => {
    setFailedImageIds((prev) => new Set(prev).add(contactId));
  };

  const renderContactCard = (contact: Contact) => {
    // Get photo URL from contact if available, otherwise use initials
    const contactPhoto = contact.photo_url || null;
    const photoURL = contactPhoto ? getPhotoURL(contactPhoto) : null;
    const hasPhoto = photoURL && !failedImageIds.has(contact.id);
    const initials = getInitialLetter(contact.name);

    return (
      <View className="bg-white rounded-xl border border-[#B2E5E3] p-4 mb-3">
        <View className="flex-row items-center">
          {/* Profile Picture */}
          {hasPhoto ? (
            <View className="w-20 h-20 rounded-full mr-4 border border-primary/60">
              <Image
                source={{ uri: photoURL! }}
                className="w-full h-full rounded-full"
                resizeMode="cover"
                onError={() => handleImageError(contact.id)}
              />
            </View>
          ) : (
            <View className="w-16 h-16 rounded-full bg-teal-500 items-center justify-center mr-4 border border-primary/60">
              <Text className="font-lato-bold text-white text-xl">
                {initials}
              </Text>
            </View>
          )}

          {/* Contact Info */}
          <View className="flex-1">
            <Text className="font-lato-bold text-lg text-black mb-1">
              {contact.name}
            </Text>
            <Text className="font-lato text-sm text-black mb-3">
              {contact.designation}
            </Text>

            {/* Phone */}
            <TouchableOpacity
              onPress={() => handlePhonePress(contact.phone_number)}
              className="flex-row items-center mb-2"
              activeOpacity={0.7}
            >
              <Ionicons name="call-outline" size={18} color="#000000" />
              <Text className="font-lato text-base text-black ml-2 flex-1" numberOfLines={1}>
                {contact.phone_number}
              </Text>
            </TouchableOpacity>

            {/* Email */}
            <TouchableOpacity
              onPress={() => handleEmailPress(contact.email)}
              className="flex-row items-center"
              activeOpacity={0.7}
            >
              <Ionicons name="mail-outline" size={18} color="#000000" />
              <Text className="font-lato text-base text-black ml-2 flex-1" numberOfLines={1}>
                {contact.email}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <>
      {/* Divider */}
      <View className="h-px bg-gray-200 mb-6" />

      {/* Contacts Section Header */}
      <Text className="font-lato-bold text-2xl text-black mb-4">
        Contacts
      </Text>
    </>
  );

  const renderEmptyComponent = () => {
    if (loading && !hasLoadedOnce) {
      return (
        <View className="items-center justify-center py-20">
          <ActivityIndicator size="large" color="#3C9D9B" />
          <Text className="font-lato text-base text-black mt-4">Loading contacts...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View className="bg-red-50 rounded-lg p-4 mb-4">
          <Text className="font-lato text-base text-red-600 text-center">
            {error}
          </Text>
        </View>
      );
    }

    return (
      <View className="bg-gray-50 rounded-lg p-6 items-center">
        <Ionicons name="people-outline" size={48} color="#9CA3AF" />
        <Text className="font-lato text-base text-black mt-4 text-center">
          No contacts available
        </Text>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={panGesture}>
        <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
          <FlatList
            data={contacts}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => renderContactCard(item)}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmptyComponent}
            contentContainerClassName="px-4 pt-5 pb-20 flex-grow"
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
          />
        </SafeAreaView>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

export default ContactScreen;

