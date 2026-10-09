var fs = require('fs');
var Readability = require('../readability.js');

var text = fs.readFileSync(0, 'utf-8'); // read from stdin
var stats = Readability.computeStats(text, null);

if (!stats) {
  console.log(JSON.stringify({error: 'No stats computed'}));
  process.exit(1);
}

console.log(JSON.stringify({
  flesch_reading_ease: stats.fleschReadingEase,
  flesch_kincaid_grade: stats.fleschKincaid,
  gunning_fog: stats.gunningFog,
  coleman_liau_index: stats.colemanLiau,
  ari: stats.ari,
  smog: stats.smog,
  word_count: stats.wordCount,
  sentence_count: stats.sentenceCount,
  syllable_count: stats.syllableCount,
  letters_count: stats.wordCount * (stats.colemanLiau + 15.8 + 0.296 * (stats.sentenceCount/stats.wordCount * 100)) / 0.0588 // rough approx
}));
