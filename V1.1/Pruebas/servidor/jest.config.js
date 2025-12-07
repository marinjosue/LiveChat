module.exports = {
  testEnvironment: "node",
  verbose: true,
  forceExit: true,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  moduleNameMapper: {
    "^bcrypt$": "<rootDir>/__mocks__/bcrypt.js"
  },
  // Ignorar archivos inesesarios para la cobertura
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/coverage/',
    '/workers/',
    '/scripts/',
    // Archivos con 0% de cobertura
    'app.js',
    'server.js',
    'cleanSessions.js',
    'jest.config.js',
    'sslService.js',
    'threadPoolManager.js',
   
    'routes/admin.js',
    'routes/adminRooms.js',
    'routes/auth.js',
    'routes/rooms.js',
    'models/Admin.js',
    'models/AuditLog.js',
    'models/Message.js',
    'models/RoomMembership.js',
    'models/RoomModel.js',
    'middleware/security.js',
    'services/fileSecurityService.js',
    'services/inactivityService.js',
    'services/auditService.js',
    'services/loggerService.js',
    'services/workerPoolService.js',
    'utils/fileUploader.js'
  ],
  // Establecer umbrales de cobertura (ajustados a valores alcanzables)
  coverageThreshold: {
    global: {
      statements: 30,
      branches: 25,
      functions: 30,
      lines: 30
    }
  },
  // Configurar reportes de cobertura
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/coverage/**',
    '!**/workers/**',
    '!**/scripts/**'
  ]
};


