import React from 'react';
import { View, Text, TouchableOpacity, Modal, Dimensions, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

// Get screen dimensions for responsive design
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface LogoutConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  cancelText?: string;
  confirmText?: string;
  isLoading?: boolean;
}

export default function LogoutConfirmationModal({ 
  visible, 
  onClose, 
  onConfirm,
  title = "Log Out",
  message = "Are you sure you want to log out?",
  cancelText = "Cancel",
  confirmText = "Log Out",
  isLoading = false
}: LogoutConfirmationModalProps) {
  
  // Responsive dimensions
  const modalWidth = screenWidth > 400 ? 360 : 320;
  const iconSize = screenWidth > 400 ? 44 : 40;
  const titleSize = screenWidth > 400 ? 22 : 20;
  const messageSize = screenWidth > 400 ? 17 : 16;
  const buttonHeight = Platform.OS === 'ios' ? 52 : 48;
  
  const handleCancel = () => {
    onClose();
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      {/* Dark overlay background */}
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        paddingHorizontal: 24,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 9999 
      }}>
        <View style={{ 
          backgroundColor: 'white',
          borderRadius: 20,
          width: '100%',
          maxWidth: modalWidth,
          paddingHorizontal: 24,
          paddingTop: 24,
          paddingBottom: 28,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 16,
          elevation: 12,
          zIndex: 10000
        }}>
          {/* Logout Icon */}
          <View style={{ 
            alignItems: 'center', 
            marginBottom: 24 
          }}>
            <View style={{ 
              width: iconSize * 2, 
              height: iconSize * 2, 
              borderRadius: iconSize,
              backgroundColor: '#3C9D9B',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <Ionicons name="log-out-outline" size={iconSize} color="white" />
            </View>
          </View>

          {/* Title */}
          <Text style={{ 
            fontSize: titleSize,
            fontFamily: 'Oxanium-Bold',
            color: '#1f2937',
            textAlign: 'center',
            marginBottom: 16,
            fontWeight: '700',
            lineHeight: titleSize * 1.2
          }}>
            {title}
          </Text>

          {/* Message */}
          <Text style={{ 
            fontSize: messageSize,
            fontFamily: 'Oxanium',
            color: '#6b7280',
            textAlign: 'center',
            marginBottom: 32,
            lineHeight: messageSize * 1.4,
            paddingHorizontal: 8
          }}>
            {message}
          </Text>

          {/* Buttons Container */}
          <View style={{
            flexDirection: 'row',
            gap: 16
          }}>
            {/* Cancel Button */}
            <TouchableOpacity
              style={{ 
                flex: 1,
                borderWidth: 2,
                borderColor: isLoading ? '#9CA3AF' : '#3C9D9B',
                borderRadius: 16,
                height: buttonHeight,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'transparent',
                opacity: isLoading ? 0.5 : 1
              }}
              onPress={handleCancel}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              <Text style={{ 
                fontFamily: 'Oxanium-Bold',
                color: isLoading ? '#9CA3AF' : '#3C9D9B',
                fontSize: Platform.OS === 'ios' ? 17 : 16,
                fontWeight: '600',
                textTransform: 'uppercase'
              }}>
                {cancelText}
              </Text>
            </TouchableOpacity>

            {/* Confirm Button */}
            <TouchableOpacity
              style={{ 
                flex: 1,
                backgroundColor: isLoading ? '#9CA3AF' : '#3C9D9B',
                borderRadius: 16,
                height: buttonHeight,
                justifyContent: 'center',
                alignItems: 'center',
                opacity: isLoading ? 0.7 : 1
              }}
              onPress={handleConfirm}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              <Text style={{ 
                fontFamily: 'Oxanium-Bold',
                color: 'white',
                fontSize: Platform.OS === 'ios' ? 17 : 16,
                fontWeight: '600',
                textTransform: 'uppercase'
              }}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}