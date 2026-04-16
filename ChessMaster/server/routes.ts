import express from 'express';
import type { Express } from 'express';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { storage } from './storage.js';
import zohoApi, { makeZohoApiRequest, buildReportURL } from './zoho-api-service.js';
import { usernameSchema } from '../shared/schema.js';
import { createRealtimeServer } from './realtime.js';

// Type for Zoho API responses
interface ZohoApiResponse {
  data?: any[];
  [key: string]: any;
}

const aiThinkingGames = new Set<string>();

// In-memory storage for friend rooms and matchmaking
const friendRooms = new Map<string, { hostId: string; gameId?: number; guestId?: string; createdAt: number }>();
const matchmakingQueue: Array<{ userId: string; elo: number; timestamp: number }> = [];

// Cleanup intervals
setInterval(() => {
  const now = Date.now();
  // Remove friend rooms older than 1 hour
  for (const [code, room] of friendRooms.entries()) {
    if (now - room.createdAt > 60 * 60 * 1000) { // 1 hour
      friendRooms.delete(code);
    }
  }
  // Remove matchmaking entries older than 5 minutes
  matchmakingQueue.splice(0, matchmakingQueue.length, 
    ...matchmakingQueue.filter(entry => now - entry.timestamp < 5 * 60 * 1000)
  );
}, 60 * 1000); // Run cleanup every minute

// Helper function to find a match in the queue
function findMatch(userId: string, userElo: number): { opponentId: string } | null {
  const candidates = matchmakingQueue.filter(entry => 
    entry.userId !== userId && 
    Math.abs(entry.elo - userElo) <= 300 // Within 300 Elo points for better matching
  );

  if (candidates.length === 0) return null;

  // Find the closest Elo match, but add some randomization for fairness
  candidates.sort((a, b) => Math.abs(a.elo - userElo) - Math.abs(b.elo - userElo));
  
  // If there are multiple candidates within 50 Elo points, randomize
  const bestEloDiff = Math.abs(candidates[0].elo - userElo);
  const closeCandidates = candidates.filter(c => Math.abs(c.elo - userElo) <= bestEloDiff + 50);
  
  const selected = closeCandidates[Math.floor(Math.random() * closeCandidates.length)];
  return { opponentId: selected.userId };
}

