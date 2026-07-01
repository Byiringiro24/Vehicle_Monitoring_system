'use client';
import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';

export function useSocket() {
  const { accessToken } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    socketRef.current = getSocket(accessToken);
    return () => { /* keep alive across pages */ };
  }, [accessToken]);

  return socketRef.current;
}

export function useSocketEvent<T = unknown>(event: string, handler: (data: T) => void) {
  const { accessToken } = useAuthStore();

  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    socket.on(event, handler);
    return () => { socket.off(event, handler); };
  }, [event, handler, accessToken]);
}