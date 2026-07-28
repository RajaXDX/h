/* ============================= ROOM MANAGEMENT ============================= */

// متغيرات حالة الروم
let currentRoom = null;  // معلومات الروم الحالي
let currentPlayer = null; // معلومات اللاعب الحالي
let roomPlayers = [];     // لاعبو الروم الحالي
let roomChatMessages = []; // رسائل الشات
let roomGameState = null; // حالة اللعبة الحالية
let roomSubscriptions = {}; // Realtime subscriptions

// ثوابت
const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/* ============================= ROOM CREATION ============================= */

async function createRoom(roomName, mode = 'online', playerName = '') {
  if (!supa) {
    uiAlert('❌ قاعدة البيانات غير متصلة');
    return null;
  }

  try {
    const playerId = generateId();
    const roomCode = generateRoomCode();

    // إنشاء الروم
    const { data: roomData, error: roomError } = await supa
      .from('game_rooms')
      .insert({
        code: roomCode,
        name: roomName,
        mode: mode,
        status: 'waiting',
        host_player_id: playerId,
        categories_selected: selectedCats || []
      })
      .select()
      .single();

    if (roomError) throw roomError;

    currentRoom = roomData;
    currentPlayer = {
      id: playerId,
      // اسم اللاعب هو ما كتبه هو، لا اسم الروم
      name: (playerName || '').trim() || 'المضيف',
      player_id: playerId,
      device_id: getDeviceId(),
      team: null,
      is_host: true,
      score: 0
    };

    // إضافة الـ Host كلاعب
    const { data: playerData, error: playerError } = await supa
      .from('room_players')
      .insert({
        room_id: roomData.id,
        player_id: playerId,
        player_name: currentPlayer.name,
        device_id: currentPlayer.device_id,
        is_host: true,
        status: 'active'
      })
      .select()
      .single();

    if (playerError) throw playerError;

    // إنشاء حالة اللعبة الأولية
    const { error: stateError } = await supa
      .from('room_game_state')
      .insert({
        room_id: roomData.id,
        current_round: 0,
        scores: { A: 0, B: 0 },
        questions_used: [],
        state_data: {}
      });

    if (stateError) throw stateError;

    log(`✅ تم إنشاء روم جديدة: ${roomCode}`, 'success');
    trackEvent('room_created');
    saveRoomSession();
    subscribeToRoom(roomData.id);

    return roomData;
  } catch (error) {
    console.error('Create room error:', error);
    log(`❌ خطأ في إنشاء الروم: ${error.message}`, 'error');
    return null;
  }
}

/* ============================= ROOM JOINING ============================= */

async function joinRoom(roomCode, playerName) {
  if (!supa) {
    uiAlert('❌ قاعدة البيانات غير متصلة');
    return false;
  }

  try {
    // نبحث بالكود فقط بدون تقييد الحالة، حتى يستطيع من انقطع اتصاله أو حدّث
    // الصفحة أن يعود إلى روم بدأت اللعب فيها بالفعل
    const { data: roomData, error: roomError } = await supa
      .from('game_rooms')
      .select('*')
      .eq('code', roomCode.toUpperCase())
      .single();

    if (roomError || !roomData) {
      uiAlert('❌ الروم غير موجود');
      return false;
    }

    if (roomData.status === 'completed') {
      uiAlert('❌ هذه الروم انتهت');
      return false;
    }

    const deviceId = getDeviceId();

    // هل لهذا الجهاز مقعد سابق في الروم؟
    const { data: previous } = await supa
      .from('room_players')
      .select('*')
      .eq('room_id', roomData.id)
      .eq('device_id', deviceId)
      .order('joined_at', { ascending: false })
      .limit(1);

    const seat = previous?.[0];

    // المطرود لا يعود
    if (seat?.status === 'kicked') {
      uiAlert('❌ تم إخراجك من هذه الروم');
      return false;
    }

    // اللعبة بدأت ولا يوجد مقعد سابق → لاعب جديد لا يستطيع الدخول وسط جولة
    if (roomData.status === 'active' && !seat) {
      uiAlert('❌ اللعبة بدأت بالفعل، لا يمكن الانضمام الآن');
      return false;
    }

    currentRoom = roomData;

    if (seat) {
      // استعادة المقعد نفسه بفريقه ونقاطه
      currentPlayer = {
        id: seat.player_id,
        name: seat.player_name,
        player_id: seat.player_id,
        device_id: deviceId,
        team: seat.team,
        is_host: seat.is_host,
        score: seat.score || 0
      };

      await supa
        .from('room_players')
        .update({ status: 'active', player_name: playerName || seat.player_name })
        .eq('room_id', roomData.id)
        .eq('player_id', seat.player_id);

      log(`✅ رجعت إلى الروم: ${roomCode}`, 'success');
    } else {
      const playerId = generateId();
      currentPlayer = {
        id: playerId,
        name: playerName,
        player_id: playerId,
        device_id: deviceId,
        team: null,
        is_host: false,
        score: 0
      };

      const { error: playerError } = await supa
        .from('room_players')
        .insert({
          room_id: roomData.id,
          player_id: playerId,
          player_name: playerName,
          device_id: deviceId,
          is_host: false,
          status: 'active'
        });

      if (playerError) throw playerError;
      log(`✅ دخلت إلى الروم: ${roomCode}`, 'success');
    }

    saveRoomSession();
    subscribeToRoom(roomData.id);

    return true;
  } catch (error) {
    console.error('Join room error:', error);
    log(`❌ خطأ في دخول الروم: ${error.message}`, 'error');
    return false;
  }
}

