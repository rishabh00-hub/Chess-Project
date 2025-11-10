import {
  type User,
  type UpsertUser,
  type Game,
  type InsertGame,
  type TutorialLesson,
  type UserLessonProgress,
} from "../shared/schema.js";
import { db } from "./db.js";

class Storage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return db.getUser(id);
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    return db.upsertUser(user);
  }

  // Game operations
  async createGame(game: InsertGame): Promise<Game> {
    return db.createGame(game);
  }

  async getGame(id: number): Promise<Game | undefined> {
    return db.getGame(id);
  }

  async updateGame(id: number, updates: Partial<Game>): Promise<Game> {
    return db.updateGame(id, updates);
  }

  async getUserGames(userId: string, limit?: number): Promise<Game[]> {
    return db.getUserGames(userId, limit);
  }

  async getRecentGames(userId: string, limit?: number): Promise<Game[]> {
    return db.getRecentGames(userId, limit);
  }

  async makeMove(gameId: number, move: { from: string; to: string; promotion?: string }): Promise<Game> {
    return db.makeMove(gameId, move);
  }

  async resignGame(gameId: number, userId: string): Promise<Game> {
    return db.resignGame(gameId, userId);
  }

  async completeGame(gameId: number, result: string, winnerId?: string | null): Promise<Game> {
    return db.completeGame(gameId, result, winnerId);
  }

  // Leaderboard operations
  async getLeaderboard(limit?: number): Promise<User[]> {
    return db.getLeaderboard(limit);
  }

  async getUserRank(userId: string): Promise<number> {
    return db.getUserRank(userId);
  }

  // Tutorial operations
  async getTutorialLessons(): Promise<TutorialLesson[]> {
    return db.getTutorialLessons();
  }

  async getTutorialLesson(id: number): Promise<TutorialLesson | undefined> {
    return db.getTutorialLesson(id);
  }

  async getLessonProgress(userId: string, lessonId: number): Promise<UserLessonProgress | undefined> {
    return db.getLessonProgress(userId, lessonId);
  }

  async updateLessonProgress(progress: UserLessonProgress): Promise<UserLessonProgress> {
    return db.updateLessonProgress(progress);
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
