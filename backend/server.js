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
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 5e6 // 5MB file upload limit
});

app.use(cors());
app.use(express.static(path.join(__dirname, "../frontend")));

// ✅ Declare and create uploads folder BEFORE using it
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}
app.use("/uploads", express.static(UPLOADS_DIR));

// ✅ Upload config
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ["jpg", "jpeg", "png", "pdf", "txt", "mp4"];
const DELETE_OLD_FILES = true;
const ENCRYPT_FILE_NAMES = true;

const users = {};

io.on("connection", (socket) => {
    console.log(`🔗 User connected: ${socket.id}`);

    socket.on("set username", (username) => {
        users[socket.id] = username;
        io.emit("user update", Object.fromEntries(Object.entries(users)));
    });

    socket.on("chat message", (data) => {
        if (!users[socket.id]) return;
        io.emit("chat message", {
            username: users[socket.id],
            message: data.message,
            timestamp: new Date().toLocaleTimeString()
        });
    });

    socket.on("file upload", ({ recipientId, fileName, fileData }) => {
        try {
            const fileBuffer = Buffer.from(fileData, "base64");
            if (fileBuffer.length > MAX_FILE_SIZE) {
                socket.emit("error message", "❌ File too large (Max: 20MB)");
                return;
            }

            const fileExtension = fileName.split(".").pop().toLowerCase();
            if (!ALLOWED_FILE_TYPES.includes(fileExtension)) {
                socket.emit("error message", "❌ File type not allowed");
                return;
            }

            const safeFileName = ENCRYPT_FILE_NAMES
                ? crypto.randomBytes(10).toString("hex") + "." + fileExtension
                : fileName.replace(/\s/g, "_");

            const filePath = path.join(UPLOADS_DIR, safeFileName);
            fs.writeFileSync(filePath, fileBuffer);
            console.log(`✅ File saved: ${filePath}`);

            const fileUrl = `https://chat-real-kr4m.onrender.com/uploads/${safeFileName}`;
            const payload = { sender: users[socket.id], fileName, fileUrl };
            recipientId
                ? socket.to(recipientId).emit("file upload", payload)
                : io.emit("file upload", payload);

            if (DELETE_OLD_FILES) {
                setTimeout(() => {
                    try {
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                            console.log(`🗑 File deleted: ${filePath}`);
                        }
                    } catch (err) {
                        console.error("❌ File deletion error:", err);
                    }
                }, 10 * 60 * 1000); // Delete after 10 minutes
            }
        } catch (err) {
            console.error("❌ File upload error:", err);
            socket.emit("error message", "❌ File upload failed.");
        }
    });

    socket.on("disconnect", () => {
        if (users[socket.id]) {
            socket.broadcast.emit("chat message", {
                username: "System",
                message: `${users[socket.id]} left the chat!`,
                system: true
            });
            delete users[socket.id];
            io.emit("user update", Object.fromEntries(Object.entries(users)));
        }
    });
});

const PORT = 3000;
const HOST = "0.0.0.0";
server.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on http://${HOST}:${PORT}`);
});
