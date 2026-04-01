import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface DeleteConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  cancelText?: string;
  confirmText?: string;
  isLoading?: boolean;
}

export default function DeleteConfirmationModal({ 
  visible, 
  onClose, 
  onConfirm,
  title = "Are you sure ?",
  message = "You want to Delete this Bulletin.",
  cancelText = "Cancel",
  confirmText = "Confirm",
  isLoading = false
}: DeleteConfirmationModalProps) {
  
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
          maxWidth: 340,
          paddingHorizontal: 24,
          paddingTop: 20,
          paddingBottom: 24,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 16,
          elevation: 12,
          zIndex: 10000
        }}>
          {/* Archive Icon */}
          <View style={{ 
            alignItems: 'center', 
            marginBottom: 20 
          }}>
            <View style={{ 
              width: 80, 
              height: 80, 
              borderRadius: 40,
              backgroundColor: '#3C9D9B',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <Ionicons name="archive-outline" size={40} color="white" />
            </View>
          </View>

          {/* Title */}
          <Text style={{ 
            fontSize: 20,
            fontFamily: 'Oxanium-Bold',
            color: '#1f2937',
            textAlign: 'center',
            marginBottom: 12,
            fontWeight: '700'
          }}>
            {title}
          </Text>

          {/* Message */}
          <Text style={{ 
            fontSize: 16,
            fontFamily: 'Oxanium',
            color: '#6b7280',
            textAlign: 'center',
            marginBottom: 24,
            lineHeight: 22
          }}>
            {message}
          </Text>

          {/* Buttons Container */}
          <View style={{
            flexDirection: 'row',
            gap: 12
          }}>
            {/* Cancel Button */}
            <TouchableOpacity
              style={{ 
                flex: 1,
                borderWidth: 2,
                borderColor: isLoading ? '#9CA3AF' : '#3C9D9B',
                borderRadius: 12,
                height: 48,
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
                fontSize: 16,
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
                borderRadius: 12,
                height: 48,
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
                fontSize: 16,
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