import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector } from '../store/hooks';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const navigation = useNavigation();
  const { isAuthenticated, accessToken, isLoading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    // If not loading and not authenticated, redirect to login
    if (!isLoading && (!isAuthenticated || !accessToken)) {
      console.log('🔒 AuthGuard: User not authenticated, redirecting to login');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' as never }],
      });
    }
  }, [isAuthenticated, accessToken, isLoading, navigation]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  // If not authenticated, don't render children
  if (!isAuthenticated || !accessToken) {
    return null;
  }

  // User is authenticated, render children
  return <>{children}</>;
};
