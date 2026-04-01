import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getBulletinHistory } from '../../../services/bulletinService';
import { useAppSelector } from '../../../store/hooks';

interface BulletinHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  bulletin: {
    id: string;
    title: string;
    description: string;
    status: string;
    history: Array<{
      id: string;
      action: string;
      comment?: string;
      edited_at: string;
      edited_by_name: string;
      changes?: any;
    }>;
    created_at: string;
    author: string;
    post_as?: string;
    group_name?: string;
    member_name?: string;
    creator_name?: string;
  };
}



export default function BulletinHistoryModal({
  visible,
  onClose,
  bulletin,
}: BulletinHistoryModalProps) {
  const { accessToken } = useAppSelector((state) => state.auth);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [fetchedHistory, setFetchedHistory] = useState<Array<{
    id: string | number;
    action: string;
    comment?: string;
    edited_at: string;
    edited_by_name: string;
    changes?: any;
  }>>([]);

  // Fetch history when modal opens
  useEffect(() => {
    if (visible && bulletin.id) {
      const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
          console.log('📡 Fetching history for bulletin:', bulletin.id);
          const history = await getBulletinHistory(Number(bulletin.id), accessToken || undefined);
          console.log('✅ History fetched:', history.length, 'entries');
          setFetchedHistory(history);
        } catch (error) {
          console.error('❌ Error fetching history:', error);
          setFetchedHistory([]);
        } finally {
          setLoadingHistory(false);
        }
      };
      
      fetchHistory();
    } else {
      // Reset when modal closes
      setFetchedHistory([]);
    }
  }, [visible, bulletin.id, accessToken]);

  // Format date to match web version (DD-MM-YYYY at HH:MM am/pm)
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const period = hours >= 12 ? 'pm' : 'am';
      return `${day}-${month}-${year} at ${hour12}:${minutes}${period}`;
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Get action type display text
  const getActionType = (action: string) => {
    switch (action.toLowerCase()) {
      case 'created':
        return 'Creation';
      case 'updated':
        return 'Edit';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'repost':
        return 'Repost';
      case 'comment':
        return 'Comment';
      default:
        return action;
    }
  };

  // Get action label text
  const getActionLabel = (action: string) => {
    switch (action.toLowerCase()) {
      case 'created':
        return 'Created by';
      case 'updated':
        return 'Edited by';
      case 'approved':
        return 'Approved by';
      case 'rejected':
        return 'Rejected by';
      case 'repost':
        return 'Reposted by';
      case 'comment':
        return '';
      default:
        return '';
    }
  };

  // Get bulletin history with filtering for specific actions
  const processedBulletinHistory = () => {
    // Use fetched history first, fallback to bulletin.history if available
    const historySource = fetchedHistory.length > 0 ? fetchedHistory : (bulletin.history || []);
    
    // Debug: Log bulletin data received
    console.log('🔍 BulletinHistoryModal - Processing history:', {
      id: bulletin.id,
      title: bulletin.title,
      fetchedHistoryLength: fetchedHistory.length,
      bulletinHistoryLength: bulletin.history?.length || 0,
      usingFetchedHistory: fetchedHistory.length > 0,
      historySource: historySource
    });

    const history: Array<{
      id: string;
      type: string;
      action: string;
      user: string;
      timestamp: string;
      date: string;
      comment: string | null;
      changes: any;
      isRejected: boolean;
    }> = [];

    if (historySource && Array.isArray(historySource)) {
      console.log('✅ Processing history:', historySource.length, 'entries');
      historySource.forEach((entry, index) => {
        console.log(`📝 History entry ${index}:`, entry);
        const allowedActions = ['rejected', 'updated', 'approved', 'created'];
        
        if (allowedActions.includes(entry.action.toLowerCase())) {
          // Check if this is a comment-only action
          const isSystemMessage = entry.comment?.trim().startsWith('Bulletin updated by');
          const isCommentOnly = entry.comment && entry.comment.trim() && !isSystemMessage && 
            (!entry.changes || entry.changes === null || entry.changes === '' || 
            (typeof entry.changes === 'object' && Object.keys(entry.changes).length === 0));

          // If it's comment-only, just add the comment entry
          if (isCommentOnly && entry.comment && !entry.comment.trim().startsWith('Bulletin pinned by') && 
              !entry.comment.trim().startsWith('Bulletin unpinned by')) {
            history.push({
              id: `comment-${entry.id || index}`,
              type: 'Comment',
              action: '',
              user: entry.edited_by_name || 'Unknown User',
              timestamp: entry.edited_at,
              date: formatDate(entry.edited_at),
              comment: entry.comment,
              changes: null,
              isRejected: false
            });
          } else {
            // This is an actual action
            let actionType = getActionType(entry.action);
            let actionLabel = getActionLabel(entry.action);

            // Special handling for updates from pending bulletin
            if (entry.action === 'updated' && entry.changes?.source_tab === '2') {
              actionType = 'Repost';
              actionLabel = 'Repost by';
            }

            history.push({
              id: `history-${entry.id || index}`,
              type: actionType,
              action: actionLabel,
              user: entry.edited_by_name || 'Unknown User',
              timestamp: entry.edited_at,
              date: formatDate(entry.edited_at),
              comment: null,
              changes: entry.changes,
              isRejected: entry.action === 'rejected'
            });

            // Add separate comment entry if comment exists for actual actions
            if (entry.comment && entry.comment.trim() && !isSystemMessage && 
                !entry.comment.trim().startsWith('Bulletin pinned by') && 
                !entry.comment.trim().startsWith('Bulletin unpinned by')) {
              history.push({
                id: `comment-${entry.id || index}`,
                type: 'Comment',
                action: '',
                user: entry.edited_by_name || 'Unknown User',
                timestamp: entry.edited_at,
                date: formatDate(entry.edited_at),
                comment: entry.comment,
                changes: null,
                isRejected: false
              });
            }
          }
        }
      });
    } else {
      console.warn('⚠️ No history data available:', {
        hasHistory: !!bulletin.history,
        historyType: typeof bulletin.history,
        bulletinId: bulletin.id
      });
    }

    // Add creation entry at the end
    if (bulletin.created_at) {
      const getCreationAuthorName = () => {
        switch (bulletin.post_as) {
          case 'group':
            return bulletin.group_name || bulletin.author || 'Unknown Group';
          case 'member':
            return bulletin.member_name || bulletin.author || 'Unknown Member';
          default:
            return bulletin.creator_name || bulletin.author || 'Unknown User';
        }
      };

      history.push({
        id: `creation-${bulletin.id}`,
        type: 'Creation',
        action: 'Created by',
        user: getCreationAuthorName(),
        timestamp: bulletin.created_at,
        date: formatDate(bulletin.created_at),
        comment: null,
        changes: null,
        isRejected: false
      });
    }

    // Sort history to show latest first
    const sortedHistory = history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    console.log('📊 Final processed history:', sortedHistory.length, 'entries');
    return sortedHistory;
  };

  // Calculate dynamic height for timeline dots based on content
  const calculateDotHeight = (entry: any, index: number, historyArray: any[]) => {
    if (index >= historyArray.length - 1) return 0;

    // Base height calculation similar to web version
    // space-y-8 = 32px between entries
    let baseHeight = 32;

    // Calculate content height for current entry
    let contentHeight = 80; // Base content height (header + user info + padding + dot)

    // Add extra height for comment entries
    if (entry.type === 'Comment' && entry.comment) {
      const commentText = entry.comment.trim();
      const wordCount = commentText.split(/\s+/).length;

      // More accurate height calculation based on word count and line wrapping
      // Assume ~10-12 words per line in the comment area, with ~20px per line
      const estimatedLines = Math.ceil(wordCount / 10);
      const commentHeight = Math.max(estimatedLines * 20, 20);

      contentHeight += commentHeight + 12; // Add comment height + margin

      // Add extra padding for longer comments
      if (wordCount > 30) {
        contentHeight += 36; // Extra spacing for very long comments
      }
    }

    // Add extra height for entries with long user names
    if (entry.user && entry.user.length > 20) {
      contentHeight += 18;
    }

    // Add extra height for entries with action text and comments for non-comment entries
    if (entry.action && entry.action.length > 10) {
      contentHeight += -20;
    }

    // Add comment height for non-comment entries that have comments
    if (entry.type !== 'Comment' && entry.comment) {
      const commentText = entry.comment.trim();
      const wordCount = commentText.split(/\s+/).length;
      const estimatedLines = Math.ceil(wordCount / 10);
      const commentHeight = Math.max(estimatedLines * 20, 20);
      contentHeight += commentHeight + 12; // Add comment height + margin
    }

    // Total height is the content height plus the base spacing
    return contentHeight + baseHeight;
  };

  const history = React.useMemo(() => processedBulletinHistory(), [bulletin, fetchedHistory]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-center py-5">
        <View className="bg-white rounded-[28px] mx-4 h-4/5 overflow-hidden">
          {/* Header */}
          <View className="flex-row justify-between items-center px-6 py-5 border-b border-gray-200">
            <Text className="text-2xl font-semibold text-black">History</Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <View className="w-9 h-9 rounded-full bg-primary justify-center items-center">
                <Ionicons name="close" size={24} color="white" />
              </View>
            </TouchableOpacity>
          </View>

          {/* History List */}
          <ScrollView className="flex-1 px-6 pt-5" showsVerticalScrollIndicator={false}>
            {loadingHistory ? (
              <View className="flex-1 justify-center items-center py-8">
                <ActivityIndicator size="large" color="#3C9D9B" />
                <Text className="mt-4 text-gray-500 font-lato">Loading history...</Text>
              </View>
            ) : (
              <View className="relative pb-5">
                {history.length > 0 ? (
                history.map((entry, index) => (
                  <View key={entry.id} className="flex-row mb-8">
                    {/* Left side - Timeline dot and line */}
                    <View className="w-5 items-center relative">
                      {/* Timeline Dot */}
                      <View 
                        className="w-3 h-3 rounded-full mt-1"
                        style={{
                          backgroundColor: entry.isRejected ? '#FF8E8E' : '#3C9D9B'
                        }}
                      />
                      
                      {/* Timeline Line */}
                      {index < history.length - 1 && (
                        <View 
                          className="absolute w-0.5"
                          style={{ 
                            height: calculateDotHeight(entry, index, history),
                            top: 10, // Position below the dot (mt-1 = 4px + dot height 6px + 2px gap)
                            left: 8, // Perfectly center the line with the dot (5.75px from left edge)
                            backgroundColor: entry.isRejected ? '#FF8E8E' : '#3C9D9B'
                          }}
                        />
                      )}
                    </View>

                    {/* Right side - Content */}
                    <View className="flex-1 ml-3">
                      {/* Action Type */}
                      <View className="flex-row justify-between items-center mb-2">
                        <Text 
                          className="text-base font-medium"
                          style={{
                            color: entry.isRejected ? '#FF8E8E' : '#3C9D9B'
                          }}
                        >
                          {entry.type}
                        </Text>
                        <Text className="text-xs text-gray-500">
                          {entry.date}
                        </Text>
                      </View>

                      {/* Action Label and User */}
                      {entry.type === 'Comment' ? (
                        <>
                          {/* Comment text first */}
                          {entry.comment && (
                            <Text className="text-sm text-black mt-2 mb-2">
                              {entry.comment}
                            </Text>
                          )}
                          {/* User info below comment */}
                          <View className="flex-row items-center mb-2">
                            <View className="bg-gray-100 px-3 py-1 rounded">
                              <Text className="text-sm text-primary">{entry.user}</Text>
                            </View>
                          </View>
                        </>
                      ) : (
                        <>
                          {/* User info for non-comment entries */}
                          <View className="flex-row items-center mb-2">
                            <Text className="text-sm text-black mr-2">
                              {entry.action}
                            </Text>
                            <View className="bg-gray-100 px-3 py-1 rounded">
                              <Text className="text-sm text-primary">{entry.user}</Text>
                            </View>
                          </View>
                          {/* Comment display for non-comment entries */}
                          {entry.comment && (
                            <Text className="text-sm text-black mt-3 mb-2">
                              {entry.comment}
                            </Text>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <Text className="text-center text-gray-500 py-4">No history available</Text>
              )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}