// Initialize aiThinkingGames from persisted games on startup
(async () => {
  try {
    const allGames = await storage.getRecentGames('', 1000); // Get many games
    for (const game of allGames) {
      if (game.status === 'ai_thinking') {
        aiThinkingGames.add(String(game.id));
      }
    }
    console.log(`Initialized ${aiThinkingGames.size} ai_thinking games from storage`);
  } catch (error) {
    console.warn('Failed to initialize aiThinkingGames from storage:', error);
  }
})();

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const realtime = createRealtimeServer(httpServer);

  // Temporarily disable auth for UI demonstration
  // await setupAuth(app);

  // Zoho initialization route - use this to store your refresh token
  app.post('/api/zoho/init', express.json(), async (req, res) => {
    try {
      const { authCode, redirectUri } = req.body;
      if (!authCode) {
        return res.status(400).json({ error: 'authCode is required in request body' });
      }
      
      await zohoApi.initializeServerToken(authCode, redirectUri);
      res.json({ success: true, message: 'Zoho refresh token stored and verified successfully' });
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
        console.warn('API /me: Zoho authentication failed');
        return res.status(401).json({ message: 'Zoho authentication failed' });
      }
      
      // Read userId from session instead of query parameters
      const userId = req.session?.userId;
      if (!userId) {
        console.warn('API /me: No userId in session');
        return res.status(401).json({ message: 'No active session' });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        console.warn(`API /me: User not found in storage: ${userId}`);
        return res.status(404).json({ message: 'User profile not found' });
      }
      return res.json(user);
    } catch (error) {
      console.error("CRITICAL: Auth/Profile Error:", error);
      res.status(500).json({ message: 'Internal server error' });
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

  app.post('/api/users/check-username', express.json(), async (req: any, res) => {
    try {
      const { username } = req.body;
      if (!username || typeof username !== 'string') {
        return res.status(400).json({ available: false, message: 'Username is required' });
      }
      const existingUser = await zohoApi.getUserByUsername(username.trim());
      res.json({ available: !existingUser });
    } catch (error: any) {
      console.error('Error checking username:', error);
      res.status(500).json({ available: false, message: 'Unable to verify username' });
    }
  });

  app.get('/api/users/pending', async (req: any, res) => {
    try {
      const pending = req.session?.pendingZohoProfile || null;
      res.json(pending);
    } catch (error) {
      console.error('Error fetching pending onboarding profile:', error);
      res.status(500).json({ message: 'Failed to fetch onboarding profile' });
    }
  });

  app.post('/api/users/onboard', express.json(), async (req: any, res) => {
    try {
      const pending = req.session?.pendingZohoProfile;
      if (!pending) {
        return res.status(400).json({ message: 'No onboarding session exists' });
      }
      const { username, firstName, lastName } = req.body;
      if (!username || !firstName || !lastName) {
        return res.status(400).json({ message: 'username, firstName, and lastName are required' });
      }
      const parsedUsername = usernameSchema.safeParse(String(username));
      if (!parsedUsername.success) {
        return res.status(400).json({ message: parsedUsername.error.issues[0]?.message || 'Invalid username format' });
      }
      const sanitizedUsername = parsedUsername.data;

      // STRICT UNIQUE USERNAME CHECK: Multiple verification layers
      console.log(`🔍 Checking username uniqueness: "${sanitizedUsername}"`);

      // 1. Check against Zoho database by username field
      const existingUserByUsername = await zohoApi.getUserByUsername(sanitizedUsername);
      if (existingUserByUsername) {
        console.warn(`❌ Username "${sanitizedUsername}" already exists in Zoho`);
        return res.status(409).json({ message: 'Username already taken. Please choose a different username.' });
      }

      // 2. Additional check: Search by username criteria to catch any edge cases
      const usernameCriteria = `(username=="${sanitizedUsername}")`;
      const usernamePath = buildReportURL(process.env.ZOHO_USER_REPORT_NAME, usernameCriteria as any);
      try {
        const usernameSearchResult = await makeZohoApiRequest(usernamePath, 'GET') as ZohoApiResponse;
        if (usernameSearchResult?.data && usernameSearchResult.data.length > 0) {
          console.warn(`❌ Username "${sanitizedUsername}" found via criteria search`);
          return res.status(409).json({ message: 'Username already taken. Please choose a different username.' });
        }
      } catch (searchError: any) {
        const searchMessage = searchError?.message || '';
        // If search fails with "No Data" or Zoho no-records (9280), username is available.
        if (
          !searchMessage.includes('No Data') &&
          !searchMessage.includes('No records found') &&
          !searchMessage.includes('"code":9280')
        ) {
          console.error('Error during username criteria search:', searchError);
          return res.status(500).json({ message: 'Unable to verify username availability' });
        }
      }

      console.log(`✅ Username "${sanitizedUsername}" is available`);

      const result = await zohoApi.createUserProfile({
        username: sanitizedUsername,
        email: pending.email,
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        elo: 1200,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0
      }) as ZohoApiResponse;

      const userId = result?.data?.[0]?.ID || result?.data?.[0]?.id;
      if (!userId) {
        console.error('Unable to create user during onboarding', result);
        return res.status(500).json({ message: 'Failed to create user profile' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        console.error('Could not load newly created user from Zoho', userId);
        return res.status(500).json({ message: 'Failed to load created user' });
      }

      req.session.userId = userId;
      delete req.session.pendingZohoProfile;
      req.session.save((err: any) => {
        if (err) {
          console.error('Session save failed after onboarding:', err);
          return res.status(500).json({ message: 'Failed to save session' });
        }
        res.json(user);
      });
    } catch (error: any) {
      console.error('Error onboarding user:', error);
      res.status(500).json({ message: error.message || 'Onboarding failed' });
    }
  });

  // Real game creation route
  app.post('/api/games', async (req: any, res) => {
    try {
      console.log("POST /api/games received:", req.body);

      const { whitePlayerId, blackPlayerId, gameMode } = req.body;
      let safeElo: number | null = null;
      
      // Validate required fields
      if (!whitePlayerId) {
        return res.status(400).json({ message: "Missing required field: whitePlayerId" });
      }
      if (!gameMode || !['ai', 'friend', 'online'].includes(gameMode)) {
        return res.status(400).json({ message: "Missing or invalid field: gameMode (must be 'ai', 'friend', or 'online')" });
      }

      // Parse and validate AI difficulty if present
      if (gameMode === 'ai') {
        if (req.body.aiDifficulty !== undefined) {
          safeElo = parseInt(req.body.aiDifficulty, 10);
          if (isNaN(safeElo) || safeElo < 600 || safeElo > 2100) {
            console.warn(`Invalid aiDifficulty: ${req.body.aiDifficulty}, using default 1200`);
            safeElo = 1200;
          }
        } else {
          safeElo = 1200;
        }
      }

      const gameData = {
        whitePlayerId,
        blackPlayerId: blackPlayerId || '',
        gameMode,
        status: 'active' as const,
        currentTurn: 'white' as const,
        currentPosition: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [],
        moveHistory: '',
        halfMoveClock: 0,
        fullMoveNumber: 1,
        aiDifficulty: safeElo || undefined,
        pointsAwarded: 0
      };
      
      const game = await storage.createGame(gameData);
      if (!game || !game.id) {
        return res.status(500).json({ message: "Failed to create game: storage returned null" });
      }

      realtime.broadcastGameUpdate(game);
      
      res.json(game);
    } catch (error: any) {
      console.error("CRITICAL: Error creating game:", error);
      res.status(500).json({ message: "Failed to create game", error: error?.message });
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

  // Friend room creation
  app.post('/api/rooms', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      // Generate unique room code
      let roomCode: string;
      do {
        roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      } while (friendRooms.has(roomCode));

      friendRooms.set(roomCode, {
        hostId: userId,
        createdAt: Date.now()
      });

      console.log(`Created friend room ${roomCode} for user ${userId}`);
      res.json({ roomCode });
    } catch (error: any) {
      console.error('Error creating friend room:', error);
      res.status(500).json({ message: 'Failed to create room' });
    }
  });

  // Join friend room
  app.post('/api/rooms/:code/join', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const roomCode = req.params.code.toUpperCase();
      const room = friendRooms.get(roomCode);

      if (!room) {
        return res.status(404).json({ message: 'Room not found' });
      }

      if (room.hostId === userId) {
        return res.status(400).json({ message: 'Cannot join your own room' });
      }

      if (room.guestId) {
        return res.status(400).json({ message: 'Room is full' });
      }

      if (room.gameId) {
        return res.status(400).json({ message: 'Game already started' });
      }

      // Create game
      const gameData = {
        whitePlayerId: room.hostId,
        blackPlayerId: userId,
        gameMode: 'friend' as const,
        status: 'active' as const,
        currentTurn: 'white' as const,
        currentPosition: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [],
        moveHistory: '',
        halfMoveClock: 0,
        fullMoveNumber: 1,
        pointsAwarded: 0
      };

      const game = await storage.createGame(gameData);
      if (!game) {
        return res.status(500).json({ message: 'Failed to create game' });
      }

      realtime.broadcastGameUpdate(game);

      // Update room
      room.guestId = userId;
      room.gameId = game.id;

      console.log(`User ${userId} joined room ${roomCode}, game ${game.id} created`);
      res.json({ gameId: game.id });
    } catch (error: any) {
      console.error('Error joining friend room:', error);
      res.status(500).json({ message: 'Failed to join room' });
    }
  });

  // Enter matchmaking queue
  app.post('/api/matchmaking/enter', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      // Check if already in queue
      const existingIndex = matchmakingQueue.findIndex(entry => entry.userId === userId);
      if (existingIndex !== -1) {
        return res.status(400).json({ message: 'Already in matchmaking queue' });
      }

      // Get user Elo
      const user = await storage.getUser(userId);
      const elo = user?.elo || 1200;

      matchmakingQueue.push({
        userId,
        elo,
        timestamp: Date.now()
      });

      console.log(`User ${userId} (Elo: ${elo}) entered matchmaking queue. Queue size: ${matchmakingQueue.length}`);

      // Try to find a match
      const match = findMatch(userId, elo);
      if (match) {
        // Remove both from queue
        matchmakingQueue.splice(matchmakingQueue.findIndex(e => e.userId === userId), 1);
        matchmakingQueue.splice(matchmakingQueue.findIndex(e => e.userId === match.opponentId), 1);

        // Create game (decide colors randomly)
        const isWhite = Math.random() < 0.5;
        const gameData = {
          whitePlayerId: isWhite ? userId : match.opponentId,
          blackPlayerId: isWhite ? match.opponentId : userId,
          gameMode: 'online' as const,
          status: 'active' as const,
          currentTurn: 'white' as const,
          currentPosition: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          moves: [],
          moveHistory: '',
          halfMoveClock: 0,
          fullMoveNumber: 1,
          pointsAwarded: 0
        };

        const game = await storage.createGame(gameData);
        if (game) {
          console.log(`Match found: ${userId} vs ${match.opponentId}, game ${game.id} created`);
          realtime.broadcastGameUpdate(game);
          return res.json({ gameId: game.id, opponentId: match.opponentId });
        }
      }

      res.json({ status: 'queued' });
    } catch (error: any) {
      console.error('Error entering matchmaking:', error);
      res.status(500).json({ message: 'Failed to enter matchmaking' });
    }
  });

  // Check matchmaking status
  app.get('/api/matchmaking/status', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const inQueue = matchmakingQueue.some(entry => entry.userId === userId);
      res.json({ inQueue, queueSize: matchmakingQueue.length });
    } catch (error: any) {
      console.error('Error checking matchmaking status:', error);
      res.status(500).json({ message: 'Failed to check status' });
    }
  });

  // Leave matchmaking queue
  app.delete('/api/matchmaking/leave', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const index = matchmakingQueue.findIndex(entry => entry.userId === userId);
      if (index !== -1) {
        matchmakingQueue.splice(index, 1);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error leaving matchmaking:', error);
      res.status(500).json({ message: 'Failed to leave queue' });
    }
  });

  app.get('/api/games/user/recent', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      const games = await storage.getRecentGames(userId);
      res.status(200).json(games);
    } catch (error) {
      console.error("Error fetching recent games:", error);
      res.status(500).json({ message: "Failed to fetch recent games" });
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

  // Return user's rank on the leaderboard
  app.get('/api/leaderboard/rank', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      const rank = await storage.getUserRank(userId);
      res.json({ rank, userId });
    } catch (error) {
      console.error('Error in /api/leaderboard/rank:', error);
      res.status(500).json({ message: 'Failed to fetch rank' });
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
      const gameId = String(req.params.id);
      const game = await storage.getGame(gameId);
      
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      if (aiThinkingGames.has(gameId)) {
        return res.json({ ...game, status: 'ai_thinking' });
      }
      
      res.json(game);
    } catch (error) {
      console.error("Error fetching game:", error);
      res.status(500).json({ message: "Failed to fetch game" });
    }
  });

  app.post('/api/games/:id/move', async (req: any, res) => {
    try {
      const gameId = String(req.params.id);
      const { from, to, promotion } = req.body;
      
      if (!from || !to) {
        return res.status(400).json({ message: "Missing required fields: from, to" });
      }

      const currentGame = await storage.getGame(gameId);
      if (!currentGame) {
        return res.status(404).json({ message: 'Game not found' });
      }
      if (currentGame.status === 'ai_thinking' || aiThinkingGames.has(gameId)) {
        return res.status(423).json({ message: 'AI is thinking, please wait' });
      }

      const game = await storage.makeMove(gameId, { from, to, promotion });
      realtime.broadcastGameUpdate(game);

      if (game.gameMode === 'ai' && game.blackPlayerId === 'ai' && game.currentTurn === 'black' && game.status === 'active') {
        aiThinkingGames.add(gameId);
        const pendingGame = { ...game, status: 'ai_thinking' };
        const difficulty = typeof game.aiDifficulty === 'number'
          ? game.aiDifficulty
          : typeof game.aiDifficulty === 'string'
            ? parseInt(game.aiDifficulty, 10)
            : 1200;

        // Persist the ai_thinking status
        const thinkingGame = await storage.updateGame(gameId, { status: 'ai_thinking' });
        realtime.broadcastGameUpdate(thinkingGame);

        setTimeout(async () => {
          try {
            const latestGame = await storage.getGame(gameId);
            if (!latestGame) return;
            const { ChessEngine } = await import('../shared/chessEngine.js');
            const engine = new ChessEngine(latestGame.currentPosition || undefined);
            const aiMove = engine.getAIMove(difficulty);
            if (!aiMove) return;
            const updatedGame = await storage.makeMove(gameId, {
              from: aiMove.from,
              to: aiMove.to,
              promotion: aiMove.promotion
            });
            realtime.broadcastGameUpdate(updatedGame);
          } catch (aiError) {
            console.error('AI background move error:', aiError);
          } finally {
            aiThinkingGames.delete(gameId);
            // Clear the persisted ai_thinking status
            try {
              const finalGame = await storage.getGame(gameId);
              if (finalGame && finalGame.status === 'ai_thinking') {
                const restoredGame = await storage.updateGame(gameId, { status: 'active' });
                realtime.broadcastGameUpdate(restoredGame);
              }
            } catch (clearError) {
              console.error('Failed to clear ai_thinking status:', clearError);
            }
          }
        }, 500 + Math.random() * 1500);

        return res.json(pendingGame);
      }
      
      res.json(game);
    } catch (error: any) {
      console.error("Error making move:", error);
      res.status(400).json({ message: error.message || "Failed to make move" });
    }
  });

  app.post('/api/games/:id/resign', async (req: any, res) => {
    try {
      const gameId = String(req.params.id);
      const userId = req.session?.userId;
      
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      
      const game = await storage.resignGame(gameId, userId);
      realtime.broadcastGameUpdate(game);
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

      if (authResult?.userId) {
        userId = authResult.userId;
        console.log(`✓ Using userId from Zoho auth: ${userId}`);
      } else if (authResult?.success && authResult?.isNew && authResult?.userInfo) {
        const { email, firstName, lastName } = authResult.userInfo;
        (req.session as any).pendingZohoProfile = { email, firstName, lastName };
        
        // CRITICAL: Await session save completion before redirecting
        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) {
              console.error('❌ Session save error for pending onboarding:', err);
              reject(err);
            } else {
              console.log('✓ Session saved successfully for pending onboarding');
              resolve();
            }
          });
        });
        
        return res.redirect('/onboarding');
      } else {
        console.error('❌ Zoho auth returned no existing user and no pending user info');
        return res.redirect('/?error=auth_failed');
      }

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

  return httpServer;
}
