# HireNext Frontend (Vercel)

React + Vite frontend for HireNext, designed to be deployed as an independent service.

## Environment variables

Create `.env` from `.env.example` and set:

- `VITE_API_URL`: public URL of the backend API service (Railway)
- `VITE_EMAILJS_SERVICE_ID`
- `VITE_EMAILJS_TEMPLATE_ID`
- `VITE_EMAILJS_PUBLIC_KEY`

Notes:
- `VITE_API_BASE_URL` is still supported for backward compatibility.
- `VITE_API_URL` is preferred and takes precedence.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
