import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuthStore } from "../stores/authStore";
import { formatDuration, formatBytes, timeAgo, STATUS_CONFIG } from "../lib/utils";
import { Upload, Search, Film, Trash2, Clock, HardDrive } from "lucide-react";
import { api } from "../lib/api";

export default function LibraryPage() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = profile?.role === "admin"
      ? query(collection(db, "videos"))
      : query(collection(db, "videos"), where("owner_id", "==", user.uid));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      // Sort client-side — no composite index needed
      docs.sort((a, b) => {
        const ta = a.created_at?.toMillis?.() ?? 0;
        const tb = b.created_at?.toMillis?.() ?? 0;
        return tb - ta;
      });
      setVideos(docs);
    });
    return unsub;
  }, [user, profile]);

  const filtered = videos.filter(v =>
    !search || v.original_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this video? This cannot be undone.")) return;
    setDeleting(id);
    
    // Optimistic UI update
    setVideos(prev => prev.filter(v => v.id !== id));
    
    try { 
      await api.deleteVideo(id); 
    } catch (err: any) { 
      alert(err.message);
      // Let the snapshot listener restore it if it failed
    } finally { 
      setDeleting(null); 
    }
  };

  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

  return (
    <div className="p-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Video Library
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {filtered.length} video{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={() => navigate("/upload")}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm">
          <Upload size={16} />
          Upload Video
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2"
               style={{ color: "var(--text-muted)" }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by filename…"
          className="input w-full max-w-md pl-10 pr-4 py-2.5 text-sm" />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
               style={{ background: "var(--surface-2)" }}>
            <Film size={32} style={{ color: "var(--text-muted)" }} />
          </div>
          <p className="text-base font-medium" style={{ color: "var(--text-secondary)" }}>
            {search ? "No videos match your search" : "No videos yet"}
          </p>
          {!search && (
            <button onClick={() => navigate("/upload")} className="btn-primary px-5 py-2.5 rounded-xl text-sm">
              Upload your first video
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(video => {
            const cfg = STATUS_CONFIG[video.status] ?? STATUS_CONFIG.processing;
            return (
              <div key={video.id} className="video-card cursor-pointer group"
                   onClick={() => navigate(`/videos/${video.id}`)}>
                {/* Thumbnail */}
                <div className="relative aspect-video overflow-hidden"
                     style={{ background: "var(--surface-3)" }}>
                  {video.thumbnail_path ? (
                    <img src={`${API_BASE}/${video.thumbnail_path}`} alt={video.original_name}
                         className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film size={28} style={{ color: "var(--text-muted)" }} />
                    </div>
                  )}
                  {/* Duration overlay */}
                  {video.duration_s && (
                    <span className="absolute bottom-2 right-2 text-xs font-mono font-medium px-2 py-0.5 rounded-md"
                          style={{ background: "rgba(0,0,0,0.75)", color: "white" }}>
                      {formatDuration(video.duration_s)}
                    </span>
                  )}
                  {/* Delete btn */}
                  <button onClick={e => handleDelete(e, video.id)}
                    disabled={deleting === video.id}
                    className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    style={{ background: "rgba(239,68,68,0.85)", color: "white" }}>
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="text-sm font-medium truncate mb-2" style={{ color: "var(--text-primary)" }}>
                    {video.original_name}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${cfg.color} ${cfg.pulse ? "animate-pulse-slow" : ""}`}>
                      {cfg.label}
                    </span>
                    <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      <span className="flex items-center gap-1">
                        <HardDrive size={11} />
                        {formatBytes(video.size_bytes)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs mt-2.5 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                    <Clock size={11} />
                    {timeAgo(video.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
