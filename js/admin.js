/* ============================= ADMIN PANEL ============================= */

let adminReturnScreen = 'screen-home';

// متغير عام للتحقق من أن الإدمن مسجل دخول
let isAdminLoggedIn = false;

function openAdmin() {
  Sound.select();
  const entered = prompt('أدخل رمز لوحة الإدارة:');
  if (entered === null) return;

  if (trimArabic(entered) !== ADMIN_PIN) {
    alert('❌ رمز غير صحيح - الوصول مرفوض');
    isAdminLoggedIn = false;
    return;
  }

  isAdminLoggedIn = true;
  log('✅ الإدمن دخل بنجاح', 'success');

  const active = document.querySelector('.screen.active');
  adminReturnScreen = active ? active.id : 'screen-home';

  showScreen('screen-admin');
  initializeAdminPanel();
}

function closeAdmin() {
  Sound.click();
  isAdminLoggedIn = false; // تسجيل الخروج من الإدارة
  showScreen(adminReturnScreen);
  if (adminReturnScreen === 'screen-categories') {
    renderCatGrid();
  } else if (adminReturnScreen === 'screen-game') {
    renderBoard();
  }
  log('✅ إغلاق لوحة الإدارة', 'info');
}

function initializeAdminPanel() {
  document.getElementById('ptEasy').value = POINTS[0];
  document.getElementById('ptMed').value = POINTS[1];
  document.getElementById('ptHard').value = POINTS[2];
  renderAdminCategories();
  populateBankCatSelect();
  renderBankList();
  updateSyncInfo();
}

/* ============================= ADMIN TABS ============================= */

function switchAdminTab(tabName) {
  // إخفاء جميع التبويبات
  document.querySelectorAll('.admin-section').forEach(section => {
    section.classList.remove('active');
  });

  // إزالة الحالة النشطة من جميع الأزرار
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.classList.remove('active');
  });

  // إظهار التبويب المطلوب
  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) {
    targetTab.classList.add('active');
  }

  // تنشيط الزر المناسب
  event.target.classList.add('active');

  // تحديث المحتوى
  if (tabName === 'sync') {
    updateSyncInfo();
  }
}

function updateSyncInfo() {
  const info = document.getElementById('syncInfo');
  if (!info) return;

  if (!supa) {
    info.innerHTML = `
      <p>⚠️ Supabase غير متصل</p>
      <p>حالياً يتم استخدام التخزين المحلي فقط</p>
    `;
    return;
  }

  let total = 0;
  Object.values(QBANK).forEach(c => {
    ['easy', 'medium', 'hard'].forEach(k => {
      total += (c[k] || []).length;
    });
  });

  info.innerHTML = `
    <div style="display: grid; gap: 12px;">
      <div style="padding: 12px; background: rgba(63, 167, 150, 0.1); border-radius: 8px;">
        <strong>📊 إحصائيات البنك:</strong>
        <p>إجمالي الأسئلة: <strong>${total}</strong></p>
        <p>الفئات: <strong>${Object.keys(QBANK).length}</strong></p>
      </div>
      <div style="padding: 12px; background: rgba(212, 175, 55, 0.1); border-radius: 8px;">
        <strong>☁️ حالة المزامنة:</strong>
        <p id="syncStatus">جاري الفحص...</p>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-answer" onclick="syncNow()">🔄 مزامنة الآن</button>
        <button class="btn btn-ghost" onclick="exportBankJSON()">📥 تصدير البيانات</button>
        <button class="btn btn-ghost" onclick="importBankJSON()">📤 استيراد البيانات</button>
      </div>
    </div>
  `;
}

/* ============================= POINTS MANAGEMENT ============================= */

function savePoints() {
  const e = parseInt(document.getElementById('ptEasy').value) || 100;
  const m = parseInt(document.getElementById('ptMed').value) || 250;
  const h = parseInt(document.getElementById('ptHard').value) || 400;

  POINTS = [e, m, h];
  saveJSON('mr_points', POINTS);
  pushToCloud();
  Sound.award();
  alert('✅ تم حفظ النقاط بنجاح');

  if (document.querySelector('#screen-game.active')) {
    renderBoard();
  }
}

