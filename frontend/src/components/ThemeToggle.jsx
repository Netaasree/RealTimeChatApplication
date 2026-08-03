import { motion as Motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../context/ThemeContext";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="group relative grid h-10 w-10 place-items-center overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 text-lg shadow-sm backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/80"
    >
      <AnimatePresence mode="wait" initial={false}>
        <Motion.span
          key={isDark ? "dark" : "light"}
          initial={{ opacity: 0, rotate: isDark ? -90 : 90, scale: 0.5 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: isDark ? 90 : -90, scale: 0.5 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="col-start-1 row-start-1 transition duration-300 group-hover:scale-110"
        >
          {isDark ? "☀" : "☾"}
        </Motion.span>
      </AnimatePresence>
    </button>
  );
}

export default ThemeToggle;
