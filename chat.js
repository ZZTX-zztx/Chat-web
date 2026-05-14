const chatContent = document.getElementById("chatContent");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");

// 发送消息
function sendMessage() {
    const text = msgInput.value.trim();
    if (!text || !currentFriendId) return;

    // 自己的消息
    addMessage(text, true);
    msgInput.value = "";

    // 这里预留：后面接 Worker 就把这里改成请求后端接口
    // fetch("你的worker地址", { body: 消息数据 })
}

// 添加消息到聊天区
function addMessage(text, isSelf) {
    const div = document.createElement("div");
    div.className = `msg-item ${isSelf ? "msg-self" : "msg-other"}`;
    div.innerHTML = `<div class="msg-bubble">${text}</div>`;
    chatContent.appendChild(div);
    // 自动滚动到底部
    chatContent.scrollTop = chatContent.scrollHeight;
}

// 清空聊天记录
function clearChat() {
    chatContent.innerHTML = "";
}

// 绑定事件
sendBtn.addEventListener("click", sendMessage);
msgInput.addEventListener("keydown", e => {
    if (e.key === "Enter") sendMessage();
});

// 预留：接收后端推送消息的方法
function receiveMessage(text) {
    addMessage(text, false);
}
