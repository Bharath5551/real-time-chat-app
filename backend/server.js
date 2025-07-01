const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 5e6
});

app.use(cors());
app.use(express.static(path.join(__dirname, "../frontend")));

const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
app.use("/uploads", express.static(UPLOADS_DIR));

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ["jpg","jpeg","png","pdf","txt","mp4"];
const DELETE_OLD_FILES = true;
const ENCRYPT_FILE_NAMES = true;
const users = {};

io.on("connection", (socket) => {
  console.log(`🔗 User connected: ${socket.id}`);
  socket.on("set username", (u) => {
    users[socket.id] = u;
    io.emit("user update", Object.values(users));
  });
  socket.on("chat message", (d) => {
    if (!users[socket.id]) return;
    io.emit("chat message", {
      username: users[socket.id],
      message: d.message,
      timestamp: new Date().toLocaleTimeString()
    });
  });
  socket.on("file upload", ({ recipientId, fileName, fileData }) => {
    try {
      const base64 = fileData.replace(/^data:.+;base64,/, "");
      const buf = Buffer.from(base64, "base64");
      if (buf.length > MAX_FILE_SIZE) return socket.emit("error message", "❌ File too large");
      const ext = fileName.split(".").pop().toLowerCase();
      if (!ALLOWED_FILE_TYPES.includes(ext))
        return socket.emit("error message", "❌ File type not allowed");

      const safeName = ENCRYPT_FILE_NAMES
        ? crypto.randomBytes(10).toString("hex") + "." + ext
        : fileName.replace(/\s/g, "_");
      const filePath = path.join(UPLOADS_DIR, safeName);
      fs.writeFileSync(filePath, buf);
      console.log("✅ File saved:", filePath);

      const url = `https://chat-real-kr4m.onrender.com/uploads/${safeName}`;

      const payload = { sender: users[socket.id], fileName, fileUrl: url };
      recipientId
        ? socket.to(recipientId).emit("file upload", payload)
        : io.emit("file upload", payload);

      if (DELETE_OLD_FILES)
        setTimeout(() => {
          fs.existsSync(filePath) && fs.unlinkSync(filePath);
          console.log("🗑 Deleted:", filePath);
        }, 10 * 60 * 1000);

    } catch (e) {
      console.error("❌ File upload error:", e);
      socket.emit("error message", "❌ Upload failed");
    }
  });
  socket.on("disconnect", () => {
    if (users[socket.id]) {
      socket.broadcast.emit("chat message", {
        username: "System",
        message: `${users[socket.id]} left!`
      });
      delete users[socket.id];
      io.emit("user update", Object.values(users));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
