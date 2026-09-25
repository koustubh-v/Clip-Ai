import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  return `${m}:${String(s).padStart(2,"0")}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function timeAgo(date: any): string {
  const d = date?.toDate?.() ?? new Date(date);
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const STATUS_CONFIG: Record<string, { label: string; color: string; pulse: boolean }> = {
  uploading:    { label: "Uploading",    color: "bg-blue-500/20 text-blue-300 border-blue-500/30",    pulse: true },
  processing:   { label: "Processing",   color: "bg-amber-500/20 text-amber-300 border-amber-500/30",  pulse: true },
  transcribing: { label: "Transcribing", color: "bg-purple-500/20 text-purple-300 border-purple-500/30", pulse: true },
  analyzing:    { label: "Analyzing AI", color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30", pulse: true },
  done:         { label: "Ready",        color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", pulse: false },
  failed:       { label: "Failed",       color: "bg-red-500/20 text-red-300 border-red-500/30",        pulse: false },
};
