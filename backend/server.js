const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// Allow frontend hosted on Vercel to access backend
app.use(cors({
  origin: "https://chat-real-project.vercel.app", // replace with your frontend URL
  methods: ["GET", "POST"],
  credentials: true
}));

const io = new Server(server, {
  cors: {
    origin: "https://chat-real-project.vercel.app",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 10000;

// Serve frontend if hosting on same server (optional)
app.use(express.static(path.join(__dirname, "public")));

let users = {}; // { socketId: username }

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Set username
  socket.on("set-username", (username) => {
    if (!username) username = "Anonymous";
    users[socket.id] = username;

    console.log(`${username} joined (id=${socket.id})`);

    io.emit("user-joined", { userId: socket.id, username });
    io.emit("user update", users);
  });

  // Chat message
  socket.on("chat-message", (msg) => {
    const username = users[socket.id] || "Anonymous";
    io.emit("chat-message", {
      userId: socket.id,
      username,
      message: msg,
      time: new Date().toLocaleTimeString(),
    });
  });

  // Disconnect
  socket.on("disconnect", () => {
    const username = users[socket.id];
    console.log("User disconnected:", socket.id, `(${username || "no-username"})`);

    if (username) {
      io.emit("user-left", { userId: socket.id, username });
      delete users[socket.id];
      io.emit("user update", users);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});

