const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL
});

const db = admin.database();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.get("/", (req, res) => {
  res.send("Chat App Backend Running");
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Set username
  socket.on("set username", async (username) => {
    await db.ref("users/" + socket.id).set(username);

    // Notify all users
    io.emit("system message", `${username} joined the chat`);

    // Update users list
    const usersSnap = await db.ref("users").once("value");
    io.emit("user update", usersSnap.val());
  });

  // Handle chat message
  socket.on("chat message", async ({ message }) => {
    const userSnap = await db.ref("users/" + socket.id).once("value");
    const username = userSnap.val() || "Unknown";

    const msgData = { username, message };

    // Save in Firebase
    await db.ref("messages").push(msgData);

    // Broadcast to all
    io.emit("chat message", msgData);
  });

  // On disconnect
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
