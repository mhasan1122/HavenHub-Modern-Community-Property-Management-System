export interface NoticeAttachment {
  id: number;
  file: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface Tower {
  id: number;
  tower_name: string;
  tower_number: string;
}

export interface Unit {
  id: number;
  unit_name: string;
  floor: number;
  tower_name: string;
}

export interface Notice {
  id: number;
  internal_title: string;
  creator: number;
  creator_name: string;
  post_as: 'creator' | 'group' | 'member';
  posted_group: number | null;
  posted_member: number | null;
  group_name: string | null;
  member_name: string | null;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  label: string | null;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  status: 'draft' | 'upcoming' | 'ongoing' | 'expired';
  views: number;
  is_pinned: boolean;
  manually_expired: boolean;
  created_at: string;
  updated_at: string;
  attachments: NoticeAttachment[];
  target_towers_data: Tower[];
  target_units_data: Unit[];
  target_tower_ids?: number[];
  target_unit_ids?: number[];
}

export interface NoticeHistory {
  id: number;
  edited_by: number;
  edited_by_name: string;
  edited_at: string;
  changes: Record<string, any>;
  changes_display: Record<string, any>;
}

export interface CreateNoticeData {
  post_as: 'creator' | 'group' | 'member';
  posted_group?: number;
  posted_member?: number;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  label?: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  target_tower_ids?: number[];
  target_unit_ids?: number[];
  attachments?: File[];
  base64_attachments?: Array<{
    file: string;
    file_name: string;
    file_type: string;
    file_size: number;
  }>;
}

export interface UpdateNoticeData extends Partial<CreateNoticeData> {
  id: number;
}

export interface NoticeFilters {
  status?: string;
  search?: string;
  priority?: string;
  label?: string;
  my_posts?: boolean;
}

export interface NoticeState {
  notices: Notice[];
  loading: boolean;
  error: string | null;
  selectedNotice: Notice | null;
  filters: NoticeFilters;
  totalCount: number;
  hasLoadedOnce: boolean; // Add this property
}
