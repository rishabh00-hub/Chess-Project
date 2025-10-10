import { ChessEngine, Move } from '@shared/chessEngine';
import zohoApi from '../../../server/zoho-api-service';

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
  // All game state is now managed via Zoho Creator API

  public createGame(whitePlayerId: string, gameMode: string): GameState {
    const engine = new ChessEngine();
    const matchData = {
      whitePlayerId,
      blackPlayerId: gameMode === 'ai' ? 'ai' : undefined,
      currentTurn: 'white' as 'white',
      status: (gameMode === 'ai' ? 'active' : 'waiting') as 'active' | 'waiting',
      moves: [],
      startTime: new Date(),
    };
    zohoApi.saveMatchRecord(matchData);
    return {
      ...matchData,
      engine,
    };
  }

  public joinGame(gameId: number, playerId: string): boolean {
  // TODO: Implement Zoho API call to join game
  return true;
  }

  public makeMove(gameId: number, playerId: string, move: Move): boolean {
    // TODO: Implement Zoho API call to make move
    return true;
  }

  private makeAIMove(gameId: number): void {
    // TODO: Implement Zoho API call for AI move
  }

  public resignGame(gameId: number, playerId: string): boolean {
    // TODO: Implement Zoho API call to resign game
    return true;
  }

  public offerDraw(gameId: number, playerId: string): boolean {
  // TODO: Implement Zoho API call to offer draw
  return true;
  }

  public getGame(gameId: number): GameState | undefined {
  // TODO: Implement Zoho API call to get game by ID
  return undefined;
  }

  public getPlayerGames(playerId: string): GameState[] {
    // Use Zoho API to fetch player games (placeholder)
    // TODO: Implement Zoho API call to fetch games for playerId
    return [];
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
