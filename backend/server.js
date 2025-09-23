const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  // Increase the maxHttpBufferSize to allow for larger file payloads
  maxHttpBufferSize: 1e8, // 100 MB
  cors: {
    origin: "https://chat-real-project.vercel.app", // your frontend URL
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 10000;

let users = {}; // { socketId: username }

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Set username (no changes here)
  socket.on("set-username", (username) => {
    if (!username) username = "Anonymous";
    users[socket.id] = username;
    console.log(`${username} joined (id=${socket.id})`);
    io.emit("user-joined", { userId: socket.id, username });
    io.emit("user update", users);
  });

  // Chat message (no changes here)
  socket.on("chat-message", (msg) => {
    const username = users[socket.id] || "Anonymous";
    io.emit("chat-message", {
      userId: socket.id,
      username,
      message: msg,
      time: new Date().toLocaleTimeString(),
    });
  });
  
  // **NEW: Handle file upload**
  socket.on("file-upload", (data) => {
    const username = users[socket.id] || "Anonymous";
    console.log(`${username} is sending a file: ${data.fileName}`);
    
    // Broadcast the file to all other clients
    io.emit("file-message", {
        userId: socket.id,
        username,
        file: data.file, // This is the ArrayBuffer
        fileName: data.fileName,
        fileType: data.fileType,
        time: new Date().toLocaleTimeString()
    });
  });


  // Disconnect (no changes here)
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
