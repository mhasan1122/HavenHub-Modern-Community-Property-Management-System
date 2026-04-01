// Utility functions for notice data formatting and validation

// Get current user from localStorage
const getCurrentUser = () => {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error('Error parsing user from localStorage:', error);
    return null;
  }
};

// Utility function to format notice data for API
export const formatNoticeForApi = (formData, attachments = []) => {
  const currentUser = getCurrentUser();

  // Validate required fields first
  const requiredFields = ['startDate', 'startTime', 'endDate', 'endTime', 'label'];
  const missingFields = requiredFields.filter(field => {
    const value = formData[field];
    if (!value) return true;
    // For string fields, check if they're empty after trimming
    if (typeof value === 'string') {
      return value.trim() === '';
    }
    return false;
  });

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }

  // Validate user
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  // Validate and format post_as
  let post_as;
  let posted_group = null;
  let posted_member = null;

  // Normalize postAs value to lowercase for comparison
  const normalizedPostAs = formData.postAs?.toLowerCase();

  if (normalizedPostAs === 'individual' || normalizedPostAs === 'creator') {
    post_as = 'creator';
    // For creator posts, both posted_group and posted_member should be null
  } else if (normalizedPostAs === 'group') {
    // Check for selectedGroup (Edit Notice format) or selectedGroupId (Add Notice format)
    const groupId = formData.selectedGroup?.id || formData.selectedGroupId;
    if (!groupId) {
      throw new Error('Group selection is required when posting as group');
    }
    post_as = 'group';
    posted_group = groupId;
  } else if (normalizedPostAs === 'member') {
    // Check for selectedMember (Edit Notice format) or selectedMemberId (Add Notice format)
    const memberId = formData.selectedMember?.id || formData.selectedMemberId;
    if (!memberId) {
      throw new Error('Member selection is required when posting as member');
    }
    post_as = 'member';
    posted_member = memberId;
  } else {
    throw new Error('Invalid post_as value. Must be "creator", "group", or "member"');
  }

  // Validate and format priority
  const validPriorities = ['urgent', 'high', 'normal', 'low'];
  const priority = formData.priority?.toLowerCase();
  if (!validPriorities.includes(priority)) {
    throw new Error(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
  }

  // Validate and format label
  const label = formData.label?.trim();
  if (!label) {
    throw new Error('Label is required');
  }

  // Format target towers and units
  let target_tower_ids = [];
  let target_unit_ids = [];

  // Check for both possible field names (towers/selectedTowers and units/selectedUnits)
  const towersData = formData.towers || formData.selectedTowers;
  const unitsData = formData.units || formData.selectedUnits;

  // Handle towers selection:
  // - If "All" is selected, send EMPTY array (backend RULE 1: all members)
  // - If specific towers selected, send those tower IDs only
  // - If nothing selected, send EMPTY array
  if (towersData && towersData.length > 0) {
    // Check if "All" is selected
    if (towersData.includes('All')) {
      // "All" selected = Global notice = Send NO tower IDs
      // Backend will apply RULE 1 (all organization + community members)
      target_tower_ids = [];
    } else {
      // Specific towers selected = Send those specific tower IDs
      target_tower_ids = towersData.map(tower =>
        typeof tower === 'object' ? tower.id : tower
      ).filter(id => id != null && id !== 'All');
    }
  }

  // Handle units selection:
  // - If "All" is selected, send EMPTY array (backend RULE 3: all units in selected towers)
  // - If specific units selected, send those unit IDs only
  // - If nothing selected, send EMPTY array
  if (unitsData && unitsData.length > 0) {
    // Check if "All" is selected
    if (unitsData.includes('All')) {
      // "All" selected = Tower-only notice = Send NO unit IDs
      // Backend will apply RULE 3 (all units in selected towers)
      target_unit_ids = [];
    } else {
      // Specific units selected = Send those specific unit IDs
      target_unit_ids = unitsData.map(unit =>
        typeof unit === 'object' ? unit.id : unit
      ).filter(id => id != null && id !== 'All');
    }
  }

  // Process attachments (notices support images and PDFs)
  let base64_attachments = [];
  if (attachments && attachments.length > 0) {
    base64_attachments = attachments.map(attachment => {
      if (!attachment.base64) {
        throw new Error('Attachment must have base64 data');
      }

      return {
        name: attachment.name || 'unnamed_file',
        type: attachment.type || 'application/octet-stream', // Don't default to image/jpeg
        base64: attachment.base64.split(',')[1] || attachment.base64 // Remove data:type;base64, prefix if present
      };
    });
  }

  // Prepare the base notice data
  const noticeData = {
    post_as: post_as,
    posted_group: posted_group,
    posted_member: posted_member,
    priority: priority,
    label: label.trim(),
    start_date: formData.startDate,
    start_time: formData.startTime,
    end_date: formData.endDate,
    end_time: formData.endTime,
    target_tower_ids: target_tower_ids,
    target_unit_ids: target_unit_ids,
    base64_attachments: base64_attachments
  };

  // Add attachments to delete if provided (for edit operations)
  if (formData.attachmentsToDelete && formData.attachmentsToDelete.length > 0) {
    noticeData.attachments_to_delete = formData.attachmentsToDelete;
  }

  return noticeData;
};

