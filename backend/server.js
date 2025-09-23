const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://chat-real-project.vercel.app", // frontend URL
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

let users = {};

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("set-username", (username) => {
    username = username || "Anonymous";
    users[socket.id] = username;
    io.emit("user-joined", { userId: socket.id, username });
    io.emit("user update", users);
  });

  socket.on("chat-message", (msg) => {
    const username = users[socket.id] || "Anonymous";
    io.emit("chat-message", {
      userId: socket.id,
      username,
      message: msg,
      time: new Date().toLocaleTimeString()
    });
  });

  socket.on("disconnect", () => {
    const username = users[socket.id];
    if (username) {
      io.emit("user-left", { userId: socket.id, username });
      delete users[socket.id];
      io.emit("user update", users);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
