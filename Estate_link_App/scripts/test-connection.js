#!/usr/bin/env node

const http = require('http');

const testUrls = [
  'http://192.168.0.113:8000',
  'http://localhost:8000',
  'http://127.0.0.1:8000'
];

async function testConnection(url) {
  return new Promise((resolve) => {
    const req = http.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
      console.log(`✅ ${url} - Status: ${res.statusCode}`);
      resolve({ success: true, status: res.statusCode });
    });

    req.on('error', (err) => {
      console.log(`❌ ${url} - Error: ${err.message}`);
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      console.log(`⏰ ${url} - Timeout`);
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });

    req.end();
  });
}

async function runTests() {
  console.log('🔍 Testing backend connections...\n');
  
  for (const url of testUrls) {
    await testConnection(url);
  }
  
  console.log('\n📱 For React Native app, use: http://192.168.0.113:8000');
  console.log('💻 For local development, use: http://localhost:8000');
}

runTests().catch(console.error);
