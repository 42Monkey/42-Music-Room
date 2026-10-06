const { io } = require('socket.io-client');

const TOKEN = process.argv[2];
const ROOM_ID = process.argv[3];

if (!TOKEN || !ROOM_ID) {
  console.error('Usage: node ws-test.js <access-token> <room-id>');
  process.exit(1);
}

const socket = io('http://localhost:8080', { auth: { token: TOKEN } });

socket.on('connect', () => {
  console.log('✓ Connected, socket id:', socket.id);

  socket.emit('joinRoom', { roomId: ROOM_ID }, (res) => {
    console.log('→ joinRoom response:', res);
  });
});

socket.on('tracks:updated', (tracks) => {
  console.log('🔴 LIVE tracks:updated event received:');
  console.log(JSON.stringify(tracks, null, 2));
});

socket.on('connect_error', (err) => {
  console.error('✗ Connection error:', err.message);
});
