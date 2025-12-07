const { parentPort, workerData } = require('worker_threads');
const bcrypt = require('bcrypt');

/**
 * Worker dedicado para hashing de contraseñas
 * Ejecuta el proceso intensivo de CPU en un thread separado
 */

const SALT_ROUNDS = 12;

async function hashPassword(password) {
  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return { success: true, hash };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Ejecutar el hashing
hashPassword(workerData.password)
  .then(result => {
    parentPort.postMessage(result);
  })
  .catch(error => {
    parentPort.postMessage({ success: false, error: error.message });
  });
