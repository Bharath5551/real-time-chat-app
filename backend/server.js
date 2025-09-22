const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { exec } = require("child_process");
const { Server } = require("socket.io");
const cors = require("cors");
const dotenv = require("dotenv");
const admin = require("firebase-admin");

dotenv.config();

// 🔹 Firebase setup
const serviceAccount = require("./firebase-service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://chat-project-93a4f-default-rtdb.asia-southeast1.firebasedatabase.app/", // replace with your Realtime DB URL
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
const UPLOADS_DIR = path.join(__dirname, "uploads");
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_FILE_TYPES = ["jpg", "jpeg", "png", "pdf", "txt", "mp4"];
const DELETE_OLD_FILES = true;
const ENCRYPT_FILE_NAMES = true;

// 🔹 Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, "../frontend")));
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
app.use(
  "/uploads",
  express.static(UPLOADS_DIR, {
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Disposition", "inline");
    },
  })
);

// 🔹 Helper: call Java program for word count
function getWordCount(message, callback) {
  exec(`java -cp java WordCount "${message}"`, (error, stdout) => {
    if (error) {
      console.error("Java error:", error);
      callback(0);
    } else {
      callback(parseInt(stdout.trim()) || 0);
    }
  });
}

// ✅ Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`🔗 User connected: ${socket.id}`);

  // 🔹 Set username
  socket.on("set username", async (username) => {
    await db.ref("users/" + socket.id).set(username);
    const snapshot = await db.ref("users").once("value");
    io.emit("user update", snapshot.val());
  });

  // 🔹 Public chat message
  socket.on("chat message", async ({ message }) => {
    const userSnap = await db.ref("users/" + socket.id).once("value");
    const username = userSnap.val();
    if (!username) return;

    getWordCount(message, async (count) => {
      const msgData = {
        username,
        message,
        wordCount: count,
        timestamp: new Date().toLocaleTimeString(),
      };

      await db.ref("messages").push(msgData);
      io.emit("chat message", msgData);
    });
  });

  // 🔹 Private message
  socket.on("private message", async ({ recipientId, message }) => {
    const senderSnap = await db.ref("users/" + socket.id).once("value");
    const sender = senderSnap.val();
    if (!sender) return;

    const recipientSnap = await db.ref("users/" + recipientId).once("value");
    const recipient = recipientSnap.val();
    if (!recipient) return;

    getWordCount(message, async (count) => {
      const msgData = {
        sender,
        recipient,
        message,
        wordCount: count,
        timestamp: new Date().toLocaleTimeString(),
      };

      await db.ref("private_messages").push(msgData);
      io.to(recipientId).emit("private message", msgData);
    });
  });

  // 🔹 File upload
  socket.on("file upload", async ({ recipientId, fileName, fileData }) => {
    try {
      const buf = Buffer.from(fileData, "base64");

      if (buf.length > MAX_FILE_SIZE) {
        return socket.emit("error message", "❌ File too large");
      }

      const ext = fileName.split(".").pop().toLowerCase();
      if (!ALLOWED_FILE_TYPES.includes(ext)) {
        return socket.emit("error message", "❌ File type not allowed");
      }

      const safeName = ENCRYPT_FILE_NAMES
        ? crypto.randomBytes(10).toString("hex") + "." + ext
        : fileName.replace(/\s/g, "_");
      const filePath = path.join(UPLOADS_DIR, safeName);
      fs.writeFileSync(filePath, buf);
      console.log("✅ File saved:", filePath);

      const url = `https://chat-real-kr4m.onrender.com/uploads/${safeName}`;

      const payload = {
        sender: socket.id,
        fileName,
        fileUrl: url,
        recipient: recipientId || "all",
        timestamp: new Date().toLocaleTimeString(),
      };

      // Save in Firebase
      await db.ref("files").push(payload);

      if (recipientId) {
        socket.to(recipientId).emit("file upload", payload);
      } else {
        io.emit("file upload", payload);
      }

      if (DELETE_OLD_FILES) {
        setTimeout(() => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log("🗑 Deleted:", filePath);
          }
        }, 10 * 60 * 1000); // 10 mins
      }
    } catch (e) {
      console.error("❌ File upload error:", e);
      socket.emit("error message", "❌ Upload failed");
    }
  });

  // 🔹 Disconnect
  socket.on("disconnect", async () => {
    const userSnap = await db.ref("users/" + socket.id).once("value");
    const username = userSnap.val();
    if (username) {
      socket.broadcast.emit("chat message", {
        username: "System",
        message: `${username} left!`,
      });
      await db.ref("users/" + socket.id).remove();
      const snapshot = await db.ref("users").once("value");
      io.emit("user update", snapshot.val());
    }
  });
});

// ✅ Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
