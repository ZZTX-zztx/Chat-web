// 简单前端聊天逻辑 + 下载按钮
const API_URL = 'https://chat.zztxer.dpdns.org/api/messages'; // 已配置为完整路径

const messagesEl = document.getElementById('messages');
const form = document.getElementById('inputForm');
const input = document.getElementById('input');

const downloadAndroidBtn = document.getElementById('downloadAndroid');
const downloadWindowsBtn = document.getElementById('downloadWindows');
const platformHint = document.getElementById('platformHint');
const downloadSection = document.querySelector('.download-after');
const authStatus = document.getElementById('authStatus');
const openLoginBtn = document.getElementById('openLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginModal = document.getElementById('loginModal');
const authForm = document.getElementById('authForm');
const authUsername = document.getElementById('authUsername');
const authPassword = document.getElementById('authPassword');
const authCancel = document.getElementById('authCancel');
const authError = document.getElementById('authError');
const authModalTitle = document.getElementById('authModalTitle');
const authModalDesc = document.getElementById('authModalDesc');
const authSubmit = document.getElementById('authSubmit');
const authSwitch = document.getElementById('authSwitch');

const btnAddMenu = document.getElementById('btnAddMenu');
const addMenuDropdown = document.getElementById('addMenuDropdown');
const sendImageBtn = document.getElementById('sendImageBtn');
const sendLocationBtn = document.getElementById('sendLocationBtn');
const sendFileBtn = document.getElementById('sendFileBtn');
const createGroupBtn = document.getElementById('createGroupBtn');
const fileInput = document.getElementById('fileInput');

const createGroupModal = document.getElementById('createGroupModal');
const createGroupForm = document.getElementById('createGroupForm');
const groupNameInput = document.getElementById('groupNameInput');
const cancelGroupBtn = document.getElementById('cancelGroupBtn');
const groupError = document.getElementById('groupError');

// Voice Message Elements
const btnVoice = document.getElementById('btnVoice');
const btnLockVoice = document.getElementById('btnLockVoice');
const btnSendVoice = document.getElementById('btnSendVoice');
const voiceRecordingOverlay = document.getElementById('voiceRecordingOverlay');
const voiceRecordingTime = document.getElementById('voiceRecordingTime');
const btnCancelRecording = document.getElementById('btnCancelRecording');
const btnLockRecording = document.getElementById('btnLockRecording');

let isLoginMode = true;

// Voice Recording Variables
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = 0;
let recordingTimer = null;
let audioContext = null;
let audioBuffer = null;
let isRecordingLocked = false;

const API_BASE = API_URL.replace(/\/api\/messages$/, '');

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission();
  }
}

function showNotification(title, body) {
  try {
    if (window.isLocalApp && window.pywebview && window.pywebview.api && typeof window.pywebview.api.showNotification === 'function') {
      window.pywebview.api.showNotification(title, body);
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: body,
        icon: 'zaw.png',
        badge: 'zaw.png'
      });
    }
  } catch (e) {
    console.log('通知失败:', e);
  }
}

