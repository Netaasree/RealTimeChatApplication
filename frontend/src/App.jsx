import { useState } from "react";
import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Chat from "./pages/Chat";
import PageTransition from "./components/PageTransition";
import StartupSplash from "./components/StartupSplash";
import SignInTransition from "./components/SignInTransition";
import { useAuth } from "./context/AuthContext";
import { TransitionProvider } from "./context/TransitionContext";

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user?.token ? children : <Navigate to="/" replace />;
}

function PublicRoute({ children }) {
  const { user } = useAuth();
  return user?.token ? <Navigate to="/chat" replace /> : children;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <PublicRoute>
              <PageTransition>
                <Login />
              </PageTransition>
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <PageTransition>
                <Register />
              </PageTransition>
            </PublicRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <PageTransition>
                <Chat />
              </PageTransition>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <TransitionProvider>
      <BrowserRouter>
        {showSplash && <StartupSplash onComplete={() => setShowSplash(false)} />}
        <AnimatedRoutes />
        {/* Cinematic transition overlay — lives OUTSIDE routes, rendered via portal */}
        <SignInTransition />
      </BrowserRouter>
    </TransitionProvider>
  );
}

export default App;