/* ============================= ROOM SHARING ============================= */

// رابط يفتح الروم مباشرة بدل إملاء الكود صوتياً وكتابته يدوياً
function getRoomLink() {
  if (!currentRoom) return '';
  const base = location.origin + location.pathname;
  return `${base}?room=${currentRoom.code}`;
}

function getRoomShareText() {
  return `تعال العب معنا «تحدي رجا» 🎮\nكود الروم: ${currentRoom?.code}\n${getRoomLink()}`;
}

function shareRoomWhatsApp() {
  if (!currentRoom) return;
  Sound.click();
  window.open('https://wa.me/?text=' + encodeURIComponent(getRoomShareText()), '_blank');
}

async function copyRoomLink() {
  if (!currentRoom) return;
  Sound.click();

  const link = getRoomLink();
  const btn = document.getElementById('copyLinkBtn');
  const done = () => {
    if (!btn) return;
    const original = btn.innerHTML;
    btn.innerHTML = '<span class="btn-icon">✅</span><span>تم النسخ</span>';
    setTimeout(() => { btn.innerHTML = original; }, 1800);
  };

  try {
    await navigator.clipboard.writeText(link);
    done();
  } catch (e) {
    // بديل للمتصفحات التي تمنع الحافظة بدون HTTPS
    const tmp = document.createElement('textarea');
    tmp.value = link;
    tmp.style.position = 'fixed';
    tmp.style.opacity = '0';
    document.body.appendChild(tmp);
    tmp.select();
    try { document.execCommand('copy'); done(); }
    catch (err) { uiPrompt('انسخ الرابط:', link); }
    tmp.remove();
  }
}

// يقرأ ?room=CODE من الرابط ويفتح شاشة الدخول بالكود جاهزاً
async function handleRoomLinkOnLoad() {
  const code = new URLSearchParams(location.search).get('room');
  if (!code) return false;

  // ننظّف الرابط حتى لا يتكرر الدخول عند التحديث
  history.replaceState(null, '', location.pathname);

  goToRooms();
  const input = document.getElementById('roomCodeInput');
  if (input) input.value = code.toUpperCase().trim();

  const nameInput = document.getElementById('playerNameInput');
  if (nameInput) {
    const saved = loadJSON(ROOM_SESSION_KEY, null);
    if (saved?.playerName) nameInput.value = saved.playerName;
    nameInput.focus();
  }

  log(`🔗 رابط روم: ${code}`, 'info');
  return true;
}

/* ============================= SESSION PERSISTENCE ============================= */

// نحفظ هوية الجلسة حتى يعود اللاعب تلقائياً بعد تحديث الصفحة أو انقطاع الشبكة
const ROOM_SESSION_KEY = 'mr_room_session';

function saveRoomSession() {
  if (!currentRoom || !currentPlayer) return;
  saveJSON(ROOM_SESSION_KEY, {
    roomCode: currentRoom.code,
    playerName: currentPlayer.name,
    savedAt: Date.now()
  });
}

