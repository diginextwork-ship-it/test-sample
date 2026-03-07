# HireNext API Documentation

Base URL: `http://localhost:5000`
Auth: `Authorization: Bearer <token>`

## Authentication

### POST `/api/recruiters/login`
- Auth: Public
- Body:
```json
{ "email": "recruiter@company.com", "password": "secret" }
```
- Success `200`:
```json
{
  "message": "Login successful.",
  "token": "<jwt-like-token>",
  "recruiter": { "rid": "hnr-1", "name": "Riya", "email": "recruiter@company.com", "role": "recruiter" }
}
```

### POST `/api/admin/login`
- Auth: Public (API key payload)
- Body:
```json
{ "adminKey": "your-admin-key" }
```

## Job Access Control

### POST `/api/jobs`
- Auth: `job creator` / `job adder`
- Creates job with optional restricted access assignments.
- Body includes: `recruiter_rid`, `company_name`, `role_name`, `job_description`, `access_mode`, `recruiterIds[]`.

### GET `/api/jobs/my`
- Auth: `job creator` / `job adder`
- Returns jobs created by logged-in user with `recruiterCount`.

### GET `/api/jobs/:jid/access`
- Auth: `job creator` / `job adder` and job ownership
- Returns active assigned recruiters for the job.

### POST `/api/jobs/:jid/access`
- Auth: `job creator` / `job adder` and job ownership
- Body:
```json
{ "recruiterIds": ["hnr-2", "hnr-3"], "notes": "Tech specialists" }
```

### DELETE `/api/jobs/:jid/access/:rid`
- Auth: `job creator` / `job adder` and job ownership
- Revokes recruiter access (`is_active = FALSE`).

### PUT `/api/jobs/:jid/access-mode`
- Auth: `job creator` / `job adder` and job ownership
- Body:
```json
{ "accessMode": "restricted" }
```

## Recruiter Job Access + Submission

### GET `/api/recruiters/:rid/accessible-jobs`
- Auth: `recruiter` (own rid) or `job adder`
- Query: `location`, `company`, `search`, `limit`, `offset`

### GET `/api/recruiters/:rid/can-access/:jid`
- Auth: `recruiter` (own rid) or `job adder`
- Validates if recruiter can access a job.

### POST `/api/resumes/submit`
- Auth: `recruiter` only
- Content-Type: `multipart/form-data`
- Required fields:
  - `recruiter_rid`, `job_jid`, candidate fields, `resume_file`
- File rules:
  - Only `.pdf`, `.doc`, `.docx`
  - Max size `5MB`
  - MIME + file signature validated
- Success increments `status.submitted`.

## Performance Endpoints

### GET `/api/status/recruiter/:rid`
- Auth: recruiter (own data) or job adder

### GET `/api/status/all`
- Auth: job adder only
- Query: `search`, `sortBy`, `sortOrder`

### GET `/api/dashboard/job-adder`
- Auth: job adder only

### GET `/api/dashboard/recruiter/:rid`
- Auth: recruiter (own data) or job adder

## Error Codes

- `400`: Validation error / invalid payload
- `401`: Missing or invalid auth token
- `403`: Role/ownership access denied
- `404`: Resource not found
- `429`: Rate-limited request
- `500`: Internal server error
