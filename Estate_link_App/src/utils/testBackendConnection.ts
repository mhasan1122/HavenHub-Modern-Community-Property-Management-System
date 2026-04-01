import { getBackendURL } from '../config/environment';
import { Platform } from 'react-native';

export const logNetworkInfo = (): void => {
  const baseURL = getBackendURL();
  console.log('🌐 Network Configuration:');
  console.log('  Base URL:', baseURL);
  console.log('  Environment:', process.env.NODE_ENV || 'development');
  console.log('  Platform:', Platform.OS);
  console.log('  Network Info:', {
    baseURL,
    timestamp: new Date().toISOString(),
  });
};

// Helper function to login and get token
const authenticateUser = async (baseURL: string): Promise<string | null> => {
  try {
    console.log('🔐 Attempting community member authentication...');
    
    // Community member login credentials - using actual user data
    const loginData = {
      authenticator: 'mirzahasanlimon619@gmail.com', // Your actual email
      password: 'your-password',                     // Replace with your actual password
      login_type: 'comm'                             // Community member login
    };

    console.log('📧 Login attempt for:', loginData.authenticator);

    const response = await fetch(`${baseURL}/user/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Community member authentication successful');
      console.log('👤 Member info:', {
        full_name: data.member?.full_name,
        is_comm_member: data.member?.is_comm_member,
        permission_ids: data.permission_ids
      });
      return data.access_token;
    } else {
      const errorText = await response.text();
      console.log('❌ Community member authentication failed:', response.status);
      console.log('❌ Error details:', errorText);
      
      if (response.status === 403) {
        console.log('⚠️ Access denied - user may not have community member permissions');
      } else if (response.status === 400) {
        console.log('⚠️ Bad request - check credentials or request format');
      }
      return null;
    }
  } catch (error) {
    console.error('❌ Authentication error:', error);
    return null;
  }
};

export const testBackendConnection = async (): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  const baseURL = getBackendURL();
  console.log('🔍 Testing backend connection to:', baseURL);

  try {
    // Test 1: Basic connectivity - using GET instead of HEAD
    console.log('📡 Testing basic connectivity...');
    const controller1 = new AbortController();
    const timeoutId1 = setTimeout(() => controller1.abort(), 5000);
    
    const response = await fetch(`${baseURL}/user/check_status/`, {
      method: 'GET', // Changed from HEAD to GET
      signal: controller1.signal,
    });
    
    clearTimeout(timeoutId1);

    if (response.ok || response.status < 500) {
      console.log('✅ Basic connectivity successful');
    } else {
      console.log('⚠️ Basic connectivity - unexpected status:', response.status);
    }

    // Test 2: Authenticate user
    console.log('🔐 Testing authentication...');
    const token = await authenticateUser(baseURL);
    
    if (!token) {
      console.log('⚠️ Authentication failed - APIs will return 401');
      return {
        success: false,
        message: 'Authentication required to access API data',
        details: {
          baseURL,
          connectivity: 'OK',
          authentication: 'Failed',
          note: 'Provide valid credentials in authenticateUser function'
        }
      };
    }

    // Test 3: Announcements endpoint with authentication
    console.log('📢 Testing announcements endpoint with auth...');
    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), 5000);
    
    const announcementsResponse = await fetch(`${baseURL}/api/announcements/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: controller2.signal,
    });
    
    clearTimeout(timeoutId2);

    console.log('📊 Announcements endpoint status:', announcementsResponse.status);
    if (announcementsResponse.ok) {
      const data = await announcementsResponse.json();
      console.log('✅ Announcements endpoint working, data count:', Array.isArray(data) ? data.length : 'N/A');
      console.log('📋 Sample announcement:', data[0] || 'No announcements found');
    } else {
      const errorText = await announcementsResponse.text();
      console.log('❌ Announcements endpoint error:', errorText);
    }

    // Test 4: Noticeboard endpoint with authentication
    console.log('📋 Testing noticeboard endpoint with auth...');
    const controller3 = new AbortController();
    const timeoutId3 = setTimeout(() => controller3.abort(), 5000);
    
    const noticesResponse = await fetch(`${baseURL}/api/noticeboard/notices/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: controller3.signal,
    });
    
    clearTimeout(timeoutId3);

    console.log('📊 Noticeboard endpoint status:', noticesResponse.status);
    if (noticesResponse.ok) {
      const data = await noticesResponse.json();
      console.log('✅ Noticeboard endpoint working, data count:', Array.isArray(data) ? data.length : 'N/A');
      console.log('📋 Sample notice:', data[0] || 'No notices found');
    } else {
      const errorText = await noticesResponse.text();
      console.log('❌ Noticeboard endpoint error:', errorText);
    }

    return {
      success: true,
      message: 'Backend connection test completed successfully with authentication',
      details: {
        baseURL,
        connectivity: 'OK',
        authentication: 'Success',
        announcementsStatus: announcementsResponse.status,
        noticesStatus: noticesResponse.status,
        token: token.substring(0, 20) + '...' // Log partial token for debugging
      }
    };

  } catch (error: any) {
    console.error('❌ Backend connection test failed:', error);
    
    let message = 'Unknown error occurred';
    if (error.name === 'AbortError') {
      message = 'Request timed out - backend server may be unreachable';
    } else if (error.message?.includes('Network request failed')) {
      message = 'Network request failed - check your internet connection';
    } else if (error.message?.includes('fetch')) {
      message = 'Fetch error - backend server may be down';
    } else {
      message = error.message || 'Connection test failed';
    }

    return {
      success: false,
      message,
      details: {
        baseURL,
        error: error.message,
        errorName: error.name,
      }
    };
  }
};

export const getBackendStatus = async (): Promise<string> => {
  try {
    const result = await testBackendConnection();
    return result.success ? '🟢 Connected' : '🔴 Disconnected';
  } catch (error) {
    return '🔴 Error';
  }
};