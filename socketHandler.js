const Game = require('./models/Game');
const User = require('./models/User');

// Oyun sonu kontrol fonksiyonu
function checkGameOver(game) {
  // 1. Taş kalmadıysa ve iki oyuncunun elinde de taş yoksa
  const noTilesLeft = (!game.remainingTiles || game.remainingTiles.length === 0);
  const player1NoTiles = !game.player1Tiles || game.player1Tiles.length === 0;
  const player2NoTiles = !game.player2Tiles || game.player2Tiles.length === 0;
  if (noTilesLeft && player1NoTiles && player2NoTiles) {
    // Skorları karşılaştır, kazananı belirle
    let winner = null;
    if (game.scores) {
      if ((game.scores[game.player1] || 0) > (game.scores[game.player2] || 0)) winner = game.player1;
      else if ((game.scores[game.player2] || 0) > (game.scores[game.player1] || 0)) winner = game.player2;
    }
    return { isOver: true, winner, reason: 'no_tiles' };
  }
  // 2. Üst üste iki tur pas
  const last2 = (game.history||[]).slice(-2);
  if (last2.length === 2 && last2.every(h => h.action === 'pass')) {
    let winner = null;
    if (game.scores) {
      if ((game.scores[game.player1] || 0) > (game.scores[game.player2] || 0)) winner = game.player1;
      else if ((game.scores[game.player2] || 0) > (game.scores[game.player1] || 0)) winner = game.player2;
    }
    return { isOver: true, winner, reason: 'consecutive_pass' };
  }
  // 3. Oyun başlatıldıktan sonra 1 saat içinde hiç hamle yapılmadıysa
  if (game.startTime && (!game.history || game.history.length === 0)) {
    const now = new Date();
    const start = new Date(game.startTime);
    if ((now - start) > 60 * 60 * 1000) {
      return { isOver: true, winner: null, reason: 'timeout_no_move' };
    }
  }
  // 4. Teslim ol zaten surrender eventinde yönetiliyor
  return { isOver: false };
}

// History güncelleme fonksiyonu
function addHistoryEntry(game, entry) {
  if (!game.history) game.history = [];
  game.history.push(entry);
}

