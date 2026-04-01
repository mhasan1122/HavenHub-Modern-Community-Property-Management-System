// Debug component to test profile API integration
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useProfile } from '../hooks/useProfile';
import { useAppSelector } from '../store/hooks';

export const ProfileDebug = () => {
  const { user } = useAppSelector((state) => state.auth);
  const { profile, loading, error, refetchProfile } = useProfile();

  return (
    <ScrollView className="flex-1 p-4 bg-white">
      <Text className="text-xl font-bold mb-4">Profile Debug</Text>
      
      <View className="mb-4">
        <Text className="font-semibold">Auth User:</Text>
        <Text className="text-sm">{JSON.stringify(user, null, 2)}</Text>
      </View>
      
      <View className="mb-4">
        <Text className="font-semibold">Loading: {loading ? 'Yes' : 'No'}</Text>
        {error && <Text className="text-red-500">Error: {error}</Text>}
      </View>
      
      <TouchableOpacity 
        onPress={refetchProfile}
        className="bg-blue-500 p-3 rounded mb-4"
      >
        <Text className="text-white text-center">Refetch Profile</Text>
      </TouchableOpacity>
      
      <View className="mb-4">
        <Text className="font-semibold">Profile Data:</Text>
        <Text className="text-sm">{JSON.stringify(profile, null, 2)}</Text>
      </View>
    </ScrollView>
  );
};