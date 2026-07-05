import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { getTenantId } from '../utils/getTenantId';
import { createSocketConnection, destroySocket } from '../services/socket';

const SocketContext = createContext(null);

/**
 * Manages a single Socket.IO connection per admin session.
 * - Connects after login with JWT
 * - Disconnects on logout
 * - Auto-reconnects on network loss
 * - Notifies subscribers when a reconnect succeeds (for REST resync)
 */
export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const hasConnectedOnceRef = useRef(false);
  const reconnectListenersRef = useRef(new Set());
  /** Registry survives socket (re)creation — fixes child effects running before parent effect */
  const listenersRef = useRef(new Map());

  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  const attachAllListeners = useCallback((socket) => {
    if (!socket) return;
    listenersRef.current.forEach((handlers, event) => {
      handlers.forEach((handler) => {
        socket.off(event, handler);
        socket.on(event, handler);
      });
    });
  }, []);

  const disconnect = useCallback(() => {
    destroySocket(socketRef.current);
    socketRef.current = null;
    hasConnectedOnceRef.current = false;
    setIsConnected(false);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('jwtToken');
    const isAdmin = user?.role === 'ADMIN';

    if (!user || !isAdmin || !token) {
      disconnect();
      return undefined;
    }

    const tenantId = String(user.tenantId || getTenantId() || '').trim();
    if (!tenantId) {
      setConnectionError('Missing tenantId for socket connection');
      return undefined;
    }

    let socket;
    try {
      socket = createSocketConnection({ token, tenantId });
    } catch (err) {
      setConnectionError(err.message || 'Failed to initialize socket');
      return undefined;
    }

    socketRef.current = socket;
    // Attach any handlers registered by child components before this effect ran
    attachAllListeners(socket);

    const handleConnect = () => {
      setConnectionError(null);
      setIsConnected(true);
      // Re-bind after reconnect in case the engine cleared listeners
      attachAllListeners(socket);

      if (hasConnectedOnceRef.current) {
        reconnectListenersRef.current.forEach((cb) => {
          try {
            cb();
          } catch (cbErr) {
            console.error('[Socket] reconnect callback failed:', cbErr);
          }
        });
      } else {
        hasConnectedOnceRef.current = true;
        window.dispatchEvent(new CustomEvent('admin-socket-connected'));
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleConnectError = (err) => {
      const message = err?.message || 'Socket connection failed';
      setConnectionError(message);
      console.warn('[Socket] connect_error:', message);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    // Already connected (fast local server)
    if (socket.connected) {
      handleConnect();
    }

    const handleAuthChanged = () => {
      const freshToken = localStorage.getItem('jwtToken');
      if (!freshToken) {
        disconnect();
        return;
      }
      socket.auth = { token: freshToken };
      if (!socket.connected) {
        socket.connect();
      }
    };

    window.addEventListener('admin-auth-changed', handleAuthChanged);

    return () => {
      window.removeEventListener('admin-auth-changed', handleAuthChanged);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      disconnect();
    };
  }, [user, disconnect, attachAllListeners]);

  /**
   * Subscribe to a socket event. Handlers are stored in a registry so they
   * still work when child useEffects run before the socket is created.
   */
  const subscribe = useCallback((event, handler) => {
    if (!event || typeof handler !== 'function') {
      return () => {};
    }

    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    const handlers = listenersRef.current.get(event);
    handlers.add(handler);

    const socket = socketRef.current;
    if (socket) {
      socket.off(event, handler);
      socket.on(event, handler);
    }

    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        listenersRef.current.delete(event);
      }
      socketRef.current?.off(event, handler);
    };
  }, []);

  const onReconnect = useCallback((callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }
    reconnectListenersRef.current.add(callback);
    return () => {
      reconnectListenersRef.current.delete(callback);
    };
  }, []);

  const value = {
    isConnected,
    connectionError,
    subscribe,
    onReconnect,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
}
