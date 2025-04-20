require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');

const app = express();
app.use(express.json());

app.use('/api', authRoutes);
app.use('/api', gameRoutes);

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB bağlantısı başarılı');
  app.listen(PORT, () => console.log(`Sunucu ${PORT} portunda çalışıyor`));
}).catch(err => {
  console.error('MongoDB bağlantı hatası:', err.message);
});
