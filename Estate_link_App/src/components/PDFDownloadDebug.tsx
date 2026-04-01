import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export const PDFDownloadDebug: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebugInfo = (info: string) => {
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${info}`]);
  };

  const clearDebugInfo = () => {
    setDebugInfo([]);
  };

  const testDownload = async () => {
    clearDebugInfo();
    addDebugInfo('Starting download test...');

    try {
      // Test FileSystem availability
      addDebugInfo(`FileSystem.documentDirectory: ${FileSystem.documentDirectory}`);
      
      // Test Sharing availability
      const sharingAvailable = await Sharing.isAvailableAsync();
      addDebugInfo(`Sharing available: ${sharingAvailable}`);

      // Test download
      const testUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
      const fileName = 'test-download.pdf';
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      addDebugInfo(`Downloading from: ${testUrl}`);
      addDebugInfo(`Saving to: ${fileUri}`);

      const downloadResult = await FileSystem.downloadAsync(testUrl, fileUri);
      
      addDebugInfo(`Download status: ${downloadResult.status}`);
      addDebugInfo(`Download URI: ${downloadResult.uri}`);

      if (downloadResult.status === 200) {
        addDebugInfo('Download successful!');
        
        // Check file info
        const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
        addDebugInfo(`File exists: ${fileInfo.exists}`);
        if (fileInfo.exists && 'size' in fileInfo) {
          addDebugInfo(`File size: ${fileInfo.size} bytes`);
        }

        if (sharingAvailable) {
          addDebugInfo('Attempting to share...');
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Save Test PDF'
          });
          addDebugInfo('Share dialog opened');
        }
      } else {
        addDebugInfo(`Download failed with status: ${downloadResult.status}`);
      }

    } catch (error) {
      addDebugInfo(`Error: ${error}`);
      console.error('Debug test error:', error);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white p-4">
      <Text className="text-2xl font-bold text-center mb-6">PDF Download Debug</Text>
      
      <View className="mb-4">
        <TouchableOpacity
          className="bg-blue-500 px-4 py-3 rounded-lg mb-2"
          onPress={testDownload}
        >
          <View className="flex-row items-center justify-center">
            <Ionicons name="bug" size={20} color="white" />
            <Text className="text-white font-semibold ml-2">Run Download Test</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          className="bg-gray-500 px-4 py-2 rounded-lg"
          onPress={clearDebugInfo}
        >
          <Text className="text-white font-semibold text-center">Clear Debug Info</Text>
        </TouchableOpacity>
      </View>

      <View className="bg-gray-100 p-4 rounded-lg">
        <Text className="font-bold mb-2">Debug Information:</Text>
        {debugInfo.length === 0 ? (
          <Text className="text-gray-500 italic">No debug information yet. Run a test to see details.</Text>
        ) : (
          debugInfo.map((info, index) => (
            <Text key={index} className="text-sm mb-1 font-mono">
              {info}
            </Text>
          ))
        )}
      </View>
    </ScrollView>
  );
};