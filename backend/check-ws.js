const { io } = require('socket.io-client');
const token = 'YOUR_JWT_TOKEN_HERE';

const socket = io('http://localhost:8080', {
  auth: { token }
});

socket.on('connect', () => {
  console.log('✅ WebSocket Connected successfully! Socket ID:', socket.id);

  // Test a ping event or room join
  socket.emit('ping', {}, (response) => {
    console.log('📦 Ping response received:', response);
    socket.disconnect();
    process.exit(0);
  });
});

socket.on('connect_error', (err) => {
  console.error('❌ WebSocket Connection Error:', err.message);
  process.exit(1);
});
