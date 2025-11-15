/**
 * Script para crear el primer administrador del sistema
 * Ejecutar con: node server/scripts/createAdmin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const Admin = require('../models/Admin');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createAdmin() {
  try {
    // Conectar a MongoDB
    console.log('Conectando a MongoDB Atlas...');
    
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      console.error('❌ Error: MONGODB_URI no está configurada en .env');
      process.exit(1);
    }
    
    console.log(`Usando: ${mongoUri.includes('mongodb+srv') ? 'MongoDB Atlas' : 'MongoDB Local'}`);
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✓ Conectado a MongoDB\n');

    // Solicitar datos del administrador
    console.log('=== CREAR NUEVO ADMINISTRADOR ===\n');
    
    const username = await question('Username (min 3 caracteres): ');
    if (username.length < 3) {
      console.error('❌ El username debe tener al menos 3 caracteres');
      process.exit(1);
    }

    const email = await question('Email: ');
    if (!email.includes('@')) {
      console.error('❌ Email inválido');
      process.exit(1);
    }

    const password = await question('Password (min 8 caracteres, debe incluir mayúsculas, minúsculas, números y símbolos): ');
    if (password.length < 8) {
      console.error('❌ La contraseña debe tener al menos 8 caracteres');
      process.exit(1);
    }

    const roleInput = await question('Role (admin/moderator/superadmin) [admin]: ');
    const role = roleInput.trim() || 'admin';
    
    if (!['admin', 'moderator', 'superadmin'].includes(role)) {
      console.error('❌ Role inválido');
      process.exit(1);
    }

    // Verificar si el usuario ya existe
    const existing = await Admin.findOne({
      $or: [{ username }, { email }]
    });

    if (existing) {
      console.error('❌ Ya existe un administrador con ese username o email');
      process.exit(1);
    }

    // Crear hash de contraseña
    console.log('\nGenerando hash de contraseña...');
    const passwordHash = await Admin.hashPassword(password);

    // Crear administrador
    const admin = new Admin({
      username,
      email,
      passwordHash,
      role,
      isActive: true
    });

    await admin.save();

    console.log('\n✓ Administrador creado exitosamente!');
    console.log('\nDetalles:');
    console.log(`  Username: ${username}`);
    console.log(`  Email: ${email}`);
    console.log(`  Role: ${role}`);
    console.log(`  ID: ${admin._id}`);
    console.log('\n⚠️  Recuerda habilitar 2FA después del primer login para mayor seguridad.');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('ENOTFOUND mongodb')) {
      console.error('\n💡 SOLUCIÓN: Parece que intentas ejecutar este script fuera de Docker.');
      console.error('   Usa en su lugar: node scripts/createAdmin.local.js');
      console.error('   O asegúrate de que MongoDB esté corriendo en localhost\n');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 SOLUCIÓN: MongoDB no está corriendo.');
      console.error('   Opción 1: docker-compose -f docker-compose.dev.yml up mongodb');
      console.error('   Opción 2: Inicia el servicio MongoDB local\n');
    }
  } finally {
    rl.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

createAdmin();
