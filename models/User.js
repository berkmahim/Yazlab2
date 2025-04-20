const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  games: { type: [String], default: [] },
  winCount: { type: Number, default: 0 },
  lossCount: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', userSchema);
