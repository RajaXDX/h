/* ============================= GAME STATE ============================= */

// الثوابت
// ملاحظة: هذا الرمز يعمل فقط في التشغيل المحلي بدون سحابة، حيث لا يؤثر التعديل
// على أحد. مع وجود Supabase يكون الدخول ببريد وكلمة مرور عبر Supabase Auth،
// والصلاحية مفروضة في قاعدة البيانات (راجع supabase-admin-security.sql).
const ADMIN_PIN = '2014';
const LIFELINES = [
  {
    key: 'fakh', name: 'الفخ', ic: '🪤',
    desc: 'إذا أجاب الفريق الآخر إجابة صحيحة، تذهب النقاط لكم بدلاً منه.'
  },
  {
    key: 'istareeh', name: 'استريح', ic: '✋',
    desc: 'تتخطّون السؤال بلا نقاط لأحد، ويبقى الدور معكم.'
  },
  {
    key: 'hofra', name: 'الحفرة', ic: '🕳️',
    desc: 'يُمنع الفريق الآخر من أخذ نقاط هذا السؤال.'
  },
  {
    key: 'sadeeq', name: 'اتصال بصديق', ic: '📞',
    desc: 'لديكم 30 ثانية للاتصال بصديق يساعدكم في الإجابة.'
  },
  {
    key: 'jawabain', name: 'جاوب جوابين', ic: '✌️',
    desc: 'يحقّ لكم تقديم إجابتين، وتُحتسب لكم إن صحّت إحداهما.'
  },
];

const DEFAULT_CATEGORIES = [
  { name: 'الشمال', ic: '🧭' }, { name: 'الحرمين', ic: '🕋' }, { name: 'الوسطى', ic: '🏙️' },
  { name: 'الجنوب', ic: '⛰️' }, { name: 'الغربية', ic: '🏘️' }, { name: 'الشرقية', ic: '🛢️' },
  { name: 'السعودية', ic: '🇸🇦' }, { name: 'أغاني وطنية', ic: '🎤' }, { name: 'حلا وقهوة', ic: '☕' },
  { name: 'موسم الرياض', ic: '🎡' }, { name: 'لهجات سعودية', ic: '🗣️' }, { name: 'سوبرماركت', ic: '🛒' },
  { name: 'مطاعم السعودية', ic: '🍽️' }, { name: 'شعارات سعودية', ic: '🏷️' }, { name: 'عالم الحيوان', ic: '🐘' },
  { name: 'تكنولوجيا', ic: '💻' }, { name: 'معلومات عامة', ic: '❓' }, { name: 'سيرة ذاتية', ic: '👤' },
  { name: 'تاريخ', ic: '🏛️' }, { name: 'عالم الشعر', ic: '✍️' }, { name: 'لغة وأدب', ic: '📖' },
  { name: 'طب عام', ic: '🩺' }, { name: 'عطور عربية', ic: '🪔' }, { name: 'عطور عالمية', ic: '🧴' },
  { name: 'أكل وبراد', ic: '🧺' }, { name: 'منتجات', ic: '🛍️' }, { name: 'شعارات عالمية', ic: '🌐' },
  { name: 'شعارات', ic: '🎯' }, { name: 'ميمز', ic: '😂' }, { name: 'الذكاء الاصطناعي', ic: '🤖' },
  { name: 'سيارات', ic: '🚗' }, { name: 'منو المشهور', ic: '🎩' }, { name: 'مين المؤثر', ic: '🕵️' },
  { name: 'صوت المشهور', ic: '🎙️' }, { name: 'طب الأسنان', ic: '🦷' },
];

// متغيرات الحالة
let CATEGORIES = loadJSON('mr_categories', DEFAULT_CATEGORIES.slice());
let POINTS = loadJSON('mr_points', [100, 250, 400]);
let QBANK = loadJSON('mr_bank', {});

// يعالج حالات محفوظة سابقاً بمتصفحات تأثرت بباق مزامنة قديم كتب مصفوفات/كائنات فارغة فوق البيانات الافتراضية
if (!Array.isArray(CATEGORIES) || CATEGORIES.length === 0) {
  CATEGORIES = DEFAULT_CATEGORIES.slice();
  saveJSON('mr_categories', CATEGORIES);
}
if (!Array.isArray(POINTS) || POINTS.length === 0) {
  POINTS = [100, 250, 400];
  saveJSON('mr_points', POINTS);
}

let teamSetup = {
  A: { name: 'الفريق الأول', lifelines: [] },
  B: { name: 'الفريق الثاني', lifelines: [] }
};

let selectedCats = [];
let rounds = [];
let stateUsed = {};
let questionCache = {};
let scores = { A: 0, B: 0 };
let lifelineUsed = { A: [], B: [] };
let activeRound = 0;
let current = null;
let activeTeam = null;      // الفريق صاحب الدور الحالي ('A' أو 'B')
let turnOrder = [];         // ترتيب اللاعبين في الأونلاين: [{player_id, name, team}]
let turnIndex = 0;          // موضع الدور الحالي داخل turnOrder

const DIFF = ['سهل', 'متوسط', 'صعب'];
const DIFFKEY = ['easy', 'medium', 'hard'];

/* ============================= TEAM SETUP ============================= */

function renderTeamSetup() {
  const container = document.getElementById('teamsSetupContainer');
  if (!container) return;

  container.innerHTML = '';

  ['A', 'B'].forEach(team => {
    const teamDiv = createElement('div', { class: `team-setup ${team}` }, `
      <label>${team === 'A' ? '🟢' : '🟡'} اسم الفريق ${team === 'A' ? 'الأول' : 'الثاني'}</label>
      <input type="text" id="setupName${team}" placeholder="الفريق ${team === 'A' ? 'الأول' : 'الثاني'}" value="${escapeHtml(teamSetup[team].name)}">
      <div class="lifelines-label">وسائل المساعدة (اختر 3)</div>
      <div class="lifelines" id="lifelines${team}"></div>
      <div class="lifeline-count" id="count${team}">0 / 3</div>
    `);

    container.appendChild(teamDiv);

    renderLifelineChips(team);
  });

  updateTeamSetupStatus();
}

function renderLifelineChips(team) {
  const wrap = document.getElementById(`lifelines${team}`);
  if (!wrap) return;

  wrap.innerHTML = '';
  LIFELINES.forEach(l => {
    const chip = createElement('div', { class: 'lifeline-chip' }, `
      <span class="ic">${l.ic}</span>${l.name}
    `);
    chip.onclick = () => toggleLifeline(team, l.key, chip);
    wrap.appendChild(chip);
  });

  updateLifelineDisplay(team);
}

function toggleLifeline(team, key, chipEl) {
  Sound.select();
  const arr = teamSetup[team].lifelines;
  const idx = arr.indexOf(key);

  if (idx > -1) {
    arr.splice(idx, 1);
    chipEl.classList.remove('sel');
  } else {
    if (arr.length >= 3) return;
    arr.push(key);
    chipEl.classList.add('sel');
  }

  updateLifelineDisplay(team);
  updateTeamSetupStatus();
}

function updateLifelineDisplay(team) {
  const count = teamSetup[team].lifelines.length;
  const countEl = document.getElementById(`count${team}`);
  if (countEl) {
    countEl.textContent = `${count} / 3`;
  }
}

function updateTeamSetupStatus() {
  const nextBtn = document.getElementById('nextSetupBtn');
  const validA = teamSetup.A.lifelines.length === 3;
  const validB = teamSetup.B.lifelines.length === 3;
  if (nextBtn) {
    nextBtn.disabled = !validA || !validB;
  }
}

function goToCategories() {
  Sound.click();
  teamSetup.A.name = document.getElementById('setupNameA')?.value?.trim() || 'الفريق الأول';
  teamSetup.B.name = document.getElementById('setupNameB')?.value?.trim() || 'الفريق الثاني';

  if (teamSetup.A.lifelines.length < 3 || teamSetup.B.lifelines.length < 3) {
    uiAlert('لازم كل فريق يختار 3 وسائل مساعدة بالضبط');
    return;
  }

  showScreen('screen-categories');
  renderCatGrid();
}

/* ============================= CATEGORY SELECTION ============================= */

function renderCatGrid() {
  // المؤقّت يُرسم هنا لا في `goToCategories`: للأخيرة مدخلان (محلي وأونلاين)
  // وكلاهما يمرّ بهذه الدالة، فلا يُنسى أحدهما
  renderTimerPicker();

  const grid = document.getElementById('catGrid');
  if (!grid) return;

  grid.innerHTML = '';
  CATEGORIES.forEach(c => {
    grid.appendChild(makeCatCard(c));
  });
  updateSelStatus();
}

function makeCatCard(c) {
  const sel = selectedCats.some(s => s.name === c.name);
  const card = createElement('div', {
    class: `cat-pick${sel ? ' sel' : ''}`
  }, `
    <div class="check">✓</div>
    <span class="ic">${c.ic}</span>
    <div class="nm">${escapeHtml(c.name)}</div>
  `);
  card.onclick = () => toggleCategory(c, card);
  return card;
}

function toggleCategory(c, card) {
  Sound.select();
  const idx = selectedCats.findIndex(s => s.name === c.name);
  if (idx > -1) {
    selectedCats.splice(idx, 1);
    card.classList.remove('sel');
  } else {
    selectedCats.push(c);
    card.classList.add('sel');
  }
  updateSelStatus();
}

async function addCustomCategory() {
  // ⚠️ للإدمن فقط — نفس تحقق لوحة الإدارة
  if (!(await authenticateAdmin())) return;

  const input = document.getElementById('customCatName');
  const name = trimArabic(input.value);
  if (!name) return;

  if (CATEGORIES.some(c => c.name === name) || selectedCats.some(c => c.name === name)) {
    input.value = '';
    uiAlert('هذه الفئة موجودة بالفعل');
    return;
  }

  const c = { name, ic: '✨' };
  CATEGORIES.push(c);
  selectedCats.push(c);
  document.getElementById('catGrid').appendChild(makeCatCard(c));
  document.getElementById('catGrid').lastChild.classList.add('sel');
  input.value = '';
  updateSelStatus();
  saveJSON('mr_categories', CATEGORIES);
}

function updateSelStatus() {
  const n = selectedCats.length;
  const roundsCount = Math.ceil(n / 6) || 0;
  const status = document.getElementById('selStatus');
  if (status) {
    status.innerHTML = `اخترت <b>${n}</b> فئة — راح تتكوّن <b>${roundsCount}</b> جولة${n % 6 !== 0 && n > 0 ? ` (آخر جولة فيها ${n % 6} فئات)` : ''}`;
  }

  const startBtn = document.getElementById('startBtn');
  if (startBtn) {
    startBtn.disabled = n < 1;
  }
}

/* ============================= START GAME ============================= */

