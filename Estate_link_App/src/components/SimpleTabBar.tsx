import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';

interface TabItem {
  name: string;
  icon: any;
  label: string;
}

interface SimpleTabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onTabPress: (tabName: string) => void;
}

export const SimpleTabBar: React.FC<SimpleTabBarProps> = ({
  tabs,
  activeTab,
  onTabPress,
}) => {
  return (
    <View className="bg-white border-t border-gray-200 pb-safe shadow-lg">
      {/* Tab buttons */}
      <View className="flex-row items-center justify-between px-4 pt-2 pb-1">
        {tabs.map((tab) => (
          <View
            key={tab.name}
            className="flex-1 items-center"
          >
            <TouchableOpacity
              className="items-center px-2 py-3"
              onPress={() => onTabPress(tab.name)}
              activeOpacity={0.7}
            >
              <Image
                source={tab.icon}
                className="mb-1 h-6 w-6"
                style={{
                  tintColor: activeTab === tab.name ? '#3C9D9B' : '#9CA3AF',
                }}
                resizeMode="contain"
              />
              <Text
                className={`mt-1 font-oxanium-bold text-sm ${
                  activeTab === tab.name ? 'text-primary' : 'text-gray-400'
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
};