function appendMessage(text, cls='bot'){
  const container = document.createElement('div');
  const isUser = cls === 'user';
  container.className = 'message-container' + (isUser ? ' user' : '');
  
  const el = document.createElement('div');
  el.className = 'msg ' + cls;
  el.textContent = text;
  container.appendChild(el);
  
  messagesEl.appendChild(container);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function isBase64Image(content) {
  return /^data:image\/(png|jpg|jpeg|gif|webp);base64,/i.test(content);
}

function parseLocationMessage(content) {
  if (!content.startsWith('[LOC]')) return null;
  const jsonStr = content.substring(5);
  
  let parsed = parseJsonSafely(jsonStr);
  if (parsed && parsed.lat && parsed.lng) {
    return parsed;
  }
  
  try {
    const latMatch = jsonStr.match(/"lat":\s*([-+]?\d*\.?\d+)/);
    const lngMatch = jsonStr.match(/"lng":\s*([-+]?\d*\.?\d+)/);
    const accMatch = jsonStr.match(/"acc":\s*(\d+)/);
    
    if (latMatch && lngMatch) {
      return {
        lat: parseFloat(latMatch[1]),
        lng: parseFloat(lngMatch[1]),
        acc: accMatch ? parseInt(accMatch[1]) : 1
      };
    }
  } catch (e) {
    console.error('解析位置消息失败:', e);
  }
  
  return null;
}

function parseFileMessage(content) {
  if (!content.startsWith('[FILE]')) return null;
  const jsonStr = content.substring(6);
  
  let parsed = parseJsonSafely(jsonStr);
  if (parsed && parsed.name) {
    return parsed;
  }
  
  try {
    const nameMatch = jsonStr.match(/"name":\s*["']?([^"',]+)["']?/);
    const sizeMatch = jsonStr.match(/"size":\s*(\d+)/);
    const mimeMatch = jsonStr.match(/"mime":\s*["']?([^"',]+)["']?/);
    const dataMatch = jsonStr.match(/"data":\s*["']?([^"',]+)["']?/);
    
    if (nameMatch) {
      return {
        name: nameMatch[1],
        size: sizeMatch ? parseInt(sizeMatch[1]) : 0,
        mime: mimeMatch ? mimeMatch[1] : 'application/octet-stream',
        data: dataMatch ? dataMatch[1] : ''
      };
    }
  } catch (e) {
    console.error('解析文件消息失败:', e);
  }
  
  return null;
}

function parseVoiceMessage(content) {
  if (!content.startsWith('[VOICE]')) return null;
  const jsonStr = content.substring(7);
  
  let parsed = parseJsonSafely(jsonStr);
  if (parsed && parsed.data) {
    return parsed;
  }
  
  try {
    const dataMatch = jsonStr.match(/"data":\s*["']?([^"',]+)["']?/);
    const durationMatch = jsonStr.match(/"duration":\s*(\d+)/);
    const sampleRateMatch = jsonStr.match(/"sampleRate":\s*(\d+)/);
    
    if (dataMatch) {
      return {
        data: dataMatch[1],
        duration: durationMatch ? parseInt(durationMatch[1]) : 0,
        sampleRate: sampleRateMatch ? parseInt(sampleRateMatch[1]) : 16000
      };
    }
  } catch (e) {
    console.error('解析语音消息失败:', e);
  }
  
  return null;
}

function fixInvalidEscapes(jsonStr) {
  let result = jsonStr;
  result = result.replace(/\\(?![\\"])/g, '/');
  result = result.replace(/\\\\/g, '\\');
  return result;
}

function parseJsonSafely(jsonStr) {
  try {
    return JSON.parse(jsonStr);
  } catch {
    try {
      const fixed = jsonStr.replace(/\\(?![\\"])/g, '/');
      return JSON.parse(fixed);
    } catch {
      try {
        const lines = jsonStr.split('\\n');
        let fixed = '';
        for (let i = 0; i < lines.length; i++) {
          if (i > 0) fixed += '\n';
          fixed += lines[i];
        }
        return JSON.parse(fixed);
      } catch {
        console.error('无法解析JSON:', jsonStr);
        return null;
      }
    }
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}'${secs.toString().padStart(2, '0')}"`;
  }
  return `${secs}"`;
}

function renderMessage(message){
  const container = document.createElement('div');
  container.dataset.messageId = message.id;
  const username = getUsername();
  const sender = message.sender || '系统';
  const isUser = sender === username || (!username && sender === '匿名用户');
  container.className = 'message-container' + (isUser ? ' user' : '');
  
  const senderEl = document.createElement('div');
  senderEl.className = 'message-sender';
  senderEl.textContent = sender;
  container.appendChild(senderEl);
  
  const el = document.createElement('div');
  const cls = isUser ? 'msg user' : 'msg bot';
  el.className = cls;
  
  const content = message.content ? message.content : '';
  if (message.deleted) {
    el.textContent = '[消息已撤回]';
    el.style.fontStyle = 'italic';
    el.style.opacity = '0.6';
  } else if (isBase64Image(content)) {
    el.innerHTML = `<img src="${content}" class="message-image" alt="图片消息" />`;
  } else {
    const voiceData = parseVoiceMessage(content);
    if (voiceData && voiceData.data) {
      const duration = voiceData.duration || 0;
      const durationStr = formatDuration(duration);
      el.innerHTML = `<div class="message-voice"><button class="voice-play-btn" data-voice="${voiceData.data}" data-samplerate="${voiceData.sampleRate || 16000}">▶</button><span class="voice-duration">🎤 ${durationStr}</span></div>`;
    } else {
      const locData = parseLocationMessage(content);
      if (locData && locData.lat && locData.lng) {
        const lat = locData.lat.toFixed(6);
        const lng = locData.lng.toFixed(6);
        const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        el.innerHTML = `📍 我的位置: ${lat}, ${lng}<br/><a href="${mapUrl}" target="_blank" class="location-link">(点击查看地图)</a>`;
      } else {
        const fileData = parseFileMessage(content);
        if (fileData && fileData.name) {
          const isImage = fileData.mime && fileData.mime.startsWith('image/');
          if (isImage && fileData.data) {
            const imgSrc = `data:${fileData.mime};base64,${fileData.data}`;
            el.innerHTML = `<img src="${imgSrc}" class="message-image" alt="${fileData.name}" />`;
          } else {
            const fileSize = formatFileSize(fileData.size || 0);
            el.innerHTML = `📁 ${fileData.name} (${fileSize})<br/><button class="download-file-btn" data-filename="${fileData.name}" data-mime="${fileData.mime || 'application/octet-stream'}" data-data="${fileData.data || ''}">点击保存并打开</button>`;
          }
        } else {
          el.textContent = content;
        }
      }
    }
  }
  
  if (isUser && !message.deleted && message.id) {
    const now = Date.now();
    const messageTime = message.timestamp ? parseInt(message.timestamp) : now;
    const diff = now - messageTime;
    
    if (diff < 20000) {
      const recallBtn = document.createElement('button');
      recallBtn.className = 'recall-btn';
      recallBtn.textContent = '撤回';
      recallBtn.addEventListener('click', () => recallMessage(message.id));
      el.appendChild(recallBtn);
      
      setTimeout(() => {
        if (recallBtn.parentNode) {
          recallBtn.remove();
        }
      }, 20000 - diff);
    }
  }
  
  container.appendChild(el);
  messagesEl.appendChild(container);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function clearMessages(){
  messagesEl.innerHTML = '';
}

async function recallMessage(messageId){
  try{
    const headers = {'Content-Type':'application/json'};
    const token = getToken();
    if(token) headers['Authorization'] = 'Bearer ' + token;

    const resp = await fetch(`${API_BASE}/api/messages/${messageId}/recall`, {
      method: 'POST',
      headers
    });

    if(resp.status === 401){
      setToken(null);
      openLogin();
      return;
    }

    if(!resp.ok) throw new Error('撤回失败');
    const data = await resp.json();
    if(data.ok){
      await loadMessages();
    } else {
      appendMessage(data.error || '撤回失败', 'bot');
    }
  }catch(e){
    appendMessage('撤回失败：' + e.message, 'bot');
  }
}

let lastMessageCount = 0;

async function loadMessages(){
  try{
    const headers = {'Content-Type':'application/json'};
    const token = getToken();
    if(token) headers['Authorization'] = 'Bearer ' + token;

    const resp = await fetch(API_URL, { method: 'GET', headers });

    if(resp.status === 401){
      setToken(null);
      openLogin();
      return;
    }

    if(!resp.ok) throw new Error('无法拉取消息');
    const data = await resp.json();
    if(data.ok && Array.isArray(data.messages)){
      const newMessageCount = data.messages.length;
      const hasNewMessages = newMessageCount > lastMessageCount && lastMessageCount > 0;
      
      clearMessages();
      if(data.messages.length === 0){
        appendMessage('当前没有云端消息。请输入消息并发送。', 'bot');
      } else {
        data.messages.forEach(renderMessage);
        
        if(hasNewMessages){
          const latestMessage = data.messages[data.messages.length - 1];
          const sender = latestMessage.sender || '系统';
          const content = latestMessage.content || '[消息]';
          showNotification(`${sender} 发来消息`, content);
        }
      }
      
      lastMessageCount = newMessageCount;
    } else {
      clearMessages();
      appendMessage('消息同步失败，请稍后重试。', 'bot');
    }
    
    setTimeout(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }, 50);
  }catch(e){
    clearMessages();
    appendMessage('同步失败：' + e.message, 'bot');
  }
}

async function sendToApi(message){
  try{
    const headers = {'Content-Type':'application/json'};
    const token = getToken();
    if(token) headers['Authorization'] = 'Bearer ' + token;

    const sender = getUsername();
    
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({content: message, sender: sender || '匿名用户'})
    });

    if(resp.status === 401){
      setToken(null);
      openLogin();
      return { error: '未授权，请登录后重试' };
    }

    if(!resp.ok) throw new Error('Network response not ok');
    const data = await resp.json();
    if(data.ok){
      await loadMessages();
      return { success: true };
    }
    return { error: data.error || '发送失败' };
  }catch(e){
    return { error: '请求失败：' + e.message };
  }
}

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const text = input.value.trim();
  if(!text) return;
  appendMessage(text, 'user');
  input.value = '';
  appendMessage('正在发送…', 'bot');
  const result = await sendToApi(text);
  const last = messagesEl.querySelector('.msg.bot:last-child');
  if(last && last.textContent==='正在发送…') last.remove();
  if(result.error){
    appendMessage(result.error, 'bot');
  }
});

// 平台检测与下载处理
function detectPlatform(){
  const ua = navigator.userAgent || '';
  if(/android/i.test(ua)) return 'android';
  if(/windows|win32|win64/i.test(ua)) return 'windows';
  return 'other';
}

function isMobile(){
  const ua = navigator.userAgent || '';
  return /android|iphone|ipad|ipod|mobile|tablet/i.test(ua);
}

function isLocalApp(){
  const params = new URLSearchParams(window.location.search);
  return params.get('app') === 'local';
}

function getLocalPlatform(){
  const params = new URLSearchParams(window.location.search);
  return params.get('platform') || 'windows';
}

function openDownloadFor(platform){
  if(platform === 'android'){
    window.open('https://chat-apk.zztxer.dpdns.org/download', '_blank');
  } else if(platform === 'windows'){
    window.open('https://chat-windows.zztxer.dpdns.org/download', '_blank');
  } else {
    const choose = confirm('检测不到明确平台，是否前往 Android 版本？点击取消前往 Windows 版本。');
    window.open(choose ? 'https://chat-apk.zztxer.dpdns.org/download' : 'https://chat-windows.zztxer.dpdns.org/download', '_blank');
  }
}

downloadAndroidBtn.addEventListener('click', ()=> openDownloadFor('android'))
downloadWindowsBtn.addEventListener('click', ()=> openDownloadFor('windows'))

document.addEventListener('DOMContentLoaded', function() {
  const platform = detectPlatform();
  const mobile = isMobile();
  const localApp = isLocalApp();
  const localPlatform = getLocalPlatform();

  if (localApp && downloadSection) {
    downloadSection.style.display = 'none';
    console.log('检测到本地应用 - 已隐藏下载区域');
    window.isLocalApp = true;
    window.localAppPlatform = localPlatform;
  } else if (mobile && platform === 'android') {
    if (platformHint) {
      platformHint.textContent = '检测到：Android 设备';
    }
    downloadWindowsBtn.style.display = 'none';
    console.log('检测到Android移动端 - 仅显示Android下载');
  } else if (mobile && platform !== 'android') {
    downloadSection.style.display = 'none';
    console.log('检测到非Android移动端 - 隐藏下载区域');
  } else {
    if (platformHint) {
      platformHint.textContent = platform === 'android' ? '检测到：Android 设备' : platform === 'windows' ? '检测到：Windows 电脑' : '检测不到明确平台，请手动选择下载';
    }

    if (platform === 'windows') {
      downloadAndroidBtn.style.display = 'none';
    } else if (platform === 'android') {
      downloadWindowsBtn.style.display = 'none';
    }
  }
});

// --- Auth: show modal if no token ---
function getToken(){
  return localStorage.getItem('auth_token');
}

function getUsername(){
  return localStorage.getItem('auth_username');
}

function setToken(token, username){
  if(token){
    localStorage.setItem('auth_token', token);
    if(username) localStorage.setItem('auth_username', username);
  } else {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_username');
  }
  updateAuthStatus();
}

function updateAuthStatus(){
  const t = getToken();
  const username = getUsername();
  authStatus.textContent = t ? `已登录${username ? '：' + username : ''}` : '未登录';
  authStatus.classList.toggle('logged', !!t);
  if(openLoginBtn){
    openLoginBtn.style.display = t ? 'none' : 'inline-flex';
  }
  if(logoutBtn){
    logoutBtn.style.display = t ? 'inline-flex' : 'none';
  }
}

function logout(){
  setToken(null);
  clearMessages();
  appendMessage('已退出登录，请重新登录。', 'bot');
  openLogin();
}

if(logoutBtn){
  logoutBtn.addEventListener('click', logout);
}

function openLogin(){
  isLoginMode = true;
  authError.textContent = '';
  authUsername.value = '';
  authPassword.value = '';
  authModalTitle.textContent = '登录';
  authModalDesc.textContent = '请输入你的用户名和密码';
  authSubmit.textContent = '登录';
  authSwitch.textContent = '还没有账号？点击注册';
  if (loginModal) {
    loginModal.classList.add('show');
    loginModal.setAttribute('aria-hidden', 'false');
  }
}

function openRegister(){
  isLoginMode = false;
  authError.textContent = '';
  authUsername.value = '';
  authPassword.value = '';
  authModalTitle.textContent = '注册';
  authModalDesc.textContent = '请设置你的用户名和密码';
  authSubmit.textContent = '注册';
  authSwitch.textContent = '已有账号？点击登录';
  if (loginModal) {
    loginModal.classList.add('show');
    loginModal.setAttribute('aria-hidden', 'false');
  }
}

function closeLogin(){
  if (loginModal) {
    loginModal.classList.remove('show');
    loginModal.setAttribute('aria-hidden', 'true');
  }
}

function toggleAuthMode(){
  if(isLoginMode){
    openRegister();
  } else {
    openLogin();
  }
}

if (openLoginBtn) {
  openLoginBtn.addEventListener('click', () => openLogin());
}

if (authCancel) {
  authCancel.addEventListener('click', () => closeLogin());
}

if (authSwitch) {
  authSwitch.addEventListener('click', toggleAuthMode);
}

if (loginModal) {
  loginModal.addEventListener('click', (e) => {
    if (e.target === loginModal) closeLogin();
  });
}

authForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  authError.textContent = '';
  const username = authUsername.value.trim();
  const password = authPassword.value;
  if(!username || !password){ 
    authError.textContent = '用户名与密码不能为空'; 
    return; 
  }
  
  if(!isLoginMode && username.length < 3){
    authError.textContent = '用户名至少需要3个字符';
    return;
  }
  
  if(password.length < 6){
    authError.textContent = '密码至少需要6个字符';
    return;
  }
  
  try{
    const endpoint = isLoginMode ? '/api/login' : '/api/register';
    const resp = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({username, password})
    });
    const data = await resp.json();
    if(resp.ok && data.ok && data.token){
      setToken(data.token, username);
      closeLogin();
      updateAuthStatus();
      await loadMessages();
      startMessageRefresh();
    } else {
      authError.textContent = data.error || (isLoginMode ? '登录失败' : '注册失败');
    }
  }catch(err){ 
    authError.textContent = '网络错误：' + err.message 
  }
});

