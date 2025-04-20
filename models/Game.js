const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  player1: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  player2: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  board: {
    type: [[String]], // 15x15 matris
    default: Array.from({ length: 15 }, () => Array(15).fill(''))
  },
  player1Tiles: { type: [String], default: [] },
  player2Tiles: { type: [String], default: [] },
  turn: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['waiting', 'active', 'finished'], default: 'waiting' },
  startTime: { type: Date },
  selectedDuration: { type: String, required: true },
  remainingTiles: { type: [String], default: [] },
  history: { type: Array, default: [] },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Game', gameSchema);
