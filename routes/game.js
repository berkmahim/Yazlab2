const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Game = require('../models/Game');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Bellekte süreye göre bekleme kuyruğu
const waitingQueues = {};

// Türkçe harf havuzunu JSON dosyasından oku
const path = require('path');
const fs = require('fs');
const LETTER_POOL_PATH = path.join(__dirname, '../letterpool.json');

function getLetterPool() {
  try {
    const data = fs.readFileSync(LETTER_POOL_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Harf havuzu okunamadı:', err.message);
    return [];
  }
}

function createLetterBag() {
  // Türkçe harf havuzundan rastgele harf torbası oluşturur
  const TURKISH_LETTER_POOL = getLetterPool();
  const bag = [];
  for (const item of TURKISH_LETTER_POOL) {
    for (let i = 0; i < item.count; i++) {
      bag.push(item.letter);
    }
  }
  return bag;
}

function getRandomTiles(bag, n) {
  // Torbadan n adet rastgele harf çeker
  const tiles = [];
  for (let i = 0; i < n; i++) {
    if (bag.length === 0) break;
    const idx = Math.floor(Math.random() * bag.length);
    tiles.push(bag.splice(idx, 1)[0]);
  }
  return tiles;
}

// Yeni oyun başlat veya bekleme kuyruğuna al
router.post('/game/new', auth, async (req, res) => {
  const { selectedDuration } = req.body;
  const userId = req.user.id;
  if (!selectedDuration) return res.status(400).json({ message: 'Süre seçimi gerekli' });

  // Kuyruk yoksa oluştur
  if (!waitingQueues[selectedDuration]) waitingQueues[selectedDuration] = [];

  // Kuyrukta bekleyen başka oyuncu var mı?
  if (waitingQueues[selectedDuration].length > 0) {
    const opponentId = waitingQueues[selectedDuration].shift();
    // Harf torbası ve dağıtımı
    const bag = createLetterBag();
    const player1Tiles = getRandomTiles(bag, 7);
    const player2Tiles = getRandomTiles(bag, 7);
    const game = new Game({
      player1: opponentId,
      player2: userId,
      player1Tiles,
      player2Tiles,
      turn: opponentId,
      status: 'active',
      startTime: new Date(),
      selectedDuration,
      remainingTiles: bag,
      board: Array.from({ length: 15 }, () => Array(15).fill('')),
      history: []
    });
    await game.save();
    // Her iki oyuncuya da gameId dön
    return res.json({ message: 'Eşleşme bulundu, oyun başlatıldı', gameId: game._id });
  } else {
    // Kuyruğa ekle
    if (!waitingQueues[selectedDuration].includes(userId)) {
      waitingQueues[selectedDuration].push(userId);
    }
    return res.json({ message: 'Bekleme kuyruğuna alındınız, eşleşme bekleniyor' });
  }
});

// Oyun bilgisi getir
router.get('/game/:gameId', auth, async (req, res) => {
  const { gameId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(gameId)) return res.status(400).json({ message: 'Geçersiz gameId' });
  const game = await Game.findById(gameId)
    .populate('player1', 'username')
    .populate('player2', 'username')
    .populate('winner', 'username');
  if (!game) return res.status(404).json({ message: 'Oyun bulunamadı' });
  // Sadece oyuncular erişebilsin
  if (![game.player1?._id?.toString(), game.player2?._id?.toString()].includes(req.user.id)) {
    return res.status(403).json({ message: 'Bu oyuna erişim yetkiniz yok' });
  }
  res.json(game);
});

module.exports = router;
