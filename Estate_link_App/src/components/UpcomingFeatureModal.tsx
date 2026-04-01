import React, { useEffect, useRef } from 'react';
import {
    Modal,
    View,
    Text,
    Pressable,
    Animated,
    TouchableWithoutFeedback,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

interface UpcomingFeatureModalProps {
    visible: boolean;
    onClose: () => void;
}

export const UpcomingFeatureModal: React.FC<UpcomingFeatureModalProps> = ({
    visible,
    onClose,
}) => {
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    useNativeDriver: true,
                    tension: 120,
                    friction: 8,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            scaleAnim.setValue(0.8);
            opacityAnim.setValue(0);
        }
    }, [visible, scaleAnim, opacityAnim]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent>
            {/* Backdrop */}
            <TouchableWithoutFeedback onPress={onClose}>
                <View className="flex-1 items-center justify-center bg-black/45">
                    {/* Prevent backdrop press from propagating through card */}
                    <TouchableWithoutFeedback>
                        <Animated.View
                            className="w-[82%] max-w-[360px] overflow-hidden rounded-3xl bg-white shadow-xl"
                            style={{
                                transform: [{ scale: scaleAnim }],
                                opacity: opacityAnim,
                                elevation: 12,
                            }}>

                            {/* Teal header strip */}
                            <View className="items-center justify-center bg-primary py-7 overflow-hidden">
                                {/* Decorative circles */}
                                <View className="absolute -top-5 -right-5 w-24 h-24 rounded-full bg-white/10" />
                                <View className="absolute -bottom-8 -left-3 w-16 h-16 rounded-full bg-white/10" />

                                {/* Icon bubble */}
                                <View className="w-[70px] h-[70px] rounded-full bg-white/20 items-center justify-center">
                                    <MaterialCommunityIcons
                                        name="rocket-launch-outline"
                                        size={36}
                                        color="#FFFFFF"
                                    />
                                </View>
                            </View>

                            {/* Body */}
                            <View className="px-6 pt-6 pb-7">
                                <Text className="font-lato-bold text-xl text-gray-900 text-center mb-2">
                                    Upcoming Feature
                                </Text>

                                <Text className="font-lato text-sm text-gray-500 text-center leading-6 mb-6">
                                    This feature is currently under development and will be available in a future update. Stay tuned!
                                </Text>

                                {/* Dismiss button */}
                                <Pressable
                                    onPress={onClose}
                                    android_ripple={{ color: '#2D7A78', borderless: false }}
                                    className="bg-primary rounded-xl py-3 items-center active:opacity-90">
                                    <Text className="font-lato-bold text-white text-base tracking-wide">
                                        Got it
                                    </Text>
                                </Pressable>
                            </View>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};
