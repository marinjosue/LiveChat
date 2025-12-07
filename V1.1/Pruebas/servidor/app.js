const express = require('express');
const cors = require('cors');
const multer = require('multer');

// Middleware
const {
  helmetConfig,
  apiLimiter,
  fileUploadLimiter,
  sanitizeInput,
  detectSuspiciousActivity,
  securityLogger,
  corsConfig
} = require('./middleware/security');

// Rutas
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const adminRoomsRoutes = require('./routes/adminRooms');
const roomRoutes = require('./routes/rooms');

const app = express();

// ==================== MIDDLEWARES ====================

app.use(helmetConfig);
app.use(cors(corsConfig));
app.use(securityLogger);
app.use('/api/', apiLimiter);

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

app.use(sanitizeInput);
app.use(detectSuspiciousActivity);

// Multer básico (para evitar errores en tests)
const upload = multer({ storage: multer.memoryStorage() });

// ==================== RUTAS ====================

app.use('/api/auth', authRoutes);
app.use('/api/admin/rooms', adminRoomsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rooms', roomRoutes);

app.get('/health', (req, res) => {
  res.json({ success: true });
});

// 404
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

module.exports = app;
