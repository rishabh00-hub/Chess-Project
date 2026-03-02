// zoho-api-service.js
import SecureStorage from './secureStorage.js';
import fs from 'fs';
import nodeFetch from 'node-fetch';

// Initialize secure storage
const secureStorage = new SecureStorage(
  process.env.SECURE_STORAGE_KEY || 'default-key',
  process.env.SECURE_STORAGE_PATH || './.secure-storage'
);

// === ZOHO CREATOR API KEYS (Read from environment variables) ===
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_REDIRECT_URI = process.env.ZOHO_REDIRECT_URI || "http://127.0.0.1:8000";

// === ZOHO CREATOR API ENDPOINTS (India DC) ===
const ZOHO_BASE_URL = "https://creator.zoho.in/api/v2/Chess%20Database/form";

// OAuth token endpoint (India DC)
const ZOHO_OAUTH_TOKEN_URL = "https://accounts.zoho.in/oauth/v2/token";

// Form names
const FORM_USER = "User_Profiles";
const FORM_GAME = "Match_History";

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

// Generic request helper that retries once on 401
async function makeZohoApiRequest(urlPath, method = 'GET', data = null) {
  if (!accessToken) {
    await refreshAccessToken().catch(err => {
      // Propagate error to caller
      throw err;
    });
  }

  const url = ZOHO_BASE_URL + urlPath;
  const headers = {
    'Authorization': `Zoho-oauthtoken ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const opts = {
    method,
    headers,
  };
  if (data) opts.body = JSON.stringify(data);

  let res = await fetch(url, opts);

  if (res.status === 401) {
    // Try refreshing token and retry once
    await refreshAccessToken();
    opts.headers['Authorization'] = `Zoho-oauthtoken ${accessToken}`;
    res = await fetch(url, opts);
    if (res.status === 401) {
      const text = await res.text();
      throw new Error(`Unauthorized after retry: ${text}`);
    }
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return res.text();
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
  // Check if we have a valid access token
  isAuthenticated() {
    return !!accessToken;
  },

  // Add this function to the exported object
  async ensureAuthenticated() {
    // 1. If already in memory, good to go
    if (accessToken) return true;
         
    // 2. If not, try to load from secure storage
    console.log("⚠️ Token missing in memory, attempting to reload...");
    try {
      await refreshAccessToken(); // This loads from file and refreshes
      return !!accessToken;
    } catch (error) {
      console.error("Auto-refresh failed:", error.message);
      return false;
    }
  },

  // User Registration/Login
  // authCode is the authorization code returned by Zoho OAuth flow
  async loginOrRegister(authCode, customRedirectUri) {
    // Perform initial token exchange and persist refresh token
    await initialTokenExchange(authCode, customRedirectUri);
    return { success: true };
  },

  // Get user profile from Zoho (returns first record from array)
  async getUserProfile(userId) {
    try {
      const path = `/User_Profiles/records/${encodeURIComponent(userId)}`;
      const result = await makeZohoApiRequest(path, 'GET');
      // Zoho returns an array; get the first item
      return result?.data?.[0] || null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  },

  // Get user by username
  async getUserByUsername(username) {
    try {
      const path = `/User_Profiles/records?criteria=(Username=="${encodeURIComponent(username)}")`;
      const result = await makeZohoApiRequest(path, 'GET');
      // Zoho returns an array; get the first item
      return result?.data?.[0] || null;
    } catch (error) {
      console.error('Error fetching user by username:', error);
      return null;
    }
  },

  // Get user by Zoho ID
  async getUserByZohoId(zohoId) {
    try {
      const path = `/User_Profiles/records/${encodeURIComponent(zohoId)}`;
      const result = await makeZohoApiRequest(path, 'GET');
      // Zoho returns an array; get the first item
      return result?.data?.[0] || null;
    } catch (error) {
      console.error('Error fetching user by Zoho ID:', error);
      return null;
    }
  },

  // Update User Profile Data (Elo, Wins, Losses, Draws)
  async updateUserProfile(userId, profileData) {
    // PATCH to User_Profiles/records/<recordId>
    const path = `/User_Profiles/records/${encodeURIComponent(userId)}`;
    // Zoho Creator API expects a specific payload shape: data: { <field>: value }
    const payload = { data: profileData };
    const result = await makeZohoApiRequest(path, 'PATCH', payload);
    return result;
  },

  // Create a new user profile (registration)
  async createUserProfile(profileData) {
    const path = `/User_Profiles/records`;
    const payload = { data: profileData };
    const result = await makeZohoApiRequest(path, 'POST', payload);
    return result;
  },

  // Create Game Record (CREATE operation)
  async createGameRecord(gameData) {
    const path = `/Match_History/records`;
    const payload = { data: gameData };
    const result = await makeZohoApiRequest(path, 'POST', payload);
    return result?.data?.[0] || result;
  },

  // Update Game Record (UPDATE operation)
  async updateGameRecord(gameId, gameData) {
    const path = `/Match_History/records/${encodeURIComponent(gameId)}`;
    const payload = { data: gameData };
    const result = await makeZohoApiRequest(path, 'PATCH', payload);
    return result?.data?.[0] || result;
  },

  // Get a specific game record
  async getGame(gameId) {
    try {
      const path = `/Match_History/records/${encodeURIComponent(gameId)}`;
      const result = await makeZohoApiRequest(path, 'GET');
      // Zoho returns an array; get the first item
      return result?.data?.[0] || null;
    } catch (error) {
      console.error('Error fetching game:', error);
      return null;
    }
  },

  // Get recent games for a user
  async getRecentGames(userId) {
    try {
      const path = `/Match_History/records?criteria=(White_Player=="${encodeURIComponent(userId)}" OR Black_Player=="${encodeURIComponent(userId)}")&sort_field=Date_Created&sort_order=desc`;
      const result = await makeZohoApiRequest(path, 'GET');
      // Zoho returns an array of records
      return result?.data || [];
    } catch (error) {
      console.error('Error fetching recent games:', error);
      return [];
    }
  },

  // Get leaderboard (all users sorted by Elo)
  async getLeaderboard() {
    try {
      const path = `/User_Profiles/records?sort_field=Elo&sort_order=desc`;
      const result = await makeZohoApiRequest(path, 'GET');
      // Zoho returns an array of user records
      return result?.data || [];
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }
  },

  // Fetch User Rank (optional, for leaderboard)
  async getRank(userId) {
    const path = `/User_Profiles/records/${encodeURIComponent(userId)}`;
    const record = await makeZohoApiRequest(path, 'GET');
    // Example: assume the record contains a 'rank' field
    return { success: true, rank: record.data?.rank ?? null, userId };
  },

  // Real logout implementation
  logout() {
    accessToken = null;
    try {
      secureStorage.clear('zoho_refresh_token');
      // Also try to delete the file directly for safety
      const tokenPath = process.env.SECURE_STORAGE_PATH || './.secure-storage/zoho_refresh_token.json';
      if (fs.existsSync(tokenPath)) {
        fs.unlinkSync(tokenPath);
      }
    } catch (err) {
      console.warn('Failed to clear Zoho refresh token:', err);
    }
    return true;
  }
};

export default exported;
