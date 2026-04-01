import { Platform } from 'react-native';

// Bulletin status types
export type BulletinStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'archived' | 'published';

// Bulletin priority types
export type BulletinPriority = 'low' | 'medium' | 'high';

// Bulletin interface
export interface Bulletin {
  id: string;
  title: string;
  content: string;
  priority: BulletinPriority;
  status: BulletinStatus;
  target_towers: string[];
  target_units: string[];
  labels: string[];
  attachments: BulletinAttachment[];
  creator_id: string;
  creator_name: string;
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
  views_count: number;
  approval_comment?: string;
  rejection_comment?: string;
}

// Attachment interface
export interface BulletinAttachment {
  id: string;
  file: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}

// Tower interface
export interface Tower {
  id: string;
  name: string;
  address: string;
  total_units: number;
}

// Unit interface
export interface Unit {
  id: string;
  number: string;
  tower_id: string;
  tower_name: string;
  floor: number;
  type: string;
}

// Formatted bulletin data for API
export interface BulletinFormData {
  title: string;
  content: string;
  priority: BulletinPriority;
  target_towers: string[];
  target_units: string[];
  labels: string[];
  attachments: string[]; // Array of attachment IDs
}

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Format bulletin data for API submission
 */
export const formatBulletinForApi = (bulletinData: Partial<BulletinFormData>): BulletinFormData => {
  return {
    title: bulletinData.title?.trim() || '',
    content: bulletinData.content?.trim() || '',
    priority: bulletinData.priority || 'medium',
    target_towers: bulletinData.target_towers || [],
    target_units: bulletinData.target_units || [],
    labels: bulletinData.labels?.filter(label => label.trim()) || [],
    attachments: bulletinData.attachments || [],
  };
};

/**
 * Validate bulletin data
 */
export const validateBulletinData = (bulletinData: Partial<BulletinFormData>): ValidationResult => {
  const errors: Record<string, string> = {};

  // Title validation
  if (!bulletinData.title?.trim()) {
    errors.title = 'Title is required';
  } else if (bulletinData.title.trim().length < 5) {
    errors.title = 'Title must be at least 5 characters long';
  } else if (bulletinData.title.trim().length > 200) {
    errors.title = 'Title must be less than 200 characters';
  }

  // Content validation
  if (!bulletinData.content?.trim()) {
    errors.content = 'Content is required';
  } else if (bulletinData.content.trim().length < 10) {
    errors.content = 'Content must be at least 10 characters long';
  } else if (bulletinData.content.trim().length > 5000) {
    errors.content = 'Content must be less than 5000 characters';
  }

  // Priority validation
  if (!bulletinData.priority) {
    errors.priority = 'Priority is required';
  } else if (!['low', 'medium', 'high'].includes(bulletinData.priority)) {
    errors.priority = 'Invalid priority level';
  }

  // Target validation
  if ((!bulletinData.target_towers || bulletinData.target_towers.length === 0) &&
      (!bulletinData.target_units || bulletinData.target_units.length === 0)) {
    errors.target = 'Please select at least one tower or unit';
  }

  // Labels validation
  if (bulletinData.labels && bulletinData.labels.length > 10) {
    errors.labels = 'Maximum 10 labels allowed';
  }

  // Attachments validation
  if (bulletinData.attachments && bulletinData.attachments.length > 10) {
    errors.attachments = 'Maximum 10 attachments allowed';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Filter bulletins by status
 */
export const filterBulletinsByStatus = (bulletins: Bulletin[], status: BulletinStatus): Bulletin[] => {
  return bulletins.filter(bulletin => bulletin.status === status);
};

/**
 * Filter bulletins by priority
 */
export const filterBulletinsByPriority = (bulletins: Bulletin[], priority: BulletinPriority): Bulletin[] => {
  return bulletins.filter(bulletin => bulletin.priority === priority);
};

/**
 * Filter bulletins by creator
 */
export const filterBulletinsByCreator = (bulletins: Bulletin[], creatorId: string): Bulletin[] => {
  return bulletins.filter(bulletin => bulletin.creator_id === creatorId);
};

/**
 * Filter bulletins by target towers
 */
export const filterBulletinsByTowers = (bulletins: Bulletin[], towerIds: string[]): Bulletin[] => {
  if (!towerIds || towerIds.length === 0) return bulletins;
  
  return bulletins.filter(bulletin => 
    bulletin.target_towers.some(towerId => towerIds.includes(towerId)) ||
    bulletin.target_units.some(unitId => {
      // This would need to be enhanced if you have unit-tower mapping
      return true; // Placeholder logic
    })
  );
};

/**
 * Sort bulletins by various criteria
 */
export const sortBulletins = (
  bulletins: Bulletin[],
  sortBy: 'created_at' | 'updated_at' | 'priority' | 'title' | 'views_count',
  sortOrder: 'asc' | 'desc' = 'desc'
): Bulletin[] => {
  const sorted = [...bulletins];
  
  sorted.sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'created_at':
      case 'updated_at':
        comparison = new Date(a[sortBy]).getTime() - new Date(b[sortBy]).getTime();
        break;
      case 'priority':
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'views_count':
        comparison = a.views_count - b.views_count;
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });
  
  return sorted;
};

