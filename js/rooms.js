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

async function createRoom(roomName, mode = 'online') {
  if (!supa) {
    alert('❌ قاعدة البيانات غير متصلة');
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
      name: `أنت (${roomName})`,
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
    alert('❌ قاعدة البيانات غير متصلة');
    return false;
  }

  try {
    // البحث عن الروم بالكود
    const { data: roomData, error: roomError } = await supa
      .from('game_rooms')
      .select('*')
      .eq('code', roomCode.toUpperCase())
      .eq('status', 'waiting')
      .single();

    if (roomError) {
      alert('❌ الروم غير موجود أو مغلقة');
      return false;
    }

    if (!roomData) {
      alert('❌ الروم غير موجود');
      return false;
    }

    const playerId = generateId();
    currentRoom = roomData;
    currentPlayer = {
      id: playerId,
      name: playerName,
      player_id: playerId,
      device_id: getDeviceId(),
      team: null,
      is_host: false,
      score: 0
    };

    // إضافة اللاعب
    const { error: playerError } = await supa
      .from('room_players')
      .insert({
        room_id: roomData.id,
        player_id: playerId,
        player_name: playerName,
        device_id: currentPlayer.device_id,
        is_host: false,
        status: 'active'
      });

    if (playerError) throw playerError;

    log(`✅ دخلت إلى الروم: ${roomCode}`, 'success');
    subscribeToRoom(roomData.id);

    return true;
  } catch (error) {
    console.error('Join room error:', error);
    log(`❌ خطأ في دخول الروم: ${error.message}`, 'error');
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
    alert('❌ فقط صاحب الروم يمكنه توزيع الفرق');
    return false;
  }

  if (!['A', 'B'].includes(team)) {
    alert('❌ الفريق يجب أن يكون A أو B');
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
    alert('❌ فقط صاحب الروم يمكنه طرد اللاعبين');
    return false;
  }

  if (playerId === currentPlayer.player_id) {
    alert('❌ لا يمكنك طرد نفسك');
    return false;
  }

  if (!confirm(`طرد ${playerName || 'هذا اللاعب'} من الروم؟`)) return false;

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
    alert(`❌ تعذّر الطرد: ${error.message}`);
    return false;
  }
}

// يُستدعى على جهاز اللاعب نفسه عندما يُطرد
async function handleKickedOut() {
  unsubscribeFromRoom();
  if (typeof hideChatUI === 'function') hideChatUI();

  currentRoom = null;
  currentPlayer = null;
  roomPlayers = [];
  roomChatMessages = [];

  alert('👋 تم إخراجك من الروم');
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
