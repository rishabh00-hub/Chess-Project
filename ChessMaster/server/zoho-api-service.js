// zoho-api-service.js
import { SQLiteBaseIntegerBuilder } from 'drizzle-orm/sqlite-core';
import SecureStorage from './secureStorage.js';
import fs from 'fs';
import nodeFetch from 'node-fetch';

// === FAIL-FAST VALIDATION: Ensure all critical Zoho environment variables are set ===
// These must be configured in .env — no fallbacks allowed
if (!process.env.ZOHO_OWNER_NAME || !process.env.ZOHO_APP_NAME || 
    !process.env.ZOHO_USER_FORM_NAME || !process.env.ZOHO_USER_REPORT_NAME ||
    !process.env.ZOHO_GAME_FORM_NAME || !process.env.ZOHO_GAME_REPORT_NAME ||
    !process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET) {
  console.error('CRITICAL ERROR: Missing required Zoho environment variables!');
  console.error('Please ensure the following are configured in your .env file:');
  console.error('  - ZOHO_CLIENT_ID');
  console.error('  - ZOHO_CLIENT_SECRET');
  console.error('  - ZOHO_REDIRECT_URI');
  console.error('  - ZOHO_OWNER_NAME');
  console.error('  - ZOHO_APP_NAME');
  console.error('  - ZOHO_USER_FORM_NAME');
  console.error('  - ZOHO_USER_REPORT_NAME');
  console.error('  - ZOHO_GAME_FORM_NAME');
  console.error('  - ZOHO_GAME_REPORT_NAME');
  throw new Error('Zoho API: Missing or incomplete environment variables. Please check your .env file.');
}

// Initialize secure storage (these are optional, use defaults if not set)
const secureStorage = new SecureStorage(
  process.env.SECURE_STORAGE_KEY || 'default-key',
  process.env.SECURE_STORAGE_PATH || './.secure-storage'
);

// === ZOHO CREATOR API KEYS (Read from environment variables - STRICTLY) ===
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REDIRECT_URI = process.env.ZOHO_REDIRECT_URI;

// === ZOHO CREATOR API ENDPOINTS (India DC) ===
// Build dynamic base URL using environment variables (STRICTLY)
const ZOHO_OWNER_NAME = process.env.ZOHO_OWNER_NAME;
const ZOHO_APP_NAME = process.env.ZOHO_APP_NAME;
const ZOHO_BASE_URL = 'https://www.zohoapis.in/creator/v2.1';

// OAuth token endpoint (India DC)
const ZOHO_OAUTH_TOKEN_URL = "https://accounts.zoho.in/oauth/v2/token";

// Form and Report names from environment variables (must match exactly their Link Names in Zoho Creator)
// These are REQUIRED — no defaults/fallbacks allowed
const ZOHO_USER_FORM_NAME = process.env.ZOHO_USER_FORM_NAME;
const ZOHO_USER_REPORT_NAME = process.env.ZOHO_USER_REPORT_NAME;
const ZOHO_GAME_FORM_NAME = process.env.ZOHO_GAME_FORM_NAME;
const ZOHO_GAME_REPORT_NAME = process.env.ZOHO_GAME_REPORT_NAME;

// === Placeholder for OAuth2 Token Management ===
let accessToken = null;

const fetch = global.fetch || nodeFetch;

function buildFormUrlEncoded(obj) {
  return Object.keys(obj)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]))
    .join('&');
}

