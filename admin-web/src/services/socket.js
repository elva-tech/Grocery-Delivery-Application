import { io } from 'socket.io-client';

/**
 * Socket server URL — defaults to REST API origin when VITE_SOCKET_URL is unset.
 */
export function getSocketUrl() {
  const raw = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || '';
  return String(raw).trim().replace(/\/+$/, '');
}

/**
 * Create a Socket.IO client configured for admin JWT auth and tenant scoping.
 */
export function createSocketConnection({ token, tenantId }) {
  const url = getSocketUrl();
  if (!url || !token || !tenantId) {
    throw new Error('Socket connection requires url, token, and tenantId');
  }

  return io(url, {
    auth: { token },
    query: { tenantId },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    autoConnect: true,
  });
}

/**
 * Fully tear down a socket instance (removes listeners to prevent leaks).
 */
export function destroySocket(socket) {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
}