let messageRefreshInterval = null;

function startMessageRefresh() {
  if (messageRefreshInterval) {
    clearInterval(messageRefreshInterval);
  }
  messageRefreshInterval = setInterval(() => {
    if (getToken()) {
      loadMessages();
    }
  }, 1000);
}

function stopMessageRefresh() {
  if (messageRefreshInterval) {
    clearInterval(messageRefreshInterval);
    messageRefreshInterval = null;
  }
}

// Request notification permission on load
requestNotificationPermission();

// show login modal when no token
updateAuthStatus();

if(!getToken()) {
  setTimeout(() => openLogin(), 120);
} else {
  loadMessages();
  startMessageRefresh();
}

// Add Menu Functions
function toggleAddMenu() {
  addMenuDropdown.classList.toggle('show');
}

function hideAddMenu() {
  addMenuDropdown.classList.remove('show');
}

function sendFile(type) {
  if (type === 'image') {
    fileInput.accept = 'image/*';
  } else {
    fileInput.accept = '*/*';
  }
  fileInput.click();
}

async function sendLocation() {
  const token = getToken();
  if (!token) {
    alert('请先登录');
    return;
  }
  
  hideAddMenu();
  
  if (!navigator.geolocation) {
    appendMessage('您的浏览器不支持获取位置信息', 'bot');
    return;
  }
  
  appendMessage('正在获取位置...', 'bot');
  
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = position.coords.accuracy || 1;
      
      try {
        const locationData = {
          lat: lat,
          lng: lng,
          acc: accuracy
        };
        const content = `[LOC]${JSON.stringify(locationData)}`;
        
        const result = await sendToApi(content);
        
        const lastMsg = messagesEl.querySelector('.msg.bot:last-child');
        if (lastMsg && lastMsg.textContent.includes('正在获取位置')) {
          lastMsg.remove();
        }
        
        if (result.error) {
          appendMessage('发送位置失败: ' + result.error, 'bot');
        }
      } catch (error) {
        const lastMsg = messagesEl.querySelector('.msg.bot:last-child');
        if (lastMsg && lastMsg.textContent.includes('正在获取位置')) {
          lastMsg.remove();
        }
        appendMessage('发送位置失败: ' + error.message, 'bot');
      }
    },
    (error) => {
      const lastMsg = messagesEl.querySelector('.msg.bot:last-child');
      if (lastMsg && lastMsg.textContent.includes('正在获取位置')) {
        lastMsg.remove();
      }
      
      let errorMsg = '获取位置失败';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMsg = '位置权限被拒绝，请在浏览器设置中允许获取位置';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMsg = '位置信息不可用';
          break;
        case error.TIMEOUT:
          errorMsg = '获取位置超时';
          break;
      }
      appendMessage(errorMsg, 'bot');
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const token = getToken();
  if (!token) {
    alert('请先登录');
    return;
  }
  
  hideAddMenu();
  
  appendMessage(`正在发送文件: ${file.name}`, 'bot');
  
  const reader = new FileReader();
  reader.onload = async function(e) {
    const base64Data = e.target.result.split(',')[1];
    
    try {
      const fileData = {
        name: file.name,
        size: file.size,
        mime: file.type || 'application/octet-stream',
        data: base64Data
      };
      const content = `[FILE]${JSON.stringify(fileData)}`;
      
      const result = await sendToApi(content);
      
      const lastMsg = messagesEl.querySelector('.msg.bot:last-child');
      if (lastMsg && lastMsg.textContent.includes('正在发送')) {
        lastMsg.remove();
      }
      
      if (result.error) {
        appendMessage('文件发送失败: ' + result.error, 'bot');
      }
    } catch (error) {
      const lastMsg = messagesEl.querySelector('.msg.bot:last-child');
      if (lastMsg && lastMsg.textContent.includes('正在发送')) {
        lastMsg.remove();
      }
      appendMessage('文件发送失败: ' + error.message, 'bot');
    }
    
    fileInput.value = '';
  };
  
  if (file.size > 5 * 1024 * 1024) {
    appendMessage('文件过大，最大支持5MB', 'bot');
    fileInput.value = '';
    return;
  }
  
  reader.readAsDataURL(file);
}