function startGame() {
  Sound.start();

  questionCache = {};
  rounds = [];

  for (let i = 0; i < selectedCats.length; i += 6) {
    rounds.push(selectedCats.slice(i, i + 6));
  }

  stateUsed = {};
  rounds.forEach((r, ri) => {
    stateUsed[ri] = r.map(() => [false, false, false]);
  });

  scores = { A: 0, B: 0 };
  lifelineUsed = { A: [], B: [] };
  activeRound = 0;

  // اختيار عشوائي لمن يبدأ اللعب
  activeTeam = Math.random() < 0.5 ? 'A' : 'B';

  // في الأونلاين نبني ترتيب اللاعبين بالتناوب ابتداءً من الفريق المختار
  turnOrder = isOnlineGame() ? buildTurnOrder(activeTeam) : [];
  turnIndex = 0;
  if (turnOrder.length) activeTeam = currentTurnPlayer().team;

  // إذا لم تكن في مود أونلاين، استخدم teamSetup. إذا كان في أونلاين، استخدم roomPlayers
  if (currentRoom) {
    // مود أونلاين - استخدم أسماء الفريق من Supabase
    const teamA = roomPlayers.filter(p => p.team === 'A');
    const teamB = roomPlayers.filter(p => p.team === 'B');
    if (teamA.length === 0 || teamB.length === 0) {
      uiAlert('❌ لم يتم توزيع اللاعبين بشكل صحيح');
      return;
    }
  }

  updateGameUI();
  showScreen('screen-game');
  renderTabs();
  renderBoard();
  trackEvent(isOnlineGame() ? 'game_started' : 'game_started_local');

  // في الأونلاين: صاحب الروم يبثّ بداية اللعبة فتظهر اللوحة على كل الأجهزة
  if (isOnlineHost()) {
    supa?.from('game_rooms').update({ status: 'active' }).eq('id', currentRoom.id);
    publishGameState();
  }
  applyViewerRestrictions();
  announceStartingTeam();
}

/* ============================= TURN HANDLING ============================= */

// يبني ترتيب الأدوار بتناوب الفريقين: أ1 ← ب1 ← أ2 ← ب2 …
// لو كان أحد الفريقين أكثر عدداً، يُكمل الباقون بالتتابع في نهاية الدورة.
function buildTurnOrder(startingTeam) {
  const pick = t => roomPlayers
    .filter(p => p.team === t)
    .map(p => ({ player_id: p.player_id, name: p.player_name, team: t }));

  const first = pick(startingTeam);
  const second = pick(startingTeam === 'A' ? 'B' : 'A');

  const order = [];
  const max = Math.max(first.length, second.length);
  for (let i = 0; i < max; i++) {
    if (first[i]) order.push(first[i]);
    if (second[i]) order.push(second[i]);
  }
  return order;
}

// اللاعب صاحب الدور الحالي (أونلاين فقط)
function currentTurnPlayer() {
  if (!turnOrder.length) return null;
  return turnOrder[turnIndex % turnOrder.length] || null;
}

// هل الدور على هذا الجهاز؟
function isMyTurn() {
  if (!isOnlineGame()) return true;
  const p = currentTurnPlayer();
  return !!p && p.player_id === currentPlayer?.player_id;
}

// إعلان الفريق الذي يبدأ اللعب في أول الجولة
function announceStartingTeam() {
  if (!activeTeam) return;

  const turn = currentTurnPlayer();
  const name = turn ? turn.name : getTeamName(activeTeam);
  const icon = activeTeam === 'A' ? '🟢' : '🟡';

  const box = createElement('div', { class: 'start-toast' }, `
    <div class="start-toast-label">🎲 البداية مع</div>
    <div class="start-toast-team">${icon} ${escapeHtml(name)}</div>
  `);

  document.body.appendChild(box);
  Sound.start?.();

  setTimeout(() => box.classList.add('fade-out'), 2200);
  setTimeout(() => box.remove(), 2800);
}

// تبديل الدور: في الأونلاين للاعب التالي في الترتيب، وفي المحلي للفريق الآخر
function switchTurn() {
  if (isOnlineGame() && turnOrder.length) {
    turnIndex = (turnIndex + 1) % turnOrder.length;
    activeTeam = currentTurnPlayer()?.team || activeTeam;
  } else if (activeTeam) {
    activeTeam = activeTeam === 'A' ? 'B' : 'A';
  }
  renderTurnIndicator();
}

function renderTurnIndicator() {
  const banner = document.getElementById('turnBanner');
  const cardA = document.getElementById('teamCardA');
  const cardB = document.getElementById('teamCardB');

  if (cardA) cardA.classList.toggle('active-turn', activeTeam === 'A');
  if (cardB) cardB.classList.toggle('active-turn', activeTeam === 'B');

  if (!banner) return;
  if (!activeTeam) { banner.textContent = ''; return; }

  const icon = activeTeam === 'A' ? '🟢' : '🟡';
  const turn = currentTurnPlayer();

  if (turn) {
    const mine = turn.player_id === currentPlayer?.player_id;
    banner.innerHTML = `<span class="turn-label">الدور الآن:</span> ${icon} <b>${escapeHtml(turn.name)}</b>` +
      `<span class="turn-team">${escapeHtml(teamSetup[turn.team]?.name || '')}</span>` +
      (mine ? '<span class="turn-you">دورك أنت</span>' : '');
    banner.classList.toggle('my-turn', mine);
  } else {
    banner.innerHTML = `<span class="turn-label">الدور الآن:</span> ${icon} <b>${escapeHtml(getTeamName(activeTeam))}</b>`;
    banner.classList.remove('my-turn');
  }
}

/* ============================= END OF GAME ============================= */

// هل استُهلكت كل الخلايا في كل الجولات؟
function isGameFinished() {
  if (!rounds.length) return false;

  return rounds.every((cats, ri) => {
    const roundState = stateUsed[ri];
    if (!roundState) return false;
    return cats.every((_, ci) => (roundState[ci] || []).every(Boolean));
  });
}

function showEndScreen() {
  const a = scores.A;
  const b = scores.B;
  const nameA = getTeamName('A');
  const nameB = getTeamName('B');

  const trophy = document.getElementById('endTrophy');
  const title = document.getElementById('endTitle');
  const winner = document.getElementById('endWinner');
  const scoresEl = document.getElementById('endScores');

  if (a === b) {
    if (trophy) trophy.textContent = '🤝';
    if (title) title.textContent = 'تعادل!';
    if (winner) winner.innerHTML = `<span class="tie-text">الفريقان تعادلا بـ ${a} نقطة</span>`;
  } else {
    const winTeam = a > b ? 'A' : 'B';
    const winName = a > b ? nameA : nameB;
    const diff = Math.abs(a - b);
    if (trophy) trophy.textContent = '🏆';
    if (title) title.textContent = 'الفائز';
    if (winner) {
      winner.innerHTML = `
        <div class="winner-name ${winTeam}">${winTeam === 'A' ? '🟢' : '🟡'} ${escapeHtml(winName)}</div>
        <div class="winner-margin">بفارق ${diff} نقطة</div>
      `;
    }
  }

  if (scoresEl) {
    scoresEl.innerHTML = `
      <div class="end-score-card A ${a >= b ? 'lead' : ''}">
        <div class="end-team-name">🟢 ${escapeHtml(nameA)}</div>
        <div class="end-team-score">${a}</div>
      </div>
      <div class="end-score-card B ${b >= a ? 'lead' : ''}">
        <div class="end-team-name">🟡 ${escapeHtml(nameB)}</div>
        <div class="end-team-score">${b}</div>
      </div>
    `;
  }

  showScreen('screen-end');
  Sound.award?.();
  trackEvent('game_finished');

  // إحصاءات الحساب: نحسب فوز اللاعب حسب فريقه في الأونلاين،
  // وفي المحلي نسجّل الجولة بأعلى نتيجة دون نسبة فوز لأحد بعينه
  if (isSignedIn()) {
    const myTeam = currentRoom && currentPlayer
      ? roomPlayers.find(p => p.player_id === currentPlayer.player_id)?.team
      : null;
    const myScore = myTeam ? scores[myTeam] : Math.max(scores.A, scores.B);
    const won = myTeam ? (scores[myTeam] > scores[myTeam === 'A' ? 'B' : 'A']) : (a !== b);
    recordGameResult({ won, score: myScore });
  }
}

// مشاركة نتيجة اللعبة — لحظة الفوز هي أقوى لحظة يميل فيها اللاعبون للمشاركة
function buildResultText() {
  const a = scores.A, b = scores.B;
  const nameA = getTeamName('A'), nameB = getTeamName('B');
  const url = location.origin + location.pathname;

  const header = a === b
    ? `🤝 تعادل في «تحدي رجا»!`
    : `🏆 فاز ${a > b ? nameA : nameB} في «تحدي رجا»!`;

  return `${header}\n\n🟢 ${nameA}: ${a}\n🟡 ${nameB}: ${b}\n\nجرّبوها: ${url}`;
}

