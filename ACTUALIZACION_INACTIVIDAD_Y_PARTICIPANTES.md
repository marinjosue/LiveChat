# Actualización de LiveChat - Gestión de Inactividad y Lista de Participantes

## 📋 Resumen de Cambios

Se han implementado dos nuevas funcionalidades principales para mejorar la seguridad y la experiencia del usuario:

1. **Desconexión Automática por Inactividad**
2. **Lista de Usuarios Conectados con Privacidad**

---

## 🔐 1. Desconexión Automática por Inactividad

### Características Implementadas

#### **Servidor (`inactivityService.js`)**

- ✅ **Monitoreo de Actividad**: Rastrea la última actividad de cada usuario conectado
- ✅ **Timeout Configurable**: Desconecta usuarios después de 10 minutos de inactividad
- ✅ **Período de Gracia**: 30 segundos para reconexión después de cerrar el navegador
- ✅ **Limpieza Automática**: Elimina sesiones huérfanas cada 5 minutos
- ✅ **Notificaciones**: Avisa al usuario antes de desconectarlo

#### **Cliente**

- ✅ **Heartbeat Automático**: Envía señal de actividad cada 30 segundos
- ✅ **Detección de Cierre**: Marca la sesión al cerrar el navegador
- ✅ **Toast de Advertencia**: Muestra notificación cuando se detecta inactividad

### Configuración

```javascript
const INACTIVITY_CONFIG = {
  MAX_INACTIVITY_TIME: 10 * 60 * 1000,        // 10 minutos
  CHECK_INTERVAL: 1 * 60 * 1000,              // Verifica cada 1 minuto
  RECONNECTION_GRACE_PERIOD: 30 * 1000,       // 30 segundos de gracia
  ORPHAN_SESSION_CLEANUP: 5 * 60 * 1000       // Limpia cada 5 minutos
};
```

### Flujo de Funcionamiento

1. **Usuario se conecta** → `inactivityService.updateActivity()` registra la actividad
2. **Usuario interactúa** → Cada mensaje, archivo o heartbeat actualiza `lastActivity`
3. **Usuario inactivo** → Después de 10 min, recibe `inactivityWarning` y es desconectado
4. **Usuario cierra navegador** → 30 segundos de gracia para reconectar
5. **Limpieza automática** → Sesiones huérfanas eliminadas cada 5 minutos

---

## 👥 2. Lista de Usuarios Conectados con Privacidad

### Características Implementadas

#### **Servidor (`userPrivacyService.js`)**

- ✅ **Hash de Nicknames**: Usa SHA-256 para hashear nombres (primeros 8 caracteres)
- ✅ **Colores Únicos**: Genera un color HSL único basado en el hash
- ✅ **Avatares con Iniciales**: Crea iniciales desde el hash para identificación visual
- ✅ **Lista Personalizada**: Cada usuario ve su propio nombre, los demás ven hashes

#### **Cliente (`ParticipantsList.js`)**

- ✅ **Panel Lateral Izquierdo**: Muestra la lista de participantes
- ✅ **Ocultar/Mostrar**: Botón para colapsar el panel
- ✅ **Diseño Responsive**: Se adapta a dispositivos móviles
- ✅ **Animaciones Suaves**: Transiciones fluidas al mostrar/ocultar
- ✅ **Identificación Visual**: Avatares de colores y badges

### Estructura del Hash de Privacidad

```javascript
// Ejemplo de usuario hasheado
{
  hash: "A3F9B2E1",
  displayName: "Usuario-A3F9B2E1",
  color: "hsl(163, 65%, 55%)",
  initials: "A3",
  isYou: false  // true si es el usuario actual
}
```

### Eventos Socket.IO

#### **Nuevos Eventos Emitidos por el Servidor**

- `userListUpdate` - Lista actualizada de participantes
- `inactivityWarning` - Aviso de desconexión por inactividad

#### **Nuevos Eventos Recibidos del Cliente**

- `userActivity` - Heartbeat de actividad del usuario

---

## 📁 Archivos Creados/Modificados

### **Archivos Nuevos**

1. `server/services/inactivityService.js` - Servicio de gestión de inactividad
2. `server/services/userPrivacyService.js` - Servicio de privacidad de usuarios
3. `client/src/components/ParticipantsList.js` - Componente de lista de participantes
4. `client/src/styles/ParticipantsList.css` - Estilos del panel de participantes

### **Archivos Modificados**

1. `server/controllers/RoomController.js`
   - Integración de `InactivityService`
   - Integración de `UserPrivacyService`
   - Nuevos eventos socket para actividad y lista de usuarios
   - Emisión de lista actualizada en join/leave/reconexión

