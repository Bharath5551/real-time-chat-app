const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const cors = require("cors");
const dotenv = require("dotenv");
const admin = require("firebase-admin");

dotenv.config();

// Firebase setup
const serviceAccount = require("./firebase-service-account.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL
});
const db = admin.database();

// Express + Socket.IO setup
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, "../frontend")));

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Username setup
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

    await db.ref("messages").push(msgData);

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

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
