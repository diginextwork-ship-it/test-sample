# Future Enhancements

## Phase 2: Status Counter Management

- Add admin endpoints:
  - `POST /api/status/increment`
  - `POST /api/status/bulk-update`
- Add admin UI actions to increment `verified`, `select`, `joined`, etc.
- Hook status counters to workflow events.

## Phase 3: Advanced Analytics

- Time-series charts for submissions and conversions.
- Recruiter leaderboards and comparisons.
- CSV/PDF export for recruiter and job access reports.
- Scheduled email reports and notifications.
- Date-range and multi-field filtering.

## Phase 4: Gamification

- Weighted points for verified/selected/joined outcomes.
- Recruiter badges and achievements.
- Performance-tiered job access automation.

## Platform Hardening Roadmap

- Replace localStorage auth with httpOnly cookies.
- Add malware scanning pipeline for uploaded files.
- Add distributed rate limiter (Redis) for multi-instance deployments.
- Add structured audit logs for access changes and status updates.
