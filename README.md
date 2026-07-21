# Real-Time Chat Application

A full-stack, one-to-one chat application built with the MERN stack and Socket.IO. It supports account registration, secure login, live messages, typing indicators, and online presence.

## Features

- JWT-based registration and login
- Protected REST API routes and protected client-side chat route
- Real-time messaging with Socket.IO
- Typing indicators and online/offline status
- Authorization checks: only chat members can read or send messages
- Socket authentication with JWT; presence works across multiple browser tabs

## Tech stack

- Frontend: React, Vite, Tailwind CSS, Axios, Socket.IO Client
- Backend: Node.js, Express, MongoDB/Mongoose, Socket.IO, JWT, bcrypt

## Run locally

1. Install dependencies in both applications:

   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. Create `backend/.env`:

   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=use_a_long_random_secret
   ```

3. Create `frontend/.env`:

   ```env
   VITE_API_URL=http://localhost:5000
   ```

4. Start the backend and frontend in separate terminals:

   ```bash
   cd backend && npm run dev
   cd frontend && npm run dev
   ```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). Register two accounts in separate browser sessions to test live messaging.

## Interview talking points

- The REST API persists each message first; Socket.IO then delivers it to the recipient in real time.
- JWT protects HTTP endpoints and authenticates the Socket.IO handshake, so a browser cannot impersonate another user by sending a different user ID.
- Every message fetch/send checks that the authenticated user belongs to the requested chat.
- Online presence tracks a set of socket IDs per user, avoiding false offline status when one of several tabs disconnects.