async function shareResult() {
  Sound.click();
  const text = buildResultText();

  // مشاركة النظام الأصلية (تفتح واتساب وغيره) حيث تتوفر
  if (navigator.share) {
    try {
      await navigator.share({ title: 'تحدي رجا', text });
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return; // المستخدم ألغى
    }
  }

  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

// زر "لعبة جديدة" من شاشة النهاية
function playAgain() {
  Sound.click();
  if (isOnlineGame()) {
    // نرجع لإعدادات الروم حتى يعيد المضيف اختيار الفئات
    if (isOnlineHost()) {
      publishGameState({ phase: 'lobby' });
    }
    goToRoomSetup();
  } else {
    goToSetup();
  }
}

// اسم الفريق المعروض: في الأونلاين أسماء اللاعبين، وفي المحلي اسم الفريق
function getTeamName(team) {
  if (currentRoom && roomPlayers?.length) {
    const members = roomPlayers.filter(p => p.team === team).map(p => p.player_name);
    if (members.length) return members.join(' + ');
  }
  return teamSetup[team]?.name || (team === 'A' ? 'الفريق الأول' : 'الفريق الثاني');
}

function updateGameUI() {
  const nameA = document.getElementById('gameNameA');
  const nameB = document.getElementById('gameNameB');
  const scoreA = document.getElementById('scoreA');
  const scoreB = document.getElementById('scoreB');

  if (nameA) nameA.textContent = `🟢 ${getTeamName('A')}`;
  if (nameB) nameB.textContent = `🟡 ${getTeamName('B')}`;
  if (scoreA) scoreA.textContent = scores.A;
  if (scoreB) scoreB.textContent = scores.B;

  renderTurnIndicator();
  renderLifelineDisplay();
}

function renderLifelineDisplay() {
  ['A', 'B'].forEach(team => {
    const wrap = document.getElementById(`lifeDisplay${team}`);
    if (!wrap) return;

    wrap.innerHTML = '';
    teamSetup[team].lifelines.forEach(key => {
      const l = LIFELINES.find(x => x.key === key);
      const used = lifelineUsed[team].includes(key);
      const el = createElement('div', {
        class: `ic${used ? ' used' : ''}`,
        title: l.name
      }, l.ic);

      if (!used) {
        el.onclick = () => useLifeline(team, key);
      }

      wrap.appendChild(el);
    });
  });
}

/* ============================= LIFELINES ============================= */

// وسيلة المساعدة المفعّلة على السؤال المفتوح حالياً: { team, key }
let activeLifeline = null;
let friendCallTimer = null;

async function useLifeline(team, key) {
  // في الأونلاين المضيف وحده يفعّلها (هو من يدير اللعب)
  if (isOnlineGame() && !currentPlayer?.is_host) {
    log('صاحب الروم هو من يفعّل وسائل المساعدة', 'info');
    return;
  }

  if (lifelineUsed[team].includes(key)) return;

  const l = LIFELINES.find(x => x.key === key);
  if (!l) return;

  // كلها تُستعمل أثناء سؤال مفتوح ما عدا لا شيء — نطلب فتح سؤال أولاً
  if (!current) {
    uiAlert(`${l.ic} ${l.name}\n\n${l.desc}\n\nافتح السؤال أولاً ثم فعّلها.`);
    return;
  }

  if (activeLifeline) {
    uiAlert('⚠️ فيه وسيلة مساعدة مفعّلة على هذا السؤال بالفعل');
    return;
  }

  if (!await uiConfirm(`${l.ic} تفعيل «${l.name}» لفريق ${getTeamName(team)}؟\n\n${l.desc}\n\nتُستخدم مرة واحدة فقط طوال اللعبة.`)) {
    return;
  }

  Sound.select();
  lifelineUsed[team].push(key);
  activeLifeline = { team, key };

  renderLifelineDisplay();
  renderLifelineBanner();
  renderAwardButtons();   // الحفرة تعطّل أزرار الفريق الآخر

  if (key === 'sadeeq') startFriendCall();
  if (key === 'istareeh') {
    // تخطٍّ فوري بلا نقاط مع بقاء الدور مع نفس الفريق
    award(null, { keepTurn: true });
    return;
  }

  if (isOnlineHost()) publishGameState();
}

function renderLifelineBanner() {
  const banner = document.getElementById('lifelineBanner');
  if (!banner) return;

  if (!activeLifeline) {
    banner.style.display = 'none';
    banner.innerHTML = '';
    return;
  }

  const l = LIFELINES.find(x => x.key === activeLifeline.key);
  banner.style.display = 'block';
  banner.innerHTML = `
    <span class="ll-ic">${l.ic}</span>
    <b>${l.name}</b> — ${escapeHtml(getTeamName(activeLifeline.team))}
    <div class="ll-desc">${l.desc}</div>
    <div class="ll-timer" id="lifelineTimer"></div>
  `;
}

// مؤقّت 30 ثانية لاتصال بصديق
function startFriendCall() {
  clearInterval(friendCallTimer);
  let left = 30;

  const tick = () => {
    const el = document.getElementById('lifelineTimer');
    if (!el) return;
    el.textContent = `⏱️ ${left} ثانية`;
    if (left <= 0) {
      clearInterval(friendCallTimer);
      el.textContent = '⏰ انتهى الوقت';
      Sound.skip();
    }
    left--;
  };

  setTimeout(tick, 0);
  friendCallTimer = setInterval(tick, 1000);
}

/* ============================= QUESTION TIMER ============================= */

/*
  مؤقّت السؤال. كان الوحيد في اللعبة هو مؤقّت «اتصال بصديق»، والسؤال العادي
  يبقى مفتوحاً بلا حدّ — فريق يفكّر خمس دقائق والبقية ينتظرون.

  ⚠️ نبثّ **لحظة الانتهاء** (طابع زمني) لا الثواني المتبقية: لو بثثنا عدّاداً
  لاختلف بين الأجهزة بمقدار تأخّر الشبكة، ولرأى كل لاعب رقماً مختلفاً.
  الطابع الزمني يجعل الجميع يحسبون من نقطة واحدة.
*/
const TIMER_CHOICES = [0, 20, 30, 45];   // 0 = مطفأ
let questionSeconds = loadJSON('mr_qtimer', 0);
let questionDeadline = 0;
let questionTimerId = null;

function setQuestionSeconds(sec) {
  questionSeconds = Number(sec) || 0;
  saveJSON('mr_qtimer', questionSeconds);
  Sound.click();
  renderTimerPicker();
}

function renderTimerPicker() {
  const wrap = document.getElementById('timerPicker');
  if (!wrap) return;

  wrap.innerHTML = '';
  TIMER_CHOICES.forEach(sec => {
    const b = createElement('button', {
      class: `timer-opt${sec === questionSeconds ? ' active' : ''}`
    }, sec === 0 ? 'بدون مؤقّت' : `${sec} ثانية`);
    b.onclick = () => setQuestionSeconds(sec);
    wrap.appendChild(b);
  });
}

function startQuestionTimer() {
  stopQuestionTimer();

  const box = document.getElementById('qtimer');
  if (box) { box.textContent = ''; box.classList.remove('urgent'); }

  // بلا مهلة: نترك الخانة فارغة — وإلا بقي عدّاد السؤال السابق معروضاً
  if (!questionDeadline) return;

  const tick = () => {
    const el = document.getElementById('qtimer');
    if (!el) return;

    const left = Math.max(0, Math.ceil((questionDeadline - Date.now()) / 1000));
    el.textContent = `⏱️ ${left}`;
    el.classList.toggle('urgent', left <= 5 && left > 0);

    if (left > 0) return;

    stopQuestionTimer();
    el.textContent = '⏰ انتهى الوقت';

    // من يحسم انتهاء الوقت: صاحب الدور أو المضيف. الاستدعاء المزدوج غير ضارّ
    // لأن الدوال أدناه تخرج فوراً إذا أُغلق السؤال أو سُجّلت إجابة.
    if (isOnlineGame() && !canControlGame()) return;
    Sound.skip();
    onQuestionTimeout();
  };

  tick();
  questionTimerId = setInterval(tick, 250);   // ربع ثانية: العدّ لا يتلعثم
}

function stopQuestionTimer() {
  if (questionTimerId) { clearInterval(questionTimerId); questionTimerId = null; }
}

function onQuestionTimeout() {
  if (!current) return;

  const key = `${activeRound}-${current.ci}-${current.row}`;
  const item = questionCache[key];

  // أونلاين بخيارات: تُحتسب إجابة خاطئة بلا نقاط، ويُعرض الصحيح ثم ينتقل الدور
  if (isOnlineGame() && Array.isArray(item?.choices)) {
    if (lastAnswer) return;
    const turn = currentTurnPlayer();
    lastAnswer = {
      pickedIndex: -1,
      correctIndex: item.correctIndex,
      byName: turn?.name || getTeamName(activeTeam),
      team: turn?.team || activeTeam,
      correct: false,
      timedOut: true
    };
    if (isMyTurn()) recordCategoryResult(current.cat?.name, false);
    renderChoices(item);
    publishGameState();
    setTimeout(() => finishAnsweredQuestion(), 2600);
    return;
  }

  // محلي: بلا نقاط والدور ينتقل — وهذا معنى المؤقّت
  award(null);
}

function clearActiveLifeline() {
  clearInterval(friendCallTimer);
  friendCallTimer = null;
  activeLifeline = null;
  renderLifelineBanner();
}

async function backToSetupConfirm() {
  if (await uiConfirm('بدء لعبة جديدة؟ بيروح كل التقدم الحالي')) {
    selectedCats = [];
    questionCache = {};
    goToSetup();
  }
}

// الخروج من الجولة إلى الشاشة الرئيسية — غير «لعبة جديدة» التي تعيدك
// لاختيار الفئات وأنت ما زلت داخل الروم.
async function exitToHomeConfirm() {
  const online = isOnlineGame();
  const warning = online
    ? 'الرجوع للقائمة الرئيسية؟ بتخرج من الروم وبيروح كل التقدم الحالي'
    : 'الرجوع للقائمة الرئيسية؟ بيروح كل التقدم الحالي';

  if (!await uiConfirm(warning)) return;

  // نغلق نافذة السؤال أولاً وإلا بقيت معلّقة فوق الشاشة الرئيسية
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.classList.remove('show');
  current = null;
  lastAnswer = null;
  clearActiveLifeline();

  // الخروج الحقيقي من الروم: يُلغي الاشتراكات ويخفي الشات ويمسح جلسة
  // العودة التلقائية — بدونه يبقى اللاعب مشتركاً وشاشة الشات ظاهرة
  if (online && typeof leaveRoom === 'function') {
    try { await leaveRoom(); } catch (e) { console.warn('تعذّر الخروج من الروم:', e); }
  }

  selectedCats = [];
  questionCache = {};
  rounds = [];
  stateUsed = {};
  scores = { A: 0, B: 0 };
  lifelineUsed = { A: [], B: [] };
  turnOrder = [];
  turnIndex = 0;
  activeTeam = null;
  activeRound = 0;

  goToHome();
}

/* ============================= BOARD RENDERING ============================= */

function renderTabs() {
  const tabs = document.getElementById('roundTabs');
  if (!tabs) return;

  tabs.innerHTML = '';
  if (rounds.length <= 1) return;

  rounds.forEach((r, i) => {
    const b = createElement('button', {
      class: `round-tab${i === activeRound ? ' active' : ''}`
    }, `الجولة ${i + 1}`);

    b.onclick = () => {
      if (isOnlineGame() && !currentPlayer?.is_host) return;
      activeRound = i;
      renderTabs();
      renderBoard();
      if (isOnlineHost()) publishGameState();
    };

    tabs.appendChild(b);
  });
}

function renderBoard() {
  const cats = rounds[activeRound];
  // قد تُستدعى قبل أن تصل بيانات الجولات (مثلاً عند لاعب في روم لم تبدأ لعبته بعد)
  if (!Array.isArray(cats) || cats.length === 0) return;
  const board = document.getElementById('board');
  if (!board) return;

  board.style.gridTemplateColumns = `repeat(${cats.length}, 1fr)`;
  board.innerHTML = '';

  // رؤوس الفئات
  cats.forEach(c => {
    const h = createElement('div', {
      class: 'cat-header'
    }, `<span class="ic">${escapeHtml(c.ic)}</span><span>${escapeHtml(c.name)}</span>`);
    board.appendChild(h);
  });

  // الخلايا
  for (let row = 0; row < 3; row++) {
    cats.forEach((c, ci) => {
      const used = stateUsed[activeRound][ci][row];
      const cell = createElement('div', {
        class: `cell${used ? ' used' : ''}`
      }, used ? '✓' : POINTS[row]);

      if (!used) {
        cell.onclick = () => openQuestion(ci, row);
      }

      board.appendChild(cell);
    });
  }
}

/* ============================= MULTIPLE CHOICE ============================= */
/*
  بنك الأسئلة يحوي الإجابة الصحيحة فقط — لا خيارات خاطئة في أي من الأسئلة.
  لذلك نولّد المشتّتات من إجابات أسئلة أخرى في نفس الفئة ونفس المستوى، وهي
  الأقرب شكلاً وطولاً للإجابة الصحيحة فتكون منافسة معقولة. وإن لم تكفِ،
  نوسّع للمستويات الأخرى في الفئة نفسها ثم لبقية الفئات.
*/

// مجموعات من نفس النوع. لو كانت الإجابة الصحيحة من إحداها، نسحب المشتّتات
// منها فتكون منطقية: «آسيا» تنافسها قارات لا «كنتاكي» و«تمر».
const ANSWER_POOLS = [
  ['آسيا','أفريقيا','أوروبا','أمريكا الشمالية','أمريكا الجنوبية','أستراليا','أنتاركتيكا'],

  ['الرياض','مكة المكرمة','المدينة المنورة','القصيم','الشرقية','عسير','تبوك',
   'حائل','الحدود الشمالية','جازان','نجران','الباحة','الجوف'],

  ['الرياض','جدة','الدمام','الخبر','الطائف','أبها','بريدة','خميس مشيط',
   'الجبيل','ينبع','الأحساء','عرعر','سكاكا','القطيف'],

  ['السعودية','مصر','الإمارات','الكويت','قطر','البحرين','عُمان','الأردن',
   'لبنان','سوريا','العراق','اليمن','المغرب','الجزائر','تونس','ليبيا','السودان'],

  ['أمريكا','بريطانيا','فرنسا','ألمانيا','إيطاليا','إسبانيا','اليابان','الصين',
   'الهند','البرازيل','روسيا','تركيا','كندا','إيران','باكستان','إندونيسيا'],

  ['عطارد','الزهرة','الأرض','المريخ','المشتري','زحل','أورانوس','نبتون'],

  ['الأحمر','الأزرق','الأخضر','الأصفر','الأسود','الأبيض','البرتقالي',
   'البنفسجي','الرمادي','البني','الوردي'],

  ['الأسد','النمر','الفيل','الزرافة','الجمل','الحصان','الذئب','الدب','الغزال',
   'النسر','الصقر','الحوت','الدلفين','القرش','التمساح','الفهد','وحيد القرن'],

  ['القلب','الكبد','الرئة','الكلى','المعدة','الدماغ','الجلد','العين','الأذن',
   'الطحال','البنكرياس','الأمعاء'],

  ['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب',
   'شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'],

  ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر',
   'أكتوبر','نوفمبر','ديسمبر'],

  ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'],

  ['الشمال','الجنوب','الشرق','الغرب','الشمال الشرقي','الشمال الغربي'],

  ['المحيط الهادئ','المحيط الأطلسي','المحيط الهندي','المحيط المتجمد الشمالي',
   'المحيط الجنوبي','البحر الأحمر','البحر المتوسط','الخليج العربي','بحر العرب'],

  ['الذهب','الفضة','الحديد','النحاس','الألومنيوم','الرصاص','الزنك','البلاتين','التيتانيوم'],

  ['الأكسجين','الهيدروجين','النيتروجين','ثاني أكسيد الكربون','الهيليوم','الكربون'],

  ['أبو بكر الصديق','عمر بن الخطاب','عثمان بن عفان','علي بن أبي طالب'],

  ['كرة القدم','كرة السلة','كرة الطائرة','التنس','السباحة','الجري','الملاكمة','الفروسية'],

  ['الهلال','النصر','الاتحاد','الأهلي','الشباب','الاتفاق','التعاون','الفتح','الرائد'],

  // ⚠️ أضِف كل صيغة إملائية شائعة: `findAnswerPool` تطابق **بداية** الإجابة،
  // فـ«داوود عليه السلام» لا تطابق «داود» فتسقط لمشتّتات الفئة نفسها.
  ['نوح','إبراهيم','ابراهيم','موسى','عيسى','يوسف','يونس','سليمان','داود','داوود',
   'أيوب','زكريا','هود','صالح','آدم','ادم','شعيب','لوط','إدريس','ادريس',
   'إسماعيل','اسماعيل','إسحاق','اسحاق','يعقوب','هارون','إلياس','اليسع','ذو الكفل'],

  ['القاهرة','الرياض','دبي','الدوحة','الكويت','المنامة','مسقط','عمّان','بيروت',
   'دمشق','بغداد','صنعاء','الرباط','الجزائر','تونس','طرابلس','الخرطوم'],

  ['باريس','لندن','برلين','روما','مدريد','طوكيو','بكين','نيودلهي','موسكو',
   'واشنطن','أنقرة','أوتاوا','برازيليا','جاكرتا'],

  ['آبل','جوجل','مايكروسوفت','أمازون','ميتا','سامسونج','إنتل','إنفيديا','تسلا','سوني'],

  ['واتساب','إنستغرام','سناب شات','تيك توك','يوتيوب','تويتر','تيليجرام','فيسبوك'],

  ['القهوة','الشاي','الحليب','العصير','الماء','اللبن','الكركديه','النعناع'],

  ['الكبسة','المندي','المظبي','الجريش','المرقوق','الهريس','السليق','المطازيز','العريكة'],

  ['التمر','الرمان','العنب','التين','الموز','التفاح','البرتقال','المانجو','الفراولة','البطيخ'],

  ['الهيل','الزعفران','القرفة','الكمون','الكزبرة','الفلفل الأسود','الزنجبيل','القرنفل'],

  ['العود','المسك','العنبر','الورد','الياسمين','الصندل','الزعفران','البخور'],

  ['الأنف','الفم','اليد','القدم','الرأس','الظهر','الرقبة','الكتف','الركبة','المرفق'],

  ['البصر','السمع','الشم','الذوق','اللمس'],

  ['الطويل','الكامل','الوافر','البسيط','الرجز','الرمل','المتقارب','الخفيف','السريع'],

  ['المتنبي','أبو تمام','البحتري','أحمد شوقي','حافظ إبراهيم','امرؤ القيس',
   'زهير بن أبي سلمى','الخنساء','أبو نواس','المعرّي','نزار قباني','محمود درويش'],

  ['الأموية','العباسية','العثمانية','الفاطمية','الأيوبية','المملوكية','الأندلسية','السلجوقية'],

  ['تويوتا','نيسان','هوندا','فورد','شيفروليه','مرسيدس','بي إم دبليو','أودي',
   'لكزس','هيونداي','كيا','بورشه','فيراري','لامبورغيني'],

  ['الماس','الياقوت','الزمرد','اللؤلؤ','الفيروز','العقيق','الزبرجد'],

  ['النخيل','الزيتون','القمح','الأرز','الذرة','الشعير','القطن','البن'],

  ['الأسبرين','البنسلين','الإنسولين','الباراسيتامول','المضاد الحيوي','اللقاح'],

  ['فيتامين أ','فيتامين ب','فيتامين ج','فيتامين د','فيتامين هـ','فيتامين ك'],

  ['المينا','العاج','اللب','الملاط','اللثة','الجذر','التاج'],

  ['القواطع','الأنياب','الضواحك','الأضراس','ضرس العقل'],
];

