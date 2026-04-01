import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width: screenWidth } = Dimensions.get('window');

export type UpdatePopupState = 'available' | 'downloading' | 'downloaded';

interface UpdatePopupProps {
  visible: boolean;
  state: UpdatePopupState;
  onDownload: () => void;
  onRestart: () => void;
  onLater: () => void;
}

const PRIMARY_COLOR = '#3C9D9B';

export default function UpdatePopup({
  visible,
  state,
  onDownload,
  onRestart,
  onLater,
}: UpdatePopupProps) {
  const iconSize = screenWidth > 400 ? 44 : 40;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={state === 'downloading' ? () => {} : onLater}
    >
      <View className="flex-1 justify-center items-center px-6 bg-black/60 z-[9999]">
        <View
          className="bg-white rounded-[20px] w-full max-w-[360px] px-6 pt-6 pb-7 shadow-xl"
          style={{ elevation: 12 }}>
          {/* Icon */}
          <View className="items-center mb-6">
            <View
              className="rounded-full bg-primary justify-center items-center"
              style={{ width: iconSize * 2, height: iconSize * 2 }}>
              {state === 'downloading' ? (
                <ActivityIndicator size="large" color="white" />
              ) : (
                <Ionicons
                  name={state === 'downloaded' ? 'checkmark-circle' : 'cloud-download'}
                  size={iconSize}
                  color="white"
                />
              )}
            </View>
          </View>

          {/* Title */}
          <Text className="font-oxanium-bold text-xl text-gray-900 text-center mb-4">
            {state === 'available' && 'Update Available'}
            {state === 'downloading' && 'Downloading...'}
            {state === 'downloaded' && 'Update Ready'}
          </Text>

          {/* Message */}
          <Text className="font-oxanium text-base text-gray-500 text-center mb-8 px-2 leading-6">
            {state === 'available' &&
              'A new version of the app is available. Would you like to download it now?'}
            {state === 'downloading' && 'Please wait while we download the update...'}
            {state === 'downloaded' &&
              'The update has been downloaded. Restart the app to use the new version.'}
          </Text>

          {/* Buttons */}
          {state === 'available' && (
            <View className="flex-row gap-4">
              <TouchableOpacity
                className="flex-1 border-2 border-primary rounded-2xl h-12 justify-center items-center bg-transparent"
                onPress={onLater}
                activeOpacity={0.8}>
                <Text className="font-oxanium-bold text-primary text-base uppercase">
                  Later
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-primary rounded-2xl h-12 justify-center items-center"
                onPress={onDownload}
                activeOpacity={0.8}>
                <Text className="font-oxanium-bold text-white text-base uppercase">
                  Download
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {state === 'downloading' && (
            <View className="items-center py-2">
              <ActivityIndicator size="small" color={PRIMARY_COLOR} />
            </View>
          )}

          {state === 'downloaded' && (
            <View className="flex-row gap-4">
              <TouchableOpacity
                className="flex-1 border-2 border-primary rounded-2xl h-12 justify-center items-center bg-transparent"
                onPress={onLater}
                activeOpacity={0.8}>
                <Text className="font-oxanium-bold text-primary text-base uppercase">
                  Later
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-primary rounded-2xl h-12 justify-center items-center"
                onPress={onRestart}
                activeOpacity={0.8}>
                <Text className="font-oxanium-bold text-white text-base uppercase">
                  Restart App
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
