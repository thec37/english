let WORDS = [];

async function loadWords() {
  try {
    const res = await fetch('words.json');
    WORDS = await res.json();
  } catch(e) {
    document.getElementById('start-btn').textContent = '⚠ Sunucu gerekli (GitHub Pages)';
    return;
  }
  initHome();
}

function initHome() {
  document.getElementById('start-btn').disabled = false;
  document.getElementById('start-btn').textContent = 'Başla →';
  document.getElementById('start-btn').style.opacity = '1';
}

let currentMode = 'multiple';
let currentLevel = 'A1';
let currentCat = 'all';
let queue = [];
let qIndex = 0;
let score = 0;
let correct = 0;
let wrong = 0;
let answered = false;
let streakHistory = [];
let isFlipped = false;
let flashKnew = 0;
let wrongWords = [];
let isRetryRound = false;

const catLabels = {
  verb:'Fiil', noun:'İsim', adjective:'Sıfat', adverb:'Zarf',
  conjunction:'Bağlaç', time:'Zaman', travel:'Seyahat', daily:'Günlük',
  family:'Aile', color:'Renk', food:'Yiyecek', number:'Sayı',
  conjugation:'Fiil Çekimi'
};

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function selectMode(el) {
  document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  currentMode = el.dataset.mode;
}

function selectCat(el) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  currentCat = el.dataset.cat;
}

function selectLevel(el) {
  document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  currentLevel = el.dataset.level;
}

// Kategori eşleme tablosu (HTML data-cat → words.json cat)
const catMap = {
  'verb':        'fiil',
  'noun':        'isim',
  'adjective':   'sıfat',
  'adverb':      'zarf',
  'conjunction': 'bağlaç',
  'time':        'zaman',
  'travel':      'seyahat',
  'daily':       'günlük',
  'family':      'aile',
  'color':       'renk',
  'food':        'yiyecek',
  'number':      'sayı',
};

function getPool() {
  if (currentCat === 'conjugation') {
    let pool = currentLevel === 'all' ? WORDS : WORDS.filter(w => w.level === currentLevel);
    return pool.filter(w => w.conjugations);
  }
  let pool = currentLevel === 'all' ? WORDS : WORDS.filter(w => w.level === currentLevel);
  if (currentCat !== 'all') {
    const mappedCat = catMap[currentCat] || currentCat; // eşleme yoksa direkt kullan
    pool = pool.filter(w => w.cat === mappedCat);
  }
  return pool;
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'screen-grammar') renderGrammar();
}

function goHome() { showScreen('screen-home'); }

function togglePratik() {
  const card = document.getElementById('pratik-card');
  const panel = document.getElementById('pratik-panel');
  const isOpen = card.classList.contains('open');
  if (isOpen) {
    card.classList.remove('open');
    panel.classList.remove('open');
  } else {
    card.classList.add('open');
    panel.classList.add('open');
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  }
}

function startQuiz() {
  const pool = getPool();
  if (pool.length < 4) { alert('Bu kategoride yeterli kelime yok!'); return; }
  queue = shuffle(pool).slice(0, Math.min(10, pool.length));
  qIndex = 0; score = 0; correct = 0; wrong = 0; streakHistory = []; wrongWords = []; isRetryRound = false;

  const levelLabel = currentLevel === 'all' ? 'Hepsi' : currentLevel;
  document.getElementById('level-badge').textContent = levelLabel;
  document.getElementById('flash-level-badge').textContent = levelLabel;

  if (currentMode === 'flash') {
    flashKnew = 0;
    showScreen('screen-flash');
    showFlashCard();
  } else {
    showScreen('screen-quiz');
    buildStreakBar();
    showQuestion();
  }
}

function buildStreakBar() {
  const bar = document.getElementById('streak-bar');
  bar.innerHTML = '';
  for (let i = 0; i < queue.length; i++) {
    const d = document.createElement('div');
    d.className = 'streak-dot'; d.id = 'dot-' + i;
    bar.appendChild(d);
  }
}

