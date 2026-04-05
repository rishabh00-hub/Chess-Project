import { integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { z } from "zod";

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  whitePlayerId: text("white_player_id").notNull(),
  blackPlayerId: text("black_player_id").notNull(),
  gameMode: text("game_mode").notNull(),
  status: text("status").notNull(),
  aiDifficulty: integer("ai_difficulty"),
});

// TypeScript interfaces for data types
export interface Session {
  sid: string;
  sess: any;
  expire: Date;
}

export interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  level: number;
  xp: number;
  totalPoints: number;
  elo: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  resignations: number;
  currentStreak: number;
  bestStreak: number;
  tutorialProgress: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Game {
  id: number;
  whitePlayerId: string;
  blackPlayerId: string;
  winnerId?: string;
  gameMode: 'ai' | 'friend' | 'online';
  status: 'active' | 'completed' | 'abandoned' | 'draw' | 'resigned' | 'timeout';
  result?: 'white_wins' | 'black_wins' | 'draw' | 'resignation';
  currentTurn: 'white' | 'black';
  currentPosition: string;
  moves: Array<{ notation: string; timestamp: Date; fen: string }>;
  moveHistory: string;
  halfMoveClock: number;
  fullMoveNumber: number;
  aiDifficulty?: number;
  aiElo?: number;
  timeControl?: { initial: number; increment: number };
  whiteTimeRemaining?: number;
  blackTimeRemaining?: number;
  lastMoveAt?: Date;
  duration?: number;
  pointsAwarded: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface TutorialLesson {
  id: number;
  title: string;
  description?: string;
  category: 'rules' | 'strategy' | 'interactive';
  difficulty: number;
  content: any;
  orderIndex: number;
  isActive: boolean;
  createdAt: Date;
}

export interface UserLessonProgress {
  id: number;
  userId: string;
  lessonId: number;
  completed: boolean;
  score?: number;
  completedAt?: Date;
  createdAt: Date;
}

// Zod schemas for validation
export const insertGameSchema = z.object({
  whitePlayerId: z.string(),
  blackPlayerId: z.string(),
  gameMode: z.enum(['ai', 'friend', 'online']),
  status: z.enum(['active', 'completed', 'abandoned', 'draw', 'resigned', 'timeout']).default('active'),
  currentTurn: z.enum(['white', 'black']).default('white'),
  currentPosition: z.string().default('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
  moves: z.array(z.object({
    notation: z.string(),
    timestamp: z.date(),
    fen: z.string()
  })).default([]),
  moveHistory: z.string().default(''),
  halfMoveClock: z.number().default(0),
  fullMoveNumber: z.number().default(1),
  aiDifficulty: z.number().min(600).max(2100).optional(),
  aiElo: z.number().min(600).max(2100).optional(),
  timeControl: z.object({
    initial: z.number(),
    increment: z.number()
  }).optional(),
  pointsAwarded: z.number().default(0)
});

export const insertLessonProgressSchema = z.object({
  userId: z.string(),
  lessonId: z.number(),
  completed: z.boolean().default(false),
  score: z.number().optional()
});

export type InsertGame = z.infer<typeof insertGameSchema>;
export type UpsertUser = Partial<User> & Pick<User, "id">;
