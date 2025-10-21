// zoho-api-service.js

// === ZOHO CREATOR API KEYS (Read from environment variables) ===
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
// For self-client (Android) we will use the app callback; token exchange will use the dummy redirect
const ZOHO_REDIRECT_URI = process.env.ZOHO_REDIRECT_URI || "http://127.0.0.1:8000";

// === ZOHO CREATOR API ENDPOINTS (India DC) ===
const ZOHO_BASE_URL = "https://creator.zoho.in/api/v2/Chess%20Database/form";

// OAuth token endpoint (India DC)
const ZOHO_OAUTH_TOKEN_URL = "https://accounts.zoho.in/oauth/v2/token";

// === Placeholder for OAuth2 Token Management ===
let accessToken = null;

const fetch = global.fetch || require('node-fetch');

function buildFormUrlEncoded(obj) {
  return Object.keys(obj)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]))
    .join('&');
}

// Exchange authorization code for access + refresh tokens (run once)
async function initialTokenExchange(authCode) {
  if (!authCode) throw new Error('authCode is required');

  const body = buildFormUrlEncoded({
    code: authCode,
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: ZOHO_REDIRECT_URI,
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
    await SecureStorage.set('zoho_refresh_token', refreshToken);
  }

  return data;
}

// Refresh access token using stored refresh token
async function refreshAccessToken() {
  const refreshToken = await SecureStorage.get('zoho_refresh_token');
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
(async () => {
  try {
    if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET) {
      console.warn('Zoho client id/secret not set in environment; skipping startup token refresh.');
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
  // User Registration/Login
  // authCode is the authorization code returned by Zoho OAuth flow
  async loginOrRegister(authCode) {
    // Perform initial token exchange and persist refresh token
    await initialTokenExchange(authCode);
    return { success: true };
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

  // Save Match Record (to 'Match_History' form)
  async saveMatchRecord(matchData) {
    const path = `/Match_History/records`;
    const payload = { data: matchData };
    const result = await makeZohoApiRequest(path, 'POST', payload);
    return result;
  },

  // Fetch User Rank (optional, for leaderboard)
  async getRank(userId) {
    const path = `/User_Profiles/records/${encodeURIComponent(userId)}`;
    const record = await makeZohoApiRequest(path, 'GET');
    // Example: assume the record contains a 'rank' field
    return { success: true, rank: record.data?.rank ?? null, userId };
  }
};

export default exported;
