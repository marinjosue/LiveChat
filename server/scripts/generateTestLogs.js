require('dotenv').config();
const mongoose = require('mongoose');
const { AuditService } = require('../services/auditService');

async function generateTestLogs() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    console.log('📝 Generando logs de prueba...\n');

    // Simular diferentes tipos de logs
    const testLogs = [
      {
        adminId: null,
        adminUsername: 'admin',
        action: 'LOGIN_SUCCESS',
        details: { email: 'admin@example.com' },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        status: 'SUCCESS'
      },
      {
        adminId: null,
        adminUsername: 'testuser',
        action: 'LOGIN_FAILED',
        details: { reason: 'Invalid password' },
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0',
        status: 'FAILURE',
        errorMessage: 'Invalid credentials'
      },
      {
        adminId: null,
        adminUsername: 'admin',
        action: 'ROOM_CREATED',
        details: { pin: 'TEST123', roomType: 'multimedia', limit: 10 },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        status: 'SUCCESS'
      },
      {
        adminId: null,
        adminUsername: 'admin',
        action: 'FILE_UPLOADED',
        details: { fileName: 'test.jpg', fileSize: 1024, fileType: 'image/jpeg' },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        status: 'SUCCESS'
      },
      {
        adminId: null,
        adminUsername: 'SYSTEM',
        action: 'STEGANOGRAPHY_DETECTED',
        details: { 
          fileName: 'suspicious.png', 
          confidence: 85,
          reasons: ['LSB detected', 'Unusual entropy']
        },
        ipAddress: '192.168.1.102',
        userAgent: 'Mozilla/5.0',
        status: 'WARNING',
        errorMessage: 'Steganography detected in uploaded file'
      },
      {
        adminId: null,
        adminUsername: 'admin',
        action: '2FA_ENABLED',
        details: { method: 'TOTP' },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        status: 'SUCCESS'
      },
      {
        adminId: null,
        adminUsername: 'admin',
        action: 'ROOM_VIEWED',
        details: { pin: 'TEST123', messageCount: 15 },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        status: 'SUCCESS'
      },
      {
        adminId: null,
        adminUsername: 'hacker',
        action: 'SUSPICIOUS_ACTIVITY',
        details: { reason: 'Multiple failed login attempts' },
        ipAddress: '10.0.0.1',
        userAgent: 'curl/7.0',
        status: 'WARNING',
        errorMessage: 'Suspicious activity detected'
      },
      {
        adminId: null,
        adminUsername: 'admin',
        action: 'LOGS_FILES_LISTED',
        details: { filesCount: 8 },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        status: 'SUCCESS'
      },
      {
        adminId: null,
        adminUsername: 'admin',
        action: 'LOG_FILE_VIEWED',
        details: { filename: 'error.log', lines: 100 },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        status: 'SUCCESS'
      }
    ];

    for (let i = 0; i < testLogs.length; i++) {
      const log = testLogs[i];
      await AuditService.log(log);
      console.log(`✓ Log ${i + 1}/${testLogs.length}: ${log.action} - ${log.status}`);
      
      // Pequeña pausa para que tengan timestamps diferentes
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n✅ Logs de prueba generados exitosamente');
    console.log('📊 Total de logs creados:', testLogs.length);

  } catch (error) {
    console.error('❌ Error al generar logs de prueba:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Desconectado de MongoDB');
    process.exit(0);
  }
}

console.log('╔═══════════════════════════════════════╗');
console.log('║   📝 GENERAR LOGS DE PRUEBA          ║');
console.log('╚═══════════════════════════════════════╝\n');

generateTestLogs();
