const express = require("express");
const pool = require("../config/db");

const router = express.Router();
const ADMIN_API_KEY = String(process.env.ADMIN_API_KEY || "admin123");

const tableExists = async (tableName) => {
  try {
    const [rows] = await pool.query(
      `SELECT 1
       FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = ?
       LIMIT 1`,
      [tableName]
    );
    if (rows.length > 0) return true;
  } catch {}

  try {
    await pool.query(`SELECT 1 FROM \`${tableName}\` LIMIT 1`);
    return true;
  } catch {
    return false;
  }
};

const columnExists = async (tableName, columnName) => {
  const [rows] = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
};

const isAdminAuthorized = (req) => {
  const providedKey = String(req.headers["x-admin-key"] || "").trim();
  return Boolean(providedKey) && providedKey === ADMIN_API_KEY;
};

const ensureAdminAuthorized = (req, res) => {
  if (isAdminAuthorized(req)) return true;
  res.status(403).json({ message: "Admin authorization required." });
  return false;
};

router.get("/api/admin/dashboard", async (_req, res) => {
  try {
    let recruiterPerformance = [];
    let candidatePerformance = [];
    let totalResumeCount = 0;
    let recruiterResumeUploads = [];
    let topResumesByJob = [];

    if (await tableExists("resumes_data")) {
      const [recruiterRows] = await pool.query(
        `SELECT
          rd.rid AS rid,
          COALESCE(r.name, rd.rid) AS recruiterName,
          COUNT(*) AS resumeCount
         FROM resumes_data rd
         LEFT JOIN recruiter r ON r.rid = rd.rid
         GROUP BY rd.rid, recruiterName
         ORDER BY resumeCount DESC, rd.rid ASC`
      );

      recruiterPerformance = recruiterRows.map((row) => ({
        rid: row.rid,
        recruiterName: row.recruiterName,
        resumeCount: Number(row.resumeCount) || 0,
      }));
    }

    if (await tableExists("applications")) {
      const hasResumeFilenameColumn = await columnExists("applications", "resume_filename");
      const resumeFilter = hasResumeFilenameColumn
        ? "AND resume_filename IS NOT NULL AND TRIM(resume_filename) <> ''"
        : "";

      const [rows] = await pool.query(
        `SELECT candidate_name AS candidateName, COUNT(*) AS clicks
         FROM applications
         WHERE candidate_name IS NOT NULL
           AND TRIM(candidate_name) <> ''
           ${resumeFilter}
         GROUP BY candidate_name
         ORDER BY clicks DESC, candidateName ASC
         LIMIT 12`
      );
      candidatePerformance = rows.map((row) => ({
        candidateName: row.candidateName,
        clicks: Number(row.clicks) || 0,
      }));
    } else if (await tableExists("recruiter_candidate_clicks")) {
      const [rows] = await pool.query(
        `SELECT candidate_name AS candidateName, COUNT(*) AS clicks
         FROM recruiter_candidate_clicks
         WHERE candidate_name IS NOT NULL AND candidate_name <> ''
         GROUP BY candidate_name
         ORDER BY clicks DESC, candidateName ASC
         LIMIT 12`
      );
      candidatePerformance = rows.map((row) => ({
        candidateName: row.candidateName,
        clicks: Number(row.clicks) || 0,
      }));
    }

    if (await tableExists("resumes_data")) {
      const hasJobJidColumn = await columnExists("resumes_data", "job_jid");
      const hasApplicantNameColumn = await columnExists("resumes_data", "applicant_name");
      const hasAtsScoreColumn = await columnExists("resumes_data", "ats_score");
      const hasAtsMatchColumn = await columnExists("resumes_data", "ats_match_percentage");
      const hasAcceptedColumn = await columnExists("resumes_data", "is_accepted");
      const hasAcceptedAtColumn = await columnExists("resumes_data", "accepted_at");
      const hasAcceptedByAdminColumn = await columnExists("resumes_data", "accepted_by_admin");
      const jobJidSelect = hasJobJidColumn ? "rd.job_jid AS jobJid," : "NULL AS jobJid,";
      const acceptedSelect = hasAcceptedColumn
        ? "rd.is_accepted AS isAccepted,"
        : "0 AS isAccepted,";
      const acceptedAtSelect = hasAcceptedAtColumn
        ? "rd.accepted_at AS acceptedAt,"
        : "NULL AS acceptedAt,";
      const acceptedByAdminSelect = hasAcceptedByAdminColumn
        ? "rd.accepted_by_admin AS acceptedByAdmin,"
        : "NULL AS acceptedByAdmin,";

      const [countRows] = await pool.query("SELECT COUNT(*) AS totalResumeCount FROM resumes_data");
      totalResumeCount = Number(countRows?.[0]?.totalResumeCount) || 0;

      const [rows] = await pool.query(
        `SELECT
          rd.res_id AS resId,
          rd.rid AS rid,
          r.name AS recruiterName,
          r.email AS recruiterEmail,
          ${jobJidSelect}
          j.points_per_joining AS pointsPerJoining,
          j.revenue AS revenue,
          rd.resume_filename AS resumeFilename,
          rd.resume_type AS resumeType,
          ${acceptedSelect}
          ${acceptedAtSelect}
          ${acceptedByAdminSelect}
          rd.uploaded_at AS uploadedAt
        FROM resumes_data rd
        INNER JOIN recruiter r ON r.rid = rd.rid
        LEFT JOIN jobs j ON j.jid = rd.job_jid
        ORDER BY rd.uploaded_at DESC`
      );

      recruiterResumeUploads = rows;

      if (hasJobJidColumn && await tableExists("jobs")) {
        const applicantNameSelect = hasApplicantNameColumn
          ? "ranked.applicant_name AS applicantName,"
          : "NULL AS applicantName,";
        const atsScoreSelect = hasAtsScoreColumn
          ? "ranked.ats_score AS atsScore,"
          : "NULL AS atsScore,";
        const atsMatchSelect = hasAtsMatchColumn
          ? "ranked.ats_match_percentage AS atsMatchPercentage,"
          : "NULL AS atsMatchPercentage,";

        const rankingFilter = hasAtsMatchColumn
          ? `rd2.ats_match_percentage > rd.ats_match_percentage
                OR (
                  rd2.ats_match_percentage = rd.ats_match_percentage
                  AND rd2.uploaded_at > rd.uploaded_at
                )
                OR (
                  rd2.ats_match_percentage = rd.ats_match_percentage
                  AND rd2.uploaded_at = rd.uploaded_at
                  AND rd2.res_id < rd.res_id
                )`
          : `rd2.uploaded_at > rd.uploaded_at
                OR (
                  rd2.uploaded_at = rd.uploaded_at
                  AND rd2.res_id < rd.res_id
                )`;

        const scoreNotNullFilter = hasAtsMatchColumn
          ? "AND rd.ats_match_percentage IS NOT NULL"
          : "";
        const scoreNotNullFilterInner = hasAtsMatchColumn
          ? "AND rd2.ats_match_percentage IS NOT NULL"
          : "";

        const [topRows] = await pool.query(
          `SELECT
            j.jid AS jobJid,
            j.role_name AS roleName,
            j.company_name AS companyName,
            ranked.res_id AS resId,
            ranked.rid AS rid,
            ${applicantNameSelect}
            ranked.resume_filename AS resumeFilename,
            ${atsScoreSelect}
            ${atsMatchSelect}
            ranked.uploaded_at AS uploadedAt
          FROM jobs j
          LEFT JOIN (
            SELECT rd.*
            FROM resumes_data rd
            WHERE rd.job_jid IS NOT NULL
              ${scoreNotNullFilter}
              AND (
                SELECT COUNT(*)
                FROM resumes_data rd2
                WHERE rd2.job_jid = rd.job_jid
                  ${scoreNotNullFilterInner}
                  AND (${rankingFilter})
              ) < 2
          ) ranked ON ranked.job_jid = j.jid
          ORDER BY j.jid DESC, ranked.job_jid IS NULL, ranked.uploaded_at DESC`
        );

        const groupedByJob = new Map();
        for (const row of topRows) {
          const key = Number(row.jobJid);
          if (!groupedByJob.has(key)) {
            groupedByJob.set(key, {
              jobJid: key,
              roleName: row.roleName || null,
              companyName: row.companyName || null,
              topResumes: [],
            });
          }

          if (row.resId) {
            groupedByJob.get(key).topResumes.push({
              resId: row.resId,
              rid: row.rid,
              applicantName: row.applicantName || null,
              resumeFilename: row.resumeFilename || null,
              atsScore: row.atsScore === null || row.atsScore === undefined
                ? null
                : Number(row.atsScore),
              atsMatchPercentage:
                row.atsMatchPercentage === null || row.atsMatchPercentage === undefined
                  ? null
                  : Number(row.atsMatchPercentage),
              uploadedAt: row.uploadedAt || null,
            });
          }
        }

        topResumesByJob = Array.from(groupedByJob.values()).map((job) => {
          const sorted = [...job.topResumes].sort((a, b) => {
            const matchA = a.atsMatchPercentage === null ? -1 : Number(a.atsMatchPercentage);
            const matchB = b.atsMatchPercentage === null ? -1 : Number(b.atsMatchPercentage);
            if (matchB !== matchA) return matchB - matchA;

            const timeA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
            const timeB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
            if (timeB !== timeA) return timeB - timeA;

            return String(a.resId || "").localeCompare(String(b.resId || ""));
          });

          return { ...job, topResumes: sorted.slice(0, 2) };
        });
      }
    }

    return res.status(200).json({
      recruiterPerformance,
      candidatePerformance,
      totalResumeCount,
      recruiterResumeUploads,
      topResumesByJob,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch admin dashboard.",
      error: error.message,
    });
  }
});

