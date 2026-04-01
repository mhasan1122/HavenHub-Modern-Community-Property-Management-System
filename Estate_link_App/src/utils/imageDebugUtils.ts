import { getBackendURL } from '../config/environment';
import { getPhotoURL } from './photoUtils';

interface AttachmentDebugInfo {
  id: number;
  file?: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  generatedUrl?: string | null;
  issues: string[];
}

/**
 * Debug attachment data to identify URL issues
 */
export const debugAttachment = (attachment: any): AttachmentDebugInfo => {
  const issues: string[] = [];
  
  if (!attachment.file && !attachment.file_url) {
    issues.push('No file or file_url provided');
  }
  
  if (attachment.file && !attachment.file.trim()) {
    issues.push('file property is empty string');
  }
  
  if (attachment.file_url && !attachment.file_url.trim()) {
    issues.push('file_url property is empty string');
  }
  
  if (attachment.file && attachment.file === 'null') {
    issues.push('file property is string "null"');
  }
  
  if (attachment.file_url && attachment.file_url === 'null') {
    issues.push('file_url property is string "null"');
  }

  const generatedUrl = getPhotoURL(attachment.file, attachment.file_url);
  
  if (!generatedUrl) {
    issues.push('Generated URL is null');
  }

  return {
    id: attachment.id,
    file: attachment.file,
    file_url: attachment.file_url,
    file_name: attachment.file_name,
    file_type: attachment.file_type,
    generatedUrl,
    issues
  };
};

/**
 * Debug a list of attachments
 */
export const debugAttachments = (attachments: any[]): AttachmentDebugInfo[] => {
  return attachments.map(debugAttachment);
};

/**
 * Test if a URL is accessible
 */
export const testImageUrl = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.log('❌ URL test failed:', url, error);
    return false;
  }
};

/**
 * Test backend connectivity
 */
export const testBackendConnectivity = async (): Promise<boolean> => {
  try {
    const backendUrl = getBackendURL();
    const response = await fetch(`${backendUrl}/`, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.log('❌ Backend connectivity test failed:', error);
    return false;
  }
};

/**
 * Comprehensive image debug report
 */
export const generateImageDebugReport = async (attachments: any[]) => {
  const backendConnected = await testBackendConnectivity();
  const attachmentDebugInfo = debugAttachments(attachments);
  
  const report = {
    timestamp: new Date().toISOString(),
    backendUrl: getBackendURL(),
    backendConnected,
    totalAttachments: attachments.length,
    attachmentsWithIssues: attachmentDebugInfo.filter(a => a.issues.length > 0).length,
    attachmentDetails: attachmentDebugInfo
  };
  
  console.log('🔍 Image Debug Report:', JSON.stringify(report, null, 2));
  
  return report;
};

/**
 * Test specific image URLs
 */
export const testAttachmentUrls = async (attachments: any[]) => {
  const results = await Promise.all(
    attachments.map(async (attachment) => {
      const url = getPhotoURL(attachment.file, attachment.file_url);
      const isAccessible = url ? await testImageUrl(url) : false;
      
      return {
        id: attachment.id,
        file_name: attachment.file_name,
        url,
        isAccessible,
        file: attachment.file,
        file_url: attachment.file_url
      };
    })
  );
  
  console.log('🔗 URL Test Results:', results);
  return results;
};
