// tests/textprocessing.test.js
var Readability = require('../readability.js');
var passed = 0;
var failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.log('FAIL: ' + message);
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
  } else {
    failed++;
    console.log('FAIL: ' + message);
    console.log('  Expected:', JSON.stringify(expected));
    console.log('  Got:', JSON.stringify(actual));
  }
}

// ===== NORMALISE =====
console.log('\n--- Normalise ---');

var r1 = Readability.normalise('\u201CHello,\u201D she said.');
assert(r1.normalised === '"Hello," she said.', 'Curly quotes normalised');

var r2 = Readability.normalise('a   b   c');
assert(r2.normalised === 'a b c', 'Collapsed repeated spaces');

var r3 = Readability.normalise('a\nb');
assert(r3.normalised === 'a\nb', 'Newlines preserved');

var r4 = Readability.normalise('a\r\nb');
assert(r4.normalised === 'a\nb', 'Windows line endings converted');

var r5 = Readability.normalise(null);
assertEqual(r5, { normalised: '', original: '' }, 'Null input');

var r6 = Readability.normalise('');
assertEqual(r6, { normalised: '', original: '' }, 'Empty input');

// ===== SPLIT PARAGRAPHS =====
console.log('\n--- Split Paragraphs ---');

var p1 = Readability.splitParagraphs('Hello world.\n\nSecond paragraph.');
assert(p1.length === 2, 'Two paragraphs');
assert(p1[0].text === 'Hello world.', 'First paragraph text');
assert(p1[1].text === 'Second paragraph.', 'Second paragraph text');

var p2 = Readability.splitParagraphs('Just one paragraph.');
assert(p2.length === 1, 'Single paragraph');

var p3 = Readability.splitParagraphs('');
assert(p3.length === 0, 'Empty text = no paragraphs');

var p4 = Readability.splitParagraphs('One.\n\nTwo.\n\n\nThree.');
assert(p4.length === 3, 'Three paragraphs with extra newlines');

// ===== SPLIT SENTENCES =====
console.log('\n--- Split Sentences ---');

var s1 = Readability.splitSentences('The cat sat. The dog ran.');
assert(s1.length === 2, 'Two sentences on period');
assert(s1[0].text === 'The cat sat.', 'First sentence text');
assert(s1[1].text === 'The dog ran.', 'Second sentence text');

var s2 = Readability.splitSentences('Hello! How are you? Fine.');
assert(s2.length === 3, 'Split on ! and ?');

// Abbreviations should NOT split
var s3 = Readability.splitSentences('Dr. Smith went home.');
assert(s3.length === 1, 'Dr. does not split: got ' + s3.length);

var s4 = Readability.splitSentences('Mr. and Mrs. Jones arrived.');
assert(s4.length === 1, 'Mr. and Mrs. do not split');

var s5 = Readability.splitSentences('She said etc. and left.');
assert(s5.length === 1, 'etc. does not split');

// Initials
var s6 = Readability.splitSentences('J. K. Rowling wrote Harry Potter.');
assert(s6.length === 1, 'Initials do not split: got ' + s6.length + ': ' + JSON.stringify(s6.map(function(s){return s.text})));

// Ellipsis
var s7 = Readability.splitSentences('Wait... I know. Yes.');
assert(s7.length === 3, 'Ellipsis ends sentence: got ' + s7.length);

// Newline as boundary
var s8 = Readability.splitSentences('First line\nSecond line');
assert(s8.length === 2, 'Newline splits sentences');

// Dialogue with tag: ONE sentence
var s9 = Readability.splitSentences('"Come here!" she shouted.');
assert(s9.length === 1, 'Dialogue with tag is one sentence: got ' + s9.length + ': ' + JSON.stringify(s9.map(function(s){return s.text})));

// Dialogue without tag: two sentences
var s10 = Readability.splitSentences('"Come here!" The door opened.');
assert(s10.length === 2, 'Dialogue without tag is two sentences: got ' + s10.length);

// Sentence offsets
var testText = 'Hello. World.';
var s11 = Readability.splitSentences(testText);
assert(s11.length === 2, 'Two sentences for offset test');
if (s11.length === 2) {
  assert(s11[0].startOffset === 0, 'First sentence starts at 0');
  assert(s11[1].startOffset === 7, 'Second sentence starts at 7: got ' + s11[1].startOffset);
}

// ===== TOKENISE WORDS =====
console.log('\n--- Tokenise Words ---');

var w1 = Readability.tokeniseWords('The cat sat on the mat.');
assertEqual(w1, ['The', 'cat', 'sat', 'on', 'the', 'mat'], 'Basic tokenisation');

var w2 = Readability.tokeniseWords("don't won't");
assertEqual(w2, ["don't", "won't"], 'Apostrophes kept');

var w3 = Readability.tokeniseWords('self-esteem is important');
assertEqual(w3, ['self-esteem', 'is', 'important'], 'Hyphens kept');

var w4 = Readability.tokeniseWords('He has 42 cats and 1,000 dogs.');
assert(w4.indexOf('42') !== -1, 'Numbers counted as words');
assert(w4.indexOf('1,000') !== -1, 'Comma numbers counted');
assert(w4.length === 7, 'Correct word count with numbers: got ' + w4.length);

var w5 = Readability.tokeniseWords('');
assertEqual(w5, [], 'Empty text = no words');

var w6 = Readability.tokeniseWords('... --- !!!');
assertEqual(w6, [], 'Standalone punctuation ignored');

// ===== SYLLABLE COUNTING =====
console.log('\n--- Syllable Counting ---');

assert(Readability.countSyllables('cat') === 1, 'cat = 1');
assert(Readability.countSyllables('table') === 2, 'table = 2');
assert(Readability.countSyllables('beautiful') === 3, 'beautiful = 3');
assert(Readability.countSyllables('interesting') === 4, 'interesting = 4');
assert(Readability.countSyllables('communication') === 5, 'communication = 5');
assert(Readability.countSyllables('self-esteem') === 3, 'self-esteem = 3');
assert(Readability.countSyllables('42') === 1, '42 = 1 syllable');

// ===== THE CAT SAT ON THE MAT =====
console.log('\n--- The cat sat on the mat ---');
var catStats = Readability.computeStats('The cat sat on the mat.', null);
assert(catStats !== null, 'Stats computed');
assert(catStats.wordCount === 6, 'Word count = 6: got ' + catStats.wordCount);
assert(catStats.sentenceCount === 1, 'Sentence count = 1: got ' + catStats.sentenceCount);
// Flesch RE raw = 206.835 - 1.015*(6/1) - 84.6*(6/6) = 206.835 - 6.09 - 84.6 = 116.145
// Clamped to 100
assert(catStats.fleschReadingEase === 100, 'Flesch RE = 100 (clamped from ~116): got ' + catStats.fleschReadingEase);

// ===== SUMMARY =====
console.log('\n=== Results ===');
console.log('Passed: ' + passed);
console.log('Failed: ' + failed);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed!');
}
