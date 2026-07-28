/* ============================= PLAYER ACCOUNTS ============================= */
/*
  حسابات اللاعبين عبر Supabase Auth.

  لماذا لا نخزّن كلمة المرور بأنفسنا:
  تخزين كلمات المرور بشكل صحيح صعب وخطير — أي خطأ يكشف حسابات الجميع. لذلك
  نترك الأمر لـ Supabase Auth الذي يحفظها مشفّرة في مخطط auth المحمي. النتيجة
  أن **لا أحد** يستطيع عرض كلمة مرور لاعب — ولا الإدمن ولا نحن — وهذا هو
  السلوك الصحيح لا نقصاً في اللوحة.

  Supabase Auth يطلب بريداً، واللاعب يسجّل باسم مستخدم. لذلك نشتقّ بريداً
  داخلياً ثابتاً من اسم المستخدم، فيبقى الدخول ممكناً بالاسم وحده.
*/

// بوابة الحساب.
//
// مشغّلة: لا لعب بلا حساب. تتطلّب أن يكون الإعداد في Supabase مكتملاً —
//   1) supabase-accounts.sql مُشغَّل
//   2) "Confirm email" معطّل في Authentication → Sign In / Providers → Email
// اجعلها false لو أردت إتاحة اللعب بلا حساب (احتكاك أقل عند النشر).
const REQUIRE_ACCOUNT = true;

const ACCOUNT_EMAIL_DOMAIN = 'raja-players.com';

let currentProfile = null;

/* ---- اسم المستخدم ---- */

