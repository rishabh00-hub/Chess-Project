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
async function initialTokenExchange(authCode, customRedirectUri, persistRefreshToken = false) {
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
  if (persistRefreshToken) {
    if (!refreshToken) {
      throw new Error(
        'Zoho token response did not include refresh_token. Re-authorize with access_type=offline and prompt=consent, then retry /api/zoho/init.'
      );
    }

    // Persist refresh token securely and verify read-back immediately.
    secureStorage.save('zoho_refresh_token', refreshToken);
    const storedToken = secureStorage.load('zoho_refresh_token');
    if (!storedToken || storedToken !== refreshToken) {
      throw new Error('Refresh token persistence check failed. Secure storage write/read did not match.');
    }
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
  console.log("ZOHO RAW DATA:", JSON.stringify(data, null, 2));
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
    }
  };

  if (body) {
    options.headers['Content-Type'] = 'application/json';
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
  if (contentType.includes('application/json')) {
    const payload = await res.json();
    // Zoho frequently returns HTTP 200 with logical error codes (e.g., 3001).
    if (payload && typeof payload === 'object' && 'code' in payload && Number(payload.code) !== 3000) {
      const detail = Array.isArray(payload.error)
        ? payload.error.join(', ')
        : payload.message || JSON.stringify(payload);
      throw new Error(`Zoho API logical error (${payload.code}): ${detail}`);
    }
    return payload;
  }
  return res.text();
}

// Helper to build form endpoint URLs for POST/PATCH operations (writing)
function buildFormURL(formName, systemRecordId = null) {
  return systemRecordId ? `/form/${formName}/${systemRecordId}` : `/form/${formName}`;
}

// Helper to build report endpoint URLs for GET operations (reading)
function buildReportURL(reportName, criteria = null) {
  if (!criteria) {
    return `/report/${reportName}`;
  }

  // Zoho expects criteria as a query parameter value, so it must be URL-encoded.
  return `/report/${reportName}?criteria=${encodeURIComponent(criteria)}`;
}

function buildReportRecordURL(reportName, systemRecordId) {
  return `/report/${reportName}/${systemRecordId}`;
}

function escapeCriteriaValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildStringEqualsCriteria(fieldName, value) {
  return `(${fieldName}=="${escapeCriteriaValue(value)}")`;
}

