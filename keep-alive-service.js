// Keep-alive service to prevent server from sleeping
const https = require('https');
const http = require('http');

// Your deployed server URL
const SERVER_URL = 'https://your-app-name.onrender.com'; // Replace with your actual URL

function pingServer() {
  const url = new URL(SERVER_URL + '/api/health');
  const client = url.protocol === 'https:' ? https : http;
  
  const req = client.get(url, (res) => {
    console.log(`Ping sent at ${new Date().toISOString()}: ${res.statusCode}`);
  });
  
  req.on('error', (err) => {
    console.error(`Ping failed at ${new Date().toISOString()}:`, err.message);
  });
  
  req.setTimeout(10000, () => {
    req.destroy();
    console.log('Ping request timed out');
  });
}

// Ping every 14 minutes (just under the 15-minute sleep threshold)
const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes in milliseconds

console.log('Keep-alive service started');
console.log(`Pinging ${SERVER_URL}/api/health every 14 minutes`);

// Initial ping
pingServer();

// Set up interval
setInterval(pingServer, PING_INTERVAL);

// Keep the process running
process.on('SIGINT', () => {
  console.log('\nKeep-alive service stopped');
  process.exit(0);
});