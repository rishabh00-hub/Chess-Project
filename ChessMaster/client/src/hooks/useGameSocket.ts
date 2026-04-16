import { useEffect, useRef } from 'react';
import type { Game } from '@shared/schema';

type GameUpdateHandler = (game: Game) => void;

function getWebSocketUrl() {
  const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
  const wsBase = apiUrl.startsWith('https://')
    ? apiUrl.replace('https://', 'wss://')
    : apiUrl.startsWith('http://')
      ? apiUrl.replace('http://', 'ws://')
      : apiUrl;

  return new URL('/ws', wsBase).toString();
}

export function useGameSocket(gameId: number | null, onGameUpdate: GameUpdateHandler) {
  const socketRef = useRef<WebSocket | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const onGameUpdateRef = useRef(onGameUpdate);

  useEffect(() => {
    onGameUpdateRef.current = onGameUpdate;
  }, [onGameUpdate]);

  useEffect(() => {
    if (!gameId) return;

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      const socket = new WebSocket(getWebSocketUrl());
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        socket.send(JSON.stringify({ type: 'subscribe', gameId: String(gameId) }));
      });

      socket.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data as string);
          if (data?.type === 'game:update' && data.game && String(data.game.id) === String(gameId)) {
            onGameUpdateRef.current(data.game);
          }
        } catch {
          // Ignore malformed socket payloads.
        }
      });

      socket.addEventListener('close', () => {
        if (cancelled) return;
        retryTimerRef.current = window.setTimeout(connect, 1500);
      });

      socket.addEventListener('error', () => {
        socket.close();
      });
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [gameId]);
}
