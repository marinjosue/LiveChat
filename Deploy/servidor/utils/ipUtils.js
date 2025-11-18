/**
 * Obtiene y limpia la dirección IP del cliente
 * @param {Object} socket - Socket de Socket.IO
 * @returns {string} Dirección IP limpia
 */
const getCleanIP = (socket) => {
  // Obtener IP de headers (si está detrás de un proxy)
  const forwardedFor = socket.handshake.headers['x-forwarded-for'];
  const realIP = socket.handshake.headers['x-real-ip'];
  
  // Prioridad: x-real-ip > x-forwarded-for > socket.handshake.address
  let ip = realIP || (forwardedFor ? forwardedFor.split(',')[0].trim() : null) || socket.handshake.address;
  
  // Limpiar formato IPv6 localhost
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    ip = '127.0.0.1';
  }
  
  // Remover prefijo IPv6 si existe
  console.log(`📍 IP detectada - Original: ${socket.handshake.address}, Limpia: ${ip}`);
  
  return ip;
};

module.exports = { getCleanIP };