// Add Menu Event Listeners
btnAddMenu?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleAddMenu();
});

sendImageBtn?.addEventListener('click', () => {
  sendFile('image');
});

sendLocationBtn?.addEventListener('click', () => {
  sendLocation();
});

sendFileBtn?.addEventListener('click', () => {
  sendFile('file');
});

fileInput?.addEventListener('change', handleFileSelect);

// Close menu when clicking outside
document.addEventListener('click', (e) => {
  if (!btnAddMenu?.contains(e.target) && !addMenuDropdown?.contains(e.target)) {
    hideAddMenu();
  }
  
  // Handle file download button click
  if (e.target.classList.contains('download-file-btn')) {
    const btn = e.target;
    const filename = btn.dataset.filename;
    const mime = btn.dataset.mime;
    const data = btn.dataset.data;
    
    if (filename && data) {
      downloadFile(filename, mime, data);
    }
  }
});

async function downloadFile(filename, mime, base64Data) {
  try {
    if (window.isLocalApp && window.pywebview && window.pywebview.api) {
      const result = await window.pywebview.api.downloadFile(filename, mime, base64Data);
      if (result.success) {
        console.log('文件已保存:', result.path);
      } else {
        alert('下载失败: ' + result.error);
      }
    } else {
      const byteString = atob(base64Data);
      const byteArray = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        byteArray[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: mime });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('下载文件失败:', error);
    alert('下载文件失败: ' + error.message);
  }
}

