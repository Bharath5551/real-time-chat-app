io.on("connection", (socket) => {
  console.log(`🔗 User connected: ${socket.id}`);

  socket.on("set username", (username) => {
    users[socket.id] = username;
    io.emit("user update", users); // send full user map
  });

  socket.on("chat message", ({ message }) => {
    if (!users[socket.id]) return;
    io.emit("chat message", {
      username: users[socket.id],
      message,
      timestamp: new Date().toLocaleTimeString(),
    });
  });

  socket.on("private message", ({ recipientId, message }) => {
    if (!users[socket.id]) return;
    if (users[recipientId]) {
      io.to(recipientId).emit("private message", {
        sender: users[socket.id],
        message,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  });

  socket.on("file upload", ({ recipientId, fileName, fileData }) => {
    try {
      // Your base64 processing assuming fileData is raw base64 string
      const buf = Buffer.from(fileData, "base64");

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
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log("🗑 Deleted:", filePath);
          }
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
        message: `${users[socket.id]} left!`,
      });
      delete users[socket.id];
      io.emit("user update", users);
    }
  });
});
