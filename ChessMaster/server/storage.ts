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

// Type for Zoho API responses
interface ZohoApiResponse {
  data?: any[];
  [key: string]: any;
}

class Storage implements IStorage {
  private extractZohoId(value: any): string {
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
    if (Array.isArray(value)) {
      const first = value[0];
      return this.extractZohoId(first);
    }
    if (value && typeof value === 'object') {
      return String(value.ID || value.id || value.zuid || value.zc_display_value || value.username || '');
    }
    return '';
  }

  // Helper to map app status to Zoho dropdown
  private mapAppStatusToZoho(status: string): string {
    const map: { [key: string]: string } = {
      'active': 'Ongoing',
      'completed': 'Completed',
      'draw': 'Draw',
      'abandoned': 'Completed',
      'resigned': 'Completed',
      'timeout': 'Completed',
      'ai_thinking': 'Ongoing'
    };
    return map[status] || 'Ongoing';
  }

  // Helper to map app result to Zoho dropdown
  private mapAppResultToZoho(result?: string): string {
    if (!result) return 'Ongoing';
    const map: { [key: string]: string } = {
      'white_wins': 'Win',
      'black_wins': 'Win',
      'draw': 'Draw'
    };
    return map[result] || 'Ongoing';
  }
  // Helper to map Zoho game data to app Game object
  private mapZohoGameToAppGame(zohoResponse: any): Game {
    // 1. Extract the first record from Zoho response array if needed
    const record = (zohoResponse.data && zohoResponse.data.length > 0) 
      ? zohoResponse.data[0] 
      : zohoResponse;

    console.log("EXTRACTED GAME RECORD:", record); 

    // 2. Parse aiDifficulty with fallback
    const rawAiDifficulty = record.aiDifficulty ?? record.ai_difficulty ?? record.AI_Difficulty;
    const aiDifficulty = typeof rawAiDifficulty === 'number'
      ? rawAiDifficulty
      : typeof rawAiDifficulty === 'string'
        ? parseInt(rawAiDifficulty, 10)
        : 1200;

    // 3. Parse moves from moves_played (comma or semicolon separated string)
    let moves: Array<{ notation: string; timestamp: Date; fen: string }> = [];
    if (record.moves_played) {
      try {
        moves = JSON.parse(record.moves_played);
      } catch {
        // If not JSON, treat as empty or comma-separated
        moves = [];
      }
    }

    // 4. Calculate currentTurn from FEN
    const fen = record.current_fen1 || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const fenParts = fen.split(' ');
    const currentTurn: 'white' | 'black' = fenParts[1] === 'w' ? 'white' : 'black';

    // 5. Map status from Zoho dropdown
    const statusMap: { [key: string]: 'active' | 'completed' | 'draw' | 'abandoned' | 'resigned' | 'timeout' | 'ai_thinking' } = {
      'Active': record.ai_thinking ? 'ai_thinking' : 'active',
      'Completed': 'completed',
      'Draw': 'draw'
    };
    const status = statusMap[record.game_status1] || 'active';

    // 6. Map result based on match_result and winner
    let result: 'white_wins' | 'black_wins' | 'draw' | undefined;
    const whitePlayerId = this.extractZohoId(record.white_player);
    const blackPlayerId = this.extractZohoId(record.black_player);
    const winnerId = this.extractZohoId(record.winner1);

    if (record.match_result === 'Draw') {
      result = 'draw';
    } else if (winnerId) {
      result = winnerId === whitePlayerId ? 'white_wins' : 'black_wins';
    }

    // 4. Return properly mapped Game object
    return {
      id: record.ID,
      whitePlayerId,
      blackPlayerId,
      gameMode: String(record.gameMode || record.game_mode || 'ai') as 'ai' | 'friend' | 'online',
      status,
      result,
      currentTurn,
      currentPosition: record.current_fen1 || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      moves,
      moveHistory: record.moves_played || '',
      halfMoveClock: 0,
      fullMoveNumber: 1,
      winnerId: winnerId || undefined,
      aiDifficulty,
      pointsAwarded: 0,
      createdAt: record.match_date ? new Date(record.match_date) : new Date(),
    };
  }

