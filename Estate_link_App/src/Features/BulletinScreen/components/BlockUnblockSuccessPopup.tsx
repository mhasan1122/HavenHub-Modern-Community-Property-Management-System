import React from 'react';
import { View, Text, TouchableOpacity, Modal, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface BlockUnblockSuccessPopupProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText?: string;
  variant?: 'block' | 'unblock';
}

const PRIMARY_TEAL = '#3C9D9B';
const SUCCESS_GREEN = '#166534';

export default function BlockUnblockSuccessPopup({
  visible,
  onClose,
  title,
  message,
  buttonText = 'OK',
  variant = 'block',
}: BlockUnblockSuccessPopupProps) {
  const iconBg = variant === 'block' ? SUCCESS_GREEN : PRIMARY_TEAL;
  const buttonHeight = Platform.OS === 'ios' ? 52 : 48;

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
            maxWidth: 360,
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 28,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 16,
            elevation: 12,
            zIndex: 10000,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: iconBg,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="checkmark-circle" size={48} color="white" />
            </View>
          </View>

          <Text
            style={{
              fontSize: 20,
              fontFamily: 'Oxanium-Bold',
              color: '#1f2937',
              textAlign: 'center',
              marginBottom: 16,
              fontWeight: '700',
            }}
          >
            {title}
          </Text>

          <Text
            style={{
              fontSize: 16,
              fontFamily: 'Oxanium',
              color: '#6b7280',
              textAlign: 'center',
              marginBottom: 32,
              lineHeight: 22,
              paddingHorizontal: 8,
            }}
          >
            {message}
          </Text>

          <TouchableOpacity
            style={{
              backgroundColor: PRIMARY_TEAL,
              borderRadius: 16,
              height: buttonHeight,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text
              style={{
                fontFamily: 'Oxanium-Bold',
                color: 'white',
                fontSize: Platform.OS === 'ios' ? 17 : 16,
                fontWeight: '600',
                textTransform: 'uppercase',
              }}
            >
              {buttonText}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
