import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PDFDownloadButton } from '../../../components/PDFDownloader';

interface BulletinPreviewProps {
  bulletin: {
    title: string;
    content: string;
    priority: string;
    target_towers: string[];
    target_units: string[];
    attachments: Array<{
      id: string;
      file: string;
      file_name: string;
      file_type: string;
    }>;
    labels: string[];
  };
  onEdit: () => void;
  onPost: () => void;
  onCancel: () => void;
}

const { width } = Dimensions.get('window');

export default function BulletinPreview({
  bulletin,
  onEdit,
  onPost,
  onCancel,
}: BulletinPreviewProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return '#3C9D9B';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'alert-circle';
      case 'medium':
        return 'information-circle';
      case 'low':
        return 'checkmark-circle';
      default:
        return 'help-circle';
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return 'image';
    if (fileType.includes('pdf')) return 'document-text';
    if (fileType.includes('word') || fileType.includes('doc')) return 'document';
    if (fileType.includes('excel') || fileType.includes('xls')) return 'grid';
    return 'document';
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="p-5 bg-white border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900 mb-1">Preview Bulletin</Text>
        <Text className="text-sm text-gray-500">Review your bulletin before posting</Text>
      </View>

      {/* Content Preview */}
      <ScrollView className="flex-1 p-5" showsVerticalScrollIndicator={false}>
        {/* Priority Badge */}
        <View className="mb-5">
          <View
            className="flex-row items-center self-start px-3 py-1.5 rounded-full"
            style={{ backgroundColor: getPriorityColor(bulletin.priority) }}
          >
            <Ionicons
              name={getPriorityIcon(bulletin.priority) as any}
              size={16}
              color="white"
            />
            <Text className="text-white text-xs font-semibold ml-1.5">
              {bulletin.priority.charAt(0).toUpperCase() + bulletin.priority.slice(1)} Priority
            </Text>
          </View>
        </View>

        {/* Title */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Title</Text>
          <Text className="text-xl font-bold text-gray-900 leading-7">{bulletin.title}</Text>
        </View>

        {/* Content */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Content</Text>
          <Text className="text-base text-gray-700 leading-6">{bulletin.content}</Text>
        </View>

        {/* Target Audience */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Target Audience</Text>
          <View className="gap-3">
            {bulletin.target_towers.length > 0 && (
              <View className="flex-row items-center p-3 bg-white rounded-lg border border-gray-200">
                <Ionicons name="business" size={16} color="#6b7280" />
                <Text className="ml-2 text-sm text-gray-700">
                  {bulletin.target_towers.length} Tower(s)
                </Text>
              </View>
            )}
            {bulletin.target_units.length > 0 && (
              <View className="flex-row items-center p-3 bg-white rounded-lg border border-gray-200">
                <Ionicons name="home" size={16} color="#6b7280" />
                <Text className="ml-2 text-sm text-gray-700">
                  {bulletin.target_units.length} Unit(s)
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Labels */}
        {bulletin.labels.length > 0 && (
          <View className="mb-6">
            <Text className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Labels</Text>
            <View className="flex-row flex-wrap gap-2">
              {bulletin.labels.map((label, index) => (
                <View key={index} className="bg-teal-500 px-3 py-1.5 rounded-2xl">
                  <Text className="text-white text-xs font-medium">{label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Attachments */}
        {bulletin.attachments.length > 0 && (
          <View className="mb-6">
            <Text className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Attachments</Text>
            <View className="gap-2">
              {bulletin.attachments.map((attachment) => (
                <View key={attachment.id} className="flex-row items-center p-3 bg-white rounded-lg border border-gray-200">
                  <View className="w-10 h-10 rounded-lg bg-gray-100 items-center justify-center mr-3">
                    <Ionicons
                      name={getFileIcon(attachment.file_type) as any}
                      size={20}
                      color="#6b7280"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm text-gray-700" numberOfLines={1}>
                      {attachment.file_name}
                    </Text>
                    {attachment.file_type === 'application/pdf' && (
                      <View className="mt-2">
                        <PDFDownloadButton
                          pdfUri={attachment.file}
                          fileName={attachment.file_name}
                          title={attachment.file_name}
                        />
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View className="flex-row p-5 bg-white border-t border-gray-200 gap-3">
        <TouchableOpacity className="flex-1 py-3 px-4 rounded-lg border border-gray-300 items-center" onPress={onCancel}>
          <Text className="text-gray-500 text-sm font-medium">Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-1 flex-row items-center justify-center py-3 px-4 rounded-lg border border-blue-500 bg-white gap-1.5" onPress={onEdit}>
          <Ionicons name="create" size={16} color="#3b82f6" />
          <Text className="text-blue-500 text-sm font-medium">Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-2 flex-row items-center justify-center py-3 px-4 rounded-lg bg-emerald-500 gap-1.5" onPress={onPost}>
          <Ionicons name="send" size={16} color="white" />
          <Text className="text-white text-sm font-semibold">Post Bulletin</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
