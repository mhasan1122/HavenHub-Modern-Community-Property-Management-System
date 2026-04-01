/**
 * Test script to validate image handling improvements
 * This script can be imported and called from components to test image URL generation
 */

import { getPhotoURL, getAttachmentURL } from './photoUtils';
import { debugAttachment, generateImageDebugReport } from './imageDebugUtils';

// Mock attachment data for testing
const testAttachments = [
  {
    id: 1,
    file: 'announcements/1_📢 Exciting Announcem/bn.jpg',
    file_url: 'http://192.168.0.106:8000/media/announcements/1_📢%20Exciting%20Announcem/bn.jpg',
    file_name: 'bn.jpg',
    file_type: 'image/jpeg'
  },
  {
    id: 2,
    file: 'bulletins/26_create/9-siuuuuuuu2.jpg',
    file_url: null,
    file_name: '9-siuuuuuuu2.jpg',
    file_type: 'image/jpeg'
  },
  {
    id: 3,
    file: null,
    file_url: 'http://192.168.0.106:8000/media/notices/21_20250803/eng.jpg',
    file_name: 'eng.jpg',
    file_type: 'image/jpeg'
  },
  {
    id: 4,
    file: '',
    file_url: '',
    file_name: 'empty.jpg',
    file_type: 'image/jpeg'
  }
];

/**
 * Test URL generation for various scenarios
 */
export const testUrlGeneration = () => {
  console.log('🧪 Testing URL Generation:');
  
  testAttachments.forEach((attachment, index) => {
    console.log(`\n--- Test ${index + 1}: ${attachment.file_name} ---`);
    console.log('Input:', { file: attachment.file, file_url: attachment.file_url });
    
    const url1 = getPhotoURL(attachment.file ?? undefined, attachment.file_url ?? undefined);
    const url2 = getAttachmentURL({
      file: attachment.file ?? undefined,
      file_url: attachment.file_url ?? undefined
    });
    const debugInfo = debugAttachment(attachment);
    
    console.log('Generated URL (getPhotoURL):', url1);
    console.log('Generated URL (getAttachmentURL):', url2);
    console.log('Issues found:', debugInfo.issues);
  });
};

/**
 * Run comprehensive image debug test
 */
export const runImageDebugTest = async () => {
  console.log('🔍 Running comprehensive image debug test...');
  
  try {
    const report = await generateImageDebugReport(testAttachments);
    return report;
  } catch (error) {
    console.error('❌ Debug test failed:', error);
    return null;
  }
};

/**
 * Test specific edge cases
 */
export const testEdgeCases = () => {
  console.log('\n🔬 Testing Edge Cases:');
  
  const edgeCases = [
    { file: 'null', file_url: undefined },
    { file: undefined, file_url: 'null' },
    { file: '   ', file_url: '   ' },
    { file: '/media/test.jpg', file_url: undefined },
    { file: 'media/test.jpg', file_url: undefined },
    { file: undefined, file_url: 'https://example.com/test.jpg' },
  ];
  
  edgeCases.forEach((testCase, index) => {
    const url = getPhotoURL(testCase.file, testCase.file_url);
    console.log(`Edge case ${index + 1}:`, testCase, '→', url);
  });
};

// Export for use in components during development
export const runAllTests = async () => {
  testUrlGeneration();
  testEdgeCases();
  return await runImageDebugTest();
};
