# NovaChat

NovaChat is a full-stack real-time chat application built with the MERN stack (MongoDB, Express, React, Node.js) and Socket.IO. It supports one-to-one and group conversations with WhatsApp-style features including message delivery and read receipts, typing indicators, multi-device online presence, message editing and soft-delete, group admin management, and a security-hardened backend with input validation, rate limiting, and an automated test suite.

---

## Features

**Authentication & Security**
- JWT-based registration and login; tokens signed with `JWT_SECRET` and verified on every protected request
- Passwords hashed with bcrypt (salt rounds = 10) via a Mongoose pre-save hook
- `express-validator` validation on `/register` and `/login` — rejects malformed emails, short passwords, and missing fields before any controller logic runs
- Per-route rate limiting on auth endpoints: max 10 requests per IP per 15-minute window (`express-rate-limit`); exceeding the limit returns `429` JSON
- Helmet middleware sets secure HTTP headers (CSP, X-Frame-Options, HSTS, etc.) on every response
- `TokenExpiredError` and `JsonWebTokenError` caught explicitly — returns `401` with a human-readable message instead of crashing with `500`

**Messaging**
- One-to-one and group chat — both share the same message model and REST endpoints
- Send, edit (own messages only), and soft-delete (own messages only) — deleted messages show "This message was deleted" without removing the record
- `editedAt` timestamp stored on the message; edited messages are labelled `(edited)` in the UI
- Delivery receipts: when a recipient fetches a chat, all undelivered messages are marked `deliveredTo` and a `"message delivered"` Socket.IO event is emitted to the sender in real time
- Read receipts: `POST /api/message/read/:chatId` bulk-marks messages as `readBy` and emits `"messages read"` to the room
- Unread count per chat returned by `GET /api/chat` — counted server-side with `Message.countDocuments`

**Real-Time (Socket.IO)**
- Authenticated Socket.IO handshake — the server verifies the JWT from `socket.handshake.auth.token` before accepting any connection; unauthenticated sockets are rejected
- Typing indicators: `"typing"` and `"stop typing"` events verified against group membership before broadcasting to the room
- Multi-device online presence: each user's connected socket IDs are tracked in a server-side `Map`; the user only appears offline when every tab/device disconnects
- `"user online"` / `"user offline"` presence events broadcast to all other connected users
- `"new message"`, `"message edited"`, `"message deleted"`, and `"group updated"` events emitted to the correct room on every mutation

**Group Chat**
- Create groups (minimum 3 members including creator)
- Rename group — admin only
- Add member — admin only
- Remove member — admin only (cannot remove self while admin; must reassign first)
- **Transfer admin** — current admin can hand admin rights to any existing group member (`PUT /api/chat/groupadmin`)
- `"new chat"` event emitted to each new group member's personal room on creation
- `"group updated"` emitted to the chat room on every group mutation

**Authorization**
- Every message fetch/send verifies the authenticated user belongs to the requested chat
- Group mutations (rename, add, remove, transfer admin) verify the caller is the group admin
- Edit and delete operations verify the caller is the message sender

**Testing**
- Jest + Supertest integration test suite — `cd backend && npm test`
- `mongodb-memory-server` provides an isolated in-memory database; no Atlas connection required to run tests
- 8 test cases covering register and login happy paths, duplicate email, short password, missing fields, wrong password, non-existent user, and malformed email

---

## Tech Stack

### Frontend
| Package | Version | Purpose |
|---|---|---|
| React | ^19.2.0 | UI framework |
| React Router DOM | ^7.11.0 | Client-side routing |
| Axios | ^1.13.2 | HTTP client |
| Socket.IO Client | ^4.8.3 | Real-time events |
| Framer Motion | ^12.43.0 | Animations and transitions |
| Tailwind CSS | ^3.4.19 | Utility-first styling |
| Vite | ^7.2.4 | Build tool and dev server |

