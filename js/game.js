/* ============================= GAME STATE ============================= */

// الثوابت
const ADMIN_PIN = '2014';
const LIFELINES = [
  { key: 'fakh', name: 'الفخ', ic: '🪤' },
  { key: 'istareeh', name: 'استريح', ic: '✋' },
  { key: 'hofra', name: 'الحفرة', ic: '🕳️' },
  { key: 'sadeeq', name: 'اتصال بصديق', ic: '📞' },
  { key: 'jawabain', name: 'جاوب جوابين', ic: '✌️' },
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
      <input type="text" id="setupName${team}" placeholder="الفريق ${team === 'A' ? 'الأول' : 'الثاني'}" value="${teamSetup[team].name}">
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
    alert('لازم كل فريق يختار 3 وسائل مساعدة بالضبط');
    return;
  }

  showScreen('screen-categories');
  renderCatGrid();
}

/* ============================= CATEGORY SELECTION ============================= */

function renderCatGrid() {
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
    <div class="nm">${c.name}</div>
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

function addCustomCategory() {
  // ⚠️ حماية أمنية: فقط الإدمن يستطيع إضافة فئات مخصصة
  const entered = prompt('الفئات المخصصة متاحة للإدمن فقط.\nأدخل رمز لوحة الإدارة:');
  if (entered === null) return;
  if (trimArabic(entered) !== ADMIN_PIN) {
    alert('رمز غير صحيح - الوصول مرفوض');
    return;
  }

  const input = document.getElementById('customCatName');
  const name = trimArabic(input.value);
  if (!name) return;

  if (CATEGORIES.some(c => c.name === name) || selectedCats.some(c => c.name === name)) {
    input.value = '';
    alert('هذه الفئة موجودة بالفعل');
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

  // إذا لم تكن في مود أونلاين، استخدم teamSetup. إذا كان في أونلاين، استخدم roomPlayers
  if (currentRoom) {
    // مود أونلاين - استخدم أسماء الفريق من Supabase
    const teamA = roomPlayers.filter(p => p.team === 'A');
    const teamB = roomPlayers.filter(p => p.team === 'B');
    if (teamA.length === 0 || teamB.length === 0) {
      alert('❌ لم يتم توزيع اللاعبين بشكل صحيح');
      return;
    }
  }

  updateGameUI();
  showScreen('screen-game');
  renderTabs();
  renderBoard();
}

function updateGameUI() {
  const nameA = document.getElementById('gameNameA');
  const nameB = document.getElementById('gameNameB');
  const scoreA = document.getElementById('scoreA');
  const scoreB = document.getElementById('scoreB');

  // الحصول على أسماء الفريق من teamSetup أو من roomPlayers
  let teamAName = teamSetup.A?.name || 'الفريق A';
  let teamBName = teamSetup.B?.name || 'الفريق B';

  if (currentRoom && roomPlayers.length > 0) {
    // في مود أونلاين، استخدم أسماء اللاعبين من كل فريق
    const teamA = roomPlayers.filter(p => p.team === 'A');
    const teamB = roomPlayers.filter(p => p.team === 'B');
    teamAName = teamA.map(p => p.player_name).join(' + ') || 'الفريق A';
    teamBName = teamB.map(p => p.player_name).join(' + ') || 'الفريق B';
  }

  if (nameA) nameA.textContent = `🟢 ${teamAName}`;
  if (nameB) nameB.textContent = `🟡 ${teamBName}`;
  if (scoreA) scoreA.textContent = scores.A;
  if (scoreB) scoreB.textContent = scores.B;

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
        el.onclick = () => {
          lifelineUsed[team].push(key);
          renderLifelineDisplay();
        };
      }

      wrap.appendChild(el);
    });
  });
}

function backToSetupConfirm() {
  if (confirm('بدء لعبة جديدة؟ بيروح كل التقدم الحالي')) {
    selectedCats = [];
    questionCache = {};
    goToSetup();
  }
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
      activeRound = i;
      renderTabs();
      renderBoard();
    };

    tabs.appendChild(b);
  });
}

