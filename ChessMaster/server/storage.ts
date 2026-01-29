import zohoApi from './zoho-api-service.js';
import { ChessEngine } from '../shared/chessEngine.js';
import {
  type User,
  type UpsertUser,
  type Game,
  type InsertGame,
  type TutorialLesson,
  type UserLessonProgress,
} from "../shared/schema.js";

class Storage implements IStorage {
  // Helper to map Zoho game data to app Game object
  private mapZohoGameToAppGame(zohoData: any): Game {
    return {
      id: zohoData.ID,
      whitePlayerId: zohoData.White_Player,
      blackPlayerId: zohoData.Black_Player,
      gameMode: zohoData.Game_Mode,
      status: zohoData.Status.toLowerCase(),
      moves: JSON.parse(zohoData.Moves_JSON || '[]'),
      currentPosition: zohoData.FEN,
      winnerId: zohoData.Winner,
      createdAt: new Date(zohoData.Date_Created),
    };
  }

  // Helper to map Zoho user data to app User object
  private mapZohoUserToAppUser(zohoData: any): User {
    return {
      id: zohoData.ID,
      username: zohoData.Username,
      email: zohoData.Email,
      elo: zohoData.Elo,
      wins: zohoData.Wins,
      losses: zohoData.Losses,
      draws: zohoData.Draws,
      totalPoints: zohoData.Total_Points,
    };
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    try {
      const data = await zohoApi.getUserProfile(id);
      return this.mapZohoUserToAppUser(data);
    } catch {
      return undefined;
    }
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    const existing = await this.getUser(user.id);
    if (existing) {
      await zohoApi.updateUserProfile(user.id, user);
      return { ...existing, ...user };
    } else {
      await zohoApi.createUserProfile(user);
      return { id: user.id, ...user } as User;
    }
  }

  // Game operations
  async createGame(game: InsertGame): Promise<Game> {
    const result = await zohoApi.createGameRecord(game);
    // Handle both direct data and wrapped response
    const gameData = result.data?.[0] || result.data || result;
    return this.mapZohoGameToAppGame(gameData);
  }

  async getGame(id: number): Promise<Game | undefined> {
    try {
      const data = await zohoApi.getGame(id.toString());
      if (!data) return undefined;
      return this.mapZohoGameToAppGame(data);
    } catch {
      return undefined;
    }
  }

  async updateGame(id: number, updates: Partial<Game>): Promise<Game> {
    const game = await this.getGame(id);
    if (!game) throw new Error('Game not found');
    const zohoUpdates: any = {};
    if (updates.moves) zohoUpdates.Moves_JSON = JSON.stringify(updates.moves);
    if (updates.currentPosition) zohoUpdates.FEN = updates.currentPosition;
    if (updates.status) zohoUpdates.Status = updates.status;
    if (updates.winnerId) zohoUpdates.Winner = updates.winnerId;
    const result = await zohoApi.updateGameRecord(id.toString(), zohoUpdates);
    // Handle both direct data and wrapped response
    const gameData = result.data?.[0] || result.data || result;
    return this.mapZohoGameToAppGame(gameData || game);
  }

  async getUserGames(userId: string, limit?: number): Promise<Game[]> {
    return this.getRecentGames(userId, limit);
  }

  async getRecentGames(userId: string, limit?: number): Promise<Game[]> {
    const data = await zohoApi.getRecentGames(userId);
    return data.map(this.mapZohoGameToAppGame.bind(this)).slice(0, limit || 10);
  }