2. `client/src/components/ChatMultimedia.js`
   - Integración de `ParticipantsList`
   - Escucha de `userListUpdate` e `inactivityWarning`
   - Heartbeat cada 30 segundos
   - Estructura JSX reorganizada con panel lateral

3. `client/src/components/chatText.js`
   - Integración de `ParticipantsList`
   - Escucha de `userListUpdate` e `inactivityWarning`
   - Heartbeat cada 30 segundos
   - Estructura JSX reorganizada con panel lateral

4. `client/src/styles/ChatRoom.css`
   - Estilos para `.chat-container-with-participants`
   - Estilos para `.chat-main-area`

5. `server/server.js`
   - Exportación de RoomController para acceso a servicios

---

## 🎨 Diseño del Panel de Participantes

### Vista Desktop

```
┌────────────────────────────────────────────────┐
│ [≪] Participantes      2 / 10                  │
│ 🔒 Los nombres están hasheados para privacidad │
├────────────────────────────────────────────────┤
│                                                 │
│  [A3] Usuario-A3F9B2E1  #A3F9B2E1              │
│  [7C] Tú (MiNombre)     Tú  #7C8E5D92          │
│                                                 │
└────────────────────────────────────────────────┘
```

### Vista Mobile

- Panel en posición absoluta sobre el chat
- Botón flotante para mostrar/ocultar
- Ancho reducido (200px en móviles)

---

## 🔧 Configuración Recomendada

### Variables de Entorno (Opcional)

```env
# Tiempo de inactividad antes de desconectar (milisegundos)
INACTIVITY_TIMEOUT=600000

# Intervalo de verificación (milisegundos)
INACTIVITY_CHECK_INTERVAL=60000

# Período de gracia para reconexión (milisegundos)
RECONNECTION_GRACE=30000
```

---

## ✅ Checklist de Testing

- [x] Usuario desconectado después de 10 minutos de inactividad
- [x] Heartbeat mantiene la conexión activa
- [x] Período de gracia funciona al cerrar navegador
- [x] Lista de participantes se actualiza en tiempo real
- [x] Nicknames hasheados correctamente
- [x] Panel de participantes oculta/muestra correctamente
- [x] Diseño responsive en móviles
- [x] Colores únicos para cada usuario
- [x] Usuario actual identificado con "Tú"

---

## 🚀 Próximos Pasos Sugeridos

1. **Persistencia de Configuración**: Guardar preferencia de panel visible/oculto en localStorage
2. **Estados de Actividad**: Mostrar "Escribiendo..." cuando un usuario está tecleando
3. **Indicadores de Inactividad**: Marcar usuarios inactivos con un ícono
4. **Notificaciones de Entrada/Salida**: Toast cuando alguien entra/sale de la sala
5. **Estadísticas de Sala**: Mostrar tiempo promedio de conexión, mensajes enviados, etc.

---

## 📚 Referencias de Código

### Ejemplo de Uso del InactivityService

```javascript
// Actualizar actividad del usuario
inactivityService.updateActivity(socketId, pin, deviceId);

// Marcar usuario como desconectado (inicia período de gracia)
inactivityService.markDisconnected(socketId);

// Cancelar desconexión (usuario se reconectó)
inactivityService.cancelDisconnection(socketId);

// Obtener estadísticas
const stats = inactivityService.getStats();
```

### Ejemplo de Uso del UserPrivacyService

```javascript
// Generar hash de nickname
const hash = UserPrivacyService.hashNickname('Juan', 'sala123');

// Generar información anónima
const anonymousUser = UserPrivacyService.generateAnonymousUser('Juan', 'sala123');

// Generar lista completa para una sala
const userList = UserPrivacyService.generateAnonymousUserList(
  users,
  pin,
  currentUserNickname
);
```

---

## 🐛 Troubleshooting

### Problema: Usuarios desconectados muy rápido
**Solución**: Verificar que el heartbeat se esté enviando correctamente cada 30 segundos

### Problema: Panel de participantes no se muestra
**Solución**: Verificar que el evento `userListUpdate` se esté emitiendo desde el servidor

### Problema: Nicknames no hasheados
**Solución**: Asegurar que `UserPrivacyService.generateAnonymousUserList()` se esté llamando

### Problema: Sesiones no se limpian
**Solución**: Verificar que `InactivityService` esté iniciado en `RoomController`

---

## 📞 Soporte

Para reportar bugs o sugerir mejoras, crear un issue en el repositorio del proyecto.

---

**Fecha de Implementación**: Noviembre 2025  
**Versión**: 2.0.0  
**Autor**: LiveChat Development Team