// Voice Message Functions
async function startVoiceRecording() {
  const token = getToken();
  if (!token) {
    alert('请先登录');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    recordingStartTime = Date.now();

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
      
      if (duration < 1) {
        appendMessage('录音时间过短，请重试', 'bot');
        resetVoiceUI();
        return;
      }

      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const base64Data = e.target.result.split(',')[1];
        
        const voiceData = {
          data: base64Data,
          duration: duration,
          sampleRate: 16000
        };
        const content = `[VOICE]${JSON.stringify(voiceData)}`;
        
        appendMessage('正在发送语音...', 'bot');
        const result = await sendToApi(content);
        
        const lastMsg = messagesEl.querySelector('.msg.bot:last-child');
        if (lastMsg && lastMsg.textContent.includes('正在发送语音')) {
          lastMsg.remove();
        }
        
        if (result.error) {
          appendMessage('语音发送失败: ' + result.error, 'bot');
        }
      };
      
      reader.readAsDataURL(audioBlob);
    };

    mediaRecorder.start(100);
    btnVoice.classList.add('recording');
    voiceRecordingOverlay.style.display = 'flex';
    updateRecordingTimer();
    
  } catch (error) {
    console.error('录音失败:', error);
    if (error.name === 'NotAllowedError') {
      alert('麦克风权限被拒绝，请在浏览器设置中允许访问麦克风');
    } else {
      alert('录音失败: ' + error.message);
    }
  }
}

