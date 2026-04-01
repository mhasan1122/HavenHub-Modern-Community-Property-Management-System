import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';

interface SuccessMessageProps {
  title: string;
  message: string;
  visible: boolean;
  onClose: () => void;
}

export function SuccessMessage({ title, message, visible, onClose }: SuccessMessageProps) {
  console.log('SuccessMessage: Component rendered with visible:', visible, 'title:', title);

  const handleClose = () => {
    console.log('SuccessMessage: OK button pressed, calling onClose');
    onClose();
  };

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={handleClose}
    >
      {/* Dark overlay background */}
      <View className="flex-1 justify-center items-center px-6" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', zIndex: 9999 }}>
        <View className="bg-white rounded-2xl" style={{ 
          width: '100%',
          maxWidth: 332, 
          minHeight: 290,
          paddingHorizontal: 24, 
          paddingTop: 14, 
          paddingBottom: 24,
          shadowColor: '#000', 
          shadowOffset: { width: 0, height: 4 }, 
          shadowOpacity: 0.25, 
          shadowRadius: 16, 
          elevation: 12,
          zIndex: 10000
        }}>
          {/* Success Icon */}
          <View className="items-center mb-6">
            <View className="w-20 h-20 rounded-full justify-center items-center" style={{ backgroundColor: '#BEFEC7' }}>
              <AntDesign name="check" size={36} color="#00A81C" />
            </View>
          </View>

          {/* Title */}
          <Text className="text-center font-oxanium-bold text-text-primary mb-3" style={{ 
            fontSize: 18, 
            fontWeight: '600',
            lineHeight: 24,
            textAlign: 'center'
          }}>
            {title}
          </Text>

          {/* Message */}
          <Text className="text-center font-oxanium-medium text-text-secondary mb-8" style={{ 
            fontSize: 14, 
            lineHeight: 20,
            textAlign: 'center'
          }}>
            {message}
          </Text>

          {/* OK Button */}
          <View className="items-center">
            <TouchableOpacity
              className="rounded-xl items-center justify-center"
              style={{ 
                backgroundColor: '#3C9D9B',
                height: 40,
                width: '100%',
                maxWidth: 278
              }}
              onPress={handleClose}
            >
              <Text className="font-oxanium-bold text-white" style={{ 
                fontSize: 18, 
                fontWeight: '600',
                textAlign: 'center'
              }}>
                OK
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
} 