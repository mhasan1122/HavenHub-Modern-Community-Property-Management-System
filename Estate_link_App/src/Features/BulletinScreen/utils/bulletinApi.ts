import { Platform } from 'react-native';
import { 
  Bulletin, 
  BulletinFormData, 
  BulletinStatus, 
  Tower, 
  Unit 
} from './bulletinUtils';

// API configuration
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8000/api' 
  : 'https://your-production-api.com/api';

const API_ENDPOINTS = {
  bulletins: '/api/bulletins/',
  bulletin: (id: string) => `/api/bulletins/${id}/`,
  bulletinHistory: (id: string) => `/api/bulletins/${id}/history/`,
  bulletinPin: (id: string) => `/api/bulletins/${id}/pin/`,
  bulletinApprove: (id: string) => `/api/bulletins/${id}/approve/`,
  bulletinReject: (id: string) => `/api/bulletins/${id}/reject/`,
  bulletinArchive: (id: string) => `/api/bulletins/${id}/archive/`,
  bulletinRestore: (id: string) => `/api/bulletins/${id}/restore/`,
  bulletinViews: (id: string) => `/api/bulletins/${id}/views/`,
  towers: '/api/towers/',
  units: '/api/units/',
  unitsByTower: (towerId: string) => `/api/towers/${towerId}/units/`,
  labels: '/api/labels/',
  uploadAttachment: '/api/attachments/upload/',
};

// Request headers
const getHeaders = (includeAuth = true) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (includeAuth) {
    // Get token from secure storage or context
    const token = getAuthToken(); // You'll need to implement this
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
};

// Get auth token (implement based on your auth system)
const getAuthToken = (): string | null => {
  // This should be implemented based on your authentication system
  // You might use AsyncStorage, SecureStore, or a context provider
  return null;
};

// Generic API request function
const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API request failed for ${endpoint}:`, error);
    throw error;
  }
};

// Bulletin API functions
export const bulletinApi = {
  // Get all bulletins with optional filters
  async getBulletins(params: {
    status?: BulletinStatus;
    priority?: string;
    creator_id?: string;
    tower_id?: string;
    unit_id?: string;
    search?: string;
    page?: number;
    page_size?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}): Promise<{
    results: Bulletin[];
    count: number;
    next: string | null;
    previous: string | null;
  }> {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value.toString());
      }
    });

    const endpoint = `${API_ENDPOINTS.bulletins}?${queryParams.toString()}`;
    return apiRequest(endpoint);
  },

  // Get bulletin by ID
  async getBulletinById(id: string): Promise<Bulletin> {
    return apiRequest(API_ENDPOINTS.bulletin(id));
  },

  // Create new bulletin
  async createBulletin(bulletinData: BulletinFormData): Promise<Bulletin> {
    return apiRequest(API_ENDPOINTS.bulletins, {
      method: 'POST',
      body: JSON.stringify(bulletinData),
    });
  },

  // Update existing bulletin
  async updateBulletin(id: string, bulletinData: Partial<BulletinFormData>): Promise<Bulletin> {
    return apiRequest(API_ENDPOINTS.bulletin(id), {
      method: 'PUT',
      body: JSON.stringify(bulletinData),
    });
  },

  // Delete bulletin
  async deleteBulletin(id: string): Promise<void> {
    return apiRequest(API_ENDPOINTS.bulletin(id), {
      method: 'DELETE',
    });
  },

  // Pin bulletin
  async pinBulletin(id: string): Promise<Bulletin> {
    return apiRequest(API_ENDPOINTS.bulletinPin(id), {
      method: 'POST',
    });
  },

  // Unpin bulletin
  async unpinBulletin(id: string): Promise<Bulletin> {
    return apiRequest(API_ENDPOINTS.bulletinPin(id), {
      method: 'DELETE',
    });
  },

  // Approve bulletin
  async approveBulletin(id: string, comment?: string): Promise<Bulletin> {
    return apiRequest(API_ENDPOINTS.bulletinApprove(id), {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  },

  // Reject bulletin
  async rejectBulletin(id: string, comment?: string): Promise<Bulletin> {
    return apiRequest(API_ENDPOINTS.bulletinReject(id), {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  },

  // Archive bulletin
  async archiveBulletin(id: string): Promise<Bulletin> {
    return apiRequest(API_ENDPOINTS.bulletinArchive(id), {
      method: 'POST',
    });
  },

  // Restore archived bulletin
  async restoreBulletin(id: string): Promise<Bulletin> {
    return apiRequest(API_ENDPOINTS.bulletinRestore(id), {
      method: 'POST',
    });
  },

  // Increment bulletin views
  async incrementViews(id: string): Promise<void> {
    return apiRequest(API_ENDPOINTS.bulletinViews(id), {
      method: 'POST',
    });
  },

  // Get bulletin history
  async getBulletinHistory(id: string): Promise<Array<{
    id: string;
    action: string;
    comment?: string;
    created_at: string;
    user_name: string;
  }>> {
    return apiRequest(API_ENDPOINTS.bulletinHistory(id));
  },

  // Add comment to bulletin
  async addComment(id: string, comment: string): Promise<Bulletin> {
    return apiRequest(`${API_ENDPOINTS.bulletin(id)}comments/`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  },
};

// Tower and Unit API functions
export const locationApi = {
  // Get all towers
  async getTowers(): Promise<Tower[]> {
    return apiRequest(API_ENDPOINTS.towers);
  },

  // Get units by tower
  async getUnitsByTower(towerId: string): Promise<Unit[]> {
    return apiRequest(API_ENDPOINTS.unitsByTower(towerId));
  },

  // Get all units
  async getUnits(): Promise<Unit[]> {
    return apiRequest(API_ENDPOINTS.units);
  },
};

// Label API functions
export const labelApi = {
  // Get all available labels
  async getLabels(): Promise<string[]> {
    return apiRequest(API_ENDPOINTS.labels);
  },

  // Create new label
  async createLabel(label: string): Promise<string> {
    return apiRequest(API_ENDPOINTS.labels, {
      method: 'POST',
      body: JSON.stringify({ name: label }),
    });
  },
};

// File upload API functions
export const fileApi = {
  // Upload file attachment
  async uploadAttachment(
    file: any, // File object from picker
    onProgress?: (progress: number) => void
  ): Promise<{
    id: string;
    file: string;
    file_name: string;
    file_type: string;
    file_size: number;
    uploaded_at: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.uploadAttachment}`, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Upload failed');
    }

    return response.json();
  },

  // Delete attachment
  async deleteAttachment(attachmentId: string): Promise<void> {
    return apiRequest(`/attachments/${attachmentId}/`, {
      method: 'DELETE',
    });
  },
};

// Error handling utilities
export class BulletinApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseData?: any
  ) {
    super(message);
    this.name = 'BulletinApiError';
  }
}

// Network status check
export const checkNetworkStatus = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/health/`, {
      method: 'GET',
      headers: getHeaders(false),
    });
    return response.ok;
  } catch {
    return false;
  }
};

// Retry mechanism for failed requests
export const retryRequest = async <T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError!;
};
