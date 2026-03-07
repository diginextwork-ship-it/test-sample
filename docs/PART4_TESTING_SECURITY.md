# Part 4 Testing, Security, and Readiness Checklist

## A. Integration Test Flows

Run these in staging with seeded users:
- `JOB_ADDER_1` (job adder)
- `REC_A..REC_D` (assigned recruiters)
- `REC_X` (unassigned recruiter)

### Flow 1: Create restricted job and assign recruiters
- [ ] Create job with `access_mode=restricted`
- [ ] Assign 3 recruiters, then add 1 more from Edit Access
- [ ] UI shows restricted badge and recruiter count updates
- [ ] DB confirms active assignments with `granted_by=JOB_ADDER_1`

### Flow 2: Assigned recruiter submits resume
- [ ] Assigned recruiter sees restricted + open jobs
- [ ] Submission succeeds and `status.submitted` increments
- [ ] Unassigned recruiter cannot see restricted job
- [ ] Direct submit attempt by unassigned recruiter returns `403`

### Flow 3: Open -> restricted switch
- [ ] Convert open job to restricted
- [ ] Assign two recruiters
- [ ] Assigned recruiter still sees job, non-assigned does not

### Flow 4: Revoke access
- [ ] Remove one recruiter from restricted job
- [ ] Removed recruiter loses visibility immediately
- [ ] Submit attempt after revoke returns `403`

### Flow 5: Job adder performance table
- [ ] `Recruiter Performance` tab lists all recruiters
- [ ] Submitted counts match status table
- [ ] Sorting + search work

### Flow 6: Recruiter data isolation
- [ ] Recruiter sees only own dashboard stats
- [ ] `/api/status/recruiter/:otherRid` returns `403`
- [ ] `/api/status/all` returns `403`

## B. Security Hardening Status

- [x] Role-based authorization guards on protected routes
- [x] Recruiter ownership checks for recruiter resources
- [x] Job ownership checks for access management
- [x] Parameterized SQL queries
- [x] File upload restrictions (`pdf/doc/docx`, max 5MB)
- [x] MIME + file-signature checks on uploads
- [x] Rate limiting on login + resume submission routes
- [x] CORS allowlist (no production wildcard)
- [x] Generic 401/403 responses for unauthorized access
- [ ] Optional malware scanning (not implemented)
- [ ] Move auth token from localStorage to httpOnly cookie (future hardening)

## C. Performance Checklist

- [x] `job_recruiter_access` indexes for job/recruiter access lookups
- [x] `jobs.access_mode` index
- [x] `jobs.recruiter_rid` index
- [x] Pagination in recruiter accessible jobs endpoint
- [x] Frontend search debounce in performance table
- [ ] API caching headers (future)
- [ ] EXPLAIN analysis snapshots in docs (recommended next)

## D. Edge Cases

- [x] Access checked again right before recruiter resume insert
- [x] Missing status row handled with upsert
- [x] Oversized file rejected
- [x] Invalid recruiter assignment rejected
- [ ] Deleted-job mid-submit UX messaging depends on frontend error mapping
