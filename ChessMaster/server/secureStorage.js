// secureStorage.js
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

class SecureStorage {
  constructor(storageKey, storagePath) {
    if (!storageKey) throw new Error('Storage key is required');
    this.key = crypto.scryptSync(storageKey, 'salt', 32);
    this.storagePath = storagePath || './.secure-storage';
    
    // Ensure storage directory exists
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  // Encrypt data before storing
  encrypt(data) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return { encrypted, iv, authTag };
  }

  // Decrypt stored data
  decrypt(encrypted, iv, authTag) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString());
  }

  // Save data to secure storage
  save(key, data) {
    const { encrypted, iv, authTag } = this.encrypt(data);
    const storageData = {
      data: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64')
    };
    fs.writeFileSync(
      path.join(this.storagePath, `${key}.json`),
      JSON.stringify(storageData)
    );
  }

  // Load data from secure storage
  load(key) {
    try {
      const filePath = path.join(this.storagePath, `${key}.json`);
      if (!fs.existsSync(filePath)) return null;
      
      const storageData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const encrypted = Buffer.from(storageData.data, 'base64');
      const iv = Buffer.from(storageData.iv, 'base64');
      const authTag = Buffer.from(storageData.authTag, 'base64');
      
      return this.decrypt(encrypted, iv, authTag);
    } catch (error) {
      console.error('Failed to load from secure storage:', error);
      return null;
    }
  }
}

export default SecureStorage;