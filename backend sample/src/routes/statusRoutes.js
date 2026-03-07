const express = require("express");
const pool = require("../config/db");
const { requireAuth, requireRoles } = require("../middleware/auth");

const router = express.Router();

const toRole = (value) => String(value || "").trim().toLowerCase();
const toRid = (value) => String(value || "").trim();
const toNullableNumber = (value) => (value === null || value === undefined ? null : Number(value));
const escapeLike = (value) => String(value || "").replace(/[\\%_]/g, "\\$&");
const recruiterStatsSubquery = `
  SELECT
    rd.rid AS recruiter_rid,
    COUNT(*) AS submitted,
    SUM(CASE WHEN jrs.selection_status = 'verified' THEN 1 ELSE 0 END) AS verified,
    SUM(CASE WHEN jrs.selection_status = 'walk_in' THEN 1 ELSE 0 END) AS walk_in,
    SUM(CASE WHEN jrs.selection_status = 'selected' THEN 1 ELSE 0 END) AS selected,
    SUM(CASE WHEN jrs.selection_status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
    SUM(CASE WHEN jrs.selection_status = 'joined' THEN 1 ELSE 0 END) AS joined,
    SUM(CASE WHEN jrs.selection_status = 'dropout' THEN 1 ELSE 0 END) AS dropout,
    MAX(COALESCE(jrs.selected_at, rd.uploaded_at)) AS last_updated,
    MIN(rd.uploaded_at) AS created_at
  FROM resumes_data rd
  LEFT JOIN job_resume_selection jrs
    ON jrs.job_jid = rd.job_jid
   AND jrs.res_id = rd.res_id
  WHERE COALESCE(rd.submitted_by_role, 'recruiter') = 'recruiter'
  GROUP BY rd.rid
`;

const isJobAdderRole = (role) => {
  const normalized = toRole(role);
  return normalized === "job adder" || normalized === "job_adder";
};

const isRecruiterRole = (role) => toRole(role) === "recruiter";

const assertOwnRidOrJobAdder = (req, res) => {
  const authRole = toRole(req.auth?.role);
  const authRid = toRid(req.auth?.rid);
  const requestedRid = toRid(req.params?.rid);

  if (isJobAdderRole(authRole)) return true;
  if (isRecruiterRole(authRole) && authRid && requestedRid && authRid === requestedRid) return true;

  res.status(403).json({
    error: "Forbidden: You can only access your own data",
  });
  return false;
};

const buildCalculatedMetrics = (stats) => {
  const submitted = toNullableNumber(stats.submitted);
  const verified = toNullableNumber(stats.verified);
  const selected = toNullableNumber(stats.select);
  const joined = toNullableNumber(stats.joined);
  const dropout = toNullableNumber(stats.dropout);

  return {
    verificationRate:
      submitted && submitted > 0 && verified !== null
        ? Number(((verified / submitted) * 100).toFixed(2))
        : null,
    selectionRate:
      verified && verified > 0 && selected !== null
        ? Number(((selected / verified) * 100).toFixed(2))
        : null,
    joiningRate:
      selected && selected > 0 && joined !== null
        ? Number(((joined / selected) * 100).toFixed(2))
        : null,
    dropoutRate:
      selected && selected > 0 && dropout !== null
        ? Number(((dropout / selected) * 100).toFixed(2))
        : null,
  };
};

const mapStats = (row) => ({
  submitted: Number(row.submitted) || 0,
  verified: Number(row.verified) || 0,
  walk_in: Number(row.walk_in) || 0,
  select: Number(row.select) || 0,
  reject: Number(row.reject) || 0,
  joined: Number(row.joined) || 0,
  dropout: Number(row.dropout) || 0,
  last_updated: row.last_updated || null,
  created_at: row.created_at || null,
});

