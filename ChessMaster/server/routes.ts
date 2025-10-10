import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
const zohoApi = require("./zoho-api-service");
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertGameSchema, insertLessonProgressSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Temporarily disable auth for UI demonstration
  // await setupAuth(app);

  // Demo auth route for UI showcase
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Return demo user data
      const demoUser = {
        id: "demo_user_123",
        email: "player@chess.com",
        firstName: "Chess",
        lastName: "Master",
        profileImageUrl: null,
        level: 8,
        xp: 7250,
        totalPoints: 1420,
        gamesPlayed: 156,
        wins: 89,
        losses: 42,
        draws: 18,
        resignations: 7,
        currentStreak: 5,
        bestStreak: 12,
        tutorialProgress: 75,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date()
      };
      res.json(demoUser);
    } catch (error) {
      console.error("Error fetching demo user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Real game creation route
  app.post('/api/games', async (req: any, res) => {
    try {
      const { whitePlayerId, blackPlayerId, gameMode, aiDifficulty, betAmount } = req.body;
      if (!whitePlayerId || !gameMode) {
        return res.status(400).json({ message: "Missing required fields: whitePlayerId, gameMode" });
      }
      const gameData = {
        whitePlayerId,
        blackPlayerId: blackPlayerId || null,
        gameMode,
        status: 'active',
        aiDifficulty: aiDifficulty || null,
        betAmount: betAmount || 0
      };
      const game = await zohoApi.saveMatch(gameData);
      res.json(game);
    } catch (error) {
      console.error("Error creating game:", error);
      res.status(500).json({ message: "Failed to create game" });
    }
  });

  app.get('/api/games/user/recent', async (req: any, res) => {
    try {
      const demoGames = [
        {
          id: 1,
          whitePlayerId: "demo_user_123",
          blackPlayerId: "ai",
          winnerId: "demo_user_123",
          gameMode: "ai",
          status: "completed",
          result: "white_wins",
          createdAt: new Date(Date.now() - 86400000), // 1 day ago
          completedAt: new Date(Date.now() - 86400000 + 1200000) // 20 min later
        },
        {
          id: 2,
          whitePlayerId: "demo_user_123", 
          blackPlayerId: "ai",
          winnerId: null,
          gameMode: "ai",
          status: "completed",
          result: "draw",
          createdAt: new Date(Date.now() - 172800000), // 2 days ago
          completedAt: new Date(Date.now() - 172800000 + 1800000) // 30 min later
        },
        {
          id: 3,
          whitePlayerId: "demo_user_123",
          blackPlayerId: "ai", 
          winnerId: "ai",
          gameMode: "ai",
          status: "completed",
          result: "black_wins",
          createdAt: new Date(Date.now() - 259200000), // 3 days ago
          completedAt: new Date(Date.now() - 259200000 + 900000) // 15 min later
        }
      ];
      
      res.json(demoGames);
    } catch (error) {
      console.error("Error fetching demo recent games:", error);
      res.status(500).json({ message: "Failed to fetch recent games" });
    }
  });

  // Demo leaderboard routes
  app.get('/api/leaderboard', async (req, res) => {
    try {
      const demoLeaderboard = [
        {
          id: "player_001",
          email: "grandmaster@chess.com",
          firstName: "Magnus",
          lastName: "Champion",
          profileImageUrl: null,
          level: 25,
          totalPoints: 5420,
          gamesPlayed: 342,
          wins: 298,
          losses: 31,
          draws: 13
        },
        {
          id: "player_002", 
          email: "knight@chess.com",
          firstName: "Anna",
          lastName: "Knight",
          profileImageUrl: null,
          level: 18,
          totalPoints: 3180,
          gamesPlayed: 267,
          wins: 201,
          losses: 48,
          draws: 18
        },
        {
          id: "demo_user_123",
          email: "player@chess.com",
          firstName: "Chess",
          lastName: "Master",
          profileImageUrl: null,
          level: 8,
          totalPoints: 1420,
          gamesPlayed: 156,
          wins: 89,
          losses: 42,
          draws: 18
        },
        {
          id: "player_004",
          email: "rookie@chess.com", 
          firstName: "Alex",
          lastName: "Rookie",
          profileImageUrl: null,
          level: 4,
          totalPoints: 680,
          gamesPlayed: 89,
          wins: 45,
          losses: 32,
          draws: 12
        }
      ];
      
      res.json(demoLeaderboard);
    } catch (error) {
      console.error("Error fetching demo leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.get('/api/leaderboard/rank', async (req: any, res) => {
    try {
      const userId = req.query.userId || "demo_user_123";
      const rank = await zohoApi.getRank(userId);
      res.json(rank);
    } catch (error) {
      console.error("Error fetching demo rank:", error);
      res.status(500).json({ message: "Failed to fetch user rank" });
    }
  });

  // Demo tutorial routes
  app.get('/api/tutorial/lessons', async (req, res) => {
    try {
      const demoLessons = [
        {
          id: 1,
          title: "Basic Piece Movement",
          description: "Learn how each chess piece moves",
          category: "rules",
          difficulty: 1,
          orderIndex: 1,
          isActive: true
        },
        {
          id: 2,
          title: "Castling",
          description: "Master the special castling move",
          category: "rules", 
          difficulty: 2,
          orderIndex: 2,
          isActive: true
        },
        {
          id: 3,
          title: "En Passant",
          description: "Understand the en passant capture",
          category: "rules",
          difficulty: 3,
          orderIndex: 3,
          isActive: true
        }
      ];
      res.json(demoLessons);
    } catch (error) {
      console.error("Error fetching demo tutorial lessons:", error);
      res.status(500).json({ message: "Failed to fetch tutorial lessons" });
    }
  });

  app.get('/api/tutorial/progress', async (req: any, res) => {
    try {
      const demoProgress = [
        {
          id: 1,
          userId: "demo_user_123",
          lessonId: 1,
          completed: true,
          score: 100,
          completedAt: new Date(Date.now() - 604800000) // 1 week ago
        },
        {
          id: 2,
          userId: "demo_user_123", 
          lessonId: 2,
          completed: true,
          score: 85,
          completedAt: new Date(Date.now() - 345600000) // 4 days ago
        }
      ];
      res.json(demoProgress);
    } catch (error) {
      console.error("Error fetching demo tutorial progress:", error);
      res.status(500).json({ message: "Failed to fetch tutorial progress" });
    }
  });

  app.post('/api/tutorial/progress', async (req: any, res) => {
    try {
      const demoProgress = {
        id: Math.floor(Math.random() * 1000),
        userId: "demo_user_123",
        lessonId: req.body.lessonId,
        completed: req.body.completed,
        score: req.body.score || 100,
        completedAt: new Date()
      };
      
      res.json(demoProgress);
    } catch (error) {
      console.error("Error updating demo lesson progress:", error);
      res.status(500).json({ message: "Failed to update lesson progress" });
    }
  });

  // Real game operation routes
  app.get('/api/games/:id', async (req: any, res) => {
    try {
      const gameId = parseInt(req.params.id);
      const game = await storage.getGame(gameId);
      
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      res.json(game);
    } catch (error) {
      console.error("Error fetching game:", error);
      res.status(500).json({ message: "Failed to fetch game" });
    }
  });

  app.post('/api/games/:id/move', async (req: any, res) => {
    try {
      const gameId = parseInt(req.params.id);
      const { from, to, promotion } = req.body;
      
      if (!from || !to) {
        return res.status(400).json({ message: "Missing required fields: from, to" });
      }

      const game = await storage.makeMove(gameId, { from, to, promotion });
      
      // If playing against AI and it's AI's turn, make AI move
      if (game.gameMode === 'ai' && game.blackPlayerId === 'ai' && game.currentTurn === 'black' && game.status === 'active') {
        try {
          const { ChessEngine } = await import('../shared/chessEngine.js');
          const engine = new ChessEngine(game.currentPosition || undefined);
          const difficulty = game.aiDifficulty as 'easy' | 'medium' | 'hard' || 'medium';
          const aiMove = engine.getAIMove(difficulty);
          
          if (aiMove) {
            await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));
            const updatedGame = await storage.makeMove(gameId, {
              from: aiMove.from,
              to: aiMove.to,
              promotion: aiMove.promotion
            });
            return res.json(updatedGame);
          }
        } catch (aiError) {
          console.error("AI move error:", aiError);
        }
      }
      
      res.json(game);
    } catch (error: any) {
      console.error("Error making move:", error);
      res.status(400).json({ message: error.message || "Failed to make move" });
    }
  });

  app.post('/api/games/:id/resign', async (req: any, res) => {
    try {
      const gameId = parseInt(req.params.id);
      const userId = req.body.userId || "demo_user_123";
      
      const game = await storage.resignGame(gameId, userId);
      
      res.json(game);
    } catch (error: any) {
      console.error("Error resigning game:", error);
      res.status(400).json({ message: error.message || "Failed to resign game" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
