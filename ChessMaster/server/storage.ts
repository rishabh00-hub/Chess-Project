import {
  users,
  games,
  tutorialLessons,
  userLessonProgress,
  type User,
  type UpsertUser,
  type Game,
  type InsertGame,
  type TutorialLesson,
  type UserLessonProgress,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
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
  getUserLessonProgress(userId: string): Promise<UserLessonProgress[]>;
  updateLessonProgress(userId: string, lessonId: number, completed: boolean, score?: number): Promise<UserLessonProgress>;
  
  // Statistics operations
  updateUserStats(userId: string, gameResult: 'win' | 'loss' | 'draw' | 'resignation', pointsChange: number): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Game operations
  async createGame(game: InsertGame): Promise<Game> {
    const [newGame] = await db.insert(games).values(game).returning();
    return newGame;
  }

  async getGame(id: number): Promise<Game | undefined> {
    const [game] = await db.select().from(games).where(eq(games.id, id));
    return game;
  }

  async updateGame(id: number, updates: Partial<Game>): Promise<Game> {
    const [updatedGame] = await db
      .update(games)
      .set(updates)
      .where(eq(games.id, id))
      .returning();
    return updatedGame;
  }

  async getUserGames(userId: string, limit = 50): Promise<Game[]> {
    return await db
      .select()
      .from(games)
      .where(sql`${games.whitePlayerId} = ${userId} OR ${games.blackPlayerId} = ${userId}`)
      .orderBy(desc(games.createdAt))
      .limit(limit);
  }

  async getRecentGames(userId: string, limit = 5): Promise<Game[]> {
    return await db
      .select()
      .from(games)
      .where(sql`${games.whitePlayerId} = ${userId} OR ${games.blackPlayerId} = ${userId}`)
      .orderBy(desc(games.completedAt))
      .limit(limit);
  }

  async makeMove(gameId: number, move: { from: string; to: string; promotion?: string }): Promise<Game> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found');
    if (game.status !== 'active') throw new Error('Game is not active');

    const { ChessEngine } = await import('../shared/chessEngine.js');
    const engine = new ChessEngine(game.currentPosition || undefined);

    if (!engine.isValidMove(move.from, move.to)) {
      throw new Error('Invalid move');
    }

    const moveObj = {
      from: move.from,
      to: move.to,
      piece: engine.getPieceAt(move.from)!,
      promotion: move.promotion
    };

    if (!engine.makeMove(moveObj)) {
      throw new Error('Move failed');
    }

    const newPosition = engine.exportFEN();
    const newTurn = engine.getTurn();
    const gameStatus = engine.getGameStatus();

    const currentMoves = (game.moves as any[]) || [];
    const newMoves = [
      ...currentMoves,
      {
        ...moveObj,
        notation: `${move.from}${move.to}`,
        timestamp: new Date().toISOString(),
        fen: newPosition
      }
    ];

    const moveHistory = (game.moveHistory || '') + ' ' + `${move.from}${move.to}`;

    const updates: Partial<Game> = {
      currentPosition: newPosition,
      currentTurn: newTurn,
      moves: newMoves as any,
      moveHistory: moveHistory.trim(),
      lastMoveAt: new Date(),
      halfMoveClock: engine.getPosition().halfmove,
      fullMoveNumber: engine.getPosition().fullmove
    };

    const updatedGame = await this.updateGame(gameId, updates);

    if (gameStatus === 'checkmate' || gameStatus === 'stalemate' || gameStatus === 'draw') {
      let result: string;
      let winnerId: string | null = null;

      if (gameStatus === 'checkmate') {
        const loser = newTurn;
        winnerId = loser === 'white' ? game.blackPlayerId : game.whitePlayerId;
        result = loser === 'white' ? 'black_wins' : 'white_wins';
      } else {
        result = 'draw';
      }

      return await this.completeGame(gameId, result, winnerId);
    }

    return updatedGame;
  }

  async resignGame(gameId: number, userId: string): Promise<Game> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found');
    if (game.status !== 'active') throw new Error('Game is not active');

    let winnerId: string | null;
    let result: string;

    if (userId === game.whitePlayerId) {
      winnerId = game.blackPlayerId;
      result = 'black_wins';
    } else if (userId === game.blackPlayerId) {
      winnerId = game.whitePlayerId;
      result = 'white_wins';
    } else {
      throw new Error('User is not a player in this game');
    }

    return this.completeGame(gameId, result, winnerId);
  }

  async completeGame(gameId: number, result: string, winnerId?: string | null): Promise<Game> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found');

    const updates: Partial<Game> = {
      status: 'completed',
      completedAt: new Date(),
      result,
      winnerId: winnerId || null
    };

    const updatedGame = await this.updateGame(gameId, updates);

    if (game.whitePlayerId && game.whitePlayerId !== 'ai') {
      const isWinner = winnerId === game.whitePlayerId;
      const isDraw = result === 'draw';
      const isResignation = result === 'resignation';
      
      let gameResult: 'win' | 'loss' | 'draw' | 'resignation';
      let pointsChange: number;

      if (isResignation) {
        gameResult = 'resignation';
        pointsChange = -2;
      } else if (isDraw) {
        gameResult = 'draw';
        pointsChange = 4;
      } else if (isWinner) {
        gameResult = 'win';
        pointsChange = 4;
      } else {
        gameResult = 'loss';
        pointsChange = -2;
      }

      await this.updateUserStats(game.whitePlayerId, gameResult, pointsChange);
      
      await this.updateGame(gameId, { pointsAwarded: pointsChange });
    }

    if (game.blackPlayerId && game.blackPlayerId !== 'ai') {
      const isWinner = winnerId === game.blackPlayerId;
      const isDraw = result === 'draw';
      const isResignation = result === 'resignation';
      
      let gameResult: 'win' | 'loss' | 'draw' | 'resignation';
      let pointsChange: number;

      if (isResignation) {
        gameResult = 'resignation';
        pointsChange = -2;
      } else if (isDraw) {
        gameResult = 'draw';
        pointsChange = 4;
      } else if (isWinner) {
        gameResult = 'win';
        pointsChange = 4;
      } else {
        gameResult = 'loss';
        pointsChange = -2;
      }

      await this.updateUserStats(game.blackPlayerId, gameResult, pointsChange);
    }

    return updatedGame;
  }

  // Leaderboard operations
  async getLeaderboard(limit = 50): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.totalPoints), desc(users.level))
      .limit(limit);
  }

  async getUserRank(userId: string): Promise<number> {
    const result = await db
      .select({ rank: sql<number>`row_number() over (order by ${users.totalPoints} desc, ${users.level} desc)` })
      .from(users)
      .where(eq(users.id, userId));
    
    return result[0]?.rank || 0;
  }

  // Tutorial operations
  async getTutorialLessons(): Promise<TutorialLesson[]> {
    return await db
      .select()
      .from(tutorialLessons)
      .where(eq(tutorialLessons.isActive, true))
      .orderBy(tutorialLessons.orderIndex);
  }

  async getUserLessonProgress(userId: string): Promise<UserLessonProgress[]> {
    return await db
      .select()
      .from(userLessonProgress)
      .where(eq(userLessonProgress.userId, userId));
  }

  async updateLessonProgress(userId: string, lessonId: number, completed: boolean, score?: number): Promise<UserLessonProgress> {
    const existingProgress = await db
      .select()
      .from(userLessonProgress)
      .where(sql`${userLessonProgress.userId} = ${userId} AND ${userLessonProgress.lessonId} = ${lessonId}`);

    if (existingProgress.length > 0) {
      const [updated] = await db
        .update(userLessonProgress)
        .set({
          completed,
          score,
          completedAt: completed ? new Date() : null,
        })
        .where(sql`${userLessonProgress.userId} = ${userId} AND ${userLessonProgress.lessonId} = ${lessonId}`)
        .returning();
      return updated;
    } else {
      const [newProgress] = await db
        .insert(userLessonProgress)
        .values({
          userId,
          lessonId,
          completed,
          score,
          completedAt: completed ? new Date() : null,
        })
        .returning();
      return newProgress;
    }
  }

  // Statistics operations
  async updateUserStats(userId: string, gameResult: 'win' | 'loss' | 'draw' | 'resignation', pointsChange: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error('User not found');

    let updates: Partial<User> = {
      gamesPlayed: (user.gamesPlayed ?? 0) + 1,
      totalPoints: (user.totalPoints ?? 0) + pointsChange,
    };

    // Update specific game result counter
    switch (gameResult) {
      case 'win':
        updates.wins = (user.wins ?? 0) + 1;
        updates.currentStreak = (user.currentStreak ?? 0) + 1;
        updates.bestStreak = Math.max(user.bestStreak ?? 0, updates.currentStreak);
        break;
      case 'loss':
        updates.losses = (user.losses ?? 0) + 1;
        updates.currentStreak = 0;
        break;
      case 'draw':
        updates.draws = (user.draws ?? 0) + 1;
        updates.currentStreak = (user.currentStreak ?? 0) + 1;
        updates.bestStreak = Math.max(user.bestStreak ?? 0, updates.currentStreak);
        break;
      case 'resignation':
        updates.resignations = (user.resignations ?? 0) + 1;
        updates.currentStreak = 0;
        break;
    }

    // Calculate level based on XP (every 1000 XP = 1 level)
    const newXp = (user.xp ?? 0) + Math.max(pointsChange * 10, 0); // Convert points to XP
    updates.xp = newXp;
    updates.level = Math.floor(newXp / 1000) + 1;

    const [updatedUser] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    return updatedUser;
  }
}

export const storage = new DatabaseStorage();
