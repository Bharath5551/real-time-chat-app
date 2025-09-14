const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { exec } = require("child_process");
const { Server } = require("socket.io");
const cors = require("cors");

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

const users = {};

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, "../frontend")));
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
app.use("/uploads", express.static(UPLOADS_DIR, {
  setHeaders: (res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Disposition", "inline");
  }
}));

// Helper: call Java program
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

  socket.on("set username", (username) => {
    users[socket.id] = username;
    io.emit("user update", users);
  });

  socket.on("chat message", ({ message }) => {
    if (!users[socket.id]) return;

    getWordCount(message, (count) => {
      io.emit("chat message", {
        username: users[socket.id],
        message,
        wordCount: count,
        timestamp: new Date().toLocaleTimeString(),
      });
    });
  });

  socket.on("private message", ({ recipientId, message }) => {
    if (!users[socket.id]) return;
    if (users[recipientId]) {
      getWordCount(message, (count) => {
        io.to(recipientId).emit("private message", {
          sender: users[socket.id],
          message,
          wordCount: count,
          timestamp: new Date().toLocaleTimeString(),
        });
      });
    }
  });

  socket.on("file upload", ({ recipientId, fileName, fileData }) => {
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
        sender: users[socket.id],
        fileName,
        fileUrl: url,
      };

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

  socket.on("disconnect", () => {
    if (users[socket.id]) {
      socket.broadcast.emit("chat message", {
        username: "System",
        message: `${users[socket.id]} left!`,
      });
      delete users[socket.id];
      io.emit("user update", users);
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