router.get(
  "/api/status/recruiter/:rid",
  requireAuth,
  requireRoles("recruiter", "job adder", "job_adder"),
  async (req, res) => {
    if (!assertOwnRidOrJobAdder(req, res)) return;

    const rid = toRid(req.params.rid);
    if (!rid) return res.status(400).json({ error: "rid is required." });

    try {
      const [rows] = await pool.query(
        `SELECT
          r.rid,
          r.name,
          r.email,
          COALESCE(r.points, 0) AS points,
          COALESCE(rs.submitted, 0) AS submitted,
          COALESCE(rs.verified, 0) AS verified,
          COALESCE(rs.walk_in, 0) AS walk_in,
          COALESCE(rs.selected, 0) AS \`select\`,
          COALESCE(rs.rejected, 0) AS reject,
          COALESCE(rs.joined, 0) AS joined,
          COALESCE(rs.dropout, 0) AS dropout,
          rs.last_updated,
          rs.created_at
        FROM recruiter r
        LEFT JOIN (${recruiterStatsSubquery}) rs ON r.rid = rs.recruiter_rid
        WHERE r.rid = ?
          AND LOWER(TRIM(COALESCE(r.role, 'recruiter'))) = 'recruiter'
        LIMIT 1`,
        [rid]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Recruiter not found." });
      }

      const row = rows[0];
      const stats = mapStats(row);
      return res.status(200).json({
        recruiter: {
          rid: row.rid,
          name: row.name,
          email: row.email,
          points: Number(row.points) || 0,
        },
        stats,
        calculatedMetrics: buildCalculatedMetrics(stats),
      });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to fetch recruiter performance stats.",
        details: error.message,
      });
    }
  }
);

