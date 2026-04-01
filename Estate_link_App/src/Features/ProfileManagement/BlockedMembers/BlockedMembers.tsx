import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppSelector } from '../../../store/hooks';
import { getBackendURL } from '../../../config/environment';
import { getPhotoURL } from '../../../utils/photoUtils';
import { UnblockUserModal, BlockUnblockSuccessPopup } from '../../BulletinScreen/components';

type RootStackParamList = {
  ProfileManagementSettings: undefined;
  BlockedMembers: undefined;
};

type BlockedMembersNavigationProp = StackNavigationProp<RootStackParamList, 'BlockedMembers'>;

interface BlockedMember {
  id: number;
  full_name: string;
  photo: string | null;
  blocked_at: string;
}

export function BlockedMembers() {
  const navigation = useNavigation<BlockedMembersNavigationProp>();
  const { accessToken } = useAppSelector((state) => state.auth);
  const [blockedMembers, setBlockedMembers] = useState<BlockedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unblockingId, setUnblockingId] = useState<number | null>(null);
  const [unblockModalMember, setUnblockModalMember] = useState<BlockedMember | null>(null);
  const [showUnblockSuccessPopup, setShowUnblockSuccessPopup] = useState(false);
  const [unblockSuccessName, setUnblockSuccessName] = useState('');

  const fetchBlockedMembers = useCallback(async () => {
    try {
      const response = await fetch(`${getBackendURL()}/user/blocked_members/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-App-Source': 'mobile',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setBlockedMembers(data);
      }
    } catch (error) {
      console.error('Error fetching blocked members:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchBlockedMembers();
  }, [fetchBlockedMembers]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBlockedMembers();
  };

  const handleUnblockPress = (member: BlockedMember) => {
    setUnblockModalMember(member);
  };

  const handleUnblockConfirm = async () => {
    if (!unblockModalMember) return;
    const member = unblockModalMember;
    setUnblockingId(member.id);
    try {
      const response = await fetch(
        `${getBackendURL()}/user/unblock/${member.id}/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'X-App-Source': 'mobile',
          },
        }
      );
      if (response.ok) {
        setBlockedMembers((prev) => prev.filter((m) => m.id !== member.id));
        setUnblockModalMember(null);
        setUnblockSuccessName(member.full_name);
        setShowUnblockSuccessPopup(true);
      } else {
        const result = await response.json();
        setUnblockModalMember(null);
        Alert.alert('Error', result.error || 'Failed to unblock user.');
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
      setUnblockModalMember(null);
      Alert.alert('Error', 'Failed to unblock user. Please try again.');
    } finally {
      setUnblockingId(null);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderMember = ({ item }: { item: BlockedMember }) => {
    const photoUrl = item.photo ? getPhotoURL(item.photo) : null;
    const isUnblocking = unblockingId === item.id;

    return (
      <View className="bg-white flex-row items-center px-4 py-3 border-b border-gray-100">
        {/* Avatar */}
        <View className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 items-center justify-center">
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              className="w-12 h-12 rounded-full"
              resizeMode="cover"
            />
          ) : (
            <Text className="font-oxanium-bold text-lg text-gray-500">
              {getInitials(item.full_name)}
            </Text>
          )}
        </View>

        {/* Name and date */}
        <View className="flex-1 ml-3">
          <Text className="font-lato-bold text-base text-gray-900">{item.full_name}</Text>
          <Text className="font-lato text-xs text-gray-400 mt-0.5">
            Blocked {formatDate(item.blocked_at)}
          </Text>
        </View>

        {/* Unblock button */}
        <TouchableOpacity
          className="bg-red-50 px-4 py-2 rounded-lg border border-red-200"
          onPress={() => handleUnblockPress(item)}
          disabled={isUnblocking}
          activeOpacity={0.7}
        >
          {isUnblocking ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <Text className="font-lato-bold text-sm text-red-500">Unblock</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View className="flex-1 items-center justify-center py-20">
        <Ionicons name="people-outline" size={64} color="#d1d5db" />
        <Text className="font-oxanium-bold text-lg text-gray-400 mt-4">No Blocked Members</Text>
        <Text className="font-lato text-sm text-gray-400 mt-1 text-center px-8">
          You haven't blocked anyone yet. You can block users from bulletin cards.
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center px-4 py-4 border-b border-gray-100">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="flex-row items-center"
          >
            <Ionicons name="arrow-back" size={24} color="#3C9D9B" />
            <Text className="font-oxanium-bold text-xl text-gray-900 ml-3">
              Blocked Members
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View className="flex-1 bg-gray-50">
          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#3C9D9B" />
              <Text className="font-lato text-gray-400 mt-3">Loading...</Text>
            </View>
          ) : (
            <FlatList
              data={blockedMembers}
              renderItem={renderMember}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={renderEmpty}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#3C9D9B']} />
              }
              contentContainerStyle={blockedMembers.length === 0 ? { flex: 1 } : undefined}
            />
          )}
        </View>

        <UnblockUserModal
          visible={!!unblockModalMember}
          onClose={() => setUnblockModalMember(null)}
          onConfirm={handleUnblockConfirm}
          userName={unblockModalMember?.full_name ?? ''}
          confirmText={unblockingId === unblockModalMember?.id ? 'Unblocking...' : 'Unblock'}
          isLoading={unblockingId === unblockModalMember?.id}
        />

        <BlockUnblockSuccessPopup
          visible={showUnblockSuccessPopup}
          onClose={() => setShowUnblockSuccessPopup(false)}
          title="Unblocked"
          message={`${unblockSuccessName} has been unblocked.`}
          buttonText="OK"
          variant="unblock"
        />
      </SafeAreaView>
    </View>
  );
}