function toggleLockRecording() {
  isRecordingLocked = !isRecordingLocked;
  
  if (isRecordingLocked) {
    btnLockVoice.classList.add('locked');
    btnVoice.classList.add('locked');
    btnVoice.classList.remove('recording');
    btnVoice.textContent = '🔓';
    btnSendVoice.style.display = 'block';
    voiceRecordingOverlay.style.display = 'none';
  } else {
    resetVoiceUI();
  }
}

function resetVoiceUI() {
  isRecordingLocked = false;
  btnLockVoice.classList.remove('locked');
  btnVoice.classList.remove('locked', 'recording');
  btnVoice.textContent = '🎤';
  btnSendVoice.style.display = 'none';
  voiceRecordingOverlay.style.display = 'none';
  
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
}

function updateRecordingTimer() {
  recordingTimer = setInterval(() => {
    const elapsed = Date.now() - recordingStartTime;
    const seconds = Math.floor(elapsed / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    voiceRecordingTime.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, 1000);
}

function stopVoiceRecording(send = true) {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    if (send) {
      mediaRecorder.stop();
    } else {
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      mediaRecorder = null;
      audioChunks = [];
    }
  }
  
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  
  if (!isRecordingLocked) {
    btnVoice.classList.remove('recording');
    voiceRecordingOverlay.style.display = 'none';
  }
}

function cancelVoiceRecording() {
  stopVoiceRecording(false);
  resetVoiceUI();
}

function sendVoiceMessage() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  resetVoiceUI();
}