router.get(
  "/api/status/all",
  requireAuth,
  requireRoles("job adder", "job_adder"),
  async (req, res) => {
    const search = String(req.query?.search || "").trim();
    const sortBy = String(req.query?.sortBy || "submitted").trim().toLowerCase();
    const sortOrder = String(req.query?.sortOrder || "desc").trim().toLowerCase() === "asc" ? "ASC" : "DESC";

    const sortMap = {
      name: "r.name",
      email: "r.email",
      submitted: "COALESCE(rs.submitted, 0)",
      verified: "COALESCE(rs.verified, 0)",
      walk_in: "COALESCE(rs.walk_in, 0)",
      select: "COALESCE(rs.selected, 0)",
      reject: "COALESCE(rs.rejected, 0)",
      joined: "COALESCE(rs.joined, 0)",
      dropout: "COALESCE(rs.dropout, 0)",
      points: "COALESCE(r.points, 0)",
      last_updated: "rs.last_updated",
    };

    const orderBySql = sortMap[sortBy] || sortMap.submitted;
    const whereClauses = ["LOWER(TRIM(COALESCE(r.role, 'recruiter'))) = 'recruiter'"];
    const params = [];

    if (search) {
      const safeLike = `%${escapeLike(search)}%`;
      whereClauses.push("(r.name LIKE ? ESCAPE '\\\\' OR r.email LIKE ? ESCAPE '\\\\')");
      params.push(safeLike, safeLike);
    }

    const whereSql = whereClauses.join(" AND ");

    try {
      const [rows] = await pool.query(
        `SELECT
          r.rid,
          r.name,
          r.email,
          COALESCE(r.points, 0) AS points,
          COALESCE(rs.submitted, 0) AS submitted,
          COALESCE(rs.verified, 0) AS verified,
          COALESCE(rs.walk_in, 0) AS walk_in,
          COALESCE(rs.selected, 0) AS \`select\`,
          COALESCE(rs.rejected, 0) AS reject,
          COALESCE(rs.joined, 0) AS joined,
          COALESCE(rs.dropout, 0) AS dropout,
          rs.last_updated
        FROM recruiter r
        LEFT JOIN (${recruiterStatsSubquery}) rs ON r.rid = rs.recruiter_rid
        WHERE ${whereSql}
        ORDER BY ${orderBySql} ${sortOrder}, r.name ASC`,
        params
      );

      const recruiters = rows.map((row) => {
        const stats = mapStats(row);
        return {
          rid: row.rid,
          name: row.name,
          email: row.email,
          points: Number(row.points) || 0,
          stats,
          calculatedMetrics: buildCalculatedMetrics(stats),
        };
      });

      const totalSubmitted = recruiters.reduce(
        (sum, item) => sum + item.stats.submitted,
        0
      );
      const totalVerified = recruiters.reduce(
        (sum, item) => sum + item.stats.verified,
        0
      );
      const totalJoined = recruiters.reduce(
        (sum, item) => sum + item.stats.joined,
        0
      );

      return res.status(200).json({
        recruiters,
        total: recruiters.length,
        summary: {
          totalSubmitted,
          totalVerified,
          totalJoined,
          avgSubmittedPerRecruiter: recruiters.length
            ? Number((totalSubmitted / recruiters.length).toFixed(2))
            : 0,
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to fetch recruiter statistics.",
        details: error.message,
      });
    }
  }
);

router.get(
  "/api/dashboard/job-adder",
  requireAuth,
  requireRoles("job adder", "job_adder"),
  async (_req, res) => {
    try {
      const [[jobsOverview]] = await pool.query(
        `SELECT
          COUNT(*) AS totalJobs,
          SUM(CASE WHEN access_mode = 'open' THEN 1 ELSE 0 END) AS openJobs,
          SUM(CASE WHEN access_mode = 'restricted' THEN 1 ELSE 0 END) AS restrictedJobs
        FROM jobs`
      );

      const [[recruiterOverview]] = await pool.query(
        `SELECT
          COUNT(*) AS totalRecruiters
        FROM recruiter
        WHERE LOWER(TRIM(COALESCE(role, 'recruiter'))) = 'recruiter'`
      );

      const [[activeOverview]] = await pool.query(
        `SELECT
          COUNT(*) AS activeRecruiters,
          COALESCE(SUM(stats.submitted), 0) AS totalSubmissions
        FROM (
          SELECT rd.rid, COUNT(*) AS submitted
          FROM resumes_data rd
          WHERE COALESCE(rd.submitted_by_role, 'recruiter') = 'recruiter'
          GROUP BY rd.rid
        ) stats`
      );

      const [topPerformersRows] = await pool.query(
        `SELECT
          r.rid,
          r.name,
          COALESCE(stats.submitted, 0) AS submitted,
          COALESCE(r.points, 0) AS points
        FROM recruiter r
        LEFT JOIN (
          SELECT rd.rid, COUNT(*) AS submitted
          FROM resumes_data rd
          WHERE COALESCE(rd.submitted_by_role, 'recruiter') = 'recruiter'
          GROUP BY rd.rid
        ) stats ON stats.rid = r.rid
        WHERE LOWER(TRIM(COALESCE(r.role, 'recruiter'))) = 'recruiter'
        ORDER BY COALESCE(stats.submitted, 0) DESC, COALESCE(r.points, 0) DESC, r.name ASC
        LIMIT 8`
      );

      const [recentActivityRows] = await pool.query(
        `SELECT
          rd.uploaded_at AS timestamp,
          rd.applicant_name AS candidate,
          r.name AS recruiter,
          j.role_name AS roleName,
          j.company_name AS companyName
        FROM resumes_data rd
        INNER JOIN recruiter r ON r.rid = rd.rid
        LEFT JOIN jobs j ON j.jid = rd.job_jid
        WHERE COALESCE(rd.submitted_by_role, 'recruiter') = 'recruiter'
        ORDER BY rd.uploaded_at DESC
        LIMIT 12`
      );

      return res.status(200).json({
        overview: {
          totalJobs: Number(jobsOverview?.totalJobs) || 0,
          openJobs: Number(jobsOverview?.openJobs) || 0,
          restrictedJobs: Number(jobsOverview?.restrictedJobs) || 0,
          totalRecruiters: Number(recruiterOverview?.totalRecruiters) || 0,
          activeRecruiters: Number(activeOverview?.activeRecruiters) || 0,
          totalSubmissions: Number(activeOverview?.totalSubmissions) || 0,
        },
        topPerformers: topPerformersRows.map((row) => ({
          rid: row.rid,
          name: row.name,
          submitted: Number(row.submitted) || 0,
          points: Number(row.points) || 0,
        })),
        recentActivity: recentActivityRows.map((row) => ({
          type: "resume_submitted",
          recruiter: row.recruiter || "Unknown recruiter",
          job:
            row.roleName && row.companyName
              ? `${row.roleName} at ${row.companyName}`
              : "Job details unavailable",
          candidate: row.candidate || "Candidate",
          timestamp: row.timestamp || null,
        })),
      });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to fetch job adder dashboard data.",
        details: error.message,
      });
    }
  }
);

