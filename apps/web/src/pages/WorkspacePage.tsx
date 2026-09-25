import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, collection, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { api } from "../lib/api";
import { formatDuration, STATUS_CONFIG } from "../lib/utils";
import {
  ArrowLeft, Download, Search, FileText, Sparkles, Zap, Tag,
  Play, Loader2, ChevronDown
} from "lucide-react";
import { cn } from "../lib/utils";

type Tab = "transcript" | "summary" | "moments" | "insights";

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [video, setVideo] = useState<any>(null);
  const [jobs, setJobs] = useState<any>({});
  const [tab, setTab] = useState<Tab>("transcript");
  const [segments, setSegments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [moments, setMoments] = useState<any[]>([]);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showExport, setShowExport] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

  // Real-time video doc + jobs
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "videos", id), snap => {
      if (snap.exists()) setVideo({ id: snap.id, ...snap.data() });
    });
    const unsubJobs = onSnapshot(
      collection(doc(db, "videos", id), "jobs"),
      snap => setJobs(Object.fromEntries(snap.docs.map(d => [d.id, d.data()])))
    );
    return () => { unsub(); unsubJobs(); };
  }, [id]);

  // Real-time transcript segments
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(
      query(collection(doc(db, "videos", id), "segments")),
      snap => {
        const segs = snap.docs.map(d => d.data());
        segs.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
        setSegments(segs);
      }
    );
    return unsub;
  }, [id]);

  // Real-time summary + moments + keywords
  useEffect(() => {
    if (!id) return;
    const u1 = onSnapshot(collection(doc(db, "videos", id), "summaries"),
      snap => setSummary(Object.fromEntries(snap.docs.map(d => [d.id, d.data()]))));
    const u2 = onSnapshot(query(collection(doc(db, "videos", id), "keyMoments")),
      snap => {
        const ms = snap.docs.map(d => d.data());
        ms.sort((a, b) => (a.start_s ?? 0) - (b.start_s ?? 0));
        setMoments(ms);
      });
    const u3 = onSnapshot(collection(doc(db, "videos", id), "keywords"),
      snap => setKeywords(snap.docs.map(d => d.data()).sort((a,b) => b.score - a.score)));
    return () => { u1(); u2(); u3(); };
  }, [id]);

  const seekTo = (s: number) => {
    if (videoRef.current) { videoRef.current.currentTime = s; videoRef.current.play(); }
  };

  const handleSearch = async () => {
    if (!searchQ.trim() || !id) return;
    setSearching(true);
    try {
      const results = await api.searchTranscript(id, searchQ);
      setSearchResults(results);
    } catch { }
    finally { setSearching(false); }
  };

  const exportUrl = (fmt: string) => `${API_BASE}/api/videos/${id}/export?format=${fmt}`;

  if (!video) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
    </div>
  );

  const status = video.status || "processing";
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.processing;

  const TABS: { id: Tab; label: string; icon: any; count?: number }[] = [
    { id: "transcript", label: "Transcript", icon: FileText, count: segments.length },
    { id: "summary",    label: "Summary",    icon: Sparkles },
    { id: "moments",    label: "Moments",    icon: Zap,   count: moments.length },
    { id: "insights",   label: "Keywords",   icon: Tag,   count: keywords.length },
  ];

  return (
    <div className="flex h-full flex-col animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 py-4 border-b shrink-0"
           style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        <button onClick={() => navigate("/library")}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          style={{ color: "var(--text-muted)" }}>
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            {video.original_name}
          </h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {formatDuration(video.duration_s)} · {video.resolution || ""}
          </p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${cfg.color} ${cfg.pulse ? "animate-pulse-slow" : ""}`}>
          {cfg.label}
        </span>
        {/* Export */}
        <div className="relative">
          <button onClick={() => setShowExport(!showExport)}
            className="btn-ghost flex items-center gap-2 px-4 py-2 rounded-xl text-sm">
            <Download size={15} />
            Export
            <ChevronDown size={13} />
          </button>
          {showExport && (
            <div className="absolute right-0 top-full mt-2 w-40 rounded-xl overflow-hidden z-50"
                 style={{ background: "var(--surface-3)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
              {["txt","md","srt","vtt","json"].map(fmt => (
                <a key={fmt} href={exportUrl(fmt)} download
                   onClick={() => setShowExport(false)}
                   className="block px-4 py-2.5 text-sm hover:bg-white/10 transition-colors uppercase font-mono tracking-wide"
                   style={{ color: "var(--text-secondary)" }}>
                  .{fmt}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Body: player left + panel right */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: video + timeline */}
        <div className="flex flex-col w-[52%] shrink-0 border-r"
             style={{ borderColor: "var(--border)", background: "var(--surface-0)" }}>
          {/* Video player */}
          <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
            {video.thumbnail_path || video.stored_name ? (
              <video ref={videoRef} controls className="w-full h-full"
                     onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
                     src={`${API_BASE}/uploads/${video.stored_name}`}
                     poster={video.thumbnail_path ? `${API_BASE}/${video.thumbnail_path}` : undefined}>
              </video>
            ) : (
              <div className="w-full h-full flex items-center justify-center"
                   style={{ background: "var(--surface-2)" }}>
                <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)" }} />
              </div>
            )}
          </div>

          {/* Timeline bar */}
          {moments.length > 0 && video.duration_s && (
            <div className="p-4 border-t" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>KEY MOMENTS</p>
              <div className="relative h-8 rounded-lg overflow-hidden"
                   style={{ background: "var(--surface-3)" }}>
                {/* Playhead */}
                <div className="absolute top-0 h-full w-0.5 z-10 transition-all duration-200"
                     style={{
                       left: `${(currentTime / video.duration_s) * 100}%`,
                       background: "var(--accent)",
                       boxShadow: "0 0 6px var(--accent)"
                     }} />
                {/* Moment markers */}
                {moments.map((m, i) => (
                  <button key={i} title={m.label}
                    onClick={() => seekTo(m.start_s)}
                    className="absolute top-0 h-full opacity-70 hover:opacity-100 transition-opacity"
                    style={{
                      left: `${(m.start_s / video.duration_s) * 100}%`,
                      width: `${Math.max(0.5, ((m.end_s - m.start_s) / video.duration_s) * 100)}%`,
                      background: "linear-gradient(90deg, rgba(99,102,241,0.6), rgba(139,92,246,0.4))",
                    }} />
                ))}
              </div>
            </div>
          )}

          {/* Pipeline progress */}
          {status !== "done" && (
            <div className="p-4 border-t" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-medium mb-3" style={{ color: "var(--text-muted)" }}>PIPELINE</p>
              <div className="flex flex-col gap-2">
                {["audio","transcript","analysis"].map(stage => {
                  const j = jobs[stage];
                  const s = j?.status ?? "queued";
                  const dot = s === "done" ? "bg-emerald-400" : s === "running" ? "bg-indigo-400 animate-pulse" : s === "failed" ? "bg-red-400" : "bg-zinc-600";
                  const label = { audio: "Audio extract", transcript: "Transcription", analysis: "AI analysis" }[stage];
                  return (
                    <div key={stage} className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full ${dot}`} />
                      <span className="text-xs" style={{ color: s === "done" ? "var(--text-secondary)" : "var(--text-muted)" }}>
                        {label}
                      </span>
                      <span className="text-xs ml-auto capitalize" style={{ color: "var(--text-muted)" }}>{s}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: tabs panel */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "var(--surface-1)" }}>
          {/* Tabs */}
          <div className="flex border-b shrink-0 px-2" style={{ borderColor: "var(--border)" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn("flex items-center gap-2 px-4 py-3.5 text-sm font-medium transition-all whitespace-nowrap",
                  tab === t.id ? "tab-active" : "tab-inactive")}>
                <t.icon size={14} />
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-md font-mono"
                        style={{ background: "var(--surface-4)", color: "var(--text-muted)" }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto p-5">
            {tab === "transcript" && (
              <TranscriptPanel segments={segments} searchQ={searchQ} setSearchQ={setSearchQ}
                               searchResults={searchResults} setSearchResults={setSearchResults}
                               searching={searching} onSearch={handleSearch}
                               onSeek={seekTo} currentTime={currentTime} duration={video.duration_s} />
            )}
            {tab === "summary" && <SummaryPanel summary={summary} />}
            {tab === "moments" && (
              <MomentsPanel moments={moments} onSeek={seekTo} duration={video.duration_s} />
            )}
            {tab === "insights" && <KeywordsPanel keywords={keywords} tone={video.tone} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-panels ────────────────────────────────────────────────────────────────

function TranscriptPanel({ segments, searchQ, setSearchQ, searchResults, setSearchResults,
  searching, onSearch, onSeek, currentTime, duration }: any) {

  const displaySegs = searchResults ?? segments;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                 style={{ color: "var(--text-muted)" }} />
          <input value={searchQ} onChange={e => { setSearchQ(e.target.value); if (!e.target.value) setSearchResults(null); }}
            onKeyDown={e => e.key === "Enter" && onSearch()}
            placeholder="Search transcript…" className="input w-full pl-8 pr-3 py-2 text-sm" />
        </div>
        <button onClick={onSearch} disabled={searching || !searchQ.trim()}
          className="btn-ghost px-4 py-2 rounded-xl text-sm disabled:opacity-50">
          {searching ? <Loader2 size={14} className="animate-spin"/> : <Search size={14}/>}
        </button>
        {searchResults && (
          <button onClick={() => { setSearchResults(null); setSearchQ(""); }}
            className="btn-ghost px-3 py-2 rounded-xl text-xs">Clear</button>
        )}
      </div>

      {searchResults && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "{searchQ}"
        </p>
      )}

      {/* Segments */}
      <div className="flex flex-col gap-1.5">
        {displaySegs.length === 0 ? (
          <div className="text-center py-12">
            {segments.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Transcript will appear here as it processes…
              </p>
            ) : (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No results found</p>
            )}
          </div>
        ) : (
          displaySegs.map((seg: any, i: number) => {
            const active = duration && currentTime >= seg.start_s && currentTime <= seg.end_s;
            return (
              <button key={i} onClick={() => onSeek(seg.start_s)}
                className={cn("flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all w-full hover:bg-white/5",
                  active ? "segment-hit" : "", searchResults ? "bg-indigo-500/10" : "")}>
                <span className="text-xs font-mono mt-0.5 shrink-0 w-10"
                      style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}>
                  {formatDuration(seg.start_s)}
                </span>
                <span className="text-sm leading-relaxed" style={{ color: active ? "var(--text-primary)" : "var(--text-secondary)" }}>
                  {seg.text}
                </span>
                <Play size={12} className="shrink-0 mt-1 opacity-0 group-hover:opacity-100"
                      style={{ color: "var(--accent)" }} />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function SummaryPanel({ summary }: { summary: any }) {
  if (!summary) return (
    <div className="flex flex-col items-center justify-center h-40 gap-3">
      <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} />
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Generating summary…</p>
    </div>
  );

  const short = summary?.short?.content;
  const detailed = summary?.detailed?.content;

  if (!short && !detailed) return (
    <p className="text-sm" style={{ color: "var(--text-muted)" }}>Summary not yet available</p>
  );

  return (
    <div className="flex flex-col gap-6">
      {short && (
        <div className="rounded-xl p-5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3"
             style={{ color: "var(--accent)" }}>Quick Summary</p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{short}</p>
        </div>
      )}
      {detailed && (
        <div className="rounded-xl p-5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3"
             style={{ color: "var(--accent-2)" }}>Detailed Summary</p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{detailed}</p>
        </div>
      )}
    </div>
  );
}

function MomentsPanel({ moments, onSeek }: any) {
  const CATEGORY_COLORS: Record<string,string> = {
    core_concept: "bg-blue-500/15 text-blue-300 border-blue-500/20",
    key_takeaway: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    action_item:  "bg-amber-500/15 text-amber-300 border-amber-500/20",
    highlight:    "bg-purple-500/15 text-purple-300 border-purple-500/20",
  };

  if (moments.length === 0) return (
    <div className="flex flex-col items-center justify-center h-40 gap-3">
      <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} />
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Detecting key moments…</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {moments.map((m: any, i: number) => (
        <button key={i} onClick={() => onSeek(m.start_s)}
          className="flex items-start gap-4 p-4 rounded-xl text-left transition-all hover:-translate-y-0.5 w-full"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          {/* Score bar */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-1 rounded-full" style={{
              height: `${Math.max(16, m.importance_score * 48)}px`,
              background: `linear-gradient(to top, var(--accent), var(--accent-2))`
            }} />
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              {Math.round(m.importance_score * 100)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs font-mono" style={{ color: "var(--accent)" }}>
                {formatDuration(m.start_s)}
              </span>
              <span className={cn("text-xs px-2 py-0.5 rounded-full border capitalize",
                CATEGORY_COLORS[m.category] || "bg-zinc-700/50 text-zinc-400 border-zinc-700")}>
                {m.category?.replace(/_/g," ")}
              </span>
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>{m.label}</p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{m.summary}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function KeywordsPanel({ keywords, tone }: any) {
  if (keywords.length === 0) return (
    <div className="flex flex-col items-center justify-center h-40 gap-3">
      <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} />
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Extracting keywords…</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {tone && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
             style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Tone</span>
          <span className="text-sm font-semibold capitalize" style={{ color: "var(--accent)" }}>{tone}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {keywords.map((k: any, i: number) => (
          <span key={i}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border"
            style={{
              background: `rgba(99,102,241,${0.05 + k.score * 0.15})`,
              borderColor: `rgba(99,102,241,${0.1 + k.score * 0.3})`,
              color: `rgba(199,200,255,${0.5 + k.score * 0.5})`,
              fontSize: `${11 + k.score * 5}px`,
            }}>
            {k.keyword}
            <span className="text-xs font-mono opacity-60">{Math.round(k.score * 100)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
