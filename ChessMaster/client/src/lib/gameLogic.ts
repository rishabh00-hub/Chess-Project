import { ChessEngine, Move } from '@shared/chessEngine';

export interface GameState {
  id?: number;
  whitePlayerId: string;
  blackPlayerId?: string;
  currentTurn: 'white' | 'black';
  status: 'waiting' | 'active' | 'completed';
  result?: 'white_wins' | 'black_wins' | 'draw' | 'resignation';
  moves: Move[];
  engine: ChessEngine;
  startTime: Date;
  timeControl?: {
    minutes: number;
    increment: number;
  };
}

export class GameManager {
  private baseUrl = '/api';

  public async createGame(whitePlayerId: string, gameMode: string): Promise<GameState> {
    const engine = new ChessEngine();
    const matchData = {
      whitePlayerId,
      blackPlayerId: gameMode === 'ai' ? null : undefined,
      gameMode: gameMode === 'ai' ? 'ai' : 'friend',
      currentPosition: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      moves: [],
      status: gameMode === 'ai' ? 'active' : 'waiting',
    };

    const response = await fetch(`${this.baseUrl}/games`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(matchData),
    });

    if (!response.ok) {
      throw new Error('Failed to create game');
    }

    const game = await response.json();
    return {
      ...game,
      engine,
      startTime: new Date(),
    };
  }

  public async joinGame(gameId: number, playerId: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/games/${gameId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ playerId }),
    });

    return response.ok;
  }

  public async makeMove(gameId: number, playerId: string, move: Move): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/games/${gameId}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ move }),
    });

    return response.ok;
  }

  public async resignGame(gameId: number, playerId: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/games/${gameId}/resign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ playerId }),
    });

    return response.ok;
  }

  public async offerDraw(gameId: number, playerId: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/games/${gameId}/draw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ playerId }),
    });

    return response.ok;
  }

  public async getGame(gameId: number): Promise<GameState | undefined> {
    const response = await fetch(`${this.baseUrl}/games/${gameId}`, {
      credentials: 'include',
    });

    if (!response.ok) return undefined;

    const game = await response.json();
    const engine = new ChessEngine(game.currentPosition);
    return {
      ...game,
      engine,
    };
  }

  public async getPlayerGames(playerId: string): Promise<GameState[]> {
    const response = await fetch(`${this.baseUrl}/games/user/recent`, {
      credentials: 'include',
    });

    if (!response.ok) return [];

    const games = await response.json();
    return games.map((game: any) => ({
      ...game,
      engine: new ChessEngine(game.currentPosition),
    }));
  }

  public calculatePoints(result: string, playerId: string, whitePlayerId: string): number {
    if (result === 'draw') return 4;

    const playerIsWhite = playerId === whitePlayerId;
    const playerWon = (result === 'white_wins' && playerIsWhite) ||
                     (result === 'black_wins' && !playerIsWhite);

    return playerWon ? 4 : -2;
  }
}

export const gameManager = new GameManager();
