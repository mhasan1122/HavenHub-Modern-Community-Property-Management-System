// Profile and Member related types

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

export interface ProfileState {
  profile: ProfileData | null;
  memberTypes: MemberType[];
  loading: boolean;
  error: string | null;
  updateLoading: boolean;
  updateError: string | null;
  hasLoadedOnce: boolean;
}

// For member details response from backend
export interface MemberDetailsResponse {
  member: ProfileData;
  owners: any[];
  residents: any[];
  staff: any[];
}

// For profile update response
export interface ProfileUpdateResponse {
  message: string;
}

// For member status change
export interface MemberStatusChangeData {
  id: number;
  statusChange: number;
  memberType: 'org' | 'comm';
}

// For tower and unit info
export interface TowerUnitInfo {
  tower?: string;
  unit?: string;
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