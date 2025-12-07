/**
 * Script para corregir índices de DeviceSession
 * Limpia índices obsoletos y registros con valores null
 */

require('dotenv').config();
const mongoose = require('mongoose');
const DeviceSession = require('../models/DeviceSession');

async function fixIndexes() {
  try {
    console.log('🔧 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Conectado a MongoDB');

    // 1. Eliminar documentos con valores null
    console.log('\n📋 Buscando documentos con valores null...');
    const nullDocs = await DeviceSession.find({
      $or: [
        { deviceId: null },
        { ipAddress: null },
        { pin: null },
        { nickname: null },
        { deviceId: { $exists: false } },
        { ipAddress: { $exists: false } },
        { pin: { $exists: false } },
        { nickname: { $exists: false } }
      ]
    });

    if (nullDocs.length > 0) {
      console.log(`⚠️ Encontrados ${nullDocs.length} documentos con valores null`);
      console.log('Ejemplos:', nullDocs.slice(0, 3));
      
      const deleteResult = await DeviceSession.deleteMany({
        $or: [
          { deviceId: null },
          { ipAddress: null },
          { pin: null },
          { nickname: null },
          { deviceId: { $exists: false } },
          { ipAddress: { $exists: false } },
          { pin: { $exists: false } },
          { nickname: { $exists: false } }
        ]
      });
      console.log(`✓ Eliminados ${deleteResult.deletedCount} documentos inválidos`);
    } else {
      console.log('✓ No se encontraron documentos con valores null');
    }

    // 2. Listar índices actuales
    console.log('\n📊 Índices actuales en DeviceSession:');
    const indexes = await DeviceSession.collection.getIndexes();
    console.log(JSON.stringify(indexes, null, 2));

    // 3. Eliminar índices obsoletos
    const obsoleteIndexes = ['ip_1_roomPin_1', 'ip_1', 'roomPin_1'];
    
    for (const indexName of obsoleteIndexes) {
      try {
        if (indexes[indexName]) {
          console.log(`\n🗑️ Eliminando índice obsoleto: ${indexName}`);
          await DeviceSession.collection.dropIndex(indexName);
          console.log(`✓ Índice ${indexName} eliminado`);
        }
      } catch (error) {
        if (error.code === 27) {
          console.log(`ℹ️ Índice ${indexName} no existe (ya fue eliminado)`);
        } else {
          console.error(`❌ Error eliminando índice ${indexName}:`, error.message);
        }
      }
    }

    // 4. Recrear índices correctos
    console.log('\n🔨 Recreando índices correctos...');
    
    // Asegurar que los índices del schema estén creados
    await DeviceSession.syncIndexes();
    console.log('✓ Índices sincronizados con el schema');

    // 5. Verificar índices finales
    console.log('\n✅ Índices finales en DeviceSession:');
    const finalIndexes = await DeviceSession.collection.getIndexes();
    console.log(JSON.stringify(finalIndexes, null, 2));

    // 6. Estadísticas finales
    const totalSessions = await DeviceSession.countDocuments();
    console.log(`\n📊 Total de sesiones válidas: ${totalSessions}`);

    console.log('\n✅ Proceso completado exitosamente');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error en el proceso:', error);
    process.exit(1);
  }
}

fixIndexes();
