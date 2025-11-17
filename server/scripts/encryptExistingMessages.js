/**
 * Script para cifrar mensajes existentes en la base de datos
 * Ejecutar: node scripts/encryptExistingMessages.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Message = require('../models/Message');
const { encryptionService } = require('../services/encryptionService');

async function encryptExistingMessages() {
  try {
    console.log('🔐 Iniciando cifrado de mensajes existentes...\n');

    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/livechat', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Conectado a MongoDB\n');

    // Buscar mensajes de texto sin cifrar
    const unencryptedMessages = await Message.find({
      messageType: 'text',
      encrypted: { $ne: true },
      text: { $exists: true, $ne: null, $ne: '' }
    });

    console.log(`📊 Mensajes encontrados sin cifrar: ${unencryptedMessages.length}\n`);

    if (unencryptedMessages.length === 0) {
      console.log('✅ Todos los mensajes ya están cifrados');
      await mongoose.connection.close();
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const message of unencryptedMessages) {
      try {
        // Cifrar el mensaje
        const encryptionResult = encryptionService.encryptMessage(message.text, {
          pin: message.pin,
          sender: message.sender
        });

        if (encryptionResult.success) {
          // Actualizar el mensaje con el texto cifrado
          message.text = encryptionResult.ciphertext;
          message.encrypted = true;
          await message.save();
          
          successCount++;
          console.log(`✓ Mensaje cifrado: ${message._id} (sala: ${message.pin})`);
        } else {
          errorCount++;
          console.error(`✗ Error cifrando mensaje ${message._id}:`, encryptionResult.error);
        }
      } catch (err) {
        errorCount++;
        console.error(`✗ Excepción cifrando mensaje ${message._id}:`, err.message);
      }
    }

    console.log('\n📊 Resumen:');
    console.log(`   ✅ Mensajes cifrados exitosamente: ${successCount}`);
    console.log(`   ❌ Mensajes con error: ${errorCount}`);
    console.log(`   📝 Total procesado: ${successCount + errorCount}`);

    await mongoose.connection.close();
    console.log('\n✅ Proceso completado');

  } catch (error) {
    console.error('❌ Error en el proceso:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  encryptExistingMessages()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error fatal:', err);
      process.exit(1);
    });
}

module.exports = { encryptExistingMessages };
