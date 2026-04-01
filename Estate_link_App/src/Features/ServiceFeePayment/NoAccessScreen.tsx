import React, { useState } from 'react';
import { View, Text, StatusBar, TouchableOpacity, Image, RefreshControl, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useServiceFee } from '../../hooks/useServiceFee';
import Ionicons from '@expo/vector-icons/Ionicons';

const NoAccessScreen: React.FC = () => {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const { checkAccess, isLoading } = useServiceFee();

  // Debug logging for NoAccessScreen
  console.log('📱 NoAccessScreen render:', {
    isLoading,
    refreshing
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      console.log('🔄 NoAccessScreen refresh - checking access...');
      await checkAccess();
      console.log('✅ Access check completed');
      
      // Add a small delay to show refresh indicator
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('❌ Error during access check:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRetry = async () => {
    console.log('🔄 NoAccessScreen manual retry - checking access...');
    await onRefresh();
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      
      {/* Header */}
      <View className="px-4 py-3 flex-row items-center">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="flex-row items-center pr-2"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#3C9D9B" />
        </TouchableOpacity>
        <Text className="text-text-primary text-xl font-oxanium-bold">
          Service Fees
        </Text>
      </View>

      {/* Main Content with Pull to Refresh */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 100,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3C9D9B']}
            tintColor="#3C9D9B"
          />
        }
      >
        <View className="flex-1 items-center justify-center px-6">
          {/* Access Denied Icon */}
          <View className="w-40 h-40 items-center justify-center mb-8">
            <Image 
              source={require('../../../assets/NoAccessModal.png')} 
              className="w-full h-full"
              resizeMode="contain"
            />
          </View>

          {/* Access Denied Message */}
          <Text className="text-black text-xl text-center mb-4 font-oxanium-bold">
            You Do Not Have Access To Service Fees For This Unit
          </Text>

          {/* Explanation */}
          <Text className="text-gray-600 text-base text-center leading-6 font-oxanium mb-8">
            Only owners and residents of units can access Service Fees. Please contact your property manager if you believe this is an error.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default NoAccessScreen;