/* ============================= CATEGORIES MANAGEMENT ============================= */

function renderAdminCategories() {
  const label = document.getElementById('catCountLabel');
  if (label) label.textContent = CATEGORIES.length;

  const wrap = document.getElementById('catAdminList');
  if (!wrap) return;

  wrap.innerHTML = '';
  CATEGORIES.forEach(c => {
    const chip = createElement('div', { class: 'cat-admin-chip' }, `
      <span>${c.ic} ${c.name}</span>
      <span class="del" title="حذف">✕</span>
    `);
    chip.querySelector('.del').onclick = () => deleteCategory(c.name);
    wrap.appendChild(chip);
  });
}

function adminAddCategory() {
  // ✅ حماية أمنية: التحقق من أن الإدمن مسجل دخول
  if (!isAdminLoggedIn) {
    alert('❌ يجب تسجيل الدخول كإدمن أولاً');
    return;
  }

  const input = document.getElementById('adminNewCatName');
  const name = trimArabic(input.value);
  if (!name) return;

  if (CATEGORIES.some(c => c.name === name)) {
    alert('❌ هذه الفئة موجودة بالفعل');
    input.value = '';
    return;
  }

  CATEGORIES.push({ name, ic: '✨' });
  saveJSON('mr_categories', CATEGORIES);
  pushToCloud();
  input.value = '';
  renderAdminCategories();
  populateBankCatSelect();
  log(`✅ تمت إضافة فئة جديدة: ${name}`, 'success');
  alert('✅ تمت إضافة الفئة بنجاح');
}

function deleteCategory(name) {
  if (!confirm(`هل تريد حذف الفئة "${name}"؟`)) return;

  CATEGORIES = CATEGORIES.filter(c => c.name !== name);
  selectedCats = selectedCats.filter(c => c.name !== name);
  delete QBANK[name];

  saveJSON('mr_categories', CATEGORIES);
  saveJSON('mr_bank', QBANK);
  pushToCloud();

  renderAdminCategories();
  populateBankCatSelect();
  alert('✅ تم حذف الفئة بنجاح');
}

/* ============================= QUESTION BANK MANAGEMENT ============================= */

function populateBankCatSelect() {
  const sel = document.getElementById('bankCatSelect');
  if (!sel) return;

  const current = sel.value;
  sel.innerHTML = '';

  CATEGORIES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = `${c.ic} ${c.name}`;
    sel.appendChild(opt);
  });

  if (current && CATEGORIES.some(c => c.name === current)) {
    sel.value = current;
  }

  sel.onchange = renderBankList;
  document.getElementById('bankDiffSelect').onchange = renderBankList;

  renderBankList();
}

function addBankQuestion() {
  // ✅ حماية أمنية: فقط الإدمن يمكنه إضافة أسئلة
  if (!isAdminLoggedIn) {
    alert('❌ يجب تسجيل الدخول كإدمن أولاً');
    return;
  }

  const cat = document.getElementById('bankCatSelect').value;
  const diffKey = document.getElementById('bankDiffSelect').value;
  const q = trimArabic(document.getElementById('newQText').value);
  const a = trimArabic(document.getElementById('newQAnswer').value);
  const emoji = document.getElementById('newQEmoji').value.trim() || '❓';

  if (!cat || !q || !a) {
    alert('❌ لازم تكتب نص السؤال والإجابة على الأقل');
    return;
  }

  if (!QBANK[cat]) {
    QBANK[cat] = { easy: [], medium: [], hard: [] };
  }

  QBANK[cat][diffKey].push({
    question: q,
    answer: a,
    emoji: emoji,
    needsImage: false,
    imageQuery: ''
  });

  saveJSON('mr_bank', QBANK);
  pushToCloud();

  document.getElementById('newQText').value = '';
  document.getElementById('newQAnswer').value = '';
  document.getElementById('newQEmoji').value = '';

  log(`✅ تمت إضافة سؤال جديد في فئة ${cat}`, 'success');
  Sound.award();
  renderBankList();
  alert('✅ تم إضافة السؤال بنجاح');
  updateTotalStats();
}

