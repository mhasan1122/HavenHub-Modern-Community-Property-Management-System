import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';

interface AttachmentDebugProps {
  attachments: any[];
  title?: string;
}

export const AttachmentDebug: React.FC<AttachmentDebugProps> = ({ 
  attachments, 
  title = 'Attachments Debug' 
}) => {
  if (!attachments || attachments.length === 0) {
    return (
      <View className="mx-4 mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <Text className="font-oxanium-bold text-yellow-700 mb-1">{title}</Text>
        <Text className="font-oxanium text-yellow-600 text-sm">No attachments found</Text>
      </View>
    );
  }

  const handleDebugPress = () => {
    const debugInfo = attachments.map((att, index) => ({
      index,
      id: att.id,
      file_name: att.file_name,
      file_type: att.file_type,
      file_url: att.file_url,
      file_size: att.file_size,
      has_file_url: !!att.file_url,
      url_length: att.file_url?.length || 0
    }));

    Alert.alert(
      'Attachment Debug Info',
      JSON.stringify(debugInfo, null, 2),
      [{ text: 'OK' }]
    );
  };

  return (
    <TouchableOpacity 
      className="mx-4 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg"
      onPress={handleDebugPress}
    >
      <Text className="font-oxanium-bold text-blue-700 mb-1">{title}</Text>
      <Text className="font-oxanium text-blue-600 text-sm">
        Count: {attachments.length} | 
        First: {attachments[0]?.file_name || 'N/A'} | 
        Type: {attachments[0]?.file_type || 'N/A'}
      </Text>
      <Text className="font-oxanium text-blue-500 text-xs mt-1">
        Tap to see full debug info
      </Text>
    </TouchableOpacity>
  );
};
