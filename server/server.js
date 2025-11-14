require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const multer = require('multer');
const RoomController = require('./controllers/RoomController');
const { uploadToCloudinary } = require('./utils/fileUploader');
const Message = require('./models/Message');
const Room = require('./models/Room');

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Configurar multer para archivos en memoria (más rápido)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB límite
});

const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: process.env.FRONTEND_URL || "*" },
  maxHttpBufferSize: 25 * 1024 * 1024, // 25MB para soportar archivos de 15MB en base64 (~20MB)
  pingTimeout: 60000, // 60 segundos
  pingInterval: 25000 // 25 segundos
});

// Conexión segura a MongoDB usando .env
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB conectado exitosamente'))
    .catch(err => console.error('Error conectando a MongoDB:', err));

// Endpoint HTTP optimizado para archivos grandes
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const { pin, sender, tempId } = req.body;
    const file = req.file;

    if (!file || !pin || !sender) {
      return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });
    }

    console.log(`📤 HTTP Upload: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

    // Convertir buffer a base64
    const fileBase64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    
    // Subir a Cloudinary con configuración optimizada
    const uploadResult = await uploadToCloudinary(fileBase64, file.originalname, 'livechat', 3);
    
    if (!uploadResult.success) {
      return res.status(500).json({ success: false, message: uploadResult.error });
    }

    // Determinar tipo de archivo
    let messageType = 'document';
    if (file.mimetype.startsWith('image/')) messageType = 'image';
    else if (file.mimetype.startsWith('video/')) messageType = 'video';
    else if (file.mimetype.startsWith('audio/')) messageType = 'audio';

    // Guardar mensaje en BD
    const timestamp = new Date();
    const fileData = {
      url: uploadResult.url,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size
    };

    const newMessage = new Message({
      pin,
      sender,
      messageType,
      fileData,
      timestamp
    });

    await newMessage.save();
    // Nota: Room es una clase en memoria, no un modelo de Mongoose, así que no se puede hacer updateOne
    // La actividad se actualiza automáticamente cuando se emite el evento

    // Notificar a todos via Socket.IO
    io.to(pin).emit('fileMessage', {
      sender,
      messageType,
      fileData,
      timestamp,
      tempId
    });

    console.log(`✅ HTTP Upload exitoso: ${uploadResult.url}`);
    
    res.json({ 
      success: true, 
      url: uploadResult.url,
      fileData,
      tempId
    });

  } catch (error) {
    console.error('❌ Error en HTTP upload:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

RoomController(io);

// Endpoint para capturar la IP pública
app.get('/get-ip', (req, res) => {
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Si es una lista separada por comas, tomamos la primera y quitamos espacios
    if (ip && ip.includes(',')) {
        ip = ip.split(',')[0].trim();
    }

    res.json({ ip });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
