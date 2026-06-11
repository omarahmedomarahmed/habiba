import { io, Socket } from 'socket.io-client';
import { getBaseUrl } from '@/lib/env';

let socket: Socket | null = null;

export function getSocket(token: string): Socket {
  if (!socket) {
    const baseUrl = getBaseUrl();
    socket = io(`${baseUrl}/ws`, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
