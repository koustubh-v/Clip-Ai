import { useState } from "react";
import { Sparkles, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";

type Mode = "login" | "signup";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const { signIn, signUp, signInGoogle, error, setError } = useAuthStore();
  const navigate = useNavigate();

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await signIn(email, password);
      else await signUp(email, password, name);
      navigate("/library");
    } catch { /* error set by store */ }
    finally { setBusy(false); }
  };

  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInGoogle();
      navigate("/library");
    } catch { }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: "radial-gradient(ellipse at 60% 0%, rgba(99,102,241,0.08) 0%, var(--surface-0) 70%)" }}>
      {/* Background grid */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]"
           style={{ backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      <div className="w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
               style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 0 32px rgba(99,102,241,0.35)" }}>
            <Sparkles size={28} color="white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold gradient-text">ClipMind</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              AI-powered video intelligence
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 glass">
          {/* Mode tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-7"
               style={{ background: "var(--surface-3)" }}>
            {(["login","signup"] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(null); }}
                className={cn("flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                  mode === m ? "text-white shadow-sm" : "")}
                style={mode === m ? {
                  background: "linear-gradient(135deg, var(--accent), var(--accent-2))"
                } : { color: "var(--text-muted)" }}>
                {m === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl px-4 py-3 mb-5 text-sm"
                 style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}>
              {error}
            </div>
          )}

          <form onSubmit={handle} className="flex flex-col gap-4">
            {mode === "signup" && (
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2"
                     style={{ color: "var(--text-muted)" }} />
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="Display name" required minLength={2}
                  className="input w-full pl-10 pr-4 py-3 text-sm"
                  style={{ background: "var(--surface-3)" }} />
              </div>
            )}
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2"
                   style={{ color: "var(--text-muted)" }} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email address" required
                className="input w-full pl-10 pr-4 py-3 text-sm"
                style={{ background: "var(--surface-3)" }} />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2"
                   style={{ color: "var(--text-muted)" }} />
              <input type={showPw ? "text" : "password"} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password" required minLength={6}
                className="input w-full pl-10 pr-10 py-3 text-sm"
                style={{ background: "var(--surface-3)" }} />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5"
                style={{ color: "var(--text-muted)" }}>
                {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>

            <button type="submit" disabled={busy}
              className="btn-primary w-full py-3 rounded-xl text-sm mt-1 disabled:opacity-60 disabled:cursor-not-allowed">
              {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>

          {/* Google */}
          <button onClick={handleGoogle} disabled={busy}
            className="btn-ghost w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2.5 disabled:opacity-60">
            🌐
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
