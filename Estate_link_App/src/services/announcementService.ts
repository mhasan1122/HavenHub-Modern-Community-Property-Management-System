import { getBackendURL } from '../config/environment';
import { getAuthHeaders, getAuthHeadersForFormData } from '../utils/authUtils';
import { 
  Announcement, 
  CreateAnnouncementData, 
  UpdateAnnouncementData, 
  AnnouncementFilters,
  Tower,
  Unit
} from '../types/announcement';

const BASE_URL = `${getBackendURL()}/api/announcements`;

export class AnnouncementService {
  // Get all announcements with optional filters
  static async getAnnouncements(filters?: AnnouncementFilters, token?: string): Promise<Announcement[]> {
    const params = new URLSearchParams();
    
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.label) params.append('label', filters.label);
    if (filters?.my_posts) params.append('my_posts', 'true');

    const url = `${BASE_URL}/?${params.toString()}`;
    console.log('🔍 Fetching announcements from:', url);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        // Handle 403 permission errors first
        if (response.status === 403) {
          let errorMessage = 'You do not have permission to perform this action.';
          try {
            const errorText = await response.text();
            console.error('❌ API Error Response:', errorText);
            
            if (errorText.trim()) {
              const errorData = JSON.parse(errorText);
              // Extract detail message if available (common in Django REST Framework)
              if (errorData.detail) {
                errorMessage = errorData.detail;
              } else if (errorData.error) {
                errorMessage = errorData.error;
              } else if (errorData.message) {
                errorMessage = errorData.message;
              }
            }
          } catch (parseError) {
            // Use default permission message if parsing fails
            errorMessage = 'You do not have permission to perform this action.';
          }
          throw new Error(errorMessage);
        }
        
