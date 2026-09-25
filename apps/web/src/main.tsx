import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import "./stores/authStore"; // init listener
import { FIREBASE_CONFIGURED } from "./lib/firebase";

function SetupScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6"
         style={{ background: "var(--surface-0)" }}>
      <div className="max-w-xl w-full glass rounded-2xl p-8 animate-slide-up">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
               style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>✦</div>
          <div>
            <h1 className="text-xl font-bold gradient-text">ClipMind v2</h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Setup required</p>
          </div>
        </div>
        <p className="text-sm mb-5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Firebase is not configured. Create a <code className="px-1.5 py-0.5 rounded"
          style={{ background: "var(--surface-3)", fontFamily: "JetBrains Mono, monospace" }}>apps/web/.env</code> file with your Firebase project credentials.
        </p>
        <div className="rounded-xl p-4 font-mono text-xs leading-7 overflow-auto"
             style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "#a5f3fc" }}>
          <div><span style={{ color: "var(--text-muted)" }}># apps/web/.env</span></div>
          <div>VITE_FIREBASE_API_KEY=<span style={{ color: "#fde68a" }}>your-api-key</span></div>
          <div>VITE_FIREBASE_AUTH_DOMAIN=<span style={{ color: "#fde68a" }}>project.firebaseapp.com</span></div>
          <div>VITE_FIREBASE_PROJECT_ID=<span style={{ color: "#fde68a" }}>your-project-id</span></div>
          <div>VITE_FIREBASE_STORAGE_BUCKET=<span style={{ color: "#fde68a" }}>project.appspot.com</span></div>
          <div>VITE_FIREBASE_MESSAGING_SENDER_ID=<span style={{ color: "#fde68a" }}>123456789</span></div>
          <div>VITE_FIREBASE_APP_ID=<span style={{ color: "#fde68a" }}>1:123:web:abc</span></div>
          <div>VITE_API_URL=<span style={{ color: "#fde68a" }}>http://localhost:8000</span></div>
        </div>
        <div className="mt-4 rounded-xl px-4 py-3 text-xs" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc" }}>
          See the <strong>README.md</strong> at the project root for full setup steps.
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {FIREBASE_CONFIGURED ? (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    ) : (
      <SetupScreen />
    )}
  </React.StrictMode>
);

