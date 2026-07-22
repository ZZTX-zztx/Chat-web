// 简单前端聊天逻辑 + 下载按钮
const API_URL = 'https://chat.zztxer.dpdns.org/api/messages'; // 已配置为完整路径

const messagesEl = document.getElementById('messages');
const form = document.getElementById('inputForm');
const input = document.getElementById('input');

const downloadAndroidBtn = document.getElementById('downloadAndroid');
const downloadWindowsBtn = document.getElementById('downloadWindows');
const platformHint = document.getElementById('platformHint');
const authStatus = document.getElementById('authStatus');
const openLoginBtn = document.getElementById('openLoginBtn');
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const loginCancel = document.getElementById('loginCancel');
const loginError = document.getElementById('loginError');

const API_BASE = API_URL.replace(/\/api\/messages$/, '');

function appendMessage(text, cls='bot'){
  const el = document.createElement('div');
  el.className = 'msg ' + cls;
  el.textContent = text;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderMessage(message){
  const el = document.createElement('div');
  const cls = message.sender === getUsername() ? 'msg user' : 'msg bot';
  el.className = cls;
  const sender = message.sender ? message.sender : '系统';
  const content = message.content ? message.content : '';
  el.innerHTML = `<div class="message-sender">${sender}</div><div>${content}</div>`;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function clearMessages(){
  messagesEl.innerHTML = '';
}

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
      clearMessages();
      if(data.messages.length === 0){
        appendMessage('当前没有云端消息。请输入消息并发送。', 'bot');
      } else {
        data.messages.forEach(renderMessage);
      }
    } else {
      clearMessages();
      appendMessage('消息同步失败，请稍后重试。', 'bot');
    }
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

    const resp = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({content: message, sender: getUsername() || '匿名用户'})
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

function openDownloadFor(platform){
  if(platform === 'android'){
    // 跳转到 Android 域名（可根据需要改为具体 apk 路径）
    window.location.href = 'https://chat-apk.zztxer.dpdns.org';
  } else if(platform === 'windows'){
    window.location.href = 'https://chat-windows.zztxer.dpdns.org';
  } else {
    // 弹出选择
    const choose = confirm('检测不到明确平台，是否前往 Android 版本？点击取消前往 Windows 版本。');
    window.location.href = choose ? 'https://chat-apk.zztxer.dpdns.org' : 'https://chat-windows.zztxer.dpdns.org';
  }
}

downloadAndroidBtn.addEventListener('click', ()=> openDownloadFor('android'))
downloadWindowsBtn.addEventListener('click', ()=> openDownloadFor('windows'))

const platform = detectPlatform();
if (platformHint) {
  platformHint.textContent = platform === 'android' ? '检测到：Android 设备' : platform === 'windows' ? '检测到：Windows 电脑' : '检测不到明确平台，请手动选择下载';
}

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
}

function openLogin(){
  loginError.textContent = '';
  loginUsername.value = '';
  loginPassword.value = '';
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

if (openLoginBtn) {
  openLoginBtn.addEventListener('click', () => openLogin());
}

if (loginCancel) {
  loginCancel.addEventListener('click', () => closeLogin());
}
if (loginModal) {
  loginModal.addEventListener('click', (e) => {
    if (e.target === loginModal) closeLogin();
  });
}

loginForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  loginError.textContent = '';
  const username = loginUsername.value.trim();
  const password = loginPassword.value;
  if(!username || !password){ loginError.textContent = '用户名与密码不能为空'; return; }
  try{
    const resp = await fetch(`${API_BASE}/api/login`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({username, password})
    });
    const data = await resp.json();
    if(resp.ok && data.ok && data.token){
      setToken(data.token, username);
      closeLogin();
      updateAuthStatus();
      await loadMessages();
      appendMessage('登录成功，欢迎使用。', 'bot');
    } else {
      loginError.textContent = data.error || '登录失败';
    }
  }catch(err){ loginError.textContent = '网络错误：' + err.message }
});

// show login modal when no token
updateAuthStatus();
if(!getToken()) {
  setTimeout(() => openLogin(), 120);
} else {
  loadMessages();
}
