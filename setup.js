// setup.js
// Simple final authorization script which calls loginOrRegister on zoho-api-service

require('dotenv').config(); // load .env if present

(async () => {
  const authCode = process.argv[2];
  if (!authCode) {
    console.error('Usage: node setup.js [AUTH_CODE]');
    process.exit(2);
  }

  try {
    const svcModule = await import('./ChessMaster/server/zoho-api-service.js');
    const svc = svcModule.default || svcModule;
    console.log('Starting initial token exchange...');
    const res = await svc.loginOrRegister(authCode);
    console.log('Success:', res);
    console.log('If successful, the refresh token is stored securely by SecureStorage.');
  } catch (err) {
    console.error('Failed to complete token exchange:', err && err.message ? err.message : err);
    process.exitCode = 1;
  }
})();
