from __future__ import annotations

import json
import os
import subprocess
import uuid
from dotenv import load_dotenv

load_dotenv()

from contextlib import asynccontextmanager
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore
from fastapi import BackgroundTasks, Depends, FastAPI, File, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# ── Firebase init ─────────────────────────────────────────────────────────────
_cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "serviceAccountKey.json")
_HAS_SA = os.path.exists(_cred_path)
_FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "clipai-4bb71")
_db = None
_USE_SDK_VERIFY = False

try:
    if _HAS_SA:
        _cred = credentials.Certificate(_cred_path)
        firebase_admin.initialize_app(_cred)
    else:
        # Use Application Default Credentials (ADC) for Cloud Run
        firebase_admin.initialize_app(options={'projectId': _FIREBASE_PROJECT_ID})
    
    from firebase_admin import auth as _fb_auth
    _db = firestore.client()
    _USE_SDK_VERIFY = True
    print("✅ Firebase initialized successfully.")
except Exception as e:
    print(f"⚠️  Firebase initialization failed: {e}")

def _get_db():
    if _db is None:
        raise HTTPException(status_code=503, detail="Server not fully configured for Firestore.")
    return _db

def db_col(path: str):
    return _get_db().collection(path)



# ── Token verification (works with or without service account) ────────────────
import httpx, time
from jose import jwt as _jose_jwt

_GOOGLE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
_FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "clipai-4bb71")
_cert_cache: dict = {}
_cert_expiry: float = 0.0

async def _get_google_certs() -> dict:
    global _cert_cache, _cert_expiry
    if time.time() < _cert_expiry and _cert_cache:
        return _cert_cache
    async with httpx.AsyncClient() as client:
        r = await client.get(_GOOGLE_CERTS_URL)
        r.raise_for_status()
        _cert_cache = r.json()
        _cert_expiry = time.time() + 3600  # cache 1h
    return _cert_cache

async def verify_firebase_token(id_token: str) -> dict:
    """Verify a Firebase ID token. Works with or without service account."""
    if _USE_SDK_VERIFY:
        try:
            return _fb_auth.verify_id_token(id_token)
        except Exception as exc:
            raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")
    # REST path: decode header, fetch matching cert, verify
    try:
        from jose import jwk, jwt as jose_jwt
        from jose.utils import base64url_decode
        import base64, json as _json
        header = jose_jwt.get_unverified_header(id_token)
        kid = header.get("kid")
        certs = await _get_google_certs()
        if kid not in certs:
            raise ValueError(f"Unknown kid: {kid}")
        public_key = certs[kid]
        payload = jose_jwt.decode(
            id_token, public_key,
            algorithms=["RS256"],
            audience=_FIREBASE_PROJECT_ID,
            issuer=f"https://securetoken.google.com/{_FIREBASE_PROJECT_ID}",
        )
        return payload
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {exc}")



# ── Paths ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[2]
UPLOADS = ROOT / "uploads"
THUMBNAILS = ROOT / "thumbnails"
AUDIO_DIR = ROOT / "audio"
for d in (UPLOADS, THUMBNAILS, AUDIO_DIR):
    d.mkdir(parents=True, exist_ok=True)

ALLOWED_SUFFIXES = {".mp4", ".mov", ".webm", ".avi", ".mkv"}
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "2048")) * 1024 * 1024
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")



async def get_current_user(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    id_token = authorization.removeprefix("Bearer ").strip()
    return await verify_firebase_token(id_token)


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    profile = _get_db().collection("users").document(user["uid"]).get()
    role = profile.to_dict().get("role", "user") if profile.exists else "user"
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


def _video_ref(vid: str):
    return _get_db().collection("videos").document(vid)


def _set_job(vid: str, stage: str, status: str, error: str | None = None):
    _video_ref(vid).collection("jobs").document(stage).set({
        "stage": stage, "status": status, "error": error,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }, merge=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(title="ClipMind v2 API", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])
app.mount("/uploads", StaticFiles(directory=str(UPLOADS)), name="uploads")
app.mount("/thumbnails", StaticFiles(directory=str(THUMBNAILS)), name="thumbnails")


@app.get("/")
def root():
    return {"platform": "ClipMind v2", "status": "online", "version": "2.0.0"}

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "2.0.0"}


