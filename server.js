require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');

const app = express();
app.use(express.json());

app.use('/api', authRoutes);
app.use('/api', gameRoutes);

const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
require('./socketHandler')(io);

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB bağlantısı başarılı');
  server.listen(PORT, () => console.log(`Sunucu ${PORT} portunda çalışıyor (Socket.IO ile)`));
}).catch(err => {
  console.error('MongoDB bağlantı hatası:', err.message);
});
