import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { ServiceCard } from './ServiceCard';
import { servicesData } from './servicesData';
// UPCOMING - Commented out
// import { UpcomingFeatureModal } from '../../../components/UpcomingFeatureModal';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSwipeToHome } from '../../../hooks/useSwipeToHome';

type RootStackParamList = {
  [key: string]: any;
};

type AllServicesNavigationProp = StackNavigationProp<RootStackParamList>;

export const AllServices: React.FC = () => {
  const navigation = useNavigation<AllServicesNavigationProp>();
  // UPCOMING - Commented out
  // const [upcomingModalVisible, setUpcomingModalVisible] = useState(false);
  const panGesture = useSwipeToHome();

  const handleServicePress = (route: string, params?: any) => {
    // Find the service that was clicked
    const clickedService = servicesData.find(service => service.route === route);

    // UPCOMING - Commented out (upcoming services removed from servicesData)
    // if (clickedService?.isComingSoon) {
    //   setUpcomingModalVisible(true);
    //   return;
    // }

    // Log when Notice Board is clicked
    if (clickedService?.title === 'Notice Board') {
      console.log('📋 Notice Board clicked', {
        route,
        params,
        serviceId: clickedService.id,
        timestamp: new Date().toISOString(),
      });
    }

    // Special handling for Dashboard navigation
    if (route === 'Dashboard') {
      console.log('🏠 Navigating to Dashboard - using goBack to return to main tab navigator');
      // Go back to the Dashboard tab (BottomTabNavigator)
      // This works because Services is accessed from Dashboard
      navigation.goBack();
      return;
    }

    if (params) {
      navigation.navigate(route, params);
    } else {
      navigation.navigate(route);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={panGesture}>
        <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1 bg-white"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 20,
          paddingBottom: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View className="mb-6">
          <Text className="font-lato-bold text-2xl text-black">
            All Services
          </Text>
        </View>

        {/* Services Grid */}
        <View className="flex-row flex-wrap" style={{ gap: 16 }}>
          {servicesData.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onPress={handleServicePress}
            />
          ))}
        </View>
      </ScrollView>

      {/* UPCOMING - Commented out */}
      {/* <UpcomingFeatureModal
        visible={upcomingModalVisible}
        onClose={() => setUpcomingModalVisible(false)}
      /> */}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};
