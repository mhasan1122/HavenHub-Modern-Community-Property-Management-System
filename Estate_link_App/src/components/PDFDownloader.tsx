import React, { useState } from 'react';
import { Text, TouchableOpacity, Alert, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { File, Directory, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

interface PDFDownloaderProps {
  pdfUri: string;
  fileName: string;
  title?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'outline';
}

export const PDFDownloader: React.FC<PDFDownloaderProps> = ({
  pdfUri,
  fileName,
  title = "PDF Document",
  size = 'medium',
  variant = 'primary'
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: 'px-3 py-2',
          text: 'text-sm',
          icon: 16
        };
      case 'large':
        return {
          container: 'px-6 py-4',
          text: 'text-lg',
          icon: 24
        };
      default:
        return {
          container: 'px-4 py-3',
          text: 'text-base',
          icon: 20
        };
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          container: 'bg-gray-500',
          text: 'text-white'
        };
      case 'outline':
        return {
          container: 'bg-white border-2 border-primary',
          text: 'text-primary'
        };
      default:
        return {
          container: 'bg-primary',
          text: 'text-white'
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const variantStyles = getVariantStyles();

  // Alternative save method using Storage Access Framework
  const saveWithStorageAccess = async (fileUri: string, fileName: string) => {
    try {
      console.log('Attempting to save file using Storage Access Framework...');
      
      // Use the sharing API with more specific options for saving
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Save ${fileName}`,
          UTI: 'com.adobe.pdf'
        });
        
        Alert.alert(
          'File Ready to Save',
          `${title} is ready to be saved. Please select "Save to Files" or "Save to Downloads" from the share menu.`,
          [{ text: 'OK' }]
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error('Storage Access Framework save failed:', error);
      return false;
    }
  };



  const downloadPDF = async () => {
    if (isDownloading) return;

    try {
      setIsDownloading(true);

      // Clean filename for safe file system usage
      const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileExtension = cleanFileName.endsWith('.pdf') ? '' : '.pdf';
      const finalFileName = `${cleanFileName}${fileExtension}`;

      console.log('Starting download from:', pdfUri);

      if (Platform.OS === 'android') {
        // Android: Download and use sharing to save
        try {
          // Generate unique filename with timestamp to avoid conflicts
          const timestamp = Date.now();
          const uniqueFileName = finalFileName.replace('.pdf', `_${timestamp}.pdf`);
          
          // Download to app's document directory first
          const tempFile = new File(Paths.document, uniqueFileName);
          
          // Check if file exists and delete it to avoid conflicts
          if (tempFile.exists) {
            console.log('File already exists, deleting:', tempFile.uri);
            await tempFile.delete();
          }
          
          const downloadResult = await File.downloadFileAsync(pdfUri, tempFile);

          if (downloadResult.exists) {
            console.log('Download successful to temp location:', downloadResult.uri);

            // Try to save to Downloads folder using MediaLibrary
            try {
              console.log('Requesting MediaLibrary permissions...');
              const { status } = await MediaLibrary.requestPermissionsAsync();
              console.log('MediaLibrary permission status:', status);
              
              // Handle Expo Go limitation warning
              if (status !== 'granted') {
                Alert.alert(
                  'Permission Required',
                  'To save files to your device, please grant media library permissions. Note: Full functionality requires a development build instead of Expo Go.',
                  [
                    { text: 'Use Share Instead', onPress: () => saveWithStorageAccess(downloadResult.uri, fileName) },
                    { text: 'OK' }
                  ]
                );
                return;
              }

              if (status === 'granted') {
                console.log('Attempting to create asset from:', downloadResult.uri);
                
                // Verify file exists and is accessible
                console.log('File info before creating asset:', {
                  exists: downloadResult.exists,
                  size: downloadResult.size,
                  uri: downloadResult.uri
                });
                
                if (!downloadResult.exists) {
                  throw new Error('Downloaded file does not exist at the specified path');
                }

                // Create asset from the downloaded file
                const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
                console.log('Asset created successfully:', asset.id);

                // Try to get or create Downloads album
                let album = await MediaLibrary.getAlbumAsync('Download');
                if (album == null) {
                  console.log('Download album not found, creating new album...');
                  album = await MediaLibrary.createAlbumAsync('Download', asset, false);
                  console.log('Created new Download album:', album.id);
                } else {
                  console.log('Found existing Download album:', album.id);
                  await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
                  console.log('Added asset to existing Download album');
                }

                console.log('File saved to Downloads folder via MediaLibrary');

                Alert.alert(
                  'Download Complete',
                  `${title} has been saved to your Downloads folder.`,
                  [
                    { text: 'OK' },
                    {
                      text: 'Open File',
                      onPress: async () => {
                        try {
                          await Linking.openURL(downloadResult.uri);
                        } catch (openError) {
                          console.log('Cannot open file directly');
                          Alert.alert('Info', 'File saved to Downloads folder. You can find it in your file manager.');
                        }
                      }
                    }
                  ]
                );
                return;
              } else {
                console.log('MediaLibrary permission not granted, status:', status);
                throw new Error(`MediaLibrary permission denied. Status: ${status}`);
              }
            } catch (mediaLibraryError) {
              console.error('MediaLibrary failed, falling back to sharing:', {
                error: mediaLibraryError instanceof Error ? mediaLibraryError.message : String(mediaLibraryError),
                code: (mediaLibraryError as any)?.code,
                stack: mediaLibraryError instanceof Error ? mediaLibraryError.stack : undefined
              });
            }

            // Fallback: Use enhanced sharing if MediaLibrary fails
            console.log('Using fallback sharing method...');
            const shareSuccess = await saveWithStorageAccess(downloadResult.uri, finalFileName);
            
            if (!shareSuccess) {
              // Last resort: basic notification with file access options
              Alert.alert(
                'Download Complete',
                `${title} has been downloaded but automatic saving failed. The file is available in the app's storage.`,
                [
                  { 
                    text: 'OK',
                    style: 'default'
                  },
                  {
                    text: 'Try Opening',
                    onPress: async () => {
                      try {
                        await Linking.openURL(downloadResult.uri);
                      } catch (openError) {
                        console.error('Cannot open file:', openError);
                        Alert.alert(
                          'Unable to Open',
                          'The file cannot be opened automatically. You can find it using a file manager app in your Downloads folder.',
                          [{ text: 'OK' }]
                        );
                      }
                    }
                  },
                  {
                    text: 'Share File',
                    onPress: async () => {
                      try {
                        const isAvailable = await Sharing.isAvailableAsync();
                        if (isAvailable) {
                          await Sharing.shareAsync(downloadResult.uri);
                        } else {
                          Alert.alert('Error', 'Sharing is not available on this device.');
                        }
                      } catch (shareError) {
                        console.error('Share error:', shareError);
                        Alert.alert('Error', 'Failed to share the file.');
                      }
                    }
                  }
                ]
              );
            }

          } else {
            throw new Error('Download failed - file does not exist after download');
          }

        } catch (androidError) {
          console.error('Android download error:', androidError);
          throw androidError;
        }

      } else {
        // iOS: Download and show with system share dialog
        // Generate unique filename with timestamp to avoid conflicts
        const timestamp = Date.now();
        const uniqueFileName = finalFileName.replace('.pdf', `_${timestamp}.pdf`);
        
        const tempFile = new File(Paths.document, uniqueFileName);
        
        // Check if file exists and delete it to avoid conflicts
        if (tempFile.exists) {
          console.log('File already exists, deleting:', tempFile.uri);
          await tempFile.delete();
        }
        
        const downloadResult = await File.downloadFileAsync(pdfUri, tempFile);

        if (downloadResult.exists) {
          console.log('iOS download successful:', downloadResult.uri);

          // Open the file directly
          const canOpen = await Linking.canOpenURL(downloadResult.uri);
          if (canOpen) {
            await Linking.openURL(downloadResult.uri);

            Alert.alert(
              'Download Complete',
              `${title} has been downloaded and opened.`,
              [{ text: 'OK' }]
            );
          } else {
            // Fallback to share dialog
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
              await Sharing.shareAsync(downloadResult.uri, {
                mimeType: 'application/pdf',
                dialogTitle: `Save ${title}`,
                UTI: 'com.adobe.pdf'
              });
            } else {
              Alert.alert('Error', 'Cannot share or open the PDF file.');
            }
          }
        } else {
          throw new Error('Download failed - file does not exist after download');
        }
      }

    } catch (error) {
      console.error('PDF Download Error:', error);
      Alert.alert(
        'Download Failed',
        'Unable to download the PDF. Please check your internet connection and try again.',
        [
          { text: 'Cancel' },
          {
            text: 'Open in Browser',
            onPress: () => {
              Linking.openURL(pdfUri).catch(() => {
                Alert.alert('Error', 'Cannot open PDF URL');
              });
            }
          }
        ]
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <TouchableOpacity
      className={`flex-row items-center justify-center rounded-lg ${sizeStyles.container} ${variantStyles.container} ${isDownloading ? 'opacity-70' : ''}`}
      onPress={downloadPDF}
      disabled={isDownloading}
      activeOpacity={0.8}
    >
      <Ionicons
        name={isDownloading ? "hourglass" : "download"}
        size={sizeStyles.icon}
        color={variant === 'outline' ? 'green' : 'white'}
      />
      <Text className={`ml-2 font-semibold ${sizeStyles.text} ${variantStyles.text}`}>
        {isDownloading ? 'Downloading...' : 'Download PDF'}
      </Text>
    </TouchableOpacity>
  );
};

// Compact version for inline use
export const PDFDownloadButton: React.FC<Omit<PDFDownloaderProps, 'size' | 'variant'>> = (props) => {
  return <PDFDownloader {...props} size="small" variant="outline" />;
};