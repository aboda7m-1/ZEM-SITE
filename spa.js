/*
* فهرس ملف واجهة المستخدم (js/spa.js)
*
* 1.  **وظائف التنقل وتحديث الواجهة:**
* - `showSection`: السطور 1-5
* - `updateUserInfo`: السطور 8-18
* - `togglePasswordVisibility`: السطور 21-30
*
* 2.  **وظائف إدارة الحساب:**
* - `register`: السطور 33-51
* - `login`: السطور 54-68
* - `logout`: السطور 71-75
* - `updateAvatarBtn`: السطور 78-98
* - `toggleTheme`: السطور 101-103
*
* 3.  **وظائف الشات (WebSocket):**
* - إعداد الـ WebSocket والمتغيرات: السطور 106-112
* - `ws.onmessage` (استقبال الرسائل): السطور 115-131
* - `ws.onopen` (عند الاتصال): السطور 134-138
* - `sendBtn` (إرسال الرسالة): السطور 141-146
* - `input` (الضغط على Enter): السطور 149-153
* - `nickBtn` (تغيير الاسم): السطور 156-170
*
* 4.  **نظام المشرفين (واجهة المستخدم):**
* - **الضغط على اسم المستخدم:** السطور 173-192
* - التحقق من صلاحيات الأدمن
* - عرض خيارات الكتم، فك الكتم، والحظر
*
* 5.  **تشغيل الأكواد عند تحميل الصفحة:**
* - السطور 195-197
*
* 6.  **إضافة وظائف الكوكيز:**
* - `setCookie`, `getCookie`: السطور 200-213
*
*/

// وظائف الكوكيز
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i=0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

// التنقل بين الأقسام
function showSection(id) {
  document.querySelectorAll("section").forEach(sec => sec.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  updateUserInfo();
}

// تحديث معلومات المستخدم في جميع الأماكن
function updateUserInfo() {
  const user = JSON.parse(localStorage.getItem("currentUserInfo"));
  if (user) {
    const userNickname = user.nickname || user.username;
    const userAvatar = user.avatar || "https://via.placeholder.com/60/0d6efd/FFFFFF?text=A";

    const nicknames = document.querySelectorAll('[id^="user-nickname-"]');
    nicknames.forEach(element => element.innerText = userNickname);

    const avatars = document.querySelectorAll('[id^="user-avatar-"]');
    avatars.forEach(element => element.src = userAvatar);
  }
}

// إظهار/إخفاء كلمة المرور
function togglePasswordVisibility(id) {
  const passwordInput = document.getElementById(id);
  const icon = passwordInput.nextElementSibling.querySelector('i');
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    passwordInput.type = "password";
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

// إدارة الحسابات
async function register() {
  const username = document.getElementById("register-username").value.trim();
  const nickname = document.getElementById("register-nickname").value.trim() || username;
  const password = document.getElementById("register-password").value.trim();

  if (username.length < 3) return alert("يجب أن يكون اسم المستخدم 3 أحرف أو أكثر.");
  if (password.length < 8) return alert("يجب أن تكون كلمة المرور 8 أحرف أو أكثر.");
  if (!username || !password) return alert("أدخل اسم وكلمة مرور");

  const response = await fetch("/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "register", username, nickname, password }),
  });

  const data = await response.json();
  alert(data.message);
  if (data.success) {
    localStorage.setItem("currentUserInfo", JSON.stringify({ username: data.username, nickname: data.nickname, avatar: data.avatar, role: data.role }));
    setCookie("authToken", data.token, 7); // حفظ التوكن في كوكي لمدة 7 أيام
    updateUserInfo();
    showSection("dashboard");
    ws.send(`/auth ${data.token}`);
  }
}

async function login() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();

  const response = await fetch("/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "login", username, password }),
  });

  const data = await response.json();
  if (data.success) {
    localStorage.setItem("currentUserInfo", JSON.stringify({ username: data.username, nickname: data.nickname, avatar: data.avatar, role: data.role }));
    setCookie("authToken", data.token, 7); // حفظ التوكن في كوكي لمدة 7 أيام
    updateUserInfo();
    showSection("dashboard");
    ws.send(`/auth ${data.token}`);
  } else {
    alert(data.message);
  }
}