router.post("/api/admin/resumes/:resId/accept", async (req, res) => {
  if (!ensureAdminAuthorized(req, res)) return;

  const normalizedResId = String(req.params.resId || "").trim();
  const selectedByAdmin = String(req.body?.selected_by_admin || "admin-panel").trim() || "admin-panel";
  if (!normalizedResId) {
    return res.status(400).json({ message: "resId is required." });
  }

  const hasPointsColumn = await columnExists("recruiter", "points");
  const hasAcceptedColumn = await columnExists("resumes_data", "is_accepted");
  const hasAcceptedAtColumn = await columnExists("resumes_data", "accepted_at");
  const hasAcceptedByAdminColumn = await columnExists("resumes_data", "accepted_by_admin");

  if (!hasAcceptedColumn) {
    return res.status(500).json({ message: "Acceptance columns are not initialized." });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [resumeRows] = await connection.query(
      `SELECT
        res_id AS resId,
        rid,
        job_jid AS jobJid,
        is_accepted AS isAccepted
      FROM resumes_data
      WHERE res_id = ?
      LIMIT 1
      FOR UPDATE`,
      [normalizedResId]
    );

    if (resumeRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Resume not found." });
    }

    const resume = resumeRows[0];
    if (Boolean(resume.isAccepted)) {
      await connection.rollback();
      return res.status(200).json({
        message: "Resume is already accepted.",
        accepted: true,
        pointsAdded: 0,
        recruiterRid: resume.rid,
      });
    }

    let pointsPerJoining = 0;
    if (resume.jobJid) {
      const [jobRows] = await connection.query(
        "SELECT COALESCE(points_per_joining, 0) AS pointsPerJoining FROM jobs WHERE jid = ? LIMIT 1",
        [resume.jobJid]
      );
      pointsPerJoining = Number(jobRows?.[0]?.pointsPerJoining) || 0;
    }

    const updateAcceptedSegments = [];
    if (hasAcceptedColumn) updateAcceptedSegments.push("is_accepted = TRUE");
    if (hasAcceptedAtColumn) updateAcceptedSegments.push("accepted_at = CURRENT_TIMESTAMP");
    if (hasAcceptedByAdminColumn) updateAcceptedSegments.push("accepted_by_admin = ?");
    const updateParams = hasAcceptedByAdminColumn ? [selectedByAdmin, normalizedResId] : [normalizedResId];

    await connection.query(
      `UPDATE resumes_data SET ${updateAcceptedSegments.join(", ")} WHERE res_id = ?`,
      updateParams
    );

    if (hasPointsColumn && pointsPerJoining > 0) {
      await connection.query(
        "UPDATE recruiter SET points = COALESCE(points, 0) + ? WHERE rid = ?",
        [pointsPerJoining, resume.rid]
      );
    }

    await connection.commit();
    return res.status(200).json({
      message: "Resume accepted and recruiter points updated.",
      accepted: true,
      pointsAdded: pointsPerJoining,
      recruiterRid: resume.rid,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({
      message: "Failed to accept resume.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
});

router.get("/api/admin/job-alerts", async (req, res) => {
  if (!ensureAdminAuthorized(req, res)) return;

  try {
    const [rows] = await pool.query(
      `SELECT
        j.jid AS jobJid,
        j.company_name AS companyName,
        j.role_name AS roleName,
        j.positions_open AS positionsOpen,
        j.created_at AS createdAt,
        COUNT(rd.res_id) AS totalSubmittedResumes,
        SUM(CASE WHEN jrs.selection_status = 'selected' THEN 1 ELSE 0 END) AS selectedCount
      FROM jobs j
      LEFT JOIN resumes_data rd ON rd.job_jid = j.jid
      LEFT JOIN job_resume_selection jrs ON jrs.job_jid = j.jid AND jrs.res_id = rd.res_id
      GROUP BY j.jid, j.company_name, j.role_name, j.positions_open, j.created_at
      ORDER BY j.created_at DESC, j.jid DESC`
    );

    return res.status(200).json({
      jobs: rows.map((row) => ({
        jobJid: Number(row.jobJid),
        companyName: row.companyName,
        roleName: row.roleName,
        positionsOpen: Number(row.positionsOpen) || 1,
        createdAt: row.createdAt,
        totalSubmittedResumes: Number(row.totalSubmittedResumes) || 0,
        selectedCount: Number(row.selectedCount) || 0,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch job alerts.",
      error: error.message,
    });
  }
});

router.get("/api/admin/jobs/:jid/resumes", async (req, res) => {
  if (!ensureAdminAuthorized(req, res)) return;

  const safeJobId = Number(req.params.jid);
  if (!Number.isInteger(safeJobId) || safeJobId <= 0) {
    return res.status(400).json({ message: "jid must be a positive integer." });
  }

  try {
    const [jobs] = await pool.query(
      `SELECT
        jid AS jobJid,
        company_name AS companyName,
        role_name AS roleName,
        positions_open AS positionsOpen
      FROM jobs
      WHERE jid = ?
      LIMIT 1`,
      [safeJobId]
    );

    if (jobs.length === 0) {
      return res.status(404).json({ message: "Job not found." });
    }

    const hasAtsScoreColumn = await columnExists("resumes_data", "ats_score");
    const hasAtsMatchColumn = await columnExists("resumes_data", "ats_match_percentage");

    const atsScoreSelect = hasAtsScoreColumn ? "rd.ats_score AS atsScore," : "NULL AS atsScore,";
    const atsMatchSelect = hasAtsMatchColumn
      ? "rd.ats_match_percentage AS atsMatchPercentage,"
      : "NULL AS atsMatchPercentage,";

    const [rows] = await pool.query(
      `SELECT
        rd.res_id AS resId,
        rd.rid AS rid,
        r.name AS recruiterName,
        r.email AS recruiterEmail,
        rd.resume_filename AS resumeFilename,
        rd.resume_type AS resumeType,
        ${atsScoreSelect}
        ${atsMatchSelect}
        rd.uploaded_at AS uploadedAt,
        jrs.selection_status AS selectionStatus,
        jrs.selection_note AS selectionNote,
        jrs.selected_by_admin AS selectedByAdmin,
        jrs.selected_at AS selectedAt
      FROM resumes_data rd
      INNER JOIN recruiter r ON r.rid = rd.rid
      LEFT JOIN job_resume_selection jrs
        ON jrs.job_jid = rd.job_jid
       AND jrs.res_id = rd.res_id
      WHERE rd.job_jid = ?
      ORDER BY rd.uploaded_at DESC, rd.res_id ASC`,
      [safeJobId]
    );

    return res.status(200).json({
      job: {
        jobJid: Number(jobs[0].jobJid),
        companyName: jobs[0].companyName,
        roleName: jobs[0].roleName,
        positionsOpen: Number(jobs[0].positionsOpen) || 1,
      },
      resumes: rows.map((row) => ({
        resId: row.resId,
        rid: row.rid,
        recruiterName: row.recruiterName,
        recruiterEmail: row.recruiterEmail,
        resumeFilename: row.resumeFilename,
        resumeType: row.resumeType,
        atsScore: row.atsScore === null ? null : Number(row.atsScore),
        atsMatchPercentage: row.atsMatchPercentage === null ? null : Number(row.atsMatchPercentage),
        uploadedAt: row.uploadedAt,
        selection: row.selectionStatus
          ? {
              status: row.selectionStatus,
              note: row.selectionNote || null,
              selectedByAdmin: row.selectedByAdmin || null,
              selectedAt: row.selectedAt || null,
            }
          : null,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch job resumes.",
      error: error.message,
    });
  }
});

router.post("/api/admin/jobs/:jid/resume-selections", async (req, res) => {
  if (!ensureAdminAuthorized(req, res)) return;

  const safeJobId = Number(req.params.jid);
  if (!Number.isInteger(safeJobId) || safeJobId <= 0) {
    return res.status(400).json({ message: "jid must be a positive integer." });
  }

  const { resId, selection_status, selection_note, selected_by_admin } = req.body || {};
  const normalizedResId = String(resId || "").trim();
  const normalizedStatus = String(selection_status || "").trim().toLowerCase();
  const normalizedSelectedByAdmin = String(selected_by_admin || "").trim();
  const normalizedSelectionNote = selection_note === undefined || selection_note === null
    ? null
    : String(selection_note).trim();
  const allowedStatuses = new Set(["selected", "rejected", "on_hold"]);

  if (!normalizedResId || !normalizedSelectedByAdmin || !allowedStatuses.has(normalizedStatus)) {
    return res.status(400).json({
      message: "resId, selection_status, and selected_by_admin are required.",
    });
  }

  try {
    const [resumeRows] = await pool.query(
      `SELECT res_id AS resId, job_jid AS jobJid
       FROM resumes_data
       WHERE res_id = ?
       LIMIT 1`,
      [normalizedResId]
    );

    if (resumeRows.length === 0) {
      return res.status(404).json({ message: "Resume not found." });
    }

    if (Number(resumeRows[0].jobJid) !== safeJobId) {
      return res.status(400).json({
        message: "The provided resume is not associated with this job.",
      });
    }

    await pool.query(
      `INSERT INTO job_resume_selection
        (job_jid, res_id, selected_by_admin, selection_status, selection_note)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         selected_by_admin = VALUES(selected_by_admin),
         selection_status = VALUES(selection_status),
         selection_note = VALUES(selection_note),
         selected_at = CURRENT_TIMESTAMP`,
      [
        safeJobId,
        normalizedResId,
        normalizedSelectedByAdmin,
        normalizedStatus,
        normalizedSelectionNote || null,
      ]
    );

    return res.status(200).json({
      message: "Resume selection updated successfully.",
      selection: {
        jobJid: safeJobId,
        resId: normalizedResId,
        selectionStatus: normalizedStatus,
        selectionNote: normalizedSelectionNote || null,
        selectedByAdmin: normalizedSelectedByAdmin,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update resume selection.",
      error: error.message,
    });
  }
});

router.get("/api/admin/jobs/:jid/selection-summary", async (req, res) => {
  if (!ensureAdminAuthorized(req, res)) return;

  const safeJobId = Number(req.params.jid);
  if (!Number.isInteger(safeJobId) || safeJobId <= 0) {
    return res.status(400).json({ message: "jid must be a positive integer." });
  }

  try {
    const [jobRows] = await pool.query(
      `SELECT
        jid AS jobJid,
        company_name AS companyName,
        role_name AS roleName,
        positions_open AS positionsOpen
      FROM jobs
      WHERE jid = ?
      LIMIT 1`,
      [safeJobId]
    );

    if (jobRows.length === 0) {
      return res.status(404).json({ message: "Job not found." });
    }

    const [selectedRows] = await pool.query(
      `SELECT
        jrs.res_id AS resId,
        jrs.selection_note AS selectionNote,
        jrs.selected_by_admin AS selectedByAdmin,
        jrs.selected_at AS selectedAt,
        rd.rid AS rid,
        rd.resume_filename AS resumeFilename
      FROM job_resume_selection jrs
      INNER JOIN resumes_data rd ON rd.res_id = jrs.res_id
      WHERE jrs.job_jid = ?
        AND jrs.selection_status = 'selected'
      ORDER BY jrs.selected_at DESC, jrs.id DESC`,
      [safeJobId]
    );

    const positionsOpen = Number(jobRows[0].positionsOpen) || 1;
    const selectedCount = selectedRows.length;

    return res.status(200).json({
      summary: {
        jobJid: Number(jobRows[0].jobJid),
        companyName: jobRows[0].companyName,
        roleName: jobRows[0].roleName,
        positionsOpen,
        selectedCount,
        remainingSlots: positionsOpen - selectedCount,
      },
      selectedResumes: selectedRows.map((row) => ({
        resId: row.resId,
        rid: row.rid,
        resumeFilename: row.resumeFilename,
        selectionNote: row.selectionNote || null,
        selectedByAdmin: row.selectedByAdmin || null,
        selectedAt: row.selectedAt || null,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch selection summary.",
      error: error.message,
    });
  }
});

module.exports = router;
