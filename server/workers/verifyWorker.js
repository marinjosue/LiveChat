const { parentPort, workerData } = require('worker_threads');
const bcrypt = require('bcrypt');

/**
 * Worker dedicado para verificación de contraseñas
 * Ejecuta la comparación en un thread separado
 */

async function verifyPassword(password, hash) {
  try {
    const isMatch = await bcrypt.compare(password, hash);
    return { success: true, isMatch };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Ejecutar la verificación
verifyPassword(workerData.password, workerData.hash)
  .then(result => {
    parentPort.postMessage(result);
  })
  .catch(error => {
    parentPort.postMessage({ success: false, error: error.message });
  });