class OnboardInput(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)

@app.post("/api/auth/onboard", status_code=201)
async def onboard(data: OnboardInput, user: dict = Depends(get_current_user)):
    uid = user["uid"]
    ref = _get_db().collection("users").document(uid)
    doc = ref.get()
    if not doc.exists:
        ref.set({"uid": uid, "email": user.get("email", ""),
                 "display_name": data.display_name, "role": "user",
                 "created_at": firestore.SERVER_TIMESTAMP})
    return {"uid": uid, "role": doc.to_dict().get("role", "user") if doc.exists else "user"}

@app.get("/api/auth/me")
async def me(user: dict = Depends(get_current_user)):
    ref = _get_db().collection("users").document(user["uid"])
    doc = ref.get()
    if not doc.exists:
        # Auto-create profile on first login (works for Google sign-in, email sign-up)
        profile = {
            "uid": user["uid"],
            "email": user.get("email", ""),
            "display_name": user.get("name", user.get("email", "User").split("@")[0]),
            "role": "user",
            "created_at": firestore.SERVER_TIMESTAMP,
        }
        ref.set(profile)
        profile["created_at"] = None  # SERVER_TIMESTAMP not serializable
        return profile
    return doc.to_dict()


@app.post("/api/videos/upload", status_code=201)
async def upload_video(background_tasks: BackgroundTasks, file: UploadFile = File(...),
                       user: dict = Depends(get_current_user)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=415, detail="Only MP4, MOV, WebM, AVI, MKV supported")
    video_id = str(uuid.uuid4())
    stored_name = f"{video_id}{suffix}"
    target = UPLOADS / stored_name
    written = 0
    try:
        with target.open("wb") as dest:
            while chunk := await file.read(1024 * 1024):
                written += len(chunk)
                if written > MAX_UPLOAD_BYTES:
                    target.unlink(missing_ok=True)
                    raise HTTPException(status_code=413, detail="File too large")
                dest.write(chunk)
    except HTTPException:
        raise
    except Exception as exc:
        target.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    _video_ref(video_id).set({
        "id": video_id, "owner_id": user["uid"],
        "original_name": file.filename or stored_name,
        "stored_name": stored_name, "mime_type": file.content_type or "video/mp4",
        "size_bytes": written, "status": "processing",
        "duration_s": None, "resolution": None, "thumbnail_path": None,
        "created_at": firestore.SERVER_TIMESTAMP,
    })
    background_tasks.add_task(run_audio_worker, video_id, target)
    return {"id": video_id, "status": "processing"}


@app.get("/api/videos")
async def list_videos(user: dict = Depends(get_current_user)):
    uid = user["uid"]
    profile = _get_db().collection("users").document(uid).get()
    role = profile.to_dict().get("role", "user") if profile.exists else "user"
    if role == "admin":
        docs = _get_db().collection("videos").order_by("created_at",
               direction=firestore.Query.DESCENDING).stream()
    else:
        docs = (_get_db().collection("videos").where("owner_id", "==", uid)
                .order_by("created_at", direction=firestore.Query.DESCENDING).stream())
    return [d.to_dict() for d in docs]


