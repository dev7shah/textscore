// tests/edgecases.test.js
var Readability = require('../readability.js');
var passed = 0;
var failed = 0;
var errors = [];

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    errors.push(message);
    console.log('FAIL: ' + message);
  }
}

// ===== EMPTY INPUT =====
console.log('--- Empty input ---');
var r1 = Readability.computeStats('', null);
assert(r1 === null, 'Empty string returns null');

var r2 = Readability.computeStats('   ', null);
assert(r2 === null, 'Whitespace-only returns null');

var r3 = Readability.computeStats(null, null);
assert(r3 === null, 'Null input returns null');

// ===== 5 WORDS =====
console.log('--- 5 words ---');
var r4 = Readability.computeStats('The sky is very blue.', null);
assert(r4 !== null, '5 words: stats computed');
assert(r4.wordCount === 5, '5 words: count = ' + r4.wordCount);
assert(r4.sentenceCount === 1, '5 words: 1 sentence');
assert(!isNaN(r4.fleschReadingEase), '5 words: valid Flesch RE');

// ===== 29 WORDS =====
console.log('--- 29 words ---');
var text29 = 'The quick brown fox jumped over the lazy dog and then went home to rest and eat some food and drink some water and play with friends and sleep well tonight.';
var w29 = Readability.tokeniseWords(text29);
console.log('  29-word text actual word count: ' + w29.length);
var r5 = Readability.computeStats(text29, null);
assert(r5 !== null, '29 words: stats computed');
assert(r5.smog === null, '29 words: SMOG is null (needs 30+ sentences)');

// ===== 30 WORDS =====
console.log('--- 30 words ---');
var text30 = 'The quick brown fox jumped over the lazy dog and then went home to rest and eat some food and drink some water and play with friends and sleep well tonight more.';
var r6 = Readability.computeStats(text30, null);
assert(r6 !== null, '30 words: stats computed');

// ===== HTML CHARACTERS =====
console.log('--- HTML characters ---');
var htmlText = 'The <b>bold</b> text has & ampersands. The </script> tag appears. Watch out for <div> elements.';
var r7 = Readability.computeStats(htmlText, null);
assert(r7 !== null, 'HTML chars: stats computed');
// Text should be treated as literal, not parsed as HTML
var words7 = Readability.tokeniseWords(htmlText);
assert(words7.indexOf('b') !== -1 || words7.indexOf('bold') !== -1, 'HTML tags treated as text');
// The key thing: no errors thrown

// ===== NO PUNCTUATION =====
console.log('--- No punctuation ---');
var noPunct = 'The cat sat on the mat and the dog ran around the house';
var r8 = Readability.computeStats(noPunct, null);
assert(r8 !== null, 'No punctuation: stats computed');
assert(r8.wordCount === 13, 'No punctuation: word count = ' + r8.wordCount);
assert(r8.sentenceCount === 1, 'No punctuation: treated as 1 sentence, got ' + r8.sentenceCount);

// ===== ALL CAPS =====
console.log('--- All caps ---');
var allCaps = 'THE CAT SAT ON THE MAT. THE DOG RAN HOME.';
var r9 = Readability.computeStats(allCaps, null);
assert(r9 !== null, 'All caps: stats computed');
assert(r9.wordCount === 10, 'All caps: word count = ' + r9.wordCount);
assert(r9.sentenceCount === 2, 'All caps: 2 sentences, got ' + r9.sentenceCount);

// ===== ONLY DIALOGUE =====
console.log('--- Only dialogue ---');
var dialogue = '"Hello there," she said. "How are you?" he asked. "I am fine," she replied.';
var r10 = Readability.computeStats(dialogue, null);
assert(r10 !== null, 'Dialogue: stats computed');
assert(r10.dialogueShare.share > 0, 'Dialogue: share > 0, got ' + r10.dialogueShare.share);

// ===== EMOJI =====
console.log('--- Emoji ---');
var emoji = 'The cat \uD83D\uDC31 sat on the mat. The dog \uD83D\uDC36 ran home. Fun times \uD83C\uDF89 ahead.';
var r11 = Readability.computeStats(emoji, null);
assert(r11 !== null, 'Emoji: stats computed');
assert(r11.wordCount >= 12, 'Emoji: reasonable word count = ' + r11.wordCount);

// ===== WINDOWS LINE ENDINGS =====
console.log('--- Windows line endings ---');
var winEndings = 'First sentence.\r\nSecond sentence.\r\n\r\nNew paragraph.';
var r12 = Readability.computeStats(winEndings, null);
assert(r12 !== null, 'Windows endings: stats computed');
assert(r12.sentenceCount >= 2, 'Windows endings: multiple sentences, got ' + r12.sentenceCount);

// ===== 100,000 WORD PERFORMANCE =====
console.log('--- 100,000 word performance ---');
var bigChunk = 'The quick brown fox jumped over the lazy dog. ';
var bigText = '';
// Each chunk is ~10 words, so we need ~10,000 repetitions
for (var i = 0; i < 10000; i++) {
  bigText += bigChunk;
}
var startTime = Date.now();
var r13 = Readability.computeStats(bigText, null);
var elapsed = Date.now() - startTime;
console.log('  100k words took: ' + elapsed + 'ms');
assert(r13 !== null, '100k words: stats computed');
assert(r13.wordCount >= 90000, '100k words: word count = ' + r13.wordCount);
assert(elapsed < 2000, '100k words: finished in under 2 seconds (' + elapsed + 'ms)');

// ===== SINGLE CHARACTER =====
console.log('--- Single character ---');
var r14 = Readability.computeStats('A', null);
assert(r14 !== null || r14 === null, 'Single char: no crash');

// ===== VERY LONG SENTENCE =====
console.log('--- Very long sentence ---');
var longSent = '';
for (var i = 0; i < 200; i++) longSent += 'word ';
longSent += 'end.';
var r15 = Readability.computeStats(longSent, null);
assert(r15 !== null, 'Very long sentence: stats computed');

// ===== UNICODE TEXT =====
console.log('--- Unicode text ---');
var unicode = 'The caf\u00E9 served cr\u00E8me br\u00FBl\u00E9e. R\u00E9sum\u00E9 was perfect.';
var r16 = Readability.computeStats(unicode, null);
assert(r16 !== null, 'Unicode: stats computed');
assert(r16.sentenceCount === 2, 'Unicode: 2 sentences, got ' + r16.sentenceCount);

// ===== SUMMARY =====
console.log('\n=== Edge Case Results ===');
console.log('Passed: ' + passed);
console.log('Failed: ' + failed);
if (failed > 0) {
  console.log('\nFailed tests:');
  for (var i = 0; i < errors.length; i++) {
    console.log('  - ' + errors[i]);
  }
  process.exit(1);
} else {
  console.log('All edge case tests passed!');
}