function clearRoomSession() {
  try { localStorage.removeItem(ROOM_SESSION_KEY); } catch (e) { /* تجاهل */ }
}

// تُستدعى عند تحميل الصفحة: ترجع اللاعب لرومه إن كانت ما زالت قائمة
async function restoreRoomSession() {
  if (!supa) return false;

  const saved = loadJSON(ROOM_SESSION_KEY, null);
  if (!saved?.roomCode) return false;

  // جلسة أقدم من 6 ساعات نعتبرها منتهية
  if (Date.now() - (saved.savedAt || 0) > 6 * 60 * 60 * 1000) {
    clearRoomSession();
    return false;
  }

  const ok = await joinRoom(saved.roomCode, saved.playerName);
  if (!ok) {
    clearRoomSession();
    return false;
  }

  await getRoomPlayers();

  // إن كانت اللعبة جارية نرجعه للوحة مباشرة، لا لشاشة الانتظار
  const resumed = await fetchAndApplyGameState();
  if (!resumed) goToRoomSetup();

  log('🔄 تمت العودة إلى الروم السابقة', 'success');
  return true;
}

// يجلب آخر حالة لعبة محفوظة للروم ويطبّقها (للاعب العائد وسط جولة)
async function fetchAndApplyGameState() {
  if (!supa || !currentRoom) return false;

  try {
    const { data, error } = await supa
      .from('room_game_state')
      .select('state_data')
      .eq('room_id', currentRoom.id)
      .single();

    if (error || !data?.state_data) return false;

    const state = data.state_data;
    if (state.phase !== 'playing' && state.phase !== 'ended') return false;

    applyRemoteGameState(state);
    return true;
  } catch (e) {
    console.warn('تعذّر جلب حالة اللعبة:', e);
    return false;
  }
}

/* ============================= ROOM LEAVING ============================= */

async function leaveRoom() {
  if (!currentRoom || !currentPlayer) return;

  try {
    // تحديث حالة اللاعب
    await supa
      .from('room_players')
      .update({ status: 'left', left_at: new Date().toISOString() })
      .eq('room_id', currentRoom.id)
      .eq('player_id', currentPlayer.player_id);

    // إلغاء الاشتراكات
    unsubscribeFromRoom();

    // إخفاء واجهة الشات عند الخروج
    if (typeof hideChatUI === 'function') hideChatUI();

    // خروج مقصود → لا نعيده تلقائياً عند التحديث
    clearRoomSession();

    currentRoom = null;
    currentPlayer = null;
    roomPlayers = [];
    roomChatMessages = [];

    log('✅ خرجت من الروم', 'success');
  } catch (error) {
    console.error('Leave room error:', error);
  }
}

/* ============================= ROOM INFO ============================= */

async function getRoomPlayers() {
  if (!currentRoom) return [];

  try {
    const { data, error } = await supa
      .from('room_players')
      .select('*')
      .eq('room_id', currentRoom.id)
      .eq('status', 'active')
      .order('joined_at', { ascending: true });

    if (error) throw error;
    roomPlayers = data || [];
    return roomPlayers;
  } catch (error) {
    console.error('Get room players error:', error);
    return [];
  }
}

async function assignPlayerToTeam(playerId, team) {
  if (!currentRoom || !currentPlayer?.is_host) {
    uiAlert('❌ فقط صاحب الروم يمكنه توزيع الفرق');
    return false;
  }

  if (!['A', 'B'].includes(team)) {
    uiAlert('❌ الفريق يجب أن يكون A أو B');
    return false;
  }

  try {
    const { error } = await supa
      .from('room_players')
      .update({ team: team })
      .eq('room_id', currentRoom.id)
      .eq('player_id', playerId);

    if (error) throw error;
    log(`✅ تم توزيع اللاعب على الفريق ${team}`, 'success');
    return true;
  } catch (error) {
    console.error('Assign team error:', error);
    return false;
  }
}

/* ============================= KICK PLAYER ============================= */