function deleteBankQuestion(cat, diffKey, idx) {
  if (!QBANK[cat] || !QBANK[cat][diffKey]) return;

  if (!confirm('هل تريد حذف هذا السؤال؟')) return;

  QBANK[cat][diffKey].splice(idx, 1);
  saveJSON('mr_bank', QBANK);
  pushToCloud();
  renderBankList();
  updateTotalStats();
}

function renderBankList() {
  const cat = document.getElementById('bankCatSelect').value;
  const diffKey = document.getElementById('bankDiffSelect').value;
  const list = (QBANK[cat] && QBANK[cat][diffKey]) || [];
  const wrap = document.getElementById('bankList');

  if (!wrap) return;

  wrap.innerHTML = '';
  list.forEach((item, idx) => {
    const row = createElement('div', { class: 'bank-item' }, `
      <div>
        <div class="bq">${item.emoji || '❓'} ${item.question}</div>
        <div class="ba">الإجابة: ${item.answer}</div>
      </div>
    `);

    const delBtn = createElement('button', { class: 'del-q', title: 'حذف' }, '✕');
    delBtn.onclick = () => deleteBankQuestion(cat, diffKey, idx);
    row.appendChild(delBtn);

    wrap.appendChild(row);
  });

  // الإحصائيات
  let total = 0;
  Object.values(QBANK).forEach(c => {
    ['easy', 'medium', 'hard'].forEach(k => {
      total += (c[k] || []).length;
    });
  });

  const countEl = document.getElementById('bankCount');
  if (countEl) {
    countEl.textContent = `أسئلة هذه الفئة/المستوى: ${list.length} — إجمالي البنك: ${total} سؤال`;
  }
}

/* ============================= EXPORT / IMPORT ============================= */

function exportBankJSON() {
  const data = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    categories: CATEGORIES,
    points: POINTS,
    questions: QBANK
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mokhamakh-raj-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  alert('✅ تم تصدير البيانات بنجاح');
}

function importBankJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);

        if (!data.questions) {
          alert('❌ صيغة الملف غير صحيحة');
          return;
        }

        // دمج البيانات
        Object.keys(data.questions).forEach(cat => {
          if (!QBANK[cat]) {
            QBANK[cat] = { easy: [], medium: [], hard: [] };
          }

          ['easy', 'medium', 'hard'].forEach(k => {
            if (Array.isArray(data.questions[cat][k])) {
              QBANK[cat][k] = QBANK[cat][k].concat(data.questions[cat][k]);
            }
          });

          if (!CATEGORIES.some(c => c.name === cat)) {
            CATEGORIES.push({ name: cat, ic: '✨' });
          }
        });

        saveJSON('mr_bank', QBANK);
        saveJSON('mr_categories', CATEGORIES);
        pushToCloud();

        renderAdminCategories();
        populateBankCatSelect();
        updateTotalStats();

        alert('✅ تم استيراد البيانات بنجاح');
      } catch (error) {
        console.error(error);
        alert('❌ خطأ في قراءة الملف');
      }
    };
    reader.readAsText(file);
  };

  input.click();
}

function syncNow() {
  setSyncStatus('syncing');
  pushToCloud().then(() => {
    updateSyncInfo();
  });
}

/* ============================= IMAGE IMPORT ============================= */

