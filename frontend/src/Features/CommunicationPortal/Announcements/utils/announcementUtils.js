// Utility functions for announcement data formatting and validation
import axiosInstance from '../../../../utils/axiosInstance';

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

// Fetch all towers from backend
const fetchAllTowers = async () => {
  try {
    const response = await axiosInstance.get('/api/towers/');
    const towersData = response.data.results || response.data;
    return Array.isArray(towersData) ? towersData : [];
  } catch (error) {
    console.error('[AnnouncementUtils] Error fetching towers:', error);
    return [];
  }
};

// Fetch all units from backend
const fetchAllUnits = async () => {
  try {
    const response = await axiosInstance.get('/api/units/');
    const unitsData = response.data.results || response.data;
    return Array.isArray(unitsData) ? unitsData : [];
  } catch (error) {
    console.error('[AnnouncementUtils] Error fetching units:', error);
    return [];
  }
};

// Utility function to format announcement data for API
export const formatAnnouncementForApi = async (formData, attachments = []) => {
  const currentUser = getCurrentUser();

  // Validate required fields first
  const requiredFields = ['title', 'startDate', 'startTime', 'endDate', 'endTime', 'label'];
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
    // Check for selectedGroup (Edit Announcement format) or selectedGroupId (Add Announcement format)
    const groupId = formData.selectedGroup?.id || formData.selectedGroupId;
    if (!groupId) {
      throw new Error('Group selection is required when posting as group');
    }
    post_as = 'group';
    posted_group = groupId;
  } else if (normalizedPostAs === 'member') {
    // Check for selectedMember (Edit Announcement format) or selectedMemberId (Add Announcement format)
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
  // - If "All" is selected, fetch and send ALL tower IDs (so community members receive notifications)
  // - If specific towers selected, send those tower IDs only
  // - If nothing selected, send EMPTY array (org members only)
  if (towersData && towersData.length > 0) {
    // Check if "All" is selected
    if (towersData.includes('All')) {
      // "All" selected = Fetch ALL tower IDs and send them
      // This ensures community members in all towers receive notifications
      const allTowers = await fetchAllTowers();
      target_tower_ids = allTowers.map(tower => tower.id);
      console.log('[AnnouncementUtils] "All" towers selected - sending all tower IDs:', target_tower_ids);
    } else {
      // Specific towers selected = Send those specific tower IDs
      target_tower_ids = towersData.map(tower =>
        typeof tower === 'object' ? tower.id : tower
      ).filter(id => id != null && id !== 'All');
      console.log('[AnnouncementUtils] Specific towers selected:', target_tower_ids);
    }
  } else {
    console.log('[AnnouncementUtils] No towers selected - empty array (org members only)');
  }

  // Handle units selection:
  // - If "All" is selected, fetch units from the selected towers (or all units if all towers selected)
  // - If specific units selected, send those unit IDs only
  // - If nothing selected, send EMPTY array (depends on tower selection)
  if (unitsData && unitsData.length > 0) {
    // Check if "All" is selected
    if (unitsData.includes('All')) {
      // "All" units selected - fetch units based on tower selection
      if (target_tower_ids.length > 0) {
        // Fetch units only from the selected towers
        const towerIdsParam = target_tower_ids.join(',');
        const response = await axiosInstance.get(`/api/units/?tower_ids=${towerIdsParam}`);
        const unitsInTowers = response.data.results || response.data;
        target_unit_ids = Array.isArray(unitsInTowers) ? unitsInTowers.map(unit => unit.id) : [];
        console.log('[AnnouncementUtils] "All" units selected for specific towers - sending unit IDs from towers:', target_tower_ids, '=> units:', target_unit_ids);
      } else {
        // No specific towers selected, fetch all units from all towers
        const allUnits = await fetchAllUnits();
        target_unit_ids = allUnits.map(unit => unit.id);
        console.log('[AnnouncementUtils] "All" units selected (all towers) - sending all unit IDs:', target_unit_ids);
      }
    } else {
      // Specific units selected = Send those specific unit IDs
      target_unit_ids = unitsData.map(unit =>
        typeof unit === 'object' ? unit.id : unit
      ).filter(id => id != null && id !== 'All');
      console.log('[AnnouncementUtils] Specific units selected:', target_unit_ids);
    }
  } else {
    console.log('[AnnouncementUtils] No units selected - empty array');
  }

  // Process attachments
  let base64_attachments = [];
  if (attachments && attachments.length > 0) {
    base64_attachments = attachments.map(attachment => {
      if (!attachment.base64) {
        throw new Error('Attachment must have base64 data');
      }

      return {
        name: attachment.name || 'unnamed_file',
        type: attachment.type || 'application/octet-stream',
        base64: attachment.base64.split(',')[1] || attachment.base64 // Remove data:type;base64, prefix if present
      };
    });
  }

  // Prepare the base announcement data
  const announcementData = {
    title: formData.title.trim(),
    description: formData.description ? formData.description.trim() : '',  // Make description optional
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
    announcementData.attachments_to_delete = formData.attachmentsToDelete;
  }

  return announcementData;
};

