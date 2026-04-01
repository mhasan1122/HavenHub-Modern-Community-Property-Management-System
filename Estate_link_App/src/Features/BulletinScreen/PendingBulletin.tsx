import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBulletinsRedux } from '../../hooks/useBulletinsRedux';
import { useAppSelector } from '../../store/hooks';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BulletinCard } from './BulletinCard';

interface PendingBulletinProps {
    navigation: any;
}

export default function PendingBulletin({ navigation }: PendingBulletinProps) {
    const [refreshing, setRefreshing] = useState(false);
    const { user } = useAppSelector((state) => state.auth);

    // Use bulletins hook for pending bulletins
    const {
        bulletins: pendingBulletins,
        loading: bulletinsLoading,
        error: bulletinsError,
        fetchBulletins,
        approveBulletin,
        rejectBulletin,
        hasLoadedOnce: bulletinsHasLoadedOnce
    } = useBulletinsRedux({ status: 'pending', my_posts: true });

    // Fetch pending bulletins when component mounts or when focused
    useEffect(() => {
        console.log('🔄 PendingBulletin: Component mounted, fetching pending bulletins');
        fetchBulletins();
    }, [fetchBulletins]);

    // Force refresh when coming from edit (in case of navigation from edit)
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            console.log('🔄 PendingBulletin: Screen focused, refreshing bulletins');
            fetchBulletins();
        });

        return unsubscribe;
    }, [navigation, fetchBulletins]);

    const handleManualRefresh = async () => {
        setRefreshing(true);
        try {
            console.log('🔄 PendingBulletin: Manual refresh triggered');
            await fetchBulletins();
        } catch (error) {
            console.error('Error during refresh:', error);
        } finally {
            setRefreshing(false);
        }
    };

    const handleApproveBulletin = async (bulletinId: number) => {
        Alert.alert(
            'Approve Bulletin',
            'Are you sure you want to approve this bulletin?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Approve',
                    onPress: async () => {
                        try {
                            console.log('✅ Approving bulletin:', bulletinId);

                            // Use Redux action to approve bulletin
                            await approveBulletin(bulletinId);

                            Alert.alert(
                                'Success',
                                'Bulletin approved successfully!',
                                [
                                    {
                                        text: 'OK',
                                        onPress: () => {
                                            // Navigate back to BulletinBoard
                                            navigation.goBack();
                                        }
                                    }
                                ]
                            );
                        } catch (error) {
                            console.error('❌ Error approving bulletin:', error);
                            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to approve bulletin');
                        }
                    }
                }
            ]
        );
    };

    const handleRejectBulletin = async (bulletinId: number) => {
        Alert.alert(
            'Reject Bulletin',
            'Are you sure you want to reject this bulletin?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    onPress: async () => {
                        try {
                            console.log('❌ Rejecting bulletin:', bulletinId);

                            // Use Redux action to reject bulletin
                            await rejectBulletin(bulletinId);

                            Alert.alert(
                                'Success',
                                'Bulletin rejected successfully!',
                                [
                                    {
                                        text: 'OK',
                                        onPress: () => {
                                            // Navigate back to BulletinBoard
                                            navigation.goBack();
                                        }
                                    }
                                ]
                            );
                        } catch (error) {
                            console.error('❌ Error rejecting bulletin:', error);
                            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to reject bulletin');
                        }
                    }
                }
            ]
        );
    };

    const handleEditBulletin = (bulletin: any) => {
        // Navigate to edit form
        (navigation as any).navigate('EditBulletin', { bulletinId: bulletin.id.toString() });
    };

    return (
        <View className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" backgroundColor="white" />

            <SafeAreaView className="flex-1 bg-white">
                {/* Header - Matching CreateBulletin style */}
                <View className="flex-row items-center border-b border-gray-100 bg-white px-4 py-4">
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        className="mr-4"
                        activeOpacity={0.7}>
                        <Ionicons
                            name="arrow-back"
                            size={22}
                            color="black"
                        />
                    </TouchableOpacity>
                    <Text className="font-lato-bold text-xl text-text-primary flex-1">
                        Pending Bulletin {pendingBulletins.length > 0 ? `(${pendingBulletins.length})` : ''}
                    </Text>
                </View>

                {/* Main Content - Matching CreateBulletin padding and positioning */}
                <ScrollView
                    className="flex-1 px-6 py-6"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 120 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleManualRefresh}
                            colors={['#3C9D9B']}
                            tintColor="#3C9D9B"
                        />
                    }>

                    {/* Debug Info */}
                    {(() => {
                        console.log('🔍 PendingBulletin Render:', {
                            pendingBulletinsCount: pendingBulletins.length,
                            loading: bulletinsLoading,
                            hasLoaded: bulletinsHasLoadedOnce,
                            error: bulletinsError
                        });
                        return null;
                    })()}

                    {/* Loading State */}
                    {bulletinsLoading && !bulletinsHasLoadedOnce ? (
                        <View className="py-8 items-center justify-center min-h-40">
                            <ActivityIndicator
                                size="large"
                                color="#3C9D9B"
                            />
                            <Text className="mt-2 font-lato text-text-secondary text-center">
                                Loading pending bulletins...
                            </Text>
                        </View>
                    ) : pendingBulletins.length === 0 ? (
                        <View className="py-8 items-center justify-center min-h-50">
                            <Ionicons
                                name="checkmark-circle-outline"
                                size={64}
                                color="#9CA3AF"
                            />
                            <Text className="mt-4 font-lato-bold text-lg text-text-secondary text-center">
                                No Pending Bulletins
                            </Text>
                            <Text className="mt-2 font-lato text-text-secondary text-center px-8">
                                You have no pending bulletins. Your bulletins have been reviewed or none are awaiting approval.
                            </Text>
                            {bulletinsError && (
                                <Text className="mt-2 font-lato text-red-500 text-center px-8">
                                    Error: {bulletinsError}
                                </Text>
                            )}
                        </View>
                    ) : (
                        <View>
                            {pendingBulletins.map((bulletin, index) => (
                                <View
                                    key={bulletin.id}
                                    className="mb-6"
                                    style={{
                                        marginBottom: index === pendingBulletins.length - 1 ? 40 : 24
                                    }}
                                >
                                    {/* Main Bulletin Card */}
                                    <BulletinCard
                                        bulletin={bulletin}
                                        isMainDisplay={true}
                                        currentUserId={user?.id?.toString()}
                                    />

                                    {/* Action Buttons */}
                                    <View className="flex-row mt-4 space-x-3">
                                        <TouchableOpacity
                                            className="flex-1 bg-green-500 px-6 py-4 rounded-lg flex-row items-center justify-center"
                                            onPress={() => handleApproveBulletin(bulletin.id)}
                                            activeOpacity={0.8}>
                                            <Ionicons
                                                name="checkmark"
                                                size={20}
                                                color="white"
                                                style={{ marginRight: 8 }}
                                            />
                                            <Text className="font-lato-bold text-lg text-white">Approve</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            className="flex-1 bg-red-500 px-6 py-4 rounded-lg flex-row items-center justify-center"
                                            onPress={() => handleRejectBulletin(bulletin.id)}
                                            activeOpacity={0.8}>
                                            <Ionicons
                                                name="close"
                                                size={20}
                                                color="white"
                                                style={{ marginRight: 8 }}
                                            />
                                            <Text className="font-lato-bold text-lg text-white">Reject</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            className="bg-blue-500 px-6 py-4 rounded-lg flex-row items-center justify-center"
                                            onPress={() => handleEditBulletin(bulletin)}
                                            activeOpacity={0.8}>
                                            <Ionicons
                                                name="create"
                                                size={20}
                                                color="white"
                                            />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Pending Status Badge */}
                                    <View className="mt-3 bg-yellow-100 border border-yellow-300 px-3 py-2 rounded-lg self-start">
                                        <Text className="font-lato-bold text-yellow-700 text-sm">
                                            ⏳ Pending Review
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