/**
 * Get priority color for UI
 */
export const getPriorityColor = (priority: BulletinPriority): string => {
  switch (priority) {
    case 'high':
      return '#ef4444';
    case 'medium':
      return '#f59e0b';
    case 'low':
      return '#10b981';
    default:
      return '#6b7280';
  }
};

/**
 * Get priority icon name
 */
export const getPriorityIcon = (priority: BulletinPriority): string => {
  switch (priority) {
    case 'high':
      return 'alert-circle';
    case 'medium':
      return 'information-circle';
    case 'low':
      return 'checkmark-circle';
    default:
      return 'help-circle';
  }
};

/**
 * Get status color for UI
 */
export const getStatusColor = (status: BulletinStatus): string => {
  switch (status) {
    case 'draft':
      return '#6b7280';
    case 'pending':
      return '#f59e0b';
    case 'approved':
      return '#10b981';
    case 'rejected':
      return '#ef4444';
    case 'archived':
      return '#8b5cf6';
    case 'published':
      return '#3b82f6';
    default:
      return '#6b7280';
  }
};

/**
 * Get status icon name
 */
export const getStatusIcon = (status: BulletinStatus): string => {
  switch (status) {
    case 'draft':
      return 'document-outline';
    case 'pending':
      return 'time-outline';
    case 'approved':
      return 'checkmark-circle';
    case 'rejected':
      return 'close-circle';
    case 'archived':
      return 'archive';
    case 'published':
      return 'globe';
    default:
      return 'help-circle';
  }
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Check if file type is supported
 */
export const isSupportedFileType = (fileType: string): boolean => {
  const supportedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ];
  
  return supportedTypes.includes(fileType);
};

/**
 * Get file icon based on file type
 */
export const getFileIcon = (fileType: string): string => {
  if (fileType.startsWith('image/')) return 'image';
  if (fileType.includes('pdf')) return 'document-text';
  if (fileType.includes('word') || fileType.includes('doc')) return 'document';
  if (fileType.includes('excel') || fileType.includes('xls')) return 'grid';
  if (fileType.includes('text')) return 'document-text';
  return 'document';
};

/**
 * Format date for display
 */
export const formatDate = (dateString: string, format: 'short' | 'long' | 'relative' = 'short'): string => {
  const date = new Date(dateString);
  const now = new Date();
  
  if (format === 'relative') {
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  }
  
  if (format === 'long') {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Check if user has permission to perform action on bulletin
 */
export const checkBulletinPermission = (
  bulletin: Bulletin,
  userId: string,
  userRole: string,
  action: 'edit' | 'delete' | 'approve' | 'reject' | 'pin' | 'archive'
): boolean => {
  // Admin can do everything
  if (userRole === 'admin') return true;
  
  // Creator can edit and delete their own bulletins
  if (action === 'edit' || action === 'delete') {
    return bulletin.creator_id === userId;
  }
  
  // Moderators can approve, reject, pin, and archive
  if (userRole === 'moderator') {
    return ['approve', 'reject', 'pin', 'archive'].includes(action);
  }
  
  return false;
};
