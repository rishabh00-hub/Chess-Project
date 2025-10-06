import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  level: integer("level").default(1),
  xp: integer("xp").default(0),
  totalPoints: integer("total_points").default(0),
  gamesPlayed: integer("games_played").default(0),
  wins: integer("wins").default(0),
  losses: integer("losses").default(0),
  draws: integer("draws").default(0),
  resignations: integer("resignations").default(0),
  currentStreak: integer("current_streak").default(0),
  bestStreak: integer("best_streak").default(0),
  tutorialProgress: integer("tutorial_progress").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  whitePlayerId: varchar("white_player_id").references(() => users.id),
  blackPlayerId: varchar("black_player_id").references(() => users.id),
  winnerId: varchar("winner_id").references(() => users.id),
  gameMode: varchar("game_mode").notNull(), // "ai", "friend", "online", "bet"
  status: varchar("status").notNull(), // "active", "completed", "abandoned"
  result: varchar("result"), // "white_wins", "black_wins", "draw", "resignation"
  currentTurn: varchar("current_turn").default("white"), // "white" or "black"
  currentPosition: text("current_position").default("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"), // FEN notation
  moves: jsonb("moves").default([]), // Array of move objects with notation, timestamp, fen
  moveHistory: text("move_history").default(""), // Space-separated move list (e.g., "e4 e5 Nf3")
  halfMoveClock: integer("half_move_clock").default(0), // For 50-move rule
  fullMoveNumber: integer("full_move_number").default(1), // Current move number
  betAmount: integer("bet_amount").default(0), // Points wagered in bet matches
  aiDifficulty: varchar("ai_difficulty"), // "easy", "medium", "hard" for AI games
  timeControl: jsonb("time_control"), // { initial: seconds, increment: seconds }
  whiteTimeRemaining: integer("white_time_remaining"), // Seconds remaining
  blackTimeRemaining: integer("black_time_remaining"), // Seconds remaining
  lastMoveAt: timestamp("last_move_at"), // Timestamp of last move
  duration: integer("duration"), // Game duration in seconds
  pointsAwarded: integer("points_awarded").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const tutorialLessons = pgTable("tutorial_lessons", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  description: text("description"),
  category: varchar("category").notNull(), // "rules", "strategy", "interactive"
  difficulty: integer("difficulty").default(1),
  content: jsonb("content"), // Lesson content and exercises
  orderIndex: integer("order_index").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userLessonProgress = pgTable("user_lesson_progress", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  lessonId: integer("lesson_id").references(() => tutorialLessons.id),
  completed: boolean("completed").default(false),
  score: integer("score"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertGame = typeof games.$inferInsert;
export type Game = typeof games.$inferSelect;
export type TutorialLesson = typeof tutorialLessons.$inferSelect;
export type UserLessonProgress = typeof userLessonProgress.$inferSelect;

export const insertGameSchema = createInsertSchema(games).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertLessonProgressSchema = createInsertSchema(userLessonProgress).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});
