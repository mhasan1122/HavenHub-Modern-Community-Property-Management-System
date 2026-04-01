import { getBackendURL } from '../config/environment';
import { getAuthHeaders, getAuthHeadersForFormData } from '../utils/authUtils';

const BASE_URL = `${getBackendURL()}/user`;

export interface MemberType {
  id: number;
  type_name: string;
}

export interface Role {
  id: number;
  role_name: string;
  is_member: boolean;
  is_group: boolean;
}

export interface Group {
  group_name: string;
}

export interface ProfileData {
  id: number;
  full_name: string;
  general_contact: string;
  general_email: string;
  login_email?: string;
  login_contact?: string;
  nid_number?: string;
  photo?: string;
  photo_low_quality?: string;
  about_us?: string;
  facebook_profile?: string;
  linkedin_profile?: string;
  permanent_address?: string;
  present_address?: string;
  date_of_birth?: string;
  occupation?: string;
  gender?: string;
  marital_status?: string;
  religion?: string;
  nid_front?: string;
  nid_back?: string;
  is_org_member: boolean;
  is_comm_member: boolean;
  is_first_login: boolean;
  member_type_name?: string;
  username?: string;
  member_roles: Role[];
  member_groups: Group[];
  unit?: string;
  tower?: string;
  member_type_edit?: {
    id: number;
    member_type_name: string;
  };
}

export interface UnitRelationship {
  id: number;
  unit_name: string;
  unit: number;
  tower: {
    tower_name: string;
    tower_number: number;
  };
  ownership_percentage?: string;
  date_of_ownership?: string;
  is_resident_or_tenant?: boolean;
  unit_rent_fee?: number;
  advance_payment?: number;
  notice_period?: number;
  is_active?: boolean;
  unit_staff_status?: boolean; // True for Live-in, False for Part-time
}

export interface ProfileResponse {
  member: ProfileData;
  owners: UnitRelationship[];
  residents: UnitRelationship[];
  staff: UnitRelationship[];
}

export interface UpdateProfileData {
  full_name?: string;
  general_contact?: string;
  general_email?: string;
  login_email?: string;
  login_contact?: string;
  nid_number?: string;
  photo?: File | { uri: string; type: string; name: string };
  about_us?: string;
  facebook_profile?: string;
  linkedin_profile?: string;
  permanent_address?: string;
  present_address?: string;
  date_of_birth?: string;
  occupation?: string;
  gender?: string;
  marital_status?: string;
  religion?: string;
  nid_front?: File | { uri: string; type: string; name: string };
  nid_back?: File | { uri: string; type: string; name: string };
  photo_removed?: string;
  nid_front_removed?: string;
  nid_back_removed?: string;
  delivery_method?: string;
  members_role?: number[];
  delete_role?: number[];
}

export class ProfileService {
  // Get current user profile details
  static async getProfile(token?: string): Promise<ProfileResponse> {
    // Use the new my_profile endpoint which doesn't require special permissions
    console.log('Fetching user\'s own profile data...');
    const response = await fetch(`${BASE_URL}/my_profile/`, {
      method: 'GET',
      headers: getAuthHeaders(token),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('My profile error:', errorText);
      
      // Try to parse error as JSON to get detailed message
      let errorMessage = `Failed to fetch profile: ${response.statusText}`;
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
      } catch (parseError) {
        // If parsing fails, use the raw error text if it's meaningful
        if (errorText && errorText.trim() && !errorText.includes('<html>')) {
          errorMessage = errorText;
        }
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('My profile API response:', data);
    return data; // Backend returns { member: {}, owners: [], residents: [], staff: [] }
  }

  // Get detailed member profile by ID (requires admin permissions)
  static async getMemberDetails(id: number, token?: string): Promise<ProfileData> {
    console.log('Fetching member details for ID:', id, '(requires admin permissions)');
    const response = await fetch(`${BASE_URL}/member_details/${id}/`, {
      method: 'GET',
      headers: getAuthHeaders(token),
    });

    console.log('Member details response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Member details error:', errorText);
      throw new Error(`Failed to fetch member details: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Member details API response:', data);
    return data.member; // Backend returns { member: {}, owners: [], residents: [], staff: [] }
  }

  // Update current user's own profile
  static async updateProfile(id: number, data: UpdateProfileData, token?: string): Promise<ProfileData> {
    console.log('Updating own profile with data:', data);
    const formData = new FormData();

    // Add text fields
    Object.keys(data).forEach(key => {
      const value = data[key as keyof UpdateProfileData];
      if (value !== undefined && value !== null) {
        if (key === 'members_role' || key === 'delete_role') {
          // Handle arrays
          if (Array.isArray(value)) {
            value.forEach(item => {
              formData.append(key, item.toString());
            });
          }
        } else if (key === 'photo' || key === 'nid_front' || key === 'nid_back') {
          // Handle file uploads - check for React Native file object
          if (value && typeof value === 'object' && 'uri' in value) {
            // React Native file object with uri
            formData.append(key, value as any);
          } else if (value instanceof File) {
            // Standard File object
            formData.append(key, value);
          }
        } else {
          // Handle regular fields
          // Special handling for NID number to ensure empty values are sent as empty strings
          // rather than being omitted, which prevents clearing the field
          if (key === 'nid_number') {
            formData.append(key, value === null ? '' : value.toString());
          } else {
            formData.append(key, value.toString());
          }
        }
      } else if (value === null && key === 'nid_number') {
        // Explicitly send empty string for null NID to clear it
        formData.append(key, '');
      }
    });

    console.log('FormData prepared, sending request to:', `${BASE_URL}/my_profile/`);

    // Use my_profile endpoint for self-updates (no special permissions required)
    const response = await fetch(`${BASE_URL}/my_profile/`, {
      method: 'PUT',
      body: formData,
      headers: getAuthHeadersForFormData(token),
    });

    console.log('Update profile response status:', response.status);
    
    if (!response.ok) {
      let errorMessage = 'Failed to update profile';
      try {
        const errorData = await response.json();
        console.error('Update profile error:', errorData);
        errorMessage = `Failed to update profile: ${JSON.stringify(errorData)}`;
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError);
        errorMessage = `Failed to update profile: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('Update profile API response:', result);
    console.log('Update profile API response NID:', result.nid_number);
    return result;
  }

  // Get member types
  static async getMemberTypes(token?: string): Promise<MemberType[]> {
    const response = await fetch(`${BASE_URL}/member_type_list/`, {
      method: 'GET',
      headers: getAuthHeaders(token),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch member types: ${response.statusText}`);
    }

    return response.json();
  }

  // Get user tower and unit information
  static async getUserTowerUnit(token?: string): Promise<{ tower?: string; unit?: string }> {
    const response = await fetch(`${BASE_URL}/user_tower_unit/`, {
      method: 'GET',
      headers: getAuthHeaders(token),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tower/unit info: ${response.statusText}`);
    }

    return response.json();
  }

  // Change member status (for org/comm membership)
  static async changeMemberStatus(
    id: number, 
    statusChange: number, 
    memberType: 'org' | 'comm', 
    token?: string
  ): Promise<{ message: string }> {
    const response = await fetch(`${BASE_URL}/change_member_status/${id}/`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({
        status_change: statusChange,
        member_type: memberType,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to change member status: ${JSON.stringify(errorData)}`);
    }

    return response.json();
  }
}