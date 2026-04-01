import React from 'react';
import { Image, Platform, StatusBar, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { Dashboard } from '../src/Features/DashboardScreen/Dashboard';
import { Info } from '../src/Features/InfoScreen/Info';
import { AllServices } from '../src/Features/Services/AllServices/AllServices';
import AnnouncementNotice from '../src/Features/Announcement&NoticeScreen/AnnouncementNotice';
import { Activity } from '../src/Features/ActivityScreen/Activity';
import { Header } from './Header';

const Tab = createBottomTabNavigator();

export const BottomTabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  
  // Calculate proper tab bar height based on safe area
  const getTabBarHeight = () => {
    const baseHeight = 60;
    const bottomInset = insets.bottom > 0 ? insets.bottom : 0;
    
    // For Android with button navigation (no bottom inset), add extra padding
    if (Platform.OS === 'android' && bottomInset === 0) {
      return baseHeight + 8; // Add small padding for button navigation
    }
    
    return baseHeight + bottomInset;
  };

  // Calculate proper padding
  const getTabBarPaddingBottom = () => {
    if (Platform.OS === 'ios') {
      return insets.bottom > 0 ? Math.max(insets.bottom - 10, 8) : 8;
    }
    
    // Android: For gesture navigation (has bottom inset), reduce padding
    // For button navigation (no bottom inset), use standard padding
    if (insets.bottom > 0) {
      return Math.max(insets.bottom - 5, 5);
    }
    return 8; // Standard padding for button navigation
  };
  
  return (
    <View className="flex-1 bg-white">
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="transparent" 
        translucent={true}
      />
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        {/* Shared Header - persists across all tabs */}
        <Header />
        
        {/* Tab Navigator */}
        <Tab.Navigator
        screenOptions={({ route }): BottomTabNavigationOptions => ({
          headerShown: false,
          tabBarActiveTintColor: '#3C9D9B',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarStyle: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#ffffff',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            height: getTabBarHeight(),
            paddingBottom: getTabBarPaddingBottom(),
            paddingTop: 8,
            paddingHorizontal: 0,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
            // Ensure tab bar stays above system navigation
            zIndex: 999,
          },
        tabBarLabelStyle: {
          fontFamily: 'Oxanium-Bold',
          fontSize: 11,
          marginTop: -2,
          marginBottom: 2,
        },
        tabBarIconStyle: {
          marginTop: 4,
          marginBottom: 0,
        },
        tabBarIcon: ({ focused, color }) => {
          let iconSource;

          // Map route names to icons
          const iconMap: Record<string, any> = {
            Home: require('../assets/Home.png'),
            Info: require('../assets/Info.png'),
            AllServices: require('../assets/Services.png'),
            AnnouncementNotice: require('../assets/Feed.png'),
            Activity: require('../assets/Activity.png'),
          };

          iconSource = iconMap[route.name] || require('../assets/Home.png');

          return (
            <Image
              source={iconSource}
              style={{
                width: 24,
                height: 24,
                tintColor: color,
              }}
              resizeMode="contain"
            />
          );
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={Dashboard}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen 
        name="Info" 
        component={Info}
        options={{
          tabBarLabel: 'Info',
        }}
      />
      <Tab.Screen 
        name="AllServices" 
        component={AllServices}
        options={{
          tabBarLabel: 'Services',
        }}
      />
      <Tab.Screen 
        name="AnnouncementNotice" 
        component={AnnouncementNotice}
        options={{
          tabBarLabel: 'Feed',
        }}
      />
      <Tab.Screen 
        name="Activity" 
        component={Activity}
        options={{
          tabBarLabel: 'Activity',
        }}
      />
        </Tab.Navigator>
      </SafeAreaView>
    </View>
  );
};

// Export the component as default as well for flexibility
export default BottomTabNavigator;
