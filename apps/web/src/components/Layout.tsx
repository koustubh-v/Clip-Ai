import { Link, useLocation, useNavigate } from "react-router-dom";
import { Upload, LayoutGrid, Shield, LogOut, Sparkles } from "lucide-react";
import { useAuthStore } from "../stores/authStore";

const NAV = [
  { to: "/library", icon: LayoutGrid, label: "Library" },
  { to: "/upload",  icon: Upload,     label: "Upload"  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { profile, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => { await logout(); navigate("/auth"); };
  const initials = (profile?.display_name || "?").slice(0, 2).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--surface-0)" }}>
      {/* Sidebar */}
      <aside className="flex flex-col w-60 shrink-0 border-r py-5 px-3"
             style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
        {/* Logo */}
        <Link to="/library" className="flex items-center gap-2.5 px-3 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
               style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}>
            <Sparkles size={16} color="white" />
          </div>
          <span className="font-semibold text-base gradient-text tracking-tight">ClipMind</span>
        </Link>

        {/* Nav */}
        <nav className="flex flex-col gap-1 flex-1">
          {NAV.map(({ to, icon: Icon, label }) => {
            const active = pathname === to || (to !== "/" && pathname.startsWith(to));
            return (
              <Link key={to} to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "text-white"
                    : "hover:bg-white/5"
                }`}
                style={active ? {
                  background: "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.12))",
                  color: "var(--text-primary)",
                  boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.25)"
                } : { color: "var(--text-muted)" }}>
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
          {profile?.role === "admin" && (
            <Link to="/admin"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                pathname === "/admin" ? "text-white" : "hover:bg-white/5"
              }`}
              style={pathname === "/admin" ? {
                background: "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.12))",
                color: "var(--text-primary)",
                boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.25)"
              } : { color: "var(--text-muted)" }}>
              <Shield size={16} />
              Admin
            </Link>
          )}
        </nav>

        {/* User footer */}
        <div className="border-t pt-4 mt-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3 px-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                 style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))", color: "white" }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {profile?.display_name || "User"}
              </p>
              <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                {profile?.role === "admin" ? "Administrator" : "Member"}
              </p>
            </div>
            <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    style={{ color: "var(--text-muted)" }} title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