function showQuestion() {
  answered = false;
  document.getElementById('next-btn').classList.remove('visible');
  document.getElementById('feedback').innerHTML = '';
  document.getElementById('feedback').className = 'feedback';

  const w = queue[qIndex];
  const isReverse = currentMode === 'reverse';
  document.getElementById('q-counter').textContent = `${qIndex + 1} / ${queue.length}`;
  document.getElementById('score-display').textContent = score;
  document.getElementById('prog-fill').style.width = `${((qIndex + 1) / queue.length) * 100}%`;
  document.getElementById('q-cat').textContent = catLabels[w.cat] || w.cat;

  if (isReverse) {
    document.getElementById('dir-from').textContent = 'İngilizce';
    document.getElementById('dir-to').textContent = 'Türkçe';
    document.getElementById('q-word').textContent = w.en;
  } else {
    document.getElementById('dir-from').textContent = 'Türkçe';
    document.getElementById('dir-to').textContent = 'İngilizce';
    document.getElementById('q-word').textContent = w.tr;
  }

  const container = document.getElementById('options-container');
  container.innerHTML = '';

  if (currentCat === 'conjugation' && w.conjugations) {
    document.getElementById('dir-from').textContent = '';
    document.getElementById('dir-to').textContent = '';
    document.getElementById('q-word').textContent = '';
    showConjugationQuestion(w, container);
    return;
  }

  if (currentMode === 'fill') {
    const inp = document.createElement('input');
    inp.type = 'text'; inp.className = 'fill-input';
    inp.placeholder = isReverse ? 'Türkçesini yaz...' : 'İngilizcesini yaz...';
    inp.id = 'fill-inp';
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') submitFill(); });
    container.appendChild(inp);
    const btn = document.createElement('button');
    btn.className = 'submit-btn'; btn.textContent = 'Kontrol Et'; btn.onclick = submitFill;
    container.appendChild(btn);
    setTimeout(() => inp.focus(), 100);
  } else {
    const pool = getPool();
    const field = isReverse ? 'tr' : 'en';
    const correctAns = isReverse ? w.tr : w.en;
    const wrongs = shuffle(pool.filter(x => x[field] !== correctAns)).slice(0, 3).map(x => x[field]);
    const opts = shuffle([correctAns, ...wrongs]);
    const letters = ['A','B','C','D'];
    const div = document.createElement('div'); div.className = 'options';
    opts.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'opt';
      btn.innerHTML = `<span class="opt-letter">${letters[i]}</span>${opt}`;
      btn.onclick = () => checkOpt(btn, opt, correctAns);
      div.appendChild(btn);
    });
    container.appendChild(div);
  }
}

function submitFill() {
  if (answered) return;
  const inp = document.getElementById('fill-inp');
  const w = queue[qIndex];
  const isReverse = currentMode === 'reverse';
  const userVal = inp.value.trim().toLowerCase();
  const correct_ans = isReverse ? w.tr.toLowerCase() : w.en.toLowerCase();
  const display = isReverse ? w.tr : w.en;
  checkFill(inp, userVal, correct_ans, display);
}

function checkFill(inp, userVal, correctVal, display) {
  answered = true;
  inp.disabled = true;
  document.querySelector('.submit-btn').disabled = true;
  if (userVal === correctVal) {
    inp.classList.add('correct-input');
    setFeedback(true, '');
    score += 10; correct++;
    markStreak(qIndex, true);
  } else {
    inp.classList.add('wrong-input');
    setFeedback(false, `Doğrusu: ${display}`);
    wrong++;
    markStreak(qIndex, false);
    if (!isRetryRound) wrongWords.push(queue[qIndex]);
  }
  document.getElementById('score-display').textContent = score;
  document.getElementById('next-btn').classList.add('visible');
}

function checkOpt(btn, chosen, correctAns) {
  if (answered) return;
  answered = true;
  document.querySelectorAll('.opt').forEach(b => { b.disabled = true; });
  if (chosen === correctAns) {
    btn.classList.add('correct-opt');
    setFeedback(true, '');
    score += 10; correct++;
    markStreak(qIndex, true);
  } else {
    btn.classList.add('wrong-opt');
    document.querySelectorAll('.opt').forEach(b => { if (b.innerHTML.includes(correctAns)) b.classList.add('correct-opt'); });
    setFeedback(false, `Doğrusu: ${correctAns}`);
    wrong++;
    markStreak(qIndex, false);
    if (!isRetryRound) wrongWords.push(queue[qIndex]);
  }
  document.getElementById('score-display').textContent = score;
  document.getElementById('next-btn').classList.add('visible');
}

function setFeedback(isCorrect, hint) {
  const fb = document.getElementById('feedback');
  fb.className = 'feedback ' + (isCorrect ? 'show-correct' : 'show-wrong');
  fb.innerHTML = `<span class="dot"></span>${isCorrect ? 'Doğru!' : (hint || 'Yanlış!')}`;
}

function markStreak(i, isCorrect) {
  const dot = document.getElementById('dot-' + i);
  if (dot) dot.classList.add(isCorrect ? 'correct-dot' : 'wrong-dot');
}