function buildNumericIdCriteria(idValue) {
  const normalizedId = String(idValue).trim();
  // Zoho IDs can be 18+ digits and exceed JS safe integer range.
  // Keep them as digit strings to avoid precision loss in criteria.
  if (!/^\d+$/.test(normalizedId)) {
    throw new Error(`Invalid numeric ID for Zoho criteria: ${idValue}`);
  }
  return `(ID==${normalizedId})`;
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
    // IMPORTANT: Do NOT persist end-user refresh tokens from login flow.
    // Creator data APIs must run with the server's configured refresh token.
    await initialTokenExchange(authCode, customRedirectUri, false);
    try {
      const userInfo = await fetchZohoUserInfo();
      const firstName = userInfo.First_Name || userInfo.first_name || 'Player';
      const lastName = userInfo.Last_Name || userInfo.last_name || 'Chess';
      const rawEmail = userInfo.Email || userInfo.email;
      const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : rawEmail;

      // STRICT REQUIREMENT: No fake emails allowed
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        console.error('❌ CRITICAL: Zoho OAuth response missing valid email address');
        throw new Error('Unable to retrieve email from Zoho account. Please ensure your Zoho account has a valid email address configured.');
      }

      // Switch back to server-side Creator token before DB/report queries.
      try {
        await refreshAccessToken();
      } catch (tokenError) {
        console.error('Critical token context error before Creator DB query:', tokenError);
        throw new Error('Creator service token unavailable. Please initialize server refresh token first.');
      }

      // 1. Search for existing user by normalized email
      const criteria = buildStringEqualsCriteria('email', email);
      const path = buildReportURL(process.env.ZOHO_USER_REPORT_NAME, criteria);
      
      let result = null;
      try {
        result = await makeZohoApiRequest(path, 'GET');
      } catch (err) {
        const message = err?.message || '';
        if (
          message.includes('No Data') ||
          message.includes('No records found') ||
          message.includes('"code":9280')
        ) {
          console.log("Confirmed: No user found with this email.");
        } else {
          console.error("Critical API Error during user search:", message);
          throw new Error("System configuration or API error. Login halted.");
        }
      }

      // Fallback: in case email case/format mismatch bypasses criteria filtering, scan report data.
      if (!result || !result.data || result.data.length === 0) {
        try {
          const allUsersPath = buildReportURL(process.env.ZOHO_USER_REPORT_NAME);
          const allUsers = await makeZohoApiRequest(allUsersPath, 'GET');
          const existingByEmail = allUsers?.data?.find(
            (row) => typeof row?.email === 'string' && row.email.trim().toLowerCase() === email
          );
          if (existingByEmail) {
            return { success: true, isNew: false, userId: existingByEmail.ID || existingByEmail.id };
          }
        } catch (fallbackError) {
          console.warn('Existing-user fallback email scan failed:', fallbackError?.message || fallbackError);
        }
      }

      // 2. Return existing user ID if found
      if (result && result.data && result.data.length > 0) {
        return { success: true, isNew: false, userId: result.data[0].ID || result.data[0].id };
      }

      // 3. No existing user found: return pending onboarding profile data
      return {
        success: true,
        isNew: true,
        userInfo: {
          email,
          firstName,
          lastName,
        }
      };
    } catch (error) {
      console.error('Login Error:', error);
      return { success: false, userId: null };
    }
  },

  async initializeServerToken(authCode, customRedirectUri) {
    // Explicit admin/owner setup path: persist refresh token for Creator data access.
    return initialTokenExchange(authCode, customRedirectUri, true);
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
      const criteria = buildNumericIdCriteria(userId);
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
    const criteria = buildStringEqualsCriteria('username', username);
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
    const path = buildReportRecordURL(process.env.ZOHO_USER_REPORT_NAME, systemRecordId);
    return await makeZohoApiRequest(path, 'PATCH', { data: profileData });
  },

  async getRecentGames(userId) {
    if (!userId) return [];
    // Query games where user is white or black player using Zoho system ID
    const safeUserId = escapeCriteriaValue(userId);
    const criteria = `(white_player=="${safeUserId}" || black_player=="${safeUserId}")`;
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
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
      
      const statusMap = {
        'active': 'Ongoing',
        'waiting': 'Ongoing',
        'completed': 'Completed',
        'draw': 'Draw',
        'ai_thinking': 'Ongoing'
      };
      const resultMap = {
        'white_wins': 'Win',
        'black_wins': 'Win',
        'draw': 'Draw'
      };
      
      const mappedGameData = {
        white_player: gameData.whitePlayerId ? [String(gameData.whitePlayerId)] : [],
        black_player: gameData.blackPlayerId ? [String(gameData.blackPlayerId)] : [],
        match_date: formattedDate,
        match_result: resultMap[gameData.result] || '',
        opening_used: String(gameData.openingUsed || ''),
        moves_played: JSON.stringify(gameData.moves || []),
        time_control: String(gameData.timeControl || ''),
        rating_change_white_player: String(gameData.ratingChangeWhite || '0'),
        rating_change_black_player: String(gameData.ratingChangeBlack || '0'),
        winner1: String(gameData.winnerId || ''),
        game_status1: statusMap[gameData.status] || 'Active',
        current_fen1: String(gameData.currentPosition || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
        ai_thinking: gameData.status === 'ai_thinking' ? true : false
      };
      
      const result = await makeZohoApiRequest(path, 'POST', { data: mappedGameData });
      const createdId = result?.data?.ID || result?.data?.id || result?.data?.[0]?.ID || result?.data?.[0]?.id;
      if (!createdId) {
        const zohoError = result?.error?.join?.(', ') || result?.message || JSON.stringify(result);
        throw new Error(`Zoho game creation failed: ${zohoError}`);
      }

      return result;
    },

  async getGame(gameId) {
    if (!gameId) return null;
    try {
      // Query game record by system ID using the report endpoint
      const criteria = buildNumericIdCriteria(gameId);
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
      const path = buildReportRecordURL(process.env.ZOHO_GAME_REPORT_NAME, gameId);
      const normalizedUpdates = { ...updates };
      if (normalizedUpdates.winner1 && typeof normalizedUpdates.winner1 === 'object') {
        normalizedUpdates.winner1 = normalizedUpdates.winner1.ID || normalizedUpdates.winner1.id || '';
      }
      return await makeZohoApiRequest(path, 'PATCH', { data: normalizedUpdates });
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

// Export utility functions
export { makeZohoApiRequest, buildReportURL };

export default exported;