// نبحث عن مجموعة تنتمي إليها الإجابة. المطابقة على النص المطبَّع، ونقبل
// الاحتواء لأن الإجابة قد تكون «قارة آسيا» أو «آسيا (أكبر القارات)».
function findAnswerPool(correct) {
  const c = normalizeAnswer(correct);
  if (!c) return null;

  for (const pool of ANSWER_POOLS) {
    // نأخذ أطول عنصر مطابق: «ذو الكفل» تسبق «ذو» لو وُجدت
    let best = null;
    pool.forEach(item => {
      const n = normalizeAnswer(item);
      if (!n) return;
      // مطابقة تامة، أو الإجابة هي العنصر متبوعاً بتوضيح: «آسيا (أكبر القارات)».
      // ⚠️ لا نقبل الاحتواء في أي موضع: «الحوت الأزرق» كان يطابق مجموعة
      // الألوان بسبب «الأزرق»، فتصير خياراته ألواناً.
      const hit = n === c || c.startsWith(n + ' ') || c.startsWith(n + '(');
      if (hit && (!best || n.length > best.length)) best = n;
    });
    if (best) return { pool, matchedLength: best.length };
  }
  return null;
}

/*
  اللاحقة التي تتبع الاسم في الإجابة: «يونس **عليه السلام**».

  ⚠️ بدونها ينكشف الجواب فوراً: المشتّتات تأتي من المجموعة أسماءً مجرّدة،
  فيبقى الخيار الصحيح وحده يحمل اللاحقة. ولا يكفي حذف الأسماء من المجموعة —
  جرّبناه فصار أسوأ: كلها تسقط لمشتّتات الفئة فتستوي مرة وتفضح مرة.
*/
function answerSuffix(correct, matchedLength) {
  const c = normalizeAnswer(correct);
  if (!matchedLength || matchedLength >= c.length) return '';

  // نقتطع من النص الأصلي بمحاذاة ما طابقناه في النص المطبَّع. الطولان
  // متساويان لأن التطبيع يستبدل حرفاً بحرف ولا يحذف — عدا «ال» في البداية.
  const lead = /^ال/.test(String(correct).trim()) ? 2 : 0;
  const tail = String(correct).trim().slice(lead + matchedLength);
  return /^[\s(]/.test(tail) ? tail : '';
}

/*
  الشرح الملحق بالإجابة بين قوسين.

  ⚠️ في الأسئلة الحسابية تحمل الإجابة حلّها معها:
  «36 تفاحة (12x3 =36 )» و«العدد هو 3 (لأن 3 × 3 = 9، ثم 9 + 5 = 14)».
  المشتّتات الرقمية تبدّل الرقم الأول فقط، فيبقى الشرح **نفسه حرفياً في
  الخيارات الأربعة وهو يذكر الرقم الصحيح** — يقرأه اللاعب فيعرف الجواب بلا
  تفكير. نُسقط الشرح من نصّ الخيارات وحدها؛ الإجابة المحفوظة تبقى كاملة
  فيظهر الشرح في الوضع المحلي عند كشف الإجابة.
*/
function stripTrailingNote(text) {
  const t = String(text || '').trim();
  const m = t.match(/^(.*?)\s*[(（][^)）]*[)）]\s*[.。]?$/);
  if (!m) return t;
  const head = m[1].trim();
  return head ? head : t;   // إجابة كلّها بين قوسين: نتركها كما هي
}

// إجابة رقمية → مشتّتات رقمية قريبة، مع الحفاظ على وحدة القياس.
// «206 عظمة» تنافسها «198 عظمة» لا «الرياض».
function numericDistractors(correct, rand) {
  const text = String(correct);

  // ⚠️ النِّسَب والمجالات لا تُبدَّل بتغيير رقم واحد: «من 1:15 إلى 1:18»
  // كان يصير «من 3:15 إلى 1:18» — تركيب لا معنى له، والجزء الثابت يبقى
  // شاهداً على الصحيح. ندعها لمشتّتات الفئة.
  if (/\d\s*[:：/–—-]\s*\d/.test(text)) return null;

  const m = text.match(/(\d[\d,]*)/);
  if (!m) return null;

  const raw = m[1].replace(/,/g, '');
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n === 0) return null;

  const isYear = n >= 1000 && n <= 2100;
  const out = new Set();
  let guard = 0;

  while (out.size < 3 && guard++ < 40) {
    let v;
    if (isYear) {
      v = n + Math.floor(rand() * 21) - 10;
    } else if (n <= 12) {
      v = n + Math.floor(rand() * 7) - 3;
    } else {
      const spread = Math.max(2, Math.round(n * 0.35));
      v = n + Math.floor(rand() * spread * 2) - spread;
    }
    if (v > 0 && v !== n) out.add(v);
  }

  if (out.size < 3) return null;
  return [...out].map(v => correct.replace(m[1], String(v)));
}

function collectAnswerPool(categoryName, diffKey, exclude) {
  const seen = new Set([normalizeAnswer(exclude)]);
  const pool = [];

  // نحتفظ بنص السؤال مع الإجابة: التشابه بين السؤالين أدلّ على تقارب
  // نوع الإجابة من تشابه طول النص
  const take = (list) => {
    (list || []).forEach(q => {
      const a = String(q?.answer || '').trim();
      const key = normalizeAnswer(a);
      if (!a || seen.has(key)) return;
      seen.add(key);
      pool.push({ answer: a, question: String(q?.question || '') });
    });
  };

  // 1) نفس الفئة ونفس المستوى — الأقرب سياقاً
  take(QBANK[categoryName]?.[diffKey]);

  // 2) نفس الفئة، مستويات أخرى
  if (pool.length < 12) {
    DIFFKEY.filter(k => k !== diffKey).forEach(k => take(QBANK[categoryName]?.[k]));
  }

  // 3) فئات أخرى — ملاذ أخير
  if (pool.length < 3) {
    Object.keys(QBANK).forEach(cat => {
      if (cat === categoryName) return;
      DIFFKEY.forEach(k => take(QBANK[cat]?.[k]));
    });
  }

  return pool;
}

// نطبّع للمقارنة: نزيل التشكيل والمسافات الزائدة وأل التعريف حتى لا يظهر
// خياران متطابقان فعلياً بصياغتين مختلفتين
function normalizeAnswer(text) {
  return String(text || '')
    .replace(/[ً-ْـ]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/[ةه]/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/\s+/g, ' ')
    .replace(/^ال/, '')
    .trim()
    .toLowerCase();
}

// كلمات لا تميّز سؤالاً عن آخر، فاستبعادها يجعل المقارنة ذات معنى
const STOP_WORDS = new Set([
  'ما','ماهو','ماهي','هو','هي','من','في','على','عن','الى','إلى','التي','الذي',
  'كم','اي','أي','هل','متى','اين','أين','كيف','لماذا','اسم','ماذا','هذه','هذا',
  'يوجد','توجد','يعتبر','تعتبر','يسمى','تسمى','بين','مع','او','أو','و',
  'كان','كانت','لها','له','بها','به','التالي','الاتي','عند','بعد','قبل','كل'
]);