module.exports = function(io) {
  io.on('connection', (socket) => {
    // Odaya katılma
    socket.on('joinGameRoom', async ({ gameId, userId }) => {
      const room = `game_${gameId}`;
      socket.join(room);
      socket.data = { gameId, userId };
      io.to(room).emit('info', { message: `${userId} odaya katıldı` });
    });

    // Puan hesaplama fonksiyonu
    const { calculateMoveScore } = require('./utils/score');
    // Türkçe kelime sözlüğü
    const { isWordValid, DEFAULT_WORDLIST_PATH } = require('./utils/wordlist');

    // Oyuncu hamlesi
    socket.on('playerMove', async (data) => {
      const { gameId, userId, placedTiles, formedWords, usedTiles } = data;
      const room = `game_${gameId}`;
      let game = await Game.findById(gameId);
      if (!game) return socket.emit('error', { message: 'Oyun bulunamadı' });
      if (game.status !== 'active') return socket.emit('error', { message: 'Oyun aktif değil' });
      if (String(game.turn) !== userId) return socket.emit('error', { message: 'Sıra sizde değil' });

      // Türkçe kelime kontrolü
      for (const word of formedWords) {
        if (!isWordValid(word)) {
          return socket.emit('error', { message: `Geçersiz kelime: ${word}` });
        }
      }

      // Mayın kontrolü
      const triggeredMines = [];
      if (Array.isArray(game.mines)) {
        for (const tile of placedTiles) {
          const mine = game.mines.find(m => m.isActive && m.x === tile.x && m.y === tile.y);
          if (mine) {
            // Ceza uygula
            if (!game.scores) game.scores = {};
            if (!game.scores[userId]) game.scores[userId] = 0;
            if (mine.type === 'score_halve') {
              game.scores[userId] = Math.floor(game.scores[userId] / 2);
            } else if (mine.type === 'score_transfer') {
              const opponentId = String(game.player1) === userId ? String(game.player2) : String(game.player1);
              if (!game.scores[opponentId]) game.scores[opponentId] = 0;
              const half = Math.floor(game.scores[userId] / 2);
              game.scores[userId] -= half;
              game.scores[opponentId] += half;
            } else if (mine.type === 'tile_loss') {
              // Oyuncunun elinden 1 harf kaybettir (örnek: ilk harf)
              if (String(game.player1) === userId) {
                game.player1Tiles = game.player1Tiles.slice(1);
              } else {
                game.player2Tiles = game.player2Tiles.slice(1);
              }
            } else if (mine.type === 'block_turn') {
              // Oyuncunun bir sonraki hamlesini engelle (örnek: blockTurn alanı)
              if (!game.blockTurn) game.blockTurn = {};
              game.blockTurn[userId] = true;
            } else if (mine.type === 'cancel_word') {
              // Son hamledeki kelimeyi iptal et (puanı 0 yap)
              game.scores[userId] -= score;
              game.history.push({ userId, action: 'cancel_word', affectedWords: formedWords, time: new Date() });
            }
            mine.isActive = false;
            triggeredMines.push({ ...mine });
          }
        }
      }

      // Ödül kontrolü
      const triggeredRewards = [];
      if (Array.isArray(game.rewards)) {
        for (const tile of placedTiles) {
          const reward = game.rewards.find(r => r.isActive && r.x === tile.x && r.y === tile.y);
          if (reward) {
            // Avantaj uygula
            if (reward.type === 'remove_zone_block') {
              // Oyuncunun blockTurn veya bölge yasağını kaldır
              if (game.blockTurn && game.blockTurn[userId]) {
                game.blockTurn[userId] = false;
              }
            } else if (reward.type === 'remove_letter_block') {
              // Oyuncunun harf yasağını kaldır (örnek: game.letterBlock[userId] = false;)
              if (game.letterBlock && game.letterBlock[userId]) {
                game.letterBlock[userId] = false;
              }
            } else if (reward.type === 'extra_turn') {
              // Oyuncuya ekstra hamle hakkı ver
              if (!game.extraTurn) game.extraTurn = {};
              game.extraTurn[userId] = true;
            }
            reward.isActive = false;
            triggeredRewards.push({ ...reward });
          }
        }
      }

      // Özel kareler (örnek: game.specialSquares veya sabit)
      // Burada board ile aynı boyutta, her hücrede '', 'DL', 'TL', 'DW', 'TW' olabilir
      // Örnek amaçlı: tümü normal
      let specialSquares = game.specialSquares || Array.from({ length: 15 }, () => Array(15).fill(''));

      // Puan hesapla
      const score = calculateMoveScore({
        board: game.board,
        specialSquares,
        placedTiles,
        formedWords,
        usedTiles
      });

      // Skoru güncelle
      if (!game.scores) game.scores = {};
      if (!game.scores[userId]) game.scores[userId] = 0;
      game.scores[userId] += score;

      // Hamleyi tahtaya uygula
      for (const tile of placedTiles) {
        if (tile.x >= 0 && tile.x < 15 && tile.y >= 0 && tile.y < 15) {
          game.board[tile.y][tile.x] = tile.letter;
        }
      }
      addHistoryEntry(game, {
        userId,
        placedTiles,
        formedWords,
        usedTiles,
        score,
        triggeredMines,
        triggeredRewards,
        action: 'move',
        time: new Date()
      });

      // Sıra değiştir
      if (String(game.player1) === userId) {
        game.turn = game.player2;
      } else {
        game.turn = game.player1;
      }

      // Oyun sonu kontrolü
      const gameOverResult = checkGameOver(game);
      if (gameOverResult.isOver) {
        game.status = 'finished';
        game.winner = gameOverResult.winner;
        await game.save();
        io.to(room).emit('gameUpdate', { ...game.toObject(), triggeredMines, triggeredRewards });
        io.to(room).emit('gameOver', {
          winner: gameOverResult.winner,
          scores: game.scores,
          board: game.board,
          history: game.history,
          reason: gameOverResult.reason
        });
        return;
      }

      await game.save();
      game = await Game.findById(gameId).populate('player1', 'username').populate('player2', 'username');
      io.to(room).emit('gameUpdate', { ...game.toObject(), triggeredMines, triggeredRewards });
    });

    // Pas geçme
    socket.on('passTurn', async ({ gameId, userId }) => {
      const room = `game_${gameId}`;
      let game = await Game.findById(gameId);
      if (!game) return socket.emit('error', { message: 'Oyun bulunamadı' });
      if (game.status !== 'active') return socket.emit('error', { message: 'Oyun aktif değil' });
      if (String(game.turn) !== userId) return socket.emit('error', { message: 'Sıra sizde değil' });
      // Sıra değiştir
      if (String(game.player1) === userId) {
        game.turn = game.player2;
      } else {
        game.turn = game.player1;
      }
      addHistoryEntry(game, { userId, action: 'pass', time: new Date() });
      // Oyun sonu kontrolü
      const gameOverResult = checkGameOver(game);
      if (gameOverResult.isOver) {
        game.status = 'finished';
        game.winner = gameOverResult.winner;
        await game.save();
        io.to(room).emit('gameUpdate', game);
        io.to(room).emit('gameOver', {
          winner: gameOverResult.winner,
          scores: game.scores,
          board: game.board,
          history: game.history,
          reason: gameOverResult.reason
        });
        return;
      }
      await game.save();
      io.to(room).emit('gameUpdate', game);
    });

    // Teslim olma
    socket.on('surrender', async ({ gameId, userId }) => {
      const room = `game_${gameId}`;
      let game = await Game.findById(gameId);
      if (!game) return socket.emit('error', { message: 'Oyun bulunamadı' });
      if (game.status !== 'active') return socket.emit('error', { message: 'Oyun aktif değil' });
      // Kazananı belirle
      let winner = String(game.player1) === userId ? game.player2 : game.player1;
      game.status = 'finished';
      game.winner = winner;
      addHistoryEntry(game, { userId, action: 'surrender', time: new Date() });
      // Oyun sonu kontrolü (teslimde anında bitir)
      game.status = 'finished';
      game.winner = winner;
      await game.save();
      io.to(room).emit('gameUpdate', game);
      io.to(room).emit('gameOver', {
        winner,
        scores: game.scores,
        board: game.board,
        history: game.history,
        reason: 'surrender'
      });
    });

    // Bağlantı kopması
    socket.on('disconnect', () => {
      // Oyun ID ve kullanıcı ID socket.data'da tutuluyor
      // Burada loglama veya başka işlem yapılabilir
      // console.log('Kullanıcı bağlantısı koptu:', socket.data);
    });
  });
};
