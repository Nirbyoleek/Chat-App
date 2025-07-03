const socket = io();

// Elements

const $messageForm = document.querySelector("#message_form");
const $messageFormInput = $messageForm.querySelector("input");
const $messageFormButton = $messageForm.querySelector("button");
const $sendLocationButton = document.querySelector("#send_location");
const $messages = document.querySelector("#messages");
const $errorMessage = document.getElementById("error-message");
const $locationLoading = document.getElementById("location-loading");
const fileInput = document.getElementById('file_input');

// TEMPLATES
const messageTemplate = document.querySelector("#message-template").innerHTML;
const locationTemplate = document.querySelector("#location-template").innerHTML;
const sidebarTemplate = document.querySelector("#sidebar-template").innerHTML;
const fileTemplate = `<div class="file-message"><a href="{{url}}" target="_blank" rel="noopener"><img src="{{url}}" alt="file" style="max-width:180px;max-height:120px;border-radius:0.7em;box-shadow:0 2px 8px #7b5cbf22;display:{{isImage}};" onerror="this.style.display='none'"/><span style="display:{{isFile}};font-size:15px;">📄 {{name}}</span></a></div>`;

// OPTIONS
const { username, room } = Qs.parse(location.search, {
  ignoreQueryPrefix: true,
});

const autoscroll = () => {
  // New message element
  const $newMessage = $messages.lastElementChild;
  // Height of new message
  const newMessageStyles = getComputedStyle($newMessage);
  const newMessageMargin = parseInt(newMessageStyles.marginBottom);
  const newMessageHeight = $newMessage.offsetHeight + newMessageMargin;

  // Visible height
  const visibleHeight = $messages.offsetHeight;

  // Height of messages Container

  const containerHeight = $messages.scrollHeight;

  const scrollOffset = $messages.scrollTop + visibleHeight;

  if (containerHeight - newMessageHeight <= scrollOffset) {
    $messages.scrollTop = $messages.scrollHeight;
  }
};

// const autoscroll = () => {
//   $messages.scrollTop = $messages.scrollHeight;
// };

function stringToColor(str) {
  // Simple hash to color
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
}

function getAvatarSVG(username) {
  // Use different SVGs based on first letter
  const first = (username[0] || '').toUpperCase();
  if ('ABCDEFGHIJKLM'.includes(first)) {
    // Smiling face
    return `<svg width='22' height='22' viewBox='0 0 24 24' fill='none'><circle cx='12' cy='12' r='10' fill='white' fill-opacity='0.15'/><circle cx='12' cy='12' r='8' fill='white' fill-opacity='0.10'/><circle cx='9' cy='10' r='1' fill='white'/><circle cx='15' cy='10' r='1' fill='white'/><path d='M9 15c1.5 1 4.5 1 6 0' stroke='white' stroke-width='1.2' stroke-linecap='round'/></svg>`;
  } else if ('NOPQRSTUVWXYZ'.includes(first)) {
    // Sunglasses
    return `<svg width='22' height='22' viewBox='0 0 24 24' fill='none'><circle cx='12' cy='12' r='10' fill='white' fill-opacity='0.15'/><rect x='7' y='10' width='3' height='2' rx='1' fill='white'/><rect x='14' y='10' width='3' height='2' rx='1' fill='white'/><path d='M7 11h10' stroke='white' stroke-width='1.2'/><path d='M8.5 14c1.5 1 5.5 1 7 0' stroke='white' stroke-width='1.2' stroke-linecap='round'/></svg>`;
  } else {
    // Default user icon
    return `<svg width='22' height='22' viewBox='0 0 24 24' fill='none'><circle cx='12' cy='12' r='10' fill='white' fill-opacity='0.15'/><path d='M12 12c1.93 0 3.5-1.57 3.5-3.5S13.93 5 12 5 8.5 6.57 8.5 8.5 10.07 12 12 12zm0 2c-2.33 0-7 1.17-7 3.5V20h14v-2.5c0-2.33-4.67-3.5-7-3.5z' fill='white' fill-opacity='0.7'/></svg>`;
  }
}

function setAvatars() {
  document.querySelectorAll('.avatar[data-username]').forEach(el => {
    const username = el.getAttribute('data-username') || '';
    el.innerHTML = getAvatarSVG(username);
    el.style.background = `linear-gradient(135deg, ${stringToColor(username)} 60%, #7b5cbf 100%)`;
  });
}

