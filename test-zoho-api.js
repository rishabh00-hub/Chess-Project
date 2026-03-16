import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';
import SecureStorage from './ChessMaster/server/secureStorage.js';

// 1. Load Environment Variables
dotenv.config({ path: path.resolve(process.cwd(), 'ChessMaster/.env') });

async function testConnection() {
  console.log("⏳ 1. Getting Access Token...");

  try {
    // 2. Load Refresh Token exactly like the main app does
    const secureStorage = new SecureStorage(
      process.env.SECURE_STORAGE_KEY || 'default-key',
      path.resolve(process.cwd(), 'ChessMaster/.secure-storage')
    );

    const refreshToken = secureStorage.load('zoho_refresh_token');

    if (!refreshToken) {
      console.log("❌ Error: No refresh token found in .secure-storage.");
      console.log("Please run your main app and login once so it saves the token.");
      return;
    }

    // 3. Get New Access Token from Zoho
    const tokenUrl = `https://accounts.zoho.in/oauth/v2/token?refresh_token=${refreshToken}&client_id=${process.env.ZOHO_CLIENT_ID}&client_secret=${process.env.ZOHO_CLIENT_SECRET}&grant_type=refresh_token`;

    const tokenRes = await fetch(tokenUrl, { method: 'POST' });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.log("❌ Failed to get token:", tokenData);
      return;
    }

    const accessToken = tokenData.access_token;
    console.log("✅ Token received! Testing App Connection now...");

    // 4. Test API Connection (Testing the exact v2.1 Development URL)
    const owner = process.env.ZOHO_OWNER_NAME;
    const app = process.env.ZOHO_APP_NAME;
    const report = process.env.ZOHO_USER_REPORT_NAME;

    const testUrl = `https://www.zohoapis.in/creator/v2.1/data/${owner}/${app}/report/${report}`;

    console.log(`📡 Hitting URL: ${testUrl}`);

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'environment': 'development'
      }
    });

    const status = response.status;
    const rawText = await response.text();

    console.log("\n======================================");
    console.log(`👉 ZOHO STATUS CODE: ${status}`);
    console.log("👉 ZOHO RAW RESPONSE:");
    console.log(rawText);
    console.log("======================================\n");
  } catch (error) {
    console.log("🚨 TEST FAILED FATALLY:", error.message);
  }
}

testConnection();