### Backend
| Package | Version | Purpose |
|---|---|---|
| Express | ^5.2.1 | HTTP server and routing |
| Mongoose | ^9.0.2 | MongoDB ODM |
| Socket.IO | ^4.8.3 | WebSocket server |
| jsonwebtoken | ^9.0.3 | JWT generation and verification |
| bcryptjs | ^3.0.3 | Password hashing |
| express-validator | ^7.3.2 | Input validation |
| express-rate-limit | ^8.6.2 | Auth route rate limiting |
| helmet | ^8.3.0 | Secure HTTP headers |
| dotenv | ^17.2.3 | Environment variable loading |
| cors | ^2.8.5 | Cross-origin request control |

### Dev / Testing
| Package | Purpose |
|---|---|
| Jest | Test runner |
| Supertest | HTTP integration testing |
| mongodb-memory-server | In-memory MongoDB for tests |
| nodemon | Dev server auto-restart |

### Database & Deployment
| Layer | Provider |
|---|---|
| Database | MongoDB Atlas |
| Backend | Render |
| Frontend | Vercel |

---

## Architecture

The backend runs a single Express 5 server that handles both the REST API and the Socket.IO server — `http.createServer(app)` is passed to `new Server(...)` so both share the same port. REST endpoints (`/api/auth`, `/api/users`, `/api/chat`, `/api/message`) manage persistent state — creating, reading, updating, and soft-deleting records in MongoDB. Socket.IO handles every real-time side effect: after a REST call mutates the database, the controller retrieves the `io` instance via `req.app.get("io")` and emits the appropriate event to the relevant room. The Socket.IO handshake is JWT-authenticated independently of the HTTP middleware, so a client must hold a valid token to establish a socket connection at all. The React frontend communicates with the backend via Axios for REST calls and the Socket.IO client for live events, both pointing at the same base URL (`VITE_API_URL`).

---

## Setup — Run Locally

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Create `backend/.env`

```env
PORT=5000
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=use_a_long_random_secret
CLIENT_URL=http://localhost:5173
```

### 3. Create `frontend/.env`

```env
VITE_API_URL=http://localhost:5000
```

### 4. Start both servers (separate terminals)

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). Register two accounts in separate browser sessions to test real-time messaging.

> **Note:** `CLIENT_URL` in `backend/.env` is optional for local development — `localhost:5173` is already in the CORS allowlist by default. It is required in production (set it to your Vercel deployment URL on Render).

---

## Running Tests

```bash
cd backend && npm test
```

Runs the Jest integration suite with `--runInBand --detectOpenHandles`. Uses an in-memory MongoDB instance — no Atlas credentials required. Covers 8 cases across `POST /api/auth/register` and `POST /api/auth/login`: success paths, duplicate email, password length enforcement, missing fields, wrong password, non-existent user, and malformed email format.

---

## Deployment

| Layer | Platform | Notes |
|---|---|---|
| Frontend | Vercel | Set `VITE_API_URL` to your Render backend URL in Vercel project settings |
| Backend | Render | Set `MONGO_URI`, `JWT_SECRET`, and `CLIENT_URL` (your Vercel URL) as environment variables |
| Database | MongoDB Atlas | Add Render's outbound IP range to the Atlas Network Access list, or use `0.0.0.0/0` |

---

## API Overview

### Auth — `/api/auth`
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user; returns JWT |
| `POST` | `/api/auth/login` | Authenticate and return JWT |

### Users — `/api/users`
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/users` | Search users by name/email (protected) |

### Chat — `/api/chat`
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat` | Create or fetch a one-to-one chat |
| `GET` | `/api/chat` | Fetch all chats for the current user (with unread counts) |
| `POST` | `/api/chat/group` | Create a group chat (min 3 members) |
| `PUT` | `/api/chat/rename` | Rename a group (admin only) |
| `PUT` | `/api/chat/groupadmin` | Transfer group admin to a member (admin only) |
| `PUT` | `/api/chat/groupadd` | Add a member to a group (admin only) |
| `PUT` | `/api/chat/groupremove` | Remove a member from a group (admin only) |

### Messages — `/api/message`
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/message` | Send a message to a chat |
| `GET` | `/api/message/:chatId` | Fetch all messages in a chat |
| `PUT` | `/api/message/:messageId` | Edit a message (sender only) |
| `DELETE` | `/api/message/:messageId` | Soft-delete a message (sender only) |
| `POST` | `/api/message/read/:chatId` | Mark all unread messages in a chat as read |
