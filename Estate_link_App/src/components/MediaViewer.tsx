import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  Linking,
  StatusBar,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
// Temporarily disabled due to compatibility issues
// import Pdf from 'react-native-pdf';
import { Ionicons } from '@expo/vector-icons';
import { getPhotoURL } from '../utils/photoUtils';
import { PDFDownloader } from './PDFDownloader';
import { OptimizedImage } from './OptimizedImage';
import {
  getResponsiveModalStyles,
  getModalSpacing,
  widthPercentage,
  heightPercentage,
  fontSizes,
  iconSizes,
} from '../utils/responsiveUtils';

interface MediaViewerProps {
  visible: boolean;
  onClose: () => void;
  attachments: Array<{
    id: number;
    file: string;
    file_name: string;
    file_type: string;
    file_url: string;
  }>;
  initialIndex?: number;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  visible,
  onClose,
  attachments,
  initialIndex = 0,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [pdfLoadError, setPdfLoadError] = useState(false);
  const [pdfViewerType, setPdfViewerType] = useState<
    'custom' | 'direct' | 'pdfjs' | 'google' | 'office' | 'fallback'
  >('custom'); // Start with custom viewer to ensure white background
  // Removed unused PDF page tracking variables

  const currentAttachment = attachments[currentIndex];

  // Get responsive styles
  const responsiveStyles = getResponsiveModalStyles();
  const modalSpacing = getModalSpacing();

  // Update currentIndex when initialIndex changes or modal opens
  useEffect(() => {
    console.log('📱 MediaViewer effect triggered:', {
      visible,
      initialIndex,
      currentIndex,
      attachmentsCount: attachments.length,
      currentAttachment: attachments[initialIndex]?.file_name,
    });

    // Always update currentIndex when initialIndex changes, regardless of modal visibility
    if (initialIndex !== currentIndex) {
      console.log('📱 Updating current index from', currentIndex, 'to', initialIndex);
      setCurrentIndex(initialIndex);
    }

    if (visible) {
      console.log('🔴 Modal opened');
      // reset swipe tracking and PDF error state when opening
      setStartX(0);
      setCurrentX(0);
      setPdfLoadError(false);
      setPdfViewerType('custom'); // Reset to custom viewer
    } else {
      console.log('🔴 Modal closed');
    }
  }, [visible, initialIndex, attachments.length]);