async function kickPlayer(playerId, playerName) {
  if (!currentRoom || !currentPlayer?.is_host) {
    uiAlert('❌ فقط صاحب الروم يمكنه طرد اللاعبين');
    return false;
  }

  if (playerId === currentPlayer.player_id) {
    uiAlert('❌ لا يمكنك طرد نفسك');
    return false;
  }

  if (!await uiConfirm(`طرد ${playerName || 'هذا اللاعب'} من الروم؟`)) return false;

  try {
    const { error } = await supa
      .from('room_players')
      .update({ status: 'kicked', left_at: new Date().toISOString() })
      .eq('room_id', currentRoom.id)
      .eq('player_id', playerId);

    if (error) throw error;

    await getRoomPlayers();
    updatePlayersList();
    log(`👋 تم طرد ${playerName || playerId}`, 'success');
    return true;
  } catch (error) {
    console.error('Kick player error:', error);
    uiAlert(`❌ تعذّر الطرد: ${error.message}`);
    return false;
  }
}

// يُستدعى على جهاز اللاعب نفسه عندما يُطرد
async function handleKickedOut() {
  unsubscribeFromRoom();
  if (typeof hideChatUI === 'function') hideChatUI();

  // المطرود لا يُعاد تلقائياً عند تحديث الصفحة
  clearRoomSession();

  currentRoom = null;
  currentPlayer = null;
  roomPlayers = [];
  roomChatMessages = [];

  uiAlert('👋 تم إخراجك من الروم');
  showScreen('screen-home');
}

async function updateRoomGameState(updateData) {
  if (!currentRoom) return false;

  try {
    const { error } = await supa
      .from('room_game_state')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
        updated_by: currentPlayer.player_id
      })
      .eq('room_id', currentRoom.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Update game state error:', error);
    return false;
  }
}

async function updatePlayerScore(team, points) {
  if (!currentRoom) return false;

  try {
    // تحديث النقاط في room_players
    await supa
      .from('room_players')
      .update({ score: points })
      .eq('room_id', currentRoom.id)
      .eq('team', team);

    // تحديث حالة اللعبة
    const currentScores = roomGameState?.scores || { A: 0, B: 0 };
    currentScores[team] = points;

    await updateRoomGameState({
      scores: currentScores
    });

    return true;
  } catch (error) {
    console.error('Update player score error:', error);
    return false;
  }
}

/* ============================= REALTIME SUBSCRIPTIONS ============================= */

