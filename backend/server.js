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

    // ✅ PASTE FIXED FILE UPLOAD HERE (inside this block ⬇️)
    socket.on("file upload", ({ recipientId, fileName, fileData }) => {
        try {
            const base64String = fileData.replace(/^data:.+;base64,/, '');
            const fileBuffer = Buffer.from(base64String, "base64");

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
                }, 10 * 60 * 1000);
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
