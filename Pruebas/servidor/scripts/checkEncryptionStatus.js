/**
 * Script para verificar el estado de cifrado de mensajes
 * Ejecutar: node scripts/checkEncryptionStatus.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Message = require('../models/Message');
const { encryptionService } = require('../services/encryptionService');

async function checkEncryptionStatus() {
  try {
    console.log('Verificando estado de cifrado de mensajes...\n');

    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/livechat', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Conectado a MongoDB\n');

    // Estadísticas generales
    const totalMessages = await Message.countDocuments();
    const textMessages = await Message.countDocuments({ messageType: 'text' });
    const encryptedMessages = await Message.countDocuments({ 
      messageType: 'text',
      encrypted: true 
    });
    const unencryptedMessages = await Message.countDocuments({ 
      messageType: 'text',
      encrypted: { $ne: true }
    });

    if (textMessages > 0) {
      const encryptionPercentage = ((encryptedMessages / textMessages) * 100).toFixed(2);
      console.log(`   Porcentaje de cifrado:       ${encryptionPercentage}%`);
    }
    console.log('─'.repeat(50));

    // Verificar algunos mensajes cifrados (muestra)
    if (encryptedMessages > 0) {
      const sampleMessages = await Message.find({ 
        messageType: 'text',
        encrypted: true 
      }).limit(3);

      for (const msg of sampleMessages) {
        // Intentar descifrar
        try {
          const decryptionResult = encryptionService.decryptMessage(msg.text, {
            pin: msg.pin,
            sender: msg.sender
          });
          
          if (decryptionResult.success) {
            console.log(`   Descifrado: "${decryptionResult.plaintext.substring(0, 50)}..." ✅`);
          } else {
            console.log(`   Error al descifrar: ${decryptionResult.error} ❌`);
          }
        } catch (err) {
          console.log(`   Excepción al descifrar: ${err.message} ❌`);
        }
      }
    }

    // Mostrar mensajes sin cifrar
    if (unencryptedMessages > 0) {
      console.log('\n MENSAJES SIN CIFRAR:');
      const unencrypted = await Message.find({ 
        messageType: 'text',
        encrypted: { $ne: true }
      }).limit(5);

      for (const msg of unencrypted) {
        console.log(`\n   ID: ${msg._id}`);
        console.log(`   Sala: ${msg.pin}`);
        console.log(`   Remitente: ${msg.sender}`);
        console.log(`   Texto: "${msg.text.substring(0, 50)}..."`);
      }
    }

    await mongoose.connection.close();

  } catch (error) {
    console.error(' Error en la verificación:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  checkEncryptionStatus()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error fatal:', err);
      process.exit(1);
    });
}

module.exports = { checkEncryptionStatus };