function showConjugationQuestion(w, container) {
  const tenses = Object.keys(w.conjugations);
  const tense = tenses[Math.floor(Math.random() * tenses.length)];
  const forms = w.conjugations[tense];
  const pronouns = Object.keys(forms);
  const pronoun = pronouns[Math.floor(Math.random() * pronouns.length)];
  const correctAns = forms[pronoun];

  document.getElementById('dir-from').textContent = tense;
  document.getElementById('dir-to').textContent = pronoun;
  document.getElementById('q-cat').textContent = 'Fiil Çekimi';
  document.getElementById('q-word').textContent = w.en + '  —  ' + w.tr;

  const allForms = [];
  WORDS.filter(x => x.conjugations && x.en !== w.en).forEach(x => {
    const f = x.conjugations[tense]?.[pronoun];
    if (f && f !== correctAns && !allForms.includes(f)) allForms.push(f);
  });
  const wrongs = allForms.sort(() => Math.random()-0.5).slice(0,3);
  const opts = [correctAns, ...wrongs].sort(() => Math.random()-0.5);
  const letters = ['A','B','C','D'];
  const div = document.createElement('div'); div.className = 'options';
  opts.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'opt';
    btn.innerHTML = `<span class="opt-letter">${letters[i]}</span>${opt}`;
    btn.onclick = () => checkOpt(btn, opt, correctAns);
    div.appendChild(btn);
  });
  container.appendChild(div);
}

function nextQuestion() {
  qIndex++;
  if (qIndex >= queue.length) { showResult(); return; }
  showQuestion();
}

function showResult() {
  const total = queue.length;
  const pct = Math.round((correct / total) * 100);
  document.getElementById('res-correct').textContent = correct;
  document.getElementById('res-wrong').textContent = wrong;
  document.getElementById('res-total').textContent = total;
  document.getElementById('ring-pct').textContent = pct + '%';
  const titles = pct >= 90
    ? ['Mükemmel! 🏆', 'Kelime hazinen gerçekten harika!']
    : pct >= 70
    ? ['Çok İyi! 👏', 'Biraz daha pratikle mükemmel olacaksın.']
    : pct >= 50
    ? ['Fena Değil 💪', 'Düzenli çalışmaya devam et!']
    : ['Daha Çok Pratik 📚', 'Zorlanma, tekrar edince gelir!'];
  document.getElementById('res-title').textContent = titles[0];
  document.getElementById('res-sub').textContent = titles[1];
  showScreen('screen-result');
  setTimeout(() => {
    const circumference = 326.7;
    const offset = circumference - (pct / 100) * circumference;
    document.getElementById('ring-fill').style.strokeDashoffset = offset;
  }, 200);
  const retryBtn = document.getElementById('retry-wrong-btn');
  if (wrongWords.length > 0 && !isRetryRound) {
    document.getElementById('wrong-count').textContent = wrongWords.length;
    retryBtn.style.display = 'block';
  } else {
    retryBtn.style.display = 'none';
  }
}

function retryWrong() {
  queue = shuffle([...wrongWords]);
  qIndex = 0; score = 0; correct = 0; wrong = 0; streakHistory = [];
  isRetryRound = true; wrongWords = [];
  const levelLabel = currentLevel === 'all' ? 'Hepsi' : currentLevel;
  document.getElementById('level-badge').textContent = levelLabel;
  showScreen('screen-quiz');
  buildStreakBar();
  showQuestion();
}

function restartSame() { startQuiz(); }

// FLASHCARD
function showFlashCard() {
  if (qIndex >= queue.length) { showFlashResult(); return; }
  isFlipped = false;
  const card = document.getElementById('flashcard');
  card.classList.remove('flipped');
  document.getElementById('flash-actions').style.display = 'none';
  const w = queue[qIndex];
  document.getElementById('flash-hint').textContent = 'Türkçe';
  document.getElementById('flash-word').textContent = w.tr;
  document.getElementById('flash-cat-el').textContent = catLabels[w.cat] || '';
  document.getElementById('flash-tap-hint').style.display = 'block';
  document.getElementById('flash-ex').style.display = 'none';
  document.getElementById('flash-counter').textContent = `${qIndex + 1} / ${queue.length}`;
  document.getElementById('flash-prog').style.width = `${((qIndex + 1) / queue.length) * 100}%`;
}

function flipCard() {
  if (isFlipped) return;
  isFlipped = true;
  const card = document.getElementById('flashcard');
  const w = queue[qIndex];
  card.classList.add('flip-out');
  setTimeout(() => {
    card.classList.add('flipped');
    document.getElementById('flash-hint').textContent = 'İngilizce';
    document.getElementById('flash-word').textContent = w.en;
    document.getElementById('flash-cat-el').textContent = catLabels[w.cat] || '';
    document.getElementById('flash-tap-hint').style.display = 'none';
    document.getElementById('flash-ex').textContent = w.ex || '';
    document.getElementById('flash-ex').style.display = w.ex ? 'block' : 'none';
    card.classList.remove('flip-out');
    document.getElementById('flash-actions').style.display = 'grid';
  }, 180);
}

function flashAnswer(knew) {
  if (knew) flashKnew++;
  document.getElementById('flash-score').textContent = flashKnew;
  qIndex++;
  setTimeout(showFlashCard, 200);
}