        // Handle other errors
        let errorMessage = 'Failed to fetch announcements';
        try {
          const errorText = await response.text();
          console.error('❌ API Error Response:', errorText);
          
          if (errorText.trim()) {
            const errorData = JSON.parse(errorText);
            if (errorData.detail) {
              errorMessage = errorData.detail;
            } else if (errorData.error) {
              errorMessage = errorData.error;
            } else if (errorData.message) {
              errorMessage = errorData.message;
            }
          }
        } catch (parseError) {
          // Keep default message if parsing fails
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('✅ Announcements fetched successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Error fetching announcements:', error);
      throw error;
    }
  }

  // Get announcement by ID
  static async getAnnouncement(id: number, token?: string): Promise<Announcement> {
    const response = await fetch(`${BASE_URL}/${id}/`, {
      method: 'GET',
      headers: getAuthHeaders(token),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch announcement: ${response.statusText}`);
    }

    return response.json();
  }

  // Create new announcement
  static async createAnnouncement(data: CreateAnnouncementData, token?: string): Promise<Announcement> {
    const formData = new FormData();
    
    // Add text fields
    formData.append('title', data.title);
    if (data.description) formData.append('description', data.description);
    formData.append('post_as', data.post_as);
    if (data.posted_group) formData.append('posted_group', data.posted_group.toString());
    if (data.posted_member) formData.append('posted_member', data.posted_member.toString());
    formData.append('priority', data.priority);
    if (data.label) formData.append('label', data.label);
    formData.append('start_date', data.start_date);
    formData.append('start_time', data.start_time);
    formData.append('end_date', data.end_date);
    formData.append('end_time', data.end_time);
    
    // Add target IDs
    if (data.target_tower_ids?.length) {
      formData.append('target_tower_ids', JSON.stringify(data.target_tower_ids));
    }
    if (data.target_unit_ids?.length) {
      formData.append('target_unit_ids', JSON.stringify(data.target_unit_ids));
    }

    // Add file attachments
    if (data.attachments?.length) {
      data.attachments.forEach(file => {
        formData.append('attachments', file);
      });
    }

    // Add base64 attachments
    if (data.base64_attachments?.length) {
      formData.append('base64_attachments', JSON.stringify(data.base64_attachments));
    }

    const response = await fetch(`${BASE_URL}/`, {
      method: 'POST',
      body: formData,
      headers: getAuthHeadersForFormData(token),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to create announcement: ${JSON.stringify(errorData)}`);
    }

    return response.json();
  }

  // Update announcement
  static async updateAnnouncement(id: number, data: UpdateAnnouncementData, token?: string): Promise<Announcement> {
    const formData = new FormData();
    
    // Add text fields
    if (data.title) formData.append('title', data.title);
    if (data.description !== undefined) formData.append('description', data.description || '');
    if (data.post_as) formData.append('post_as', data.post_as);
    if (data.posted_group !== undefined) {
      formData.append('posted_group', data.posted_group?.toString() || '');
    }
    if (data.posted_member !== undefined) {
      formData.append('posted_member', data.posted_member?.toString() || '');
    }
    if (data.priority) formData.append('priority', data.priority);
    if (data.label !== undefined) formData.append('label', data.label || '');
    if (data.start_date) formData.append('start_date', data.start_date);
    if (data.start_time) formData.append('start_time', data.start_time);
    if (data.end_date) formData.append('end_date', data.end_date);
    if (data.end_time) formData.append('end_time', data.end_time);
    
    // Add target IDs
    if (data.target_tower_ids !== undefined) {
      formData.append('target_tower_ids', JSON.stringify(data.target_tower_ids));
    }
    if (data.target_unit_ids !== undefined) {
      formData.append('target_unit_ids', JSON.stringify(data.target_unit_ids));
    }

    // Add file attachments
    if (data.attachments?.length) {
      data.attachments.forEach(file => {
        formData.append('attachments', file);
      });
    }

    // Add base64 attachments
    if (data.base64_attachments?.length) {
      formData.append('base64_attachments', JSON.stringify(data.base64_attachments));
    }

    const response = await fetch(`${BASE_URL}/${id}/`, {
      method: 'PUT',
      body: formData,
      headers: getAuthHeadersForFormData(token),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to update announcement: ${JSON.stringify(errorData)}`);
    }

    return response.json();
  }

  // Delete announcement
  static async deleteAnnouncement(id: number, token?: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/${id}/`, {
      method: 'DELETE',
      headers: getAuthHeaders(token),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete announcement: ${response.statusText}`);
    }
  }

  // Toggle pin status
  static async togglePin(id: number, token?: string): Promise<Announcement> {
    const response = await fetch(`${BASE_URL}/${id}/toggle_pin/`, {
      method: 'POST',
      headers: getAuthHeaders(token),
    });

    if (!response.ok) {
      throw new Error(`Failed to toggle pin: ${response.statusText}`);
    }

    return response.json();
  }

  // Increment views
  static async incrementViews(id: number, token?: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/${id}/increment_views/`, {
      method: 'POST',
      headers: getAuthHeaders(token),
    });

    if (!response.ok) {
      throw new Error(`Failed to increment views: ${response.statusText}`);
    }
  }

  // Force expire announcement
  static async forceExpire(id: number, token?: string): Promise<Announcement> {
    const response = await fetch(`${BASE_URL}/${id}/force_expire/`, {
      method: 'POST',
      headers: getAuthHeaders(token),
    });

    if (!response.ok) {
      throw new Error(`Failed to force expire: ${response.statusText}`);
    }

    return response.json();
  }

  // Restore expired announcement
  static async restore(id: number, token?: string): Promise<Announcement> {
    const response = await fetch(`${BASE_URL}/${id}/restore/`, {
      method: 'POST',
      headers: getAuthHeaders(token),
    });

    if (!response.ok) {
      throw new Error(`Failed to restore: ${response.statusText}`);
    }

    return response.json();
  }

  // Get announcements by status
  static async getAnnouncementsByStatus(token?: string): Promise<Record<string, number>> {
    const response = await fetch(`${BASE_URL}/by_status/`, {
      method: 'GET',
      headers: getAuthHeaders(token),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch status counts: ${response.statusText}`);
    }

    return response.json();
  }

  // Get all towers
  static async getTowers(token?: string): Promise<Tower[]> {
    const response = await fetch(`${BASE_URL}/towers/`, {
      method: 'GET',
      headers: getAuthHeaders(token),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch towers: ${response.statusText}`);
    }

    return response.json();
  }

  // Get units (optionally filtered by tower IDs)
  static async getUnits(towerIds?: number[], token?: string): Promise<Unit[]> {
    const params = new URLSearchParams();
    if (towerIds?.length) {
      params.append('tower_ids', JSON.stringify(towerIds));
    }

    const response = await fetch(`${BASE_URL}/units/?${params.toString()}`, {
      method: 'GET',
      headers: getAuthHeaders(token),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch units: ${response.statusText}`);
    }

    return response.json();
  }

  // Get unique labels
  static async getLabels(token?: string): Promise<string[]> {
    const response = await fetch(`${BASE_URL}/labels/`, {
      method: 'GET',
      headers: getAuthHeaders(token),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch labels: ${response.statusText}`);
    }

    return response.json();
  }
}
