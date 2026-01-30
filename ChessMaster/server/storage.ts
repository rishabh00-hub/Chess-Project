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
      level: 1, // Default level
      xp: 0, // Keep for Zoho compatibility but don't update
      gamesPlayed: (zohoData.Wins || 0) + (zohoData.Losses || 0) + (zohoData.Draws || 0),
      resignations: 0,
      currentStreak: 0,
      bestStreak: 0,
      tutorialProgress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
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
    const moveObj = { from: move.from, to: move.to, piece: '', promotion: move.promotion };
    const success = engine.makeMove(moveObj);
    if (!success) throw new Error('Invalid move');
    const newFen = engine.exportFEN();
    const newMoves = [...game.moves, { from: move.from, to: move.to, fen: newFen }];
    let status: 'active' | 'completed' | 'abandoned' | 'draw' | 'resigned' | 'timeout' = game.status as any;
    let winnerId = game.winnerId;
    let gameResult: 'white_wins' | 'black_wins' | 'draw' | undefined;
    const gameStatus = engine.getGameStatus();
    if (gameStatus === 'checkmate') {
      status = 'completed';
      winnerId = engine.getTurn() === 'white' ? game.blackPlayerId : game.whitePlayerId;
      gameResult = winnerId === game.whitePlayerId ? 'white_wins' : 'black_wins';
    } else if (gameStatus === 'draw' || gameStatus === 'stalemate') {
      status = 'draw';
      gameResult = 'draw';
    }
    const updateData = {
      FEN: newFen,
      Moves_JSON: JSON.stringify(newMoves),
      Status: status,
      Winner: winnerId
    };
    const result = await zohoApi.updateGameRecord(gameId.toString(), updateData);
    const updatedGame = this.mapZohoGameToAppGame(result.data?.[0] || result.data || result) || game;

    // Update Elo ratings if game has ended
    if (gameResult && game.gameMode !== 'ai') { // Only update for non-AI games
      try {
        await this.updateRatingsAfterGame(gameId, gameResult);
      } catch (error) {
        console.error('Failed to update ratings:', error);
        // Don't fail the move if rating update fails
      }
    }

    return updatedGame;
  }

  async resignGame(gameId: number, userId: string): Promise<Game> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found');
    const winnerId = game.whitePlayerId === userId ? game.blackPlayerId : game.whitePlayerId;
    const gameResult: 'white_wins' | 'black_wins' = winnerId === game.whitePlayerId ? 'white_wins' : 'black_wins';
    
    const updatedGame = await this.updateGame(gameId, { status: 'resigned', winnerId });
    
    // Update Elo ratings for non-AI games
    if (game.gameMode !== 'ai') {
      try {
        await this.updateRatingsAfterGame(gameId, gameResult);
      } catch (error) {
        console.error('Failed to update ratings:', error);
        // Don't fail the resignation if rating update fails
      }
    }
    
    return updatedGame;
  }

  async completeGame(gameId: number, result: string, winnerId?: string | null): Promise<Game> {
    return this.updateGame(gameId, { status: result, winnerId: winnerId || undefined });
  }

  // Elo rating system implementation
  private calculateEloChange(currentRating: number, opponentRating: number, actualScore: number): number {
    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - currentRating) / 400));
    return Math.round(32 * (actualScore - expectedScore));
  }

  async updateRatingsAfterGame(gameId: number, result: 'white_wins' | 'black_wins' | 'draw'): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found');

    const whitePlayer = await this.getUser(game.whitePlayerId);
    const blackPlayer = await this.getUser(game.blackPlayerId);

    if (!whitePlayer || !blackPlayer) throw new Error('Players not found');

    let whiteScore: number;
    let blackScore: number;

    if (result === 'white_wins') {
      whiteScore = 1;
      blackScore = 0;
    } else if (result === 'black_wins') {
      whiteScore = 0;
      blackScore = 1;
    } else { // draw
      whiteScore = 0.5;
      blackScore = 0.5;
    }

    const whiteEloChange = this.calculateEloChange(whitePlayer.elo, blackPlayer.elo, whiteScore);
    const blackEloChange = this.calculateEloChange(blackPlayer.elo, whitePlayer.elo, blackScore);

    // Update player stats and Elo
    const whiteUpdates: Partial<User> = {
      elo: Math.max(100, whitePlayer.elo + whiteEloChange), // Minimum Elo of 100
      wins: result === 'white_wins' ? whitePlayer.wins + 1 : whitePlayer.wins,
      losses: result === 'black_wins' ? whitePlayer.losses + 1 : whitePlayer.losses,
      draws: result === 'draw' ? whitePlayer.draws + 1 : whitePlayer.draws,
      gamesPlayed: whitePlayer.gamesPlayed + 1,
    };

    const blackUpdates: Partial<User> = {
      elo: Math.max(100, blackPlayer.elo + blackEloChange), // Minimum Elo of 100
      wins: result === 'black_wins' ? blackPlayer.wins + 1 : blackPlayer.wins,
      losses: result === 'white_wins' ? blackPlayer.losses + 1 : blackPlayer.losses,
      draws: result === 'draw' ? blackPlayer.draws + 1 : blackPlayer.draws,
      gamesPlayed: blackPlayer.gamesPlayed + 1,
    };

    // Update both players in Zoho
    await zohoApi.updateUserProfile(game.whitePlayerId, {
      Elo: whiteUpdates.elo,
      Wins: whiteUpdates.wins,
      Losses: whiteUpdates.losses,
      Draws: whiteUpdates.draws,
    });

    await zohoApi.updateUserProfile(game.blackPlayerId, {
      Elo: blackUpdates.elo,
      Wins: blackUpdates.wins,
      Losses: blackUpdates.losses,
      Draws: blackUpdates.draws,
    });
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
  updateRatingsAfterGame(gameId: number, result: 'white_wins' | 'black_wins' | 'draw'): Promise<void>;
  
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
