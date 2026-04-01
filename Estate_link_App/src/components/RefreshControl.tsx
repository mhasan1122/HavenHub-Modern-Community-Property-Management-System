import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import Foundation from '@expo/vector-icons/Foundation';

interface RefreshControlProps {
    refreshing: boolean;
    onRefresh: () => void;
}

export const RefreshControl: React.FC<RefreshControlProps> = ({ refreshing, onRefresh }) => {
    if (!refreshing) return null;

    return (
        <View className="flex-row items-center justify-center py-4 bg-gray-50">
            <Foundation name="refresh" size={20} color="#3C9D9B" />
            <Text className="ml-2 font-oxanium text-text-secondary">Refreshing...</Text>
        </View>
    );
};