function contentWords(text) {
  return normalizeAnswer(text)
    .replace(/[؟?.,،!:؛()«»"']/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

// كم كلمة دالة يتشاركها السؤالان؟ «ما أكبر قارة في العالم» و«ما أكبر محيط في
// العالم» يتشاركان «اكبر» و«العالم» → إجابتهما من نوع متقارب
function questionOverlap(wordsA, questionB) {
  if (!wordsA.length) return 0;
  const b = new Set(contentWords(questionB));
  let hits = 0;
  wordsA.forEach(w => { if (b.has(w)) hits++; });
  return hits;
}

// شكل الإجابة — ما يجعل خياراً يكشف نفسه قبل أن يفكّر اللاعب:
// رقم وسط كلمات، أو حروف لاتينية وسط عربي، أو سطر طويل وسط كلمتين.
function answerShape(text) {
  const t = String(text || '');
  const ar = (t.match(/[ء-ي]/g) || []).length;
  const la = (t.match(/[A-Za-z]/g) || []).length;
  return {
    digit: /\d/.test(t),
    latin: la > ar,           // «Camelus dromedarius» لاتيني، «المقدمة (Top notes)» عربي
    len: t.length,
    words: t.split(/\s+/).filter(Boolean).length
  };
}

// أول كلمة دالة في الإجابة. «طريق البخور» و«طريق الحج الشامي» يتشاركان
// «طريق» — أقوى إشارة على أنهما من نوع واحد.
function leadWord(text) {
  return contentWords(text)[0] || '';
}

// مرشّحات متدرّجة: نبدأ بالأصرم، وننزل درجة فقط إذا لم نجد ثلاثة مرشّحين.
// هكذا لا نُرجع null أبداً، ولا نقبل خياراً فاضحاً ما دام هناك أفضل منه.
const SHAPE_FILTERS = [
  (c, k) => c.digit === k.digit && c.latin === k.latin &&
            c.len >= k.len * 0.5 && c.len <= k.len * 2 &&
            Math.abs(c.words - k.words) <= 3,
  (c, k) => c.digit === k.digit && c.latin === k.latin &&
            c.len >= k.len * 0.35 && c.len <= k.len * 3,
  (c, k) => c.digit === k.digit && c.latin === k.latin,
  () => true
];

// اختيار مشتّتات مقاربة في الطول للإجابة الصحيحة — الخيار القصير جداً وسط
// خيارات طويلة يكشف نفسه
function buildChoices(item, categoryName, diffKey, seed) {
  const correct = String(item?.answer || '').trim();
  if (!correct) return null;

  const rand = makeSeededRandom(seed);

  // 1) مجموعة من نفس النوع — أفضل جودة
  const typed = findAnswerPool(correct);
  if (typed) {
    const c = normalizeAnswer(correct);
    const suffix = answerSuffix(correct, typed.matchedLength);

    // نستبعد الصيغ الإملائية الأخرى للاسم نفسه («داود» أمام «داوود»)
    const others = typed.pool.filter(x => {
      const n = normalizeAnswer(x);
      return n !== c && !c.includes(n) && !n.includes(c);
    });

    if (others.length >= 3) {
      const picked = [];
      const seen = new Set();
      const avail = others.slice();
      while (picked.length < 3 && avail.length) {
        const one = avail.splice(Math.floor(rand() * avail.length), 1)[0];
        // ⚠️ المجموعة تحوي صيغاً إملائية متعددة للاسم الواحد («آدم» و«ادم»)،
        // فبلا هذا يظهران خيارين منفصلين لنفس الاسم أمام اللاعب
        const key = normalizeAnswer(one);
        if (seen.has(key)) continue;
        seen.add(key);
        picked.push(one);
      }
      // اللاحقة تُلحق بالجميع حتى لا يتميّز الصحيح بها
      if (picked.length === 3) {
        return shuffleChoices(correct, picked.map(p => p + suffix), rand);
      }
    }
  }

  // 2) إجابة رقمية — مشتّتات رقمية.
  // نبني الخيارات على الإجابة **بلا شرحها**: الشرح يتكرّر حرفياً في الأربعة
  // ويذكر الرقم الصحيح، فيفضحه (راجع `stripTrailingNote`).
  const head = stripTrailingNote(correct);
  const nums = numericDistractors(head, rand);
  if (nums) return shuffleChoices(head, nums, rand);

  // 3) الملاذ الأخير: إجابات أخرى من نفس الفئة.
  // الترتيب: تشابه السؤال أولاً ثم قرب الطول — الاعتماد على الطول وحده
  // كان يُنتج خيارات بلا صلة («تمر» أمام سؤال عن قارة).
  const pool = collectAnswerPool(categoryName, diffKey, correct);
  if (pool.length < 3) return null;

  const myWords = contentWords(item?.question || '');
  const myShape = answerShape(correct);
  const myLead = leadWord(correct);

  const scored = pool.map(c => ({
    answer: c.answer,
    shape: answerShape(c.answer),
    sameLead: !!myLead && leadWord(c.answer) === myLead,
    overlap: questionOverlap(myWords, c.question),
    lenDiff: Math.abs(c.answer.length - correct.length)
  }));

  // أول مرشّح يترك ثلاثة على الأقل هو المعتمد
  let kept = [];
  for (const pass of SHAPE_FILTERS) {
    kept = scored.filter(c => pass(c.shape, myShape));
    if (kept.length >= 3) break;
  }
  if (kept.length < 3) kept = scored;

  kept.sort((x, y) =>
    (Number(y.sameLead) - Number(x.sameLead)) ||
    (y.overlap - x.overlap) ||
    (x.lenDiff - y.lenDiff));

  // نأخذ من أفضل المرشّحين فقط، ونعشوِ داخلهم حتى لا تتكرر نفس الخيارات
  const topN = Math.max(3, Math.min(12, kept.length));
  const candidates = kept.slice(0, topN);

  const picked = [];
  while (picked.length < 3 && candidates.length) {
    const i = Math.floor(rand() * candidates.length);
    picked.push(candidates.splice(i, 1)[0].answer);
  }
  if (picked.length < 3) return null;

  return shuffleChoices(correct, picked, rand);
}

// خلط ثابت بنفس البذرة حتى يرى كل اللاعبين نفس الترتيب
function shuffleChoices(correct, distractors, rand) {
  const choices = [correct, ...distractors];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { choices, correctIndex: choices.indexOf(correct) };
}

// مولّد عشوائي ببذرة: نفس البذرة تعطي نفس الترتيب على كل الأجهزة
function makeSeededRandom(seed) {
  let h = 2166136261;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function () {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ============================= QUESTION DIALOG ============================= */

function openQuestion(ci, row) {
  // في الأونلاين صاحب الدور هو من يفتح السؤال ويجيب عليه
  if (isOnlineGame() && !isMyTurn()) {
    const t = currentTurnPlayer();
    uiAlert(`⏳ الدور الآن على ${t ? t.name : 'لاعب آخر'}`);
    return;
  }

  Sound.open();
  const cat = rounds[activeRound][ci];
  current = { ci, row, cat };

  const qcat = document.getElementById('qcat');
  const qpoints = document.getElementById('qpoints');
  if (qcat) qcat.innerHTML = `${escapeHtml(cat.ic)} ${escapeHtml(cat.name)}`;
  if (qpoints) qpoints.textContent = `${POINTS[row]} نقطة`;

  document.getElementById('cornersBar').style.display = 'none';
  document.getElementById('qbody').innerHTML = '<div class="loadbox">⏳ جاري إحضار السؤال...</div>';
  document.getElementById('overlay').classList.add('show');

  const cacheKey = `${activeRound}-${ci}-${row}`;
  let item = questionCache[cacheKey];

  if (!item) {
    item = pickFromBank(cat.name, row);
    if (item) {
      // في الأونلاين نولّد الخيارات ببذرة ثابتة حتى يراها كل اللاعبين بنفس الترتيب
      if (isOnlineGame()) {
        const mc = buildChoices(item, cat.name, DIFFKEY[row], `${currentRoom.id}-${cacheKey}`);
        if (mc) { item = { ...item, choices: mc.choices, correctIndex: mc.correctIndex }; }
      }
      questionCache[cacheKey] = item;
    } else {
      showQuickAddForm(cat, row, ci);
      return;
    }
  }

  // المهلة تُحسب مرة عند الفتح ثم تُبثّ، فيعدّ الجميع من نفس النقطة
  questionDeadline = questionSeconds > 0 ? Date.now() + questionSeconds * 1000 : 0;

  renderQuestionBody(item);
  startQuestionTimer();
  if (canControlGame() && isOnlineGame()) publishGameState();
  if (isOnlineHost()) publishGameState();
}

function showQuickAddForm(cat, row, ci) {
  document.getElementById('qbody').innerHTML = `
    <div class="loadbox">ما فيه سؤال محفوظ لهذه الفئة بعد 🙂</div>
    <div class="admin-row" style="flex-direction:column; align-items:stretch; margin-top:10px;">
      <input type="text" id="quickQText" placeholder="نص السؤال">
      <input type="text" id="quickQAnswer" placeholder="الإجابة الصحيحة">
      <input type="text" id="quickQEmoji" placeholder="إيموجي (اختياري)">
      <button class="btn btn-answer" style="margin-top:6px;" onclick="quickAddAndShow(${ci},${row})">حفظ وعرض السؤال</button>
    </div>
  `;
  document.getElementById('cornersBar').style.display = 'flex';
  document.getElementById('answerCorner').style.visibility = 'hidden';
}

async function quickAddAndShow(ci, row) {
  // ⚠️ للإدمن فقط — نفس تحقق لوحة الإدارة
  if (!(await authenticateAdmin())) return;

  const cat = rounds[activeRound][ci];
  const q = document.getElementById('quickQText')?.value?.trim();
  const a = document.getElementById('quickQAnswer')?.value?.trim();
  const emoji = document.getElementById('quickQEmoji')?.value?.trim() || '❓';

  if (!q || !a) {
    uiAlert('لازم تكتب السؤال والإجابة');
    return;
  }

  const diffKey = DIFFKEY[row];
  if (!QBANK[cat.name]) {
    QBANK[cat.name] = { easy: [], medium: [], hard: [] };
  }

  const newItem = { question: q, answer: a, emoji, needsImage: false, imageQuery: '' };
  QBANK[cat.name][diffKey].push(newItem);
  saveJSON('mr_bank', QBANK);
  pushToCloud();

  const cacheKey = `${activeRound}-${ci}-${row}`;
  questionCache[cacheKey] = newItem;

  log('سؤال جديد تمت إضافته من قبل الإدمن', 'success');
  Sound.award();
  renderQuestionBody(newItem);
}

/*
  ذاكرة الأسئلة المعروضة.

  كان `pickFromBank` اختياراً عشوائياً محضاً بلا ذاكرة، فالسؤال نفسه يعود في
  الجولة التالية. مع 20 سؤالاً لكل خانة و18 خانة في الجولة: الجولة الثانية
  فيها ~1 سؤال مكرّر والخامسة ~3-4. لعائلة تلعب كل ليلة هذا محسوس.

  نحفظ نصوص ما عُرض لكل (فئة/مستوى) ونتجنّبها. وحين تُستهلك الفئة كاملة
  نُصفّرها ونبدأ دورة جديدة — فلا ننفد من الأسئلة أبداً.
*/
/*
  أداء هذا الجهاز حسب الفئة.

  ⚠️ **إحصاءات جهاز لا إحصاءات لاعب**: في الوضع المحلي يتشارك الفريقان جهازاً
  واحداً، فلا سبيل لنسبة الإجابة إلى شخص بعينه. لذلك العنوان في الواجهة
  «أداء هذا الجهاز» لا «أداؤك» — الأمانة أولى من رقم يوحي بما لا يدلّ عليه.
*/
const CAT_STATS_KEY = 'mr_cat_stats';

function recordCategoryResult(categoryName, correct) {
  const name = String(categoryName || '').trim();
  if (!name) return;

  const raw = loadJSON(CAT_STATS_KEY, {});
  const stats = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  const cell = stats[name] || { tries: 0, correct: 0 };

  cell.tries += 1;
  if (correct) cell.correct += 1;
  stats[name] = cell;

  saveJSON(CAT_STATS_KEY, stats);
}

// نطلب ثلاث محاولات على الأقل: نسبة مبنية على محاولة واحدة (0% أو 100%)
// تُضلّل أكثر مما تفيد
function getCategoryStats(minTries = 3) {
  const raw = loadJSON(CAT_STATS_KEY, {});
  const stats = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};

  return Object.entries(stats)
    .filter(([, v]) => (v?.tries || 0) >= minTries)
    .map(([name, v]) => ({
      name,
      tries: v.tries,
      correct: v.correct,
      pct: Math.round((v.correct / v.tries) * 100)
    }))
    .sort((a, b) => b.pct - a.pct || b.tries - a.tries);
}

function resetCategoryStats() {
  saveJSON(CAT_STATS_KEY, {});
}

const SEEN_KEY = 'mr_seen_questions';
const SEEN_MAX_CELLS = 400;   // سقف يمنع تضخّم التخزين مع مرور الشهور

function loadSeen() {
  const raw = loadJSON(SEEN_KEY, {});
  return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
}

function markQuestionSeen(categoryName, diffKey, text) {
  if (!text) return;
  const seen = loadSeen();
  const key = `${categoryName}|${diffKey}`;
  const list = Array.isArray(seen[key]) ? seen[key] : [];

  if (!list.includes(text)) list.push(text);
  seen[key] = list;

  // نُسقط أقدم الخانات إن تجاوزنا السقف — الأحدث أولى بالبقاء
  const keys = Object.keys(seen);
  if (keys.length > SEEN_MAX_CELLS) {
    keys.slice(0, keys.length - SEEN_MAX_CELLS).forEach(k => delete seen[k]);
  }

  saveJSON(SEEN_KEY, seen);
}

function resetSeenQuestions() {
  saveJSON(SEEN_KEY, {});
}

function pickFromBank(categoryName, row) {
  const diffKey = DIFFKEY[row];
  const list = QBANK[categoryName] && QBANK[categoryName][diffKey];

  if (!list || !list.length) return null;

  const seen = loadSeen();
  const key = `${categoryName}|${diffKey}`;
  const already = new Set(Array.isArray(seen[key]) ? seen[key] : []);

  // ما لم يُعرض بعد. إن استُهلكت الفئة كلها بدأنا دورة جديدة نظيفة
  let fresh = list.filter(q => !already.has(String(q?.question || '').trim()));
  if (!fresh.length) {
    delete seen[key];
    saveJSON(SEEN_KEY, seen);
    fresh = list;
  }

  const chosen = fresh[Math.floor(Math.random() * fresh.length)];
  markQuestionSeen(categoryName, diffKey, String(chosen?.question || '').trim());
  return { ...chosen };
}

// صورة السؤال إن وُجدت، وإلا الإيموجي. فئات مثل «شعارات» و«منو المشهور»
// و«ميمز» بلا صورة سؤالها بلا معنى.
function questionVisual(item, id = '') {
  const idAttr = id ? ` id="${id}"` : '';
  if (item?.image) {
    return `<div class="qimg has-photo"${idAttr}>
              <img src="${escapeHtml(item.image)}" alt="صورة السؤال" class="qphoto">
            </div>`;
  }
  return `<div class="qimg"${idAttr}>${escapeHtml(item?.emoji || '❓')}</div>`;
}

function renderQuestionBody(item) {
  const body = document.getElementById('qbody');
  if (!body) return;

  // أونلاين: أربعة خيارات واحتساب تلقائي بدل حكم المضيف
  if (isOnlineGame() && Array.isArray(item.choices)) {
    renderChoices(item);
    return;
  }

  body.innerHTML = `
    ${questionVisual(item, 'qimg')}
    <div class="qtext" id="qtext">${item.question}</div>
    <div class="atext" id="atext">${item.answer}</div>
  `;

  document.getElementById('toggleAnswerBtn').textContent = 'عرض الإجابة';
  document.getElementById('answerCorner').style.visibility = 'visible';
  document.getElementById('cornersBar').style.display = 'flex';
  Sound.reveal();

  renderAwardButtons();
}

function renderAwardButtons() {
  const container = document.getElementById('awardButtons');
  if (!container) return;

  container.innerHTML = '';

  // «الحفرة» تمنع الفريق الآخر من أخذ نقاط هذا السؤال
  const blocked = activeLifeline?.key === 'hofra'
    ? (activeLifeline.team === 'A' ? 'B' : 'A')
    : null;

  ['A', 'B'].forEach(team => {
    const isBlocked = blocked === team;
    const btn = createElement('button', {
      class: `btn btn-award ${team}${isBlocked ? ' blocked' : ''}`,
      title: isBlocked ? 'محجوب بـ «الحفرة»' : ''
    }, `${isBlocked ? '🕳️ ' : ''}للـ ${getTeamName(team)}`);

    if (isBlocked) {
      btn.disabled = true;
    } else {
      btn.onclick = () => award(team);
    }

    container.appendChild(btn);
  });
}

function toggleAnswer() {
  Sound.click();
  const q = document.getElementById('qtext');
  const a = document.getElementById('atext');
  const btn = document.getElementById('toggleAnswerBtn');

  if (!q || !a) return;

  const showing = a.classList.contains('show');
  if (showing) {
    a.classList.remove('show');
    q.classList.remove('hide');
    btn.textContent = 'عرض الإجابة';
  } else {
    a.classList.add('show');
    q.classList.add('hide');
    btn.textContent = 'رجوع للسؤال';
  }
}

function award(team, opts = {}) {
  if (!current) return;

  const pts = POINTS[current.row];

  // «الفخ»: إذا أجاب الفريق الآخر صحيحاً، تذهب النقاط لصاحب الفخ
  if (team && activeLifeline?.key === 'fakh' && team !== activeLifeline.team) {
    const trapper = activeLifeline.team;
    uiAlert(`🪤 وقع ${getTeamName(team)} في فخ ${getTeamName(trapper)}!\nالنقاط (${pts}) تذهب لـ ${getTeamName(trapper)}.`);
    team = trapper;
  }

  if (team) {
    scores[team] += pts;
    const scoreEl = document.getElementById(`score${team}`);
    if (scoreEl) scoreEl.textContent = scores[team];
    Sound.award();
  } else {
    Sound.skip();
  }

  // نفس سبب `answerPublishGrace` في finishAnsweredQuestion: من يعطي النقاط
  // قد يكون صاحب الدور لا المضيف، فيفقد صلاحية البثّ فور انتقال الدور عنه
  const hadControl = canControlGame();
  answerPublishGrace = hadControl;

  try {
    // «استريح» تخطٍّ مقصود لا محاولة، ولا يُحتسب في أداء الفئة.
    // وفي الأونلاين الاحتساب يتم في `submitAnswer` فلا نُكرّره هنا.
    if (!opts.keepTurn && !isOnlineGame()) {
      recordCategoryResult(current.cat?.name, !!team);
    }

    stateUsed[activeRound][current.ci][current.row] = true;
    closeQuestion();
    renderBoard();

    // الدور ينتقل للفريق الآخر، إلا مع «استريح» فيبقى مع نفس الفريق
    if (!opts.keepTurn) switchTurn();

    // انتهت كل الخلايا؟ نعرض شاشة الفوز
    if (isGameFinished()) {
      if (hadControl) publishGameState({ phase: 'ended' });
      showEndScreen();
      return;
    }

    if (hadControl) publishGameState();
  } finally {
    answerPublishGrace = false;
  }
}

function closeQuestion() {
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('cornersBar').style.display = '';
  current = null;
  lastAnswer = null;
  stopQuestionTimer();
  questionDeadline = 0;
  clearActiveLifeline();
  if (canControlGame()) publishGameState();
}

/* ============================= ONLINE GAME STATE SYNC ============================= */

// هل نحن في روم أونلاين؟ وهل نحن صاحب الروم؟
function isOnlineGame() {
  return !!(typeof currentRoom !== 'undefined' && currentRoom);
}

function isOnlineHost() {
  return isOnlineGame() && !!currentPlayer?.is_host;
}

// من أجاب للتوّ يبقى مخوّلاً بالبثّ حتى ينتهي إغلاق سؤاله.
//
// ⚠️ بدون هذا يقف الدور عند من لعب: صاحب الدور يجيب، ثم ينتقل الدور عنه،
// فيفقد الصلاحية قبل أن يبثّ الانتقال نفسه — فتبقى بقية الأجهزة على الدور
// القديم إلى الأبد. (لا تظهر عند المضيف لأنه مخوّل دائماً.)
let answerPublishGrace = false;

// من يحقّ له تحديث حالة اللعبة: المضيف أو صاحب الدور (لأنه هو من يجيب)
function canControlGame() {
  return isOnlineHost() || isMyTurn() || answerPublishGrace;
}

// صاحب الروم يبثّ حالة اللعبة كاملة حتى تظهر نفسها على كل الأجهزة
function publishGameState(extra = {}) {
  // المضيف أو صاحب الدور — لأن صاحب الدور هو من يجيب فيغيّر الحالة
  if (!canControlGame()) return;

  const state = {
    phase: 'playing',
    categories: rounds.map(r => r.map(c => c.name)),
    points: POINTS,
    teamNames: { A: teamSetup.A.name, B: teamSetup.B.name },
    used: stateUsed,
    activeRound,
    activeTeam,
    turnOrder,
    turnIndex,
    scores,
    lifelines: { setup: { A: teamSetup.A.lifelines, B: teamSetup.B.lifelines },
                 used: lifelineUsed, active: activeLifeline },
    openQuestion: current
      ? { ci: current.ci, row: current.row, round: activeRound, item: questionCache[`${activeRound}-${current.ci}-${current.row}`] }
      : null,
    lastAnswer,
    questionDeadline,      // طابع زمني لا عدّاد — راجع `startQuestionTimer`
    ...extra
  };

  updateRoomGameState({ state_data: state, scores, current_round: activeRound });
}

// كل الأجهزة (بما فيها صاحب الروم) تطبّق الحالة القادمة من السحابة
function applyRemoteGameState(state) {
  if (!state) return;

  // المضيف رجع للوبي (لعبة جديدة) → نرجع معه
  if (state.phase === 'lobby') {
    if (!isOnlineHost()) goToRoomSetup();
    return;
  }

  if (state.phase !== 'playing' && state.phase !== 'ended') return;

  // نعيد بناء الجولات من أسماء الفئات المُرسلة
  rounds = (state.categories || []).map(names =>
    names.map(n => CATEGORIES.find(c => c.name === n) || { name: n, ic: '✨' })
  );
  if (!rounds.length) return;

  if (Array.isArray(state.points) && state.points.length) POINTS = state.points;
  if (state.teamNames) {
    teamSetup.A.name = state.teamNames.A || teamSetup.A.name;
    teamSetup.B.name = state.teamNames.B || teamSetup.B.name;
  }
  if (state.used) stateUsed = state.used;
  if (state.scores) scores = state.scores;
  if (state.activeTeam) activeTeam = state.activeTeam;
  if (Array.isArray(state.turnOrder)) turnOrder = state.turnOrder;
  lastAnswer = state.lastAnswer || null;
  if (typeof state.turnIndex === 'number') turnIndex = state.turnIndex;
  if (state.lifelines) {
    if (state.lifelines.setup) {
      teamSetup.A.lifelines = state.lifelines.setup.A || [];
      teamSetup.B.lifelines = state.lifelines.setup.B || [];
    }
    if (state.lifelines.used) lifelineUsed = state.lifelines.used;
    activeLifeline = state.lifelines.active || null;
  }
  activeRound = state.activeRound || 0;

  // انتهت اللعبة → شاشة الفوز على كل الأجهزة
  if (state.phase === 'ended') {
    updateGameUI();
    if (!document.querySelector('#screen-end.active')) showEndScreen();
    return;
  }

  const alreadyPlaying = document.querySelector('#screen-game.active');
  if (!alreadyPlaying) {
    showScreen('screen-game');
  }

  updateGameUI();
  renderTabs();
  renderBoard();

  // مزامنة نافذة السؤال المفتوح
  const q = state.openQuestion;
  const overlay = document.getElementById('overlay');
  if (q && q.item) {
    const cat = rounds[q.round]?.[q.ci];
    if (cat) {
      current = { ci: q.ci, row: q.row, cat };
      questionCache[`${q.round}-${q.ci}-${q.row}`] = q.item;
      document.getElementById('qcat').innerHTML = `${escapeHtml(cat.ic)} ${escapeHtml(cat.name)}`;
      document.getElementById('qpoints').textContent = `${POINTS[q.row]} نقطة`;
      renderQuestionBody(q.item);
      overlay.classList.add('show');
      // نأخذ المهلة كما بُثّت فيعدّ الجميع إلى نفس اللحظة
      questionDeadline = Number(state.questionDeadline) || 0;
      startQuestionTimer();
    }
  } else if (!isOnlineHost()) {
    overlay.classList.remove('show');
    current = null;
    stopQuestionTimer();
    questionDeadline = 0;
  }

  applyViewerRestrictions();
}

// اللاعبون غير المضيف يشاهدون فقط: لا فتح أسئلة ولا إعطاء نقاط
function applyViewerRestrictions() {
  if (!isOnlineGame()) return;
  const viewer = !currentPlayer?.is_host;

  const corners = document.getElementById('cornersBar');
  if (corners) {
    const awardCorner = corners.children[1];
    if (awardCorner) awardCorner.style.display = viewer ? 'none' : '';
  }

  const board = document.getElementById('board');
  if (board) board.classList.toggle('viewer-mode', viewer);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'overlay') closeQuestion();
  });

  updateTotalStats();
  // نبدأ قراءة قائمة السحب فوراً حتى تكون جاهزة قبل أول دمج من السحابة
  fetchRetiredQuestions();
  syncBundledQuestionBank();
});

