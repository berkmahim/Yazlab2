// Puan hesaplama algoritması
const path = require('path');
const fs = require('fs');

const LETTER_POOL_PATH = path.join(__dirname, '../letterpool.json');

function getLetterScores() {
  // { A: 1, B: 3, ... }
  try {
    const data = fs.readFileSync(LETTER_POOL_PATH, 'utf8');
    const arr = JSON.parse(data);
    const map = {};
    for (const item of arr) {
      map[item.letter] = item.point;
    }
    map['JOKER'] = 0;
    return map;
  } catch (err) {
    console.error('Harf puanları okunamadı:', err.message);
    return {};
  }
}

// specialSquares: board ile aynı boyutta, her hücrede "", "DL", "TL", "DW", "TW" olabilir
// placedTiles: [{x, y, letter}]
// formedWords: ["KÜPE", ...]
// usedTiles: ["K", "Ü", ...]
function calculateMoveScore({
  board,
  specialSquares,
  placedTiles,
  formedWords,
  usedTiles
}) {
  const letterScores = getLetterScores();
  let totalScore = 0;
  let bingo = usedTiles && usedTiles.length === 7;

  for (const word of formedWords) {
    let wordScore = 0;
    let wordMultiplier = 1;
    // Her harfi ve pozisyonunu bul
    // placedTiles içindeki harflerin x,y'sini word'e eşle
    // (Basit: Sadece yeni konan harflerin bonusunu uygula. Gelişmiş: Tüm harflerin bonusunu uygula.)
    for (const tile of placedTiles) {
      const { x, y, letter } = tile;
      let score = letterScores[letter] || 0;
      let cellBonus = specialSquares[y][x] || '';
      if (letter === 'JOKER') score = 0;
      if (cellBonus === 'DL') score *= 2;
      else if (cellBonus === 'TL') score *= 3;
      else if (cellBonus === 'DW') wordMultiplier *= 2;
      else if (cellBonus === 'TW') wordMultiplier *= 3;
      wordScore += score;
    }
    totalScore += wordScore * wordMultiplier;
  }
  if (bingo) totalScore += 50;
  return totalScore;
}

module.exports = {
  calculateMoveScore
};