// نطبّع الاسم حتى يكون الدخول متسقاً: حروف صغيرة بلا مسافات طرفية
function normalizeUsername(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// البريد الداخلي مشتقّ من بصمة الاسم — غير مرئي للاعب ولا يُرسل له شيء.
//
// لماذا بصمة لا الاسم نفسه: الأسماء العربية عند ترميزها في بريد تُنتج محارف %
// يرفضها Supabase كبريد غير صالح. البصمة ASCII دائماً، وثابتة لنفس الاسم
// فيبقى الدخول ممكناً باسم المستخدم وحده، ولا تكشف الاسم في جدول Auth.
async function usernameToEmail(name) {
  const clean = normalizeUsername(name);
  const bytes = new TextEncoder().encode('raja:' + clean);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  return `u${hex}@${ACCOUNT_EMAIL_DOMAIN}`;
}

function validateCredentials(username, password) {
  const u = normalizeUsername(username);
  if (u.length < 3) return 'اسم المستخدم لازم 3 أحرف على الأقل';
  if (u.length > 20) return 'اسم المستخدم طويل (20 حرف كحد أقصى)';
  if (!/^[\p{L}\p{N} _-]+$/u.test(u)) return 'اسم المستخدم يقبل حروفاً وأرقاماً ومسافة و _ - فقط';
  if (!password || password.length < 6) return 'كلمة المرور لازم 6 أحرف على الأقل';
  return null;
}

/* ---- التسجيل والدخول ---- */

async function signUpPlayer(username, password) {
  if (!supa) return { error: 'قاعدة البيانات غير متصلة' };

  const problem = validateCredentials(username, password);
  if (problem) return { error: problem };

  const clean = normalizeUsername(username);

  try {
    const { data, error } = await supa.auth.signUp({
      email: await usernameToEmail(clean),
      password
    });

    if (error) {
      if (/already registered|already been registered/i.test(error.message)) {
        return { error: 'اسم المستخدم محجوز — اختر غيره' };
      }
      return { error: error.message };
    }

    if (!data.user) return { error: 'تعذّر إنشاء الحساب' };

    // ملف اللاعب المرئي (الاسم والإحصاءات)
    const { error: profileError } = await supa
      .from('profiles')
      .insert({ id: data.user.id, username: clean });

    if (profileError && !/duplicate/i.test(profileError.message)) {
      return { error: 'تعذّر إنشاء الملف الشخصي' };
    }

    await loadProfile();
    trackEvent?.('account_created');
    log(`✅ حساب جديد: ${clean}`, 'success');
    return { ok: true };
  } catch (e) {
    console.error('signUpPlayer', e);
    return { error: 'حدث خطأ غير متوقع' };
  }
}

async function signInPlayer(username, password) {
  if (!supa) return { error: 'قاعدة البيانات غير متصلة' };
  if (!username || !password) return { error: 'اكتب اسم المستخدم وكلمة المرور' };

  try {
    const { error } = await supa.auth.signInWithPassword({
      email: await usernameToEmail(username),
      password
    });

    if (error) return { error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };

    await loadProfile();
    await supa.from('profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', currentProfile?.id);

    log(`✅ دخول: ${currentProfile?.username}`, 'success');
    return { ok: true };
  } catch (e) {
    console.error('signInPlayer', e);
    return { error: 'حدث خطأ غير متوقع' };
  }
}

async function signOutPlayer() {
  try { await supa?.auth.signOut(); } catch (e) { console.warn(e); }
  currentProfile = null;
  isAdminLoggedIn = false;
  if (typeof leaveRoom === 'function' && currentRoom) await leaveRoom();
  renderAuthState();
  showScreen('screen-auth');
}

/* ---- الملف الشخصي ---- */

async function loadProfile() {
  if (!supa) return null;

  try {
    const { data: { user } } = await supa.auth.getUser();
    if (!user) { currentProfile = null; return null; }

    const { data, error } = await supa
      .from('profiles').select('*').eq('id', user.id).single();

    if (error) { currentProfile = null; return null; }

    currentProfile = data;
    return data;
  } catch (e) {
    currentProfile = null;
    return null;
  }
}

function isSignedIn() {
  return !!currentProfile;
}

// اسم اللاعب المعتمد في الرومات
function getPlayerDisplayName() {
  return currentProfile?.username || 'لاعب';
}

/* ---- الإحصاءات ---- */

// تُستدعى عند انتهاء الجولة. الزيادة تتم على القيم المقروءة حالاً —
// اللعبة فردية لكل جهاز فلا يوجد تسابق حقيقي على نفس الصف.
async function recordGameResult({ won, score }) {
  if (!supa || !currentProfile) return;

  try {
    const next = {
      games_played: (currentProfile.games_played || 0) + 1,
      games_won: (currentProfile.games_won || 0) + (won ? 1 : 0),
      total_score: (currentProfile.total_score || 0) + (Number(score) || 0),
      last_seen_at: new Date().toISOString()
    };

    const { error } = await supa.from('profiles')
      .update(next).eq('id', currentProfile.id);

    if (!error) Object.assign(currentProfile, next);
  } catch (e) {
    console.warn('تعذّر تسجيل نتيجة الجولة:', e);
  }
}

async function bumpRoomsCreated() {
  if (!supa || !currentProfile) return;
  try {
    const next = { rooms_created: (currentProfile.rooms_created || 0) + 1 };
    await supa.from('profiles').update(next).eq('id', currentProfile.id);
    Object.assign(currentProfile, next);
  } catch (e) { /* لا يعطّل اللعب */ }
}

/* ---- صلاحية الإدمن ---- */

// الإدمن = عضوية في جدول admins، لا مجرد "مسجّل دخول"،
// لأن كل اللاعبين صاروا مسجّلين بعد إضافة الحسابات.
async function checkIsAdmin() {
  if (!supa) return false;
  try {
    // is_admin() تعتمد على auth.uid() من الجلسة نفسها.
    // ⚠️ لا تشترط وجود صف في profiles: حساب الإدارة يُنشأ يدوياً في Supabase
    // ولا ملف لاعب له، وكان اشتراط الملف يرفض دخول الإدمن الحقيقي.
    const { data, error } = await supa.rpc('is_admin');
    if (error) {
      console.warn('is_admin فشلت:', error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.warn('is_admin استثناء:', e);
    return false;
  }
}

/* ---- الواجهة ---- */

function renderAuthState() {
  const box = document.getElementById('authState');
  if (!box) return;

  if (!isSignedIn()) {
    box.innerHTML = '';
    box.style.display = 'none';
    return;
  }

  box.style.display = 'flex';
  box.innerHTML = `
    <span class="auth-user">👤 ${escapeHtml(currentProfile.username)}</span>
    <button class="auth-signout" onclick="signOutPlayer()">خروج</button>
  `;
}

async function handleAuthSubmit(mode) {
  const u = document.getElementById('authUsername')?.value;
  const p = document.getElementById('authPassword')?.value;
  const msg = document.getElementById('authMessage');
  const btns = document.querySelectorAll('#screen-auth .btn-main');

  const setBusy = (busy) => btns.forEach(b => { b.disabled = busy; });
  if (msg) { msg.textContent = ''; msg.className = 'auth-message'; }

  setBusy(true);
  const res = mode === 'signup'
    ? await signUpPlayer(u, p)
    : await signInPlayer(u, p);
  setBusy(false);

  if (res.error) {
    if (msg) { msg.textContent = res.error; msg.className = 'auth-message error'; }
    return;
  }

  document.getElementById('authPassword').value = '';
  renderAuthState();

  // أكمل إلى الروم الذي دُعي إليه إن كان جاء من رابط، وإلا للرئيسية
  const resumed = await handleRoomLinkOnLoad();
  if (!resumed) goToModeSelect();
}

// البوابة عند تحميل الصفحة
async function initAuthGate() {
  if (!supa || !REQUIRE_ACCOUNT) return true;

  await loadProfile();
  renderAuthState();

  if (!isSignedIn()) {
    showScreen('screen-auth');
    return false;
  }
  return true;
}

/* ---- تبديل تبويب دخول/تسجيل ---- */

let currentAuthMode = 'login';

function switchAuthTab(mode) {
  currentAuthMode = mode;
  Sound.click();

  document.getElementById('authTabLogin')?.classList.toggle('active', mode === 'login');
  document.getElementById('authTabSignup')?.classList.toggle('active', mode === 'signup');

  const btn = document.getElementById('authSubmitBtn');
  const note = document.getElementById('authNote');
  const pass = document.getElementById('authPassword');
  const msg = document.getElementById('authMessage');

  if (btn) btn.textContent = mode === 'signup' ? 'إنشاء الحساب' : 'دخول';
  if (note) note.textContent = mode === 'signup'
    ? 'عندك حساب؟ اضغط «دخول» فوق'
    : 'ما عندك حساب؟ اضغط «حساب جديد» فوق';
  if (pass) pass.setAttribute('autocomplete', mode === 'signup' ? 'new-password' : 'current-password');
  if (msg) { msg.textContent = ''; msg.className = 'auth-message'; }
}
