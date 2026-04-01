import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { getCurrentConfig, getBackendURL, getFallbackURLs } from '../../config/environment';
import { performHealthCheck, performEnhancedHealthCheck } from '../../utils/healthCheck';

type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  AnnouncementNotice: undefined;
  Info: undefined;
  Services: undefined;
  Feed: undefined;
  Activity: undefined;
};

type TestAnnouncementScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AnnouncementNotice'>;

interface TestResult {
  url: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  responseTime?: number;
}

export default function TestAnnouncement() {
  const navigation = useNavigation<TestAnnouncementScreenNavigationProp>();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<any>(null);
  
  console.log('TestAnnouncement component is rendering');

  useEffect(() => {
    // Load current configuration
    const config = getCurrentConfig();
    setCurrentConfig(config);
    console.log('Current config loaded:', config);
  }, []);

  const testSingleURL = async (url: string): Promise<TestResult> => {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Testing URL: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${url}/`, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      if (response.ok || response.status < 500) {
        return {
          url,
          status: 'success',
          message: `✅ Connected (${response.status})`,
          responseTime,
        };
      } else {
        return {
          url,
          status: 'error',
          message: `❌ HTTP Error: ${response.status}`,
          responseTime,
        };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      let message = '❌ Connection failed';
      
      if (error.name === 'AbortError') {
        message = '⏰ Timeout (>5s)';
      } else if (error.message?.includes('Network request failed')) {
        message = '❌ Network error';
      } else if (error.message?.includes('fetch')) {
        message = '❌ Fetch error';
      }
      
      return {
        url,
        status: 'error',
        message,
        responseTime,
      };
    }
  };

  const runAllTests = async () => {
    setIsTesting(true);
    setTestResults([]);
    
    const urlsToTest = [
      getBackendURL(),
      ...getFallbackURLs(),
    ];
    
    console.log('🧪 Starting network tests for URLs:', urlsToTest);
    
    const results: TestResult[] = [];
    
    for (const url of urlsToTest) {
      // Add pending result
      const pendingResult: TestResult = {
        url,
        status: 'pending',
        message: '⏳ Testing...',
      };
      
      setTestResults(prev => [...prev, pendingResult]);
      
      // Test the URL
      const result = await testSingleURL(url);
      
      // Update the result
      setTestResults(prev => 
        prev.map(r => r.url === url ? result : r)
      );
      
      results.push(result);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setIsTesting(false);
    
    // Show summary
    const successfulConnections = results.filter(r => r.status === 'success');
    if (successfulConnections.length > 0) {
      Alert.alert(
        '✅ Connection Test Complete',
        `Found ${successfulConnections.length} working backend URL(s)!\n\nBest URL: ${successfulConnections[0].url}`,
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        '❌ Connection Test Failed',
        'No backend URLs are accessible. Please check:\n\n1. Django server is running\n2. IP address is correct\n3. Network configuration',
        [{ text: 'OK' }]
      );
    }
  };

  const testHealthCheck = async () => {
    try {
      console.log('🏥 Running health check...');
      const result = await performHealthCheck();
      console.log('Health check result:', result);
      
      Alert.alert(
        '🏥 Health Check Result',
        `Status: ${result.isHealthy ? '✅ Healthy' : '❌ Unhealthy'}\n\nMessage: ${result.message}\n\nResponse Time: ${result.responseTime}ms`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Health check failed:', error);
      Alert.alert('❌ Health Check Failed', String(error));
    }
  };

  const testEnhancedHealthCheck = async () => {
    try {
      console.log('🔍 Running enhanced health check...');
      const result = await performEnhancedHealthCheck();
      console.log('Enhanced health check result:', result);
      
      Alert.alert(
        '🔍 Enhanced Health Check Result',
        `Status: ${result.isHealthy ? '✅ Healthy' : '❌ Unhealthy'}\n\nMessage: ${result.message}\n\nResponse Time: ${result.responseTime}ms`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Enhanced health check failed:', error);
      Alert.alert('❌ Enhanced Health Check Failed', String(error));
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: 'white', padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 20, textAlign: 'center', fontWeight: 'bold' }}>
        🔧 Network Test & Debug
      </Text>
      
      {/* Current Configuration */}
      {currentConfig && (
        <View style={{ marginBottom: 20, padding: 15, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>📱 Current Configuration</Text>
          <Text>Environment: {currentConfig.BACKEND_URL ? 'DEV' : 'LOCAL'}</Text>
          <Text>Primary URL: {Array.isArray(currentConfig.BACKEND_URL) ? currentConfig.BACKEND_URL[0] : currentConfig.BACKEND_URL}</Text>
          <Text>Timeout: {currentConfig.API_TIMEOUT}ms</Text>
          <Text>Auto-discovery: {currentConfig.AUTO_DISCOVERY ? 'Enabled' : 'Disabled'}</Text>
        </View>
      )}
      
      {/* Test Buttons */}
      <View style={{ marginBottom: 20 }}>
        <TouchableOpacity 
          onPress={runAllTests}
          disabled={isTesting}
          style={{ 
            padding: 15, 
            backgroundColor: isTesting ? '#ccc' : '#3C9D9B', 
            borderRadius: 8, 
            marginBottom: 10 
          }}
        >
          <Text style={{ color: 'white', fontSize: 16, textAlign: 'center' }}>
            {isTesting ? '🧪 Testing...' : '🧪 Test All URLs'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={testHealthCheck}
          style={{ 
            padding: 15, 
            backgroundColor: '#4CAF50', 
            borderRadius: 8, 
            marginBottom: 10 
          }}
        >
          <Text style={{ color: 'white', fontSize: 16, textAlign: 'center' }}>
            🏥 Basic Health Check
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={testEnhancedHealthCheck}
          style={{ 
            padding: 15, 
            backgroundColor: '#FF9800', 
            borderRadius: 8, 
            marginBottom: 10 
          }}
        >
          <Text style={{ color: 'white', fontSize: 16, textAlign: 'center' }}>
            🔍 Enhanced Health Check
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Test Results */}
      {testResults.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>📊 Test Results</Text>
          {testResults.map((result, index) => (
            <View 
              key={index} 
              style={{ 
                padding: 10, 
                backgroundColor: result.status === 'success' ? '#e8f5e8' : 
                               result.status === 'error' ? '#ffe8e8' : '#f0f0f0',
                borderRadius: 8,
                marginBottom: 8
              }}
            >
              <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>{result.url}</Text>
              <Text style={{ color: result.status === 'success' ? 'green' : 
                                   result.status === 'error' ? 'red' : 'gray' }}>
                {result.message}
              </Text>
              {result.responseTime && (
                <Text style={{ fontSize: 12, color: 'gray', marginTop: 5 }}>
                  Response time: {result.responseTime}ms
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
      
      {/* Back Button */}
      <TouchableOpacity 
        onPress={() => navigation.goBack()}
        style={{ padding: 15, backgroundColor: '#666', borderRadius: 8 }}
      >
        <Text style={{ color: 'white', fontSize: 16, textAlign: 'center' }}>
          ← Go Back to Dashboard
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
