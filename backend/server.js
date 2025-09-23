const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { Server } = require("socket.io");
const cors = require("cors");
const dotenv = require("dotenv");
const admin = require("firebase-admin");

dotenv.config();

// 🔹 Firebase setup
const serviceAccount = require("./firebase-service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL:
    "https://chat-project-93a4f-default-rtdb.asia-southeast1.firebasedatabase.app/", // replace with your DB URL
});

const db = admin.database();

// 🔹 Express + Socket.IO setup
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 5e6,
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, "../frontend")));

// ✅ Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("🔗 User connected:", socket.id);

  // Set username
  socket.on("set username", async (username) => {
    await db.ref("users/" + socket.id).set(username);

    io.emit("system message", `${username} joined the chat`);

    const usersSnap = await db.ref("users").once("value");
    io.emit("user update", usersSnap.val());
  });

  // Chat message
  socket.on("chat message", async ({ message }) => {
    const userSnap = await db.ref("users/" + socket.id).once("value");
    const username = userSnap.val() || "Unknown";

    const msgData = { username, message, timestamp: Date.now() };

    // Save to DB
    await db.ref("messages").push(msgData);

    // Broadcast to everyone (including sender)
    io.emit("chat message", msgData);
  });

  // Disconnect
  socket.on("disconnect", async () => {
    const userSnap = await db.ref("users/" + socket.id).once("value");
    const username = userSnap.val();

    if (username) {
      io.emit("system message", `${username} left the chat`);
      await db.ref("users/" + socket.id).remove();

      const usersSnap = await db.ref("users").once("value");
      io.emit("user update", usersSnap.val());
    }
  });
});

// ✅ Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
