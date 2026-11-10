# Real-time Chat

A small group chat that runs in the browser. Pick a name, start typing, and everyone in the room sees your message instantly. Every message is also saved to a separate Java service, so the chat has a history.

**Live:** https://chat-real-project.vercel.app

> The backend runs on Render's free tier, so the first message after a quiet spell can take around 30 seconds while the server wakes up.

## How it fits together

```
Browser (Vercel)  ──socket.io──>  Node server (Render)  ──HTTP POST──>  Java history service (Render) ──> PostgreSQL
```

- `frontend/` is a single HTML page that connects to the Node server over WebSockets.
- `backend/server.js` is an Express + Socket.IO server. It tracks who's online, broadcasts messages, and forwards each one to the history API.
- The history API lives in its own repo (`java-history-service1`), built with Spring Boot.

## Tech

Node.js, Express, Socket.IO, HTML/CSS/JS, Spring Boot, PostgreSQL. Deployed on Vercel and Render.

## Run it locally

```bash
npm install
node backend/server.js
```

Then open `frontend/index.html` and point `NODE_SERVER` at `http://localhost:10000`.
