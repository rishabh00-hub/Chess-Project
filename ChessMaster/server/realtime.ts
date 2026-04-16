import type { Server as HttpServer } from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';
import type { Game } from '../shared/schema.js';

export type GameSocketMessage =
  | { type: 'subscribe'; gameId: string }
  | { type: 'unsubscribe'; gameId: string }
  | { type: 'game:update'; game: Game }
  | { type: 'connected'; gameId?: string }
  | { type: 'error'; message: string };

type GameRoomMap = Map<string, Set<WebSocket>>;

export function createRealtimeServer(httpServer: HttpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const gameRooms: GameRoomMap = new Map();

  function removeSocketFromRoom(gameId: string, socket: WebSocket) {
    const room = gameRooms.get(gameId);
    if (!room) return;

    room.delete(socket);
    if (room.size === 0) {
      gameRooms.delete(gameId);
    }
  }

  function subscribeSocket(gameId: string, socket: WebSocket) {
    const normalizedGameId = String(gameId);
    let room = gameRooms.get(normalizedGameId);

    if (!room) {
      room = new Set<WebSocket>();
      gameRooms.set(normalizedGameId, room);
    }

    room.add(socket);
  }

  function send(socket: WebSocket, message: GameSocketMessage) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  wss.on('connection', (socket) => {
    const subscribedGames = new Set<string>();

    send(socket, { type: 'connected' });

    socket.on('message', (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage.toString()) as GameSocketMessage;

        if (message.type === 'subscribe') {
          const gameId = String(message.gameId);
          subscribeSocket(gameId, socket);
          subscribedGames.add(gameId);
          send(socket, { type: 'connected', gameId });
          return;
        }

        if (message.type === 'unsubscribe') {
          const gameId = String(message.gameId);
          removeSocketFromRoom(gameId, socket);
          subscribedGames.delete(gameId);
        }
      } catch {
        send(socket, { type: 'error', message: 'Invalid websocket message' });
      }
    });

    socket.on('close', () => {
      for (const gameId of subscribedGames) {
        removeSocketFromRoom(gameId, socket);
      }
    });
  });

  function broadcastGameUpdate(game: { id?: string | number }) {
    if (!game?.id) return;

    const room = gameRooms.get(String(game.id));
    if (!room || room.size === 0) return;

    const payload = JSON.stringify({ type: 'game:update', game });
    for (const socket of room) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }
  }

  return {
    broadcastGameUpdate,
  };
}
