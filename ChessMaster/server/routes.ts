import express from 'express';
import type { Express } from 'express';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { storage } from './storage.js';
import zohoApi from './zoho-api-service.js';

// Demo user helper function
function getDemoUser() {
  return {
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
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Temporarily disable auth for UI demonstration
  // await setupAuth(app);

  // Zoho initialization route - use this to store your refresh token
  app.post('/api/zoho/init', express.json(), async (req, res) => {
    try {
      const { authCode } = req.body;
      if (!authCode) {
        return res.status(400).json({ error: 'authCode is required in request body' });
      }
      
      await zohoApi.loginOrRegister(authCode);
      res.json({ success: true, message: 'Zoho refresh token stored successfully' });
    } catch (error: any) {
      console.error('Zoho initialization error:', error);
      res.status(500).json({ 
        error: 'Failed to initialize Zoho',
        details: error.message
      });
    }
  });

  // Health Check/Status Route
  app.get('/api/status', async (req, res) => {
    res.json({ 
      status: "OK", 
      service: "Zoho Backend", 
      authenticated: zohoApi.isAuthenticated(), 
      message: "Backend service is running." 
    });
  });

  // Primary user profile route (replacing /api/auth/user)
  app.get('/api/me', async (req: any, res) => {
    try {
      // If Zoho is not authenticated, return null so frontend shows empty state
      if (!zohoApi.isAuthenticated()) {
        console.log('/api/me: Zoho not authenticated, returning null');
        return res.status(200).json(null);
      }

      const userId = req.query.userId; // Expecting Zoho-backed user id
      console.log('Attempting to fetch profile for userId:', userId);
      try {
        const profile = await zohoApi.getUserProfile(userId);
        if (profile) {
          console.log('Found Zoho profile, returning');
          return res.status(200).json(profile);
        }
      } catch (profileErr) {
        console.error('Error fetching Zoho profile:', profileErr);
      }

      // If we reach here, there is no real user profile — return null (no fake/demo data)
      return res.status(200).json(null);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      // On unexpected errors, return null — keep server stable and let frontend show empty state
      return res.status(200).json(null);
    }
  });

  // Alternate user profile route for client compatibility
  app.get('/api/user', async (req: any, res) => {
    try {
      if (!zohoApi.isAuthenticated()) {
        return res.status(200).json(null);
      }

      const userId = req.query.userId;
      const profile = await zohoApi.getUserProfile(userId);
      if (profile) {
        return res.json(profile);
      }

      return res.status(200).json(null);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(200).json(null);
    }
  });

  // Legacy auth route (kept for backward compatibility)
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // If Zoho is not authenticated, return null (frontend shows not-logged-in state)
      if (!zohoApi.isAuthenticated()) {
        return res.status(200).json(null);
      }

      const userId = req.query.userId;
      try {
        const profile = await zohoApi.getUserProfile(userId);
        if (profile) return res.json(profile);
      } catch (err) {
        console.error('Error fetching Zoho profile for /api/auth/user:', err);
      }

      res.status(200).json(null);
    } catch (error) {
      console.error("Error in legacy auth route:", error);
      res.status(500).json({ error: "Internal server error" });
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
      const game = await storage.createGame(gameData);
      res.json(game);
    } catch (error) {
      console.error("Error creating game:", error);
      res.status(500).json({ message: "Failed to create game" });
    }
  });

  app.get('/api/games/user/recent', async (req: any, res) => {
    try {
      // Try to get real data from storage
      const userId = req.query.userId;
      if (storage && typeof storage.getRecentGames === 'function') {
        const games = await storage.getRecentGames(userId);
        return res.status(200).json(Array.isArray(games) ? games : []);
      }
    } catch (error) {
      console.error("Error fetching recent games:", error);
    }

    // If storage not available or error, return an empty array (frontend shows empty state)
    return res.status(200).json([]);
  });

  // Leaderboard route — return real data if available, otherwise empty array
  app.get('/api/leaderboard', async (req: any, res) => {
    try {
      // Try to get real data from storage
      if (storage && typeof storage.getLeaderboard === 'function') {
        const list = await storage.getLeaderboard();
        return res.status(200).json(Array.isArray(list) ? list : []);
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    }

    // If storage not available or error, return empty array (frontend shows empty state)
    return res.status(200).json([]);
  });

  // Return a stable zero state for rank so frontend shows empty state instead of 404
  app.get('/api/leaderboard/rank', async (req: any, res) => {
    try {
      const userId = req.query.userId || null;
      // We intentionally return a zero/null rank rather than fake/demo values
      res.json({ rank: 0, userId });
    } catch (error) {
      console.error('Unexpected error in /api/leaderboard/rank:', error);
      res.status(200).json({ rank: 0, userId: req.query.userId || null });
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