function showFlashResult() {
  const pct = Math.round((flashKnew / queue.length) * 100);
  correct = flashKnew; wrong = queue.length - flashKnew;
  document.getElementById('res-correct').textContent = correct;
  document.getElementById('res-wrong').textContent = wrong;
  document.getElementById('res-total').textContent = queue.length;
  document.getElementById('ring-pct').textContent = pct + '%';
  const titles = pct >= 80
    ? ['Harika! 🌟', 'Kelime kartlarında çok iyisin!']
    : ['Devam Et! 💪', 'Tekrar ettikçe daha iyi olacaksın.'];
  document.getElementById('res-title').textContent = titles[0];
  document.getElementById('res-sub').textContent = titles[1];
  showScreen('screen-result');
  setTimeout(() => {
    const offset = 326.7 - (pct / 100) * 326.7;
    document.getElementById('ring-fill').style.strokeDashoffset = offset;
  }, 200);
}

// GRAMMAR
let GRAMMAR = null;

async function loadGrammar() {
  try {
    const res = await fetch('grammar.json');
    GRAMMAR = await res.json();
  } catch(e) {
    document.getElementById('gr-content').innerHTML = '<p style="color:var(--muted);font-size:0.85rem;padding:1rem 0">grammar.json yüklenemedi — sunucu gerekli.</p>';
  }
}

function renderGrammar() {
  if (!GRAMMAR) return;
  const tabsEl = document.getElementById('gr-level-tabs');
  const contentEl = document.getElementById('gr-content');
  if (tabsEl.children.length > 0) return;

  GRAMMAR.levels.forEach((level, i) => {
    const btn = document.createElement('button');
    btn.className = 'gr-level-tab ' + level.color + (i === 0 ? ' active' : '');
    btn.textContent = level.label;
    btn.onclick = () => switchGrLevel(level.id);
    tabsEl.appendChild(btn);
  });
  renderGrLevel(GRAMMAR.levels[0].id);
}

function switchGrLevel(id) {
  document.querySelectorAll('.gr-level-tab').forEach((btn, i) => {
    const lvl = GRAMMAR.levels[i];
    btn.classList.toggle('active', lvl.id === id);
  });
  renderGrLevel(id);
}

function renderGrLevel(id) {
  const level = GRAMMAR.levels.find(l => l.id === id);
  const el = document.getElementById('gr-content');
  el.innerHTML = '';
  level.topics.forEach(topic => {
    el.appendChild(buildTopicCard(topic));
  });
}

function buildTopicCard(topic) {
  const card = document.createElement('div');
  card.className = 'gr-topic';
  card.innerHTML = `
    <div class="gr-topic-header" onclick="toggleTopic(this)">
      <div class="gr-topic-label">
        <span class="gr-topic-subtitle">${topic.subtitle}</span>
        <span class="gr-topic-title">${topic.title}</span>
      </div>
      <span class="gr-topic-chevron">›</span>
    </div>
    <div class="gr-topic-body">${buildTopicBody(topic)}</div>
  `;
  return card;
}

function buildTopicBody(topic) {
  let html = '';
  if (topic.intro) html += `<p class="gr-intro">${topic.intro}</p>`;
  if (topic.tables) {
    topic.tables.forEach(table => {
      html += '<div class="gr-table-wrap">';
      if (table.label) {
        const cls = table.accent ? ' ' + table.accent : '';
        html += `<div class="gr-table-label${cls}">${table.label}</div>`;
      }
      html += '<table class="gr-table"><thead><tr>';
      (table.headers || []).forEach(h => { html += `<th>${h}</th>`; });
      html += '</tr></thead><tbody>';
      (table.rows || []).forEach(row => {
        html += '<tr>';
        row.forEach(cell => { html += `<td>${cell}</td>`; });
        html += '</tr>';
      });
      html += '</tbody></table></div>';
    });
  }
  if (topic.examples && topic.examples.length) {
    html += '<div class="gr-examples">';
    topic.examples.forEach(ex => {
      html += `<div class="gr-example"><span class="gr-ex-en">${ex.en}</span><span class="gr-ex-tr">${ex.tr}</span></div>`;
    });
    html += '</div>';
  }
  if (topic.tips && topic.tips.length) {
    html += '<div class="gr-tips">';
    topic.tips.forEach(tip => {
      html += `<div class="gr-tip"><span class="gr-tip-dot">✦</span><span>${tip}</span></div>`;
    });
    html += '</div>';
  }
  return html;
}

function toggleTopic(headerEl) {
  headerEl.closest('.gr-topic').classList.toggle('open');
}

// INIT
loadWords();
loadGrammar();

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn && nextBtn.classList.contains('visible')) {
      e.preventDefault();
      nextQuestion();
    }
  }
});