function animateMessage($el) {
  $el.style.opacity = 0;
  $el.style.transform = 'translateY(20px) scale(0.97)';
  setTimeout(() => {
    $el.style.transition = 'opacity 0.4s, transform 0.4s';
    $el.style.opacity = 1;
    $el.style.transform = 'translateY(0) scale(1)';
  }, 10);
}

// Emoji support using twemoji
function renderEmojisInMessages() {
  if (window.twemoji) {
    document.querySelectorAll('.message p, .message__name').forEach(el => {
      el.innerHTML = window.twemoji.parse(el.innerHTML);
    });
  }
}

// Dark mode toggle
const darkModeToggle = document.getElementById('dark-mode-toggle');
function setDarkMode(on) {
  document.body.classList.toggle('dark-mode', on);
  darkModeToggle.textContent = on ? '☀️' : '🌙';
  localStorage.setItem('darkMode', on ? '1' : '0');
}
darkModeToggle.addEventListener('click', () => {
  setDarkMode(!document.body.classList.contains('dark-mode'));
});
// On load, set dark mode from localStorage
setDarkMode(localStorage.getItem('darkMode') === '1');

// Typing indicator
let typingTimeout;
const typingIndicator = document.createElement('div');
typingIndicator.id = 'typing-indicator';
typingIndicator.style = 'font-size:14px;color:#7b5cbf;margin:0 0 8px 12px;min-height:1.2em;';
$messages.parentNode.insertBefore(typingIndicator, $messages.nextSibling);

$messageFormInput.addEventListener('input', () => {
  $messageFormButton.disabled = !$messageFormInput.value.trim();
  socket.emit('typing', { room });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('stopTyping', { room });
  }, 1200);
});
socket.on('showTyping', ({ username: typingUser }) => {
  if (typingUser !== username) {
    typingIndicator.textContent = `${typingUser} is typing...`;
  }
});
socket.on('hideTyping', () => {
  typingIndicator.textContent = '';
});

const reactionsMap = new Map(); // key: message.createdAt, value: {emoji: count}

function renderReactionsBar($msg, createdAt) {
  const emojis = ['😀', '❤️', '👍'];
  const reactions = reactionsMap.get(createdAt) || {};
  const reactBar = document.createElement('div');
  reactBar.className = 'reactions-bar';
  reactBar.style.display = 'none';
  emojis.forEach(emoji => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'reaction-btn';
    btn.textContent = emoji + (reactions[emoji] ? ` ${reactions[emoji]}` : '');
    btn.onclick = (e) => {
      e.stopPropagation();
      const r = reactionsMap.get(createdAt) || {};
      r[emoji] = (r[emoji] || 0) + 1;
      reactionsMap.set(createdAt, r);
      renderReactionsBar($msg, createdAt); // re-render
    };
    reactBar.appendChild(btn);
  });
  // Remove old bar if exists
  const oldBar = $msg.querySelector('.reactions-bar');
  if (oldBar) oldBar.remove();
  $msg.appendChild(reactBar);
  $msg.addEventListener('mouseenter', () => { reactBar.style.display = 'block'; });
  $msg.addEventListener('mouseleave', () => { reactBar.style.display = 'none'; });
}

// Sound notification for new messages
const notificationSound = new Audio('https://cdn.jsdelivr.net/gh/saintplay/audio@master/notification.mp3');
let windowFocused = true;
window.addEventListener('focus', () => { windowFocused = true; });
window.addEventListener('blur', () => { windowFocused = false; });

