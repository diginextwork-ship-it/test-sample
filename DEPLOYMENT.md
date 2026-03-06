# Split Deployment (Vercel + Railway)

This repository is now structured for two independent services:

- Frontend: `frontend sample` (deploy on Vercel)
- Backend API: `backend sample` (deploy on Railway)

## 1) Deploy backend (Railway)

Set Railway root/service to `backend sample`.

Set environment variables:

- `PORT=5000`
- DB variables (`DATABASE_URL` or `DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`)
- `FRONTEND_URL=https://<your-vercel-domain>`
- Optional: `FRONTEND_URLS`, `ALLOW_VERCEL_PREVIEWS=true`

After deploy, note backend URL, e.g. `https://your-backend.up.railway.app`.

## 2) Deploy frontend (Vercel)

Set Vercel root project to `frontend sample`.

Set environment variables:

- `VITE_API_URL=https://your-backend.up.railway.app`
- EmailJS variables if used

## 3) Verify connectivity

- Frontend requests should go to `${VITE_API_URL}/api/...`
- Backend CORS should allow your Vercel domain via `FRONTEND_URL` (or `FRONTEND_URLS`)
- Backend health endpoint: `GET /health`
