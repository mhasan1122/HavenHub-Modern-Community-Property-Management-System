#!/usr/bin/env node

/**
 * Test Runner Script for BulletinScreen Tests
 * 
 * This script provides an easy way to run all BulletinScreen tests
 * with proper configuration and reporting.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const CONFIG = {
  testPattern: 'TestBulletinScreen',
  coverage: true,
  verbose: true,
  watch: false,
  updateSnapshots: false,
  clearCache: false,
  maxWorkers: '50%',
  testTimeout: 10000,
  colors: true,
  reporters: ['default', 'jest-junit'],
  outputDir: './test-results'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Helper functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`  ${message}`, 'bright');
  log(`${'='.repeat(60)}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Check if Jest is available
function checkJestAvailability() {
  try {
    execSync('npx jest --version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

// Check if test files exist
function checkTestFiles() {
  const testDir = __dirname;
  const testFiles = [
    'BulletinBoard.test.tsx',
    'BulletinCard.test.tsx',
    'Archive.test.tsx',
    'EditBulletinForm.test.tsx',
    'PendingBulletin.test.tsx',
    'CreateBulletinForm.test.tsx',
    'index.test.ts'
  ];

  const missingFiles = testFiles.filter(file => {
    const filePath = path.join(testDir, file);
    return !fs.existsSync(filePath);
  });

  if (missingFiles.length > 0) {
    logError(`Missing test files: ${missingFiles.join(', ')}`);
    return false;
  }

  return true;
}

// Create output directory
function createOutputDir() {
  const outputDir = path.join(__dirname, CONFIG.outputDir);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    logInfo(`Created output directory: ${outputDir}`);
  }
}

// Build Jest command
function buildJestCommand(options = {}) {
  const config = { ...CONFIG, ...options };
  const command = ['npx jest'];
  
  // Add test pattern
  command.push(`--testPathPattern="${config.testPattern}"`);
  
  // Add coverage
  if (config.coverage) {
    command.push('--coverage');
    command.push('--coverageDirectory=./test-results/coverage');
    command.push('--coverageReporters=text,lcov,html,json');
  }
  
  // Add verbose output
  if (config.verbose) {
    command.push('--verbose');
  }
  
  // Add watch mode
  if (config.watch) {
    command.push('--watch');
  }
  
  // Add update snapshots
  if (config.updateSnapshots) {
    command.push('--updateSnapshot');
  }
  
  // Add clear cache
  if (config.clearCache) {
    command.push('--clearCache');
  }
  
  // Add max workers
  command.push(`--maxWorkers=${config.maxWorkers}`);
  
  // Add test timeout
  command.push(`--testTimeout=${config.testTimeout}`);
  
  // Add colors
  if (config.colors) {
    command.push('--colors');
  }
  
  // Add reporters
  config.reporters.forEach(reporter => {
    command.push(`--reporters=${reporter}`);
  });
  
  return command.join(' ');
}

// Run tests
function runTests(options = {}) {
  const command = buildJestCommand(options);
  
  logInfo(`Running command: ${command}`);
  
  try {
    const output = execSync(command, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '../../..') // Run from project root
    });
    
    logSuccess('Tests completed successfully!');
    return true;
  } catch (error) {
    logError('Tests failed!');
    logError(`Exit code: ${error.status}`);
    return false;
  }
}

// Run specific test file
function runSpecificTest(testFile, options = {}) {
  const command = buildJestCommand({
    ...options,
    testPathPattern: testFile
  });
  
  logInfo(`Running specific test: ${testFile}`);
  
  try {
    execSync(command, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '../../..')
    });
    
    logSuccess(`Test ${testFile} completed successfully!`);
    return true;
  } catch (error) {
    logError(`Test ${testFile} failed!`);
    return false;
  }
}

// Generate test report
function generateTestReport() {
  const reportPath = path.join(__dirname, CONFIG.outputDir, 'test-report.md');
  const coveragePath = path.join(__dirname, CONFIG.outputDir, 'coverage');
  
  let report = '# BulletinScreen Test Report\n\n';
  report += `Generated on: ${new Date().toLocaleString()}\n\n`;
  
  // Add test summary
  report += '## Test Summary\n\n';
  report += '- **Total Test Files**: 7\n';
  report += '- **Components Tested**: 6\n';
  report += '- **Test Categories**: Unit Tests, Integration Tests, Component Tests\n\n';
  
  // Add test files list
  report += '## Test Files\n\n';
  const testFiles = [
    'BulletinBoard.test.tsx - Main bulletin board component tests',
    'BulletinCard.test.tsx - Bulletin card component tests',
    'Archive.test.tsx - Archive screen component tests',
    'EditBulletinForm.test.tsx - Edit form component tests',
    'PendingBulletin.test.tsx - Pending bulletin component tests',
    'CreateBulletinForm.test.tsx - Create form component tests',
    'index.test.ts - Module export tests'
  ];
  
  testFiles.forEach(file => {
    report += `- ${file}\n`;
  });
  
  report += '\n## Coverage Report\n\n';
  if (fs.existsSync(coveragePath)) {
    report += 'Coverage reports are available in the `coverage` directory.\n';
    report += '- HTML Report: `coverage/lcov-report/index.html`\n';
    report += '- LCOV Report: `coverage/lcov.info`\n';
    report += '- JSON Report: `coverage/coverage-final.json`\n';
  } else {
    report += 'Coverage reports not available. Run tests with coverage enabled.\n';
  }
  
  report += '\n## Usage\n\n';
  report += '```bash\n';
  report += '# Run all tests\n';
  report += 'node run-tests.js\n\n';
  report += '# Run specific test\n';
  report += 'node run-tests.js --file BulletinBoard.test.tsx\n\n';
  report += '# Run with watch mode\n';
  report += 'node run-tests.js --watch\n\n';
  report += '# Run without coverage\n';
  report += 'node run-tests.js --no-coverage\n';
  report += '```\n';
  
  fs.writeFileSync(reportPath, report);
  logSuccess(`Test report generated: ${reportPath}`);
}

// Main function
function main() {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--file':
        options.specificFile = args[i + 1];
        i++;
        break;
      case '--watch':
        options.watch = true;
        break;
      case '--no-coverage':
        options.coverage = false;
        break;
      case '--update-snapshots':
        options.updateSnapshots = true;
        break;
      case '--clear-cache':
        options.clearCache = true;
        break;
      case '--help':
        showHelp();
        return;
      default:
        logWarning(`Unknown option: ${arg}`);
    }
  }
  
  logHeader('BulletinScreen Test Runner');
  
  // Check prerequisites
  if (!checkJestAvailability()) {
    logError('Jest is not available. Please install Jest first.');
    logInfo('Run: npm install --save-dev jest @testing-library/react-native');
    process.exit(1);
  }
  
  if (!checkTestFiles()) {
    logError('Some test files are missing. Please check the test directory.');
    process.exit(1);
  }
  
  // Create output directory
  createOutputDir();
  
  // Run tests
  let success = false;
  
  if (options.specificFile) {
    success = runSpecificTest(options.specificFile, options);
  } else {
    success = runTests(options);
  }
  
  // Generate report
  generateTestReport();
  
  // Exit with appropriate code
  process.exit(success ? 0 : 1);
}

// Show help
function showHelp() {
  logHeader('BulletinScreen Test Runner Help');
  
  log('Usage: node run-tests.js [options]\n', 'bright');
  
  log('Options:', 'bright');
  log('  --file <filename>     Run specific test file');
  log('  --watch              Run tests in watch mode');
  log('  --no-coverage        Disable coverage reporting');
  log('  --update-snapshots   Update test snapshots');
  log('  --clear-cache        Clear Jest cache');
  log('  --help               Show this help message\n');
  
  log('Examples:', 'bright');
  log('  node run-tests.js');
  log('  node run-tests.js --file BulletinBoard.test.tsx');
  log('  node run-tests.js --watch');
  log('  node run-tests.js --no-coverage');
  
  log('\nTest Files:', 'bright');
  log('  - BulletinBoard.test.tsx');
  log('  - BulletinCard.test.tsx');
  log('  - Archive.test.tsx');
  log('  - EditBulletinForm.test.tsx');
  log('  - PendingBulletin.test.tsx');
  log('  - CreateBulletinForm.test.tsx');
  log('  - index.test.ts');
}

// Run main function
if (require.main === module) {
  main();
}

module.exports = {
  runTests,
  runSpecificTest,
  generateTestReport,
  buildJestCommand,
  checkJestAvailability,
  checkTestFiles
};
