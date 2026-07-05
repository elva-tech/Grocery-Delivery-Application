import { useEffect } from 'react';
import { useSocketContext } from '../context/SocketContext';

/** Convenience hook for the shared Socket.IO context. */
export function useSocket() {
  return useSocketContext();
}

/**
 * Subscribe to a socket event with automatic cleanup on unmount or dependency change.
 */
export function useSocketEvent(event, handler, deps = []) {
  const { subscribe } = useSocket();

  useEffect(() => {
    if (!event || typeof handler !== 'function') {
      return undefined;
    }
    return subscribe(event, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, event, ...deps]);
}