  async makeMove(gameId: number, move: { from: string; to: string; promotion?: string }): Promise<Game> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found');
    const engine = new ChessEngine(game.currentPosition);
    const success = engine.move(move.from, move.to, move.promotion);
    if (!success) throw new Error('Invalid move');
    const newFen = engine.fen();
    const newMoves = [...game.moves, { from: move.from, to: move.to, fen: newFen }];
    let status = game.status;
    let winnerId = game.winnerId;
    if (engine.isGameOver()) {
      if (engine.isCheckmate()) {
        status = 'completed';
        winnerId = engine.turn() === 'w' ? game.blackPlayerId : game.whitePlayerId;
      } else if (engine.isDraw()) {
        status = 'draw';
      }
    }
    const updateData = {
      FEN: newFen,
      Moves_JSON: JSON.stringify(newMoves),
      Status: status,
      Winner: winnerId
    };
    const result = await zohoApi.updateGameRecord(gameId.toString(), updateData);
    const gameData = result.data?.[0] || result.data || result;
    return this.mapZohoGameToAppGame(gameData || game);
  }

  async resignGame(gameId: number, userId: string): Promise<Game> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found');
    const winnerId = game.whitePlayerId === userId ? game.blackPlayerId : game.whitePlayerId;
    return this.updateGame(gameId, { status: 'resigned', winnerId });
  }

  async completeGame(gameId: number, result: string, winnerId?: string | null): Promise<Game> {
    return this.updateGame(gameId, { status: result, winnerId: winnerId || undefined });
  }

  // Leaderboard operations
  async getLeaderboard(limit?: number): Promise<User[]> {
    const data = await zohoApi.getLeaderboard();
    return data.map(this.mapZohoUserToAppUser.bind(this)).slice(0, limit || 50);
  }

  async getUserRank(userId: string): Promise<number> {
    const leaderboard = await this.getLeaderboard();
    const index = leaderboard.findIndex(u => u.id === userId);
    return index >= 0 ? index + 1 : 0;
  }

  // Tutorial operations (hardcoded)
  private tutorialLessons: TutorialLesson[] = [
    { id: 1, title: 'Basic Moves', description: 'Learn how pieces move', content: 'Pawn moves forward, etc.' },
    { id: 2, title: 'Check and Checkmate', description: 'Understanding check and checkmate', content: '...' },
  ];

  async getTutorialLessons(): Promise<TutorialLesson[]> {
    return this.tutorialLessons;
  }

  async getTutorialLesson(id: number): Promise<TutorialLesson | undefined> {
    return this.tutorialLessons.find(l => l.id === id);
  }

  private lessonProgress: UserLessonProgress[] = [];

  async getLessonProgress(userId: string, lessonId: number): Promise<UserLessonProgress | undefined> {
    return this.lessonProgress.find(p => p.userId === userId && p.lessonId === lessonId);
  }

  async updateLessonProgress(progress: UserLessonProgress): Promise<UserLessonProgress> {
    const index = this.lessonProgress.findIndex(p => p.userId === progress.userId && p.lessonId === progress.lessonId);
    if (index >= 0) {
      this.lessonProgress[index] = progress;
    } else {
      this.lessonProgress.push(progress);
    }
    return progress;
  }
}

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Game operations
  createGame(game: InsertGame): Promise<Game>;
  getGame(id: number): Promise<Game | undefined>;
  updateGame(id: number, updates: Partial<Game>): Promise<Game>;
  getUserGames(userId: string, limit?: number): Promise<Game[]>;
  getRecentGames(userId: string, limit?: number): Promise<Game[]>;
  makeMove(gameId: number, move: { from: string; to: string; promotion?: string }): Promise<Game>;
  resignGame(gameId: number, userId: string): Promise<Game>;
  completeGame(gameId: number, result: string, winnerId?: string | null): Promise<Game>;
  
  // Leaderboard operations
  getLeaderboard(limit?: number): Promise<User[]>;
  getUserRank(userId: string): Promise<number>;
  
  // Tutorial operations
  getTutorialLessons(): Promise<TutorialLesson[]>;
  getTutorialLesson(id: number): Promise<TutorialLesson | undefined>;
  getLessonProgress(userId: string, lessonId: number): Promise<UserLessonProgress | undefined>;
  updateLessonProgress(progress: UserLessonProgress): Promise<UserLessonProgress>;
}

export const storage = new Storage();
