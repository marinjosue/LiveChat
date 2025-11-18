/**
 * Script para generar clave maestra de encriptación
 * Ejecutar con: node server/scripts/generateEncryptionKey.js
 */

const crypto = require('crypto');

console.log('=== GENERADOR DE CLAVE MAESTRA DE ENCRIPTACIÓN ===\n');

// Generar clave de 256 bits (32 bytes)
const key = crypto.randomBytes(32);
const keyHex = key.toString('hex');

console.log('Clave maestra generada (256 bits):');
console.log(keyHex);

console.log('\nIMPORTANTE:');
console.log('1. Guarda esta clave en un lugar seguro');
console.log('2. Agrega esta clave a tu archivo .env:');
console.log(`   ENCRYPTION_MASTER_KEY=${keyHex}`);
console.log('3. NUNCA compartas esta clave ni la subas a control de versiones');
console.log('4. Si pierdes esta clave, NO podrás desencriptar los mensajes');
console.log('5. Usa diferentes claves para desarrollo y producción\n');

// Generar también clave para integridad
const integrityKey = crypto.randomBytes(32).toString('hex');
console.log('Clave para verificación de integridad:');
console.log(integrityKey);
console.log('\nAgrega también a tu .env:');
console.log(`INTEGRITY_KEY=${integrityKey}\n`);

// Generar JWT secret
const jwtSecret = crypto.randomBytes(64).toString('hex');
console.log('JWT Secret:');
console.log(jwtSecret);
console.log('\nAgrega también a tu .env:');
console.log(`JWT_SECRET=${jwtSecret}\n`);