/* ============================= QUESTION BANK LOADING ============================= */

const QBANK_FILES = [
  'data/questions.json',
  'data/questions-part2.json',
  'data/questions-part3.json',
  'data/questions-part2-continued.json',
  'data/questions-part4.json',
  'data/questions-part5.json',
  'data/questions-part6.json',
  'data/questions-part7.json',
  'data/questions-part8.json',
  'data/questions-part9.json',
  'data/questions-part10.json',
  'data/questions-part11.json',
  'data/questions-part12.json'
];

/*
  ⚠️ ملفات البيانات تحتاج نفس مُبطِّل الكاش الذي للـ CSS و JS.

  كانت `data/*.json` تُجلب بلا `?v=` إطلاقاً، فيخدمها المتصفح من الكاش:
  أي تصحيح أو إضافة في بنك الأسئلة **لا يصل للاعب** مهما رفعنا إصدار
  السكربتات. اكتُشف عملياً — تصحيحات مرفوعة كانت تُقرأ من نسخة قديمة.

  نقرأ الإصدار من وسم game.js نفسه، فيبقى المفتاح واحداً: رقم `?v=` في
  index.html يبطّل الكاش للسكربتات والتنسيقات والبيانات معاً.
*/
function assetVersion() {
  const src = document.querySelector('script[src*="game.js"]')?.getAttribute('src') || '';
  const m = src.match(/[?&]v=([^&]+)/);
  return m ? m[1] : '';
}

