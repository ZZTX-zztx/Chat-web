// 简单前端聊天逻辑 + 下载按钮
const API_URL = 'https://chat.zztxer.dpdns.org/api/messages'; // 已配置为完整路径

const messagesEl = document.getElementById('messages');
const form = document.getElementById('inputForm');
const input = document.getElementById('input');

const downloadAndroidBtn = document.getElementById('downloadAndroid');
const downloadWindowsBtn = document.getElementById('downloadWindows');
const platformHint = document.getElementById('platformHint');
const authStatus = document.getElementById('authStatus');
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const loginCancel = document.getElementById('loginCancel');
const loginError = document.getElementById('loginError');

function appendMessage(text, cls='bot'){
  const el = document.createElement('div');
  el.className = 'msg ' + cls;
  el.textContent = text;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function sendToApi(message){
  try{
    const headers = {'Content-Type':'application/json'};
    const token = getToken();
    if(token) headers['Authorization'] = 'Bearer ' + token;

    const resp = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({message})
    });

    if(resp.status === 401){
      // token invalid or expired
      setToken(null);
      openLogin();
      return '未授权，请登录后重试';
    }

    if(!resp.ok) throw new Error('Network response not ok');
    const data = await resp.json();
    return data.reply || JSON.stringify(data);
  }catch(e){
    return '请求失败：' + e.message;
  }
}

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const text = input.value.trim();
  if(!text) return;
  appendMessage(text, 'user');
  input.value='';
  appendMessage('正在发送…', 'bot');
  const reply = await sendToApi(text);
  // remove the last '正在发送…'
  const last = messagesEl.querySelector('.msg.bot:last-child');
  if(last && last.textContent==='正在发送…') last.remove();
  appendMessage(reply, 'bot');
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
platformHint.textContent = platform === 'android' ? '检测到：Android 设备' : platform === 'windows' ? '检测到：Windows 电脑' : '检测不到明确平台，请手动选择下载';

// 页面加载提示
appendMessage('示例：在此输入消息并回车发送。', 'bot');

// --- Auth: show modal if no token ---
function getToken(){
  return localStorage.getItem('auth_token');
}

function setToken(token){
  if(token) localStorage.setItem('auth_token', token);
  else localStorage.removeItem('auth_token');
  updateAuthStatus();
}

function updateAuthStatus(){
  const t = getToken();
  authStatus.textContent = t ? '已登录' : '未登录';
}

function openLogin(){
  loginError.textContent = '';
  loginUsername.value = '';
  loginPassword.value = '';
  loginModal.classList.add('show');
  loginModal.setAttribute('aria-hidden', 'false');
}

function closeLogin(){
  loginModal.classList.remove('show');
  loginModal.setAttribute('aria-hidden', 'true');
}

loginCancel.addEventListener('click', ()=> closeLogin());

loginForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  loginError.textContent = '';
  const username = loginUsername.value.trim();
  const password = loginPassword.value;
  if(!username || !password){ loginError.textContent = '用户名与密码不能为空'; return; }
  try{
    const resp = await fetch(API_URL.replace('/api/messages','/api/login'), {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({username, password})
    });
    const data = await resp.json();
    if(resp.ok && data.ok && data.token){
      setToken(data.token);
      closeLogin();
    } else {
      loginError.textContent = data.error || '登录失败';
    }
  }catch(err){ loginError.textContent = '网络错误：' + err.message }
});

// show login modal when no token
updateAuthStatus();
if(!getToken()) openLogin();