// Exchange authorization code for access + refresh tokens (run once)
async function initialTokenExchange(authCode, customRedirectUri) {
  if (!authCode) throw new Error('authCode is required');

  const body = buildFormUrlEncoded({
    code: authCode,
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: customRedirectUri || ZOHO_REDIRECT_URI,
  });

  const res = await fetch(ZOHO_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`initialTokenExchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  accessToken = data.access_token;
  const refreshToken = data.refresh_token;
  if (refreshToken) {
    // Persist refresh token securely
    secureStorage.save('zoho_refresh_token', refreshToken);
  }

  return data;
}

// Refresh access token using stored refresh token
async function refreshAccessToken() {
  const refreshToken = secureStorage.load('zoho_refresh_token');
  if (!refreshToken) throw new Error('No refresh token found; re-authorization required');

  const body = buildFormUrlEncoded({
    refresh_token: refreshToken,
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });

  const res = await fetch(ZOHO_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`refreshAccessToken failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  accessToken = data.access_token;
  return data;
}

// Fetch authenticated user's info from Zoho OAuth endpoint
async function fetchZohoUserInfo() {
  if (!accessToken) {
    throw new Error('No access token available for user info fetch');
  }

  const userInfoUrl = 'https://accounts.zoho.in/oauth/user/info';
  const headers = {
    'Authorization': `Zoho-oauthtoken ${accessToken}`,
  };

  const res = await fetch(userInfoUrl, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch Zoho user info (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data; // Returns object with first_name, last_name, email, etc.
}

// Generic helper to ensure we have a valid access token.
// This aligns with the exported ensureAuthenticated() method.
async function ensureAuthenticated() {
  if (accessToken) return true;
  try {
    await refreshAccessToken();
    return !!accessToken;
  } catch (error) {
    return false;
  }
}

// Generic request helper that retries once on 401
async function makeZohoApiRequest(urlPath, method = 'GET', body = null) {
  await ensureAuthenticated();

  const owner = process.env.ZOHO_OWNER_NAME;
  const app = process.env.ZOHO_APP_NAME;

  // Clean the path to prevent double slashes
  const cleanPath = urlPath.startsWith('/') ? urlPath.substring(1) : urlPath;

  // 100% CORRECT URL for Zoho India DC API v2.1
  const url = `https://www.zohoapis.in/creator/v2.1/data/${owner}/${app}/${cleanPath}`;

  const options = {
    method,
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  console.log(`🚀 Sending ${method} request to: ${url}`);
  let res = await nodeFetch(url, options);

  if (res.status === 401) {
    // Try refreshing token and retry once
    await refreshAccessToken();
    options.headers['Authorization'] = `Zoho-oauthtoken ${accessToken}`;
    res = await nodeFetch(url, options);
    if (res.status === 401) {
      const text = await res.text();
      throw new Error(`Unauthorized after retry: ${text}`);
    }
  }

  // Fail fast if Zoho returned an error status other than 401
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Zoho API request failed (${res.status}): ${errText}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return res.text();
}

// Helper to build form endpoint URLs for POST/PATCH operations (writing)
function buildFormURL(formName, systemRecordId = null) {
  return systemRecordId ? `/form/${formName}/${systemRecordId}` : `/form/${formName}`;
}

// Helper to build report endpoint URLs for GET operations (reading)
// STRICT FIX: Do not double-encode the criteria string here.
function buildReportURL(reportName, criteria = null) {
  return criteria ? `/report/${reportName}?criteria=${criteria}` : `/report/${reportName}`;
}

// Try to initialize accessToken on module load using stored refresh token.
// This runs in the background and will not block module consumers.
/*
  Attempt to initialize accessToken on module load using stored refresh token.
  Make the diagnostic clearer if credentials are missing or are left as placeholders.
*/
(async () => {
  try {
    const isPlaceholder = (v) => !v || /your[_-]?client|your[_-]?secret|replace/i.test(v);

    if (isPlaceholder(ZOHO_CLIENT_ID) || isPlaceholder(ZOHO_CLIENT_SECRET)) {
      console.warn('Zoho credentials are not properly configured.');
      console.warn('Please set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET in your .env (do NOT commit them).');
      console.warn('Current values (masked):', {
        ZOHO_CLIENT_ID: ZOHO_CLIENT_ID ? ZOHO_CLIENT_ID.slice(0,6) + '...' : '<missing>',
        ZOHO_CLIENT_SECRET: ZOHO_CLIENT_SECRET ? ZOHO_CLIENT_SECRET.slice(0,6) + '...' : '<missing>'
      });
      // Do not attempt token refresh if credentials are placeholders/missing
      return;
    }

    await refreshAccessToken();
    console.info('Zoho access token initialized from stored refresh token.');
  } catch (err) {
    // Do not throw on startup — application should still boot; log for visibility
    console.warn('Zoho token refresh on startup failed:', err && err.message ? err.message : err);
  }
})();

// === API Functions ===

const exported = {
  isAuthenticated() {
    return !!accessToken;
  },

  async ensureAuthenticated() {
    if (accessToken) return true;
    try {
      await refreshAccessToken();
      return !!accessToken;
    } catch (error) {
      return false;
    }
  },

  async loginOrRegister(authCode, customRedirectUri) {
    await initialTokenExchange(authCode, customRedirectUri);
    try {
      const userInfo = await fetchZohoUserInfo();
      const firstName = userInfo.First_Name || userInfo.first_name || 'Player';
      const lastName = userInfo.Last_Name || userInfo.last_name || 'Chess';
      const email = userInfo.Email || userInfo.email || `player_${Date.now()}@chessmaster.app`;

      // 1. Search for existing user by email
      const criteria = `(email=="${email}")`;
      const path = buildReportURL(process.env.ZOHO_USER_REPORT_NAME, criteria);
      
      let result = null;
      try {
        result = await makeZohoApiRequest(path, 'GET');
      } catch (err) {
        if (err.message && (err.message.includes('No Data') || err.message.includes('3000'))) {
          console.log("Confirmed: No user found with this email. Proceeding to create...");
        } else {
          console.error("Critical API Error during user search:", err.message);
          throw new Error("System configuration or API error. Login halted.");
        }
      }

      // 2. Return existing user ID if found
      if (result && result.data && result.data.length > 0) {
        return { success: true, userId: result.data[0].ID }; 
      }

      // 3. Create new user with Zoho Creator form
      const createPath = buildFormURL(process.env.ZOHO_USER_FORM_NAME);
      const newUserData = {
        data: {
          username: `${firstName}_${Math.floor(Math.random() * 1000)}`,
          email: email,
          full_name: { first_name: firstName, last_name: lastName },
          country1: 'Unknown',
          chess_rating: 1200,
          total_games_played: 0,
          total_wins: 0,
          total_losses: 0,
          total_draws: 0
        }
      };

      const createResult = await makeZohoApiRequest(createPath, 'POST', newUserData);
      const newId = createResult?.data?.[0]?.ID;
      
      if (!newId) {
        console.error('ERROR: Zoho did not return ID on user creation', createResult);
        throw new Error('Failed to get user ID from Zoho');
      }
      
      return { success: true, userId: newId };
    } catch (error) {
      console.error('Login Error:', error);
      return { success: false, userId: null };
    }
  },

  async createUserProfile(profileData) {
    const path = buildFormURL(process.env.ZOHO_USER_FORM_NAME);
    const mappedData = {
      username: profileData.username || `Player_${Math.floor(Math.random() * 1000)}`,
      email: profileData.email || 'unknown@chessmaster.app',
      full_name: {
        first_name: profileData.firstName || profileData.first_name || 'Player',
        last_name: profileData.lastName || profileData.last_name || 'Chess'
      },
      country1: profileData.country1 || 'Unknown',
      chess_rating: profileData.elo ?? profileData.chess_rating ?? 1200,
      total_games_played: profileData.gamesPlayed ?? profileData.total_games_played ?? 0,
      total_wins: profileData.wins ?? profileData.total_wins ?? 0,
      total_losses: profileData.losses ?? profileData.total_losses ?? 0,
      total_draws: profileData.draws ?? profileData.total_draws ?? 0
    };
    return await makeZohoApiRequest(path, 'POST', { data: mappedData });
  },

  async getUserProfile(userId) {
    if (!userId) return null;
    try {
      // Use Zoho system ID for lookup
      const criteria = `(ID=="${userId}")`;
      const path = buildReportURL(process.env.ZOHO_USER_REPORT_NAME, criteria);
      const result = await makeZohoApiRequest(path, 'GET');
      return result?.data?.[0] || null;
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);
      return null;
    }
  },

  async getUserByUsername(username) {
    if (!username) return null;
    const criteria = `(username=="${username}")`;
    const path = buildReportURL(process.env.ZOHO_USER_REPORT_NAME, criteria);
    try {
      const result = await makeZohoApiRequest(path, 'GET');
      return result?.data?.[0] || null;
    } catch (error) {
      return null;
    }
  },

  async updateUserProfile(systemRecordId, profileData) {
    if (!systemRecordId) throw new Error("System Record ID is required for PATCH");
    const path = buildFormURL(process.env.ZOHO_USER_FORM_NAME, systemRecordId);
    return await makeZohoApiRequest(path, 'PATCH', { data: profileData });
  },

  async getRecentGames(userId) {
    if (!userId) return [];
    // Query games where user is white or black player using Zoho system ID
    const criteria = `(white_player=="${userId}" || black_player=="${userId}")`;
    const path = buildReportURL(process.env.ZOHO_GAME_REPORT_NAME, criteria);
    try {
      const result = await makeZohoApiRequest(path, 'GET');
      return result?.data || [];
    } catch (error) {
      console.error("Error fetching recent games:", error);
      return [];
    }
  },

    async createGameRecord(gameData) {
      const path = buildFormURL(process.env.ZOHO_GAME_FORM_NAME);
      const mappedGameData = {
        white_player: String(gameData.whitePlayerId || ''),
        black_player: String(gameData.blackPlayerId || ''),
        match_date: new Date().toISOString().replace('T', ' ').substring(0, 19),
        match_result: String(gameData.status || 'active'),
        opening_used: String(gameData.openingUsed || ''),
        moves_played: String(gameData.moves?.join(',') || ''),
        time_control: String(gameData.timeControl || ''),
        rating_change_white_player: String(gameData.ratingChangeWhite || '0'),
        rating_change_black_player: String(gameData.ratingChangeBlack || '0'),
        winner1: String(gameData.winnerId || ''),
        game_status1: String(gameData.status || 'active'),
        current_fen1: String(gameData.currentPosition || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
      };
      
      return await makeZohoApiRequest(path, 'POST', { data: mappedGameData });
    },

  async getGame(gameId) {
    if (!gameId) return null;
    try {
      // Query game record by system ID using the report endpoint
      const criteria = `(ID=="${gameId}")`;
      const path = buildReportURL(process.env.ZOHO_GAME_REPORT_NAME, criteria);
      const result = await makeZohoApiRequest(path, 'GET');
      return result?.data?.[0] || null;
    } catch (error) {
      console.error(`Error fetching game ${gameId}:`, error);
      return null;
    }
  },

  async updateGameRecord(gameId, updates) {
    if (!gameId) throw new Error('gameId is required for PATCH');
    try {
      const path = buildFormURL(process.env.ZOHO_GAME_FORM_NAME, gameId);
      return await makeZohoApiRequest(path, 'PATCH', { data: updates });
    } catch (error) {
      console.error(`Error updating game ${gameId}:`, error);
      throw error;
    }
  },

  async getLeaderboard() {
    try {
      const path = buildReportURL(process.env.ZOHO_USER_REPORT_NAME);
      const result = await makeZohoApiRequest(path, 'GET');
      return result?.data || [];
    } catch (error) {
      return [];
    }
  },

  logout() {
    accessToken = null;
    return true;
  }
};

export default exported;