function linkify(text) {
  const urlRegex = /(https?:\/\/[\w\-\.\/?#&=;%+~:,]+)/gi;
  return text.replace(urlRegex, url => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
}

// New messages indicator
const newMsgBtn = document.createElement('button');
newMsgBtn.textContent = 'New messages';
newMsgBtn.id = 'new-messages-btn';
newMsgBtn.style = 'position:fixed;bottom:90px;right:40px;z-index:1000;display:none;padding:10px 18px;font-size:15px;background:#7b5cbf;color:#fff;border:none;border-radius:1.2em;box-shadow:0 2px 8px #7b5cbf22;cursor:pointer;';
document.body.appendChild(newMsgBtn);
newMsgBtn.onclick = () => {
  $messages.scrollTop = $messages.scrollHeight;
  newMsgBtn.style.display = 'none';
};
function checkShowNewMsgBtn() {
  const atBottom = $messages.scrollHeight - $messages.scrollTop - $messages.offsetHeight < 40;
  if (!atBottom) {
    newMsgBtn.style.display = 'block';
  }
}
$messages.addEventListener('scroll', () => {
  const atBottom = $messages.scrollHeight - $messages.scrollTop - $messages.offsetHeight < 40;
  if (atBottom) {
    newMsgBtn.style.display = 'none';
  }
});

function isOwnMessage(username) {
  return username === window.username;
}

socket.on("message", (message) => {
  const isOwn = isOwnMessage(message.username);
  const html = Mustache.render(messageTemplate, {
    username: message.username,
    message: linkify(message.text),
    createdAt: moment(message.createdAt).format("h:mm a"),
  });
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const $msg = temp.firstElementChild;
  if (isOwn) $msg.classList.add('message--own');
  animateMessage($msg);
  $messages.appendChild($msg);
  setAvatars();
  renderEmojisInMessages();
  autoscroll();
  renderReactionsBar($msg, message.createdAt);
  // Edit/Delete for own messages
  if (isOwn) {
    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️';
    editBtn.className = 'msg-edit-btn';
    editBtn.title = 'Edit message';
    editBtn.onclick = () => {
      const newText = prompt('Edit your message:', message.text);
      if (newText !== null && newText.trim() !== '') {
        $msg.querySelector('.message__name').nextElementSibling.nextElementSibling.innerHTML = linkify(newText);
        renderEmojisInMessages();
      }
    };
    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️';
    delBtn.className = 'msg-del-btn';
    delBtn.title = 'Delete message';
    delBtn.onclick = () => {
      $msg.remove();
    };
    $msg.appendChild(editBtn);
    $msg.appendChild(delBtn);
  }
  if (!windowFocused) {
    notificationSound.currentTime = 0;
    notificationSound.play();
  }
  const atBottom = $messages.scrollHeight - $messages.scrollTop - $messages.offsetHeight < 40;
  if (!atBottom) {
    checkShowNewMsgBtn();
  }
});

socket.on("locationMessage", (url) => {
  const html = Mustache.render(locationTemplate, {
    username: url.username,
    url: linkify(url.link),
    createdAt: moment(url.createdAt).format("h:mm a"),
  });
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const $msg = temp.firstElementChild;
  animateMessage($msg);
  $messages.appendChild($msg);
  setAvatars();
  renderEmojisInMessages();
  autoscroll();
});

let currentOnlineUsers = [];
socket.on('onlineUsers', (usernames) => {
  currentOnlineUsers = usernames;
  updateSidebarOnlineStatus();
});
function updateSidebarOnlineStatus() {
  document.querySelectorAll('.users li .avatar[data-username]').forEach(el => {
    const username = el.getAttribute('data-username');
    let dot = el.querySelector('.status-dot');
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'status-dot';
      el.appendChild(dot);
    }
    if (currentOnlineUsers.includes(username)) {
      dot.style.background = '#4caf50';
      dot.title = 'Online';
    } else {
      dot.style.background = '#bbb';
      dot.title = 'Offline';
    }
  });
}
socket.emit('requestOnlineUsers');

socket.on("roomData", ({ room, users, admin }) => {
  console.log('Current user:', window.username, 'Admin:', admin); // Debug
  const html = Mustache.render(sidebarTemplate, {
    room,
    users,
    admin,
  });
  document.querySelector("#sidebar").innerHTML = html + `\
    <button id='share-room-link' class='sidebar-share-btn' style='margin:16px 0 8px 16px;'>🔗 Share Room Link</button>\
    <span id='share-room-tooltip' style='display:none;margin-left:12px;color:#7b5cbf;font-size:14px;'>Link copied!</span>\
    <button id='logout-btn' class='logout-btn sidebar-logout-btn'>🚪 Logout</button>\
  `;
  setAvatars();
  updateSidebarOnlineStatus();
  // Admin controls
  if (window.username === admin) {
    document.querySelectorAll('.users li').forEach(li => {
      const user = li.textContent.trim();
      if (user !== window.username) {
        const kickBtn = document.createElement('button');
        kickBtn.textContent = 'Kick';
        kickBtn.className = 'admin-btn';
        kickBtn.onclick = () => {
          if (confirm(`Kick ${user}?`)) socket.emit('kickUser', { room, username: user });
        };
        const banBtn = document.createElement('button');
        banBtn.textContent = 'Ban';
        banBtn.className = 'admin-btn';
        banBtn.onclick = () => {
          if (confirm(`Ban ${user}?`)) socket.emit('banUser', { room, username: user });
        };
        li.appendChild(kickBtn);
        li.appendChild(banBtn);
      }
    });
    // Clear chat button
    let clearBtn = document.getElementById('clear-chat-btn');
    if (!clearBtn) {
      clearBtn = document.createElement('button');
      clearBtn.id = 'clear-chat-btn';
      clearBtn.textContent = 'Clear Chat';
      clearBtn.className = 'admin-btn';
      clearBtn.style = 'margin:12px 0 0 0;width:90%;';
      clearBtn.onclick = () => {
        if (confirm('Clear all messages in this room?')) socket.emit('clearChat', { room });
      };
      document.querySelector('.chat__sidebar').appendChild(clearBtn);
    }
  }
  // Share room link logic
  const shareBtn = document.getElementById('share-room-link');
  const tooltip = document.getElementById('share-room-tooltip');
  if (shareBtn) {
    shareBtn.onclick = function() {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      const url = `${window.location.origin}/?room=${encodeURIComponent(roomParam || room || '')}`;
      navigator.clipboard.writeText(url).then(() => {
        tooltip.style.display = 'inline';
        setTimeout(() => { tooltip.style.display = 'none'; }, 1800);
      });
    };
  }
  // Logout button logic
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.onclick = function() {
      window.location.href = '/';
    };
  }
});
socket.on('kicked', () => {
  alert('You were kicked by the admin.');
  location.href = '/';
});
socket.on('banned', () => {
  alert('You were banned by the admin.');
  location.href = '/';
});
socket.on('clearChat', () => {
  $messages.innerHTML = '';
});

$messageFormInput.addEventListener("input", () => {
  $messageFormButton.disabled = !$messageFormInput.value.trim();
});

$messageForm.addEventListener("submit", (e) => {
  e.preventDefault();
  $errorMessage.textContent = "";
  $messageFormButton.setAttribute("disabled", "disabled");
  const message = e.target.elements.message.value;
  const file = fileInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      socket.emit('sendFile', {
        name: file.name,
        type: file.type,
        data: evt.target.result,
        message,
      }, (error) => {
        $messageFormButton.removeAttribute("disabled");
        $messageFormInput.value = "";
        fileInput.value = "";
        $messageFormInput.focus();
        if (error) {
          $errorMessage.textContent = error;
          return;
        }
        $errorMessage.textContent = "";
      });
    };
    reader.readAsDataURL(file);
    return;
  }
  socket.emit("sendMessage", message, (error) => {
    $messageFormButton.removeAttribute("disabled");
    $messageFormInput.value = "";
    $messageFormInput.focus();
    if (error) {
      $errorMessage.textContent = error;
      return;
    }
    $errorMessage.textContent = "";
  });
});
$sendLocationButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    $errorMessage.textContent = "Navigation is not supported by your browser";
    return;
  }
  $sendLocationButton.setAttribute("disabled", "disabled");
  $locationLoading.style.display = "inline";
  navigator.geolocation.getCurrentPosition((position) => {
    socket.emit(
      "sendLocation",
      {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
      (error) => {
        $sendLocationButton.removeAttribute("disabled");
        $locationLoading.style.display = "none";
        if (error) {
          $errorMessage.textContent = error;
          return;
        }
        $errorMessage.textContent = "";
      }
    );
  }, (err) => {
    $sendLocationButton.removeAttribute("disabled");
    $locationLoading.style.display = "none";
    $errorMessage.textContent = "Unable to fetch location.";
  });
});
socket.emit("join", { username, room }, (error) => {
  if (error) {
    alert(error);
    location.href = "/";
  }
});

socket.on('fileMessage', (fileMsg) => {
  const html = Mustache.render(fileTemplate, {
    url: fileMsg.url,
    name: fileMsg.name,
    isImage: fileMsg.type.startsWith('image/') ? 'block' : 'none',
    isFile: !fileMsg.type.startsWith('image/') ? 'inline' : 'none',
  });
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const $msg = temp.firstElementChild;
  animateMessage($msg);
  $messages.appendChild($msg);
  autoscroll();
});

// Set window.username from join parameters on page load
if (!window.username) {
  const params = Qs.parse(window.location.search, { ignoreQueryPrefix: true });
  window.username = params.username;
}
