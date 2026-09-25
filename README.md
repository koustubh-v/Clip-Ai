# ClipMind v2

AI-powered video intelligence — GCP-native architecture.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Auth | Firebase Auth |
| Database | Firestore |
| API | FastAPI (thin, stateless) |
| Transcription | faster-whisper (local CPU / Cloud Run GPU L4) |
| AI Analysis | Gemini 2.0 Flash |
| Storage | Local filesystem → Cloud Storage (GCS) |
| Queue | BackgroundTasks → Pub/Sub (when GCP ready) |

## Quick Start

### 1. Firebase project (required)
1. Go to [console.firebase.google.com](https://console.firebase.google.com) → New project
2. Enable **Authentication** → Sign-in providers → Email/Password + Google
3. Enable **Firestore** → Start in production mode
4. Go to Project Settings → Your apps → Add Web app → copy the config
5. Go to Project Settings → Service Accounts → Generate new private key → save as `apps/api/serviceAccountKey.json`

### 2. Frontend setup
```bash
cd apps/web
cp .env.example .env
# Fill in VITE_FIREBASE_* from step 1
# VITE_API_URL=http://localhost:8000
npm install
npm run dev
```
Frontend runs at **http://localhost:5173**

### 3. API setup
```bash
cd apps/api
cp .env.example .env
# Fill in GOOGLE_API_KEY (from https://aistudio.google.com)
# FIREBASE_SERVICE_ACCOUNT_JSON=serviceAccountKey.json

python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API runs at **http://localhost:8000** — docs at **/docs**

### 4. First run
1. Open `http://localhost:5173`
2. Sign up with email or Google
3. Upload a short video (MP4 preferred)
4. Watch the pipeline progress in the workspace

## Firestore rules (copy into Firebase console)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
      allow read: if request.auth.token.role == 'admin';
    }
    match /videos/{vid} {
      allow read, write: if request.auth.uid == resource.data.owner_id
                         || request.auth.token.role == 'admin';
      allow create: if request.auth != null;
      match /{sub}/{docId} {
        allow read: if request.auth.uid == get(/databases/$(db)/documents/videos/$(vid)).data.owner_id
                    || request.auth.token.role == 'admin';
      }
    }
    match /users/{uid}/bookmarks/{bid} {
      allow read, write: if request.auth.uid == uid;
    }
  }
}
```

## Repo layout
```
apps/
  web/        React + Vite frontend
  api/        FastAPI backend
  workers/    audio, transcript, analysis (local for now, Cloud Run later)
infra/        Terraform (Phase 1 of GCP setup)
.github/      CI/CD workflows
Clip-Ai/      Original codebase (reference)
```

## GCP migration (Phase 1+)
When you're ready to add GCP:
1. Replace `UPLOADS/` local storage → GCS signed URLs (swap `apps/api/app/gcs.py`)
2. Replace `BackgroundTasks` workers → Pub/Sub push subscriptions (swap `run_*_worker` calls)
3. Replace transcript worker CPU → Cloud Run GPU with `faster-whisper large-v3`
4. Point `VITE_API_URL` to the Cloud Run URL
