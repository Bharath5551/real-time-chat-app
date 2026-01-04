// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// For message saving to Java API
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
const server = http.createServer(app);

app.use(cors());

const io = new Server(server, {
  cors: {
    origin: "https://chat-real-project.vercel.app", // Your frontend URL
    methods: ["GET", "POST"]
  }

const PORT = process.env.PORT || 10000;
let users = {}; // { socketId: username }



  // Set username
  socket.on("set-username", (username) => {
    if (!username) username = "Anonymous";
    users[socket.id] = username;
    

    
    io.emit("user update", users);
  });

  // Handle chat messages
  socket.on("chat-message", async (msg) => {
    const username = users[socket.id] || "Anonymous";
    const messageData = {
      userId: socket.id,
      username,
      message: msg,
      time: new Date().toLocaleTimeString()
    };

    // Send to all clients
    io.emit("chat-message", messageData);

    // Save message to Java API
    try {
      await fetch("https://java-chat-api-v2.onrender.com/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          message: msg,
          timestamp: new Date().toISOString()
        })
      });
      console.log(`✅ Message saved to Java API: ${msg}`);
    } catch (err) {
      console.error("❌ Failed to save message to Java API:", err);
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    const username = users[socket.id];
    

    if (username) {
      io.emit("user-left", { userId: socket.id, username });
      delete users[socket.id];
          }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});