router.get(
  "/api/dashboard/recruiter/:rid",
  requireAuth,
  requireRoles("recruiter", "job adder", "job_adder"),
  async (req, res) => {
    if (!assertOwnRidOrJobAdder(req, res)) return;

    const rid = toRid(req.params.rid);
    if (!rid) return res.status(400).json({ error: "rid is required." });

    try {
      const [recruiterRows] = await pool.query(
        `SELECT
          r.rid,
          r.name,
          r.email,
          COALESCE(r.points, 0) AS points,
          COALESCE(rs.submitted, 0) AS submitted,
          COALESCE(rs.verified, 0) AS verified,
          COALESCE(rs.walk_in, 0) AS walk_in,
          COALESCE(rs.selected, 0) AS \`select\`,
          COALESCE(rs.rejected, 0) AS reject,
          COALESCE(rs.joined, 0) AS joined,
          COALESCE(rs.dropout, 0) AS dropout,
          rs.last_updated
        FROM recruiter r
        LEFT JOIN (${recruiterStatsSubquery}) rs ON rs.recruiter_rid = r.rid
        WHERE r.rid = ?
          AND LOWER(TRIM(COALESCE(r.role, 'recruiter'))) = 'recruiter'
        LIMIT 1`,
        [rid]
      );

      if (recruiterRows.length === 0) {
        return res.status(404).json({ error: "Recruiter not found." });
      }

      const recruiterRow = recruiterRows[0];

      const [[accessibleJobsCountRow]] = await pool.query(
        `SELECT COUNT(DISTINCT j.jid) AS total
         FROM jobs j
         LEFT JOIN job_recruiter_access jra
           ON j.jid = jra.job_jid
          AND jra.recruiter_rid = ?
          AND jra.is_active = TRUE
         WHERE j.access_mode = 'open'
            OR (j.access_mode = 'restricted' AND jra.id IS NOT NULL)`,
        [rid]
      );

      const [recentRows] = await pool.query(
        `SELECT
          rd.applicant_name AS candidate,
          rd.uploaded_at AS submittedAt,
          j.role_name AS roleName,
          j.company_name AS companyName
        FROM resumes_data rd
        LEFT JOIN jobs j ON j.jid = rd.job_jid
        WHERE rd.rid = ?
          AND COALESCE(rd.submitted_by_role, 'recruiter') = 'recruiter'
        ORDER BY rd.uploaded_at DESC
        LIMIT 10`,
        [rid]
      );

      const stats = mapStats(recruiterRow);

      return res.status(200).json({
        recruiter: {
          rid: recruiterRow.rid,
          name: recruiterRow.name,
          email: recruiterRow.email,
          points: Number(recruiterRow.points) || 0,
        },
        stats,
        accessibleJobsCount: Number(accessibleJobsCountRow?.total) || 0,
        recentSubmissions: recentRows.map((row) => ({
          job:
            row.roleName && row.companyName
              ? `${row.roleName} at ${row.companyName}`
              : "Job details unavailable",
          candidate: row.candidate || "Candidate",
          submittedAt: row.submittedAt || null,
        })),
      });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to fetch recruiter dashboard data.",
        details: error.message,
      });
    }
  }
);

module.exports = router;
