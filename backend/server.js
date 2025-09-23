const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const axios = require('axios'); // <-- 1. IMPORT AXIOS

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://chat-real-project.vercel.app",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 10000;

// 2. READ THE JAVA API URL FROM ENVIRONMENT VARIABLES
const JAVA_API_URL = process.env.JAVA_API_URL;

let users = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("set-username", (username) => {
    if (!username) username = "Anonymous";
    users[socket.id] = username;
    console.log(`${username} joined (id=${socket.id})`);
    io.emit("user-joined", { userId: socket.id, username });
    io.emit("user update", users);
  });

  // 3. MODIFIED CHAT MESSAGE HANDLER
  socket.on("chat-message", (msg) => {
    const username = users[socket.id] || "Anonymous";
    const messageData = {
      username,
      message: msg,
      time: new Date().toLocaleTimeString(),
    };

    // Broadcast message to all connected clients in real-time
    io.emit("chat-message", { ...messageData, userId: socket.id });

    // Send the message to the Java backend to be saved
    if (JAVA_API_URL) {
      axios.post(JAVA_API_URL, messageData)
        .then(response => console.log("Message saved to Java backend."))
        .catch(error => console.error("Error saving message:", error.message));
    }
  });

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
  console.log(`Server running on port ${PORT}`);
});
