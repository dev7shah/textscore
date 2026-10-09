document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var textInput = document.getElementById('text-input');
  var btnCheck = document.getElementById('btn-check');
  var btnSample = document.getElementById('btn-sample');
  var btnClear = document.getElementById('btn-clear');
  var btnCopy = document.getElementById('btn-copy');
  var audienceSelect = document.getElementById('audience-select');
  var resultsSection = document.getElementById('results');
  var loadingSection = document.getElementById('loading');
  var errorMsg = document.getElementById('error-message');

  var currentStats = null;
  var currentAudience = 'nonfiction';

  var SAMPLE_TEXT = "It was a dark and stormy night; the rain fell in torrents, except at occasional intervals, when it was checked by a violent gust of wind which swept up the streets (for it is in London that our scene lies), rattling along the housetops, and fiercely agitating the scanty flame of the lamps that struggled against the darkness.\n\n\"What a terrible night!\" she exclaimed, looking out the window. \"I cannot believe we are stuck here.\"\n\nHe did not reply immediately. He was busy examining the old map they had found in the attic. It was covered in dust and mysterious symbols that seemed to shift when you looked away. The whole situation was becoming increasingly peculiar, and he felt a growing sense of unease. Nevertheless, they had to press on with their investigation.";

  // Setup Event Listeners
  btnCheck.addEventListener('click', handleCheck);
  btnSample.addEventListener('click', function () {
    textInput.value = SAMPLE_TEXT;
    handleCheck();
  });
  btnClear.addEventListener('click', function () {
    textInput.value = '';
    resultsSection.classList.add('hidden');
    errorMsg.classList.add('hidden');
    textInput.focus();
  });
  btnCopy.addEventListener('click', handleCopy);
  audienceSelect.addEventListener('change', function (e) {
    currentAudience = e.target.value;
    if (currentStats) updateVerdict(currentStats);
  });

  function handleCheck() {
    var text = textInput.value;
    if (!text.trim()) {
      showError('Please enter some text to check.');
      return;
    }

    errorMsg.classList.add('hidden');
    resultsSection.classList.add('hidden');
    loadingSection.classList.remove('hidden');

    // Use a small timeout to let the UI update before heavy processing
    setTimeout(function () {
      try {
        currentStats = Readability.computeStats(text, window.CommonWords);
        if (!currentStats) {
          showError('Not enough text to analyze. Please add more words.');
        } else {
          renderResults(currentStats);
          resultsSection.classList.remove('hidden');
        }
      } catch (err) {
        showError('An error occurred while processing the text. ' + err.message);
      } finally {
        loadingSection.classList.add('hidden');
      }
    }, 10);
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
    loadingSection.classList.add('hidden');
  }

  function renderResults(stats) {
    // 1. Headline Grade
    document.getElementById('headline-score').textContent = 'Grade ' + stats.medianGrade.toFixed(1);
    document.getElementById('flesch-label').textContent = stats.fleschLabel + ' (' + stats.fleschReadingEase.toFixed(1) + ')';
    
    var warningEl = document.getElementById('disagree-warning');
    if (stats.formulasDisagree) {
      warningEl.textContent = 'Formulas disagree. The text probably has unusual sentence lengths or many names. Range: Grade ' + stats.minGrade.toFixed(1) + ' to ' + stats.maxGrade.toFixed(1) + '.';
      warningEl.classList.remove('hidden');
    } else {
      warningEl.classList.add('hidden');
    }

    updateVerdict(stats);

    // 2. Formula Table
    var tbody = document.getElementById('formula-table-body');
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
    if (stats.smog === null) {
      var tr = document.createElement('tr');
      var td1 = document.createElement('td');
      td1.textContent = 'SMOG';
      var td2 = document.createElement('td');
      td2.textContent = 'Needs 30+ sentences';
      td2.style.color = 'var(--text-muted)';
      td2.style.fontSize = '0.9em';
      tr.appendChild(td1);
      tr.appendChild(td2);
      tbody.appendChild(tr);
    }

    // 3. Chapter Checks
    var checksList = document.getElementById('chapter-checks-list');
    checksList.innerHTML = '';

    // Rhythm (Bar chart)
    var rhythmLi = document.createElement('li');
    rhythmLi.className = 'check-item';
    var svgChart = createRhythmChart(stats.sentenceLengths);
    var rhythmText = document.createElement('div');
    rhythmText.className = 'check-result';
    rhythmText.textContent = 'Rhythm variation: ' + stats.sentenceLengthStdDev.toFixed(1) + ' words';
    var rhythmDesc = document.createElement('div');
    rhythmDesc.className = 'check-desc';
    rhythmDesc.textContent = 'Longest: ' + stats.longestSentenceWords + ' words. Shortest: ' + stats.shortestSentenceWords + ' words. A low spread means monotone rhythm.';
    rhythmLi.appendChild(rhythmText);
    rhythmLi.appendChild(rhythmDesc);
    rhythmLi.appendChild(svgChart);
    checksList.appendChild(rhythmLi);

    // Passive voice
    var passiveLi = document.createElement('li');
    passiveLi.className = 'check-item';
    var pDiv = document.createElement('div');
    pDiv.className = 'check-result';
    pDiv.textContent = 'Passive voice: ' + stats.passiveVoicePer1000.toFixed(1) + ' per 1000 words';
    var pDesc = document.createElement('div');
    pDesc.className = 'check-desc';
    pDesc.textContent = 'Found ' + stats.passiveVoiceCount + ' potential instances. This is an estimate.';
    passiveLi.appendChild(pDiv);
    passiveLi.appendChild(pDesc);
    checksList.appendChild(passiveLi);

    // Adverbs
    var advLi = document.createElement('li');
    advLi.className = 'check-item';
    var aDiv = document.createElement('div');
    aDiv.className = 'check-result';
    aDiv.textContent = 'Adverbs: ' + stats.adverbsPer1000.toFixed(1) + ' per 1000 words';
    var aDesc = document.createElement('div');
    aDesc.className = 'check-desc';
    aDesc.textContent = 'Found ' + stats.adverbCount + ' ly words.';
    advLi.appendChild(aDiv);
    advLi.appendChild(aDesc);
    checksList.appendChild(advLi);

    // Dialogue share
    var dialLi = document.createElement('li');
    dialLi.className = 'check-item';
    var dDiv = document.createElement('div');
    dDiv.className = 'check-result';
    dDiv.textContent = 'Dialogue share: ' + (stats.dialogueShare.share * 100).toFixed(1) + '%';
    var dDesc = document.createElement('div');
    dDesc.className = 'check-desc';
    dDesc.textContent = stats.dialogueShare.wordCount + ' words inside quotation marks.';
    dialLi.appendChild(dDiv);
    dialLi.appendChild(dDesc);
    checksList.appendChild(dialLi);

    // Longest paragraph
    var paraLi = document.createElement('li');
    paraLi.className = 'check-item';
    var paDiv = document.createElement('div');
    paDiv.className = 'check-result';
    paDiv.textContent = 'Longest paragraph: ' + stats.longestParagraph.wordCount + ' words';
    var paDesc = document.createElement('div');
    paDesc.className = 'check-desc';
    if (stats.longestParagraph.wordCount > 250) {
      paDesc.textContent = 'Flagged: Paragraphs over 250 words can look like a wall of text.';
      paDiv.style.color = 'var(--warning)';
    } else {
      paDesc.textContent = 'Well within the 250 word limit.';
    }
    paraLi.appendChild(paDiv);
    paraLi.appendChild(paDesc);
    checksList.appendChild(paraLi);

    // Sentence openers
    if (stats.openerFlags && stats.openerFlags.length > 0) {
      var opLi = document.createElement('li');
      opLi.className = 'check-item';
      var oDiv = document.createElement('div');
      oDiv.className = 'check-result';
      oDiv.textContent = 'Repeated sentence openers: ' + stats.openerFlags.length;
      oDiv.style.color = 'var(--warning)';
      var oDesc = document.createElement('div');
      oDesc.className = 'check-desc';
      var opWords = [];
      for (var k = 0; k < stats.openerFlags.length; k++) {
        opWords.push('"' + stats.openerFlags[k].word + '"');
      }
      oDesc.textContent = 'Sentences started with the same word 3 or more times: ' + opWords.join(', ') + '.';
      opLi.appendChild(oDiv);
      opLi.appendChild(oDesc);
      checksList.appendChild(opLi);
    }

    // 4. Vocabulary
    document.getElementById('rare-word-share').textContent = (stats.rareWordShare * 100).toFixed(1) + '% of words are not in the top 5,000 most common English words.';
    var rareContainer = document.getElementById('rare-words-list');
    rareContainer.innerHTML = '';
    if (stats.rareWords.length > 0) {
      for (var r = 0; r < stats.rareWords.length; r++) {
        var t = document.createElement('span');
        t.className = 'tag';
        t.textContent = stats.rareWords[r].word + ' (' + stats.rareWords[r].count + ')';
        rareContainer.appendChild(t);
      }
    } else {
      rareContainer.textContent = 'No rare words found.';
    }

    // 5. Hardest Sentences
    var hardContainer = document.getElementById('hardest-sentences-container');
    hardContainer.innerHTML = '';
    
    if (stats.hardestSentences.length === 0) {
      hardContainer.textContent = 'No long sentences found.';
    } else {
      for (var h = 0; h < stats.hardestSentences.length; h++) {
        var sent = stats.hardestSentences[h];
        var card = document.createElement('div');
        card.className = 'hard-sentence-card';
        
        var badge = document.createElement('div');
        badge.className = 'rank-badge';
        badge.textContent = sent.rank;
        card.appendChild(badge);

        var st = document.createElement('div');
        st.className = 'hard-text';
        st.textContent = sent.text;
        card.appendChild(st);

        var meta = document.createElement('div');
        meta.className = 'hard-meta';
        
        var sc = document.createElement('span');
        sc.className = 'score-badge';
        sc.textContent = 'Score: ' + sent.difficulty.toFixed(0) + '/100';
        meta.appendChild(sc);

        var wc = document.createElement('span');
        wc.textContent = sent.wordCount + ' words';
        meta.appendChild(wc);

        for (var t = 0; t < sent.reasons.length; t++) {
          var rtag = document.createElement('span');
          rtag.className = 'tag tag-reason';
          rtag.textContent = sent.reasons[t];
          meta.appendChild(rtag);
        }

        if (sent.rareWords.length > 0) {
          var rw = document.createElement('span');
          // take up to 3 for summary
          var topR = sent.rareWords.slice(0, 3).join(', ');
          if (sent.rareWords.length > 3) topR += '...';
          rw.textContent = 'Rare: ' + topR;
          meta.appendChild(rw);
        }

        var btn = document.createElement('button');
        btn.className = 'btn secondary outline btn-show';
        btn.textContent = 'Show in text';
        // Use closure to capture rank
        (function(rankNum) {
          btn.addEventListener('click', function() {
            var el = document.getElementById('mark-' + rankNum);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.remove('mark-flash');
              // trigger reflow
              void el.offsetWidth;
              el.classList.add('mark-flash');
            }
          });
        })(sent.rank);
        meta.appendChild(btn);

        card.appendChild(meta);
        hardContainer.appendChild(card);
      }
    }

    // 6. Annotated Chapter
    renderAnnotatedText(stats);
  }

  function updateVerdict(stats) {
    var vEl = document.getElementById('headline-verdict');
    var grade = stats.medianGrade;
    var targetMin, targetMax;
    
    if (currentAudience === 'fiction') {
      targetMin = 5; targetMax = 8;
    } else if (currentAudience === 'nonfiction') {
      targetMin = 8; targetMax = 10;
    } else {
      targetMin = 12; targetMax = 99;
    }

    if (grade < targetMin) {
      vEl.textContent = 'Below target grade';
      vEl.style.color = 'var(--success)';
    } else if (grade > targetMax) {
      vEl.textContent = 'Above target grade';
      vEl.style.color = 'var(--error)';
    } else {
      vEl.textContent = 'On target';
      vEl.style.color = 'var(--success)';
    }
  }

  function createRhythmChart(lengths) {
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "rhythm-chart");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("preserveAspectRatio", "none");
    
    if (lengths.length === 0) return svg;

    var maxLen = Math.max.apply(null, lengths);
    if (maxLen === 0) maxLen = 1;

    for (var i = 0; i < lengths.length; i++) {
      var rect = document.createElementNS(svgNS, "rect");
      var widthPct = 100 / lengths.length;
      var heightPct = (lengths[i] / maxLen) * 100;
      
      rect.setAttribute("x", (i * widthPct) + "%");
      rect.setAttribute("y", (100 - heightPct) + "%");
      rect.setAttribute("width", Math.max(0.5, widthPct - 1) + "%");
      rect.setAttribute("height", heightPct + "%");
      rect.setAttribute("fill", "var(--primary)");
      rect.setAttribute("opacity", "0.7");
      
      // Simple tooltip
      var title = document.createElementNS(svgNS, "title");
      title.textContent = "Sentence " + (i+1) + ": " + lengths[i] + " words";
      rect.appendChild(title);
      
      svg.appendChild(rect);
    }
    return svg;
  }

  function renderAnnotatedText(stats) {
    var container = document.getElementById('annotated-text');
    container.innerHTML = '';
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
    // Sort by start offset
    markers.sort(function(a, b) { return a.start - b.start; });

    var lastPos = 0;
    for (var i = 0; i < markers.length; i++) {
      var m = markers[i];
      if (m.start > lastPos) {
        var textNode = document.createTextNode(text.slice(lastPos, m.start));
        container.appendChild(textNode);
      }
      
      var mark = document.createElement('mark');
      mark.id = 'mark-' + m.rank;
      var innerText = text.slice(m.start, m.end);
      
      // Add rank number at start
      var sup = document.createElement('sup');
      sup.textContent = '[' + m.rank + '] ';
      sup.style.fontWeight = 'bold';
      sup.style.userSelect = 'none';
      mark.appendChild(sup);
      
      mark.appendChild(document.createTextNode(innerText));
      container.appendChild(mark);
      
      lastPos = m.end;
    }

    if (lastPos < text.length) {
      container.appendChild(document.createTextNode(text.slice(lastPos)));
    }
  }

  function handleCopy() {
    if (!currentStats) return;
    
    var s = currentStats;
    var lines = [];
    lines.push('CHAPTER READABILITY REPORT');
    lines.push('==========================');
    lines.push('Overall Grade: ' + s.medianGrade.toFixed(1));
    lines.push('Flesch Reading Ease: ' + s.fleschReadingEase.toFixed(1) + ' (' + s.fleschLabel + ')');
    lines.push('');
    lines.push('SCORES');
    lines.push('Flesch-Kincaid: ' + s.fleschKincaid.toFixed(1));
    lines.push('Gunning Fog: ' + s.gunningFog.toFixed(1));
    lines.push('Coleman-Liau: ' + s.colemanLiau.toFixed(1));
    lines.push('ARI: ' + s.ari.toFixed(1));
    if (s.smog !== null) lines.push('SMOG: ' + s.smog.toFixed(1));
    lines.push('');
    lines.push('CHAPTER CHECKS');
    lines.push('Rhythm variation: ' + s.sentenceLengthStdDev.toFixed(1) + ' words');
    lines.push('Passive voice: ' + s.passiveVoicePer1000.toFixed(1) + ' per 1000 words');
    lines.push('Adverbs: ' + s.adverbsPer1000.toFixed(1) + ' per 1000 words');
    lines.push('Dialogue share: ' + (s.dialogueShare.share * 100).toFixed(1) + '%');
    lines.push('');
    lines.push('VOCABULARY');
    lines.push('Rare words: ' + (s.rareWordShare * 100).toFixed(1) + '%');
    
    var report = lines.join('\n');
    
    navigator.clipboard.writeText(report).then(function() {
      var oldText = btnCopy.textContent;
      btnCopy.textContent = 'Copied!';
      setTimeout(function() {
        btnCopy.textContent = oldText;
      }, 2000);
    }).catch(function(err) {
      alert('Failed to copy: ' + err);
    });
  }
});