function importImages() {
  if (!isAdminLoggedIn) {
    alert('❌ يجب تسجيل الدخول كإدمن أولاً');
    return;
  }

  const fileInput = document.getElementById('imageImportInput');
  const files = fileInput.files;

  if (files.length === 0) {
    alert('❌ اختر صوراً من الجهاز أولاً');
    return;
  }

  const statusDiv = document.getElementById('imageImportStatus');
  statusDiv.textContent = '⏳ جاري معالجة الصور...';

  let processed = 0;
  let images = loadJSON('mr_images', {});

  Array.from(files).forEach((file, idx) => {
    if (!file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      const fileName = file.name;
      const timestamp = Date.now();
      const imageKey = `img_${timestamp}_${idx}`;

      images[imageKey] = {
        name: fileName,
        data: base64,
        size: file.size,
        type: file.type,
        uploadDate: new Date().toISOString()
      };

      processed++;
      statusDiv.textContent = `⏳ تم معالجة ${processed}/${files.length} صورة...`;

      if (processed === files.length) {
        saveJSON('mr_images', images);
        pushToCloud();
        statusDiv.textContent = `✅ تم استيراد ${processed} صورة بنجاح!`;
        fileInput.value = '';
        Sound.award();
        log(`✅ تم استيراد ${processed} صورة`, 'success');

        setTimeout(() => {
          statusDiv.textContent = '';
          showImageLibrary(images);
        }, 1500);
      }
    };
    reader.readAsDataURL(file);
  });
}

function showImageLibrary(images) {
  const imageCount = Object.keys(images).length;
  const msg = `
📸 مكتبة الصور
━━━━━━━━━━━━
إجمالي الصور: ${imageCount}

الصور المحفوظة:
${Object.entries(images).slice(-5).map(([key, img]) =>
  `• ${img.name} (${formatBytes(img.size)})`
).join('\n')}

${imageCount > 5 ? `... و ${imageCount - 5} صور أخرى` : ''}

يمكنك الآن استخدام أسماء الصور في الأسئلة!
  `;
  alert(msg);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/* ============================= RELOAD QUESTION BANK ============================= */

async function reloadQuestionBank() {
  const before = countBankQuestions();
  const added = await syncBundledQuestionBank();
  const after = countBankQuestions();

  populateBankCatSelect();
  renderBankList();
  renderAdminCategories();
  updateSyncInfo();

  if (added > 0) {
    alert(`✅ تم تحميل ${added} سؤال جديد\n\nالمجموع الآن: ${after} سؤال (كان ${before})`);
  } else {
    alert(`ℹ️ بنك الأسئلة محدّث بالفعل — ${after} سؤال`);
  }
}

function countBankQuestions() {
  let total = 0;
  Object.values(QBANK).forEach(c => {
    ['easy', 'medium', 'hard'].forEach(k => {
      total += (c[k] || []).length;
    });
  });
  return total;
}

/* ============================= CLEANUP ROOMS ============================= */

async function cleanupOldRooms() {
  if (!supa) {
    alert('❌ Supabase غير متصل');
    return;
  }

  if (!confirm('🗑️ حذف جميع الرومات القديمة من السحابة؟ (هذا لا يمكن التراجع عنه)')) {
    return;
  }

  try {
    // حذف جميع الرومات
    const { error: roomsError } = await supa.from('game_rooms').delete().gt('id', '0');
    if (roomsError) throw roomsError;

    // حذف جميع لاعبي الرومات
    const { error: playersError } = await supa.from('room_players').delete().gt('id', '0');
    if (playersError) throw playersError;

    // حذف جميع رسائل الشات
    const { error: chatError } = await supa.from('room_chat').delete().gt('id', '0');
    if (chatError) throw chatError;

    // حذف حالات اللعبة
    const { error: stateError } = await supa.from('room_game_state').delete().gt('id', '0');
    if (stateError) throw stateError;

    alert('✅ تم حذف جميع الرومات والبيانات المتعلقة بها');
    log('🗑️ تم تنظيف الرومات القديمة', 'success');
  } catch (error) {
    console.error('Cleanup error:', error);
    alert(`❌ خطأ: ${error.message}`);
  }
}