@app.get("/api/videos/{video_id}")
async def get_video(video_id: str, user: dict = Depends(get_current_user)):
    doc = _video_ref(video_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Video not found")
    data = doc.to_dict()
    _check_access(data, user)
    jobs = {j.id: j.to_dict() for j in _video_ref(video_id).collection("jobs").stream()}
    data["jobs"] = jobs
    return data


@app.delete("/api/videos/{video_id}", status_code=204)
async def delete_video(video_id: str, user: dict = Depends(get_current_user)):
    doc = _video_ref(video_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Video not found")
    d = doc.to_dict()
    _check_access(d, user, edit=True)
    (UPLOADS / d.get("stored_name", "")).unlink(missing_ok=True)
    tp = d.get("thumbnail_path", "")
    if tp:
        (THUMBNAILS / Path(tp).name).unlink(missing_ok=True)
    for sub in ["jobs", "segments", "summaries", "keyMoments", "keywords"]:
        for sdoc in _video_ref(video_id).collection(sub).stream():
            sdoc.reference.delete()
    _video_ref(video_id).delete()


@app.get("/api/videos/{video_id}/transcript")
async def get_transcript(video_id: str, page: int = Query(1, ge=1),
                         per_page: int = Query(100, le=500),
                         user: dict = Depends(get_current_user)):
    _assert_access(video_id, user)
    segs = (_video_ref(video_id).collection("segments").order_by("seq")
            .offset((page-1)*per_page).limit(per_page).stream())
    return [s.to_dict() for s in segs]


@app.get("/api/videos/{video_id}/transcript/search")
async def search_transcript(video_id: str, q: str = Query(..., min_length=1),
                            user: dict = Depends(get_current_user)):
    _assert_access(video_id, user)
    ql = q.lower()
    return [s.to_dict() for s in _video_ref(video_id).collection("segments").order_by("seq").stream()
            if ql in s.to_dict().get("text","").lower()]


@app.get("/api/videos/{video_id}/summary")
async def get_summary(video_id: str, user: dict = Depends(get_current_user)):
    _assert_access(video_id, user)
    return {d.id: d.to_dict() for d in _video_ref(video_id).collection("summaries").stream()}


@app.get("/api/videos/{video_id}/key-moments")
async def get_key_moments(video_id: str, user: dict = Depends(get_current_user)):
    _assert_access(video_id, user)
    docs = _video_ref(video_id).collection("keyMoments").order_by("start_s").stream()
    return [d.to_dict() for d in docs]


@app.get("/api/videos/{video_id}/keywords")
async def get_keywords(video_id: str, user: dict = Depends(get_current_user)):
    _assert_access(video_id, user)
    docs = (_video_ref(video_id).collection("keywords")
            .order_by("score", direction=firestore.Query.DESCENDING).stream())
    return [d.to_dict() for d in docs]


@app.get("/api/videos/{video_id}/export")
async def export_transcript(video_id: str,
                            format: str = Query("txt", pattern="^(txt|md|srt|vtt|json)$"),
                            user: dict = Depends(get_current_user)):
    _assert_access(video_id, user)
    segs = [s.to_dict() for s in
            _video_ref(video_id).collection("segments").order_by("seq").stream()]
    title = (_video_ref(video_id).get().to_dict() or {}).get("original_name", "transcript")
    if format == "json":
        return segs
    elif format == "txt":
        content, mt, fn = "\n".join(s["text"] for s in segs), "text/plain", f"{title}.txt"
    elif format == "md":
        lines = [f"# {title}\n"] + [f"**[{_fmt(s.get('start_s',0))}]** {s['text']}\n" for s in segs]
        content, mt, fn = "\n".join(lines), "text/markdown", f"{title}.md"
    elif format == "srt":
        lines = []
        for i, s in enumerate(segs, 1):
            lines += [str(i), f"{_srt(s.get('start_s',0))} --> {_srt(s.get('end_s',0))}", s["text"], ""]
        content, mt, fn = "\n".join(lines), "text/plain", f"{title}.srt"
    else:  # vtt
        lines = ["WEBVTT", ""]
        for s in segs:
            lines += [f"{_vtt(s.get('start_s',0))} --> {_vtt(s.get('end_s',0))}", s["text"], ""]
        content, mt, fn = "\n".join(lines), "text/vtt", f"{title}.vtt"
    return StreamingResponse(iter([content.encode()]), media_type=mt,
                             headers={"Content-Disposition": f'attachment; filename="{fn}"'})


class BookmarkInput(BaseModel):
    item_type: str
    item_id: str | None = None
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=10000)
    timestamp_start: float | None = None
    timestamp_end: float | None = None

@app.post("/api/videos/{video_id}/bookmarks", status_code=201)
async def create_bookmark(video_id: str, data: BookmarkInput, user: dict = Depends(get_current_user)):
    _assert_access(video_id, user)
    bid = str(uuid.uuid4())
    _get_db().collection("users").document(user["uid"]).collection("bookmarks").document(bid).set(
        {"id": bid, "video_id": video_id, **data.model_dump(), "created_at": firestore.SERVER_TIMESTAMP})
    return {"id": bid}

@app.get("/api/videos/{video_id}/bookmarks")
async def list_bookmarks(video_id: str, user: dict = Depends(get_current_user)):
    docs = (_get_db().collection("users").document(user["uid"]).collection("bookmarks")
            .where("video_id", "==", video_id).stream())
    return [d.to_dict() for d in docs]

@app.delete("/api/videos/{video_id}/bookmarks/{bid}", status_code=204)
async def delete_bookmark(video_id: str, bid: str, user: dict = Depends(get_current_user)):
    _get_db().collection("users").document(user["uid"]).collection("bookmarks").document(bid).delete()


@app.get("/api/admin/users")
async def admin_list_users(user: dict = Depends(require_admin)):
    return [d.to_dict() for d in _get_db().collection("users").stream()]

class RoleUpdate(BaseModel):
    role: str = Field(pattern="^(user|admin)$")

@app.patch("/api/admin/users/{uid}/role")
async def admin_set_role(uid: str, data: RoleUpdate, user: dict = Depends(require_admin)):
    _get_db().collection("users").document(uid).update({"role": data.role})
    firebase_auth.set_custom_user_claims(uid, {"role": data.role})
    return {"uid": uid, "role": data.role}

@app.get("/api/admin/stats")
async def admin_stats(user: dict = Depends(require_admin)):
    return {"users": len(list(_get_db().collection("users").stream())),
            "videos": len(list(_get_db().collection("videos").stream()))}


# ── Workers ──────────────────────────────────────────────────────────────────
def run_audio_worker(video_id: str, source: Path) -> None:
    _set_job(video_id, "audio", "running")
    try:
        thumb = THUMBNAILS / f"{video_id}.jpg"
        subprocess.run(["ffmpeg", "-y", "-ss", "3", "-i", str(source), "-frames:v", "1",
                        "-q:v", "3", str(thumb)], capture_output=True, check=True, timeout=120)
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=width,height,duration", "-of", "json", str(source)],
            capture_output=True, text=True, check=True, timeout=60)
        stream = json.loads(probe.stdout).get("streams", [{}])[0]
        duration = float(stream.get("duration") or 0)
        resolution = f"{stream['width']}x{stream['height']}" if stream.get("width") else None
        audio_path = AUDIO_DIR / f"{video_id}.flac"
        subprocess.run(["ffmpeg", "-y", "-i", str(source), "-vn", "-ar", "16000", "-ac", "1",
                        str(audio_path)], capture_output=True, check=True, timeout=600)
        _video_ref(video_id).update({"duration_s": duration, "resolution": resolution,
                                     "thumbnail_path": f"thumbnails/{video_id}.jpg",
                                     "status": "transcribing"})
        _set_job(video_id, "audio", "done")
        run_transcript_worker(video_id, audio_path)
    except Exception as exc:
        print(f"ERROR in run_audio_worker: {exc}")
        _video_ref(video_id).update({"status": "failed"})
        _set_job(video_id, "audio", "failed", error=str(exc)[:300])


