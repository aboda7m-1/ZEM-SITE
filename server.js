/*
* فهرس ملف الخادم (server.js)
*
* 1.  **المكتبات والمتغيرات الأساسية:**
* - السطور 1-8
*
* 2.  **وظائف إدارة قواعد البيانات (ملفات JSON):**
* - `loadUsers`, `saveUsers`: السطور 10-17
* - `loadBans`, `saveBans`: السطور 19-26
* - `loadAdmins`: السطور 28-44
*
* 3.  **إعداد خادم الـ HTTP:**
* - بداية الخادم: السطر 46
* - التعامل مع طلبات `/auth` (تسجيل، دخول، تحديث): السطور 48-115
* - التعامل مع طلبات الملفات الثابتة (HTML, CSS, JS): السطور 117-128
*
* 4.  **إعداد خادم الـ WebSocket (الشات):**
* - بداية خادم الـ WebSocket: السطر 132
* - **التعامل مع الاتصال الجديد:** السطر 134
* - **التعامل مع الرسائل (on "message"):** السطر 136
* - المصادقة (`/auth`): السطور 140-150
* - التحقق من الحظر: السطور 153-156
* - **أوامر المشرفين:** السطور 158-196
* - الكتم (`/mute`): السطور 162-171
* - فك الكتم (`/unmute`): السطور 173-182
* - الحظر (`/ban`): السطور 184-195
* - التحقق من الكتم: السطور 198-202
* - إرسال الرسائل العادية: السطور 204-212
* - **التعامل مع قطع الاتصال (on "close"):** السطور 214-218
*
* 5.  **تشغيل السيرفر:**
* - السطر 221
*/

const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = "YOUR_SUPER_SECRET_KEY";

const USERS_DB = path.join(__dirname, "users.json");
const BANS_DB = path.join(__dirname, "bans.json");
const ADMINS_DB = path.join(__dirname, "admins.json");

const loadUsers = () => {
  try {
    return JSON.parse(fs.readFileSync(USERS_DB, "utf8"));
  } catch (e) {
    return {};
  }
};

const saveUsers = (users) => {
  fs.writeFileSync(USERS_DB, JSON.stringify(users, null, 2));
};

const loadBans = () => {
  try {
    return JSON.parse(fs.readFileSync(BANS_DB, "utf8"));
  } catch (e) {
    return {};
  }
};

const saveBans = (bans) => {
  fs.writeFileSync(BANS_DB, JSON.stringify(bans, null, 2));
};

const loadAdmins = async () => {
    try {
        const adminsData = JSON.parse(fs.readFileSync(ADMINS_DB, "utf8"));
        if (Object.keys(adminsData).length === 0) {
            const hashedPassword = await bcrypt.hash("rhomy_666", 10);
            const adminInfo = { username: "admin", password: hashedPassword, role: "admin", nickname: "Admin", avatar: "https://via.placeholder.com/60/FF0000/FFFFFF?text=A" };
            fs.writeFileSync(ADMINS_DB, JSON.stringify({ admin: adminInfo }, null, 2));
            return { admin: adminInfo };
        }
        return adminsData;
    } catch (e) {
        const hashedPassword = await bcrypt.hash("rhomy_666", 10);
        const adminInfo = { username: "admin", password: hashedPassword, role: "admin", nickname: "Admin", avatar: "https://via.placeholder.com/60/FF0000/FFFFFF?text=A" };
        fs.writeFileSync(ADMINS_DB, JSON.stringify({ admin: adminInfo }, null, 2));
        return { admin: adminInfo };
    }
};

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/auth") {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", async () => {
      const { action, username, password, nickname, newAvatar, newNickname } = JSON.parse(body);
      const users = loadUsers();
      const admins = await loadAdmins();
      const token = req.headers["x-auth-token"];

      if (action === "register") {
        if (users[username] || admins[username]) {
          res.writeHead(409, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, message: "المستخدم موجود مسبقاً." }));
          return;
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const avatar = "https://via.placeholder.com/60/0d6efd/FFFFFF?text=" + (nickname ? nickname[0].toUpperCase() : username[0].toUpperCase());
        users[username] = { password: hashedPassword, nickname: nickname, avatar: avatar, role: "user" };
        saveUsers(users);

        const token = jwt.sign({ username, nickname, avatar, role: "user" }, JWT_SECRET, { expiresIn: "1h" });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, message: "تم إنشاء الحساب بنجاح.", username, nickname, avatar, role: "user", token }));
      } else if (action === "login") {
        let user = users[username];
        let role = "user";
        let is_admin_login = false;
        if (admins[username]) {
            user = admins[username];
            role = "admin";
            is_admin_login = true;
        }
        
        if (!user) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة." }));
          return;
        }
        const match = await bcrypt.compare(password, user.password);
        if (match) {
          const token = jwt.sign({ username: user.username, nickname: user.nickname || user.username, avatar: user.avatar || "https://via.placeholder.com/60", role }, JWT_SECRET, { expiresIn: "1h" });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, message: "تم تسجيل الدخول بنجاح.", username: user.username, nickname: user.nickname || user.username, avatar: user.avatar || "https://via.placeholder.com/60", role, token }));
        } else {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة." }));
        }
      } else if (action === "updateAvatar" || action === "updateNickname") {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          const usersDB = loadUsers();
          const user = usersDB[decoded.username];
          if (!user) {
             res.writeHead(401, { "Content-Type": "application/json" });
             res.end(JSON.stringify({ success: false, message: "المستخدم غير موجود." }));
             return;
          }
          if (action === "updateAvatar") {
            user.avatar = newAvatar;
          } else {
            user.nickname = newNickname;
          }
          saveUsers(usersDB);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, message: "تم تحديث البيانات بنجاح." }));
        } catch (err) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, message: "غير مصرح به." }));
        }
      }
    });
    return;
  }

  let filePath = path.join(__dirname, req.url === "/" ? "index.html" : req.url);
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("صفحة غير موجودة");
      return;
    }
    let contentType = "text/html";
    if (filePath.endsWith(".js")) contentType = "text/javascript";
    if (filePath.endsWith(".css")) contentType = "text/css";
    res.writeHead(200, { "Content-Type": contentType + "; charset=utf-8" });
    res.end(content);
  });
});