  // Helper to map Zoho user data to app User object
  private mapZohoUserToAppUser(zohoData: any): User {
    // Map Zoho Creator field names (exact) to app User type
    return {
      id: zohoData.ID || zohoData.id,
      username: zohoData.username || '',
      email: zohoData.email || '',
      firstName: zohoData.full_name?.first_name || '',
      lastName: zohoData.full_name?.last_name || '',
      elo: zohoData.chess_rating ?? 1200,
      wins: zohoData.total_wins ?? 0,
      losses: zohoData.total_losses ?? 0,
      draws: zohoData.total_draws ?? 0,
      totalPoints: (zohoData.total_wins ?? 0) * 3 + (zohoData.total_draws ?? 0), // Win = 3 points, Draw = 1 point
      level: 1, // Default level (not in Zoho schema)
      xp: 0, // Keep for backward compatibility but not updated in Zoho
      gamesPlayed: zohoData.total_games_played ?? 0,
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
      if (!id) {
        console.warn('getUser called with empty id');
        return undefined;
      }
      const data = await zohoApi.getUserProfile(id);
      if (!data) {
        console.warn(`User not found in Zoho: ${id}`);
        return undefined;
      }
      return this.mapZohoUserToAppUser(data);
    } catch (error) {
      console.error(`CRITICAL: Failed to fetch user ${id} from Zoho:`, error);
      return undefined;
    }
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    // Attempt to look up by the provided id (which may or may not be a Zoho ID).
    const existing = await this.getUser(user.id);
    if (existing) {
      // If record already exists in Zoho we simply patch it and return a merged object.
      await zohoApi.updateUserProfile(user.id, user);
      return { ...existing, ...user };
    } else {
      // Create a new user in Zoho and validate that the API actually returned an ID.
      const result = await zohoApi.createUserProfile(user) as ZohoApiResponse;
      const zohoId = result?.data?.[0]?.ID || result?.data?.[0]?.id;
      if (!zohoId) {
        console.error('ZOHO DB INSERT ERROR (no ID in response):', result);
        throw new Error('Failed to save user to Zoho DB');
      }
      // Fetch the freshly created record to ensure we have all fields mapped correctly.
      const created = await this.getUser(zohoId);
      if (!created) {
        console.error('ZOHO DB INSERT ERROR (could not retrieve created user):', result);
        throw new Error('Zoho returned ID but record could not be fetched');
      }
      return created;
    }
  }

  // Game operations
  async createGame(game: InsertGame): Promise<Game> {
    const result = await zohoApi.createGameRecord(game) as ZohoApiResponse;
    const createdId =
      (result as any)?.data?.ID ||
      (result as any)?.data?.id ||
      (result as any)?.data?.[0]?.ID ||
      (result as any)?.data?.[0]?.id;
    if (!createdId) {
      console.error('ZOHO GAME INSERT ERROR (no ID in response):', result);
      throw new Error('Failed to create game in Zoho DB');
    }

    const created = await this.getGame(String(createdId));
    if (!created) {
      console.error('ZOHO GAME INSERT ERROR (created game could not be fetched):', result);
      throw new Error('Game was created but could not be retrieved');
    }

    return created;
  }

  async getGame(id: string): Promise<Game | undefined> {
    try {
      if (!id) {
        console.warn(`getGame called with invalid id: ${id}`);
        return undefined;
      }
      const data = await zohoApi.getGame(String(id));
      if (!data) {
        console.warn(`Game not found in Zoho: ${id}`);
        return undefined;
      }
      return this.mapZohoGameToAppGame(data);
    } catch (error) {
      console.error(`CRITICAL: Failed to fetch game ${id} from Zoho:`, error);
      return undefined;
    }
  }

  async updateGame(id: string, updates: Partial<Game>): Promise<Game> {
    const game = await this.getGame(id);
    if (!game) throw new Error('Game not found');
    const zohoUpdates: any = {};
    if (updates.moves) zohoUpdates.moves_played = JSON.stringify(updates.moves);
    if (updates.currentPosition) zohoUpdates.current_fen1 = updates.currentPosition;
    if (updates.status) {
      zohoUpdates.game_status1 = this.mapAppStatusToZoho(updates.status);
      zohoUpdates.ai_thinking = updates.status === 'ai_thinking';
      if (updates.status === 'draw') {
        zohoUpdates.match_result = 'Draw';
      } else if (updates.winnerId) {
        zohoUpdates.match_result = 'Win';
      } else {
        zohoUpdates.match_result = 'Ongoing';
      }
    }
    if (updates.winnerId) zohoUpdates.winner1 = updates.winnerId;
    const result = await zohoApi.updateGameRecord(String(id), zohoUpdates) as ZohoApiResponse;
    // Handle both direct data and wrapped response
    const gameData = (result as any).data?.[0] || (result as any).data || result;
    return this.mapZohoGameToAppGame(gameData || game);
  }