// Utility function to format announcement data for editing
export const formatAnnouncementForEdit = (announcement) => {
  if (!announcement) return null;

  // Convert backend post_as string to frontend format (capitalized for Edit Announcement component)
  const convertPostAsToFrontend = (backendValue) => {
    const mapping = {
      'creator': 'Creator',
      'group': 'Group',
      'member': 'Member'
    };
    return mapping[backendValue] || 'Creator';
  };

  // FIXED: Use target_towers_data and target_units_data (the actual field names from backend)
  const towers = announcement.target_towers_data || announcement.target_towers || [];
  const units = announcement.target_units_data || announcement.target_units || [];

  console.log('[formatAnnouncementForEdit] Towers data:', towers);
  console.log('[formatAnnouncementForEdit] Units data:', units);

  return {
    title: announcement.title || '',
    description: announcement.description || '',
    priority: announcement.priority || 'normal',
    label: announcement.label || '',
    startDate: announcement.start_date || '',
    startTime: announcement.start_time || '',
    endDate: announcement.end_date || '',
    endTime: announcement.end_time || '',
    postAs: convertPostAsToFrontend(announcement.post_as),
    selectedGroup: announcement.post_as === 'group' && announcement.posted_group ? {
      id: announcement.posted_group,
      name: announcement.group_name || 'Unknown Group'
    } : null,
    selectedMember: announcement.post_as === 'member' && announcement.posted_member ? {
      id: announcement.posted_member,
      name: announcement.member_name || 'Unknown Member'
    } : null,
    towers: towers,
    units: units,
    target_tower_ids: announcement.target_tower_ids || announcement.target_towers || [],
    target_unit_ids: announcement.target_unit_ids || announcement.target_units || [],
  };
};

// Utility function to validate announcement form data
export const validateAnnouncementData = (formData) => {
  const errors = {};

  // Required field validation
  if (!formData.title?.trim()) {
    errors.title = 'Title is required';
  }

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
        errors.endTime = 'End time must be after start time for same day announcements';
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

// Utility function to filter announcements by status
export const filterAnnouncementsByStatus = (announcements, status) => {
  if (!announcements || !Array.isArray(announcements)) return [];

  const now = new Date();

  return announcements.filter(announcement => {
    // Handle both camelCase (transformed) and snake_case (original) field names
    const startDateField = announcement.startDate || announcement.start_date;
    const startTimeField = announcement.startTime || announcement.start_time;
    const endDateField = announcement.endDate || announcement.end_date;
    const endTimeField = announcement.endTime || announcement.end_time;

    // Create proper ISO datetime strings for reliable parsing
    // Backend sends dates as YYYY-MM-DD and times as HH:MM:SS or HH:MM
    const startDateTime = new Date(`${startDateField}T${startTimeField}`);
    const endDateTime = new Date(`${endDateField}T${endTimeField}`);

    switch (status) {
      case 'ongoing':
        return startDateTime <= now && endDateTime >= now && announcement.status !== 'expired';
      case 'upcoming':
        return startDateTime > now && announcement.status !== 'expired';
      case 'expired':
        return announcement.status === 'expired' || endDateTime < now;
      default:
        return true;
    }
  });
};

// Utility function to get announcement status
export const getAnnouncementStatus = (announcement) => {
  if (!announcement) return 'unknown';

  if (announcement.status === 'expired') return 'expired';

  const now = new Date();

  // Handle both camelCase (transformed) and snake_case (original) field names
  const startDateField = announcement.startDate || announcement.start_date;
  const startTimeField = announcement.startTime || announcement.start_time;
  const endDateField = announcement.endDate || announcement.end_date;
  const endTimeField = announcement.endTime || announcement.end_time;

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
