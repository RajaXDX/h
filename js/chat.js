/* ============================= CHAT SYSTEM ============================= */

let chatOpen = false;

/* ============================= SEND MESSAGE ============================= */

async function sendChatMessage(messageText) {
  if (!currentRoom || !currentPlayer) {
    alert('❌ يجب أن تكون في روم أولاً');
    return false;
  }

  if (!messageText || messageText.trim().length === 0) {
    return false;
  }

  try {
    const { error } = await supa
      .from('room_chat')
      .insert({
        room_id: currentRoom.id,
        player_id: currentPlayer.player_id,
        player_name: currentPlayer.name,
        message: messageText.trim(),
        reactions: {}
      });

    if (error) throw error;

    // مسح حقل الإدخال
    const input = document.getElementById('chatInput');
    if (input) input.value = '';

    return true;
  } catch (error) {
    console.error('Send message error:', error);
    log(`❌ خطأ في إرسال الرسالة: ${error.message}`, 'error');
    return false;
  }
}

/* ============================= ADD REACTION ============================= */

async function addReaction(messageId, emoji) {
  if (!supa) return false;

  try {
    // جلب الرسالة
    const { data: message, error: fetchError } = await supa
      .from('room_chat')
      .select('reactions')
      .eq('id', messageId)
      .single();

    if (fetchError) throw fetchError;

    const reactions = message?.reactions || {};

    // إضافة أو إزالة التفاعل
    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }

    if (!reactions[emoji].includes(currentPlayer.player_id)) {
      reactions[emoji].push(currentPlayer.player_id);
    } else {
      // إزالة التفاعل إذا كان موجوداً
      reactions[emoji] = reactions[emoji].filter(
        id => id !== currentPlayer.player_id
      );

      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    }

    // تحديث الرسالة
    const { error: updateError } = await supa
      .from('room_chat')
      .update({ reactions })
      .eq('id', messageId);

    if (updateError) throw updateError;

    return true;
  } catch (error) {
    console.error('Add reaction error:', error);
    return false;
  }
}

/* ============================= LOAD CHAT MESSAGES ============================= */

async function loadChatMessages() {
  if (!currentRoom) return [];

  try {
    const { data, error } = await supa
      .from('room_chat')
      .select('*')
      .eq('room_id', currentRoom.id)
      .order('created_at', { ascending: true })
      .limit(50); // آخر 50 رسالة

    if (error) throw error;

    roomChatMessages = data || [];
    renderChatMessages();

    return roomChatMessages;
  } catch (error) {
    console.error('Load chat messages error:', error);
    return [];
  }
}

/* ============================= RENDER CHAT ============================= */

function renderChatMessages() {
  const chatContainer = document.getElementById('roomChatMessages');
  if (!chatContainer) return;

  chatContainer.innerHTML = '';

  roomChatMessages.forEach(msg => {
    const messageEl = createElement('div', { class: 'chat-message' }, `
      <div class="chat-header">
        <span class="chat-sender">${escapeHtml(msg.player_name)}</span>
        <span class="chat-time">${formatTime(msg.created_at)}</span>
      </div>
      <div class="chat-text">${escapeHtml(msg.message)}</div>
      ${msg.reactions && Object.keys(msg.reactions).length > 0 ? `
        <div class="chat-reactions">
          ${Object.entries(msg.reactions).map(([emoji, players]) =>
            `<button class="reaction-btn" onclick="addReaction('${msg.id}', '${emoji}')"
              title="${players.join(', ')}">
              ${emoji} <span>${players.length}</span>
            </button>`
          ).join('')}
        </div>
      ` : ''}
    `);

    chatContainer.appendChild(messageEl);
  });

  // التمرير إلى آخر رسالة
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

/* ============================= TOGGLE CHAT ============================= */

function toggleChat() {
  const chatPanel = document.getElementById('chatPanel');
  if (!chatPanel) {
    createChatPanel();
    return;
  }

  chatOpen = !chatOpen;
  if (chatOpen) {
    chatPanel.classList.add('open');
    const input = document.getElementById('chatInput');
    if (input) input.focus();
  } else {
    chatPanel.classList.remove('open');
  }
}

/* ============================= CREATE CHAT PANEL ============================= */

function createChatPanel() {
  if (!document.getElementById('chatPanel')) {
    const panel = createElement('div', { id: 'chatPanel', class: 'chat-panel' }, `
      <div class="chat-header">
        <h3>💬 الشات</h3>
        <button class="chat-close" onclick="toggleChat()">✕</button>
      </div>
      <div class="chat-messages" id="roomChatMessages"></div>
      <div class="chat-input-area">
        <input type="text" id="chatInput" class="chat-input" placeholder="Enter للإرسال...">
        <button class="chat-send-btn" id="chatSendBtn">إرسال</button>
      </div>
    `);

    document.body.appendChild(panel);

    // الاستماع للـ Enter و click button
    const chatInput = document.getElementById('chatInput');
    const chatSendBtn = document.getElementById('chatSendBtn');

    const sendMsg = () => {
      const msg = chatInput.value;
      if (msg.trim()) {
        sendChatMessage(msg);
        chatInput.value = '';
      }
    };

    if (chatInput) {
      // Enter للإرسال
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMsg();
        }
      });

      // تحديث حالة الزر عند الكتابة
      chatInput.addEventListener('input', (e) => {
        const btn = document.getElementById('chatSendBtn');
        if (btn) {
          btn.style.opacity = e.target.value.trim() ? '1' : '0.5';
          btn.style.cursor = e.target.value.trim() ? 'pointer' : 'not-allowed';
        }
      });
    }

    // الزر يرسل أيضاً
    if (chatSendBtn) {
      chatSendBtn.addEventListener('click', sendMsg);
    }

    loadChatMessages();
  }

  toggleChat();
}

/* ============================= EMOJI PICKER (بسيط) ============================= */

function showEmojiPicker(messageId) {
  const emojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '💯', '✨'];

  const picker = document.createElement('div');
  picker.className = 'emoji-picker';

  emojis.forEach(emoji => {
    const btn = document.createElement('button');
    btn.textContent = emoji;
    btn.onclick = () => {
      addReaction(messageId, emoji);
      picker.remove();
    };
    picker.appendChild(btn);
  });

  document.body.appendChild(picker);

  setTimeout(() => picker.remove(), 5000);
}

/* ============================= UTILITY FUNCTIONS ============================= */

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}
