import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNetworkChange } from '../hooks/useNetworkChange';

export const NetworkStatusIndicator: React.FC = () => {
  const { networkStatus, isHandlingChange, handleNetworkChange, forceRediscovery } = useNetworkChange();

  const handleManualNetworkChange = async () => {
    try {
      const success = await handleNetworkChange();
      if (success) {
        Alert.alert('Success', 'Network change handled successfully!');
      } else {
        Alert.alert('Error', 'Failed to handle network change. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred.');
    }
  };

  const handleForceRediscovery = async () => {
    try {
      const success = await forceRediscovery();
      if (success) {
        Alert.alert('Success', 'Network rediscovery successful!');
      } else {
        Alert.alert('Error', 'Network rediscovery failed. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred.');
    }
  };

  const getStatusColor = () => {
    if (networkStatus.isConnected) return '#4CAF50'; // Green
    if (networkStatus.retryCount > 0) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const getStatusText = () => {
    if (networkStatus.isConnected) return 'Connected';
    if (networkStatus.retryCount > 0) return 'Retrying...';
    return 'Disconnected';
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
        <Text style={styles.statusText}>{getStatusText()}</Text>
      </View>
      
      {networkStatus.lastKnownIP && (
        <Text style={styles.ipText}>Backend: {networkStatus.lastKnownIP}</Text>
      )}
      
      <Text style={styles.retryText}>Retry Count: {networkStatus.retryCount}</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleManualNetworkChange}
          disabled={isHandlingChange}
        >
          <Text style={styles.buttonText}>
            {isHandlingChange ? 'Handling...' : 'Handle Network Change'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleForceRediscovery}
          disabled={isHandlingChange}
        >
          <Text style={styles.buttonText}>
            {isHandlingChange ? 'Rediscovering...' : 'Force Rediscovery'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    margin: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  ipText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  retryText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  primaryButton: {
    backgroundColor: '#2196F3',
  },
  secondaryButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});
