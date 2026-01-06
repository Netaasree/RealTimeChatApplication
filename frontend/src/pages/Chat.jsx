import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { socket } from "../socket";
import { useAuth } from "../context/AuthContext";

function Chat() {
  const { user } = useAuth();
  const userInfo = user;
  const navigate = useNavigate();

  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState("");

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const [typingUser, setTypingUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);

  const selectedChatRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingRef = useRef(false);

  /* 🔌 CONNECT SOCKET */
  useEffect(() => {
    if (userInfo && !socket.connected) {
      socket.connect();
      socket.emit("setup", userInfo);
    }
  }, [userInfo]);

  /* 🟢 ONLINE / OFFLINE */
  useEffect(() => {
    socket.on("online users", (users) => {
      setOnlineUsers(users);
    });

    socket.on("user online", (userId) => {
      setOnlineUsers((prev) =>
        prev.includes(userId) ? prev : [...prev, userId]
      );
    });

    socket.on("user offline", (userId) => {
      setOnlineUsers((prev) => prev.filter((id) => id !== userId));
    });

    return () => {
      socket.off("online users");
      socket.off("user online");
      socket.off("user offline");
    };
  }, []);

  const isUserOnline = (userId) => onlineUsers.includes(userId);

  /* 🔁 CHAT REF */
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  /* 📩 RECEIVE MESSAGE */
  useEffect(() => {
    const handleMessage = (newMessage) => {
      if (
        selectedChatRef.current &&
        newMessage.chat._id === selectedChatRef.current._id &&
        newMessage.sender._id !== userInfo._id
      ) {
        setMessages((prev) => [...prev, newMessage]);
      }
    };

    socket.on("message received", handleMessage);
    return () => socket.off("message received", handleMessage);
  }, [userInfo]);

  /* ✍️ TYPING */
  useEffect(() => {
    socket.on("typing", ({ chatId, userName }) => {
      if (selectedChatRef.current?._id === chatId) {
        setTypingUser(userName);
      }
    });

    socket.on("stop typing", ({ chatId }) => {
      if (selectedChatRef.current?._id === chatId) {
        setTypingUser(null);
      }
    });

    return () => {
      socket.off("typing");
      socket.off("stop typing");
    };
  }, []);

  /* 📥 FETCH CHATS */
  useEffect(() => {
    const fetchChats = async () => {
      const { data } = await API.get("/chat");
      setChats(data);
    };
    fetchChats();
  }, []);

  /* 📥 FETCH MESSAGES */
  useEffect(() => {
    if (!selectedChat) return;

    const fetchMessages = async () => {
      const { data } = await API.get(`/message/${selectedChat._id}`);
      setMessages(data);
      socket.emit("join chat", selectedChat._id);
    };

    fetchMessages();
  }, [selectedChat]);

  /* ⬇️ AUTO SCROLL */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* 📤 SEND MESSAGE */
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    const { data } = await API.post("/message", {
      content,
      chatId: selectedChat._id,
    });

    setMessages((prev) => [...prev, data]);
    socket.emit("new message", data);
    socket.emit("stop typing", { chatId: selectedChat._id });

    typingRef.current = false;
    setContent("");
  };

  /* ✍️ HANDLE TYPING */
  const handleTyping = (e) => {
    setContent(e.target.value);

    if (!typingRef.current) {
      typingRef.current = true;
      socket.emit("typing", {
        chatId: selectedChat._id,
        userName: userInfo.name,
      });
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop typing", { chatId: selectedChat._id });
      typingRef.current = false;
    }, 1000);
  };

  /* 🔍 SEARCH USERS */
  const handleSearch = async (query) => {
    setSearch(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const { data } = await API.get(`/users?search=${query}`);
    setSearchResults(data);
  };

  /* ➕ CREATE / OPEN CHAT */
  const accessChat = async (userId) => {
    const { data } = await API.post("/chat", { userId });

    if (!chats.find((c) => c._id === data._id)) {
      setChats([data, ...chats]);
    }

    setSelectedChat(data);
    setSearch("");
    setSearchResults([]);
  };

  /* 🚪 LOGOUT (100% SAFE) */
  const handleLogout = () => {
    socket.emit("logout", userInfo._id);
    socket.disconnect();
    localStorage.clear();
    navigate("/", { replace: true });
  };

  /* 👤 OTHER USER IN CHAT (FIXED _id BUG) */
  const chatUser = selectedChat?.users.find(
    (u) => u._id !== userInfo._id
  );

  return (
    <div className="flex h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
      {/* LEFT */}
      <div className="w-1/4 bg-white border-r p-4">
        <h2 className="text-lg font-bold text-indigo-700 mb-4">
          💬 My Chats
        </h2>

        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search users..."
          className="w-full border rounded-full px-4 py-2 mb-4"
        />

        {searchResults.map((u) => (
          <div
            key={u._id}
            onClick={() => accessChat(u._id)}
            className="p-2 rounded-lg cursor-pointer hover:bg-indigo-100"
          >
            {u.name}
          </div>
        ))}

        {chats.map((chat) => {
          const other = chat.users.find(
            (u) => u._id !== userInfo._id
          );
          return (
            <div
              key={chat._id}
              onClick={() => setSelectedChat(chat)}
              className="p-3 rounded-lg mb-2 flex justify-between hover:bg-gray-100"
            >
              <span>{other?.name}</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  isUserOnline(other?._id)
                    ? "bg-green-500"
                    : "bg-gray-400"
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* RIGHT */}
      <div className="w-3/4 flex flex-col">
        {selectedChat ? (
          <>
            <div className="p-4 bg-white border-b flex justify-between">
              <div>
                <div className="font-bold text-lg">
                  {chatUser?.name}
                </div>
                <div className="text-sm text-gray-500">
                  {isUserOnline(chatUser?._id)
                    ? "Online 🟢"
                    : "Offline ⚪"}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="text-red-500 hover:text-red-700"
              >
                Logout
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map((msg) => (
                <div
                  key={msg._id}
                  className={`max-w-[60%] px-4 py-2 rounded-xl ${
                    msg.sender._id === userInfo._id
                      ? "bg-indigo-600 text-white ml-auto"
                      : "bg-white"
                  }`}
                >
                  {msg.content}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {typingUser && (
              <div className="px-4 text-sm italic text-gray-500">
                {typingUser} is typing...
              </div>
            )}

            <form
              onSubmit={sendMessage}
              className="p-4 bg-white border-t flex gap-2"
            >
              <input
                className="flex-1 border rounded-full px-4 py-2"
                value={content}
                onChange={handleTyping}
                placeholder="Type a message..."
              />
              <button className="bg-indigo-600 text-white px-6 rounded-full">
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-xl">
            Welcome to Chat 🚀
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;
