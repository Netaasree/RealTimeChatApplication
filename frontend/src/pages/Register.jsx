import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import { usePageTransition } from "../context/TransitionContext";
import ThemeToggle from "../components/ThemeToggle";
import CursorField from "../components/CursorField";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const { triggerTransition } = usePageTransition();
  const btnRef = useRef(null);

  const submitHandler = async (event) => {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setIsLoading(true);
    try {
      const { data } = await API.post("/auth/register", { name, email, password });
      sessionStorage.setItem("userInfo", JSON.stringify(data));

      // Defer setUser until the overlay fully covers the screen (phase 2)
      let rect = null;
      if (btnRef.current) {
        const r = btnRef.current.getBoundingClientRect();
        rect = { x: r.left, y: r.top, width: r.width, height: r.height };
      }
      triggerTransition(rect, () => {
        setUser(data);
        navigate("/chat");
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Registration failed. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <main className="font-body relative grid min-h-screen place-items-center overflow-hidden bg-ivory px-4 py-8 transition-colors duration-500 dark:bg-navy">
      <CursorField variant="auth" enableClickBurst />
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-amber/30 blur-3xl dark:bg-amber/15" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-navy/15 blur-3xl dark:bg-ivory/10" />
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
      <Motion.section
        initial={{ opacity: 0, y: 25, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md rounded-[2rem] border border-white/70 bg-ivory/80 p-7 shadow-2xl shadow-amber/20 backdrop-blur-xl sm:p-9 dark:border-ivory/10 dark:bg-navy/85 dark:shadow-black/40"
      >
        <div className="mb-8 text-center">
          <Motion.div
            whileHover={{ scale: 1.1, rotate: -10 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-amber via-indigo-600 to-violet-600 text-2xl text-white shadow-lg shadow-indigo-300 dark:shadow-indigo-950"
          >
            ✦
          </Motion.div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-amber">Join NovaChat</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Create an account
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sign up to start chatting.</p>
        </div>
        <form onSubmit={submitHandler} className="space-y-4">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
            Full Name
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="mt-1.5 w-full rounded-2xl border border-navy/10 bg-white/60 px-4 py-3 outline-none transition focus:border-amber focus:ring-4 focus:ring-amber/15 dark:border-ivory/15 dark:bg-navy/60 dark:text-ivory dark:focus:ring-amber/10"
            />
          </label>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
            Email
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-1.5 w-full rounded-2xl border border-navy/10 bg-white/60 px-4 py-3 outline-none transition focus:border-amber focus:ring-4 focus:ring-amber/15 dark:border-ivory/15 dark:bg-navy/60 dark:text-ivory dark:focus:ring-amber/10"
            />
          </label>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
            Password
            <input
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="mt-1.5 w-full rounded-2xl border border-navy/10 bg-white/60 px-4 py-3 outline-none transition focus:border-amber focus:ring-4 focus:ring-amber/15 dark:border-ivory/15 dark:bg-navy/60 dark:text-ivory dark:focus:ring-amber/10"
            />
          </label>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
            Confirm Password
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              className="mt-1.5 w-full rounded-2xl border border-navy/10 bg-white/60 px-4 py-3 outline-none transition focus:border-amber focus:ring-4 focus:ring-amber/15 dark:border-ivory/15 dark:bg-navy/60 dark:text-ivory dark:focus:ring-amber/10"
            />
          </label>
          {error && (
            <p className="animate-[fadeIn_.2s_ease-out] rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 dark:bg-rose-500/10">
              {error}
            </p>
          )}
          <Motion.button
            ref={btnRef}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            disabled={isLoading}
            className="w-full rounded-2xl bg-gradient-to-r from-amber via-indigo-600 to-violet-600 py-3.5 font-bold text-white shadow-lg shadow-amber/20 transition duration-200 hover:shadow-xl hover:shadow-amber/30 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-indigo-950"
          >
            {isLoading ? "Creating account..." : "Create Account →"}
          </Motion.button>
        </form>
        <p className="mt-7 text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{" "}
          <Link
            to="/"
            className="font-bold text-indigo-600 transition hover:text-violet-600 dark:text-indigo-400"
          >
            Sign in
          </Link>
        </p>
      </Motion.section>
    </main>
  );
}

export default Register;
