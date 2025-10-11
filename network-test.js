// Simple connection test to diagnose the hanging issue
const net = require('net');

console.log('🧪 Testing network connectivity to Brevo SMTP...');

const socket = new net.Socket();
socket.setTimeout(5000);

socket.on('connect', () => {
  console.log('✅ Successfully connected to smtp-relay.brevo.com:587');
  socket.destroy();
});

socket.on('timeout', () => {
  console.log('❌ Connection timeout - may be a firewall or network issue');
  socket.destroy();
});

socket.on('error', (error) => {
  console.log('❌ Connection error:', error.message);
  socket.destroy();
});

socket.on('close', () => {
  console.log('🔌 Connection closed');
  
  // Also test DNS resolution
  const dns = require('dns');
  console.log('\n🔍 Testing DNS resolution...');
  
  dns.lookup('smtp-relay.brevo.com', (err, address) => {
    if (err) {
      console.log('❌ DNS resolution failed:', err.message);
    } else {
      console.log('✅ DNS resolved smtp-relay.brevo.com to:', address);
    }
  });
});

console.log('Attempting to connect to smtp-relay.brevo.com:587...');
socket.connect(587, 'smtp-relay.brevo.com');