// Utility function to format notice data for editing
export const formatNoticeForEdit = (notice) => {
  if (!notice) return null;

  // Convert backend post_as string to frontend format (capitalized for Edit Notice component)
  const convertPostAsToFrontend = (backendValue) => {
    const mapping = {
      'creator': 'Creator',
      'group': 'Group',
      'member': 'Member'
    };
    return mapping[backendValue] || 'Creator';
  };

  return {
    priority: notice.priority || 'normal',
    label: notice.label || '',
    startDate: notice.start_date || '',
    startTime: notice.start_time || '',
    endDate: notice.end_date || '',
    endTime: notice.end_time || '',
    postAs: convertPostAsToFrontend(notice.post_as),
    selectedGroup: notice.post_as === 'group' && notice.posted_group ? {
      id: notice.posted_group,
      name: notice.group_name || 'Unknown Group'
    } : null,
    selectedMember: notice.post_as === 'member' && notice.posted_member ? {
      id: notice.posted_member,
      name: notice.member_name || 'Unknown Member'
    } : null,
    towers: notice.target_towers || [],
    units: notice.target_units || [],
  };
};

// Utility function to validate notice form data
export const validateNoticeData = (formData) => {
  const errors = {};

  // Required field validation

  if (!formData.startDate) {
    errors.startDate = 'Start date is required';
  }

  if (!formData.startTime) {
    errors.startTime = 'Start time is required';
  }

  if (!formData.endDate) {
    errors.endDate = 'End date is required';
  }

  if (!formData.endTime) {
    errors.endTime = 'End time is required';
  }

  if (!formData.label?.trim()) {
    errors.label = 'Label is required';
  }

  if (!formData.priority) {
    errors.priority = 'Priority is required';
  }

  // Date validation
  if (formData.startDate && formData.endDate) {
    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);
    
    if (endDate < startDate) {
      errors.endDate = 'End date cannot be before start date';
    }
  }

  // Time validation for same day
  if (formData.startDate && formData.endDate && formData.startTime && formData.endTime) {
    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);
    
    if (startDate.toDateString() === endDate.toDateString()) {
      const startTime = formData.startTime;
      const endTime = formData.endTime;
      
      if (endTime <= startTime) {
        errors.endTime = 'End time must be after start time for same day notices';
      }
    }
  }

  // Group validation
  const normalizedPostAs = formData.postAs?.toLowerCase();
  if (normalizedPostAs === 'group' && !formData.selectedGroup) {
    errors.postAs = 'Please select a group when posting as group';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Utility function to filter notices by status
export const filterNoticesByStatus = (notices, status) => {
  if (!notices || !Array.isArray(notices)) return [];

  const now = new Date();

  return notices.filter(notice => {
    // Handle both camelCase (transformed) and snake_case (original) field names
    const startDateField = notice.startDate || notice.start_date;
    const startTimeField = notice.startTime || notice.start_time;
    const endDateField = notice.endDate || notice.end_date;
    const endTimeField = notice.endTime || notice.end_time;

    // Create proper ISO datetime strings for reliable parsing
    // Backend sends dates as YYYY-MM-DD and times as HH:MM:SS or HH:MM
    const startDateTime = new Date(`${startDateField}T${startTimeField}`);
    const endDateTime = new Date(`${endDateField}T${endTimeField}`);

    switch (status) {
      case 'ongoing':
        return startDateTime <= now && endDateTime >= now && notice.status !== 'expired';
      case 'upcoming':
        return startDateTime > now && notice.status !== 'expired';
      case 'expired':
        return notice.status === 'expired' || endDateTime < now;
      default:
        return true;
    }
  });
};

// Utility function to get notice status
export const getNoticeStatus = (notice) => {
  if (!notice) return 'unknown';

  if (notice.status === 'expired') return 'expired';

  const now = new Date();

  // Handle both camelCase (transformed) and snake_case (original) field names
  const startDateField = notice.startDate || notice.start_date;
  const startTimeField = notice.startTime || notice.start_time;
  const endDateField = notice.endDate || notice.end_date;
  const endTimeField = notice.endTime || notice.end_time;

  // Create proper ISO datetime strings for reliable parsing
  const startDateTime = new Date(`${startDateField}T${startTimeField}`);
  const endDateTime = new Date(`${endDateField}T${endTimeField}`);

  if (startDateTime <= now && endDateTime >= now) return 'ongoing';
  if (startDateTime > now) return 'upcoming';
  if (endDateTime < now) return 'expired';

  return 'unknown';
};

// Utility function to format date for display
export const formatDateForDisplay = (dateString, timeString) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(`${dateString}${timeString ? ` ${timeString}` : ''}`);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(timeString && {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
};

// Convert base64 to Blob
export const base64ToBlob = (base64, contentType = '') => {
  const byteCharacters = atob(base64.split(',')[1] || base64);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);

    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
};

// Check if file is image
export const isImage = (fileName) => {
  if (!fileName) return false;
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
  const extension = fileName.split('.').pop().toLowerCase();
  return imageExtensions.includes(extension);
};

// Check if file size is within limit (5MB for images)
export const isFileSizeValid = (file, maxSizeMB = 5) => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};

// Get file type from file object or filename
export const getFileType = (file) => {
  if (file.type) return file.type;
  
  const extension = file.name?.split('.').pop()?.toLowerCase();
  const typeMap = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp'
  };
  
  return typeMap[extension] || 'application/octet-stream';
}; 