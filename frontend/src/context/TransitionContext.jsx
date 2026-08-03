/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from "react";

const TransitionContext = createContext(null);

export function TransitionProvider({ children }) {
  const [transition, setTransition] = useState({
    active: false,
    originRect: null,
    onNavigate: null,
  });

  const triggerTransition = useCallback((rect, navigateCb) => {
    setTransition({ active: true, originRect: rect, onNavigate: navigateCb });
  }, []);

  const clearTransition = useCallback(() => {
    setTransition({ active: false, originRect: null, onNavigate: null });
  }, []);

  return (
    <TransitionContext.Provider value={{ transition, triggerTransition, clearTransition }}>
      {children}
    </TransitionContext.Provider>
  );
}

export function usePageTransition() {
  return useContext(TransitionContext);
}
