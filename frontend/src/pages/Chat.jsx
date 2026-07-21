import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { connectSocket, socket } from "../socket";
import { useAuth } from "../context/AuthContext";

const getChatId = (chat) => String(chat?._id || chat || "");
const getInitial = (name = "?") => name.trim().charAt(0).toUpperCase();

function Chat() {
  const { user: userInfo, logout } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const [error, setError] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const selectedChatRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingRef = useRef(false);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    if (!userInfo?.token) return undefined;

    const handleConnect = () => {
      setSocketConnected(true);
      const activeChat = selectedChatRef.current;
      if (activeChat) socket.emit("join chat", activeChat._id);
    };
    const handleDisconnect = () => setSocketConnected(false);
    const handleConnectError = () => {
      setSocketConnected(false);
      setError("Real-time connection failed. Retrying...");
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    connectSocket(userInfo.token);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.disconnect();
    };
  }, [userInfo?.token]);

  useEffect(() => {
    const setOnline = (users) => setOnlineUsers(users.map(String));
    const userOnline = (userId) => setOnlineUsers((previous) =>
      previous.includes(String(userId)) ? previous : [...previous, String(userId)]
    );
    const userOffline = (userId) => setOnlineUsers((previous) =>
      previous.filter((id) => id !== String(userId))
    );
    socket.on("online users", setOnline);
    socket.on("user online", userOnline);
    socket.on("user offline", userOffline);
    return () => {
      socket.off("online users", setOnline);
      socket.off("user online", userOnline);
      socket.off("user offline", userOffline);
    };
  }, []);

  useEffect(() => {
    const receiveMessage = (newMessage) => {
      const activeChatId = getChatId(selectedChatRef.current);
      const incomingChatId = getChatId(newMessage.chat);
      if (activeChatId !== incomingChatId) return;
      setMessages((previous) => previous.some((message) => message._id === newMessage._id)
        ? previous
        : [...previous, newMessage]);
    };
    socket.on("message received", receiveMessage);
    return () => socket.off("message received", receiveMessage);
  }, []);

  useEffect(() => {
    const showTyping = ({ chatId, userName }) => {
      if (getChatId(selectedChatRef.current) === String(chatId)) setTypingUser(userName);
    };
    const hideTyping = ({ chatId }) => {
      if (getChatId(selectedChatRef.current) === String(chatId)) setTypingUser(null);
    };
    socket.on("typing", showTyping);
    socket.on("stop typing", hideTyping);
    return () => {
      socket.off("typing", showTyping);
      socket.off("stop typing", hideTyping);
    };
  }, []);

  useEffect(() => {
    const loadChats = async () => {
      try {
        const { data } = await API.get("/chat");
        setChats(data);
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Could not load chats.");
      } finally {
        setLoadingChats(false);
      }
    };
    loadChats();
  }, []);

  useEffect(() => {
    if (!selectedChat) return undefined;
    let cancelled = false;
    setLoadingMessages(true);
    setMessages([]);
    setTypingUser(null);
    setError("");
    if (socket.connected) socket.emit("join chat", selectedChat._id);

    const loadMessages = async () => {
      try {
        const { data } = await API.get(`/message/${selectedChat._id}`);
        if (!cancelled) setMessages(data);
      } catch (requestError) {
        if (!cancelled) setError(requestError.response?.data?.message || "Could not load messages.");
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    };
    loadMessages();
    return () => { cancelled = true; };
  }, [selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUser]);

  const isUserOnline = (userId) => onlineUsers.includes(String(userId));
  const otherUser = (chat) => chat?.users?.find((person) => String(person._id) !== String(userInfo._id));
  const chatUser = otherUser(selectedChat);

  const openChat = (chat) => {
    setSelectedChat(chat);
    setError("");
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const trimmedContent = content.trim();
    if (!trimmedContent || !selectedChat || isSending) return;
    try {
      setIsSending(true);
      const { data } = await API.post("/message", { content: trimmedContent, chatId: selectedChat._id });
      setMessages((previous) => [...previous, data]);
      socket.emit("new message", data._id);
      socket.emit("stop typing", { chatId: selectedChat._id });
      typingRef.current = false;
      setContent("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not send message.");
    } finally {
      setIsSending(false);
    }
  };

  const handleTyping = (event) => {
    setContent(event.target.value);
    if (!selectedChat || !socket.connected) return;
    if (!typingRef.current) {
      typingRef.current = true;
      socket.emit("typing", { chatId: selectedChat._id });
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop typing", { chatId: selectedChat._id });
      typingRef.current = false;
    }, 900);
  };

  const handleSearch = async (query) => {
    setSearch(query);
    if (!query.trim()) return setSearchResults([]);
    try {
      const { data } = await API.get(`/users?search=${encodeURIComponent(query)}`);
      setSearchResults(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not search users.");
    }
  };

  const accessChat = async (userId) => {
    try {
      const { data } = await API.post("/chat", { userId });
      setChats((previous) => previous.some((chat) => chat._id === data._id) ? previous : [data, ...previous]);
      openChat(data);
      setSearch("");
      setSearchResults([]);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not start chat.");
    }
  };

  const handleLogout = () => {
    socket.disconnect();
    logout();
    navigate("/", { replace: true });
  };

  return (
    <main className="min-h-screen bg-slate-950 p-3 text-slate-900 sm:p-5">
      <section className="mx-auto flex h-[calc(100vh-1.5rem)] max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl sm:h-[calc(100vh-2.5rem)]">
        <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-slate-50/80 p-4 sm:p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Messages</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">My Chats</h1>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-600 font-bold text-white shadow-lg shadow-indigo-200">{getInitial(userInfo.name)}</div>
          </div>

          <div className={`mb-4 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${socketConnected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            <span className={`h-2 w-2 rounded-full ${socketConnected ? "animate-pulse bg-emerald-500" : "bg-amber-500"}`} />
            {socketConnected ? "Real-time connected" : "Connecting to real-time chat..."}
          </div>

          <div className="relative mb-3">
            <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">⌕</span>
            <input value={search} onChange={(event) => handleSearch(event.target.value)} placeholder="Find someone..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" />
          </div>

          {searchResults.length > 0 && <div className="mb-3 rounded-xl border border-indigo-100 bg-white p-1 shadow-sm">{searchResults.map((person) => <button key={person._id} onClick={() => accessChat(person._id)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-indigo-50"><span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-100 font-bold text-indigo-600">{getInitial(person.name)}</span>{person.name}</button>)}</div>}
          {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {loadingChats && <p className="p-3 text-sm text-slate-400">Loading conversations...</p>}
            {chats.map((chat) => {
              const person = otherUser(chat);
              const active = chat._id === selectedChat?._id;
              return <button key={chat._id} onClick={() => openChat(chat)} className={`mb-1 flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "hover:bg-white"}`}>
                <span className={`relative grid h-10 w-10 place-items-center rounded-2xl font-bold ${active ? "bg-white/20" : "bg-indigo-100 text-indigo-600"}`}>{getInitial(person?.name)}<span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-50 ${isUserOnline(person?._id) ? "bg-emerald-400" : "bg-slate-300"}`} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate font-bold">{person?.name || "Unknown user"}</span><span className={`block truncate text-xs ${active ? "text-indigo-100" : "text-slate-400"}`}>{isUserOnline(person?._id) ? "Online now" : "Offline"}</span></span>
              </button>;
            })}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-slate-100">
          {selectedChat ? <>
            <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div className="flex items-center gap-3"><span className="relative grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-white">{getInitial(chatUser?.name)}<span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${isUserOnline(chatUser?._id) ? "bg-emerald-400" : "bg-slate-300"}`} /></span><div><h2 className="font-extrabold">{chatUser?.name || "Chat"}</h2><p className="text-xs text-slate-500">{isUserOnline(chatUser?._id) ? "Online" : "Offline"}</p></div></div>
              <div className="relative">
                <button onClick={() => setProfileMenuOpen((open) => !open)} aria-expanded={profileMenuOpen} aria-label="Open profile menu" className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 text-sm font-bold text-slate-700 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-900 text-xs text-white">{getInitial(userInfo.name)}</span>
                  <span className="hidden sm:inline">You</span>
                  <span className={`text-slate-400 transition ${profileMenuOpen ? "rotate-180" : ""}`}>⌄</span>
                </button>
                {profileMenuOpen && <div className="animate-[menuIn_.18s_ease-out] absolute right-0 top-12 z-20 w-64 origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-300/50">
                  <div className="border-b border-slate-100 px-3 py-3"><p className="font-bold text-slate-800">{userInfo.name}</p><p className="mt-0.5 truncate text-xs text-slate-500">{userInfo.email}</p><p className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-bold ${socketConnected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}><span className={`h-1.5 w-1.5 rounded-full ${socketConnected ? "bg-emerald-500" : "bg-amber-500"}`} />{socketConnected ? "Real-time online" : "Reconnecting"}</p></div>
                  <button onClick={handleLogout} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-rose-600 transition hover:bg-rose-50"><span className="text-base">↪</span> Log out</button>
                </div>}
              </div>
            </header>

            <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_#eef2ff,_#f8fafc_45%)] p-5">
              {loadingMessages && <p className="text-center text-sm text-slate-400">Loading messages...</p>}
              {messages.map((message) => {
                const mine = String(message.sender?._id) === String(userInfo._id);
                return <div key={message._id} className={`mb-3 flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[75%] animate-[fadeIn_.2s_ease-out] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${mine ? "rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 text-white" : "rounded-bl-md bg-white text-slate-700"}`}><p className="break-words">{message.content}</p><p className={`mt-1 text-[10px] ${mine ? "text-indigo-100" : "text-slate-400"}`}>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></div></div>;
              })}
              {typingUser && <div className="mb-3 text-sm italic text-slate-500">{typingUser} is typing<span className="animate-pulse">...</span></div>}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="flex gap-3 border-t border-slate-200 bg-white p-4">
              <input value={content} onChange={handleTyping} placeholder="Write a message..." className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" />
              <button disabled={!content.trim() || isSending} className="rounded-2xl bg-indigo-600 px-5 font-bold text-white shadow-lg shadow-indigo-200 transition duration-200 hover:-translate-y-0.5 hover:bg-indigo-700 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none">{isSending ? "Sending..." : <>Send <span className="hidden sm:inline">↗</span></>}</button>
            </form>
          </> : <div className="grid flex-1 place-items-center bg-[radial-gradient(circle_at_top,_#eef2ff,_#f8fafc_45%)] p-8 text-center"><div><div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-indigo-600 text-4xl shadow-xl shadow-indigo-200">✦</div><h2 className="text-2xl font-black text-slate-800">Your conversations, alive.</h2><p className="mt-2 text-slate-500">Choose a chat or find someone to start messaging.</p></div></div>}
        </section>
      </section>
    </main>
  );
}

export default Chat;