async function playVoiceMessage(base64Data, sampleRate) {
  try {
    const byteString = atob(base64Data);
    const byteArray = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      byteArray[i] = byteString.charCodeAt(i);
    }
    
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const audioBuffer = await audioContext.decodeAudioData(byteArray.buffer);
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start(0);
  } catch (error) {
    console.error('播放语音失败:', error);
    alert('播放语音失败: ' + error.message);
  }
}

// Voice Message Event Listeners
btnVoice?.addEventListener('mousedown', (e) => {
  e.preventDefault();
  if (!isRecordingLocked) {
    startVoiceRecording();
  }
});

btnVoice?.addEventListener('mouseup', () => {
  if (!isRecordingLocked) {
    stopVoiceRecording();
  }
});

btnVoice?.addEventListener('mouseleave', () => {
  if (!isRecordingLocked) {
    stopVoiceRecording();
  }
});

btnVoice?.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (!isRecordingLocked) {
    startVoiceRecording();
  }
}, { passive: false });

btnVoice?.addEventListener('touchend', () => {
  if (!isRecordingLocked) {
    stopVoiceRecording();
  }
});

btnLockVoice?.addEventListener('click', () => {
  if (!isRecordingLocked && !mediaRecorder) {
    startVoiceRecording();
    toggleLockRecording();
  } else if (isRecordingLocked) {
    toggleLockRecording();
  }
});

