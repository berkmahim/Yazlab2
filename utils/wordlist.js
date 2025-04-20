// Türkçe kelime sözlüğü yükleyici ve kontrolcü
const fs = require('fs');
const path = require('path');

// Sözlük dosya yolu: kolayca değiştirilebilir
const DEFAULT_WORDLIST_PATH = path.join(__dirname, '../kelimeler.txt'); // Her satırda bir kelime

let wordSet = null;
let loadedPath = null;

function loadWordList(wordlistPath = DEFAULT_WORDLIST_PATH) {
  if (wordSet && loadedPath === wordlistPath) return wordSet;
  try {
    const raw = fs.readFileSync(wordlistPath, 'utf8');
    const words = raw.split(/\r?\n/).map(w => w.trim().toUpperCase()).filter(Boolean);
    wordSet = new Set(words);
    loadedPath = wordlistPath;
    console.log(`Kelime sözlüğü (${words.length} kelime) yüklendi.`);
    return wordSet;
  } catch (err) {
    console.error('Kelime sözlüğü yüklenemedi:', err.message);
    wordSet = new Set();
    return wordSet;
  }
}

function isWordValid(word, wordlistPath = DEFAULT_WORDLIST_PATH) {
  if (!wordSet || loadedPath !== wordlistPath) {
    loadWordList(wordlistPath);
  }
  return wordSet.has(word.trim().toUpperCase());
}

module.exports = {
  loadWordList,
  isWordValid,
  DEFAULT_WORDLIST_PATH
};
