import { createContext, useContext, useState, useEffect } from "react";
import { socket } from "../socket";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("userInfo"))
  );

  useEffect(() => {
    if (user && !socket.connected) {
      socket.connect();
      socket.emit("setup", user);
    }

    return () => {
      socket.off("connected");
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