function subscribeToRoom(roomId) {
  if (!supa || !roomId) return;

  try {
    // اشتراك في حالة اللعبة
    roomSubscriptions.gameState = supa
      .channel(`room_state:${roomId}`)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_game_state',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          roomGameState = payload.new;
          // نطبّق حالة اللعب أولاً (تبني الجولات) ثم نحدّث العرض،
          // وإلا حاول العرض الرسم قبل وصول بيانات الجولات
          try {
            if (payload.new?.state_data) applyRemoteGameState(payload.new.state_data);
            updateGameDisplay();
          } catch (e) {
            console.error('تعذّر تطبيق حالة اللعبة:', e);
          }
          log('🔄 تحديث حالة اللعبة', 'info');
        }
      )
      .subscribe();

    // اشتراك في الرسائل
    roomSubscriptions.chat = supa
      .channel(`room_chat:${roomId}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_chat',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          // لا نضيف الرسالة مرتين للذاكرة (حتى لا تتكرر عند إعادة الرسم)
          if (!roomChatMessages.some(m => m.id === payload.new.id)) {
            roomChatMessages.push(payload.new);
          }
          displayChatMessage(payload.new);
          Sound.open();
        }
      )
      .subscribe();

    // اشتراك في لاعبي الروم
    roomSubscriptions.players = supa
      .channel(`room_players:${roomId}`)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_players',
          filter: `room_id=eq.${roomId}`
        },
        async () => {
          await getRoomPlayers();

          // إذا لم أعد ضمن اللاعبين النشطين فقد طُردت من الروم
          const stillIn = roomPlayers.some(p => p.player_id === currentPlayer?.player_id);
          if (currentPlayer && !stillIn) {
            await handleKickedOut();
            return;
          }

          updatePlayersList();
          log('🔄 تحديث قائمة اللاعبين', 'info');
        }
      )
      .subscribe();

    log('✅ تم الاشتراك في تحديثات الروم', 'success');
  } catch (error) {
    console.error('Subscribe to room error:', error);
  }
}

function unsubscribeFromRoom() {
  Object.values(roomSubscriptions).forEach(sub => {
    if (sub) sub.unsubscribe();
  });
  roomSubscriptions = {};
  log('✅ تم إلغاء الاشتراك في الروم', 'info');
}

/* ============================= UTILITY FUNCTIONS ============================= */

function generateRoomCode() {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARS.length));
  }
  return code;
}

function getDeviceId() {
  let deviceId = localStorage.getItem('mr_device_id');
  if (!deviceId) {
    deviceId = generateId();
    localStorage.setItem('mr_device_id', deviceId);
  }
  return deviceId;
}

/* ============================= UI UPDATE FUNCTIONS ============================= */

function updateGameDisplay() {
  if (!roomGameState) return;

  const scoreA = document.getElementById('scoreA');
  const scoreB = document.getElementById('scoreB');

  if (scoreA) scoreA.textContent = roomGameState.scores?.A || 0;
  if (scoreB) scoreB.textContent = roomGameState.scores?.B || 0;

  renderBoard();
}

function updatePlayersList() {
  if (!currentPlayer?.is_host) {
    // العرض العادي للاعبين (بدون توزيع)
    const playersList = document.getElementById('playersReadyUI');
    if (!playersList) return;

    const listDiv = document.getElementById('roomPlayersList2');
    if (listDiv) {
      listDiv.innerHTML = '';
      roomPlayers.forEach(player => {
        const playerDiv = createElement('div', { class: 'player-item' }, `
          <span class="player-name">${player.player_name}</span>
          <span class="player-team">${player.team ? `فريق ${player.team}` : '⏳ بانتظار التوزيع'}</span>
          <span class="player-score">${player.score}</span>
        `);
        listDiv.appendChild(playerDiv);
      });
    }
    document.getElementById('playersReadyUI').style.display = 'block';
    document.getElementById('teamDistributionUI').style.display = 'none';
  } else {
    // واجهة التوزيع للـ Host فقط
    const distUI = document.getElementById('teamDistributionUI');
    if (distUI) distUI.style.display = 'block';
    document.getElementById('playersReadyUI').style.display = 'none';

    const playersList = document.getElementById('roomPlayersList');
    if (playersList) {
      playersList.innerHTML = '';
      roomPlayers.forEach(player => {
        const isMe = player.player_id === currentPlayer.player_id;
        const safeName = escapeHtml(player.player_name || '');
        const playerDiv = createElement('div', { class: 'player-item' }, `
          <span class="player-name">${safeName}${isMe ? ' (أنت)' : ''}</span>
          <div class="team-buttons">
            <button class="team-btn ${player.team === 'A' ? 'selected' : ''}"
              onclick="assignPlayerToTeam('${player.player_id}', 'A')">فريق أ</button>
            <button class="team-btn ${player.team === 'B' ? 'selected' : ''}"
              onclick="assignPlayerToTeam('${player.player_id}', 'B')">فريق ب</button>
            ${isMe ? '' : `<button class="kick-btn" title="طرد من الروم"
              onclick="kickPlayer('${player.player_id}', '${safeName.replace(/'/g, "\\'")}')">🚫 طرد</button>`}
          </div>
        `);
        playersList.appendChild(playerDiv);
      });
    }
  }
}

function displayChatMessage(message) {
  const chatContainer = document.getElementById('roomChatMessages');
  if (!chatContainer) return;

  // منع تكرار نفس الرسالة إذا وصل الحدث أكثر من مرة
  if (message.id && chatContainer.querySelector(`[data-msg-id="${message.id}"]`)) {
    return;
  }

  const messageEl = createElement('div', {
    class: 'chat-message',
    'data-msg-id': message.id || ''
  }, `
    <div class="chat-msg-header">
      <span class="chat-sender">${escapeHtml(message.player_name)}</span>
    </div>
    <div class="chat-text">${escapeHtml(message.message)}</div>
    ${message.reactions && Object.keys(message.reactions).length > 0 ? `
      <div class="chat-reactions">
        ${Object.entries(message.reactions).map(([emoji, players]) =>
          `<span class="reaction">${emoji} ${players.length}</span>`
        ).join('')}
      </div>
    ` : ''}
  `);

  chatContainer.appendChild(messageEl);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