  // Reset currentIndex when modal is closed to ensure fresh state next time
  useEffect(() => {
    if (!visible) {
      console.log('📱 Modal closed, resetting state');
      setCurrentIndex(initialIndex);
      setPdfLoadError(false);
      setPdfViewerType('custom'); // Reset to custom viewer
    }
  }, [visible, initialIndex]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < attachments.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleClose = () => {
    console.log('🔴 Close button pressed');
    console.log('🔴 Current modal state:', { visible, currentIndex, attachmentsCount: attachments.length });
    
    // Call the onClose function to close the modal
    onClose();
  };

  const handleOpenExternal = async () => {
    if (!currentAttachment) return;

    const fileUrl = getPhotoURL(currentAttachment.file);
    if (!fileUrl) {
      Alert.alert('Error', 'Could not get file URL');
      return;
    }

    try {
      const supported = await Linking.canOpenURL(fileUrl);
      if (supported) {
        await Linking.openURL(fileUrl);
      } else {
        Alert.alert('Error', 'Cannot open this file type');
      }
    } catch (error) {
      console.error('Error opening file:', error);
      Alert.alert('Error', 'Failed to open file');
    }
  };

  // Handle swipe gestures
  const handleTouchStart = (event: any) => {
    setStartX(event.nativeEvent.pageX);
  };

  const handleTouchMove = (event: any) => {
    setCurrentX(event.nativeEvent.pageX);
  };

  const handleTouchEnd = () => {
    const swipeThreshold = 50;
    const diff = startX - currentX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0 && currentIndex < attachments.length - 1) {
        // Swipe left - go to next
        setCurrentIndex(currentIndex + 1);
      } else if (diff < 0 && currentIndex > 0) {
        // Swipe right - go to previous
        setCurrentIndex(currentIndex - 1);
      }
    }
  };

  const renderContent = () => {
    if (!currentAttachment) return null;

    if (currentAttachment.file_type === 'application/pdf') {
      const fileUrl = getPhotoURL(currentAttachment.file, currentAttachment.file_url, `MediaViewer-PDF-${currentAttachment.file_name}`);
      console.log('📄 PDF URL:', fileUrl);
      console.log('📄 Original file path:', currentAttachment.file);
      console.log('📄 File name:', currentAttachment.file_name);

      // Always show download interface for PDFs instead of preview
      return (
        <View
          className="flex-1 bg-white items-center justify-center"
          style={{ paddingHorizontal: modalSpacing.horizontal }}>
          <Ionicons name="document-text" size={iconSizes.xl * 2} color="#3C9D9B" />
          <Text
            className="text-primary font-oxanium-bold text-center"
            style={{ fontSize: fontSizes.xl, marginTop: modalSpacing.vertical }}>
            PDF Document
          </Text>
          <Text
            className="text-primary font-oxanium-bold text-center"
            style={{ fontSize: fontSizes.base, marginTop: modalSpacing.vertical / 2 }}>
            {currentAttachment.file_name}
          </Text>
          <Text
            className="text-gray-600 font-oxanium text-center"
            style={{ fontSize: fontSizes.sm, marginTop: modalSpacing.vertical, lineHeight: 20 }}>
            Tap the download button below. You'll then see sharing options to save the PDF to your preferred location.
          </Text>
          
          {/* Download Button */}
          <View style={{ marginTop: modalSpacing.vertical * 2, width: '100%', alignItems: 'center' }}>
            <PDFDownloader
              pdfUri={fileUrl || currentAttachment.file}
              fileName={currentAttachment.file_name}
              title={currentAttachment.file_name}
              size="large"
              variant="primary"
            />
          </View>
          
          {/* Alternative: Open in External App */}
          {/* <TouchableOpacity
            className="bg-gray-500 rounded-lg shadow-lg mt-4"
            style={{
              paddingHorizontal: modalSpacing.horizontal,
              paddingVertical: modalSpacing.vertical,
            }}
            onPress={handleOpenExternal}>
            <Text className="text-white font-oxanium-bold text-center" style={{ fontSize: fontSizes.base }}>
              Open in External App
            </Text>
          </TouchableOpacity> */}
        </View>
      );


    }

    // For images, show the actual image with swipe support
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    const imageUrl = getPhotoURL(currentAttachment.file, currentAttachment.file_url, `MediaViewer-${currentAttachment.file_name}`);
    
    console.log('🖼️ Rendering image:', {
      fileName: currentAttachment.file_name,
      imageUrl,
      hasUrl: !!imageUrl,
    });

    return (
      <View className="flex-1 bg-white items-center justify-center" style={{ width: '100%', height: '100%' }}>
        <View style={{ width: screenWidth * 0.9, height: screenHeight * 0.6 }}>
          <OptimizedImage
            source={{ uri: imageUrl || undefined }}
            resizeMode="contain"
            showLoadingIndicator={true}
            loadingIndicatorSize="large"
            loadingIndicatorColor="#3C9D9B"
            containerClassName="w-full h-full"
          />
        </View>
      </View>
    );
  };

  console.log('🔴 MediaViewer render:', { visible, attachmentsCount: attachments.length, currentIndex });
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      hardwareAccelerated={true}
      onRequestClose={() => {
        console.log('🔴 Modal onRequestClose triggered');
        onClose();
      }}>
      <StatusBar barStyle="dark-content" backgroundColor="rgba(0,0,0,0.3)" />
      <View className="flex-1 bg-black/40 justify-center items-center relative">
        {/* Enhanced background blur layers for beautiful effect */}
        <View className="absolute inset-0 bg-black/25 -z-1" />
        <View className="absolute inset-0 bg-black/15 -z-2" />
        <View className="absolute inset-0 bg-black/10 -z-3" />
        <View className="absolute inset-0 bg-black/5 -z-4" />
        <View className="absolute inset-0 bg-black/2 -z-5" />
        
        {/* Additional visual enhancement layers */}
        <View className="absolute inset-0 bg-black/8 -z-6" />
        <View className="absolute inset-0 bg-black/4 -z-7" />
        
        <SafeAreaView className="bg-white rounded-2xl overflow-hidden shadow-2xl border-2 border-white/30 max-h-4/5 w-11/12" style={responsiveStyles.modal}>
        {/* Header with enhanced styling */}
        <View className="flex-row items-center justify-between bg-white relative z-10 border-b border-primary/10" style={responsiveStyles.header} pointerEvents="box-none">
          <View style={responsiveStyles.controlButton} />
          
          {/* Removed the header content that showed filename and "X of Y" text */}

          <TouchableOpacity
            className="items-center justify-center p-2 w-14 h-14 z-10 bg-primary rounded-full border border-primary shadow-lg absolute top-0 right-0"
            onPress={handleClose}
            activeOpacity={0.7}
           >
            <Ionicons name="close" size={iconSizes.lg} color="white" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View
          className="flex-1"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          pointerEvents="box-none">
          {renderContent()}
          
        </View>

        {/* Navigation Controls */}
        {attachments.length > 1 && (
          <View className="flex-row items-center justify-between bg-white border-t border-primary/10" style={responsiveStyles.footer}>
            <TouchableOpacity
              className={`items-center justify-center ${currentIndex > 0 ? 'bg-primary' : 'bg-gray-500'}`}
              style={responsiveStyles.controlButton}
              onPress={handlePrevious}
              disabled={currentIndex === 0}
              activeOpacity={0.7}>
              <Ionicons
                name="chevron-back"
                size={iconSizes.md}
                color={currentIndex > 0 ? 'white' : '#666'}
              />
            </TouchableOpacity>

            <View className="flex-row items-center justify-center flex-1">
              {attachments.map((_, index) => (
                <View
                  key={index}
                  className={`rounded-full ${
                    index === currentIndex ? 'bg-primary' : 'bg-gray-500'
                  }`}
                  style={{
                    width: widthPercentage(2),
                    height: widthPercentage(2),
                    marginHorizontal: widthPercentage(0.5),
                  }}
                />
              ))}
            </View>

            <TouchableOpacity
              className={`items-center justify-center ${currentIndex < attachments.length - 1 ? 'bg-primary' : 'bg-gray-500'}`}
              style={responsiveStyles.controlButton}
              onPress={handleNext}
              disabled={currentIndex === attachments.length - 1}
              activeOpacity={0.7}>
              <Ionicons
                name="chevron-forward"
                size={iconSizes.md}
                color={currentIndex < attachments.length - 1 ? 'white' : '#666'}
              />
            </TouchableOpacity>
          </View>
        )}
        </SafeAreaView>
      </View>
    </Modal>
  );
};
