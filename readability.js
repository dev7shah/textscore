// readability.js — pure functions, no DOM access
// UMD wrapper for browser + Node compatibility
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Readability = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ===== STEP 1: TEXT PROCESSING =====

  /**
   * Normalise curly quotes and apostrophes to straight forms for matching.
   * Collapse repeated spaces. Keep newlines.
   * Returns { normalised, original } so display uses original text.
   */
  function normalise(text) {
    if (typeof text !== 'string') return { normalised: '', original: '' };
    var original = text;
    // Replace Windows line endings with Unix
    var n = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Curly quotes to straight
    n = n.replace(/[\u2018\u2019\u201A\u2032]/g, "'");
    n = n.replace(/[\u201C\u201D\u201E\u2033]/g, '"');
    // Collapse repeated spaces (not newlines)
    n = n.replace(/[^\S\n]+/g, ' ');
    // Trim lines
    n = n.split('\n').map(function (line) { return line.trim(); }).join('\n');
    return { normalised: n, original: original.replace(/\r\n/g, '\n').replace(/\r/g, '\n') };
  }

  /**
   * Split text into paragraphs on blank lines.
   * Returns array of { text, startOffset, endOffset }.
   */
  function splitParagraphs(text) {
    if (!text || !text.trim()) return [];
    var paragraphs = [];
    var re = /\n\s*\n/g;
    var lastEnd = 0;
    var match;
    while ((match = re.exec(text)) !== null) {
      var pText = text.slice(lastEnd, match.index);
      if (pText.trim()) {
        paragraphs.push({
          text: pText.trim(),
          startOffset: lastEnd,
          endOffset: match.index
        });
      }
      lastEnd = match.index + match[0].length;
    }
    // Last paragraph
    var remaining = text.slice(lastEnd);
    if (remaining.trim()) {
      paragraphs.push({
        text: remaining.trim(),
        startOffset: lastEnd,
        endOffset: text.length
      });
    }
    return paragraphs;
  }

  // Abbreviations that should not end a sentence
  var ABBREVIATIONS = [
    'mr', 'mrs', 'ms', 'dr', 'st', 'prof', 'sr', 'jr',
    'vs', 'etc', 'no', 'e\\.g', 'i\\.e',
    'gen', 'gov', 'sgt', 'cpl', 'pvt', 'capt', 'lt', 'col',
    'rev', 'hon', 'est', 'dept', 'univ', 'assn'
  ];

  /**
   * Split text into sentences, keeping character offsets into the ORIGINAL text.
   * Handles abbreviations, dialogue tags, initials, newlines as boundaries.
   */
  function splitSentences(text) {
    if (!text || !text.trim()) return [];

    var sentences = [];
    var i = 0;
    var len = text.length;
    var sentenceStart = 0;

    // Skip leading whitespace
    while (sentenceStart < len && /\s/.test(text[sentenceStart])) {
      sentenceStart++;
    }

    i = sentenceStart;

    while (i < len) {
      var ch = text[i];

      // Newline is a sentence boundary
      if (ch === '\n') {
        var sentText = text.slice(sentenceStart, i).trim();
        if (sentText.length > 0) {
          sentences.push({
            text: sentText,
            startOffset: sentenceStart,
            endOffset: i
          });
        }
        // Skip whitespace to next sentence
        i++;
        while (i < len && /[ \t]/.test(text[i])) i++;
        sentenceStart = i;
        continue;
      }

      // Check for sentence-ending punctuation
      if (ch === '.' || ch === '!' || ch === '?') {
        // Check for ellipsis
        var punctEnd = i + 1;
        if (ch === '.') {
          while (punctEnd < len && text[punctEnd] === '.') punctEnd++;
        }

        // Check for abbreviation (only for single period)
        if (ch === '.' && punctEnd === i + 1) {
          if (isAbbreviation(text, i)) {
            i = punctEnd;
            continue;
          }
          // Check for single capital initial like "J. K. Rowling"
          if (isSingleInitial(text, i)) {
            i = punctEnd;
            continue;
          }
        }

        // Skip optional closing quotes/brackets after punctuation
        var afterPunct = punctEnd;
        while (afterPunct < len && /['""\u201D\u2019\)\]\}]/.test(text[afterPunct])) {
          afterPunct++;
        }

        // Check if followed by whitespace or end of text
        if (afterPunct >= len || /\s/.test(text[afterPunct])) {
          // Check for dialogue continuation: "Come here," she said.
          // If we're inside quotes ending with comma, don't split
          // But for terminal punctuation (. ! ?) inside quotes, we DO split
          // unless followed by a dialogue tag (lowercase word)

          // Check if this is inside a quote and followed by a dialogue tag
          if (isDialogueWithTag(text, afterPunct)) {
            i = afterPunct;
            continue;
          }

          var sentText2 = text.slice(sentenceStart, afterPunct).trim();
          if (sentText2.length > 0) {
            sentences.push({
              text: sentText2,
              startOffset: sentenceStart,
              endOffset: afterPunct
            });
          }
          i = afterPunct;
          while (i < len && /[ \t]/.test(text[i])) i++;
          sentenceStart = i;
          continue;
        }

        i = punctEnd;
        continue;
      }

      // Handle comma inside dialogue: "Come here," she said.
      // This is ONE sentence, so we don't split on comma in quotes
      i++;
    }

    // Remaining text
    var remaining = text.slice(sentenceStart).trim();
    if (remaining.length > 0) {
      sentences.push({
        text: remaining,
        startOffset: sentenceStart,
        endOffset: len
      });
    }

    return sentences;
  }

  function isAbbreviation(text, dotPos) {
    // Find the word before the dot
    var wordStart = dotPos - 1;
    while (wordStart >= 0 && /[a-zA-Z.]/.test(text[wordStart])) {
      wordStart--;
    }
    wordStart++;
    var word = text.slice(wordStart, dotPos).toLowerCase();
    // Remove any dots from the word for matching (e.g. "e.g" -> "eg")
    var wordNoDots = word.replace(/\./g, '');

    for (var a = 0; a < ABBREVIATIONS.length; a++) {
      var abbr = ABBREVIATIONS[a].replace(/\\\./g, '');
      if (wordNoDots === abbr) return true;
    }
    return false;
  }

  function isSingleInitial(text, dotPos) {
    // Single uppercase letter before the dot
    if (dotPos < 1) return false;
    var before = text[dotPos - 1];
    if (!/[A-Z]/.test(before)) return false;
    // Must be preceded by whitespace or start of text or another initial pattern
    if (dotPos >= 2 && /[a-zA-Z]/.test(text[dotPos - 2])) return false;
    // Check if followed by space and another capital letter (part of name)
    var after = dotPos + 1;
    while (after < text.length && text[after] === ' ') after++;
    if (after < text.length && /[A-Z]/.test(text[after])) return true;
    return false;
  }

  function isDialogueWithTag(text, afterPunct) {
    // Check if the punctuation is inside quotes and followed by a dialogue tag
    // Look backwards for an opening quote
    var searchStart = Math.max(0, afterPunct - 300);
    var segment = text.slice(searchStart, afterPunct);

    // Count quotes to see if we're inside dialogue
    var quoteCount = 0;
    for (var q = 0; q < segment.length; q++) {
      if (segment[q] === '"' || segment[q] === '\u201C' || segment[q] === '\u201D') {
        quoteCount++;
      }
    }

    // If odd number of quotes, we might be inside dialogue
    // But for terminal punctuation, we usually DO want to end the sentence
    // The rule is: dialogue + tag = one sentence
    // e.g., "Come here!" she shouted. = one sentence
    // But: "Come here!" The door opened. = two sentences

    if (quoteCount % 2 === 1) return false; // Not at a quote boundary

    // Check if closing quote is right before punctEnd and followed by lowercase
    var pos = afterPunct;
    while (pos < text.length && /\s/.test(text[pos])) pos++;
    if (pos < text.length && /[a-z]/.test(text[pos])) {
      // Followed by lowercase - likely a dialogue tag like "she said"
      // Check that we just ended a quote
      var beforeSpace = afterPunct - 1;
      while (beforeSpace >= 0 && /['""\u201D\u2019\)\]\}]/.test(text[beforeSpace])) {
        beforeSpace--;
      }
      // Check if the character before the closing symbols is punctuation
      if (beforeSpace >= 0 && /[.!?,]/.test(text[beforeSpace])) {
        // And there's a quote in the closing symbols
        var closingBit = text.slice(beforeSpace + 1, afterPunct);
        if (/['""\u201D]/.test(closingBit)) {
          return true; // dialogue with tag
        }
      }
    }
    return false;
  }

  /**
   * Tokenise a sentence into words.
   * Words: letters plus internal apostrophes and hyphens.
   * Numbers count as words. Ignore standalone punctuation.
   */
  function tokeniseWords(text) {
    if (!text) return [];
    var words = [];
    // Match word-like tokens: letters/digits with internal apostrophes/hyphens
    var re = /[a-zA-Z\u00C0-\u024F](?:[a-zA-Z\u00C0-\u024F'''\-]*[a-zA-Z\u00C0-\u024F])?|[0-9]+(?:,?[0-9]+)*/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      words.push(m[0]);
    }
    return words;
  }

  // ===== STEP 2: SYLLABLE COUNTING =====

  var SYLLABLE_EXCEPTIONS = {
    'the': 1, 'he': 1, 'she': 1, 'we': 1, 'me': 1, 'be': 1,
    'created': 3, 'idea': 3, 'area': 3, 'poem': 2, 'poems': 2,
    'science': 2, 'sciences': 3, 'being': 2, 'quiet': 2, 'quietly': 3,
    'every': 3, 'everything': 4, 'everyone': 3, 'everywhere': 3,
    'beautiful': 3, 'beautifully': 4, 'realize': 3, 'realized': 3,
    'experience': 4, 'experienced': 4, 'experiences': 5,
    'radio': 3, 'period': 3, 'periods': 3, 'periodic': 4,
    'business': 2, 'businesses': 3,
    'different': 3, 'differently': 4,
    'family': 3, 'families': 3,
    'interesting': 4, 'interested': 4, 'interestingly': 5,
    'are': 1, 'were': 1, 'where': 1, 'there': 1, 'here': 1,
    'some': 1, 'come': 1, 'done': 1, 'gone': 1, 'none': 1,
    'one': 1, 'once': 1, 'have': 1, 'give': 1, 'live': 1,
    'love': 1, 'move': 1, 'prove': 1,
    'above': 2, 'before': 2, 'became': 2,
    'people': 2, 'little': 2, 'gentle': 2,
    'simple': 2, 'purple': 2, 'single': 2,
    'double': 2, 'trouble': 2, 'couple': 2,
    'able': 2, 'table': 2, 'fable': 2, 'stable': 2,
    'noble': 2, 'bible': 2,
    'apple': 2, 'ripple': 2, 'supple': 2, 'maple': 2,
    'circle': 2, 'article': 3, 'particle': 3, 'miracle': 3,
    'vehicle': 3, 'obstacle': 3,
    'possible': 3, 'impossible': 4,
    'terrible': 3, 'horrible': 3, 'incredible': 4,
    'comfortable': 3, 'uncomfortable': 4,
    'reasonable': 4, 'unreasonable': 5,
    'available': 4, 'unavailable': 5,
    'valuable': 4, 'invaluable': 5,
    'chocolate': 3, 'separate': 3, 'desperate': 3,
    'camera': 3, 'general': 3, 'several': 3,
    'natural': 3, 'federal': 3, 'mineral': 3,
    'animal': 3, 'criminal': 3, 'original': 4,
    'national': 3, 'international': 5,
    'material': 4, 'materials': 4,
    'particularly': 6, 'particular': 4,
    'extraordinary': 6, 'ordinary': 4,
    'library': 3, 'secretary': 4,
    'february': 4, 'january': 4,
    'dictionary': 4, 'vocabulary': 5,
    'temporary': 4, 'contemporary': 5,
    'necessary': 4, 'unnecessary': 5,
    'literary': 4, 'military': 4,
    'ordinary': 4, 'imaginary': 5,
    'ceremony': 4, 'testimony': 4,
    'category': 4, 'territory': 4,
    'laboratory': 5,
    'real': 1, 'deal': 1, 'meal': 1, 'steal': 1,
    'ocean': 2, 'european': 4,
    'create': 2, 'creates': 2,
    'evaluate': 4, 'evaluates': 4, 'evaluated': 5,
    'communicate': 4, 'communicates': 4,
    'appreciate': 4, 'appreciates': 4,
    'associate': 4, 'associates': 4,
    'negotiate': 4, 'negotiates': 4,
    'immediate': 4, 'immediately': 5,
    'accurate': 3, 'accurately': 4,
    'adequate': 3, 'inadequate': 4,
    'private': 2, 'climate': 2,
    'ultimate': 3, 'legitimate': 4,
    'estimate': 3, 'approximate': 4,
    'fortunate': 3, 'unfortunate': 4,
    'generate': 3, 'moderate': 3,
    'demonstrate': 3, 'elaborate': 4,
    'appropriate': 4, 'inappropriate': 5,
    'investigate': 4, 'investigate': 4,
    'cooperative': 5, 'incorporate': 4,
    'fire': 1, 'hire': 1, 'wire': 1, 'tire': 1,
    'desire': 2, 'entire': 2, 'require': 2, 'acquire': 2, 'inspire': 2, 'admire': 2, 'retire': 2,
    'aisle': 1, 'isle': 1,
    'recipe': 3,
    'maybe': 2, 'somethin': 2,
    'minute': 2, 'minutes': 2,
    'favorite': 3, 'favourite': 3,
    'rio': 2, 'ratio': 3, 'patio': 3,
    'video': 3, 'studio': 3,
    'audio': 3, 'portfolio': 4,
    'piano': 3, 'scenario': 4,
    'various': 3, 'previous': 3, 'obvious': 3,
    'serious': 3, 'curious': 3, 'religious': 3,
    'continuous': 4, 'individual': 5,
    'situation': 4, 'education': 4, 'population': 4,
    'information': 4, 'communication': 5,
    'imagination': 5, 'organization': 5,
    'ion': 2, 'lion': 2, 'million': 2, 'billion': 2,
    'onion': 2, 'opinion': 3, 'companion': 3,
    'champion': 3, 'region': 2,
    'religion': 3, 'decision': 3, 'vision': 2,
    'television': 4, 'division': 3,
    'occasion': 3, 'invasion': 3,
    'explosion': 3, 'conclusion': 3,
    'confusion': 3, 'inclusion': 3,
    'exclusion': 3, 'illusion': 3,
    'collision': 3, 'revision': 3,
    'expression': 3, 'impression': 3,
    'discussion': 3, 'permission': 3,
    'possession': 3, 'profession': 3,
    'depression': 3, 'obsession': 3,
    'session': 2, 'passion': 2, 'fashion': 2, 'fashioned': 2,
    'mission': 2, 'emission': 3, 'admission': 3, 'commission': 3,
    'action': 2, 'fraction': 2, 'reaction': 3,
    'function': 2, 'junction': 2,
    'question': 2, 'suggestion': 3,
    'mention': 2, 'attention': 3,
    'intention': 3, 'convention': 3,
    'prevention': 3, 'invention': 3,
    'connection': 3, 'collection': 3,
    'protection': 3, 'direction': 3,
    'election': 3, 'selection': 3,
    'infection': 3, 'perfection': 3,
    'section': 2, 'inspection': 3,
    'condition': 3, 'addition': 3, 'tradition': 3,
    'position': 3, 'opposition': 4, 'composition': 4,
    'proposition': 4, 'disposition': 4,
    'supposition': 4, 'recognition': 4,
    'acquisition': 4, 'exhibition': 4,
    'competition': 4, 'definition': 4,
    'repetition': 4, 'ammunition': 4,
    'nation': 2, 'station': 2,
    'patient': 2, 'ancient': 2,
    'efficient': 3, 'sufficient': 3,
    'science': 2, 'conscience': 2,
    'audience': 3, 'obedience': 4,
    'experience': 4, 'patience': 2,
    'violence': 3, 'evidence': 3,
    'influence': 3, 'conference': 3,
    'preference': 3, 'reference': 3,
    'difference': 3, 'consequence': 3,
    'independence': 4, 'correspondence': 4,
    'existence': 3, 'resistance': 3,
    'assistance': 3, 'substance': 2,
    'instance': 2, 'distance': 2,
    'sentence': 2, 'presence': 2,
    'absence': 2, 'essence': 2,
    'silence': 2, 'licence': 2, 'license': 2,
    'practice': 2, 'surface': 2,
    'furnace': 2, 'palace': 2,
    'menace': 2, 'terrace': 2,
    'courage': 2, 'village': 2,
    'manage': 2, 'message': 2,
    'passage': 2, 'language': 2,
    'package': 2, 'storage': 2,
    'average': 3, 'coverage': 3, 'beverage': 3,
    'advantage': 3, 'disadvantage': 4,
    'knowledge': 2, 'college': 2,
    'privilege': 3, 'acknowledge': 3,
    'image': 2, 'damage': 2, 'luggage': 2,
    'sausage': 2, 'garbage': 2,
    'cottage': 2, 'voltage': 2,
    'hostage': 2, 'shortage': 2,
    'orange': 2, 'strange': 1, 'change': 1, 'range': 1,
    'challenge': 2, 'exchange': 2,
    'age': 1, 'page': 1, 'stage': 1, 'cage': 1,
    'edge': 1, 'bridge': 1, 'ridge': 1, 'judge': 1,
    'huge': 1, 'refuge': 2,
    'league': 1, 'plague': 1, 'vague': 1,
    'tongue': 1, 'fatigue': 2, 'technique': 2, 'unique': 2,
    'dialogue': 2, 'catalogue': 2, 'prologue': 2,
    'collapse': 2, 'perhaps': 2, 'release': 2,
    'increase': 2, 'decrease': 2, 'disease': 2,
    'please': 1, 'ease': 1, 'lease': 1, 'cease': 1,
    'peace': 1, 'grease': 1,
    'purpose': 2, 'promise': 2,
    'surprise': 2, 'exercise': 3,
    'otherwise': 3, 'enterprise': 3,
    'paradise': 3, 'merchandise': 3,
    'compromise': 3, 'improvise': 3,
    'recognize': 3, 'organize': 3,
    'summarize': 3, 'emphasize': 3,
    'civilize': 3, 'apologize': 4,
    'characterize': 4, 'sympathize': 3,
    'analyze': 3, 'paralyze': 3,
    'catalogue': 3,
    'algorithm': 4, 'algorithms': 4,
    'framework': 2, 'frameworks': 2,
    'scalable': 3,
    'machine': 2, 'magazine': 3, 'routine': 2,
    'genuine': 3, 'feminine': 3, 'masculine': 3,
    'determine': 3, 'examine': 3, 'imagine': 3,
    'discipline': 3, 'medicine': 3,
    'engine': 2, 'combine': 2,
    'define': 2, 'confine': 2, 'decline': 2,
    'divine': 2, 'mine': 1, 'fine': 1, 'line': 1,
    'wine': 1, 'vine': 1, 'pine': 1, 'nine': 1,
    'dine': 1, 'shine': 1, 'spine': 1, 'whine': 1,
    'bone': 1, 'stone': 1, 'tone': 1, 'zone': 1,
    'phone': 1, 'alone': 2, 'throne': 1,
    'scene': 1, 'extreme': 2, 'supreme': 2,
    'theme': 1, 'scheme': 1,
    'complete': 2, 'compete': 2, 'concrete': 2,
    'discrete': 2, 'obsolete': 3,
    'athlete': 2, 'delete': 2,
    'note': 1, 'vote': 1, 'quote': 1, 'wrote': 1,
    'remote': 2, 'promote': 2, 'devote': 2,
    'time': 1, 'name': 1, 'game': 1, 'came': 1,
    'same': 1, 'blame': 1, 'fame': 1, 'frame': 1,
    'shame': 1, 'flame': 1, 'became': 2,
    'life': 1, 'wife': 1, 'knife': 1, 'strife': 1,
    'like': 1, 'bike': 1, 'hike': 1, 'strike': 1,
    'white': 1, 'quite': 1, 'write': 1, 'despite': 2,
    'while': 1, 'smile': 1, 'file': 1, 'mile': 1, 'style': 1,
    'meanwhile': 2, 'worthwhile': 2, 'crocodile': 3,
    'more': 1, 'store': 1, 'core': 1, 'score': 1,
    'before': 2, 'ignore': 2, 'explore': 2, 'restore': 2,
    'therefore': 2, 'furthermore': 3,
    'sure': 1, 'pure': 1, 'cure': 1,
    'figure': 2, 'nature': 2, 'culture': 2,
    'structure': 2, 'future': 2, 'picture': 2,
    'mixture': 2, 'texture': 2, 'lecture': 2,
    'creature': 2, 'feature': 2, 'measure': 2,
    'pleasure': 2, 'treasure': 2, 'leisure': 2,
    'temperature': 4, 'literature': 4,
    'architecture': 4, 'agriculture': 4,
    'manufacture': 4, 'adventure': 3,
    'furniture': 3, 'signature': 3,
    'miniature': 4,
    'eye': 1, 'dye': 1, 'bye': 1, 'rye': 1,
    'type': 1, 'pipe': 1, 'ripe': 1, 'wipe': 1,
    'hope': 1, 'rope': 1, 'cope': 1, 'scope': 1,
    'use': 1, 'abuse': 2, 'excuse': 2, 'refuse': 2,
    'accuse': 2, 'amuse': 2, 'confuse': 2,
    'rule': 1, 'schedule': 2,
    'true': 1, 'blue': 1, 'due': 1, 'clue': 1,
    'issue': 2, 'tissue': 2, 'value': 2,
    'statue': 2, 'venue': 2, 'revenue': 3,
    'continue': 3, 'avenue': 3, 'residue': 3,
    'argue': 2, 'league': 1,
    'cause': 1, 'because': 2, 'pause': 1, 'clause': 1,
    'house': 1, 'mouse': 1, 'blouse': 1, 'spouse': 1,
    'course': 1, 'source': 1, 'resource': 2,
    'force': 1, 'horse': 1, 'worse': 1, 'nurse': 1,
    'verse': 1, 'diverse': 2, 'universe': 3,
    'converse': 2, 'reverse': 2, 'adverse': 2,
    'sense': 1, 'dense': 1, 'tense': 1,
    'intense': 2, 'immense': 2, 'defense': 2, 'offense': 2,
    'expense': 2, 'suspense': 2, 'response': 2,
    'false': 1, 'else': 1, 'pulse': 1, 'impulse': 2,
    'whose': 1, 'close': 1, 'dose': 1, 'nose': 1,
    'rose': 1, 'those': 1, 'chose': 1, 'pose': 1,
    'suppose': 2, 'purpose': 2, 'compose': 2,
    'expose': 2, 'impose': 2, 'propose': 2, 'dispose': 2,
    'oppose': 2, 'transpose': 2,
    'state': 1, 'late': 1, 'rate': 1, 'date': 1,
    'fate': 1, 'gate': 1, 'hate': 1, 'mate': 1,
    'plate': 1, 'debate': 2, 'relate': 2,
    'translate': 2, 'migrate': 2, 'locate': 2,
    'private': 2, 'delicate': 3, 'accurate': 3,
    'educate': 3, 'dedicate': 3, 'indicate': 3,
    'eliminate': 4, 'dominate': 3, 'fascinate': 3,
    'celebrate': 3, 'concentrate': 3, 'demonstrate': 3,
    'integrate': 3, 'cooperate': 4, 'participate': 4,
    'exaggerate': 4, 'investigate': 4,
    'manipulate': 4, 'accommodate': 4,
    'communicate': 4, 'appreciate': 4,
    'anticipate': 4, 'negotiate': 4,
    'associate': 4,
    'elaborate': 4,
    'chocolate': 3,
    'climate': 2, 'intimate': 3, 'legitimate': 4,
    'ultimate': 3, 'estimate': 3, 'approximate': 4,
    'fortunate': 3, 'unfortunate': 4,
    'moderate': 3, 'desperate': 3,
    'considerate': 4, 'deliberate': 4,
    'inadequate': 4,
    'space': 1, 'place': 1, 'face': 1, 'race': 1,
    'grace': 1, 'trace': 1, 'peace': 1,
    'embrace': 2, 'replace': 2, 'surface': 2,
    'make': 1, 'take': 1, 'lake': 1, 'sake': 1,
    'mistake': 2, 'earthquake': 2, 'undertake': 3,
    'male': 1, 'female': 2, 'scale': 1, 'tale': 1, 'sale': 1, 'pale': 1, 'whale': 1,
    'care': 1, 'share': 1, 'rare': 1, 'aware': 2,
    'compare': 2, 'prepare': 2, 'declare': 2,
    'nightmare': 2, 'welfare': 2, 'hardware': 2,
    'software': 2, 'somewhere': 2, 'nowhere': 2,
    'everywhere': 3, 'anywhere': 3,
    'were': 1, 'where': 1, 'there': 1, 'here': 1,
    'atmosphere': 3, 'hemisphere': 3,
    'severe': 2, 'sincere': 2, 'interfere': 3,
    'side': 1, 'wide': 1, 'ride': 1, 'hide': 1,
    'guide': 1, 'pride': 1, 'bride': 1, 'slide': 1,
    'inside': 2, 'outside': 2, 'beside': 2,
    'decide': 2, 'provide': 2, 'divide': 2, 'include': 2,
    'aside': 2, 'coincide': 3, 'override': 3, 'nationwide': 3, 'worldwide': 2,
    'suicide': 3, 'countryside': 3,
    'whole': 1, 'role': 1, 'hole': 1, 'sole': 1, 'pole': 1,
    'stole': 1, 'console': 2, 'control': 2,
    'rule': 1, 'schedule': 2,
    'bite': 1, 'site': 1, 'quite': 1, 'write': 1,
    'favorite': 3, 'favourite': 3, 'definite': 3,
    'infinite': 3, 'opposite': 3, 'composite': 3,
    'exquisite': 3, 'requisite': 3, 'prerequisite': 4,
    'appetite': 3, 'satellite': 3,
    'positive': 3, 'negative': 3, 'sensitive': 3,
    'active': 2, 'native': 2, 'motive': 2,
    'massive': 2, 'passive': 2, 'aggressive': 3,
    'expensive': 3, 'exclusive': 3, 'impressive': 3,
    'effective': 3, 'detective': 3, 'objective': 3,
    'perspective': 3, 'alternative': 4, 'conservative': 4,
    'representative': 5, 'initiative': 4,
    'competitive': 4, 'cooperative': 4,
    'executive': 4, 'legislative': 4,
    'administrative': 5, 'comprehensive': 4,
    'progressive': 3, 'successive': 3,
    'excessive': 3, 'obsessive': 3,
    'creative': 3, 'relative': 3, 'narrative': 3,
    'innovative': 4, 'collaborative': 5,
    'decorative': 4, 'figurative': 4,
    'imaginative': 5,
    'give': 1, 'live': 1, 'forgive': 2,
    'twelve': 1, 'nerve': 1, 'serve': 1,
    'deserve': 2, 'reserve': 2, 'preserve': 2,
    'observe': 2, 'conserve': 2,
    'resolve': 2, 'involve': 2, 'evolve': 2,
    'dissolve': 2, 'revolve': 2, 'solve': 1, 'valve': 1,
    'above': 2, 'approve': 2, 'improve': 2,
    'groove': 1, 'remove': 2,
    'isle': 1, 'aisle': 1, 'missile': 2,
    'people': 2,
    'trouble': 2, 'double': 2, 'couple': 2,
    'acre': 2, 'fibre': 2, 'fibre': 2,
    'centre': 2, 'centre': 2,
    'genre': 2,
    'acre': 2,
    'choir': 1,
    'hour': 1, 'our': 1, 'your': 1, 'four': 1, 'pour': 1, 'tour': 1,
    'colour': 2, 'colour': 2, 'favour': 2, 'favour': 2,
    'neighbour': 2, 'labour': 2, 'honour': 2, 'humour': 2,
    'flower': 2, 'power': 2, 'tower': 2, 'shower': 2,
    'lower': 2, 'however': 3,
    'answer': 2, 'other': 2, 'mother': 2, 'father': 2,
    'brother': 2, 'sister': 2, 'daughter': 2,
    'water': 2, 'matter': 2, 'better': 2, 'letter': 2,
    'after': 2, 'chapter': 2, 'master': 2,
    'over': 2, 'under': 2, 'never': 2, 'ever': 2,
    'river': 2, 'silver': 2, 'winter': 2,
    'number': 2, 'member': 2, 'remember': 3,
    'november': 3, 'december': 3, 'september': 3,
    'october': 3,
    'together': 3, 'whatever': 3, 'whenever': 3,
    'however': 3, 'moreover': 3, 'wherever': 3,
    'discover': 3, 'consider': 3, 'deliver': 3,
    'character': 3, 'minister': 3, 'sinister': 3,
    'register': 3, 'minister': 3,
    'computer': 3, 'consumer': 3, 'volunteer': 3,
    'engineer': 3, 'pioneer': 3,
    'atmosphere': 3,
    'dangerous': 3, 'marvelous': 3, 'marvellous': 3,
    'ridiculous': 4, 'miraculous': 4,
    'ambiguous': 4, 'conspicuous': 4,
    'continuous': 4, 'strenuous': 3,
    'obvious': 3, 'previous': 3,
    'serious': 3, 'mysterious': 4,
    'curious': 3, 'furious': 3,
    'numerous': 3, 'humorous': 3,
    'generous': 3, 'dangerous': 3,
    'conscious': 2, 'unconscious': 3,
    'religious': 3, 'prestigious': 3,
    'anxious': 2, 'precious': 2,
    'delicious': 3, 'suspicious': 3,
    'spacious': 2, 'gracious': 2,
    'malicious': 3, 'ambitious': 3,
    'nutritious': 3, 'superstitious': 4,
    'does': 1, 'goes': 1, 'shoes': 1,
    'sometimes': 2, 'somewhere': 2, 'something': 2, 'someone': 2,
    'cannot': 2, 'into': 2, 'also': 2,
    'often': 2, 'listen': 2, 'given': 2, 'taken': 2,
    'broken': 2, 'spoken': 2, 'chosen': 2, 'frozen': 2,
    'hidden': 2, 'written': 2, 'bitten': 2, 'kitten': 2,
    'rotten': 2, 'forgotten': 3,
    'sudden': 2, 'garden': 2, 'golden': 2, 'wooden': 2,
    'heaven': 2, 'seven': 2, 'eleven': 3,
    'open': 2, 'often': 2, 'even': 2,
    'women': 2, 'children': 2,
    'rhythm': 2, 'system': 2, 'symbol': 2,
    'crystal': 2, 'physical': 3, 'typical': 3,
    'political': 4, 'practical': 3, 'classical': 3,
    'musical': 3, 'logical': 3, 'magical': 3,
    'tropical': 3, 'historical': 4, 'biological': 5,
    'psychological': 5, 'technological': 5,
    'philosophical': 5, 'mathematical': 5,
    'theoretical': 5, 'hypothetical': 5,
    'alphabetical': 5,
    'actual': 3, 'usual': 3, 'visual': 3,
    'casual': 3, 'manual': 3, 'annual': 3,
    'individual': 5, 'intellectual': 5,
    'spiritual': 4, 'eventual': 4,
    'mutual': 3, 'virtual': 3,
    'ritual': 3, 'habitual': 4,
    'cultural': 3, 'structural': 3,
    'agricultural': 5, 'architectural': 5,
    'beautiful': 3,
    'wonderful': 3, 'powerful': 3,
    'successful': 3, 'peaceful': 2,
    'grateful': 2, 'hateful': 2,
    'hopeful': 2, 'useful': 2,
    'careful': 2, 'cheerful': 2,
    'painful': 2, 'faithful': 2,
    'handful': 2, 'meaningful': 3,
    'playful': 2, 'graceful': 2,
    'plentiful': 3, 'bountiful': 3,
    'merciful': 3, 'dutiful': 3,
    'colourful': 3, 'colorful': 3,
    'respectful': 3, 'resentful': 3,
    'delightful': 3, 'thoughtful': 2,
    'frightful': 2, 'doubtful': 2,
    'dreadful': 2, 'forgetful': 3,
    'regretful': 3,
    'regardless': 3, 'nevertheless': 4,
    'darkness': 2, 'kindness': 2,
    'goodness': 2, 'weakness': 2,
    'illness': 2, 'sadness': 2,
    'happiness': 3, 'awareness': 3,
    'loneliness': 4, 'business': 2, 'businesses': 3,
    'wilderness': 3, 'forgiveness': 3,
    'consciousness': 3, 'effectiveness': 4,
    'government': 3, 'environment': 4,
    'development': 4, 'achievement': 3,
    'management': 3, 'agreement': 3,
    'requirement': 3, 'improvement': 3,
    'involvement': 3, 'movement': 2,
    'statement': 2, 'treatment': 2,
    'excitement': 3, 'arrangement': 3,
    'advertisement': 4, 'entertainment': 4,
    'establishment': 4, 'acknowledgment': 4,
    'embarrassment': 4, 'encouragement': 4,
    'disappointment': 4, 'accomplishment': 4,
    'measurement': 3, 'department': 3,
    'apartment': 3, 'compartment': 3,
    'experiment': 4, 'instrument': 3,
    'monument': 3, 'argument': 3,
    'document': 3, 'element': 3,
    'supplement': 3, 'implement': 3,
    'parliament': 3, 'tournament': 3,
    'equipment': 3,
    'moment': 2, 'comment': 2,
    'segment': 2, 'cement': 2,
    'judgment': 2, 'judgement': 2,
    'excitement': 3,
    'adjustment': 3, 'assessment': 3,
    'assignment': 3, 'investment': 3,
    'punishment': 3, 'abandonment': 4,
    'astonishment': 4,
    'likely': 2, 'lonely': 2, 'lovely': 2,
    'namely': 2, 'merely': 2, 'rarely': 2,
    'barely': 2, 'purely': 2, 'surely': 2,
    'entirely': 3, 'extremely': 3, 'sincerely': 3,
    'severely': 3, 'deliberately': 5,
    'absolutely': 4, 'separately': 4,
    'unfortunately': 5, 'approximately': 5,
    'immediately': 5, 'accurately': 4,
    'adequately': 4, 'ultimately': 4,
    'appropriately': 5, 'inappropriately': 6,
    'relatively': 4, 'alternatively': 5,
    'effectively': 4, 'exclusively': 4,
    'progressively': 4, 'excessively': 4,
    'creatively': 4, 'negatively': 4,
    'positively': 4, 'sensitively': 5,
    'cooperatively': 5, 'competitively': 5,
    'imaginatively': 6,
    'able': 2, 'unable': 3, 'enable': 3,
    'capable': 3, 'incapable': 4,
    'reliable': 4, 'variable': 4,
    'suitable': 3, 'remarkable': 4,
    'considerable': 5, 'comparable': 4,
    'desirable': 4, 'admirable': 4,
    'favorable': 4, 'favourable': 4,
    'miserable': 4, 'tolerable': 4,
    'vulnerable': 4, 'measurable': 4,
    'renewable': 4, 'achievable': 4,
    'noticeable': 4, 'manageable': 4,
    'knowledgeable': 4, 'changeable': 3,
    'exchangeable': 4, 'unmanageable': 5,
    'irreplaceable': 5,
    'comfortable': 3, 'uncomfortable': 4,
    'reasonable': 4, 'unreasonable': 5,
    'considerable': 5,
    'available': 4, 'unavailable': 5,
    'remarkable': 4,
    'vegetable': 4, 'charitable': 4,
    'applicable': 4, 'inevitable': 5,
    'respectable': 4, 'acceptable': 4,
    'unacceptable': 5,
    'forgettable': 4, 'unforgettable': 5,
    'regrettable': 4,
    'preventable': 4, 'predictable': 4,
    'adjustable': 4, 'detectable': 4,
    'sustainable': 4,
    'responsible': 4, 'irresponsible': 5,
    'flexible': 3, 'accessible': 4,
    'compatible': 4, 'incompatible': 5,
    'convertible': 4,
    'possible': 3, 'impossible': 4,
    'terrible': 3, 'horrible': 3, 'incredible': 4,
    'edible': 3, 'visible': 3, 'invisible': 4,
    'eligible': 4, 'negligible': 4,
    'sensible': 3, 'feasible': 3,
    'plausible': 3, 'reversible': 4,
    'permissible': 4, 'admissible': 4,
    'combustible': 4,
    'doing': 2, 'going': 2, 'seeing': 2,
    'agreeing': 3, 'being': 2, 'fleeing': 2,
    'freeing': 2, 'guaranteeing': 4,
    'skiing': 2,
    'lying': 2, 'dying': 2, 'tying': 2,
    'trying': 2, 'crying': 2, 'flying': 2,
    'buying': 2, 'applying': 3, 'denying': 3,
    'replying': 3, 'supplying': 3,
    'studying': 3, 'carrying': 3, 'hurrying': 3,
    'worrying': 3, 'varying': 3,
    'saying': 2, 'playing': 2, 'staying': 2,
    'paying': 2, 'laying': 2, 'praying': 2,
    'displaying': 3, 'obeying': 3, 'conveying': 3,
    'enjoying': 3, 'destroying': 3, 'employing': 3,
    'annoying': 3, 'deploying': 3,
    'knew': 1, 'blew': 1, 'grew': 1, 'drew': 1, 'threw': 1,
    'through': 1, 'though': 1, 'thought': 1, 'enough': 2,
    'although': 2, 'thorough': 2, 'borough': 2, 'throughout': 2,
    'again': 2, 'against': 2, 'certain': 2, 'mountain': 2,
    'captain': 2, 'curtain': 2, 'fountain': 2, 'villain': 2,
    'maintain': 2, 'obtain': 2, 'contain': 2, 'sustain': 2,
    'entertain': 3, 'explain': 2,
    'campaign': 2, 'bargain': 2,
    'foreign': 2, 'sovereign': 3,
    'friend': 1, 'field': 1, 'shield': 1, 'yield': 1,
    'achieve': 2, 'believe': 2, 'receive': 2,
    'conceive': 2, 'perceive': 2, 'deceive': 2,
    'chief': 1, 'brief': 1, 'relief': 2,
    'piece': 1, 'niece': 1,
    'neither': 2, 'either': 2,
    'weird': 1, 'height': 1, 'weight': 1,
    'eight': 1, 'freight': 1, 'straight': 1,
    'great': 1, 'break': 1, 'steak': 1,
    'bear': 1, 'wear': 1, 'pear': 1, 'tear': 1, 'swear': 1,
    'heart': 1, 'earth': 1, 'search': 1, 'research': 2,
    'heard': 1, 'learn': 1, 'early': 2, 'earn': 1,
    'read': 1, 'head': 1, 'dead': 1, 'bread': 1,
    'spread': 1, 'instead': 2, 'ahead': 2, 'thread': 1,
    'death': 1, 'health': 1, 'wealth': 1, 'stealth': 1,
    'breath': 1, 'beneath': 2,
    'mean': 1, 'clean': 1, 'bean': 1, 'lean': 1,
    'ocean': 2,
    'beauty': 2, 'beautiful': 3,
    'bureau': 2, 'plateau': 2,
    'said': 1, 'again': 2,
    'blood': 1, 'flood': 1, 'good': 1, 'food': 1,
    'wood': 1, 'stood': 1, 'mood': 1, 'hood': 1,
    'foot': 1, 'book': 1, 'look': 1, 'took': 1,
    'cook': 1, 'hook': 1, 'shook': 1,
    'door': 1, 'floor': 1, 'poor': 1,
    'broad': 1, 'road': 1, 'load': 1,
    'board': 1, 'aboard': 2, 'cupboard': 2,
    'guard': 1, 'reward': 2, 'toward': 2, 'towards': 2,
    'awkward': 2, 'forward': 2, 'backward': 2,
    'inward': 2, 'outward': 2, 'upward': 2,
    'downward': 2, 'afterward': 3, 'afterwards': 3,
    'idea': 3, 'ideal': 3, 'ideally': 4,
    'reality': 4, 'really': 2, 'realize': 3,
    'theatre': 3, 'theater': 3,
    'area': 3, 'areas': 3,
    'cereal': 3, 'material': 4,
    'dial': 2, 'trial': 2, 'denial': 3,
    'memorial': 4, 'editorial': 5,
    'industrial': 4, 'commercial': 3,
    'official': 3, 'artificial': 4,
    'special': 2, 'social': 2, 'crucial': 2,
    'initial': 3, 'essential': 3, 'potential': 3,
    'residential': 4, 'presidential': 4,
    'financial': 3, 'provincial': 3,
    'beneficial': 4, 'controversial': 5,
    'substantial': 3, 'circumstantial': 4,
    'influential': 4, 'consequential': 4,
    'confidential': 4, 'differential': 4,
    'sequential': 3, 'torrential': 3,
    'experiential': 5, 'existential': 4,
    'racial': 2, 'facial': 2, 'spatial': 2,
    'commercial': 3, 'judicial': 3,
    'prejudicial': 4, 'sacrificial': 4,
    'superficial': 5, 'beneficial': 4,
    'poem': 2, 'poet': 2, 'poetry': 3,
    'diet': 2, 'quiet': 2, 'riot': 2,
    'client': 2, 'ancient': 2,
    'patient': 2, 'impatient': 3,
    'sufficient': 3, 'efficient': 3,
    'deficient': 3, 'proficient': 3,
    'quotient': 2, 'ingredient': 4,
    'obedient': 4, 'disobedient': 5,
    'convenient': 4, 'inconvenient': 5,
    'orient': 3, 'ingredient': 4,
    'cruel': 2, 'fuel': 2, 'jewel': 2,
    'duel': 2, 'gruel': 2, 'cruel': 2,
    'fluent': 2, 'frequent': 2, 'subsequent': 3,
    'eloquent': 3, 'consequent': 3,
    'their': 1, 'weird': 1, 'seize': 1,
    'leisure': 2,
    'deity': 3, 'protein': 2,
    'being': 2, 'seeing': 2,
    'guarantee': 3, 'employee': 3, 'committee': 3,
    'refugee': 3, 'degree': 2, 'disagree': 3,
    'coffee': 2, 'toffee': 2, 'tree': 1, 'free': 1,
    'three': 1, 'agree': 2,
    'knee': 1, 'bee': 1, 'see': 1, 'fee': 1,
    'shoe': 1, 'canoe': 2,
    'toe': 1, 'foe': 1, 'doe': 1, 'roe': 1, 'woe': 1,
    'hero': 2, 'zero': 2, 'negro': 2,
    'also': 2, 'although': 2,
    'euro': 2, 'bureau': 2,
    'fiancee': 3, 'fiance': 3,
    'naive': 2,
    'premiere': 3,
    'cafe': 2, 'resume': 2,
    'cliche': 2, 'debris': 2,
    'technique': 2,
    'unique': 2, 'antique': 2, 'boutique': 2,
    'mystique': 2, 'physique': 2, 'critique': 2,
    'mosque': 1,
    'rogue': 1, 'vogue': 1,
    'prologue': 2, 'epilogue': 3,
    'monologue': 3, 'dialogue': 2,
    'analogue': 3, 'catalogue': 3,
    'synagogue': 3,
    'plague': 1, 'league': 1, 'vague': 1,
    'colleague': 2,
    'tongue': 1,
    'fatigue': 2, 'intrigue': 2,
    'grotesque': 2, 'picturesque': 3,
    'statuesque': 3, 'burlesque': 2,
    'breathe': 1, 'bathe': 1, 'clothe': 1, 'loathe': 1, 'soothe': 1, 'writhe': 1,
    'apostrophe': 4,
    'catastrophe': 4,
    'simile': 3, 'facsimile': 4,
    'recipe': 3, 'epitome': 4,
    'hyperbole': 4, 'acne': 2,
    'anemone': 4,
    'coyote': 3,
    'guacamole': 4,
    'karate': 3,
    'sake': 1,
    'ukulele': 4,
    'tamale': 3,
    'maybe': 2,
    'english': 2, 'language': 2,
    'image': 2, 'usage': 2,
    'voyage': 2, 'sausage': 2,
    'already': 3, 'always': 2,
    'today': 2, 'away': 2,
    'these': 1, 'whose': 1, 'those': 1,
    'since': 1, 'prince': 1,
    'once': 1, 'ounce': 1, 'bounce': 1, 'announce': 2,
    'pronounce': 2,
    'dance': 1, 'chance': 1, 'advance': 2, 'romance': 2,
    'finance': 2, 'performance': 3, 'circumstance': 3,
    'significance': 4, 'inheritance': 4,
    'maintenance': 3, 'appearance': 3,
    'insurance': 3, 'assurance': 3, 'endurance': 3,
    'tolerance': 3, 'dominance': 3, 'ignorance': 3,
    'importance': 3, 'performance': 3,
    'acceptance': 3, 'resistance': 3,
    'accordance': 3, 'abundance': 3,
    'significance': 4, 'independence': 4,
    'correspondence': 4, 'intelligence': 4,
    'magnificent': 4, 'insignificant': 5,
    'ambulance': 3, 'surveillance': 3,
    'resemblance': 3, 'relevance': 3,
    'prevalence': 3, 'equivalence': 4,
    'turbulence': 3, 'violence': 3,
    'excellence': 3, 'benevolence': 4,
    'convenience': 4, 'inconvenience': 5,
    'magnificent': 4,
    'adolescence': 4, 'obsolescence': 4,
    'luminescence': 4, 'convalescence': 4,
    'wore': 1, 'bore': 1, 'tore': 1, 'swore': 1,
    'shore': 1, 'snore': 1, 'adore': 2,
    'anymore': 3, 'furthermore': 3, 'evermore': 3,
    'heretofore': 4,
    'lore': 1, 'gore': 1, 'pore': 1,
    'therefore': 2
  };

  /**
   * Count syllables in a single word (no hyphens).
   */
  function countSyllablesSimple(word) {
    if (!word) return 0;
    word = word.toLowerCase().replace(/['']/g, "'");

    // Check exceptions first
    if (SYLLABLE_EXCEPTIONS.hasOwnProperty(word)) {
      return SYLLABLE_EXCEPTIONS[word];
    }

    // Numbers: 1 syllable per digit group
    if (/^\d+$/.test(word)) {
      return Math.max(1, Math.ceil(word.length / 3));
    }

    var len = word.length;
    if (len <= 2) return 1;

    var count = 0;
    var prevVowel = false;
    var vowels = 'aeiouy';

    // Count vowel groups
    for (var i = 0; i < len; i++) {
      var isVowel = vowels.indexOf(word[i]) !== -1;
      if (isVowel && !prevVowel) {
        count++;
      }
      prevVowel = isVowel;
    }

    // Silent e at end
    if (word[len - 1] === 'e' && count > 1) {
      // But not for -le endings (those keep the syllable)
      if (len >= 3 && word[len - 2] === 'l' && vowels.indexOf(word[len - 3]) === -1) {
        // -le after consonant: keep the syllable (e.g., "table" = 2)
        // count stays
      } else if (word.slice(-2) === 'ee' || word.slice(-2) === 'ie') {
        // words ending in ee or ie keep the syllable
      } else {
        count--;
      }
    }

    // -es endings
    if (word.slice(-2) === 'es' && len >= 4) {
      var preEs = word[len - 3];
      // Only matters if preEs is a consonant (so 'e' was counted as a new vowel group)
      if (vowels.indexOf(preEs) === -1) {
        var isSibilant = /[csxz]/.test(preEs) || 
                         (len >= 5 && word.slice(-4, -2) === 'sh') || 
                         (len >= 5 && word.slice(-4, -2) === 'ch') || 
                         (preEs === 'g');
        if (!isSibilant) {
          if (count > 1) count--;
        }
      }
    }

    // -ed endings: silent unless after t or d
    if (word.slice(-2) === 'ed' && len >= 4) {
      var preEd = word[len - 3];
      if (preEd !== 't' && preEd !== 'd') {
        // -ed is silent: "walked" = 1, not 2
        if (count > 1) count--;
      }
    }

    // Vowel pairs that split: ia, io, eo, ua, uo, ea (at word end)
    var splitPairs = ['ia', 'io', 'eo', 'ua', 'uo'];
    for (var p = 0; p < splitPairs.length; p++) {
      var idx = word.indexOf(splitPairs[p]);
      while (idx !== -1) {
        // Don't split if it's part of -tion, -sion etc.
        if (!(splitPairs[p] === 'io' && idx >= 1 && (word[idx - 1] === 't' || word[idx - 1] === 's' || word[idx - 1] === 'x'))) {
          count++;
        }
        idx = word.indexOf(splitPairs[p], idx + 1);
      }
    }

    // -ea at word end splits (idea, area)
    if (word.slice(-2) === 'ea' && len >= 3) {
      count++;
    }

    // being, doing, seeing - vowel + ing
    if (word.slice(-3) === 'ing' && len >= 4) {
      var preIng = word[len - 4];
      if (vowels.indexOf(preIng) !== -1 && !(len >= 5 && vowels.indexOf(word[len - 5]) === -1 && word[len - 4] === 'i')) {
        // vowel before -ing: "being" "seeing" "doing"
        // already counted correctly usually
      }
    }

    return Math.max(1, count);
  }

  /**
   * Count syllables: handles hyphenated words as sum of parts.
   */
  function countSyllables(word) {
    if (!word) return 0;

    // Handle numbers
    if (/^\d[\d,]*$/.test(word)) {
      var digitGroups = word.replace(/,/g, '').match(/\d+/g);
      return digitGroups ? digitGroups.length : 1;
    }

    // Hyphenated words: sum of parts
    if (word.indexOf('-') !== -1) {
      var parts = word.split('-').filter(function (p) { return p.length > 0; });
      var total = 0;
      for (var i = 0; i < parts.length; i++) {
        total += countSyllablesSimple(parts[i]);
      }
      return Math.max(1, total);
    }

    return countSyllablesSimple(word);
  }

  // ===== STEP 3: DOCUMENT-LEVEL SCORES =====

  function computeStats(text, commonWordsSet) {
    var norm = normalise(text);
    var normText = norm.normalised;
    var original = norm.original;

    if (!normText.trim()) {
      return null;
    }

    var paragraphs = splitParagraphs(normText);
    var allSentences = splitSentences(normText);
    var allWords = [];
    var sentenceWords = [];

    for (var i = 0; i < allSentences.length; i++) {
      var words = tokeniseWords(allSentences[i].text);
      sentenceWords.push(words);
      for (var j = 0; j < words.length; j++) {
        allWords.push(words[j]);
      }
    }

    var W = allWords.length;  // total words
    var S = allSentences.length;  // total sentences

    if (W === 0 || S === 0) return null;

    // Count syllables, letters, characters
    var totalSyllables = 0;
    var totalLetters = 0;
    var totalChars = 0;
    var syllableCounts = [];

    for (var i = 0; i < allWords.length; i++) {
      var syl = countSyllables(allWords[i]);
      syllableCounts.push(syl);
      totalSyllables += syl;
      var letters = allWords[i].replace(/[^a-zA-Z]/g, '').length;
      totalLetters += letters;
      totalChars += allWords[i].length;
    }

    var avgWordsPerSentence = W / S;
    var avgSyllablesPerWord = totalSyllables / W;
    var lettersPerHundredWords = (totalLetters / W) * 100;
    var sentencesPerHundredWords = (S / W) * 100;
    var charsPerWord = totalChars / W;

    // Complex words for Gunning Fog (3+ syllables, with exclusions)
    var complexWordCount = 0;
    for (var i = 0; i < allWords.length; i++) {
      if (syllableCounts[i] >= 3) {
        var w = allWords[i];
        // Exclude proper nouns (capitalised, not at sentence start)
        // We approximate: if the word appears capitalised and is not the first word
        // Simple check: skip if first letter is uppercase and it's not all caps
        if (/^[A-Z][a-z]/.test(w)) continue;

        // Exclude words that only reach 3 syllables because of -ed, -es, -ing suffix
        var base = w.toLowerCase();
        var baseSyl = countSyllables(base);
        if (baseSyl >= 3) {
          var stripped = base;
          if (stripped.slice(-3) === 'ing') stripped = stripped.slice(0, -3);
          else if (stripped.slice(-2) === 'ed') stripped = stripped.slice(0, -2);
          else if (stripped.slice(-2) === 'es') stripped = stripped.slice(0, -2);
          if (stripped !== base && countSyllables(stripped) < 3) continue;
        }
        complexWordCount++;
      }
    }

    // Polysyllable count for SMOG (3+ syllables)
    var polysyllableCount = 0;
    for (var i = 0; i < syllableCounts.length; i++) {
      if (syllableCounts[i] >= 3) polysyllableCount++;
    }

    // Flesch Reading Ease
    var fleschRE = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
    fleschRE = Math.max(0, Math.min(100, fleschRE));

    // Flesch-Kincaid Grade Level
    var fleschKincaid = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;

    // Gunning Fog Index
    var gunningFog = 0.4 * (avgWordsPerSentence + 100 * (complexWordCount / W));

    // SMOG Index (needs 30+ sentences)
    var smog = null;
    if (S >= 30) {
      smog = 1.043 * Math.sqrt(polysyllableCount * (30 / S)) + 3.1291;
    }

    // Coleman-Liau Index
    var colemanLiau = 0.0588 * lettersPerHundredWords - 0.296 * sentencesPerHundredWords - 15.8;

    // ARI
    var ari = 4.71 * charsPerWord + 0.5 * avgWordsPerSentence - 21.43;

    // Headline grade: median of FK, Fog, CL, ARI (+ SMOG when available)
    var grades = [fleschKincaid, gunningFog, colemanLiau, ari];
    if (smog !== null) grades.push(smog);
    grades.sort(function (a, b) { return a - b; });
    var medianGrade;
    if (grades.length % 2 === 1) {
      medianGrade = grades[Math.floor(grades.length / 2)];
    } else {
      medianGrade = (grades[Math.floor(grades.length / 2) - 1] + grades[Math.floor(grades.length / 2)]) / 2;
    }

    var minGrade = grades[0];
    var maxGrade = grades[grades.length - 1];
    var gradeRange = maxGrade - minGrade;
    var formulasDisagree = gradeRange > 4;

    // Flesch RE label
    var fleschLabel;
    if (fleschRE >= 90) fleschLabel = 'Very easy';
    else if (fleschRE >= 80) fleschLabel = 'Easy';
    else if (fleschRE >= 70) fleschLabel = 'Fairly easy';
    else if (fleschRE >= 60) fleschLabel = 'Plain English';
    else if (fleschRE >= 50) fleschLabel = 'Fairly difficult';
    else if (fleschRE >= 30) fleschLabel = 'Difficult';
    else fleschLabel = 'Very difficult';

    // ===== STEP 4: VOCABULARY DIFFICULTY =====
    var rareWords = [];
    var rareWordCounts = {};
    var rareWordTotal = 0;

    if (commonWordsSet) {
      for (var si = 0; si < allSentences.length; si++) {
        var sWords = sentenceWords[si];
        var sentText = allSentences[si].text;
        for (var wi = 0; wi < sWords.length; wi++) {
          var w = sWords[wi];
          // Skip numbers
          if (/^\d/.test(w)) continue;
          // Skip capitalised words not at sentence start (probably names)
          if (wi > 0 && /^[A-Z]/.test(w)) continue;
          // Also skip capitalised word at sentence start if the lowercased version is not in common words
          // (keep the check - it IS rare if not common even at sentence start)

          var lower = w.toLowerCase();
          if (!isCommonWord(lower, commonWordsSet)) {
            rareWordTotal++;
            rareWordCounts[lower] = (rareWordCounts[lower] || 0) + 1;
          }
        }
      }

      // Sort rare words by frequency
      var rareEntries = [];
      for (var rw in rareWordCounts) {
        if (rareWordCounts.hasOwnProperty(rw)) {
          rareEntries.push({ word: rw, count: rareWordCounts[rw] });
        }
      }
      rareEntries.sort(function (a, b) { return b.count - a.count; });
      rareWords = rareEntries.slice(0, 10);
    }

    var rareWordShare = W > 0 ? rareWordTotal / W : 0;

    // ===== STEP 5: SENTENCE DIFFICULTY =====
    var subordinators = [
      'although', 'because', 'which', 'whom', 'whose', 'whereas',
      'while', 'unless', 'whether', 'that', 'if', 'since', 'until',
      'though', 'where', 'who'
    ];

    var sentenceDifficulties = [];
    for (var si = 0; si < allSentences.length; si++) {
      var sWords = sentenceWords[si];
      if (sWords.length < 8) continue;

      var sText = allSentences[si].text;
      var sLower = sText.toLowerCase();

      // L: length
      var L = Math.min(1, sWords.length / 40);

      // R: rare word share in sentence
      var sentRare = 0;
      if (commonWordsSet) {
        for (var wi = 0; wi < sWords.length; wi++) {
          var w = sWords[wi];
          if (/^\d/.test(w)) continue;
          if (wi > 0 && /^[A-Z]/.test(w)) continue;
          if (!isCommonWord(w.toLowerCase(), commonWordsSet)) sentRare++;
        }
      }
      var R = Math.min(1, (sentRare / sWords.length) / 0.35);

      // W: word size
      var sentLetters = 0;
      for (var wi = 0; wi < sWords.length; wi++) {
        sentLetters += sWords[wi].replace(/[^a-zA-Z]/g, '').length;
      }
      var avgLetters = sentLetters / sWords.length;
      var Wcomp = Math.min(1, Math.max(0, (avgLetters - 3.5) / 2.5));

      // C: clauses
      var clauseCount = 0;
      // Count commas, semicolons, colons, dashes
      for (var ci = 0; ci < sText.length; ci++) {
        var cc = sText[ci];
        if (cc === ',' || cc === ';' || cc === ':') clauseCount++;
        if (cc === '\u2014' || (cc === '-' && ci > 0 && ci < sText.length - 1 && sText[ci - 1] === '-')) clauseCount++;
      }
      // Also count em-dashes
      var emDashCount = (sText.match(/\u2014/g) || []).length;
      var doubleDashCount = (sText.match(/--/g) || []).length;
      // Remove double-counted dashes
      clauseCount = clauseCount - doubleDashCount; // -- was counted as two hyphens

      // Count subordinators
      for (var sub = 0; sub < subordinators.length; sub++) {
        var subWord = subordinators[sub];
        var subRe = new RegExp('\\b' + subWord + '\\b', 'gi');
        var subMatches = sLower.match(subRe);
        if (subMatches) clauseCount += subMatches.length;
      }

      var C = Math.min(1, clauseCount / 6);

      var difficulty = 100 * (0.40 * L + 0.25 * R + 0.15 * Wcomp + 0.20 * C);

      // Find rare words in this sentence for display
      var sentRareWords = [];
      if (commonWordsSet) {
        for (var wi = 0; wi < sWords.length; wi++) {
          var wrd = sWords[wi];
          if (/^\d/.test(wrd)) continue;
          if (wi > 0 && /^[A-Z]/.test(wrd)) continue;
          if (!isCommonWord(wrd.toLowerCase(), commonWordsSet)) {
            sentRareWords.push(wrd.toLowerCase());
          }
        }
      }

      sentenceDifficulties.push({
        sentenceIndex: si,
        text: sText,
        startOffset: allSentences[si].startOffset,
        endOffset: allSentences[si].endOffset,
        wordCount: sWords.length,
        difficulty: difficulty,
        components: { L: L, R: R, W: Wcomp, C: C },
        rareWords: sentRareWords
      });
    }

    // Sort by difficulty descending
    sentenceDifficulties.sort(function (a, b) { return b.difficulty - a.difficulty; });

    // Pick top 5 with spread rules
    var topFive = pickTopFive(sentenceDifficulties);

    // Generate reason tags for each pick
    for (var t = 0; t < topFive.length; t++) {
      topFive[t].reasons = getReasonTags(topFive[t].components);
      topFive[t].rank = t + 1;
    }

    // ===== STEP 6: CHAPTER CHECKS =====

    // Sentence lengths for rhythm
    var sentenceLengths = [];
    for (var si = 0; si < allSentences.length; si++) {
      sentenceLengths.push(sentenceWords[si].length);
    }

    var avgSentLen = W / S;
    var stdDev = 0;
    for (var si = 0; si < sentenceLengths.length; si++) {
      stdDev += Math.pow(sentenceLengths[si] - avgSentLen, 2);
    }
    stdDev = Math.sqrt(stdDev / S);

    var longestSentence = Math.max.apply(null, sentenceLengths);
    var shortestSentence = Math.min.apply(null, sentenceLengths);

    // Passive voice estimate
    var passiveCount = estimatePassiveVoice(allSentences);
    var passivePer1000 = W > 0 ? (passiveCount / W) * 1000 : 0;

    // Adverbs
    var adverbExclusions = ['family', 'only', 'early', 'july', 'holy', 'holy', 'lily',
      'belly', 'bully', 'daily', 'fly', 'rely', 'supply', 'apply',
      'reply', 'ally', 'rally', 'folly', 'jolly', 'jelly', 'hilly',
      'silly', 'chilly', 'filly', 'wily', 'sly', 'ply', 'ugly',
      'assembly', 'butterfly', 'italy', 'anomaly', 'monopoly'];
    var adverbCount = 0;
    for (var i = 0; i < allWords.length; i++) {
      var wLow = allWords[i].toLowerCase();
      if (wLow.length > 2 && wLow.slice(-2) === 'ly' && adverbExclusions.indexOf(wLow) === -1) {
        adverbCount++;
      }
    }
    var adverbsPer1000 = W > 0 ? (adverbCount / W) * 1000 : 0;

    // Sentence openers
    var openerFlags = findRepeatedOpeners(allSentences, sentenceWords);

    // Dialogue share
    var dialogueResult = computeDialogueShare(normText, allWords.length);

    // Longest paragraph
    var longestPara = { wordCount: 0, index: -1 };
    for (var pi = 0; pi < paragraphs.length; pi++) {
      var pWords = tokeniseWords(paragraphs[pi].text);
      if (pWords.length > longestPara.wordCount) {
        longestPara = { wordCount: pWords.length, index: pi };
      }
    }

    return {
      wordCount: W,
      sentenceCount: S,
      paragraphCount: paragraphs.length,
      syllableCount: totalSyllables,
      avgWordsPerSentence: avgWordsPerSentence,
      avgSyllablesPerWord: avgSyllablesPerWord,

      // Scores
      fleschReadingEase: fleschRE,
      fleschLabel: fleschLabel,
      fleschKincaid: fleschKincaid,
      gunningFog: gunningFog,
      smog: smog,
      colemanLiau: colemanLiau,
      ari: ari,

      // Headline
      medianGrade: medianGrade,
      minGrade: minGrade,
      maxGrade: maxGrade,
      formulasDisagree: formulasDisagree,

      // Vocabulary
      rareWordShare: rareWordShare,
      rareWords: rareWords,

      // Hardest sentences
      hardestSentences: topFive,

      // Chapter checks
      sentenceLengths: sentenceLengths,
      sentenceLengthStdDev: stdDev,
      longestSentenceWords: longestSentence,
      shortestSentenceWords: shortestSentence,
      passiveVoiceCount: passiveCount,
      passiveVoicePer1000: passivePer1000,
      adverbCount: adverbCount,
      adverbsPer1000: adverbsPer1000,
      openerFlags: openerFlags,
      dialogueShare: dialogueResult,
      longestParagraph: longestPara,

      // Raw data for rendering
      sentences: allSentences,
      paragraphs: paragraphs,
      normalisedText: normText,
      originalText: original
    };
  }

  // Suffix stripping for word list matching
  var SUFFIX_PATTERNS = [
    { suffix: 'ing', minBase: 2 },
    { suffix: 'ness', minBase: 2 },
    { suffix: 'ment', minBase: 2 },
    { suffix: 'tion', minBase: 2 },
    { suffix: 'sion', minBase: 2 },
    { suffix: 'able', minBase: 2 },
    { suffix: 'ible', minBase: 2 },
    { suffix: 'ful', minBase: 2 },
    { suffix: 'less', minBase: 2 },
    { suffix: 'ous', minBase: 2 },
    { suffix: 'ive', minBase: 2 },
    { suffix: 'est', minBase: 2 },
    { suffix: 'er', minBase: 2 },
    { suffix: 'ly', minBase: 2 },
    { suffix: 'ed', minBase: 2 },
    { suffix: 'es', minBase: 2 },
    { suffix: 's', minBase: 2 }
  ];

  function isCommonWord(word, commonWordsSet) {
    if (!commonWordsSet) return true;
    var w = word.toLowerCase();
    if (commonWordsSet[w]) return true;

    // Try stripping suffixes
    for (var i = 0; i < SUFFIX_PATTERNS.length; i++) {
      var suf = SUFFIX_PATTERNS[i];
      if (w.length > suf.suffix.length + suf.minBase && w.slice(-suf.suffix.length) === suf.suffix) {
        var base = w.slice(0, -suf.suffix.length);
        if (commonWordsSet[base]) return true;
        // Handle doubling: "running" -> "run"
        if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
          if (commonWordsSet[base.slice(0, -1)]) return true;
        }
        // Handle e-dropping: "making" -> "make"
        if (commonWordsSet[base + 'e']) return true;
      }
    }

    // Handle -ies -> -y: "stories" -> "story"
    if (w.slice(-3) === 'ies' && w.length > 4) {
      if (commonWordsSet[w.slice(0, -3) + 'y']) return true;
    }

    // Handle -ied -> -y: "tried" -> "try"
    if (w.slice(-3) === 'ied' && w.length > 4) {
      if (commonWordsSet[w.slice(0, -3) + 'y']) return true;
    }

    return false;
  }

  function pickTopFive(sorted) {
    if (sorted.length <= 5) return sorted.slice();
    var picks = [];
    for (var i = 0; i < sorted.length && picks.length < 5; i++) {
      var candidate = sorted[i];
      var tooClose = false;
      for (var j = 0; j < picks.length; j++) {
        var diff = Math.abs(candidate.sentenceIndex - picks[j].sentenceIndex);
        if (diff <= 1) {
          // Neighbours: only skip if there are other candidates within 5 points
          var otherAvailable = false;
          for (var k = i + 1; k < sorted.length; k++) {
            if (sorted[k].difficulty >= candidate.difficulty - 5) {
              var otherTooClose = false;
              for (var p = 0; p < picks.length; p++) {
                if (Math.abs(sorted[k].sentenceIndex - picks[p].sentenceIndex) <= 1) {
                  otherTooClose = true;
                  break;
                }
              }
              if (!otherTooClose) {
                otherAvailable = true;
                break;
              }
            }
          }
          if (otherAvailable) {
            tooClose = true;
            break;
          }
        }
      }
      if (!tooClose) {
        picks.push(candidate);
      }
    }
    return picks;
  }

  function getReasonTags(components) {
    var reasons = [
      { tag: 'Very long', score: components.L, weight: 0.40 },
      { tag: 'Rare words', score: components.R, weight: 0.25 },
      { tag: 'Long words', score: components.W, weight: 0.15 },
      { tag: 'Many clauses', score: components.C, weight: 0.20 }
    ];
    reasons.sort(function (a, b) { return (b.score * b.weight) - (a.score * a.weight); });
    var tags = [];
    for (var i = 0; i < Math.min(2, reasons.length); i++) {
      if (reasons[i].score > 0.1) {
        tags.push(reasons[i].tag);
      }
    }
    return tags;
  }

  // Passive voice detection
  var IRREGULAR_PARTICIPLES = [
    'been', 'born', 'broken', 'brought', 'built', 'bought', 'caught',
    'chosen', 'come', 'cut', 'done', 'drawn', 'driven', 'eaten',
    'fallen', 'felt', 'found', 'forgotten', 'forgiven', 'frozen',
    'given', 'gone', 'got', 'gotten', 'grown', 'had', 'heard', 'held',
    'hidden', 'hit', 'hung', 'hurt', 'kept', 'known', 'laid', 'led',
    'left', 'lent', 'let', 'lost', 'made', 'meant', 'met', 'paid',
    'put', 'read', 'ridden', 'run', 'said', 'seen', 'sent', 'set',
    'shaken', 'shot', 'shown', 'shut', 'sold', 'spent', 'spoken',
    'spread', 'stolen', 'stood', 'struck', 'stuck', 'sung', 'sunk',
    'swept', 'sworn', 'taken', 'taught', 'thought', 'thrown', 'told',
    'torn', 'understood', 'upset', 'woken', 'won', 'worn', 'wound',
    'written'
  ];

  var TO_BE = ['is', 'are', 'was', 'were', 'be', 'been', 'being'];

  function estimatePassiveVoice(sentences) {
    var count = 0;
    for (var si = 0; si < sentences.length; si++) {
      var words = tokeniseWords(sentences[si].text);
      for (var wi = 0; wi < words.length; wi++) {
        var wLow = words[wi].toLowerCase();
        if (TO_BE.indexOf(wLow) !== -1) {
          // Check next 2 words for past participle
          for (var offset = 1; offset <= 2 && wi + offset < words.length; offset++) {
            var next = words[wi + offset].toLowerCase();
            if (isPastParticiple(next)) {
              count++;
              break;
            }
          }
        }
      }
    }
    return count;
  }

  function isPastParticiple(word) {
    if (IRREGULAR_PARTICIPLES.indexOf(word) !== -1) return true;
    if (word.length > 3 && word.slice(-2) === 'ed') return true;
    return false;
  }

  function findRepeatedOpeners(sentences, sentenceWords) {
    var flags = [];
    if (sentences.length < 3) return flags;

    for (var i = 0; i <= sentences.length - 3; i++) {
      var w1 = sentenceWords[i].length > 0 ? sentenceWords[i][0].toLowerCase() : '';
      var w2 = sentenceWords[i + 1].length > 0 ? sentenceWords[i + 1][0].toLowerCase() : '';
      var w3 = sentenceWords[i + 2].length > 0 ? sentenceWords[i + 2][0].toLowerCase() : '';

      if (w1 && w1 === w2 && w2 === w3) {
        // Check if already flagged
        var alreadyFlagged = false;
        for (var f = 0; f < flags.length; f++) {
          if (flags[f].word === w1 && Math.abs(flags[f].startIndex - i) <= 2) {
            alreadyFlagged = true;
            break;
          }
        }
        if (!alreadyFlagged) {
          flags.push({
            word: w1,
            startIndex: i,
            count: 3
          });
        }
      }
    }
    return flags;
  }

  function computeDialogueShare(text, totalWords) {
    if (totalWords === 0) return { share: 0, wordCount: 0 };
    var dialogueWords = 0;
    var inQuote = false;
    var quoteChars = ['"', '\u201C', '\u201D'];
    var currentWord = '';

    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === '"' || ch === '\u201C') {
        inQuote = true;
        continue;
      }
      if (ch === '"' || ch === '\u201D') {
        if (currentWord.length > 0 && inQuote) {
          dialogueWords++;
          currentWord = '';
        }
        inQuote = false;
        continue;
      }

      if (/[a-zA-Z0-9'\-]/.test(ch)) {
        currentWord += ch;
      } else {
        if (currentWord.length > 0 && inQuote) {
          if (/[a-zA-Z]/.test(currentWord)) dialogueWords++;
        }
        currentWord = '';
      }
    }

    return {
      share: dialogueWords / totalWords,
      wordCount: dialogueWords
    };
  }

  // ===== PUBLIC API =====
  return {
    normalise: normalise,
    splitParagraphs: splitParagraphs,
    splitSentences: splitSentences,
    tokeniseWords: tokeniseWords,
    countSyllables: countSyllables,
    countSyllablesSimple: countSyllablesSimple,
    computeStats: computeStats,
    isCommonWord: isCommonWord,
    estimatePassiveVoice: estimatePassiveVoice,
    findRepeatedOpeners: findRepeatedOpeners,
    computeDialogueShare: computeDialogueShare,
    SYLLABLE_EXCEPTIONS: SYLLABLE_EXCEPTIONS
  };
});