function versionedUrl(path) {
  const v = assetVersion();
  return v ? `${path}${path.includes('?') ? '&' : '?'}v=${encodeURIComponent(v)}` : path;
}

// نجلب الملفات مرة واحدة فقط لكل تحميل صفحة ونعيد استخدام النتيجة،
// لأن الدالة تُستدعى مرتين (عند التحميل وبعد سحب السحابة) وكان ذلك يضاعف الطلبات
let bundledQuestionFilesPromise = null;

// يقرأ كل ملفات الأسئلة المرفقة مع المشروع (يتجاوز أي ملف ناقص بدل ما يفشل كلياً)
function fetchBundledQuestionFiles() {
  if (bundledQuestionFilesPromise) return bundledQuestionFilesPromise;

  bundledQuestionFilesPromise = Promise.all(QBANK_FILES.map(async (path) => {
    try {
      const res = await fetch(versionedUrl(path));
      if (!res.ok) return {};
      const data = await res.json();
      return (data && typeof data === 'object') ? data : {};
    } catch (e) {
      console.warn(`تعذّر قراءة ${path}:`, e);
      return {};
    }
  }));

  return bundledQuestionFilesPromise;
}

// قائمة الأسئلة المسحوبة، تُقرأ مرة واحدة لكل تحميل صفحة.
//
// `retiredTexts` يفحصه الدمج نفسه، فالسؤال المسحوب لا يعود من أي مصدر:
// لا من ملفات المشروع ولا من نسخة Supabase ولا من بثّ لحظي. بدون هذا كانت
// المزامنة اللحظية تعيد زرع ما سحبناه للتوّ.
let retiredQuestionsPromise = null;
let retiredTexts = new Set();

function fetchRetiredQuestions() {
  if (retiredQuestionsPromise) return retiredQuestionsPromise;

  retiredQuestionsPromise = fetch(versionedUrl('data/retired-questions.json'))
    .then(res => (res.ok ? res.json() : null))
    .then(data => (Array.isArray(data?.retire) ? data.retire : []))
    .catch(() => [])    // غياب الملف ليس خطأً
    .then(list => {
      retiredTexts = new Set(list.map(t => String(t).trim()).filter(Boolean));
      return list;
    });

  return retiredQuestionsPromise;
}

/*
  يدمج أسئلة الملفات داخل البنك بدون حذف أي سؤال أضافه المستخدم.

  ⚠️ كان الدمج يتجاهل أي سؤال نصّه موجود مسبقاً — أي أنه **لا يستطيع تصحيح
  إجابة خاطئة أبداً**. أي تصحيح في ملفات المشروع كان يموت عند حدود المتصفح:
  النسخة القديمة محفوظة في localStorage وفي Supabase فتبقى هي المعروضة.

  الآن ملفات المشروع مرجعٌ لإجابة السؤال الذي جاء منها: إن اختلفت الإجابة
  حُدِّثت. ما يضيفه المستخدم يدوياً لا تمسّه (لأنه ليس في الملفات أصلاً)،
  والصورة الملصقة محلياً تبقى كما هي.
*/
function mergeIntoQuestionBank(bank, incoming) {
  let added = 0;
  let fixed = 0;

  Object.keys(incoming).forEach(cat => {
    const src = incoming[cat];
    if (!src || typeof src !== 'object') return;

    if (!bank[cat] || typeof bank[cat] !== 'object') {
      bank[cat] = { easy: [], medium: [], hard: [] };
    }

    ['easy', 'medium', 'hard'].forEach(diff => {
      if (!Array.isArray(bank[cat][diff])) bank[cat][diff] = [];
      const incomingList = Array.isArray(src[diff]) ? src[diff] : [];

      const byText = new Map();
      bank[cat][diff].forEach(q => {
        const t = String(q?.question || '').trim();
        if (t && !byText.has(t)) byText.set(t, q);
      });

      incomingList.forEach(q => {
        const text = String(q?.question || '').trim();
        if (!text || retiredTexts.has(text)) return;

        const existing = byText.get(text);
        if (existing) {
          const newAnswer = String(q.answer ?? '').trim();
          if (newAnswer && String(existing.answer ?? '').trim() !== newAnswer) {
            existing.answer = q.answer;
            fixed++;
          }
          // الإيموجي لا يُفرض على سؤال أُلصقت به صورة — الصورة أولى بالعرض
          if (q.emoji && !existing.image && existing.emoji !== q.emoji) {
            existing.emoji = q.emoji;
          }
          return;
        }

        bank[cat][diff].push(q);
        byText.set(text, q);
        added++;
      });
    });
  });

  return { added, fixed };
}

/*
  الأسئلة المسحوبة: إعادة صياغة سؤال في الملفات تُنتج سؤالاً «جديداً» في نظر
  الدمج، فيبقى المعيب جنب المصحَّح. هذه القائمة تُسقط نصوصاً بعينها من بنك
  كل جهاز — وهي الطريقة الوحيدة للتخلّص من سؤال معيب سبق أن انتشر.
  أضف نص السؤال القديم حرفياً عند إعادة صياغة أي سؤال.
*/
function retireQuestions(bank, texts) {
  const drop = new Set((texts || []).map(t => String(t).trim()).filter(Boolean));
  if (!drop.size) return 0;

  let removed = 0;
  Object.keys(bank).forEach(cat => {
    ['easy', 'medium', 'hard'].forEach(diff => {
      if (!Array.isArray(bank[cat]?.[diff])) return;
      const before = bank[cat][diff].length;
      bank[cat][diff] = bank[cat][diff]
        .filter(q => !drop.has(String(q?.question || '').trim()));
      removed += before - bank[cat][diff].length;
    });
  });
  return removed;
}

// يضمن أن كل فئة موجودة في البنك تظهر أيضاً في قائمة الفئات
function syncCategoriesWithBank() {
  let added = 0;
  Object.keys(QBANK).forEach(name => {
    if (CATEGORIES.some(c => c.name === name)) return;
    const known = DEFAULT_CATEGORIES.find(c => c.name === name);
    CATEGORIES.push(known ? { ...known } : { name, ic: '✨' });
    added++;
  });
  return added;
}

// يحمّل ملفات الأسئلة ويدمجها في البنك الحالي.
// يعمل في كل تشغيل (وليس فقط عند بنك فارغ) حتى تصل الأسئلة الجديدة
// للمتصفحات التي عندها نسخة قديمة محفوظة في localStorage أو السحابة.
async function syncBundledQuestionBank() {
  try {
    const files = await fetchBundledQuestionFiles();

    // الإسقاط قبل الدمج: لو أُعيدت صياغة سؤال، نحذف القديم ثم نضيف الجديد
    const removed = retireQuestions(QBANK, await fetchRetiredQuestions());

    let added = 0;
    let fixed = 0;
    files.forEach(data => {
      const r = mergeIntoQuestionBank(QBANK, data);
      added += r.added;
      fixed += r.fixed;
    });

    const newCats = syncCategoriesWithBank();

    if (added > 0 || fixed > 0 || removed > 0 || newCats > 0) {
      saveJSON('mr_bank', QBANK);
      saveJSON('mr_categories', CATEGORIES);
    }
    // لا ندفع التصحيح للسحابة: الكتابة في game_settings مقصورة على الإدارة،
    // فمحاولة كل لاعب تفشل بخطأ RLS وتملأ السجل بلا فائدة. لا حاجة إليها
    // أصلاً — كل جهاز يصحّح نفسه من ملفات المشروع عند كل تحميل.

    updateTotalStats();

    if (document.querySelector('#screen-categories.active')) {
      renderCatGrid();
    }
    if (document.querySelector('#screen-admin.active')) {
      populateBankCatSelect?.();
      renderBankList?.();
    }

    if (added > 0) {
      log(`📚 تم تحميل ${added} سؤال جديد من ملفات المشروع`, 'success');
    }
    if (fixed > 0 || removed > 0) {
      log(`🩹 تصحيح البنك: ${fixed} إجابة مُحدَّثة و${removed} سؤال مسحوب`, 'success');
    }

    return added;
  } catch (error) {
    console.warn('تعذّر تحميل بنك الأسئلة:', error);
    return 0;
  }
}

