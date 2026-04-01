import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface UnblockUserModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  userName: string;
  cancelText?: string;
  confirmText?: string;
  isLoading?: boolean;
}

const PRIMARY_TEAL = '#3C9D9B';

export default function UnblockUserModal({
  visible,
  onClose,
  onConfirm,
  userName,
  cancelText = 'Cancel',
  confirmText = 'Unblock',
  isLoading = false,
}: UnblockUserModalProps) {
  const message = `Are you sure you want to unblock ${userName}? They will be able to see your activity and you will see theirs again.`;

  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 9999,
        }}
      >
        <View
          style={{
            backgroundColor: 'white',
            borderRadius: 20,
            width: '100%',
            maxWidth: 340,
            paddingHorizontal: 24,
            paddingTop: 20,
            paddingBottom: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 16,
            elevation: 12,
            zIndex: 10000,
          }}
        >
          {/* Unblock icon */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: PRIMARY_TEAL,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="person-add-outline" size={40} color="white" />
            </View>
          </View>

          <Text
            style={{
              fontSize: 20,
              fontFamily: 'Oxanium-Bold',
              color: '#1f2937',
              textAlign: 'center',
              marginBottom: 12,
              fontWeight: '700',
            }}
          >
            Unblock User
          </Text>

          <Text
            style={{
              fontSize: 16,
              fontFamily: 'Oxanium',
              color: '#6b7280',
              textAlign: 'center',
              marginBottom: 24,
              lineHeight: 22,
            }}
          >
            {message}
          </Text>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                borderWidth: 2,
                borderColor: isLoading ? '#9CA3AF' : '#374151',
                borderRadius: 12,
                height: 48,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'transparent',
                opacity: isLoading ? 0.5 : 1,
              }}
              onPress={onClose}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              <Text
                style={{
                  fontFamily: 'Oxanium-Bold',
                  color: isLoading ? '#9CA3AF' : '#374151',
                  fontSize: 16,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                }}
              >
                {cancelText}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: isLoading ? '#9CA3AF' : PRIMARY_TEAL,
                borderRadius: 12,
                height: 48,
                justifyContent: 'center',
                alignItems: 'center',
                opacity: isLoading ? 0.7 : 1,
              }}
              onPress={handleConfirm}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              <Text
                style={{
                  fontFamily: 'Oxanium-Bold',
                  color: 'white',
                  fontSize: 16,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                }}
              >
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
