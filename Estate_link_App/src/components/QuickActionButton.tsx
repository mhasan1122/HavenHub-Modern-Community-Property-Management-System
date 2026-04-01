import React from 'react';
import { View, Text, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface QuickActionButtonProps {
  title: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  iconSize?: number;
  containerWidth?: number;
  iconColor?: string;
  backgroundColor?: string;
}

export const QuickActionButton: React.FC<QuickActionButtonProps> = ({
  title,
  iconName,
  onPress,
  iconSize = 28,
  containerWidth,
  iconColor = '#3C9D9B',
  backgroundColor = '#EBF5F5',
}) => {
  return (
    <View className="items-center justify-start min-w-[48px] min-h-[48px] w-full">
      <Pressable
        onPress={onPress}
        className="w-full items-center justify-start px-0 active:opacity-70"
        android_ripple={{ color: '#3C9D9B1A', borderless: false }}>
        {/* Icon Container - Fixed width, centered using alignSelf */}
        <View className="self-center items-center justify-center rounded-xl mb-2 w-14 h-14 shadow-sm bg-primaryLight">
          <MaterialCommunityIcons
            name={iconName}
            size={iconSize}
            color={iconColor}
          />
        </View>
        
        {/* Label Container - Full width, text centered to match icon center */}
        <View className="w-full items-center justify-center px-0.5 min-h-[22px]">
          <Text
            className="font-lato text-gray-800 text-center w-full text-xs leading-5 font-medium"
            numberOfLines={1}
            ellipsizeMode="tail"
            allowFontScaling={false}>
            {title}
          </Text>
        </View>
      </Pressable>
    </View>
  );
};


