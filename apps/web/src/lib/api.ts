import { auth } from "./firebase";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function headers(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const h = await headers();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...h, ...(init.headers as Record<string, string> || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Auth
  onboard: (display_name: string) =>
    request("/api/auth/onboard", { method: "POST", body: JSON.stringify({ display_name }) }),
  me: () => request("/api/auth/me"),

  // Videos
  uploadVideo: async (file: File, onProgress?: (pct: number) => void) => {
    const user = auth.currentUser!;
    const token = await user.getIdToken();
    return new Promise<{ id: string; status: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const fd = new FormData();
      fd.append("file", file);
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      });
      xhr.addEventListener("load", () => {
        if (xhr.status === 201) resolve(JSON.parse(xhr.responseText));
        else reject(new Error(JSON.parse(xhr.responseText).detail || "Upload failed"));
      });
      xhr.addEventListener("error", () => reject(new Error("Network error")));
      xhr.open("POST", `${BASE}/api/videos/upload`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.send(fd);
    });
  },
  listVideos: () => request<any[]>("/api/videos"),
  getVideo: (id: string) => request<any>(`/api/videos/${id}`),
  deleteVideo: (id: string) => request(`/api/videos/${id}`, { method: "DELETE" }),

  // Content
  getTranscript: (id: string, page = 1) =>
    request<any[]>(`/api/videos/${id}/transcript?page=${page}&per_page=200`),
  searchTranscript: (id: string, q: string) =>
    request<any[]>(`/api/videos/${id}/transcript/search?q=${encodeURIComponent(q)}`),
  getSummary: (id: string) => request<Record<string, any>>(`/api/videos/${id}/summary`),
  getKeyMoments: (id: string) => request<any[]>(`/api/videos/${id}/key-moments`),
  getKeywords: (id: string) => request<any[]>(`/api/videos/${id}/keywords`),
  exportTranscript: (id: string, format: string) =>
    `${BASE}/api/videos/${id}/export?format=${format}`,

  // Bookmarks
  createBookmark: (videoId: string, data: object) =>
    request(`/api/videos/${videoId}/bookmarks`, { method: "POST", body: JSON.stringify(data) }),
  listBookmarks: (videoId: string) => request<any[]>(`/api/videos/${videoId}/bookmarks`),
  deleteBookmark: (videoId: string, bid: string) =>
    request(`/api/videos/${videoId}/bookmarks/${bid}`, { method: "DELETE" }),

  // Admin
  adminUsers: () => request<any[]>("/api/admin/users"),
  adminSetRole: (uid: string, role: string) =>
    request(`/api/admin/users/${uid}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
  adminStats: () => request<any>("/api/admin/stats"),
};
