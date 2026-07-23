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

let isLoginMode = true;

const API_BASE = API_URL.replace(/\/api\/messages$/, '');

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission();
  }
}

function showNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: body,
      icon: 'zaw.png',
      badge: 'zaw.png'
    });
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
    el.textContent = content;
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