btnSendVoice?.addEventListener('click', sendVoiceMessage);

btnCancelRecording?.addEventListener('click', cancelVoiceRecording);

btnLockRecording?.addEventListener('click', () => {
  toggleLockRecording();
});

// Create Group Functions
function openCreateGroupModal() {
  groupError.textContent = '';
  groupNameInput.value = '';
  createGroupModal.classList.add('show');
  createGroupModal.setAttribute('aria-hidden', 'false');
}

function closeCreateGroupModal() {
  createGroupModal.classList.remove('show');
  createGroupModal.setAttribute('aria-hidden', 'true');
}

async function createGroup(groupName) {
  const token = getToken();
  if (!token) {
    alert('请先登录');
    return;
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    };

    const resp = await fetch(`${API_BASE}/api/groups`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: groupName,
        memberIds: []
      })
    });

    if (resp.status === 401) {
      setToken(null);
      openLogin();
      return;
    }

    const data = await resp.json();
    
    if (resp.ok && data.success) {
      appendMessage(`群聊「${groupName}」创建成功！`, 'bot');
      closeCreateGroupModal();
      hideAddMenu();
    } else {
      groupError.textContent = data.message || '创建群聊失败';
    }
  } catch (error) {
    console.error('创建群聊失败:', error);
    groupError.textContent = '创建群聊失败: ' + error.message;
  }
}

// Create Group Event Listeners
createGroupBtn?.addEventListener('click', () => {
  openCreateGroupModal();
  hideAddMenu();
});

cancelGroupBtn?.addEventListener('click', closeCreateGroupModal);

createGroupForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  groupError.textContent = '';
  
  const groupName = groupNameInput.value.trim();
  if (!groupName) {
    groupError.textContent = '请输入群名称';
    return;
  }

  await createGroup(groupName);
});

createGroupModal?.addEventListener('click', (e) => {
  if (e.target === createGroupModal) {
    closeCreateGroupModal();
  }
});

// Handle voice play button click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('voice-play-btn')) {
    const btn = e.target;
    const voiceData = btn.dataset.voice;
    const sampleRate = parseInt(btn.dataset.samplerate) || 16000;
    
    if (voiceData) {
      btn.classList.add('playing');
      btn.textContent = '⏸';
      
      playVoiceMessage(voiceData, sampleRate).then(() => {
        btn.classList.remove('playing');
        btn.textContent = '▶';
      }).catch(() => {
        btn.classList.remove('playing');
        btn.textContent = '▶';
      });
    }
  }
});