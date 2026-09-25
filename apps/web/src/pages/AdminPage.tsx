import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { useNavigate } from "react-router-dom";
import { Shield, Users, Film, RefreshCw, ChevronDown } from "lucide-react";
import { timeAgo } from "../lib/utils";

export default function AdminPage() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.role !== "admin") { navigate("/library"); return; }
    const unsub = onSnapshot(collection(db, "users"), snap => {
      setUsers(snap.docs.map(d => d.data()).sort((a,b) => a.email.localeCompare(b.email)));
    });
    api.adminStats().then(setStats).catch(() => {});
    return unsub;
  }, [profile]);

  const setRole = async (uid: string, role: string) => {
    setUpdating(uid);
    try { await api.adminSetRole(uid, role); }
    catch (e: any) { alert(e.message); }
    finally { setUpdating(null); }
  };

  return (
    <div className="p-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
             style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}>
          <Shield size={20} color="white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Admin</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Manage users and platform</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          {[
            { icon: Users, label: "Total Users", value: stats.users, color: "#818cf8" },
            { icon: Film,  label: "Total Videos", value: stats.videos, color: "#a78bfa" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-6 flex items-center gap-4"
                 style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                   style={{ background: `${s.color}22` }}>
                <s.icon size={22} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{s.value}</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="px-6 py-4 flex items-center justify-between"
             style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Users ({users.length})
          </h2>
          <button onClick={() => api.adminStats().then(setStats)}
            className="btn-ghost p-2 rounded-lg">
            <RefreshCw size={14} />
          </button>
        </div>
        <div style={{ background: "var(--surface-1)" }}>
          {users.map(u => (
            <div key={u.uid} className="flex items-center gap-4 px-6 py-4 border-b"
                 style={{ borderColor: "var(--border-subtle)" }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                   style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))", color: "white" }}>
                {(u.display_name || u.email || "?").slice(0,2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {u.display_name || "—"}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{u.email}</p>
              </div>
              <p className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
                {timeAgo(u.created_at)}
              </p>
              {/* Role selector */}
              <div className="relative shrink-0">
                <select value={u.role} disabled={updating === u.uid || u.uid === profile?.uid}
                  onChange={e => setRole(u.uid, e.target.value)}
                  className="appearance-none pr-7 pl-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                  style={{
                    background: u.role === "admin" ? "rgba(99,102,241,0.15)" : "var(--surface-3)",
                    border: `1px solid ${u.role === "admin" ? "rgba(99,102,241,0.3)" : "var(--border)"}`,
                    color: u.role === "admin" ? "var(--accent)" : "var(--text-secondary)",
                  }}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                             style={{ color: "var(--text-muted)" }} />
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>No users yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
