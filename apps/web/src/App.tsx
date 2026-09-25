import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";
import AuthPage from "./pages/AuthPage";
import LibraryPage from "./pages/LibraryPage";
import UploadPage from "./pages/UploadPage";
import WorkspacePage from "./pages/WorkspacePage";
import AdminPage from "./pages/AdminPage";
import Layout from "./components/Layout";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{ background: "var(--surface-0)" }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
             style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading ClipMind…</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { user } = useAuthStore();
  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/library" replace /> : <AuthPage />} />
      <Route path="/library" element={<PrivateRoute><LibraryPage /></PrivateRoute>} />
      <Route path="/upload" element={<PrivateRoute><UploadPage /></PrivateRoute>} />
      <Route path="/videos/:id" element={<PrivateRoute><WorkspacePage /></PrivateRoute>} />
      <Route path="/admin" element={<PrivateRoute><AdminPage /></PrivateRoute>} />
      <Route path="*" element={<Navigate to={user ? "/library" : "/auth"} replace />} />
    </Routes>
  );
}
