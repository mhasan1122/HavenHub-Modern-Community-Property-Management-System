#!/usr/bin/env node

/**
 * Test runner script for Announcement&NoticeScreen tests
 * 
 * This script runs all unit tests for the Announcement&NoticeScreen components
 * and provides a summary of the test results.
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Running Announcement&NoticeScreen Unit Tests...\n');

try {
  // Get the project root directory
  const projectRoot = path.resolve(__dirname, '../../../../..');
  
  // Run Jest tests for the specific test files
  const testCommand = `npx jest --config ../../../../jest.config.simple.js "announcement-notice.test.js" --verbose`;
  
  console.log('📁 Test Directory:', __dirname);
  console.log('🚀 Running command:', testCommand);
  console.log('─'.repeat(60));
  
  execSync(testCommand, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });
  
  console.log('\n✅ All tests completed successfully!');
  
} catch (error) {
  console.error('\n❌ Test execution failed:');
  console.error(error.message);
  process.exit(1);
}
