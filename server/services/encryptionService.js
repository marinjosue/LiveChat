const crypto = require('crypto');

/**
 * Servicio de encriptación para mensajes
 * Implementa AES-256-GCM para encriptación autenticada
 */
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64;

class EncryptionService {
  constructor() {
    // Clave maestra (debe estar en variables de entorno en producción)
    this.masterKey = this._getMasterKey();
  }

  /**
   * Obtiene o genera la clave maestra
   */
  _getMasterKey() {
    const envKey = process.env.ENCRYPTION_MASTER_KEY;
    
    if (envKey) {
      return Buffer.from(envKey, 'hex');
    }
    // Generar clave aleatoria (solo para desarrollo)
    console.warn('[ENCRYPTION] Using generated master key. Set ENCRYPTION_MASTER_KEY in production!');
    return crypto.randomBytes(KEY_LENGTH);
  }
  /**
   * Deriva una clave de encriptación usando PBKDF2
   */
  _deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha512');
  }

  /**
   * Encripta un mensaje usando AES-256-GCM
   */
  encryptMessage(plaintext, additionalData = null) {
    try {
      // Generar IV aleatorio
      const iv = crypto.randomBytes(IV_LENGTH);
      
      // Generar salt
      const salt = crypto.randomBytes(SALT_LENGTH);
      
      // Derivar clave de encriptación
      const key = this._deriveKey(this.masterKey, salt);
      
      // Crear cipher
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      
      // Agregar datos adicionales autenticados (AAD)
      if (additionalData) {
        cipher.setAAD(Buffer.from(JSON.stringify(additionalData), 'utf8'));
      }
      
      // Encriptar
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Obtener tag de autenticación
      const authTag = cipher.getAuthTag();
      
      // Combinar todo en un formato estructurado
      const result = {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        salt: salt.toString('hex'),
        algorithm: ALGORITHM
      };
      
      return {
        success: true,
        data: result,
        ciphertext: Buffer.concat([
          salt,
          iv,
          authTag,
          Buffer.from(encrypted, 'hex')
        ]).toString('base64')
      };
      
    } catch (error) {
      console.error('[ENCRYPTION] Error encrypting message:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Desencripta un mensaje
   */
  decryptMessage(ciphertext, additionalData = null) {
    try {
      // Decodificar base64
      const buffer = Buffer.from(ciphertext, 'base64');
      
      // Extraer componentes
      const salt = buffer.slice(0, SALT_LENGTH);
      const iv = buffer.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
      const authTag = buffer.slice(
        SALT_LENGTH + IV_LENGTH,
        SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
      );
      const encrypted = buffer.slice(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
      
      // Derivar clave
      const key = this._deriveKey(this.masterKey, salt);
      
      // Crear decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      // Agregar datos adicionales autenticados
      if (additionalData) {
        decipher.setAAD(Buffer.from(JSON.stringify(additionalData), 'utf8'));
      }
      
      // Desencriptar
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');
      
      return {
        success: true,
        plaintext: decrypted
      };
      
    } catch (error) {
      console.error('[ENCRYPTION] Error decrypting message:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Encripta un objeto JSON
   */
  encryptJSON(obj, additionalData = null) {
    const jsonString = JSON.stringify(obj);
    return this.encryptMessage(jsonString, additionalData);
  }

  /**
   * Desencripta un objeto JSON
   */
  decryptJSON(ciphertext, additionalData = null) {
    const result = this.decryptMessage(ciphertext, additionalData);
    
    if (!result.success) {
      return result;
    }
    
    try {
      return {
        success: true,
        data: JSON.parse(result.plaintext)
      };
    } catch (error) {
      return {
        success: false,
        error: 'Invalid JSON after decryption'
      };
    }
  }

  /**
   * Genera un hash criptográfico
   */
  hash(data, algorithm = 'sha256') {
    return crypto
      .createHash(algorithm)
      .update(data)
      .digest('hex');
  }

  /**
   * Genera un HMAC
   */
  hmac(data, secret = null) {
    const key = secret || this.masterKey;
    return crypto
      .createHmac('sha256', key)
      .update(data)
      .digest('hex');
  }

  /**
   * Genera un token aleatorio seguro
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Genera un UUID v4
   */
  generateUUID() {
    return crypto.randomUUID();
  }

  /**
   * Compara dos valores de forma segura contra timing attacks
   */
  secureCompare(a, b) {
    try {
      const bufA = Buffer.from(a);
      const bufB = Buffer.from(b);
      
      if (bufA.length !== bufB.length) {
        return false;
      }
      
      return crypto.timingSafeEqual(bufA, bufB);
    } catch (error) {
      return false;
    }
  }

  /**
   * Encripta datos de archivo
   */
  encryptFile(fileBuffer, metadata = {}) {
    try {
      // Generar IV y salt
      const iv = crypto.randomBytes(IV_LENGTH);
      const salt = crypto.randomBytes(SALT_LENGTH);
      
      // Derivar clave
      const key = this._deriveKey(this.masterKey, salt);
      
      // Crear cipher
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      
      // Agregar metadata como AAD
      if (metadata) {
        cipher.setAAD(Buffer.from(JSON.stringify(metadata), 'utf8'));
      }
      
      // Encriptar
      const encrypted = Buffer.concat([
        cipher.update(fileBuffer),
        cipher.final()
      ]);
      
      // Obtener tag de autenticación
      const authTag = cipher.getAuthTag();
      
      // Combinar todo
      const result = Buffer.concat([salt, iv, authTag, encrypted]);
      
      return {
        success: true,
        encrypted: result,
        base64: result.toString('base64'),
        size: result.length,
        metadata
      };
      
    } catch (error) {
      console.error('[ENCRYPTION] Error encrypting file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Desencripta datos de archivo
   */
  decryptFile(encryptedBuffer, metadata = {}) {
    try {
      // Extraer componentes
      const salt = encryptedBuffer.slice(0, SALT_LENGTH);
      const iv = encryptedBuffer.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
      const authTag = encryptedBuffer.slice(
        SALT_LENGTH + IV_LENGTH,
        SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
      );
      const encrypted = encryptedBuffer.slice(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
      
      // Derivar clave
      const key = this._deriveKey(this.masterKey, salt);
      
      // Crear decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      // Agregar metadata como AAD
      if (metadata) {
        decipher.setAAD(Buffer.from(JSON.stringify(metadata), 'utf8'));
      }
      
      // Desencriptar
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      return {
        success: true,
        decrypted,
        size: decrypted.length
      };
      
    } catch (error) {
      console.error('[ENCRYPTION] Error decrypting file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Singleton
const encryptionService = new EncryptionService();

module.exports = { EncryptionService, encryptionService };
