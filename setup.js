// setup.js
// Manual refresh token injection script

import 'dotenv/config.js';
import SecureStorage from './ChessMaster/server/secureStorage.js';

(async () => {
  try {
    // Initialize SecureStorage with the same configuration as the application
    const secureStorage = new SecureStorage(
      process.env.SECURE_STORAGE_KEY || 'default-key',
      process.env.SECURE_STORAGE_PATH || './.secure-storage'
    );

    // **PASTE YOUR REFRESH TOKEN HERE**
    const NEW_REFRESH_TOKEN = "1000.f474c1aaf5f900191b6b70c5f83b62b6.693a9a22e4be7842758afec7e56e2f44";

    // Validate token before saving
    if (NEW_REFRESH_TOKEN === "PASTE_YOUR_TOKEN_HERE") {
      console.error('❌ Error: Please replace "PASTE_YOUR_TOKEN_HERE" with your actual refresh token.');
      process.exit(1);
    }

    // Save the refresh token to SecureStorage
    secureStorage.save('zoho_refresh_token', NEW_REFRESH_TOKEN);

    console.log('✅ Refresh Token has been manually saved to SecureStorage.');
    console.log('🔐 Token is encrypted and stored in: ./.secure-storage/zoho_refresh_token.json');
  } catch (err) {
    console.error('❌ Failed to save refresh token:', err && err.message ? err.message : err);
    process.exitCode = 1;
  }
})();
