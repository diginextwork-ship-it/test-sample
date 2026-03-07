# HireNext Developer Guide

## Architecture

- Backend: Node.js + Express + MySQL (`backend sample`)
- Frontend: React + Vite (`frontend sample`)
- Auth: signed bearer token with role + rid payload

## Backend Structure

- `src/routes/`
  - `jobRoutes.js`: jobs, job access control, candidate application submission
  - `recruiterRoutes.js`: recruiter auth, accessible jobs, recruiter resume submission
  - `statusRoutes.js`: recruiter/job-adder performance APIs
  - `adminRoutes.js`: admin-only dashboards and actions
- `src/middleware/`
  - `auth.js`: token verification + role guards + recruiter ownership guard
  - `rateLimiter.js`: IP-based in-memory rate limiting
  - `uploadValidation.js`: extension/MIME/signature validation for resume files
- `src/config/db.js`: pool setup + schema/bootstrap helpers

## Database Schema (Core)

- `recruiter (rid PK)`
- `jobs (jid PK, recruiter_rid -> recruiter.rid, access_mode)`
- `job_recruiter_access (job_jid, recruiter_rid, is_active, granted_by)`
- `status (recruiter_rid PK, submitted/verified/select...)`
- `applications (candidate submissions)`
- `resumes_data (binary resume storage + ATS fields)`

## Key Relationships

- One recruiter can create many jobs.
- Restricted job visibility is controlled by `job_recruiter_access`.
- Recruiter performance counters are tracked in `status`.
- Resume submission inserts into `applications` and `resumes_data`, then increments `status.submitted`.

## Authorization Flow

1. Login endpoint returns token with role + rid.
2. Protected routes use `requireAuth`.
3. Role checks use `requireRoles`.
4. Recruiter ownership checks use `requireRecruiterOwner` or route-level guard logic.
5. Job ownership checks use `requireOwnedJob`.

## Security Notes

- Parameterized SQL queries are used throughout.
- Resume file upload now validates:
  - extension
  - MIME
  - binary signature
  - max 5MB size
- Rate limits applied to login and submission endpoints.

## Deployment

1. Configure `.env` for DB and auth secret.
2. Run backend: `npm run dev` in `backend sample`.
3. Run frontend: `npm run dev` in `frontend sample`.
4. Ensure CORS origins are set using `FRONTEND_URL`/`FRONTEND_URLS`.
5. On startup, backend auto-initializes required tables/columns/indexes.
