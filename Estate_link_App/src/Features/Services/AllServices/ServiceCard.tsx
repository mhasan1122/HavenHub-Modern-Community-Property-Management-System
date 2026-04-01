import React from 'react';
import { View, Text, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ServiceItem } from './types';

interface ServiceCardProps {
  service: ServiceItem;
  onPress: (route: string, params?: any) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, onPress }) => {
  return (
    <View className="w-[30%] items-center justify-center mb-4">
      <Pressable
        onPress={() => onPress(service.route, service.params)}
        className="w-full items-center justify-center active:opacity-70"
        android_ripple={{ color: '#3C9D9B1A', borderless: false }}>
        {/* Icon Container - matching QuickActionButton style */}
        <View className="self-center items-center justify-center rounded-xl mb-2 w-14 h-14 shadow-sm bg-primaryLight">
          <MaterialCommunityIcons
            name={service.iconName}
            size={28}
            color="#3C9D9B"
          />
        </View>
        
        {/* Label Container */}
        <View className="w-full items-center justify-center px-0.5 min-h-[22px]">
          <Text
            className="font-lato text-black text-center w-full text-xs leading-5 font-medium"
            numberOfLines={1}
            ellipsizeMode="tail"
            allowFontScaling={false}>
            {service.title}
          </Text>
        </View>
      </Pressable>
    </View>
  );
};

