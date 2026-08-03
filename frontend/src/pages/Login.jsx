import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";
import CursorField from "../components/CursorField";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const submitHandler = async (event) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const { data } = await API.post("/auth/login", { email, password });
      sessionStorage.setItem("userInfo", JSON.stringify(data));
      setUser(data);
      navigate("/chat");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Login failed. Please try again.");
      setIsLoading(false);
    }
  };

  return <main className="font-body relative grid min-h-screen place-items-center overflow-hidden bg-ivory px-4 py-8 transition-colors duration-500 dark:bg-navy">
    <CursorField variant="auth" enableClickBurst />
    <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-amber/30 blur-3xl animate-[float_.8s_ease-in-out] dark:bg-amber/15" />
    <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-navy/15 blur-3xl dark:bg-ivory/10" />
    <div className="absolute right-5 top-5"><ThemeToggle /></div>
    <section className="relative w-full max-w-md animate-[authIn_.5s_ease-out] rounded-[2rem] border border-white/70 bg-ivory/80 p-7 shadow-2xl shadow-amber/20 backdrop-blur-xl sm:p-9 dark:border-ivory/10 dark:bg-navy/85 dark:shadow-black/40">
      <div className="mb-8 text-center"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-2xl text-white shadow-lg shadow-indigo-300">✦</div><p className="text-xs font-black uppercase tracking-[0.24em] text-indigo-500">Welcome back</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">Sign in to NovaChat</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Your conversations are waiting.</p></div>
      <form onSubmit={submitHandler} className="space-y-4">
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Email<input type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required className="mt-1.5 w-full rounded-2xl border border-navy/10 bg-white/60 px-4 py-3 outline-none transition focus:border-amber focus:ring-4 focus:ring-amber/15 dark:border-ivory/15 dark:bg-navy/60 dark:text-ivory dark:focus:ring-amber/10" /></label>
        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Password<input type="password" placeholder="Your password" value={password} onChange={(event) => setPassword(event.target.value)} required className="mt-1.5 w-full rounded-2xl border border-navy/10 bg-white/60 px-4 py-3 outline-none transition focus:border-amber focus:ring-4 focus:ring-amber/15 dark:border-ivory/15 dark:bg-navy/60 dark:text-ivory dark:focus:ring-amber/10" /></label>
        {error && <p className="animate-[fadeIn_.2s_ease-out] rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 dark:bg-rose-500/10">{error}</p>}
        <button disabled={isLoading} className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 font-bold text-white shadow-lg shadow-indigo-200 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-indigo-950">{isLoading ? "Signing in..." : "Sign in →"}</button>
      </form>
      <p className="mt-7 text-center text-sm text-slate-500 dark:text-slate-400">New here? <Link to="/register" className="font-bold text-indigo-600 transition hover:text-violet-600 dark:text-indigo-400">Create an account</Link></p>
    </section>
  </main>;
}

export default Login;
