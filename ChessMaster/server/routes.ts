import express from 'express';
import type { Express } from 'express';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { storage } from './storage.js';
import zohoApi from './zoho-api-service.js';

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

  // Primary user profile route
  app.get('/api/me', async (req: any, res) => {
    try {
      const isLoggedIn = await zohoApi.ensureAuthenticated();
      if (!isLoggedIn) {
        return res.status(401).json(null);
      }
      
      // Read userId from session instead of query parameters
      const userId = req.session?.userId;
      if (!userId) {
        console.warn('No userId in session');
        return res.status(401).json(null);
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json(null);
      }
      return res.json(user);
    } catch (error) {
      console.error("Auth/Profile Error:", error);
      res.status(401).json(null);
    }
  });

  // Alternate user profile route for client compatibility
  app.get('/api/user', async (req: any, res) => {
    try {
      const userId = req.query.userId;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(200).json(null);
    }
  });

  // Legacy auth route (kept for backward compatibility)
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      const userId = req.query.userId;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error in legacy auth route:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Real game creation route
  app.post('/api/games', async (req: any, res) => {
    try {
      const { whitePlayerId, blackPlayerId, gameMode, aiDifficulty } = req.body;
      if (!whitePlayerId || !gameMode) {
        return res.status(400).json({ message: "Missing required fields: whitePlayerId, gameMode" });
      }
      const gameData = {
        whitePlayerId,
        blackPlayerId: blackPlayerId || null,
        gameMode,
        status: 'active',
        aiDifficulty: aiDifficulty || null
      };
      const game = await storage.createGame(gameData);
      res.json(game);
    } catch (error) {
      console.error("Error creating game:", error);
      res.status(500).json({ message: "Failed to create game" });
    }
  });

  // Real logout route
  app.get('/api/logout', async (req, res) => {
    try {
      zohoApi.logout();
      res.redirect('/');
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: 'Logout failed' });
    }
  });

  app.get('/api/games/user/recent', async (req: any, res) => {
    try {
      const userId = req.query.userId;
      const games = await storage.getRecentGames(userId);
      res.status(200).json(games);
    } catch (error) {
      console.error("Error fetching recent games:", error);
      res.status(200).json([]);
    }
  });

  // Leaderboard route — return real data if available, otherwise empty array
  app.get('/api/leaderboard', async (req: any, res) => {
    try {
      const list = await storage.getLeaderboard();
      res.status(200).json(list);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(200).json([]);
    }
  });

  // Return a stable zero state for rank so frontend shows empty state instead of 404
  app.get('/api/leaderboard/rank', async (req: any, res) => {
    try {
      const userId = req.query.userId;
      const rank = await storage.getUserRank(userId);
      res.json({ rank, userId });
    } catch (error) {
      console.error('Unexpected error in /api/leaderboard/rank:', error);
      res.status(200).json({ rank: 0, userId: req.query.userId || null });
    }
  });

  // Demo tutorial routes
  app.get('/api/tutorial/lessons', async (req, res) => {
    try {
      const lessons = await storage.getTutorialLessons();
      res.json(lessons);
    } catch (error) {
      console.error("Error fetching tutorial lessons:", error);
      res.status(500).json({ message: "Failed to fetch tutorial lessons" });
    }
  });

  app.get('/api/tutorial/progress', async (req: any, res) => {
    try {
      // Since no userId or lessonId specified, return empty array
      res.json([]);
    } catch (error) {
      console.error("Error fetching tutorial progress:", error);
      res.status(500).json({ message: "Failed to fetch tutorial progress" });
    }
  });

  app.post('/api/tutorial/progress', async (req: any, res) => {
    try {
      const progress = await storage.updateLessonProgress(req.body);
      res.json(progress);
    } catch (error) {
      console.error("Error updating lesson progress:", error);
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

  // Handle Zoho OAuth Callback
  app.get('/', (req, res, next) => {
    const { code } = req.query;
    if (code) {
      res.redirect(`/api/callback?code=${code}`);
    } else {
      next();
    }
  });

  app.get('/api/callback', async (req, res) => {
    try {
      const { code } = req.query;
      if (!code) {
        console.warn("⚠️ No authorization code provided");
        return res.redirect('/?error=no_code');
      }

      // FIX 1: Construct the EXACT redirect URI dynamically to support HTTPS/Codespaces
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const currentRedirectUri = `${protocol}://${host}/api/callback`;
        
      console.log(`🔗 Exchanging Code. URI: ${currentRedirectUri}`);

      // FIX 2: Pass the URI to the service so Zoho accepts the handshake
      const authResult = await zohoApi.loginOrRegister(code.toString(), currentRedirectUri);
      console.log("✅ Zoho Auth Successful. Token stored.");

      // CRITICAL FIX: Enforce valid database user creation
      let userId: string | undefined;

      // If Zoho returned a userId, use it
      if (authResult?.userId) {
        userId = authResult.userId;
        console.log(`✓ Using userId from Zoho auth: ${userId}`);
      } else {
        console.warn("⚠️ No userId from Zoho auth, creating new user in database...");
        
        // If Zoho didn't return a userId, forcefully create one in the database
        try {
          const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const username = `Player_${Math.floor(Math.random() * 10000)}`;
          
          const newUser = await storage.upsertUser({
            id: newUserId,
            username: username,
            email: `${username}@chessmaster.app`,
            level: 1,
            xp: 0,
            totalPoints: 0,
            elo: 1200,
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            resignations: 0,
            currentStreak: 0,
            bestStreak: 0,
            tutorialProgress: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          
          if (newUser && newUser.id) {
            // If we generated a temp id earlier, log the Zoho-assigned ID for clarity
            if (newUser.id !== newUserId) {
              console.log(`✓ Created new database user (Zoho id ${newUser.id}, local id ${newUserId})`);
            } else {
              console.log(`✓ Created new database user: ${newUser.id}`);
            }
            userId = newUser.id;
          } else {
            console.error("❌ User creation returned invalid user object", newUser);
            throw new Error("User creation returned invalid user object");
          }
        } catch (dbErr) {
          console.error("❌ DB User Creation Error:", dbErr);
          return res.redirect('/?error=user_creation_failed');
        }
      }

      // CRITICAL: Check if userId is valid before setting session
      if (!userId) {
        console.error("❌ Critical Error: No valid userId available after all attempts");
        return res.redirect('/?error=no_valid_user_id');
      }

      // CRITICAL FIX: Assign userId to session and explicitly save before redirecting
      (req.session as any).userId = userId;
      console.log(`📌 Session userId set to: ${userId}`);
      
      // CRITICAL: Explicitly save session before redirecting to ensure cookie is set
      req.session.save((err) => {
        if (err) {
          console.error("❌ Session save error:", err);
          return res.redirect('/?error=session_failed');
        }
        console.log("✓ Session saved successfully");
        res.redirect('/?login=success');
      });
    } catch (error) {
      console.error("❌ Login Handshake Failed:", error);
      res.redirect('/?error=auth_failed_check_logs');
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
