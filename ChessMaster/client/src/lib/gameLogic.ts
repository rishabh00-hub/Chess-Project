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
  private games: Map<number, GameState> = new Map();
  private gameIdCounter = 1;

  public createGame(whitePlayerId: string, gameMode: string): GameState {
    const gameId = this.gameIdCounter++;
    const engine = new ChessEngine();
    
    const game: GameState = {
      id: gameId,
      whitePlayerId,
      blackPlayerId: gameMode === 'ai' ? 'ai' : undefined,
      currentTurn: 'white',
      status: gameMode === 'ai' ? 'active' : 'waiting',
      moves: [],
      engine,
      startTime: new Date(),
    };

    this.games.set(gameId, game);
    return game;
  }

  public joinGame(gameId: number, playerId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.blackPlayerId) return false;

    game.blackPlayerId = playerId;
    game.status = 'active';
    return true;
  }

  public makeMove(gameId: number, playerId: string, move: Move): boolean {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'active') return false;

    // Verify it's the player's turn
    const isWhiteMove = game.currentTurn === 'white';
    if ((isWhiteMove && playerId !== game.whitePlayerId) || 
        (!isWhiteMove && playerId !== game.blackPlayerId)) {
      return false;
    }

    // Validate and execute move
    if (!game.engine.isValidMove(move.from, move.to)) return false;
    
    if (game.engine.makeMove(move)) {
      game.moves.push(move);
      game.currentTurn = game.currentTurn === 'white' ? 'black' : 'white';

      // Check for game end conditions
      if (game.engine.isCheckmate()) {
        game.status = 'completed';
        game.result = isWhiteMove ? 'white_wins' : 'black_wins';
      } else if (game.engine.isStalemate()) {
        game.status = 'completed';
        game.result = 'draw';
      }

      // If playing against AI, make AI move
      if (game.blackPlayerId === 'ai' && game.currentTurn === 'black' && game.status === 'active') {
        this.makeAIMove(gameId);
      }

      return true;
    }

    return false;
  }

  private makeAIMove(gameId: number): void {
    const game = this.games.get(gameId);
    if (!game || game.currentTurn !== 'black') return;

    // Simulate AI thinking time
    setTimeout(() => {
      const aiMove = game.engine.getAIMove();
      if (aiMove) {
        game.engine.makeMove(aiMove);
        game.moves.push(aiMove);
        game.currentTurn = 'white';

        // Check for game end conditions
        if (game.engine.isCheckmate()) {
          game.status = 'completed';
          game.result = 'black_wins';
        } else if (game.engine.isStalemate()) {
          game.status = 'completed';
          game.result = 'draw';
        }
      }
    }, 500 + Math.random() * 2000); // Random delay between 0.5-2.5 seconds
  }

  public resignGame(gameId: number, playerId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'active') return false;

    game.status = 'completed';
    if (playerId === game.whitePlayerId) {
      game.result = 'black_wins';
    } else if (playerId === game.blackPlayerId) {
      game.result = 'white_wins';
    } else {
      return false;
    }

    return true;
  }

  public offerDraw(gameId: number, playerId: string): boolean {
    // Simplified draw offer - in a real implementation, this would require acceptance
    const game = this.games.get(gameId);
    if (!game || game.status !== 'active') return false;

    game.status = 'completed';
    game.result = 'draw';
    return true;
  }

  public getGame(gameId: number): GameState | undefined {
    return this.games.get(gameId);
  }

  public getPlayerGames(playerId: string): GameState[] {
    return Array.from(this.games.values()).filter(
      game => game.whitePlayerId === playerId || game.blackPlayerId === playerId
    );
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
