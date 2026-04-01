import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface PinPostProps {
  isPinned: boolean;
  onPin: () => void;
  onUnpin: () => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export default function PinPost({
  isPinned,
  onPin,
  onUnpin,
  disabled = false,
  size = 'medium',
}: PinPostProps) {
  const handlePress = () => {
    if (disabled) return;

    if (isPinned) {
      Alert.alert(
        'Unpin Bulletin',
        'Are you sure you want to unpin this bulletin?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unpin', style: 'destructive', onPress: onUnpin },
        ]
      );
    } else {
      onPin();
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: { padding: 8 },
          icon: 16,
          text: { fontSize: 12 },
        };
      case 'large':
        return {
          container: { padding: 16 },
          icon: 24,
          text: { fontSize: 16 },
        };
      default:
        return {
          container: { padding: 12 },
          icon: 20,
          text: { fontSize: 14 },
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        sizeStyles.container,
        isPinned && styles.pinned,
        disabled && styles.disabled,
      ]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Ionicons
        name={isPinned ? 'pin' : 'pin-outline'}
        size={sizeStyles.icon}
        color={isPinned ? '#f59e0b' : '#6b7280'}
      />
      <Text
        style={[
          styles.text,
          sizeStyles.text,
          isPinned && styles.pinnedText,
          disabled && styles.disabledText,
        ]}
      >
        {isPinned ? 'Pinned' : 'Pin'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 6,
  },
  pinned: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: '#6b7280',
    fontWeight: '500',
  },
  pinnedText: {
    color: '#92400e',
  },
  disabledText: {
    color: '#9ca3af',
  },
});
