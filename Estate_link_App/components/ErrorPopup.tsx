import React from 'react';
import { View, Text, TouchableOpacity, Modal, Dimensions, Platform } from 'react-native';

// Get screen dimensions for responsive design
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ErrorPopupProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  buttonText?: string;
}

export default function ErrorPopup({ 
  visible, 
  onClose, 
  title = "Error!", 
  message = "Please fill in all required fields.",
  buttonText = "OK"
}: ErrorPopupProps) {
  
  // Responsive dimensions
  const popupWidth = screenWidth > 400 ? 360 : 320;
  const iconSize = screenWidth > 400 ? 44 : 40;
  const titleSize = screenWidth > 400 ? 22 : 20;
  const messageSize = screenWidth > 400 ? 17 : 16;
  const buttonHeight = Platform.OS === 'ios' ? 52 : 48;
  
  const handleClose = () => {
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
          maxWidth: popupWidth,
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
          {/* Error Icon - Red circle with white X */}
          <View style={{ 
            alignItems: 'center', 
            marginBottom: 24 
          }}>
            <View style={{ 
              width: iconSize * 2, 
              height: iconSize * 2, 
              borderRadius: iconSize,
              backgroundColor: '#DC2626', // Red background
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              {/* White X shape */}
              <View style={{
                width: iconSize * 1.2,
                height: iconSize * 1.2,
                backgroundColor: 'white',
                borderRadius: 10,
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                {/* X using text */}
                <Text style={{
                  color: '#1f2937',
                  fontSize: iconSize * 0.7,
                  fontWeight: 'bold',
                  lineHeight: iconSize * 0.7
                }}>
                  ✕
                </Text>
              </View>
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
            fontFamily: 'Oxanium-Regular',
            color: '#6b7280',
            textAlign: 'center',
            marginBottom: 32,
            lineHeight: messageSize * 1.4,
            paddingHorizontal: 8
          }}>
            {message}
          </Text>

          {/* OK Button */}
          <TouchableOpacity
            style={{ 
              backgroundColor: '#DC2626',
              borderRadius: 16,
              height: buttonHeight,
              justifyContent: 'center',
              alignItems: 'center'
            }}
            onPress={handleClose}
            activeOpacity={0.8}
          >
            <Text style={{ 
              fontFamily: 'Oxanium-Bold',
              color: 'white',
              fontSize: Platform.OS === 'ios' ? 17 : 16,
              fontWeight: '600',
              textTransform: 'uppercase'
            }}>
              {buttonText}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
