// 好友列表数据
const friendData = [
    { id: 1, name: "芸芸", avatar: "https://picsum.photos/40/41" },
    { id: 2, name: "小好友A", avatar: "https://picsum.photos/42/40" },
    { id: 3, name: "小好友B", avatar: "https://picsum.photos/43/40" }
];

let currentFriendId = null;
const friendListDom = document.getElementById("friendList");
const currentFriendDom = document.getElementById("currentFriend");

// 渲染好友列表
function renderFriend() {
    friendListDom.innerHTML = "";
    friendData.forEach(item => {
        const div = document.createElement("div");
        div.className = "friend-item";
        div.dataset.id = item.id;
        div.innerHTML = `
            <img class="friend-avatar" src="${item.avatar}" alt="">
            <span>${item.name}</span>
        `;
        div.addEventListener("click", () => selectFriend(item));
        friendListDom.appendChild(div);
    });
}

// 选中好友
function selectFriend(friend) {
    currentFriendId = friend.id;
    currentFriendDom.innerText = friend.name;

    // 切换高亮
    document.querySelectorAll(".friend-item").forEach(el => {
        el.classList.remove("active");
    });
    document.querySelector(`.friend-item[data-id="${friend.id}"]`).classList.add("active");

    // 清空当前聊天
    clearChat();
}

// 初始化
renderFriend();
