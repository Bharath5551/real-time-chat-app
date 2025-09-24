<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Chat App - Modern</title>

  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root{
      --primary-bg:#1a1a2e;
      --secondary-bg:#16213e;
      --sidebar-bg:#0f3460;
      --accent-color:#e94560;
      --text-color:#dcdcdc;
      --input-bg:#1f4068;
      --user-message-bg:#e94560;
      --other-message-bg:#223048;
      --system-message-color:#9aa4b2;
    }
    *{box-sizing:border-box}
    body{
      font-family:"Poppins",sans-serif;
      margin:0;
      display:flex;
      height:100vh;
      background:var(--primary-bg);
      color:var(--text-color);
      overflow:hidden;
    }

    /* SIDEBAR */
    .sidebar{
      width:250px;
      background:var(--sidebar-bg);
      padding:20px;
      border-right:2px solid var(--accent-color);
      display:flex;
      flex-direction:column;
    }
    .sidebar h3{margin:0 0 12px 0;font-size:13px;letter-spacing:1.2px}
    #membersList{overflow:auto;padding-right:6px}
    #membersList div{padding:8px 6px;border-radius:6px;margin-bottom:6px;opacity:0.95}
    #membersList div:hover{color:var(--accent-color);cursor:pointer}

    /* CHAT AREA */
    .chat{flex:1;display:flex;flex-direction:column;background:var(--secondary-bg)}
    #chat-box{
      flex:1;padding:20px 24px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;
    }
    #chat-box::-webkit-scrollbar{width:10px}
    #chat-box::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.25);border-radius:10px}

    .input-area{
      display:flex;align-items:center;padding:14px;background:var(--sidebar-bg);
      gap:12px;border-top:1px solid rgba(255,255,255,0.02);
    }
    #message{
      flex:1;padding:12px 16px;border-radius:999px;border:none;background:var(--input-bg);
      color:var(--text-color);font-size:15px;
    }
    #message:focus{outline:none;box-shadow:0 0 0 3px rgba(233,69,96,0.12)}
    #sendBtn{background:var(--accent-color);border:none;color:#fff;padding:10px 18px;border-radius:999px;cursor:pointer;font-weight:600}

    /* MESSAGE BUBBLE LAYOUT */
    .message-row{display:flex;width:100%} /* container row to allow proper alignment */
    .message{
      display:flex;flex-direction:column;max-width:75%;
      gap:6px;padding:0; /* bubble handled in .bubble */
    }
    .message.user{margin-left:auto;align-items:flex-end}
    .message.other{margin-right:auto;align-items:flex-start}

    .meta{
      font-size:12px;color:rgba(220,220,220,0.85);
      display:flex;gap:8px;align-items:center;
    }
    .meta .name{font-weight:600}
    .meta .time{font-weight:400;opacity:0.8;font-size:11px}

    .bubble{
      padding:12px 16px;border-radius:14px;line-height:1.4;
      word-wrap:break-word;white-space:pre-wrap;
      box-shadow:0 2px 8px rgba(0,0,0,0.15);
    }
    .message.user .bubble{background:var(--user-message-bg);color:#fff;border-bottom-right-radius:6px}
    .message.other .bubble{background:var(--other-message-bg);color:var(--text-color);border-bottom-left-radius:6px}

    .system{align-self:center;color:var(--system-message-color);font-style:italic;padding:6px 12px}
  </style>
</head>
<body>
  <div class="sidebar">
    <h3>Members Online</h3>
    <div id="membersList"></div>
  </div>

  <div class="chat">
    <div id="chat-box" aria-live="polite"></div>
    <div class="input-area">
      <input id="message" placeholder="Type your message..." autocomplete="off" />
      <button id="sendBtn">Send</button>
    </div>
  </div>

  <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
  <script>
    // config
    const NODE_SERVER = "https://chat-real-kr4m.onrender.com";
    const JAVA_API_URL = "https://java-chat-api-v2.onrender.com/api/messages";
    const socket = io(NODE_SERVER, { transports: ["websocket"] });

    const chatBox = document.getElementById("chat-box");
    const membersList = document.getElementById("membersList");
    const messageInput = document.getElementById("message");
    const sendBtn = document.getElementById("sendBtn");

    let username = (prompt("Enter your username:") || "Guest").slice(0,64);
    socket.emit("set-username", username);

    // helpers
    function esc(str){ return String(str || "").replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
    function formatTime(t){
      if(!t) return new Date().toLocaleTimeString();
      const d = isNaN(Date.parse(t)) ? new Date() : new Date(t);
      return d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    }
    function scrollToBottom(){ chatBox.scrollTop = chatBox.scrollHeight; }

    // add single message (data:{ userId, username, message, time? })
    function addMessage(data, kind="chat"){
      if(kind === "system"){
        const s = document.createElement("div");
        s.className = "system";
        s.textContent = data;
        chatBox.appendChild(s);
        scrollToBottom();
        return;
      }

      // normalize: if 'history' format isn't same, try to map
      const userId = data.userId || data.id || data.fromId || "";
      const name = data.username || data.name || "Unknown";
      const text = data.message || data.text || data.body || "";
      const time = data.time || data.timestamp || null;

      const isSelf = (userId === socket.id) || (name === username);

      const row = document.createElement("div");
      row.className = "message-row";

      const msg = document.createElement("div");
      msg.className = "message " + (isSelf ? "user" : "other");

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.innerHTML = `<span class="name">${esc(name)}</span><span class="time">${formatTime(time)}</span>`;

      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.innerHTML = esc(text);

      msg.appendChild(meta);
      msg.appendChild(bubble);
      row.appendChild(msg);
      chatBox.appendChild(row);
      scrollToBottom();
    }

    // load history (tolerant)
    async function loadChatHistory(){
      try{
        const r = await fetch(JAVA_API_URL);
        if(!r.ok) return;
        const arr = await r.json();
        if(!Array.isArray(arr)) return;
        arr.forEach(m => addMessage(m, "chat"));
      }catch(e){ console.warn("history load failed", e); }
    }

    // send
    function sendMessage(){
      const txt = messageInput.value.trim();
      if(!txt) return;
      socket.emit("chat-message", txt);
      messageInput.value = "";
    }
    sendBtn.addEventListener("click", sendMessage);
    messageInput.addEventListener("keydown", e => { if(e.key === "Enter") sendMessage(); });

    // socket listeners
    socket.on("connect", () => { addMessage({username:"System", message:"Connected to server"}, "system"); });
    socket.on("disconnect", () => { addMessage("Disconnected from server", "system"); });

    socket.on("chat-message", data => addMessage(data, "chat"));
    socket.on("user-joined", d => addMessage(`${d.username} joined`, "system"));
    socket.on("user-left", d => addMessage(`${d.username} left`, "system"));

    socket.on("user update", users => {
      membersList.innerHTML = "";
      if(!users) return;
      Object.values(users).forEach(name => {
        const div = document.createElement("div");
        div.textContent = name;
        membersList.appendChild(div);
      });
    });

    // initial load
    loadChatHistory();
  </script>
</body>
</html>