  async getUserGames(userId: string, limit?: number): Promise<Game[]> {
    return this.getRecentGames(userId, limit);
  }

  async getRecentGames(userId: string, limit?: number): Promise<Game[]> {
    const data = await zohoApi.getRecentGames(userId);
    return data.map(this.mapZohoGameToAppGame.bind(this)).slice(0, limit || 10);
  }

  async makeMove(gameId: string, move: { from: string; to: string; promotion?: string }): Promise<Game> {
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
      current_fen1: newFen,
      moves_played: JSON.stringify(newMoves),
      game_status1: this.mapAppStatusToZoho(status),
      match_result: gameResult === 'draw' ? 'Draw' : gameResult ? 'Win' : 'Ongoing',
      winner1: winnerId
    };
    const result = await zohoApi.updateGameRecord(String(gameId), updateData) as ZohoApiResponse;
    const updatedGame = this.mapZohoGameToAppGame((result as any).data?.[0] || (result as any).data || result) || game;

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

  async resignGame(gameId: string, userId: string): Promise<Game> {
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

  async completeGame(gameId: string, result: string, winnerId?: string | null): Promise<Game> {
    const statusMap: { [key: string]: 'active' | 'completed' | 'abandoned' | 'draw' | 'resigned' | 'timeout' | 'ai_thinking' } = {
      'completed': 'completed',
      'abandoned': 'abandoned',
      'draw': 'draw',
      'resigned': 'resigned',
      'timeout': 'timeout'
    };
    const status = statusMap[result] || 'completed';
    return this.updateGame(gameId, { status, winnerId: winnerId || undefined });
  }

  // Elo rating system implementation
  private calculateEloChange(currentRating: number, opponentRating: number, actualScore: number): number {
    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - currentRating) / 400));
    return Math.round(32 * (actualScore - expectedScore));
  }

  async updateRatingsAfterGame(gameId: string, result: 'white_wins' | 'black_wins' | 'draw'): Promise<void> {
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

    // Update both players in Zoho using exact field names
    await zohoApi.updateUserProfile(game.whitePlayerId, {
      chess_rating: whiteUpdates.elo,
      total_wins: whiteUpdates.wins,
      total_losses: whiteUpdates.losses,
      total_draws: whiteUpdates.draws,
      total_games_played: whiteUpdates.gamesPlayed,
    });

    await zohoApi.updateUserProfile(game.blackPlayerId, {
      chess_rating: blackUpdates.elo,
      total_wins: blackUpdates.wins,
      total_losses: blackUpdates.losses,
      total_draws: blackUpdates.draws,
      total_games_played: blackUpdates.gamesPlayed,
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
    { 
      id: 1, 
      title: 'Basic Moves', 
      description: 'Learn how pieces move', 
      category: 'rules' as const,
      difficulty: 1,
      content: 'Pawn moves forward, etc.',
      orderIndex: 1,
      isActive: true,
      createdAt: new Date()
    },
    { 
      id: 2, 
      title: 'Check and Checkmate', 
      description: 'Understanding check and checkmate', 
      category: 'rules' as const,
      difficulty: 1,
      content: '...',
      orderIndex: 2,
      isActive: true,
      createdAt: new Date()
    },
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
  getGame(id: string): Promise<Game | undefined>;
  updateGame(id: string, updates: Partial<Game>): Promise<Game>;
  getUserGames(userId: string, limit?: number): Promise<Game[]>;
  getRecentGames(userId: string, limit?: number): Promise<Game[]>;
  makeMove(gameId: string, move: { from: string; to: string; promotion?: string }): Promise<Game>;
  resignGame(gameId: string, userId: string): Promise<Game>;
  completeGame(gameId: string, result: string, winnerId?: string | null): Promise<Game>;
  updateRatingsAfterGame(gameId: string, result: 'white_wins' | 'black_wins' | 'draw'): Promise<void>;
  
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
