const express = require("express");
const pool = require("../config/db");
const { extractResumeAts } = require("../resumeparser/service");

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

const getRecruiterIdColumn = async (tableName) => {
  if (await columnExists(tableName, "recruiter_rid")) return "recruiter_rid";
  if (await columnExists(tableName, "rid")) return "rid";
  return null;
};

const normalizeRecruiterRole = (value, addjobValue) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "job creator" || normalized === "recruiter") return normalized;
  return Boolean(addjobValue) ? "job creator" : "recruiter";
};

const getRecruiterSummary = async (rid) => {
  const hasSuccessColumn = await columnExists("recruiter", "success");
  let success = 0;
  let thisMonth = 0;
  let monthlyTrend = [];

  if (hasSuccessColumn) {
    const [rows] = await pool.query(
      "SELECT COALESCE(success, 0) AS success FROM recruiter WHERE rid = ? LIMIT 1",
      [rid]
    );
    success = Number(rows?.[0]?.success) || 0;
  }

  const hasClicksTable = await tableExists("recruiter_candidate_clicks");
  if (hasClicksTable) {
    const recruiterIdColumn = await getRecruiterIdColumn("recruiter_candidate_clicks");
    if (!recruiterIdColumn) {
      return { success, thisMonth, monthlyTrend };
    }

    const [trendRows] = await pool.query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS clicks
       FROM recruiter_candidate_clicks
       WHERE ${recruiterIdColumn} = ?
         AND YEAR(created_at) = YEAR(CURDATE())
         AND MONTH(created_at) = MONTH(CURDATE())
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) ASC`,
      [rid]
    );

    monthlyTrend = trendRows.map((row) => ({
      date: row.date,
      clicks: Number(row.clicks) || 0,
    }));
    thisMonth = monthlyTrend.reduce((sum, row) => sum + row.clicks, 0);
  }

  return { success, thisMonth, monthlyTrend };
};


router.post("/api/recruiters", async (req, res) => {
  const { name, email, password, role } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({
      message: "name, email, and password are required.",
    });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const gmailMatch = normalizedEmail.match(/^([a-z0-9._%+-]+)@gmail\.com$/i);
  if (!gmailMatch) {
    return res.status(400).json({
      message: "Email must be a valid @gmail.com address.",
    });
  }
  const gmailLocalPart = gmailMatch[1].toLowerCase();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existing] = await connection.query(
      `SELECT rid
       FROM recruiter
       WHERE LOWER(SUBSTRING_INDEX(email, '@', 1)) = ?
         AND LOWER(SUBSTRING_INDEX(email, '@', -1)) = 'gmail.com'
       LIMIT 1`,
      [gmailLocalPart]
    );
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        message: "Recruiter identity already exists before @gmail.com.",
      });
    }

    const [rows] = await connection.query(
      "SELECT rid FROM recruiter WHERE rid LIKE 'hnr-%' ORDER BY CAST(SUBSTRING(rid, 5) AS UNSIGNED) DESC LIMIT 1 FOR UPDATE"
    );

    const lastRid = rows.length > 0 ? rows[0].rid : null;
    const nextNumber = lastRid ? Number.parseInt(lastRid.replace("hnr-", ""), 10) + 1 : 1;
    const rid = `hnr-${nextNumber}`;

    const normalizedRole = String(role || "recruiter").trim().toLowerCase();
    const allowedRoles = new Set(["job creator", "recruiter"]);
    if (!allowedRoles.has(normalizedRole)) {
      await connection.rollback();
      return res.status(400).json({
        message: "role must be either 'job creator' or 'recruiter'.",
      });
    }

    const canAddJob = normalizedRole === "job creator";
    const hasRoleColumn = await columnExists("recruiter", "role");
    const hasAddJobColumn = await columnExists("recruiter", "addjob");

    if (hasRoleColumn && hasAddJobColumn) {
      await connection.query(
        "INSERT INTO recruiter (rid, name, email, password, role, addjob) VALUES (?, ?, ?, ?, ?, ?)",
        [rid, name.trim(), normalizedEmail, password, normalizedRole, canAddJob]
      );
    } else if (hasRoleColumn) {
      await connection.query(
        "INSERT INTO recruiter (rid, name, email, password, role) VALUES (?, ?, ?, ?, ?)",
        [rid, name.trim(), normalizedEmail, password, normalizedRole]
      );
    } else if (hasAddJobColumn) {
      await connection.query(
        "INSERT INTO recruiter (rid, name, email, password, addjob) VALUES (?, ?, ?, ?, ?)",
        [rid, name.trim(), normalizedEmail, password, canAddJob]
      );
    } else {
      await connection.query(
        "INSERT INTO recruiter (rid, name, email, password) VALUES (?, ?, ?, ?)",
        [rid, name.trim(), normalizedEmail, password]
      );
    }

    await connection.commit();
    return res.status(201).json({
      message: "Recruiter created successfully.",
      recruiter: {
        rid,
        name: name.trim(),
        email: normalizedEmail,
        role: normalizedRole,
        addjob: canAddJob,
      },
    });
  } catch (error) {
    await connection.rollback();
    if (error && error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Duplicate recruiter entry." });
    }

    return res.status(500).json({
      message: "Failed to create recruiter.",
      error: error.message,
    });
  } finally {
    connection.release();
  }
});

router.post("/api/recruiters/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required." });
  }

  try {
    const hasRoleColumn = await columnExists("recruiter", "role");
    const hasAddJobColumn = await columnExists("recruiter", "addjob");
    const selectRole = hasRoleColumn ? "role" : "NULL AS role";
    const selectAddJob = hasAddJobColumn ? "addjob" : "0 AS addjob";

    const [rows] = await pool.query(
      `SELECT rid, name, email, ${selectRole}, ${selectAddJob}
       FROM recruiter
       WHERE email = ? AND password = ?
       LIMIT 1`,
      [email.trim().toLowerCase(), password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const recruiter = rows[0];
    const recruiterRole = normalizeRecruiterRole(recruiter.role, recruiter.addjob);

    return res.status(200).json({ 
      message: "Login successful.",
      recruiter: {
        rid: recruiter.rid,
        name: recruiter.name,
        email: recruiter.email,
        role: recruiterRole,
        addjob: Boolean(recruiter.addjob),
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Login failed.",
      error: error.message,
    });
  }
});

router.post("/api/recruiters/:rid/resumes", async (req, res) => {
  const { rid } = req.params;
  const { job_jid, resumeBase64, resumeFilename, resumeMimeType } = req.body || {};

  if (!job_jid || !resumeBase64 || !resumeFilename) {
    return res.status(400).json({
      message: "job_jid, resumeBase64, and resumeFilename are required.",
    });
  }

  const safeJobId = Number(job_jid);
  if (!Number.isInteger(safeJobId) || safeJobId <= 0) {
    return res.status(400).json({ message: "job_jid must be a positive integer." });
  }

  const normalizedFilename = String(resumeFilename).trim();
  const extensionMatch = normalizedFilename.match(/\.([a-z0-9]+)$/i);
  const extension = extensionMatch ? extensionMatch[1].toLowerCase() : "";
  const supportedTypes = new Set(["pdf", "doc", "docx"]);
  if (!supportedTypes.has(extension)) {
    return res.status(400).json({
      message: "Only PDF, DOC, or DOCX files are allowed.",
    });
  }

  try {
    const hasRoleColumn = await columnExists("recruiter", "role");
    const hasAddJobColumn = await columnExists("recruiter", "addjob");
    const recruiterSelectFields = [];
    if (hasRoleColumn) recruiterSelectFields.push("role");
    if (hasAddJobColumn) recruiterSelectFields.push("addjob");
    if (recruiterSelectFields.length === 0) recruiterSelectFields.push("NULL AS role");

    const [recruiterRows] = await pool.query(
      `SELECT ${recruiterSelectFields.join(", ")}
       FROM recruiter
       WHERE rid = ?
       LIMIT 1`,
      [rid]
    );

    if (recruiterRows.length === 0) {
      return res.status(404).json({ message: "Recruiter not found." });
    }

    const recruiterRole = normalizeRecruiterRole(
      recruiterRows[0].role,
      recruiterRows[0].addjob
    );
    if (recruiterRole !== "recruiter") {
      return res.status(403).json({
        message: "Only recruiter role can add resumes.",
      });
    }

    const [jobRows] = await pool.query(
      "SELECT jid, job_description AS jobDescription FROM jobs WHERE jid = ? LIMIT 1",
      [safeJobId]
    );
    if (jobRows.length === 0) {
      return res.status(404).json({ message: "Job not found." });
    }

    const base64Payload = String(resumeBase64).includes(",")
      ? String(resumeBase64).split(",").pop()
      : String(resumeBase64);
    const resumeBuffer = Buffer.from(base64Payload, "base64");
    if (!resumeBuffer || resumeBuffer.length === 0) {
      return res.status(400).json({ message: "Resume file content is invalid." });
    }

    if (resumeBuffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ message: "Resume file size must be 10MB or less." });
    }

    const hasJobJidColumn = await columnExists("resumes_data", "job_jid");
    const hasApplicantNameColumn = await columnExists("resumes_data", "applicant_name");
    const hasAtsScoreColumn = await columnExists("resumes_data", "ats_score");
    const hasAtsMatchColumn = await columnExists("resumes_data", "ats_match_percentage");
    const hasAtsRawColumn = await columnExists("resumes_data", "ats_raw_json");
    const normalizedMimeType = String(resumeMimeType || "").trim().toLowerCase();

    const shouldExtractResumeData =
      hasApplicantNameColumn || hasAtsScoreColumn || hasAtsMatchColumn || hasAtsRawColumn;
    const resumeAts =
      shouldExtractResumeData
        ? await extractResumeAts({
          resumeBuffer,
          resumeFilename: normalizedFilename,
          jobDescription: jobRows[0].jobDescription,
        })
        : {
            atsScore: null,
            atsMatchPercentage: null,
            atsRawJson: null,
            applicantName: null,
            atsStatus: "not_stored",
          };

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [sequenceResult] = await connection.query("INSERT INTO resume_id_sequence VALUES ()");
      const sequenceValue = Number(sequenceResult.insertId);
      const resId = `res_${sequenceValue}`;

      const insertColumns = ["res_id", "rid"];
      const insertValues = [resId, rid];

      if (hasJobJidColumn) {
        insertColumns.push("job_jid");
        insertValues.push(safeJobId);
      }

      insertColumns.push("resume", "resume_filename", "resume_type");
      insertValues.push(resumeBuffer, normalizedFilename, extension);

      if (hasApplicantNameColumn) {
        insertColumns.push("applicant_name");
        insertValues.push(resumeAts.applicantName || null);
      }

      if (hasAtsScoreColumn) {
        insertColumns.push("ats_score");
        insertValues.push(resumeAts.atsScore);
      }

      if (hasAtsMatchColumn) {
        insertColumns.push("ats_match_percentage");
        insertValues.push(resumeAts.atsMatchPercentage);
      }

      if (hasAtsRawColumn) {
        insertColumns.push("ats_raw_json");
        insertValues.push(
          resumeAts.atsRawJson === undefined || resumeAts.atsRawJson === null
            ? null
            : JSON.stringify(resumeAts.atsRawJson)
        );
      }

      const placeholders = insertColumns.map(() => "?").join(", ");
      await connection.query(
        `INSERT INTO resumes_data (${insertColumns.join(", ")}) VALUES (${placeholders})`,
        insertValues
      );

      await connection.commit();
      return res.status(201).json({
        message: "Resume added successfully.",
        resume: {
          resId,
          rid,
          jobJid: safeJobId,
          resumeFilename: normalizedFilename,
          resumeType: extension,
          resumeMimeType: normalizedMimeType || null,
          atsScore: resumeAts.atsScore,
          atsMatchPercentage: resumeAts.atsMatchPercentage,
          atsStatus: resumeAts.atsStatus,
        },
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return res.status(500).json({
      message: "Failed to add resume.",
      error: error.message,
    });
  }
});

router.get("/api/recruiters/:rid/resumes", async (req, res) => {
  const { rid } = req.params;

  try {
    const hasJobJidColumn = await columnExists("resumes_data", "job_jid");
    const hasAtsScoreColumn = await columnExists("resumes_data", "ats_score");
    const hasAtsMatchColumn = await columnExists("resumes_data", "ats_match_percentage");
    const jobJidSelection = hasJobJidColumn ? "job_jid AS jobJid," : "NULL AS jobJid,";
    const atsScoreSelection = hasAtsScoreColumn ? "ats_score AS atsScore," : "NULL AS atsScore,";
    const atsMatchSelection = hasAtsMatchColumn
      ? "ats_match_percentage AS atsMatchPercentage,"
      : "NULL AS atsMatchPercentage,";

    const [rows] = await pool.query(
      `SELECT
        res_id AS resId,
        ${jobJidSelection}
        resume_filename AS resumeFilename,
        resume_type AS resumeType,
        ${atsScoreSelection}
        ${atsMatchSelection}
        uploaded_at AS uploadedAt
      FROM resumes_data
      WHERE rid = ?
      ORDER BY uploaded_at DESC`,
      [rid]
    );

    return res.status(200).json({
      resumes: rows.map((row) => ({
        ...row,
        atsScore: row.atsScore === null ? null : Number(row.atsScore),
        atsMatchPercentage: row.atsMatchPercentage === null ? null : Number(row.atsMatchPercentage),
      })),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch resumes.",
      error: error.message,
    });
  }
});

router.get("/api/recruiters/:rid/resumes/:resId/file", async (req, res) => {
  const { rid, resId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT
        resume,
        resume_filename AS resumeFilename,
        resume_type AS resumeType
      FROM resumes_data
      WHERE res_id = ? AND rid = ?
      LIMIT 1`,
      [resId, rid]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Resume not found." });
    }

    const row = rows[0];
    const mimeTypeByResumeType = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    const mimeType = mimeTypeByResumeType[String(row.resumeType || "").toLowerCase()] ||
      "application/octet-stream";

    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${String(row.resumeFilename || "resume").replace(/"/g, "")}"`
    );
    return res.send(row.resume);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch resume file.",
      error: error.message,
    });
  }
});

router.get("/api/recruiters/:rid/dashboard", async (req, res) => {
  const { rid } = req.params;

  try {
    const [rows] = await pool.query("SELECT rid FROM recruiter WHERE rid = ? LIMIT 1", [rid]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Recruiter not found." });
    }

    const summary = await getRecruiterSummary(rid);
    return res.status(200).json({
      summary: {
        success: summary.success,
        thisMonth: summary.thisMonth,
      },
      monthlyTrend: summary.monthlyTrend,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch recruiter dashboard.",
      error: error.message,
    });
  }
});

router.post("/api/recruiters/:rid/candidate-click", async (req, res) => {
  const { rid } = req.params;
  const { candidateName } = req.body || {};

  try {
    const [rows] = await pool.query("SELECT rid FROM recruiter WHERE rid = ? LIMIT 1", [rid]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Recruiter not found." });
    }

    if (await columnExists("recruiter", "success")) {
      await pool.query("UPDATE recruiter SET success = COALESCE(success, 0) + 1 WHERE rid = ?", [
        rid,
      ]);
    }

    if (await tableExists("recruiter_candidate_clicks")) {
      const recruiterIdColumn = await getRecruiterIdColumn("recruiter_candidate_clicks");
      if (recruiterIdColumn) {
        await pool.query(
          `INSERT INTO recruiter_candidate_clicks (${recruiterIdColumn}, candidate_name) VALUES (?, ?)`,
          [rid, candidateName?.trim() || null]
        );
      }
    }

    const summary = await getRecruiterSummary(rid);
    return res.status(200).json({
      message: "Candidate completion updated.",
      summary: {
        success: summary.success,
        thisMonth: summary.thisMonth,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update completion count.",
      error: error.message,
    });
  }
});

router.get("/api/recruiters/:rid/applications", async (req, res) => {
  const { rid } = req.params;

  try {
    const hasApplicationsTable = await tableExists("applications");
    const hasJobsTable = await tableExists("jobs");
    const jobsRecruiterIdColumn = hasJobsTable ? await getRecruiterIdColumn("jobs") : null;

    if (!hasApplicationsTable || !hasJobsTable || !jobsRecruiterIdColumn) {
      return res.status(200).json({ applications: [] });
    }

    const [rows] = await pool.query(
      `SELECT
        a.id,
        a.job_jid AS jobJid,
        a.candidate_name AS candidateName,
        a.email,
        a.ats_score AS atsScore,
        a.ats_match_percentage AS atsMatchPercentage,
        a.resume_filename AS resumeFilename,
        a.created_at AS createdAt,
        j.role_name AS roleName,
        j.company_name AS companyName
      FROM applications a
      INNER JOIN jobs j ON j.jid = a.job_jid
      WHERE j.${jobsRecruiterIdColumn} = ?
      ORDER BY a.created_at DESC`,
      [rid]
    );

    return res.status(200).json({
      applications: rows.map((row) => ({
        id: row.id,
        candidateName: row.candidateName,
        email: row.email,
        jobJid: row.jobJid === null ? null : Number(row.jobJid),
        atsScore: row.atsScore === null ? null : Number(row.atsScore),
        atsMatchPercentage:
          row.atsMatchPercentage === null ? null : Number(row.atsMatchPercentage),
        resumeFilename: row.resumeFilename || null,
        createdAt: row.createdAt,
        job: {
          roleName: row.roleName,
          companyName: row.companyName,
        },
      })),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch recruiter applications.",
      error: error.message,
    });
  }
});

module.exports = router;

