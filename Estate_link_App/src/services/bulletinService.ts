import { API_CONFIG, enhancedFetch } from '../utils/networkUtils';

export interface BulletinAttachment {
  id: string;
  file: string;
  file_name: string;
  file_type: string;
}

export interface CreateBulletinData {
  title: string;
  description?: string; // Optional - can be empty or undefined
  attachments: BulletinAttachment[];
  target_tower_ids: number[];
  target_unit_ids: number[];
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  label?: string; // Optional for mobile app - will default to empty string if not provided
  // Note: post_as is automatically set to 'creator' for mobile app usage
  attachments_to_delete?: Array<string | number>; // Only used for updates
}

export interface Bulletin {
  id: number;
  title: string;
  description?: string; // Optional - can be empty or undefined
  creator: {
    id: number;
    full_name: string;
  };
  creator_name?: string; // Creator's full name
  creator_photo?: string; // Profile photo URL
  post_as?: 'creator' | 'group' | 'member'; // Who the bulletin is posted as
  posted_group?: number | null; // Group ID if posting as group
  posted_member?: number | null; // Member ID if posting as member
  group_name?: string | null; // Group name if posting as group
  member_name?: string | null; // Member name if posting as member
  member_photo?: string | null; // Member photo URL if posting as member
  priority: string;
  label: string;
  status: string;
  // Some endpoints return detailed fields with *_data; keep both for compatibility
  target_towers?: Array<{
    id: number;
    tower_name: string;
  }>;
  target_units?: Array<{
    id: number;
    unit_name: string;
  }>;
  target_towers_data?: Array<{
    id: number;
    tower_name: string;
    tower_number?: number;
  }>;
  target_units_data?: Array<{
    id: number;
    unit_name: string;
    tower_name?: string;
  }>;
  attachments: BulletinAttachment[];
  created_at: string;
  updated_at: string;
  history?: Array<{
    id: string | number;
    action: string;
    comment?: string;
    edited_at: string;
    edited_by_name: string;
    changes?: any;
  }>;
}

export const createBulletin = async (data: CreateBulletinData, authToken?: string): Promise<Bulletin> => {
  try {
    console.log('🚀 Starting bulletin creation...');
    console.log('📱 Input data:', data);
    console.log('🔑 Auth token:', authToken ? `Present (${authToken.substring(0, 20)}...)` : 'Missing');
    console.log('🔑 Auth token length:', authToken ? authToken.length : 0);
    
    // Convert attachments to base64 for API
    const base64Attachments = await Promise.all(
      data.attachments.map(async (attachment) => {
        try {
          const response = await fetch(attachment.file);
          const blob = await response.blob();
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result as string;
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error('Error converting attachment to base64:', error);
          return null;
        }
      })
    );

    // Filter out failed conversions
    const validAttachments = base64Attachments
      .filter((base64, index) => base64 !== null)
      .map((base64, index) => ({
        file_data: base64!,
        file_name: data.attachments[index].file_name,
        file_type: data.attachments[index].file_type,
      }));

    console.log('📎 Valid attachments:', validAttachments.length);

    const formData = new FormData();
    formData.append('title', data.title);
    // Only add description if it's provided and not empty
    if (data.description && data.description.trim()) {
      formData.append('description', data.description);
    }
    formData.append('priority', data.priority || 'normal');
    
    // Add required fields for mobile app with default values
    formData.append('post_as', 'creator'); // Default to creator for mobile app
    formData.append('label', data.label || ''); // Use provided label or empty string
    
    // Add tower and unit IDs
    data.target_tower_ids.forEach(id => {
      formData.append('target_tower_ids', id.toString());
    });
    data.target_unit_ids.forEach(id => {
      formData.append('target_unit_ids', id.toString());
    });

    // Add base64 attachments
    if (validAttachments.length > 0) {
      formData.append('base64_attachments', JSON.stringify(validAttachments));
    }

    console.log('📤 FormData keys being sent: title, description, priority, post_as, label, target_tower_ids, target_unit_ids, base64_attachments');
    console.log('📤 FormData values:');
    console.log(`  title: ${data.title}`);
    console.log(`  description: ${data.description || '(not provided)'}`);
    console.log(`  priority: ${data.priority || 'normal'}`);
    console.log(`  post_as: creator`);
    console.log(`  label: ${data.label || ''}`);
    console.log(`  target_tower_ids: ${data.target_tower_ids.join(', ')}`);
    console.log(`  target_unit_ids: ${data.target_unit_ids.join(', ')}`);
    console.log(`  base64_attachments: ${validAttachments.length} files`);

    console.log('🌐 Making API request to:', `${API_CONFIG.BASE_URL}/api/bulletins/`);
    console.log('📤 Request headers:', {
      'Content-Type': 'multipart/form-data',
      'Authorization': authToken ? `Bearer ${authToken.substring(0, 20)}...` : 'None',
      'Accept': 'application/json'
    });

    const response = await enhancedFetch(
      `${API_CONFIG.BASE_URL}/api/bulletins/`,
      {
        method: 'POST',
        body: formData,
      },
      API_CONFIG.TIMEOUT,
      authToken
    );

    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      let errorData: any = {};
      try {
        const responseText = await response.text();
        console.log('📥 Raw error response text:', responseText);
        
        if (responseText.trim()) {
          errorData = JSON.parse(responseText);
        }
      } catch (parseError) {
        console.error('❌ Failed to parse error response:', parseError);
        errorData = { error: 'Invalid response format' };
      }
      
      console.error('❌ Backend error response:', errorData);
      console.error('❌ Response status:', response.status);
      console.error('❌ Response status text:', response.statusText);
      
      // Try to get a meaningful error message
      let errorMessage = 'Failed to create bulletin';
      if (errorData.error) {
        errorMessage = errorData.error;
      } else if (errorData.details) {
        errorMessage = `Validation failed: ${JSON.stringify(errorData.details)}`;
      } else if (response.status === 400) {
        errorMessage = 'Bad request - check your data';
      } else if (response.status === 401) {
        errorMessage = 'Authentication required';
      } else if (response.status === 403) {
        errorMessage = 'Permission denied';
      } else if (response.status === 500) {
        errorMessage = 'Server error';
      }
      
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('✅ Bulletin created successfully:', result);
    return result;
  } catch (error) {
    console.error('❌ Error creating bulletin:', error);
    throw error;
  }
};

