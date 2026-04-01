/**
 * Utility functions for bulletin management
 */

/**
 * Format bulletin data for API submission
 * @param {Object} data - Raw bulletin form data
 * @param {Array} attachments - Array of attachment objects
 * @returns {FormData} - Formatted data for API
 */
export const formatBulletinForApi = (data, attachments = []) => {
  // Debug logging (can be removed in production)
  // console.log('formatBulletinForApi - Input data:', data);
  // console.log('formatBulletinForApi - selectedTowers:', data.selectedTowers);
  // console.log('formatBulletinForApi - selectedUnits:', data.selectedUnits);

  // Helper function to process IDs (flatten nested arrays and convert to integers)
  const processIds = (items) => {
    if (!items) {
      return [];
    }

    // Handle case where items is not an array
    if (!Array.isArray(items)) {
      items = [items];
    }

    // Check if "All" is present - if so, return empty array
    // This signals the backend to use its default targeting rules
    if (items.includes('All')) {
      return [];
    }

    const flattened = items.flat();

    const processed = flattened.map((item) => {
      // If item is an object with id property, extract the id
      if (typeof item === 'object' && item !== null && item.id !== undefined) {
        return parseInt(item.id, 10);
      }

      // If item is already a number or string ID, parse it
      return parseInt(item, 10);
    }).filter((id) => {
      return !isNaN(id) && id > 0;
    });

    return processed;
  };

  const formData = new FormData();

  // Basic bulletin information
  formData.append('title', data.title || '');
  formData.append('description', data.description || '');
  formData.append('label', data.label || '');
  formData.append('priority', data.priority || 'normal'); // Default priority for bulletins

  // Post as information
  formData.append('post_as', data.postAs?.toLowerCase() || 'creator');

  // Add post as specific data
  if (data.postAs === "Group" && data.selectedGroupId) {
    formData.append('posted_group', data.selectedGroupId);
  } else if (data.postAs === "Member" && data.selectedMemberId) {
    formData.append('posted_member', data.selectedMemberId);
  }

  // Tower and unit targeting - process IDs to handle nested arrays
  const towerIds = processIds(data.selectedTowers);
  const unitIds = processIds(data.selectedUnits);

  // console.log('Final towerIds to append:', towerIds);
  // console.log('Final unitIds to append:', unitIds);

  // Only append if there are valid IDs - don't append anything if arrays are empty
  if (towerIds.length > 0) {
    towerIds.forEach(id => {
      formData.append('target_tower_ids', id.toString());
    });
  }

  if (unitIds.length > 0) {
    unitIds.forEach(id => {
      formData.append('target_unit_ids', id.toString());
    });
  }

  // Handle attachments
  if (attachments && attachments.length > 0) {
    const base64Attachments = [];

    attachments.forEach((attachment) => {
      if (attachment.file) {
        // If it's a File object, append directly
        formData.append('attachments', attachment.file);
      } else if (attachment.base64) {
        // If it's base64, collect for base64_attachments
        base64Attachments.push({
          file_name: attachment.name,
          file_type: attachment.type,
          file_data: attachment.base64
        });
      }
    });

    // Add base64 attachments if any
    if (base64Attachments.length > 0) {
      formData.append('base64_attachments', JSON.stringify(base64Attachments));
    }
  }

  // Attachments to delete (for updates)
  if (data.attachments_to_delete && Array.isArray(data.attachments_to_delete)) {
    data.attachments_to_delete.forEach(id => {
      formData.append('attachments_to_delete', id);
    });
  }

  return formData;
};

/**
 * Validate bulletin data before submission
 * @param {Object} bulletinData - Bulletin data to validate
 * @returns {Object} - Validation result with isValid and errors
 */
export const validateBulletinData = (bulletinData) => {
  const errors = {};
  let isValid = true;

  // Required fields
  if (!bulletinData.title || bulletinData.title.trim() === '') {
    errors.title = 'Title is required';
    isValid = false;
  }

  if (!bulletinData.label || bulletinData.label.trim() === '') {
    errors.label = 'Label is required';
    isValid = false;
  }

  // Title length validation
  if (bulletinData.title && bulletinData.title.length > 255) {
    errors.title = 'Title must be less than 255 characters';
    isValid = false;
  }

  // Emoji validation for title and description
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;

  if (bulletinData.title && emojiRegex.test(bulletinData.title)) {
    errors.title = 'Title cannot contain emojis';
    isValid = false;
  }

  if (bulletinData.description && emojiRegex.test(bulletinData.description)) {
    errors.description = 'Description cannot contain emojis';
    isValid = false;
  }

  // Label validation
  if (bulletinData.label && Array.isArray(bulletinData.label)) {
    const validLabels = bulletinData.label.filter(label => label.trim() !== '');

    if (validLabels.length > 10) {
      errors.label = 'Maximum 10 labels allowed';
      isValid = false;
    }

    // Check individual label word count and emoji content
    for (const label of validLabels) {
      const wordCount = label.trim().split(/\s+/).length;
      if (wordCount > 10) {
        errors.label = 'Each label must be 10 words or less';
        isValid = false;
        break;
      }

      if (emojiRegex.test(label)) {
        errors.label = 'Labels cannot contain emojis';
        isValid = false;
        break;
      }
    }

    // Check total character limit
    const totalLabelLength = validLabels.join(', ').length;
    if (totalLabelLength > 200) {
      errors.label = 'Total label length cannot exceed 200 characters';
      isValid = false;
    }
  }

  return { isValid, errors };
};

/**
 * Filter bulletins by status
 * @param {Array} bulletins - Array of bulletins
 * @param {string} status - Status to filter by ('current', 'pending', 'archive')
 * @returns {Array} - Filtered bulletins
 */