function logout() {
  localStorage.removeItem("currentUserInfo");
  setCookie("authToken", "", -1); // حذف الكوكي
  showSection("home");
}

const updateAvatarBtn = document.getElementById("updateAvatarBtn");
updateAvatarBtn?.addEventListener("click", async () => {
  const newAvatar = document.getElementById("avatarInput").value.trim();
  const token = getCookie("authToken");

  if (!newAvatar) return alert("الرجاء إدخال رابط الصورة.");
  if (!token) return alert("يرجى تسجيل الدخول أولاً.");

  const response = await fetch("/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Auth-Token": token },
    body: JSON.stringify({ action: "updateAvatar", newAvatar }),
  });

  const data = await response.json();
  if (data.success) {
    const currentUserInfo = JSON.parse(localStorage.getItem("currentUserInfo"));
    currentUserInfo.avatar = newAvatar;
    localStorage.setItem("currentUserInfo", JSON.stringify(currentUserInfo));
    updateUserInfo();
    alert("تم تحديث صورة الحساب بنجاح!");
  } else {
    alert(data.message);
  }
});

function toggleTheme() {
  document.body.classList.toggle("light-mode");
}

// WebSocket الشات
const ws = new WebSocket("ws://" + window.location.hostname + ":3000");
const messagesDiv = document.getElementById("messages");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const nickInput = document.getElementById("nickInput");
const nickBtn = document.getElementById("nickBtn");

ws.onmessage = (e) => {
  try {
    const messageData = JSON.parse(e.data);
    const msg = document.createElement("div");
    msg.classList.add("chat-message");
    msg.innerHTML = `
      <img src="${messageData.avatar}" alt="صورة المستخدم" class="message-avatar">
      <div class="message-text">
        <span class="nickname" data-username="${messageData.username}">${messageData.nickname}</span>: ${messageData.message}
      </div>
    `;
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  } catch (err) {
    const msg = document.createElement("p");
    msg.textContent = e.data;
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
};

ws.onopen = () => {
  const token = getCookie("authToken"); // قراءة التوكن من الكوكي
  if (token) {
    ws.send(`/auth ${token}`);
  }
};

sendBtn?.addEventListener("click", () => {
  if (input.value.trim() !== "") {
    ws.send(input.value);
    input.value = "";
  }
});

input?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendBtn.click();
  }
});

nickBtn?.addEventListener("click", async () => {
  const newNick = nickInput.value.trim();
  const token = getCookie("authToken");
  if (!newNick || !token) return;

  const response = await fetch("/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Auth-Token": token },
    body: JSON.stringify({ action: "updateNickname", newNickname: newNick }),
  });
  const data = await response.json();
  alert(data.message);
  if (data.success) {
    const currentUserInfo = JSON.parse(localStorage.getItem("currentUserInfo"));
    currentUserInfo.nickname = newNick;
    localStorage.setItem("currentUserInfo", JSON.stringify(currentUserInfo));
    updateUserInfo();
  }
});

document.getElementById('messages')?.addEventListener('click', (e) => {
  if (e.target.classList.contains('nickname')) {
    const username = e.target.getAttribute('data-username');
    const currentUser = JSON.parse(localStorage.getItem('currentUserInfo'));
    if (currentUser?.role === 'admin') {
      const command = prompt(`اختر إجراء للمستخدم ${username}:\n1. كتم (mute)\n2. فك كتم (unmute)\n3. حظر (ban)`);
      if (command === '1') {
        const duration = prompt('أدخل مدة الكتم بالدقائق:');
        if (duration) {
          ws.send(`/mute ${username} ${duration}`);
        }
      } else if (command === '2') {
        ws.send(`/unmute ${username}`);
      } else if (command === '3') {
        ws.send(`/ban ${username}`);
      }
    } else {
        alert(`معلومات المستخدم: ${username}`);
    }
  }
});

window.onload = () => {
  const token = getCookie("authToken");
  if (token) {
      showSection("dashboard");
  } else {
      showSection("home");
  }
  updateUserInfo();
};