export const getBulletins = async (params?: {
  status?: string;
  search?: string;
  priority?: string;
  labels?: string;
  date_from?: string;
  date_to?: string;
  creator?: string;
  my_posts?: boolean;
}, authToken?: string): Promise<Bulletin[]> => {
  try {
    console.log('🔍 DEBUG: getBulletins called with params:', params);
    const queryParams = new URLSearchParams();
    
    if (params?.status) queryParams.append('status', params.status);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.priority) queryParams.append('priority', params.priority);
    if (params?.labels) queryParams.append('labels', params.labels);
    if (params?.date_from) queryParams.append('date_from', params.date_from);
    if (params?.date_to) queryParams.append('date_to', params.date_to);
    if (params?.creator) queryParams.append('creator', params.creator);
    if (params?.my_posts) queryParams.append('my_posts', 'true');
    
    // Request history data to be included
    queryParams.append('include_history', 'true');
    
    // Add timestamp to prevent caching
    queryParams.append('_t', Date.now().toString());

    const url = `${API_CONFIG.BASE_URL}/api/bulletins/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    console.log('🔍 Bulletin API URL:', url);
    console.log('🔍 Query params:', queryParams.toString());
    
    const response = await enhancedFetch(url, {
      method: 'GET',
    }, API_CONFIG.TIMEOUT, authToken);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch bulletins');
    }

    const bulletinsData = await response.json();
    
    // Debug: Log raw API response for bulletins with post_as='member'
    const memberBulletins = bulletinsData.filter((b: any) => b.post_as === 'member');
    if (memberBulletins.length > 0) {
      console.log('🔍 DEBUG: Raw API response for member bulletins:', memberBulletins.map((b: any) => ({
        id: b.id,
        title: b.title,
        post_as: b.post_as,
        member_name: b.member_name,
        member_photo: b.member_photo,
        posted_member: b.posted_member,
        creator_photo: b.creator_photo,
      })));
    }
    
    return bulletinsData;
  } catch (error) {
    console.error('Error fetching bulletins:', error);
    throw error;
  }
};

export const getBulletinById = async (id: number, authToken?: string): Promise<Bulletin> => {
  try {
    const url = `${API_CONFIG.BASE_URL}/api/bulletins/${id}/?include_history=true`;
    console.log('🔍 Fetching bulletin by ID:', url);
    
    const response = await enhancedFetch(
      url,
      {
        method: 'GET',
      },
      API_CONFIG.TIMEOUT,
      authToken
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to fetch bulletin');
    }

    const bulletinData = await response.json();
    console.log('✅ Bulletin fetched successfully with history:', {
      id: bulletinData.id,
      hasHistory: !!bulletinData.history,
      historyLength: bulletinData.history?.length || 0
    });
    return bulletinData;
  } catch (error) {
    console.error('Error fetching bulletin:', error);
    throw error;
  }
};

// Add new function to fetch bulletin history separately
export const getBulletinHistory = async (bulletinId: number, authToken?: string): Promise<Array<{
  id: string | number;
  action: string;
  comment?: string;
  edited_at: string;
  edited_by_name: string;
  changes?: any;
}>> => {
  try {
    const url = `${API_CONFIG.BASE_URL}/api/bulletins/${bulletinId}/history/`;
    console.log('🔍 Fetching bulletin history:', url);
    
    const response = await enhancedFetch(
      url,
      {
        method: 'GET',
      },
      API_CONFIG.TIMEOUT,
      authToken
    );

    if (!response.ok) {
      console.warn('⚠️ Failed to fetch bulletin history:', response.status);
      // Return empty array if history endpoint doesn't exist or fails
      return [];
    }

    const historyData = await response.json();
    console.log('✅ Bulletin history fetched:', historyData?.length || 0, 'entries');
    return Array.isArray(historyData) ? historyData : [];
  } catch (error) {
    console.error('Error fetching bulletin history:', error);
    // Return empty array on error instead of throwing
    return [];
  }
};

export const updateBulletin = async (id: number, data: CreateBulletinData, authToken?: string): Promise<Bulletin> => {
  try {
    console.log('🔄 Starting bulletin update...');
    console.log('📱 Bulletin ID:', id);
    console.log('📱 Input data:', data);
    console.log('🔑 Auth token:', authToken ? `Present (${authToken.substring(0, 20)}...)` : 'Missing');
    
    // Convert attachments to base64 for API
    const base64Attachments = await Promise.all(
      data.attachments.map(async (attachment) => {
        try {
          // Determine if attachment is existing (already on server)
          // Treat absolute http(s) URLs and server-relative paths as existing
          const isRemoteUrl = /^https?:\/\//i.test(attachment.file);
          const isServerRelative = attachment.file.startsWith('/') && !attachment.file.startsWith('/var');
          if (attachment.id && (isRemoteUrl || isServerRelative)) {
            return {
              id: attachment.id,
              file_name: attachment.file_name,
              file_type: attachment.file_type,
              existing: true
            };
          }
          
          // Otherwise, it's a new attachment that needs to be converted to base64
          const response = await fetch(attachment.file);
          const blob = await response.blob();
          return new Promise<any>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result as string;
              resolve({
                file_data: base64,
                file_name: attachment.file_name,
                file_type: attachment.file_type,
                existing: false
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error('Error processing attachment:', error);
          return null;
        }
      })
    );

    // Filter out failed conversions
    const validAttachments = base64Attachments.filter(attachment => attachment !== null);

    console.log('📎 Valid attachments:', validAttachments.length);

    const formData = new FormData();
    formData.append('title', data.title);
    // Only add description if it's provided and not empty
    if (data.description && data.description.trim()) {
      formData.append('description', data.description);
    }
    formData.append('priority', data.priority || 'normal');
    
    // Add required fields for mobile app with default values
    formData.append('post_as', 'creator'); // Default to creator for mobile app
    formData.append('label', data.label || ''); // Use provided label or empty string
    
    // Add tower and unit IDs
    data.target_tower_ids.forEach(id => {
      formData.append('target_tower_ids', id.toString());
    });
    data.target_unit_ids.forEach(id => {
      formData.append('target_unit_ids', id.toString());
    });

    // Add ONLY new base64 attachments (existing ones are already on server)
    const newBase64Attachments = validAttachments
      .filter((att: any) => att && att.existing === false)
      .map((att: any) => ({
        file_data: att.file_data,
        file_name: att.file_name,
        file_type: att.file_type,
      }));

    if (newBase64Attachments.length > 0) {
      formData.append('base64_attachments', JSON.stringify(newBase64Attachments));
    }

    // Send IDs of attachments to delete (existing ones only)
    if (data.attachments_to_delete && data.attachments_to_delete.length > 0) {
      data.attachments_to_delete.forEach((attId) => {
        formData.append('attachments_to_delete', attId.toString());
      });
    }

    console.log('📤 FormData keys being sent: title, description, priority, post_as, label, target_tower_ids, target_unit_ids, base64_attachments, attachments_to_delete');
    console.log('📤 FormData values:');
    console.log(`  title: ${data.title}`);
    console.log(`  description: ${data.description || '(not provided)'}`);
    console.log(`  priority: ${data.priority || 'normal'}`);
    console.log(`  post_as: creator`);
    console.log(`  label: ${data.label || ''}`);
    console.log(`  target_tower_ids: ${data.target_tower_ids.join(', ')}`);
    console.log(`  target_unit_ids: ${data.target_unit_ids.join(', ')}`);
    console.log(`  base64_attachments: ${newBase64Attachments.length} files`);
    console.log(`  attachments_to_delete: ${(data.attachments_to_delete || []).join(', ') || '(none)'}`);

    console.log('🌐 Making API request to:', `${API_CONFIG.BASE_URL}/api/bulletins/${id}/`);
    console.log('📤 Request headers:', {
      'Content-Type': 'multipart/form-data',
      'Authorization': authToken ? `Bearer ${authToken.substring(0, 20)}...` : 'None',
      'Accept': 'application/json'
    });

    const response = await enhancedFetch(
      `${API_CONFIG.BASE_URL}/api/bulletins/${id}/`,
      {
        method: 'PATCH',
        body: formData,
      },
      API_CONFIG.TIMEOUT,
      authToken
    );

    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      let errorData: any = {};
      try {
        const responseText = await response.text();
        console.log('📥 Raw error response text:', responseText);
        
        if (responseText.trim()) {
          errorData = JSON.parse(responseText);
        }
      } catch (parseError) {
        console.error('❌ Failed to parse error response:', parseError);
        errorData = { error: 'Invalid response format' };
      }
      
      console.error('❌ Backend error response:', errorData);
      console.error('❌ Response status:', response.status);
      console.error('❌ Response status text:', response.statusText);
      
      // Try to get a meaningful error message
      let errorMessage = 'Failed to update bulletin';
      if (errorData.error) {
        errorMessage = errorData.error;
      } else if (errorData.details) {
        errorMessage = `Validation failed: ${JSON.stringify(errorData.details)}`;
      } else if (response.status === 400) {
        errorMessage = 'Bad request - check your data';
      } else if (response.status === 401) {
        errorMessage = 'Authentication required';
      } else if (response.status === 403) {
        errorMessage = 'Permission denied';
      } else if (response.status === 404) {
        errorMessage = 'Bulletin not found';
      } else if (response.status === 500) {
        errorMessage = 'Server error';
      }
      
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('✅ Bulletin updated successfully:', result);
    return result;
  } catch (error) {
    console.error('❌ Error updating bulletin:', error);
    throw error;
  }
};

export const deleteBulletin = async (id: number, authToken?: string): Promise<void> => {
  try {
    console.log('🗑️ Starting bulletin deletion...');
    console.log('📱 Bulletin ID:', id);
    console.log('🔑 Auth token:', authToken ? `Present (${authToken.substring(0, 20)}...)` : 'Missing');

    console.log('🌐 Making DELETE request to:', `${API_CONFIG.BASE_URL}/api/bulletins/${id}/`);

    const response = await enhancedFetch(
      `${API_CONFIG.BASE_URL}/api/bulletins/${id}/`,
      {
        method: 'DELETE',
      },
      API_CONFIG.TIMEOUT,
      authToken
    );

    console.log('📥 Delete response status:', response.status);
    console.log('📥 Delete response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      let errorData: any = {};
      try {
        const responseText = await response.text();
        console.log('📥 Raw delete error response text:', responseText);
        
        if (responseText.trim()) {
          errorData = JSON.parse(responseText);
        }
      } catch (parseError) {
        console.error('❌ Failed to parse delete error response:', parseError);
        errorData = { error: 'Invalid response format' };
      }
      
      console.error('❌ Backend delete error response:', errorData);
      console.error('❌ Delete response status:', response.status);
      console.error('❌ Delete response status text:', response.statusText);
      
      // Try to get a meaningful error message
      let errorMessage = 'Failed to delete bulletin';
      if (errorData.error) {
        errorMessage = errorData.error;
      } else if (response.status === 401) {
        errorMessage = 'Authentication required';
      } else if (response.status === 403) {
        errorMessage = 'Permission denied - you can only delete your own bulletins';
      } else if (response.status === 404) {
        errorMessage = 'Bulletin not found';
      } else if (response.status === 500) {
        errorMessage = 'Server error';
      }
      
      throw new Error(errorMessage);
    }

    console.log('✅ Bulletin deleted successfully');
  } catch (error) {
    console.error('❌ Error deleting bulletin:', error);
    throw error;
  }
};

export const archiveBulletin = async (id: number, authToken?: string): Promise<void> => {
  try {
    console.log('📦 Starting bulletin archive...');
    console.log('📱 Bulletin ID:', id);
    console.log('🔑 Auth token:', authToken ? `Present (${authToken.substring(0, 20)}...)` : 'Missing');

    console.log('🌐 Making POST request to:', `${API_CONFIG.BASE_URL}/api/bulletins/${id}/move_to_archive/`);

    const response = await enhancedFetch(
      `${API_CONFIG.BASE_URL}/api/bulletins/${id}/move_to_archive/`,
      {
        method: 'POST',
      },
      API_CONFIG.TIMEOUT,
      authToken
    );

    console.log('📥 Archive response status:', response.status);
    console.log('📥 Archive response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      let errorData: any = {};
      try {
        const responseText = await response.text();
        console.log('📥 Raw archive error response text:', responseText);
        
        if (responseText.trim()) {
          errorData = JSON.parse(responseText);
        }
      } catch (parseError) {
        console.error('❌ Failed to parse archive error response:', parseError);
        errorData = { error: 'Invalid response format' };
      }
      
      console.error('❌ Backend archive error response:', errorData);
      console.error('❌ Archive response status:', response.status);
      console.error('❌ Archive response status text:', response.statusText);
      
      // Try to get a meaningful error message
      let errorMessage = 'Failed to archive bulletin';
      if (errorData.error) {
        errorMessage = errorData.error;
      } else if (response.status === 401) {
        errorMessage = 'Authentication required';
      } else if (response.status === 403) {
        errorMessage = 'Permission denied - you can only archive your own bulletins';
      } else if (response.status === 404) {
        errorMessage = 'Bulletin not found';
      } else if (response.status === 500) {
        errorMessage = 'Server error';
      }
      
      throw new Error(errorMessage);
    }

    console.log('✅ Bulletin archived successfully');
  } catch (error) {
    console.error('❌ Error archiving bulletin:', error);
    throw error;
  }
};

export const getLabels = async (authToken?: string): Promise<string[]> => {
  try {
    console.log('🏷️ Fetching bulletin labels...');
    console.log('🔑 Auth token:', authToken ? `Present (${authToken.substring(0, 20)}...)` : 'Missing');

    const response = await enhancedFetch(
      `${API_CONFIG.BASE_URL}/api/bulletins/labels/`,
      {
        method: 'GET',
      },
      API_CONFIG.TIMEOUT,
      authToken
    );

    console.log('📥 Labels response status:', response.status);
    console.log('📥 Labels response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      let errorData: any = {};
      try {
        const responseText = await response.text();
        console.log('📥 Raw labels error response text:', responseText);
        
        if (responseText.trim()) {
          errorData = JSON.parse(responseText);
        }
      } catch (parseError) {
        console.error('❌ Failed to parse labels error response:', parseError);
        errorData = { error: 'Invalid response format' };
      }
      
      console.error('❌ Backend labels error response:', errorData);
      console.error('❌ Labels response status:', response.status);
      console.error('❌ Labels response status text:', response.statusText);
      
      // Try to get a meaningful error message
      let errorMessage = 'Failed to fetch labels';
      if (errorData.error) {
        errorMessage = errorData.error;
      } else if (response.status === 401) {
        errorMessage = 'Authentication required';
      } else if (response.status === 403) {
        errorMessage = 'Permission denied';
      } else if (response.status === 500) {
        errorMessage = 'Server error';
      }
      
      throw new Error(errorMessage);
    }

    const labels = await response.json();
    console.log('✅ Labels fetched successfully:', labels);
    return labels;
  } catch (error) {
    console.error('❌ Error fetching labels:', error);
    throw error;
  }
};
