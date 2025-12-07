const { parentPort, workerData } = require('worker_threads');
const crypto = require('crypto');

/**
 * Worker dedicado para verificación de integridad
 * Calcula hashes criptográficos en thread separado
 */

function calculateIntegrity(data) {
  try {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    
    // SHA-256 hash
    const sha256Hash = crypto
      .createHash('sha256')
      .update(dataString)
      .digest('hex');
    
    // SHA-512 hash (más seguro)
    const sha512Hash = crypto
      .createHash('sha512')
      .update(dataString)
      .digest('hex');
    
    // HMAC (para autenticación)
    const hmacKey = process.env.INTEGRITY_KEY || 'default-secret-key';
    const hmac = crypto
      .createHmac('sha256', hmacKey)
      .update(dataString)
      .digest('hex');
    
    return {
      success: true,
      sha256: sha256Hash,
      sha512: sha512Hash,
      hmac: hmac,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Ejecutar cálculo de integridad
const result = calculateIntegrity(workerData.data);
parentPort.postMessage(result);