function updateTotalStats() {
  let total = 0;
  Object.values(QBANK).forEach(c => {
    ['easy', 'medium', 'hard'].forEach(k => {
      total += (c[k] || []).length;
    });
  });

  const totalQEl = document.getElementById('totalQuestions');
  if (totalQEl) totalQEl.textContent = total;

  const footerEl = document.getElementById('footerStats');
  if (footerEl) footerEl.textContent = total;

  // عدد الفئات يُحسب من البيانات الفعلية بدل رقم مكتوب يدوياً في HTML
  const catsEl = document.getElementById('totalCategories');
  if (catsEl) {
    const withQuestions = Object.values(QBANK).filter(c =>
      ['easy', 'medium', 'hard'].some(k => (c[k] || []).length > 0)
    ).length;
    catsEl.textContent = withQuestions || CATEGORIES.length;
  }
}

// ⚠️ لا تُعرِّف `pushToCloud` هنا. كان هنا جذمور فارغ يقول «سيتم تنفيذها في
// sync.js»، وهو يعمل فقط لأن `sync.js` يُحمَّل بعد هذا الملف فيَجُبّه. لو
// انعكس ترتيب الوسمين يوماً لصارت كل عمليات الدفع تنجح صامتة بلا أن تحفظ شيئاً.

/* ============================= ONLINE MODE FUNCTIONS ============================= */

function goToModeSelect() {
  Sound.click();
  showScreen('screen-mode-select');
}

// الرجوع من شاشة الفئات: في الأونلاين نعود لإعدادات الروم، وفي المحلي لإعداد الفرق
function backFromCategories() {
  Sound.click();
  if (currentRoom) {
    showScreen('screen-room-setup');
    updateRoomSetupDisplay();
  } else {
    goToSetup();
  }
}

function startLocalMode() {
  Sound.click();
  // وضع محلي = نفس النظام الحالي
  goToSetup();
}

function goToRooms() {
  Sound.click();
  showScreen('screen-rooms');
  loadAvailableRooms();
}

async function loadAvailableRooms() {
  const roomsList = document.getElementById('roomsList');
  if (!roomsList) return;

  // لا نعرض الرومات المتاحة للحفاظ على الخصوصية
  // بدل ذلك، نطلب من اللاعب إدخال الكود مباشرة
  roomsList.innerHTML = `
    <div style="text-align: center; padding: 20px; color: #999;">
      <p style="margin-bottom: 15px;">🔒 لا توجد رومات عامة</p>
      <p style="font-size: 12px; line-height: 1.6;">
        اطلب من صاحب الروم أن يعطيك الكود<br>
        ثم ادخله في الحقل أعلاه
      </p>
    </div>
  `;
}

function selectRoomToJoin(roomCode) {
  const input = document.getElementById('roomCodeInput');
  if (input) input.value = roomCode;
  document.getElementById('playerNameInput')?.focus();
}

async function showCreateRoomDialog() {
  const roomName = await uiPrompt('اسم الروم:', 'جلسة اللعب');
  if (!roomName) return;

  createRoomAndEnter(roomName);
}

async function createRoomAndEnter(roomName) {
  // الاسم يأتي من الحساب — لا نسأل عنه مرتين
  const playerName = isSignedIn() ? getPlayerDisplayName() : (await uiPrompt('اسمك:', 'اللاعب'))?.trim();
  if (!playerName) return;

  // الاسم يُمرَّر لـ createRoom حتى يُحفظ في السحابة صحيحاً منذ البداية،
  // بدل ضبطه محلياً بعد الإدراج حيث كان اسم الروم قد كُتب مكانه
  const room = await createRoom(roomName, 'online', playerName.trim());
  if (room) goToRoomSetup();
}

async function joinRoomByCode() {
  const roomCode = document.getElementById('roomCodeInput')?.value?.toUpperCase();
  const playerName = isSignedIn()
    ? getPlayerDisplayName()
    : document.getElementById('playerNameInput')?.value;

  if (!roomCode || roomCode.length < 4) {
    uiAlert('❌ أدخل كود الروم');
    return;
  }

  if (!playerName) {
    uiAlert('❌ أدخل اسمك');
    return;
  }

  const success = await joinRoom(roomCode, playerName);
  if (success) {
    goToRoomSetup();
  }
}

function goToRoomSetup() {
  Sound.click();
  showScreen('screen-room-setup');
  updateRoomSetupDisplay();
}

async function updateRoomSetupDisplay() {
  if (!currentRoom) return;

  const codeDisplay = document.getElementById('roomCodeDisplay');
  if (codeDisplay) codeDisplay.textContent = currentRoom.code;

  const modeDisplay = document.getElementById('roomModeDisplay');
  if (modeDisplay) {
    modeDisplay.textContent = currentRoom.mode === 'online' ? '🌐 أونلاين' : '💻 محلي';
  }

  const startBtn = document.getElementById('startGameBtn');
  if (startBtn && currentPlayer?.is_host) {
    startBtn.style.display = 'block';
  }

  await getRoomPlayers();
  updatePlayersList();
  await loadChatMessages();
  createChatPanel();
}

async function startGameOnline() {
  if (!currentPlayer?.is_host) {
    uiAlert('❌ فقط صاحب الروم يمكنه بدء اللعبة');
    return;
  }

  // لا بد من لاعب واحد آخر على الأقل — لا معنى لجولة أونلاين بلاعب واحد
  if (roomPlayers.length < 2) {
    uiAlert('❌ انتظر دخول لاعب آخر على الأقل قبل البدء');
    return;
  }

  // كل اللاعبين لهم فريق
  const playersWithoutTeam = roomPlayers.filter(p => !p.team);
  if (playersWithoutTeam.length > 0) {
    uiAlert(`❌ وزّع كل اللاعبين على الفرق أولاً

بانتظار التوزيع: ${playersWithoutTeam.map(p => p.player_name).join('، ')}`);
    return;
  }

  // والفريقان ليسا فارغين
  const teamA = roomPlayers.filter(p => p.team === 'A');
  const teamB = roomPlayers.filter(p => p.team === 'B');
  if (!teamA.length || !teamB.length) {
    uiAlert('❌ لازم يكون في كل فريق لاعب واحد على الأقل');
    return;
  }

  // الذهاب لشاشة اختيار الفئات بدل الذهاب مباشرة للعبة
  Sound.click();
  selectedCats = []; // مسح الفئات السابقة
  showScreen('screen-categories');
  renderCatGrid();
}

/* ============================= CHOICE UI & AUTO SCORING ============================= */

// نتيجة السؤال الحالي بعد الإجابة: { pickedIndex, correctIndex, byName, team, correct }
let lastAnswer = null;

function renderChoices(item) {
  const body = document.getElementById('qbody');
  if (!body) return;

  const mine = isMyTurn();
  const turn = currentTurnPlayer();
  const done = !!lastAnswer;

  const letters = ['أ', 'ب', 'ج', 'د'];

  body.innerHTML = `
    ${questionVisual(item)}
    <div class="qtext">${escapeHtml(item.question)}</div>
    <div class="choice-hint">${
      done ? '' : (mine ? '👈 اختر إجابتك' : `⏳ ${escapeHtml(turn?.name || 'لاعب آخر')} يجيب الآن`)
    }</div>
    <div class="choices" id="choicesWrap">
      ${item.choices.map((c, i) => {
        let cls = 'choice';
        if (done) {
          if (i === item.correctIndex) cls += ' correct';
          else if (i === lastAnswer.pickedIndex) cls += ' wrong';
          else cls += ' dim';
        }
        return `<button class="${cls}" data-i="${i}"${(!mine || done) ? ' disabled' : ''}>
                  <span class="choice-letter">${letters[i]}</span>
                  <span class="choice-text">${escapeHtml(c)}</span>
                </button>`;
      }).join('')}
    </div>
    ${done ? `<div class="answer-result ${lastAnswer.correct ? 'ok' : 'no'}">
        ${lastAnswer.correct
          ? `✅ إجابة صحيحة — ${escapeHtml(lastAnswer.byName)} كسب ${POINTS[current.row]} نقطة`
          : lastAnswer.timedOut
            ? `⏰ انتهى الوقت على ${escapeHtml(lastAnswer.byName)} — الصحيحة: ${escapeHtml(item.choices[item.correctIndex])}`
            : `❌ إجابة خاطئة من ${escapeHtml(lastAnswer.byName)} — الصحيحة: ${escapeHtml(item.choices[item.correctIndex])}`}
      </div>` : ''}
  `;

  if (mine && !done) {
    body.querySelectorAll('.choice').forEach(btn => {
      btn.onclick = () => submitAnswer(Number(btn.dataset.i));
    });
  }

  // الاحتساب تلقائي — نخفي أزرار إعطاء النقاط اليدوية
  const corners = document.getElementById('cornersBar');
  if (corners) corners.style.display = 'none';
}

// صاحب الدور يختار إجابة: التقييم والنقاط يتمّان تلقائياً، فلا مجال للغش
function submitAnswer(index) {
  if (!current || lastAnswer) return;
  if (!isMyTurn()) return;

  const key = `${activeRound}-${current.ci}-${current.row}`;
  const item = questionCache[key];
  if (!item || !Array.isArray(item.choices)) return;

  const correct = index === item.correctIndex;
  const turn = currentTurnPlayer();
  const team = turn?.team || activeTeam;
  const pts = POINTS[current.row];

  lastAnswer = {
    pickedIndex: index,
    correctIndex: item.correctIndex,
    byName: turn?.name || getTeamName(team),
    team,
    correct
  };

  // نحتسب أداء الفئة على من أجاب فعلاً — أي على هذا الجهاز
  if (isMyTurn()) recordCategoryResult(current.cat?.name, correct);

  if (correct) {
    scores[team] = (scores[team] || 0) + pts;
    Sound.award();
  } else {
    Sound.skip();
  }

  updateGameUI();
  renderChoices(item);
  publishGameState();

  // مهلة قصيرة ليرى الجميع النتيجة قبل إغلاق السؤال
  setTimeout(() => finishAnsweredQuestion(), 2600);
}

function finishAnsweredQuestion() {
  if (!current) return;

  // نمدّ صلاحية البثّ عبر تبديل الدور، وإلا بقي الدور واقفاً عند من أجاب
  // على كل الأجهزة الأخرى
  const hadControl = canControlGame();
  answerPublishGrace = hadControl;

  try {
    stateUsed[activeRound][current.ci][current.row] = true;
    lastAnswer = null;
    closeQuestion();
    renderBoard();
    switchTurn();

    if (isGameFinished()) {
      if (hadControl) publishGameState({ phase: 'ended' });
      showEndScreen();
      return;
    }

    if (hadControl) publishGameState();
  } finally {
    answerPublishGrace = false;
  }
}
