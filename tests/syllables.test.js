// tests/syllables.test.js
// 150+ words with correct syllable counts from dictionary sources

var Readability = require('../readability.js');

var testWords = {
  // 1-syllable words
  'the': 1, 'cat': 1, 'sat': 1, 'on': 1, 'mat': 1, 'run': 1,
  'jump': 1, 'dog': 1, 'fish': 1, 'bird': 1, 'tree': 1, 'house': 1,
  'car': 1, 'door': 1, 'book': 1, 'light': 1, 'night': 1, 'dark': 1,
  'cold': 1, 'hot': 1, 'big': 1, 'small': 1, 'good': 1, 'bad': 1,
  'fast': 1, 'slow': 1, 'high': 1, 'low': 1, 'new': 1, 'old': 1,
  'come': 1, 'go': 1, 'make': 1, 'take': 1, 'give': 1, 'find': 1,
  'know': 1, 'think': 1, 'feel': 1, 'see': 1, 'hear': 1, 'work': 1,
  'play': 1, 'read': 1, 'write': 1, 'speak': 1, 'walk': 1, 'talk': 1,
  'love': 1, 'live': 1, 'die': 1, 'look': 1, 'hand': 1, 'eye': 1,
  'face': 1, 'world': 1, 'school': 1, 'thought': 1, 'through': 1,
  'change': 1, 'place': 1, 'while': 1, 'once': 1, 'use': 1,

  // 2-syllable words
  'about': 2, 'after': 2, 'also': 2, 'never': 2, 'even': 2,
  'over': 2, 'under': 2, 'water': 2, 'people': 2, 'little': 2,
  'into': 2, 'garden': 2, 'mother': 2, 'father': 2, 'brother': 2,
  'sister': 2, 'country': 2, 'music': 2, 'picture': 2, 'river': 2,
  'city': 2, 'money': 2, 'number': 2, 'power': 2, 'moment': 2,
  'table': 2, 'woman': 2, 'children': 2, 'within': 2, 'begin': 2,
  'create': 2, 'machine': 2, 'engine': 2, 'minute': 2, 'welcome': 2,
  'forest': 2, 'mountain': 2, 'ocean': 2, 'kingdom': 2, 'purpose': 2,
  'husband': 2, 'sentence': 2, 'problem': 2,

  // 3-syllable words
  'beautiful': 3, 'wonderful': 3, 'important': 3, 'different': 3,
  'hospital': 3, 'family': 3, 'animal': 3, 'company': 3,
  'computer': 3, 'remember': 3, 'together': 3, 'idea': 3,
  'area': 3, 'chocolate': 3, 'recipe': 3, 'general': 3,
  'several': 3, 'camera': 3, 'library': 3, 'history': 3,
  'natural': 3, 'national': 3, 'character': 3, 'possible': 3,
  'terrible': 3, 'energy': 3, 'industry': 3, 'discover': 3,
  'adventure': 3, 'otherwise': 3, 'umbrella': 3, 'realize': 3,
  'continue': 3, 'favorite': 3, 'positive': 3, 'negative': 3,
  'exercise': 3,

  // 4-syllable words
  'experience': 4, 'interesting': 4, 'information': 4, 'education': 4,
  'particular': 4, 'community': 4, 'technology': 4, 'communication': 4,
  'situation': 4, 'environment': 4, 'development': 4, 'population': 4,
  'temperature': 4, 'literature': 4, 'architecture': 4, 'investigate': 4,
  'appreciate': 4, 'uncomfortable': 4, 'independent': 4, 'material': 4,

  // 5-syllable words
  'communication': 5, 'organization': 5, 'imagination': 5,
  'international': 5, 'unfortunately': 5, 'approximately': 5,
  'individual': 5, 'psychological': 5,

  // Tricky words
  'poem': 2, 'science': 2, 'being': 2, 'quiet': 2,
  'every': 3, 'period': 3, 'business': 2, 'radio': 3,
  'video': 3, 'studio': 3, 'created': 3, 'walked': 1,
  'jumped': 1, 'called': 1, 'started': 2, 'wanted': 2,
  'needed': 2, 'added': 2, 'decided': 3, 'opened': 2,
  'moved': 1, 'turned': 1, 'watched': 1,

  // Hyphenated words
  'self-esteem': 3, 'well-known': 2, 'old-fashioned': 3,

  // Silent e words
  'time': 1, 'name': 1, 'same': 1, 'life': 1, 'like': 1,
  'home': 1, 'hope': 1, 'note': 1, 'white': 1, 'state': 1,
};

var totalTests = 0;
var correct = 0;
var failures = [];

for (var word in testWords) {
  if (!testWords.hasOwnProperty(word)) continue;
  totalTests++;
  var expected = testWords[word];
  var got = Readability.countSyllables(word);
  if (got === expected) {
    correct++;
  } else {
    failures.push({ word: word, expected: expected, got: got });
  }
}

var accuracy = ((correct / totalTests) * 100).toFixed(1);

console.log('Syllable counting test results:');
console.log('Total words: ' + totalTests);
console.log('Correct: ' + correct);
console.log('Accuracy: ' + accuracy + '%');

if (failures.length > 0) {
  console.log('\nFailed words:');
  for (var i = 0; i < failures.length; i++) {
    console.log('  ' + failures[i].word + ': expected ' + failures[i].expected + ', got ' + failures[i].got);
  }
}

if (parseFloat(accuracy) < 95) {
  console.log('\nWARNING: Accuracy is below 95% target!');
  process.exit(1);
} else {
  console.log('\nPASS: Accuracy meets 95% target.');
}
