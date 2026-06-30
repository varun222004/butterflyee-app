# Butterfly — Self-Hosting Guide

Butterfly is built to be **fully portable**. You can deploy it on Railway, Render,
DigitalOcean, AWS, a Docker host, a VPS, or just your laptop — no Emergent platform
required.

This document explains what to set and what to expect.

---

## What it needs

| Component | What | Notes |
|---|---|---|
| **Backend** | Python 3.11+, FastAPI, uvicorn | port `8001` (or whatever you set) |
| **Frontend** | Node 18+, `yarn build` → static files | served by any static host |
| **Database** | MongoDB 6+ | Atlas, self-hosted Mongo, Railway/Render add-on |
| **Object storage** | filesystem or S3-compatible | for voice notes & images |

That's it. No vendor lock-in.

---

## Required environment variables

### Backend (`/app/backend/.env`)
```bash
# --- Required ---
MONGO_URL="mongodb://user:pass@host:27017/?retryWrites=true&w=majority"
DB_NAME="butterfly"
JWT_SECRET="generate-a-long-random-string-here"       # MUST be a strong secret
JWT_ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES="60"
REFRESH_TOKEN_EXPIRE_DAYS="14"

# --- CORS — list your frontend URL(s) ---
CORS_ORIGINS="https://your-frontend.example.com,http://localhost:3000"

# --- File storage ---
# Option A: local filesystem (default if nothing else is set)
STORAGE_BACKEND="local"
LOCAL_STORAGE_DIR="/var/data/butterfly"   # any writable mounted volume

# Option B: Emergent (only if you're staying on Emergent's preview / production)
# STORAGE_BACKEND="emergent"
# EMERGENT_LLM_KEY="sk-emergent-..."
```

### Frontend (`/app/frontend/.env`)
```bash
REACT_APP_BACKEND_URL="https://your-api.example.com"
```

> ⚠️ The frontend must be served from the same scheme/host as the backend, **or** CORS_ORIGINS on the backend must explicitly list the frontend's URL. The frontend uses `axios` with `withCredentials: true` because authentication is HttpOnly cookies.

---

## Generating a strong JWT secret

```bash
python -c "import secrets; print(secrets.token_hex(64))"
```

Put the output into `JWT_SECRET`. **Do not commit it** to git.

---

## Local development

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8001

# Frontend (separate terminal)
cd frontend
yarn install
yarn start    # opens http://localhost:3000
```

---

## Docker (recommended for VPS / DigitalOcean / AWS)

A minimal example. Adjust to your needs.

### `backend/Dockerfile`
```Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PYTHONUNBUFFERED=1
EXPOSE 8001
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
```

### `docker-compose.yml`
```yaml
services:
  mongo:
    image: mongo:7
    volumes: ["./data/mongo:/data/db"]
    restart: unless-stopped

  backend:
    build: ./backend
    environment:
      MONGO_URL: "mongodb://mongo:27017"
      DB_NAME: "butterfly"
      JWT_SECRET: "${JWT_SECRET}"
      CORS_ORIGINS: "https://your-frontend.example.com"
      STORAGE_BACKEND: "local"
      LOCAL_STORAGE_DIR: "/data/uploads"
    volumes: ["./data/uploads:/data/uploads"]
    depends_on: [mongo]
    restart: unless-stopped

  frontend:
    image: nginx:alpine
    volumes:
      - ./frontend/build:/usr/share/nginx/html
    ports: ["443:443", "80:80"]
```

Run with: `docker compose up -d --build`

---

## Railway / Render

Both have **Node** and **Python** runtimes plus a managed **MongoDB add-on** — perfect fit.

1. Create the MongoDB add-on, copy its connection string into `MONGO_URL`.
2. Set the env vars above on the backend service.
3. Mount a persistent disk (Railway "Volume", Render "Persistent Disk") for `LOCAL_STORAGE_DIR`.
4. Frontend: deploy as a static site, set `REACT_APP_BACKEND_URL` to your backend's public URL.
5. Set the backend's `CORS_ORIGINS` to your frontend's URL.

---

## Switching to S3 / Cloudflare R2 later

The storage layer in `backend/storage.py` is intentionally small. To swap in S3 / R2:
1. Add a new branch in `put_object` / `get_object` for `backend() == "s3"`.
2. Set `STORAGE_BACKEND=s3` plus your `AWS_*` (or `R2_*`) env vars.
3. No route code changes needed.

---

## Removing the Emergent footer / branding

The "Made with Emergent" badge only appears when the app is hosted on Emergent's preview URL. Self-hosted deployments don't include it.

---

## Backups

The two things to back up are:
1. **MongoDB** — use `mongodump` / Atlas's built-in backups / Railway snapshots.
2. **Uploads directory** — back up `LOCAL_STORAGE_DIR`. If you go S3/R2 later, the provider handles it.

That's the whole story. Butterfly is just Python + JavaScript + MongoDB + a folder.
