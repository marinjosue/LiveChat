/**
 * Servicio de privacidad de usuarios
 * Gestiona el hasheo de nicknames para proteger la privacidad
 */

const crypto = require('crypto');

class UserPrivacyService {
  /**
   * Genera un hash SHA-256 de un nickname para privacidad
   * @param {string} nickname - Nickname del usuario
   * @param {string} salt - Salt opcional para el hash (usar PIN de la sala)
   * @returns {string} Hash del nickname (primeros 8 caracteres)
   */
  static hashNickname(nickname, salt = '') {
    const hash = crypto
      .createHash('sha256')
      .update(`${nickname}${salt}`)
      .digest('hex');
    
    // Retornar solo los primeros 8 caracteres para hacerlo más legible
    return hash.substring(0, 8).toUpperCase();
  }

  /**
   * Genera un identificador visual único basado en el hash
   * @param {string} nickname - Nickname del usuario
   * @param {string} salt - Salt opcional
   * @returns {Object} Información del usuario hasheado
   */
  static generateAnonymousUser(nickname, salt = '') {
    const hash = this.hashNickname(nickname, salt);
    
    // Generar color basado en el hash
    const colorCode = parseInt(hash.substring(0, 6), 16);
    const hue = colorCode % 360;
    const color = `hsl(${hue}, 65%, 55%)`;
    
    // Generar avatar con iniciales del hash
    const initials = `${hash[0]}${hash[1]}`;
    
    return {
      hash,
      displayName: `Usuario-${hash}`,
      color,
      initials,
      originalNickname: nickname // Solo para uso interno del servidor
    };
  }

  /**
   * Obtiene información pública del usuario (sin nickname real)
   * @param {string} nickname - Nickname real
   * @param {string} roomPin - PIN de la sala (usado como salt)
   * @param {boolean} isOwnUser - Si es el propio usuario
   * @returns {Object} Información pública del usuario
   */
  static getPublicUserInfo(nickname, roomPin, isOwnUser = false) {
    const anonymousInfo = this.generateAnonymousUser(nickname, roomPin);
    
    return {
      hash: anonymousInfo.hash,
      displayName: isOwnUser ? `Tú (${nickname})` : anonymousInfo.displayName,
      color: anonymousInfo.color,
      initials: anonymousInfo.initials,
      isYou: isOwnUser
    };
  }

  /**
   * Genera una lista de usuarios con información hasheada
   * @param {Array} users - Lista de usuarios con nicknames reales
   * @param {string} roomPin - PIN de la sala
   * @param {string} currentUserNickname - Nickname del usuario actual
   * @returns {Array} Lista de usuarios con información hasheada
   */
  static generateAnonymousUserList(users, roomPin, currentUserNickname = null) {
    return users.map(user => {
      const isOwnUser = currentUserNickname && user.nickname === currentUserNickname;
      const publicInfo = this.getPublicUserInfo(user.nickname, roomPin, isOwnUser);
      
      return {
        ...publicInfo,
        socketId: user.id,
        joinedAt: user.joinedAt || new Date()
      };
    });
  }

  /**
   * Verifica si dos nicknames coinciden comparando sus hashes
   * @param {string} nickname1 - Primer nickname
   * @param {string} nickname2 - Segundo nickname
   * @param {string} salt - Salt para el hash
   * @returns {boolean} True si los hashes coinciden
   */
  static compareNicknames(nickname1, nickname2, salt = '') {
    return this.hashNickname(nickname1, salt) === this.hashNickname(nickname2, salt);
  }

  /**
   * Genera estadísticas anónimas de usuarios
   * @param {Array} users - Lista de usuarios
   * @returns {Object} Estadísticas
   */
  static generateUserStats(users) {
    const now = Date.now();
    
    return {
      totalUsers: users.length,
      activeInLast5Min: users.filter(u => {
        const lastActive = u.lastActive || u.joinedAt || new Date();
        return (now - lastActive.getTime()) < 5 * 60 * 1000;
      }).length,
      userHashes: users.map(u => this.hashNickname(u.nickname))
    };
  }
}

module.exports = { UserPrivacyService };
