// Script específico para crear admin en entorno LOCAL (sin Docker)
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const readline = require('readline');
const Admin = require('../models/Admin');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Conectar a MongoDB LOCAL
async function connectDB() {
  try {
    console.log('🔌 Conectando a MongoDB LOCAL (localhost:27017)...');
    
    await mongoose.connect('mongodb://localhost:27017/livechat', {
      serverSelectionTimeoutMS: 5000
    });
    
    console.log('✅ Conectado a MongoDB local exitosamente\n');
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    console.error('\n⚠️  SOLUCIONES POSIBLES:');
    console.error('   1. Asegúrate de que MongoDB esté corriendo localmente');
    console.error('      Windows: Inicia el servicio "MongoDB Server"');
    console.error('      O ejecuta: mongod');
    console.error('   2. Si usas Docker, ejecuta: docker-compose -f docker-compose.dev.yml up mongodb');
    console.error('   3. O usa el script original dentro de Docker\n');
    process.exit(1);
  }
}

// Función para hacer preguntas
function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Validar email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function createAdmin() {
  try {
    await connectDB();

    console.log('═══════════════════════════════════════════');
    console.log('   🔐 CREACIÓN DE ADMINISTRADOR (LOCAL)');
    console.log('═══════════════════════════════════════════\n');

    // Solicitar datos
    let username = await question('👤 Nombre de usuario (mín. 3 caracteres): ');
    while (username.length < 3) {
      console.log('⚠️  El nombre de usuario debe tener al menos 3 caracteres');
      username = await question('👤 Nombre de usuario: ');
    }

    // Verificar si el usuario ya existe
    const existingUser = await Admin.findOne({ username });
    if (existingUser) {
      console.log('\n❌ Error: Ya existe un administrador con ese nombre de usuario');
      rl.close();
      process.exit(1);
    }

    let email = await question('📧 Email: ');
    while (!isValidEmail(email)) {
      console.log('⚠️  Email inválido');
      email = await question('📧 Email: ');
    }

    // Verificar si el email ya existe
    const existingEmail = await Admin.findOne({ email });
    if (existingEmail) {
      console.log('\n❌ Error: Ya existe un administrador con ese email');
      rl.close();
      process.exit(1);
    }

    let password = await question('🔒 Contraseña (mín. 8 caracteres): ');
    while (password.length < 8) {
      console.log('⚠️  La contraseña debe tener al menos 8 caracteres');
      password = await question('🔒 Contraseña: ');
    }

    const passwordConfirm = await question('🔒 Confirmar contraseña: ');
    if (password !== passwordConfirm) {
      console.log('\n❌ Error: Las contraseñas no coinciden');
      rl.close();
      process.exit(1);
    }

    console.log('\n👑 Selecciona el rol:');
    console.log('   1. superadmin (acceso total)');
    console.log('   2. admin (gestión de salas y usuarios)');
    console.log('   3. moderator (moderación de contenido)');
    const roleChoice = await question('\nOpción [1-3]: ');

    const roles = {
      '1': 'superadmin',
      '2': 'admin',
      '3': 'moderator'
    };

    const role = roles[roleChoice] || 'admin';

    console.log('\n⏳ Creando administrador...');

    // Hashear contraseña
    const passwordHash = await Admin.hashPassword(password);

    // Crear admin
    const admin = new Admin({
      username,
      email,
      passwordHash,
      role,
      isActive: true,
      createdAt: new Date()
    });

    await admin.save();

    console.log('\n═══════════════════════════════════════════');
    console.log('   ✅ ADMINISTRADOR CREADO EXITOSAMENTE');
    console.log('═══════════════════════════════════════════');
    console.log(`\n👤 Usuario:  ${username}`);
    console.log(`📧 Email:    ${email}`);
    console.log(`👑 Rol:      ${role}`);
    console.log(`🆔 ID:       ${admin._id}`);
    console.log('\n💡 Puedes iniciar sesión en:');
    console.log('   http://localhost:3000/admin');
    console.log('\n🔐 Recomendación: Habilita 2FA después del primer login\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 11000) {
      console.error('   El usuario o email ya existe en la base de datos');
    }
  } finally {
    rl.close();
    await mongoose.connection.close();
    console.log('🔌 Desconectado de MongoDB\n');
    process.exit(0);
  }
}

// Ejecutar
createAdmin();
