require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const RoomController = require('./controllers/RoomController');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.FRONTEND_URL || "*" } });

// Conexión segura a MongoDB usando .env
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB conectado exitosamente'))
    .catch(err => console.error('Error conectando a MongoDB:', err));

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
