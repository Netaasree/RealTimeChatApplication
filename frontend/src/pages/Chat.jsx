import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { connectSocket, socket } from "../socket";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";

const getChatId = (chat) => String(chat?._id || chat || "");
const getUserId = (user) => String(user?._id || user || "");
const getInitial = (name = "?") => name.trim().charAt(0).toUpperCase();

const markMessagesAsRead = async (chatId) => {
  await API.post(`/message/read/${chatId}`);
};

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
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingContent, setEditingContent] = useState("");
  const [isUpdatingMessage, setIsUpdatingMessage] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [groupResults, setGroupResults] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [renamingGroup, setRenamingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState([]);

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
    const addNewChat = (chat) => {
      setChats((previous) => previous.some((item) => item._id === chat._id) ? previous : [chat, ...previous]);
    };
    const updateGroup = (chat) => {
      setChats((previous) => previous.map((item) => item._id === chat._id ? chat : item));
      if (selectedChatRef.current?._id === chat._id) setSelectedChat(chat);
    };
    socket.on("new chat", addNewChat);
    socket.on("group updated", updateGroup);
    return () => {
      socket.off("new chat", addNewChat);
      socket.off("group updated", updateGroup);
    };
  }, []);

  useEffect(() => {
    const receiveMessage = (newMessage) => {
      const activeChatId = getChatId(selectedChatRef.current);
      const incomingChatId = getChatId(newMessage.chat);
      if (activeChatId !== incomingChatId) {
        setChats((previous) => {
          const chat = previous.find((item) => item._id === incomingChatId);
          if (!chat) return previous;
          const updatedChat = {
            ...chat,
            latestMessage: newMessage,
            unreadCount: (chat.unreadCount || 0) + 1,
          };
          return [updatedChat, ...previous.filter((item) => item._id !== incomingChatId)];
        });
        return;
      }
      setMessages((previous) => previous.some((message) => message._id === newMessage._id)
        ? previous
        : [...previous, newMessage]);
      if (getUserId(newMessage.sender) !== getUserId(userInfo)) {
        markMessagesAsRead(activeChatId).catch(() => {});
      }
    };
    socket.on("message received", receiveMessage);
    return () => socket.off("message received", receiveMessage);
  }, [userInfo]);

  useEffect(() => {
    const updateReadReceipts = ({ chatId, userId }) => {
      if (getChatId(selectedChatRef.current) !== String(chatId)) return;
      setMessages((previous) => previous.map((message) => {
        if (getUserId(message.sender) === String(userId)) return message;
        const alreadyRead = message.readBy?.some((reader) => getUserId(reader) === String(userId));
        return alreadyRead ? message : { ...message, readBy: [...(message.readBy || []), { _id: userId }] };
      }));
    };
    const updateDeliveryStatus = ({ chatId, messageId, userId }) => {
      if (getChatId(selectedChatRef.current) !== String(chatId)) return;
      setMessages((previous) => previous.map((message) => {
        if (getUserId(message.sender) === String(userId)) return message;
        if (messageId && message._id !== messageId) return message;
        const alreadyDelivered = message.deliveredTo?.some((recipient) => getUserId(recipient) === String(userId));
        return alreadyDelivered ? message : { ...message, deliveredTo: [...(message.deliveredTo || []), { _id: userId }] };
      }));
    };
    const updateMessage = (updatedMessage) => {
      if (getChatId(selectedChatRef.current) !== getChatId(updatedMessage.chat)) return;
      setMessages((previous) => previous.map((message) => message._id === updatedMessage._id ? updatedMessage : message));
    };
    socket.on("messages read", updateReadReceipts);
    socket.on("message delivered", updateDeliveryStatus);
    socket.on("message edited", updateMessage);
    socket.on("message deleted", updateMessage);
    return () => {
      socket.off("messages read", updateReadReceipts);
      socket.off("message delivered", updateDeliveryStatus);
      socket.off("message edited", updateMessage);
      socket.off("message deleted", updateMessage);
    };
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
        if (!cancelled) {
          setMessages(data);
          markMessagesAsRead(selectedChat._id).catch(() => {});
        }
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
  const otherUser = (chat) => chat?.users?.find((person) => getUserId(person) !== getUserId(userInfo));
  const chatUser = otherUser(selectedChat);
  const lastOwnMessageId = [...messages].reverse().find((message) => getUserId(message.sender) === getUserId(userInfo))?._id;

  const seenLabel = (message) => {
    const readers = (message.readBy || []).filter((reader) => getUserId(reader) !== getUserId(userInfo));
    if (!readers.length) return "";
    if (selectedChat?.users?.length > 2) {
      const names = readers.map((reader) => reader.name).filter(Boolean);
      return names.length ? `Seen by ${names.join(", ")}` : `Seen by ${readers.length}`;
    }
    return "Seen ✓";
  };

  const messageStatus = (message) => {
    if (selectedChat?.isGroupChat) return "";
    const otherUserId = getUserId(otherUser(selectedChat));
    if (message.readBy?.some((reader) => getUserId(reader) === otherUserId)) return "✓✓";
    if (message.deliveredTo?.some((recipient) => getUserId(recipient) === otherUserId)) return "✓✓";
    return "✓";
  };

  const openChat = (chat) => {
    setSelectedChat(chat);
    setChats((previous) => previous.map((item) => item._id === chat._id ? { ...item, unreadCount: 0 } : item));
    setGroupInfoOpen(false);
    setNewGroupName(chat.chatName || "");
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

  const searchGroupUsers = async (query, setResults) => {
    if (!query.trim()) return setResults([]);
    try {
      const { data } = await API.get(`/users?search=${encodeURIComponent(query)}`);
      setResults(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not search users.");
    }
  };

  const toggleGroupMember = (person) => {
    setGroupMembers((previous) => previous.some((member) => member._id === person._id)
      ? previous.filter((member) => member._id !== person._id)
      : [...previous, person]);
  };

  const createGroup = async () => {
    if (!groupName.trim() || groupMembers.length < 2) {
      return setError("Enter a name and select at least two members.");
    }
    try {
      const { data } = await API.post("/chat/group", { name: groupName, users: groupMembers.map((member) => member._id) });
      setChats((previous) => previous.some((chat) => chat._id === data._id) ? previous : [data, ...previous]);
      openChat(data);
      setGroupModalOpen(false);
      setGroupName("");
      setGroupSearch("");
      setGroupResults([]);
      setGroupMembers([]);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not create group.");
    }
  };

  const renameGroup = async () => {
    if (!newGroupName.trim() || !selectedChat) return;
    try {
      const { data } = await API.put("/chat/rename", { chatId: selectedChat._id, name: newGroupName });
      setSelectedChat(data);
      setChats((previous) => previous.map((chat) => chat._id === data._id ? data : chat));
      setRenamingGroup(false);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not rename group.");
    }
  };

  const addGroupMember = async (userId) => {
    try {
      const { data } = await API.put("/chat/groupadd", { chatId: selectedChat._id, userId });
      setSelectedChat(data);
      setChats((previous) => previous.map((chat) => chat._id === data._id ? data : chat));
      setMemberSearch("");
      setMemberResults([]);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not add member.");
    }
  };

  const removeGroupMember = async (userId) => {
    try {
      const { data } = await API.put("/chat/groupremove", { chatId: selectedChat._id, userId });
      setSelectedChat(data);
      setChats((previous) => previous.map((chat) => chat._id === data._id ? data : chat));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not remove member.");
    }
  };

  const handleLogout = () => {
    socket.disconnect();
    logout();
    navigate("/", { replace: true });
  };

  const startEditingMessage = (message) => {
    setEditingMessageId(message._id);
    setEditingContent(message.content);
  };

  const saveEditedMessage = async (messageId) => {
    if (!editingContent.trim() || isUpdatingMessage) return;
    try {
      setIsUpdatingMessage(true);
      const { data } = await API.put(`/message/${messageId}`, { content: editingContent });
      setMessages((previous) => previous.map((message) => message._id === data._id ? data : message));
      setEditingMessageId(null);
      setEditingContent("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not edit message.");
    } finally {
      setIsUpdatingMessage(false);
    }
  };

  const removeMessage = async (messageId) => {
    try {
      const { data } = await API.delete(`/message/${messageId}`);
      setMessages((previous) => previous.map((message) => message._id === data._id ? data : message));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not delete message.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 p-3 text-slate-900 transition-colors duration-500 sm:p-5 dark:bg-slate-950 dark:text-slate-100">
      <section className="mx-auto flex h-[calc(100vh-1.5rem)] max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl transition-colors duration-500 sm:h-[calc(100vh-2.5rem)] dark:border-slate-700 dark:bg-slate-900">
        <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-slate-50/80 p-4 transition-colors duration-500 sm:p-5 dark:border-slate-700 dark:bg-slate-900/95">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-indigo-500">NovaChat</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Messages</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white">My Chats</h1>
            </div>
            <div className="flex items-center gap-2"><ThemeToggle /><div className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-600 font-bold text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-950">{getInitial(userInfo.name)}</div></div>
          </div>

          <div className={`mb-4 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${socketConnected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            <span className={`h-2 w-2 rounded-full ${socketConnected ? "animate-pulse bg-emerald-500" : "bg-amber-500"}`} />
            {socketConnected ? "Real-time connected" : "Connecting to real-time chat..."}
          </div>

          <div className="relative mb-3">
            <span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">⌕</span>
            <input value={search} onChange={(event) => handleSearch(event.target.value)} placeholder="Find someone..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-400 dark:focus:ring-indigo-500/20" />
          </div>
          <button onClick={() => setGroupModalOpen(true)} className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-sm font-bold text-indigo-700 transition hover:-translate-y-0.5 hover:bg-indigo-100 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"><span className="text-lg leading-none">+</span> New Group</button>

          {searchResults.length > 0 && <div className="mb-3 rounded-xl border border-indigo-100 bg-white p-1 shadow-sm">{searchResults.map((person) => <button key={person._id} onClick={() => accessChat(person._id)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-indigo-50"><span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-100 font-bold text-indigo-600">{getInitial(person.name)}</span>{person.name}</button>)}</div>}
          {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {loadingChats && <p className="p-3 text-sm text-slate-400">Loading conversations...</p>}
            {chats.map((chat) => {
              const person = otherUser(chat);
              const active = chat._id === selectedChat?._id;
              const displayName = chat.isGroupChat ? chat.chatName : person?.name;
              return <button key={chat._id} onClick={() => openChat(chat)} className={`mb-1 flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "hover:bg-white"}`}>
                <span className={`relative grid h-10 w-10 place-items-center rounded-2xl font-bold ${active ? "bg-white/20" : "bg-indigo-100 text-indigo-600"}`}>{chat.isGroupChat ? "♟" : getInitial(person?.name)}{!chat.isGroupChat && <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-50 ${isUserOnline(person?._id) ? "bg-emerald-400" : "bg-slate-300"}`} />}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-bold">{displayName || "Unknown user"}</span><span className={`block truncate text-xs ${active ? "text-indigo-100" : "text-slate-400"}`}>{chat.latestMessage?.content || "No messages yet"}</span></span>{chat.unreadCount > 0 && !active && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-indigo-600 px-1 text-[10px] font-black text-white">{chat.unreadCount}</span>}
              </button>;
            })}
          </div>
          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button onClick={handleLogout} className="flex w-full items-center justify-between rounded-2xl border border-rose-100 bg-white px-3 py-3 text-left text-sm font-bold text-rose-600 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-rose-50 hover:shadow-md dark:border-rose-500/20 dark:bg-slate-800 dark:hover:bg-rose-500/10">
              <span className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-base dark:bg-rose-500/10">↪</span>Log out</span>
              <span className="text-rose-300">›</span>
            </button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-slate-100 transition-colors duration-500 dark:bg-slate-950">
          {selectedChat ? <>
            <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 transition-colors duration-500 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-3"><span className="relative grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-white">{selectedChat.isGroupChat ? "♟" : getInitial(chatUser?.name)}{!selectedChat.isGroupChat && <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${isUserOnline(chatUser?._id) ? "bg-emerald-400" : "bg-slate-300"}`} />}</span><div><h2 className="font-extrabold dark:text-white">{selectedChat.isGroupChat ? selectedChat.chatName : chatUser?.name || "Chat"}</h2><p className="text-xs text-slate-500 dark:text-slate-400">{selectedChat.isGroupChat ? `${selectedChat.users.length} members` : isUserOnline(chatUser?._id) ? "Online" : "Offline"}</p></div>{selectedChat.isGroupChat && <button onClick={() => setGroupInfoOpen((open) => !open)} className="ml-1 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-600 transition hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300">Group info</button>}</div>
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

            {selectedChat.isGroupChat && groupInfoOpen && <div className="absolute right-6 top-24 z-20 w-80 max-w-[calc(100vw-2rem)] animate-[menuIn_.18s_ease-out] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">Group info</p><h3 className="font-black dark:text-white">{selectedChat.chatName}</h3></div><button onClick={() => setGroupInfoOpen(false)} className="rounded-lg px-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">×</button></div>
              {getUserId(selectedChat.groupAdmin) === getUserId(userInfo) && <div className="mb-4 rounded-xl bg-indigo-50 p-3 dark:bg-indigo-500/10"><div className="flex gap-2">{renamingGroup ? <><input value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-indigo-200 bg-white px-2 py-1 text-sm text-slate-900 dark:border-indigo-500/30 dark:bg-slate-800 dark:text-white" /><button onClick={renameGroup} className="rounded-lg bg-indigo-600 px-2 text-xs font-bold text-white">Save</button></> : <button onClick={() => setRenamingGroup(true)} className="text-sm font-bold text-indigo-600 dark:text-indigo-300">Rename group</button>}</div><input value={memberSearch} onChange={(event) => { setMemberSearch(event.target.value); searchGroupUsers(event.target.value, setMemberResults); }} placeholder="Add a member..." className="mt-3 w-full rounded-lg border border-indigo-200 bg-white px-2 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-indigo-500/30 dark:bg-slate-800 dark:text-white" />{memberResults.filter((person) => !selectedChat.users.some((member) => member._id === person._id)).map((person) => <button key={person._id} onClick={() => addGroupMember(person._id)} className="mt-1 flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-sm hover:bg-white dark:hover:bg-slate-800"><span>{person.name}</span><span className="font-bold text-indigo-600">+</span></button>)}</div>}
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Members · {selectedChat.users.length}</p>
              <div className="max-h-52 space-y-1 overflow-y-auto">{selectedChat.users.map((member) => <div key={member._id} className="flex items-center justify-between rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"><span className="flex items-center gap-2 text-sm font-semibold dark:text-slate-200"><span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-100 text-xs text-indigo-600">{getInitial(member.name)}</span>{member.name}{getUserId(member) === getUserId(selectedChat.groupAdmin) && <span className="text-[10px] font-black uppercase text-indigo-500">Admin</span>}</span>{getUserId(selectedChat.groupAdmin) === getUserId(userInfo) && getUserId(member) !== getUserId(userInfo) && <button onClick={() => removeGroupMember(member._id)} className="text-xs font-bold text-rose-500">Remove</button>}</div>)}</div>
            </div>}

            <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_#eef2ff,_#f8fafc_45%)] p-5 transition-colors duration-500 sm:p-7 dark:bg-[radial-gradient(circle_at_top,_#172554,_#020617_48%)]">
              {loadingMessages && <p className="text-center text-sm text-slate-400">Loading messages...</p>}
              {messages.map((message) => {
                const mine = getUserId(message.sender) === getUserId(userInfo);
                const senderName = message.sender?.name || chatUser?.name || "Chat member";
                const isEditing = editingMessageId === message._id;
                const seen = mine && message._id === lastOwnMessageId ? seenLabel(message) : "";
                const status = mine && !message.isDeleted ? messageStatus(message) : "";
                const isRead = message.readBy?.some((reader) => getUserId(reader) === getUserId(otherUser(selectedChat)));
                return <div key={message._id} className={`mb-4 flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                  {!mine && <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-white text-xs font-black text-indigo-600 shadow-sm">{getInitial(senderName)}</span>}
                  <div className="group relative max-w-[75%]">
                    <div className={`animate-[fadeIn_.24s_ease-out] rounded-2xl px-4 py-2.5 text-sm shadow-sm transition-transform duration-200 hover:scale-[1.01] ${mine ? "rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 text-white" : "rounded-bl-md border border-slate-100 bg-white text-slate-700"}`}>
                      {selectedChat.isGroupChat && !mine && <p className="mb-1 text-[11px] font-black text-indigo-500">{senderName}</p>}
                      {isEditing ? <div className="min-w-52"><input value={editingContent} onChange={(event) => setEditingContent(event.target.value)} className="w-full rounded-lg border border-white/40 bg-white/15 px-2 py-1 text-white outline-none placeholder:text-indigo-100" autoFocus /><div className="mt-2 flex justify-end gap-2"><button onClick={() => { setEditingMessageId(null); setEditingContent(""); }} className="text-xs text-indigo-100">Cancel</button><button onClick={() => saveEditedMessage(message._id)} className="rounded-md bg-white/20 px-2 py-1 text-xs font-bold">{isUpdatingMessage ? "Saving..." : "Save"}</button></div></div> : <p className={`break-words leading-relaxed ${message.isDeleted ? "italic opacity-70" : ""}`}>{message.isDeleted ? "This message was deleted" : message.content}</p>}
                      <p className={`mt-1 text-[10px] ${mine ? "text-indigo-100" : "text-slate-400"}`}>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{message.editedAt && !message.isDeleted ? " (edited)" : ""}{status && <span className={`ml-1 font-black ${isRead ? "text-indigo-200" : "text-slate-300"}`}>{status}</span>}</p>
                    </div>
                    {mine && !message.isDeleted && !isEditing && <div className="absolute -left-20 top-1/2 hidden -translate-y-1/2 gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg group-hover:flex"><button onClick={() => startEditingMessage(message)} className="rounded px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100">Edit</button><button onClick={() => removeMessage(message._id)} className="rounded px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">Delete</button></div>}
                    {seen && <p className="mt-1 text-right text-[10px] font-semibold text-indigo-500">{seen}</p>}
                  </div>
                </div>;
              })}
              {typingUser && <div className="mb-3 text-sm italic text-slate-500">{typingUser} is typing<span className="animate-pulse">...</span></div>}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="flex gap-3 border-t border-slate-200 bg-white p-4 transition-colors duration-500 dark:border-slate-700 dark:bg-slate-900">
              <input value={content} onChange={handleTyping} placeholder="Write a message..." className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20" />
              <button disabled={!content.trim() || isSending} className="rounded-2xl bg-indigo-600 px-5 font-bold text-white shadow-lg shadow-indigo-200 transition duration-200 hover:-translate-y-0.5 hover:bg-indigo-700 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none">{isSending ? "Sending..." : <>Send <span className="hidden sm:inline">↗</span></>}</button>
            </form>
          </> : <div className="grid flex-1 place-items-center bg-[radial-gradient(circle_at_top,_#eef2ff,_#f8fafc_45%)] p-8 text-center transition-colors duration-500 dark:bg-[radial-gradient(circle_at_top,_#172554,_#020617_48%)]"><div><div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-indigo-600 text-4xl shadow-xl shadow-indigo-200 dark:shadow-indigo-950">✦</div><h2 className="text-2xl font-black text-slate-800 dark:text-white">Your conversations, alive.</h2><p className="mt-2 text-slate-500 dark:text-slate-400">Choose a chat or find someone to start messaging.</p></div></div>}
        </section>
      </section>
      {groupModalOpen && <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"><div className="w-full max-w-md animate-[authIn_.22s_ease-out] rounded-3xl border border-white/50 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"><div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500">NovaChat</p><h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Create a group</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Pick at least two people to start.</p></div><button onClick={() => setGroupModalOpen(false)} className="rounded-xl px-2 py-1 text-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">×</button></div><input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Group name" className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /><input value={groupSearch} onChange={(event) => { setGroupSearch(event.target.value); searchGroupUsers(event.target.value, setGroupResults); }} placeholder="Search people to add..." className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /><div className="mt-3 flex flex-wrap gap-2">{groupMembers.map((member) => <button key={member._id} onClick={() => toggleGroupMember(member)} className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">{member.name} ×</button>)}</div><div className="mt-3 max-h-44 space-y-1 overflow-y-auto">{groupResults.map((person) => { const selected = groupMembers.some((member) => member._id === person._id); return <button key={person._id} onClick={() => toggleGroupMember(person)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${selected ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}><span className="font-semibold dark:text-slate-200">{person.name}</span><span className="font-bold">{selected ? "✓" : "+"}</span></button>; })}</div><button onClick={createGroup} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 font-bold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 dark:shadow-indigo-950">Create group</button></div></div>}
    </main>
  );
}

export default Chat;