def run_transcript_worker(video_id: str, audio_path: Path) -> None:
    _set_job(video_id, "transcript", "running")
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel(os.getenv("WHISPER_MODEL", "base"), device="cpu", compute_type="int8")
        segments_iter, info = model.transcribe(str(audio_path), beam_size=5)
        batch = _video_ref(video_id).collection("segments")
        parts = []
        for seq, seg in enumerate(segments_iter):
            text = seg.text.strip()
            parts.append(text)
            batch.document(str(seq)).set({"seq": seq, "start_s": round(seg.start, 2),
                                          "end_s": round(seg.end, 2), "text": text})
        _video_ref(video_id).update({"language": info.language, "status": "analyzing"})
        _set_job(video_id, "transcript", "done")
        run_analysis_worker(video_id, " ".join(parts))
    except Exception as exc:
        print(f"ERROR in run_transcript_worker: {exc}")
        _video_ref(video_id).update({"status": "failed"})
        _set_job(video_id, "transcript", "failed", error=str(exc)[:300])


def run_analysis_worker(video_id: str, transcript: str) -> None:
    _set_job(video_id, "analysis", "running")
    try:
        from google import genai
        from google.genai import types as genai_types
        client = genai.Client(api_key=GOOGLE_API_KEY)
        words = transcript.split()
        if len(words) > 60000:
            transcript = " ".join(words[:60000]) + "\n[Transcript truncated]"
        prompt = f"""Analyze this video transcript. Return ONLY valid JSON.

Transcript:
{transcript}

Schema:
{{
  "summary_short": "2-3 sentences",
  "summary_detailed": "detailed paragraph",
  "key_moments": [{{"start_s":0.0,"end_s":30.0,"label":"Title","summary":"desc","score":0.85,"category":"core_concept|key_takeaway|action_item|highlight"}}],
  "keywords": [{{"keyword":"term","score":0.9,"category":"topic|person|tool|concept"}}],
  "tone": "educational|conversational|formal|casual|technical",
  "language": "en"
}}"""
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw.strip())

        vr = _video_ref(video_id)
        for stype in ("short", "detailed"):
            vr.collection("summaries").document(stype).set(
                {"type": stype, "content": result.get(f"summary_{stype}", ""),
                 "created_at": firestore.SERVER_TIMESTAMP})
        for km in result.get("key_moments", []):
            kid = str(uuid.uuid4())
            vr.collection("keyMoments").document(kid).set(
                {"id": kid, **km, "created_at": firestore.SERVER_TIMESTAMP})
        for kw in result.get("keywords", []):
            kwid = str(uuid.uuid4())
            vr.collection("keywords").document(kwid).set(
                {"id": kwid, **kw, "created_at": firestore.SERVER_TIMESTAMP})
        vr.update({"status": "done", "tone": result.get("tone", "")})
        _set_job(video_id, "analysis", "done")
    except Exception as exc:
        print(f"ERROR in run_analysis_worker: {exc}")
        _video_ref(video_id).update({"status": "failed"})
        _set_job(video_id, "analysis", "failed", error=str(exc)[:300])


def _check_access(video: dict, user: dict, edit: bool = False):
    profile = _get_db().collection("users").document(user["uid"]).get()
    role = profile.to_dict().get("role", "user") if profile.exists else "user"
    if role == "admin":
        return
    if video.get("owner_id") != user["uid"]:
        raise HTTPException(status_code=403, detail="Access denied")

def _assert_access(video_id: str, user: dict):
    doc = _video_ref(video_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Video not found")
    _check_access(doc.to_dict(), user)

def _fmt(s: float) -> str:
    s = int(s)
    return f"{s//3600:02d}:{(s%3600)//60:02d}:{s%60:02d}" if s >= 3600 else f"{s//60:02d}:{s%60:02d}"

def _srt(s: float) -> str:
    ms = int((s % 1) * 1000); s = int(s)
    return f"{s//3600:02d}:{(s%3600)//60:02d}:{s%60:02d},{ms:03d}"

def _vtt(s: float) -> str:
    return _srt(s).replace(",", ".")
