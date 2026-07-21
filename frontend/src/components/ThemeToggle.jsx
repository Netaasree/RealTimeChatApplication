import { useTheme } from "../context/ThemeContext";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button onClick={toggleTheme} aria-label={`Switch to ${isDark ? "light" : "dark"} mode`} className="group grid h-10 w-10 place-items-center rounded-2xl border border-slate-200/70 bg-white/80 text-lg shadow-sm backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:rotate-6 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/80">
      <span className="transition duration-300 group-hover:scale-110">{isDark ? "☀" : "☾"}</span>
    </button>
  );
}

export default ThemeToggle;
