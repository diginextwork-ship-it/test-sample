const express = require("express");
const pool = require("../config/db");

const router = express.Router();

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
      const jobJidSelect = hasJobJidColumn ? "rd.job_jid AS jobJid," : "NULL AS jobJid,";

      const [countRows] = await pool.query("SELECT COUNT(*) AS totalResumeCount FROM resumes_data");
      totalResumeCount = Number(countRows?.[0]?.totalResumeCount) || 0;

      const [rows] = await pool.query(
        `SELECT
          rd.res_id AS resId,
          rd.rid AS rid,
          r.name AS recruiterName,
          r.email AS recruiterEmail,
          ${jobJidSelect}
          rd.resume_filename AS resumeFilename,
          rd.resume_type AS resumeType,
          rd.uploaded_at AS uploadedAt
        FROM resumes_data rd
        INNER JOIN recruiter r ON r.rid = rd.rid
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

module.exports = router;
