class Validators {
  /**
   * Remove non-letter characters (Unicode-aware). Falls back to latin ranges.
   */
   static sanitizeUsername(name) {
    // Solo letras y un espacio entre palabras
    return name
      .replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ ]+/g, '') // solo letras y espacios
      .replace(/\s{2,}/g, ' ')                // evitar dobles espacios
    .trimStart();                            // no permitir espacio al inicio
  }

static sanitizeAdminUsername(username) {
  return username
    .replace(/[^A-Za-z0-9]/g, '') // solo letras y números
    .slice(0, 20);                 // límite opcional
}
static sanitizeRoomName(name) {
  return name
    .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ ]/g, '')  // SOLO letras + espacio
    .replace(/\s{2,}/g, ' ')                // NO doble espacio
    .replace(/^\s+/g, '');                   // NO espacio inicial
}

static validateRoomName(name) {
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ]+( [a-zA-ZáéíóúÁÉÍÓÚñÑ]+)*$/.test(name)) {
    return { ok: false, message: 'Solo se permiten letras y un espacio entre palabras' };
  }
  return { ok: true };
}


static validateAdminUsername(username) {
  if (!username.trim()) {
    return { ok: false, message: 'El usuario no puede estar vacío' };
  }
  if (!/^[A-Za-z0-9]+$/.test(username)) {
    return { ok: false, message: 'El usuario solo puede contener letras y números' };
  }
  return { ok: true };
}

  /**
   * Validate username: required, only letters, min length 2
   */
  static validateUsername(value = '') {
    const sanitized = this.sanitizeUsername(value);
    if (!sanitized) return { ok: false, message: 'El usuario es obligatorio y debe contener letras.' };
    if (sanitized.length < 2) return { ok: false, message: 'El nombre de usuario debe tener al menos 2 letras.' };
    return { ok: true };
  }

  /**
   * Validate password: required, min length 6 (you can change policy here)
   */
  static validatePassword(value = '') {
    if (!value) return { ok: false, message: 'La contraseña es obligatoria.' };
    if (value.length < 6) return { ok: false, message: 'La contraseña debe tener al menos 6 caracteres.' };
    return { ok: true };
  }

  /**
   * Validate 2FA code: exactly 6 digits
   */
  static validate2FACode(value = '') {
    if (!value) return { ok: false, message: 'El código 2FA es obligatorio.' };
    const onlyDigits = String(value).replace(/\D/g, '');
    if (!/^\d{6}$/.test(onlyDigits)) return { ok: false, message: 'El código 2FA debe tener 6 dígitos.' };
    return { ok: true };
  }
}

export default Validators;
