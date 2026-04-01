import { getBackendURL } from '../config/environment';

/**
 * Get the full URL for a user's photo or attachment file
 * @param photoPath - The relative photo path from the backend (e.g., 'members/470_MirzaHasan/player-7902240_1280.jpg')
 * @param fileUrl - Optional full URL that might already be provided by the API
 * @param debugName - Optional name for debugging purposes
 * @returns The full URL to the photo, or null if no photo path provided
 */
export const getPhotoURL = (photoPath?: string, fileUrl?: string, debugName?: string): string | null => {
  const debug = (message: string, data?: any) => {
    // Temporarily disabled to prevent excessive logging in story viewer
    // if (debugName && __DEV__) {
    //   console.log(`[PhotoUtils ${debugName}] ${message}`, data || '');
    // }
  };

  debug('Input params:', { photoPath, fileUrl });

  // If we have a full file_url and it's valid, use it directly
  if (fileUrl && fileUrl.trim() !== '' && fileUrl !== 'null' && fileUrl !== 'undefined') {
    const trimmedUrl = fileUrl.trim();
    if (/^https?:\/\//i.test(trimmedUrl)) {
      debug('Using file_url:', trimmedUrl);
      return trimmedUrl;
    }
  }

  // Fall back to photoPath
  if (!photoPath || photoPath.trim() === '' || photoPath === 'null' || photoPath === 'undefined') {
    debug('No valid photo path found');
    return null;
  }

  const trimmed = photoPath.trim();

  // If already an absolute URL, return as is
  if (/^https?:\/\//i.test(trimmed)) {
    debug('Photo path is absolute URL:', trimmed);
    return trimmed;
  }

  // Normalize: remove leading slashes
  let normalized = trimmed.replace(/^\/+/, '');

  const backendURL = getBackendURL().replace(/\/+$/, '');
  let finalUrl: string;
  if (/^backend\/media\//i.test(normalized)) {
    // Keep backend/media path as-is after domain
    finalUrl = `${backendURL}/${normalized}`;
  } else if (/^media\//i.test(normalized)) {
    // Already rooted at media
    finalUrl = `${backendURL}/${normalized}`;
  } else {
    // Default to /media prefix
    finalUrl = `${backendURL}/media/${normalized}`;
  }
  
  debug('Generated URL:', finalUrl);
  return finalUrl;
};

/**
 * Get the attachment URL with automatic fallback handling
 * @param attachment - Attachment object with file and file_url properties
 * @returns The full URL to the attachment, or null if no valid URL found
 */
export const getAttachmentURL = (attachment: { file?: string; file_url?: string }): string | null => {
  return getPhotoURL(attachment.file, attachment.file_url);
};

/**
 * Get the first letter of a user's name for avatar fallback
 * @param fullName - The user's full name
 * @returns The first letter, or 'U' as default
 */
export const getInitialLetter = (fullName?: string | null): string => {
  if (!fullName || fullName.trim() === '' || fullName === 'null' || fullName === 'undefined') {
    return 'U';
  }
  
  return fullName.trim().charAt(0).toUpperCase();
};
