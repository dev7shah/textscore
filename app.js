document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // --- Elements ---
  var textInput = document.getElementById('text-input');
  var mirrorLayer = document.getElementById('mirror-layer');
  var wordCountEl = document.getElementById('word-count');
  var updateStatus = document.getElementById('update-status');
  var btnSample = document.getElementById('btn-sample');
  var btnSampleEmpty = document.getElementById('btn-sample-empty');
  var btnClear = document.getElementById('btn-clear');
  var btnCopy = document.getElementById('btn-copy');
  var audienceSelect = document.getElementById('audience-select');
  var btnResetBaseline = document.getElementById('btn-reset-baseline');
  var baselineDiffEl = document.getElementById('baseline-diff');

  var emptyState = document.getElementById('empty-state');
  var resultsContent = document.getElementById('results-content');

  // Mobile Tabs
  var tabText = document.getElementById('tab-text');
  var tabResults = document.getElementById('tab-results');
  var editorCard = document.getElementById('editor-card');
  var resultsCard = document.getElementById('results-card');

  // Result Inner Tabs
  var resultTabs = document.querySelectorAll('.results-inner .segment-tab');
  var resultPanels = document.querySelectorAll('.results-inner .tab-content');

  // --- State ---
  var currentStats = null;
  var baselineGrade = null;
  var debounceTimer = null;
  var SAMPLE_TEXT = "It was a dark and stormy night; the rain fell in torrents, except at occasional intervals, when it was checked by a violent gust of wind which swept up the streets (for it is in London that our scene lies), rattling along the housetops, and fiercely agitating the scanty flame of the lamps that struggled against the darkness.\n\n\"What a terrible night!\" she exclaimed, looking out the window. \"I cannot believe we are stuck here.\"\n\nHe did not reply immediately. He was busy examining the old map they had found in the attic. It was covered in dust and mysterious symbols that seemed to shift when you looked away. The whole situation was becoming increasingly peculiar, and he felt a growing sense of unease. Nevertheless, they had to press on with their investigation.";

  // --- Event Listeners ---
  textInput.addEventListener('input', handleInput);
  textInput.addEventListener('scroll', syncScroll, { passive: true });
  
  btnSample.addEventListener('click', loadSample);
  btnSampleEmpty.addEventListener('click', loadSample);
  btnClear.addEventListener('click', function () {
    textInput.value = '';
    handleInput();
    textInput.focus();
  });
  
  btnCopy.addEventListener('click', handleCopy);
  audienceSelect.addEventListener('change', function () {
    if (currentStats) renderVerdict(currentStats);
  });
  
  btnResetBaseline.addEventListener('click', function () {
    baselineGrade = null;
    if (currentStats) renderVerdict(currentStats);
  });

  // Mobile Segmented Switcher
  tabText.addEventListener('click', function() { switchMobileTab('text'); });
  tabResults.addEventListener('click', function() { switchMobileTab('results'); });

  // Results Tabs
  for (var i = 0; i < resultTabs.length; i++) {
    resultTabs[i].addEventListener('click', function (e) {
      var targetId = e.target.getAttribute('data-target');
      for (var j = 0; j < resultTabs.length; j++) {
        resultTabs[j].setAttribute('aria-selected', 'false');
      }
      e.target.setAttribute('aria-selected', 'true');
      
      for (var k = 0; k < resultPanels.length; k++) {
        if (resultPanels[k].id === targetId) {
          resultPanels[k].setAttribute('aria-hidden', 'false');
        } else {
          resultPanels[k].setAttribute('aria-hidden', 'true');
        }
      }
    });
  }

  // --- Core Functions ---
  function loadSample() {
    textInput.value = SAMPLE_TEXT;
    handleInput();
  }

  function handleInput() {
    var text = textInput.value;
    updateStatus.textContent = 'Updating...';
    
    // Quick word count approximation for footer
    var approxWords = (text.match(/\S+/g) || []).length;
    wordCountEl.textContent = approxWords === 1 ? '1 word' : approxWords + ' words';
    
    // Sync mirror layout just for basic wrapping (highlights removed while typing)
    mirrorLayer.textContent = text;
    
    if (debounceTimer) clearTimeout(debounceTimer);
    
    var delay = text.length > 60000 ? 900 : 400;
    debounceTimer = setTimeout(function () {
      processText(text);
    }, delay);
  }

  function syncScroll() {
    mirrorLayer.scrollTop = textInput.scrollTop;
    mirrorLayer.scrollLeft = textInput.scrollLeft;
  }

  function processText(text) {
    if (!text.trim()) {
      showEmpty('Paste or type your chapter to see the readability results.');
      return;
    }

    try {
      currentStats = Readability.computeStats(text, window.CommonWords);
      if (!currentStats) {
        showEmpty('Keep typing. Needs at least 1 full sentence and a few words.');
        return;
      }
      
      // Initialize baseline on first valid result
      if (baselineGrade === null) {
        baselineGrade = currentStats.medianGrade;
      }
      
      renderResults(currentStats);
      renderHighlights(currentStats);
      updateStatus.textContent = 'Updated';
      
    } catch (err) {
      console.error(err);
      updateStatus.textContent = 'Error processing text';
    }
  }

  function showEmpty(msg) {
    emptyState.querySelector('p').textContent = msg;
    emptyState.classList.remove('hidden');
    resultsContent.classList.add('hidden');
    updateStatus.textContent = 'Updated';
    currentStats = null;
    mirrorLayer.textContent = textInput.value;
  }

  function switchMobileTab(tab) {
    if (tab === 'text') {
      tabText.setAttribute('aria-selected', 'true');
      tabResults.setAttribute('aria-selected', 'false');
      editorCard.classList.remove('mobile-hidden');
      resultsCard.classList.add('mobile-hidden');
    } else {
      tabText.setAttribute('aria-selected', 'false');
      tabResults.setAttribute('aria-selected', 'true');
      editorCard.classList.add('mobile-hidden');
      resultsCard.classList.remove('mobile-hidden');
    }
  }

  // --- Rendering ---
  function renderResults(stats) {
    emptyState.classList.add('hidden');
    resultsContent.classList.remove('hidden');

    renderVerdict(stats);
    renderRangeBar(stats);
    renderSentences(stats);
    renderOverview(stats);
    renderVocabulary(stats);
    renderRhythm(stats);
    renderFormulasTable(stats);
  }

  function renderVerdict(stats) {
    var audience = audienceSelect.value;
    var minT = 8, maxT = 10, label = 'general nonfiction';
    if (audience === 'fiction') { minT = 5; maxT = 8; label = 'fiction'; }
    if (audience === 'academic') { minT = 12; maxT = 99; label = 'academic'; }

    var grade = stats.medianGrade;
    document.getElementById('headline-score').textContent = 'Grade ' + grade.toFixed(1);
    
    var statusPill = document.getElementById('status-pill');
    var verdictSent = document.getElementById('verdict-sentence');
    var targetStr = minT + ' to ' + (maxT===99 ? '12+' : maxT);

    if (grade < minT - 0.5) {
      statusPill.className = 'status-pill status-below';
      statusPill.textContent = 'Below target';
    } else if (grade > maxT + 0.5) {
      statusPill.className = 'status-pill status-above';
      statusPill.textContent = 'Above target';
    } else {
      statusPill.className = 'status-pill status-ok';
      statusPill.textContent = 'On target';
    }

    verdictSent.textContent = 'Reads at grade ' + grade.toFixed(1) + ', ' + statusPill.textContent.toLowerCase() + ' for ' + label + '. Target is grades ' + targetStr + '.';

    if (baselineGrade !== null && Math.abs(baselineGrade - grade) > 0.1) {
      var diff = grade - baselineGrade;
      baselineDiffEl.textContent = (diff > 0 ? 'Up ' : 'Down ') + Math.abs(diff).toFixed(1) + ' grades since your first check.';
      baselineDiffEl.className = 'baseline-diff ' + (diff > 0 ? 'diff-up' : 'diff-down');
      btnResetBaseline.classList.remove('hidden');
    } else {
      baselineDiffEl.classList.add('hidden');
      btnResetBaseline.classList.add('hidden');
    }
  }

  function renderRangeBar(stats) {
    var minScore = stats.minGrade;
    var maxScore = stats.maxGrade;
    var median = stats.medianGrade;
    
    var audience = audienceSelect.value;
    var tMin = 8, tMax = 10;
    if (audience === 'fiction') { tMin = 5; tMax = 8; }
    if (audience === 'academic') { tMin = 12; tMax = 18; }

    var scaleMax = 18;
    
    function toPct(val) {
      return Math.min(100, Math.max(0, (val / scaleMax) * 100)) + '%';
    }

    var targetEl = document.getElementById('range-target');
    targetEl.style.left = toPct(tMin);
    targetEl.style.width = toPct(tMax - tMin);

    var spreadEl = document.getElementById('range-spread');
    spreadEl.style.left = toPct(minScore);
    spreadEl.style.width = (Math.max(0, maxScore - minScore) / scaleMax * 100) + '%';

    var medianEl = document.getElementById('range-median');
    medianEl.style.left = toPct(median);

    document.getElementById('range-caption').textContent = 'Scores range from ' + minScore.toFixed(1) + ' to ' + maxScore.toFixed(1) + '. Median is ' + median.toFixed(1) + '.';
    
    var warnEl = document.getElementById('disagree-warning');
    if (maxScore - minScore > 4) {
      warnEl.classList.remove('hidden');
    } else {
      warnEl.classList.add('hidden');
    }
  }

  function renderSentences(stats) {
    var list = document.getElementById('sentences-list');
    list.innerHTML = '';
    
    if (stats.hardestSentences.length === 0) {
      list.textContent = 'No long or complex sentences found.';
      return;
    }

    for (var i = 0; i < stats.hardestSentences.length; i++) {
      var s = stats.hardestSentences[i];
      var tile = document.createElement('div');
      tile.className = 'sentence-tile';

      var header = document.createElement('div');
      header.className = 'sentence-header';
      var rank = document.createElement('span');
      rank.className = 'sentence-rank';
      rank.textContent = '#' + s.rank;
      
      var scoreBadge = document.createElement('span');
      scoreBadge.style.fontWeight = '500';
      scoreBadge.style.fontSize = '14px';
      scoreBadge.textContent = s.difficulty.toFixed(0) + '/100';
      
      header.appendChild(rank);
      header.appendChild(scoreBadge);
      tile.appendChild(header);

      var stext = document.createElement('div');
      stext.className = 'sentence-text';
      var txt = s.text;
      if (txt.length > 200) txt = txt.substring(0, 197) + '...';
      stext.textContent = txt;
      tile.appendChild(stext);

      var tags = document.createElement('div');
      tags.className = 'sentence-tags';
      for (var r = 0; r < s.reasons.length; r++) {
        var t = document.createElement('span');
        t.className = 'tag-pill';
        t.textContent = s.reasons[r];
        tags.appendChild(t);
      }
      if (s.rareWords.length > 0) {
        var tr = document.createElement('span');
        tr.className = 'tag-pill';
        tr.textContent = s.rareWords.length + ' rare words';
        tags.appendChild(tr);
      }
      tile.appendChild(tags);

      var footer = document.createElement('div');
      footer.className = 'sentence-footer';
      footer.textContent = s.wordCount + ' words, ' + (s.syllableCount / s.wordCount).toFixed(1) + ' syllables/word.';
      
      var btn = document.createElement('button');
      btn.className = 'btn btn-small btn-secondary';
      btn.textContent = 'Show in text';
      (function(rankNum) {
        btn.addEventListener('click', function() {
          switchMobileTab('text');
          var markEl = document.getElementById('mark-' + rankNum);
          if (markEl) {
            markEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            markEl.style.backgroundColor = 'var(--hi-bg)';
            setTimeout(function() { markEl.style.backgroundColor = ''; }, 1200);
          }
        });
      })(s.rank);
      footer.appendChild(btn);
      tile.appendChild(footer);

      list.appendChild(tile);
    }
  }

  function renderOverview(stats) {
    document.getElementById('stat-words').textContent = stats.wordCount;
    document.getElementById('stat-sentences').textContent = stats.sentenceCount;
    document.getElementById('stat-wps').textContent = (stats.wordCount / stats.sentenceCount).toFixed(1);
    var mins = Math.max(1, Math.round(stats.wordCount / 250));
    document.getElementById('stat-time').textContent = '~' + mins + ' min';
    document.getElementById('stat-fre').textContent = stats.fleschReadingEase.toFixed(1) + ' (' + stats.fleschLabel + ')';

    // Dialogue
    document.getElementById('check-dialogue').textContent = 'Dialogue share: ' + (stats.dialogueShare.share * 100).toFixed(1) + '%';
    document.getElementById('check-dialogue-advice').textContent = stats.dialogueShare.wordCount + ' words inside quotation marks. Fiction usually thrives with more dialogue.';

    // Passive
    document.getElementById('check-passive').textContent = 'Passive voice: ' + stats.passiveVoicePer1000.toFixed(1) + ' per 1k words';
    document.getElementById('check-passive-advice').textContent = 'Found ' + stats.passiveVoiceCount + ' potential instances (estimate). Active voice is usually punchier.';

    // Adverbs
    document.getElementById('check-adverbs').textContent = 'Adverbs: ' + stats.adverbsPer1000.toFixed(1) + ' per 1k words';
    document.getElementById('check-adverbs-advice').textContent = 'Found ' + stats.adverbCount + ' ly-words. Strong verbs often work better than adverbs.';

    // Paragraphs
    document.getElementById('check-paragraph').textContent = 'Longest paragraph: ' + stats.longestParagraph.wordCount + ' words';
    document.getElementById('check-paragraph-advice').textContent = stats.longestParagraph.wordCount > 250 ? 'Paragraphs over 250 words can look like a wall of text.' : 'Well within the 250 word limit.';

    // Openers
    var openers = stats.openerFlags || [];
    var opEl = document.getElementById('check-openers-container');
    if (openers.length > 0) {
      opEl.classList.remove('hidden');
      document.getElementById('check-openers').textContent = 'Repeated openers: ' + openers.length;
      var opWords = openers.map(function(o) { return '"' + o.word + '"'; });
      document.getElementById('check-openers-advice').textContent = 'Sentences started with the same word 3+ times: ' + opWords.join(', ') + '.';
    } else {
      opEl.classList.add('hidden');
    }
  }

  function renderVocabulary(stats) {
    document.getElementById('vocab-share').textContent = (stats.rareWordShare * 100).toFixed(1) + '% of words are not in the top 5,000 most common English words.';
    var list = document.getElementById('rare-word-list');
    list.innerHTML = '';
    
    // Show top 10
    var limit = Math.min(10, stats.rareWords.length);
    for (var i = 0; i < limit; i++) {
      var w = stats.rareWords[i];
      var t = document.createElement('span');
      t.className = 'rare-tag';
      t.textContent = w.word + ' (' + w.count + ')';
      list.appendChild(t);
    }
    if (stats.rareWords.length === 0) {
      list.textContent = 'No rare words found.';
    }
  }

  function renderRhythm(stats) {
    var chart = document.getElementById('rhythm-chart');
    chart.innerHTML = '';
    var lengths = stats.sentenceLengths;
    if (lengths.length === 0) return;

    var maxLen = Math.max.apply(null, lengths);
    if (maxLen === 0) maxLen = 1;

    // Grouping into max 90 bars
    var numBars = Math.min(lengths.length, 90);
    var groupSize = Math.ceil(lengths.length / numBars);
    var bars = [];
    var isHardFlags = [];
    
    var hardestIdxs = stats.hardestSentences.map(function(s) { return s.originalIndex; });

    for (var i = 0; i < lengths.length; i += groupSize) {
      var chunk = lengths.slice(i, i + groupSize);
      var maxInChunk = Math.max.apply(null, chunk);
      bars.push(maxInChunk);
      
      var hasHard = false;
      for (var j = 0; j < chunk.length; j++) {
        if (hardestIdxs.indexOf(i + j) !== -1) hasHard = true;
      }
      isHardFlags.push(hasHard);
    }

    for (var b = 0; b < bars.length; b++) {
      var bar = document.createElement('div');
      bar.className = 'rhythm-bar' + (isHardFlags[b] ? ' hardest' : '');
      var h = (bars[b] / maxLen) * 100;
      bar.style.height = h + '%';
      chart.appendChild(bar);
    }

    document.getElementById('rhythm-stats').textContent = 'Longest: ' + stats.longestSentenceWords + ' words. Shortest: ' + stats.shortestSentenceWords + ' words. Std dev: ' + stats.sentenceLengthStdDev.toFixed(1) + '.';
    var interp = 'A standard deviation below 5 usually means the sentence lengths are too monotonous.';
    if (stats.sentenceLengthStdDev > 5) interp = 'Good variation in sentence length keeps readers engaged.';
    document.getElementById('rhythm-interpretation').textContent = interp;
  }

  function renderFormulasTable(stats) {
    var tbody = document.getElementById('formulas-tbody');
    tbody.innerHTML = '';
    var formulas = [
      { name: 'Flesch-Kincaid', val: stats.fleschKincaid },
      { name: 'Gunning Fog', val: stats.gunningFog },
      { name: 'Coleman-Liau', val: stats.colemanLiau },
      { name: 'ARI', val: stats.ari }
    ];
    if (stats.smog !== null) {
      formulas.push({ name: 'SMOG', val: stats.smog });
    }
    
    for (var i = 0; i < formulas.length; i++) {
      var tr = document.createElement('tr');
      var td1 = document.createElement('td');
      td1.textContent = formulas[i].name;
      var td2 = document.createElement('td');
      td2.textContent = formulas[i].val.toFixed(1);
      tr.appendChild(td1);
      tr.appendChild(td2);
      tbody.appendChild(tr);
    }
  }

  function renderHighlights(stats) {
    var text = stats.originalText;
    var markers = [];
    for (var i = 0; i < stats.hardestSentences.length; i++) {
      var s = stats.hardestSentences[i];
      markers.push({
        start: s.startOffset,
        end: s.endOffset,
        rank: s.rank
      });
    }
    markers.sort(function(a, b) { return a.start - b.start; });

    mirrorLayer.innerHTML = ''; // safe since we only use textContent nodes below
    var lastPos = 0;
    
    for (var j = 0; j < markers.length; j++) {
      var m = markers[j];
      if (m.start > lastPos) {
        mirrorLayer.appendChild(document.createTextNode(text.slice(lastPos, m.start)));
      }
      
      var mark = document.createElement('mark');
      mark.id = 'mark-' + m.rank;
      mark.textContent = text.slice(m.start, m.end);
      mirrorLayer.appendChild(mark);
      
      lastPos = m.end;
    }

    if (lastPos < text.length) {
      mirrorLayer.appendChild(document.createTextNode(text.slice(lastPos)));
    }
    
    // Must add a tiny spacer if text ends in newline to sync textarea scrollheight
    if (text[text.length - 1] === '\n') {
      mirrorLayer.appendChild(document.createTextNode('\u200B'));
    }
  }

  function handleCopy() {
    if (!currentStats) return;
    var s = currentStats;
    var report = [
      'CHAPTER READABILITY REPORT',
      'Overall Grade: ' + s.medianGrade.toFixed(1),
      'Flesch Reading Ease: ' + s.fleschReadingEase.toFixed(1) + ' (' + s.fleschLabel + ')',
      '',
      'Flesch-Kincaid: ' + s.fleschKincaid.toFixed(1),
      'Gunning Fog: ' + s.gunningFog.toFixed(1),
      'Coleman-Liau: ' + s.colemanLiau.toFixed(1),
      'ARI: ' + s.ari.toFixed(1),
      (s.smog !== null ? 'SMOG: ' + s.smog.toFixed(1) : ''),
      '',
      'Rhythm variation: ' + s.sentenceLengthStdDev.toFixed(1) + ' words',
      'Passive voice: ' + s.passiveVoicePer1000.toFixed(1) + ' per 1000 words',
      'Adverbs: ' + s.adverbsPer1000.toFixed(1) + ' per 1000 words',
      'Dialogue share: ' + (s.dialogueShare.share * 100).toFixed(1) + '%'
    ].join('\n');
    
    navigator.clipboard.writeText(report).then(function() {
      var old = btnCopy.textContent;
      btnCopy.textContent = 'Copied!';
      setTimeout(function() { btnCopy.textContent = old; }, 2000);
    });
  }

});