export const filterBulletinsByStatus = (bulletins, status) => {
  if (!Array.isArray(bulletins)) return [];
  
  return bulletins.filter(bulletin => bulletin.status === status);
};

/**
 * Sort bulletins by pinned status and creation date
 * @param {Array} bulletins - Array of bulletins
 * @returns {Array} - Sorted bulletins
 */
export const sortBulletins = (bulletins) => {
  if (!Array.isArray(bulletins)) return [];
  
  return [...bulletins].sort((a, b) => {
    // First sort by pinned status (pinned first)
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    
    // Then sort by creation date (newest first)
    return new Date(b.created_at) - new Date(a.created_at);
  });
};

/**
 * Get bulletin status display text
 * @param {string} status - Bulletin status
 * @returns {string} - Display text for status
 */
export const getBulletinStatusText = (status) => {
  const statusMap = {
    current: 'Current',
    pending: 'Pending',
    archive: 'Archive'
  };
  
  return statusMap[status] || status;
};

/**
 * Get bulletin priority color class
 * @param {string} priority - Bulletin priority
 * @returns {string} - CSS class for priority color
 */
export const getBulletinPriorityColor = (priority) => {
  const priorityColors = {
    urgent: 'text-red-600 bg-red-100',
    high: 'text-orange-600 bg-orange-100',
    normal: 'text-blue-600 bg-blue-100',
    low: 'text-gray-600 bg-gray-100'
  };
  
  return priorityColors[priority] || priorityColors.normal;
};

/**
 * Format bulletin labels for display
 * @param {string} labelString - Comma-separated label string
 * @returns {Array} - Array of individual labels
 */
export const formatBulletinLabels = (labelString) => {
  if (!labelString) return [];
  
  return labelString
    .split(',')
    .map(label => label.trim())
    .filter(label => label.length > 0);
};

/**
 * Check if user can approve/reject bulletin
 * @param {Object} user - Current user object
 * @param {Object} bulletin - Bulletin object
 * @returns {boolean} - Whether user can approve/reject
 */
export const canUserApproveBulletin = (user, bulletin) => {
  // Add your permission logic here
  // For now, assuming any user can approve/reject
  return true;
};

/**
 * Get file type icon class
 * @param {string} fileType - File MIME type
 * @returns {string} - Icon class name
 */
export const getFileTypeIcon = (fileType) => {
  if (fileType.startsWith('image/')) return 'FaImage';
  if (fileType === 'application/pdf') return 'FaFilePdf';
  if (fileType.includes('word') || fileType.includes('document')) return 'FaFileWord';
  return 'FaFile';
};

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format bulletin data for editing
 * @param {Object} bulletin - Bulletin object from API
 * @returns {Object} - Formatted data for form
 */
export const formatBulletinForEdit = (bulletin) => {
  if (!bulletin) return {};

  // Format tower data - convert to numbers and let TowerSelector handle "All" logic
  const selectedTowers = bulletin.target_towers_data
    ? bulletin.target_towers_data.map(tower => {
        // If tower is an object with id, extract and convert to number
        if (typeof tower === 'object' && tower !== null && tower.id !== undefined) {
          return Number(tower.id);
        }
        // If tower is already an ID, convert to number
        return Number(tower);
      }).filter(id => !isNaN(id) && id > 0)
    : [];

  // Format unit data - convert to numbers for proper selector handling
  const selectedUnits = bulletin.target_units_data
    ? bulletin.target_units_data.map(unit => {
        // If unit is an object with id, extract and convert to number
        if (typeof unit === 'object' && unit !== null && unit.id !== undefined) {
          return Number(unit.id);
        }
        // If unit is already an ID, convert to number
        return Number(unit);
      }).filter(id => !isNaN(id) && id > 0)
    : [];

  return {
    title: bulletin.title || '',
    description: bulletin.description || '',
    postAs: bulletin.post_as === 'creator' ? 'Creator' :
           bulletin.post_as === 'group' ? 'Group' :
           bulletin.post_as === 'member' ? 'Member' : 'Creator',
    creatorName: bulletin.creator_name || '',
    selectedMemberId: bulletin.posted_member || '',
    selectedMemberName: bulletin.member_name || '',
    selectedGroupId: bulletin.posted_group || '',
    selectedGroupName: bulletin.group_name || '',
    label: bulletin.label || '',
    selectedTowers: selectedTowers,
    selectedUnits: selectedUnits,
    attachments: bulletin.attachments || []
  };
};

/**
 * Get bulletin tab name by index
 * @param {number} tabIndex - Tab index (1, 2, 3)
 * @returns {string} - Tab name
 */
export const getBulletinTabName = (tabIndex) => {
  const tabNames = {
    1: 'Current Bulletin',
    2: 'Pending Bulletin',
    3: 'Archive'
  };

  return tabNames[tabIndex] || 'Unknown';
};

/**
 * Get bulletin status from tab index
 * @param {number} tabIndex - Tab index (1, 2, 3)
 * @returns {string} - Status string
 */
export const getBulletinStatusFromTab = (tabIndex) => {
  const statusMap = {
    1: 'current',
    2: 'pending',
    3: 'archive'
  };

  return statusMap[tabIndex] || 'current';
};

/**
 * Get tab index from bulletin status
 * @param {string} status - Bulletin status
 * @returns {number} - Tab index
 */
export const getTabFromBulletinStatus = (status) => {
  const tabMap = {
    'current': 1,
    'pending': 2,
    'archive': 3
  };

  return tabMap[status] || 1;
};
