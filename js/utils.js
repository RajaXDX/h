/* ============================= UTILITY FUNCTIONS ============================= */

/* ---- SOUND EFFECTS ---- */
const Sound = (function () {
  let ctx = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, type, gainVal) {
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, c.currentTime + start);
      gain.gain.setValueAtTime(0, c.currentTime + start);
      gain.gain.linearRampToValueAtTime(gainVal || 0.15, c.currentTime + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(c.currentTime + start);
      osc.stop(c.currentTime + start + dur + 0.02);
    } catch (e) {
      // Audio context not available
    }
  }

  return {
    click() { tone(520, 0, 0.08, 'triangle', 0.12); },
    open() { tone(420, 0, 0.09, 'sine', 0.1); tone(620, 0.07, 0.12, 'sine', 0.1); },
    reveal() { tone(740, 0, 0.1, 'sine', 0.12); tone(990, 0.08, 0.16, 'sine', 0.12); },
    award() { tone(523, 0, 0.12, 'triangle', 0.14); tone(659, 0.1, 0.12, 'triangle', 0.14); tone(784, 0.2, 0.22, 'triangle', 0.16); },
    skip() { tone(300, 0, 0.12, 'sine', 0.1); tone(220, 0.1, 0.18, 'sine', 0.1); },
    start() { tone(392, 0, 0.1, 'triangle', 0.12); tone(494, 0.1, 0.1, 'triangle', 0.12); tone(587, 0.2, 0.1, 'triangle', 0.12); tone(784, 0.3, 0.25, 'triangle', 0.16); },
    select() { tone(440, 0, 0.06, 'square', 0.06); },
  };
})();

/* ---- LOCAL STORAGE ---- */
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function saveJSON(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch (e) {
    console.error('Save failed:', e);
    return false;
  }
}

/* ---- SCREEN NAVIGATION ---- */
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.add('active');
    window.scrollTo(0, 0);
  }
}

function goToHome() {
  Sound.click();
  showScreen('screen-home');
}

function goToSetup() {
  Sound.click();
  showScreen('screen-setup');
  renderTeamSetup();
}

function goToCategories() {
  Sound.click();
  showScreen('screen-categories');
}

function showAbout() {
  Sound.click();
  alert(`مخمخ رجا v2.0

لعبة أسئلة ذكية جماعية

✨ الميزات:
• بنك أسئلة متزامن سحابياً
• 200+ سؤال متنوع
• دعم عدة فرق
• وسائل مساعدة ذكية
• لوحة تحكم احترافية

🚀 مطور: فريق مخمخ رجا
📧 البريد: support@mokhamakh.app`);
}

/* ---- MODAL DIALOGS ---- */
function showConfirm(message, onConfirm, onCancel) {
  if (confirm(message)) {
    if (onConfirm) onConfirm();
  } else {
    if (onCancel) onCancel();
  }
}

function showPrompt(message, defaultValue = '') {
  return prompt(message, defaultValue);
}

function showAlert(message, title = 'تنبيه') {
  alert(`${title}\n\n${message}`);
}

/* ---- STRING UTILITIES ---- */
function trimArabic(str) {
  if (!str) return '';
  return str.replace(/^\s+|\s+$/g, '').replace(/‏|‎/g, '');
}

function capitalizeArabic(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function slugify(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/* ---- ARRAY UTILITIES ---- */
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function groupBy(arr, key) {
  return arr.reduce((groups, item) => {
    const group = groups[item[key]] || [];
    group.push(item);
    groups[item[key]] = group;
    return groups;
  }, {});
}

function unique(arr, key) {
  if (!key) return [...new Set(arr)];
  const seen = new Set();
  return arr.filter(item => {
    const k = item[key];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ---- OBJECT UTILITIES ---- */
function mergeObjects(target, source) {
  return { ...target, ...source };
}

function cloneObject(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* ---- DATE & TIME ---- */
function getCurrentDateTime() {
  return new Date().toISOString();
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('ar-SA');
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('ar-SA');
}

function getDaysDifference(date1, date2) {
  const ms = Math.abs(new Date(date1) - new Date(date2));
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/* ---- VALIDATION ---- */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidArabicText(text) {
  return /[؀-ۿ]/.test(text);
}

function isEmpty(value) {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

function hasProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

/* ---- NUMBER UTILITIES ---- */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ---- DOM UTILITIES ---- */
function createElement(tag, attrs = {}, content = '') {
  const el = document.createElement(tag);
  Object.keys(attrs).forEach(key => {
    if (key === 'class') {
      el.className = attrs[key];
    } else if (key === 'style') {
      Object.assign(el.style, attrs[key]);
    } else {
      el.setAttribute(key, attrs[key]);
    }
  });
  if (content !== '' && content !== null && content !== undefined) {
    if (content instanceof Node) {
      el.appendChild(content);
    } else {
      el.innerHTML = content;
    }
  }
  return el;
}

function setInnerText(element, text) {
  if (element) {
    element.textContent = text;
  }
}

function setInnerHTML(element, html) {
  if (element) {
    element.innerHTML = html;
  }
}

function addClass(element, className) {
  if (element) {
    element.classList.add(className);
  }
}

function removeClass(element, className) {
  if (element) {
    element.classList.remove(className);
  }
}

function toggleClass(element, className) {
  if (element) {
    element.classList.toggle(className);
  }
}

function hasClass(element, className) {
  if (!element) return false;
  return element.classList.contains(className);
}

/* ---- ASYNC UTILITIES ---- */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryAsync(fn, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await wait(delay);
    }
  }
}

/* ---- LOGGING ---- */
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('ar-SA');
  const prefix = `[${timestamp}]`;

  switch (type) {
    case 'success':
      console.log(`%c${prefix} ✅ ${message}`, 'color: #27AE60; font-weight: bold;');
      break;
    case 'error':
      console.error(`%c${prefix} ❌ ${message}`, 'color: #E74C3C; font-weight: bold;');
      break;
    case 'warning':
      console.warn(`%c${prefix} ⚠️ ${message}`, 'color: #F39C12; font-weight: bold;');
      break;
    default:
      console.log(`%c${prefix} ℹ️ ${message}`, 'color: #3498DB;');
  }
}
