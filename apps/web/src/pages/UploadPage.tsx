import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Film, CheckCircle, AlertCircle, X } from "lucide-react";
import { api } from "../lib/api";
import { formatBytes } from "../lib/utils";
import { cn } from "../lib/utils";

const ACCEPT = ".mp4,.mov,.webm,.avi,.mkv";
const MAX_MB = 2048;

export default function UploadPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [videoId, setVideoId] = useState("");

  const pick = (f: File) => {
    setError("");
    setState("idle");
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File exceeds ${MAX_MB} MB limit`);
      return;
    }
    setFile(f);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pick(f);
  }, []);

  const upload = async () => {
    if (!file) return;
    setState("uploading");
    setProgress(0);
    setError("");
    try {
      const res = await api.uploadVideo(file, setProgress) as any;
      setVideoId(res.id);
      setState("done");
    } catch (e: any) {
      setError(e.message);
      setState("error");
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Upload Video</h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
        MP4, MOV, WebM, AVI, MKV · up to {MAX_MB / 1024} GB
      </p>

      {/* Drop zone */}
      <div
        onClick={() => state === "idle" && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "relative rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-4 py-16",
          dragging
            ? "border-indigo-400 bg-indigo-500/10"
            : file
            ? "border-indigo-500/40 bg-indigo-500/5"
            : "border-zinc-700 hover:border-indigo-500/50 hover:bg-white/[0.02]",
          state === "uploading" ? "pointer-events-none" : ""
        )}>
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden"
               onChange={e => e.target.files?.[0] && pick(e.target.files[0])} />

        {state === "done" ? (
          <>
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
                 style={{ background: "rgba(52,211,153,0.15)" }}>
              <CheckCircle size={32} style={{ color: "#34d399" }} />
            </div>
            <p className="text-base font-semibold" style={{ color: "#34d399" }}>Upload complete!</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Processing has started in the background</p>
          </>
        ) : state === "uploading" ? (
          <>
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
                 style={{ background: "var(--accent-glow)" }}>
              <Upload size={28} style={{ color: "var(--accent)" }} className="animate-bounce" />
            </div>
            <p className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
              Uploading… {progress}%
            </p>
            {/* Progress bar */}
            <div className="w-64 h-1.5 rounded-full overflow-hidden"
                 style={{ background: "var(--surface-4)" }}>
              <div className="h-full rounded-full transition-all duration-200"
                   style={{ width: `${progress}%`, background: "linear-gradient(90deg, var(--accent), var(--accent-2))" }} />
            </div>
          </>
        ) : file ? (
          <>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                 style={{ background: "var(--surface-3)" }}>
              <Film size={28} style={{ color: "var(--accent)" }} />
            </div>
            <div className="text-center">
              <p className="text-base font-medium" style={{ color: "var(--text-primary)" }}>{file.name}</p>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{formatBytes(file.size)}</p>
            </div>
            <button onClick={e => { e.stopPropagation(); setFile(null); setState("idle"); }}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              style={{ color: "var(--text-muted)" }}>
              <X size={16} />
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                 style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}>
              <Upload size={28} style={{ color: "var(--text-muted)" }} />
            </div>
            <div className="text-center">
              <p className="text-base font-medium" style={{ color: "var(--text-secondary)" }}>
                Drag & drop or click to browse
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                MP4, MOV, WebM, AVI, MKV
              </p>
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {(error || state === "error") && (
        <div className="mt-4 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm"
             style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}>
          <AlertCircle size={16} />
          {error || "Upload failed. Please try again."}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        {state === "done" ? (
          <>
            <button onClick={() => navigate(`/videos/${videoId}`)}
              className="btn-primary flex-1 py-3 rounded-xl text-sm">
              View in Workspace
            </button>
            <button onClick={() => { setFile(null); setState("idle"); setProgress(0); }}
              className="btn-ghost px-6 py-3 rounded-xl text-sm">
              Upload another
            </button>
          </>
        ) : (
          <button onClick={upload} disabled={!file || state === "uploading"}
            className="btn-primary flex-1 py-3 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {state === "uploading" ? `Uploading ${progress}%…` : "Start Upload"}
          </button>
        )}
      </div>
    </div>
  );
}