const wss = new WebSocket.Server({ server });
const connectedUsers = {};
const activeMutes = {};
const activeBans = {};

wss.on("connection", (socket) => {
  let user = { nickname: "زائر", username: null, role: "guest" };

  socket.on("message", (msg) => {
    msg = msg.toString();
    
    if (msg.startsWith("/auth ")) {
      const token = msg.replace("/auth ", "").trim();
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        user = decoded;
        connectedUsers[user.username] = socket;
        socket.send(`✅ تم المصادقة بنجاح، مرحباً ${user.nickname}!`);
      } catch (err) {
        socket.send("❌ فشل المصادقة، يرجى إعادة تسجيل الدخول.");
        socket.close();
      }
      return;
    }

    const bans = loadBans();
    if (bans[user.username] && bans[user.username].permanent) {
        return socket.send("❌ أنت محظور من الشات.");
    }

    if (user.role === 'admin' && msg.startsWith('/')) {
        const parts = msg.split(' ');
        const command = parts[0];
        const targetUsername = parts[1];

        if (command === '/mute') {
            const duration = parseInt(parts[2]) || 5;
            activeMutes[targetUsername] = Date.now() + duration * 60 * 1000;
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(`📢 تم كتم المستخدم ${targetUsername} لمدة ${duration} دقائق.`);
                }
            });
            return;
        }
        
        if (command === '/unmute') {
            if (activeMutes[targetUsername]) {
                delete activeMutes[targetUsername];
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(`📢 تم فك الكتم عن المستخدم ${targetUsername}.`);
                    }
                });
            } else {
                socket.send("❌ المستخدم ليس مكتوماً.");
            }
            return;
        }

        if (command === '/ban') {
            bans[targetUsername] = { permanent: true };
            saveBans(bans);
            const targetSocket = connectedUsers[targetUsername];
            if (targetSocket) {
                targetSocket.send("❌ تم حظرك بشكل دائم من الشات.");
                targetSocket.close();
            }
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(`📢 تم حظر المستخدم ${targetUsername} بشكل دائم.`);
                }
            });
            return;
        }
    }

    if (activeMutes[user.username] && activeMutes[user.username] > Date.now()) {
        const remaining = Math.ceil((activeMutes[user.username] - Date.now()) / (60 * 1000));
        return socket.send(`❌ أنت مكتوم. يتبقى ${remaining} دقائق.`);
    }

    const messageData = {
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        message: msg
    };
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(messageData));
        }
    });
  });

  socket.on("close", () => {
      if (user.username) {
          delete connectedUsers[user.username];
      }
  });
});

server.listen(3000, () => console.log("📡 السيرفر شغال على http://localhost:3000"));