function renderBoard() {
  const cats = rounds[activeRound];
  const board = document.getElementById('board');
  if (!board) return;

  board.style.gridTemplateColumns = `repeat(${cats.length}, 1fr)`;
  board.innerHTML = '';

  // رؤوس الفئات
  cats.forEach(c => {
    const h = createElement('div', {
      class: 'cat-header'
    }, `<span class="ic">${c.ic}</span><span>${c.name}</span>`);
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

/* ============================= QUESTION DIALOG ============================= */

function openQuestion(ci, row) {
  Sound.open();
  const cat = rounds[activeRound][ci];
  current = { ci, row, cat };

  const qcat = document.getElementById('qcat');
  const qpoints = document.getElementById('qpoints');
  if (qcat) qcat.innerHTML = `${cat.ic} ${cat.name}`;
  if (qpoints) qpoints.textContent = `${POINTS[row]} نقطة`;

  document.getElementById('cornersBar').style.display = 'none';
  document.getElementById('qbody').innerHTML = '<div class="loadbox">⏳ جاري إحضار السؤال...</div>';
  document.getElementById('overlay').classList.add('show');

  const cacheKey = `${activeRound}-${ci}-${row}`;
  let item = questionCache[cacheKey];

  if (!item) {
    item = pickFromBank(cat.name, row);
    if (item) {
      questionCache[cacheKey] = item;
    } else {
      showQuickAddForm(cat, row, ci);
      return;
    }
  }

  renderQuestionBody(item);
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

function quickAddAndShow(ci, row) {
  // ⚠️ حماية أمنية: فقط الإدمن يمكنه إضافة أسئلة سريعة
  const entered = prompt('إضافة أسئلة سريعة متاحة للإدمن فقط.\nأدخل رمز لوحة الإدارة:');
  if (entered === null) return;
  if (trimArabic(entered) !== ADMIN_PIN) {
    alert('رمز غير صحيح - الوصول مرفوض');
    return;
  }

  const cat = rounds[activeRound][ci];
  const q = document.getElementById('quickQText')?.value?.trim();
  const a = document.getElementById('quickQAnswer')?.value?.trim();
  const emoji = document.getElementById('quickQEmoji')?.value?.trim() || '❓';

  if (!q || !a) {
    alert('لازم تكتب السؤال والإجابة');
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

function pickFromBank(categoryName, row) {
  const diffKey = DIFFKEY[row];
  const list = QBANK[categoryName] && QBANK[categoryName][diffKey];

  if (!list || !list.length) return null;

  const idx = Math.floor(Math.random() * list.length);
  return { ...list[idx] };
}

function renderQuestionBody(item) {
  const body = document.getElementById('qbody');
  if (!body) return;

  body.innerHTML = `
    <div class="qimg" id="qimg">${item.emoji || '❓'}</div>
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

  const btnA = createElement('button', {
    class: 'btn btn-award A'
  }, `للـ ${teamSetup.A.name}`);
  btnA.onclick = () => award('A');

  const btnB = createElement('button', {
    class: 'btn btn-award B'
  }, `للـ ${teamSetup.B.name}`);
  btnB.onclick = () => award('B');

  container.appendChild(btnA);
  container.appendChild(btnB);
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

function award(team) {
  if (!current) return;

  const pts = POINTS[current.row];
  if (team) {
    scores[team] += pts;
    const scoreEl = document.getElementById(`score${team}`);
    if (scoreEl) scoreEl.textContent = scores[team];
    Sound.award();
  } else {
    Sound.skip();
  }

  stateUsed[activeRound][current.ci][current.row] = true;
  closeQuestion();
  renderBoard();
}

function closeQuestion() {
  document.getElementById('overlay').classList.remove('show');
  current = null;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'overlay') closeQuestion();
  });

  updateTotalStats();
  bootstrapQuestionBankIfEmpty();
});

// يحمّل بنك الأسئلة الافتراضي من data/questions*.json
// فقط إذا كان البنك المحلي (localStorage/السحابة) فارغاً بعد، حتى لا يطغى على بيانات حقيقية
async function bootstrapQuestionBankIfEmpty() {
  if (Object.keys(QBANK).length > 0) return;

  try {
    const files = [
      'data/questions.json',
      'data/questions-part2.json',
      'data/questions-part3.json',
      'data/questions-part2-continued.json'
    ];

    const responses = await Promise.all(files.map(f => fetch(f).catch(() => null)));
    const dataPromises = responses.map((r, i) => {
      if (!r || !r.ok) return Promise.resolve({});
      return r.json().catch(() => ({}));
    });
    const allData = await Promise.all(dataPromises);

    if (Object.keys(QBANK).length > 0) return; // تجنّب سباق مع سحب بيانات حقيقية من السحابة

    // دمج جميع البيانات
    QBANK = allData.reduce((acc, data) => ({ ...acc, ...data }), {});
    saveJSON('mr_bank', QBANK);
    updateTotalStats();

    if (document.querySelector('#screen-categories.active')) {
      renderCatGrid();
    }
  } catch (error) {
    console.warn('تعذّر تحميل بنك الأسئلة الافتراضي:', error);
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
}

// دالة للمزامنة السحابية
async function pushToCloud() {
  if (!supa) return;
  // سيتم تنفيذها في sync.js
}

/* ============================= ONLINE MODE FUNCTIONS ============================= */

function goToModeSelect() {
  Sound.click();
  showScreen('screen-mode-select');
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

function showCreateRoomDialog() {
  const roomName = prompt('اسم الروم:', 'جلسة اللعب');
  if (!roomName) return;

  createRoomAndEnter(roomName);
}

async function createRoomAndEnter(roomName) {
  const playerName = prompt('اسمك:', 'اللاعب');
  if (!playerName) return;

  const room = await createRoom(roomName, 'online');
  if (room) {
    currentPlayer.name = playerName;
    goToRoomSetup();
  }
}

async function joinRoomByCode() {
  const roomCode = document.getElementById('roomCodeInput')?.value?.toUpperCase();
  const playerName = document.getElementById('playerNameInput')?.value;

  if (!roomCode || roomCode.length < 4) {
    alert('❌ أدخل كود الروم');
    return;
  }

  if (!playerName) {
    alert('❌ أدخل اسمك');
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
    alert('❌ فقط صاحب الروم يمكنه بدء اللعبة');
    return;
  }

  // التحقق من أن جميع اللاعبين لهم فريق
  const playersWithoutTeam = roomPlayers.filter(p => !p.team);
  if (playersWithoutTeam.length > 0) {
    alert('❌ يجب توزيع جميع اللاعبين على الفرق أولاً');
    return;
  }

  // الذهاب لشاشة اختيار الفئات بدل الذهاب مباشرة للعبة
  Sound.click();
  selectedCats = []; // مسح الفئات السابقة
  showScreen('screen-categories');
  renderCatGrid();
}
