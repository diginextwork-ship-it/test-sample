const express = require("express");
const multer = require("multer");
const pool = require("../config/db");
const { extractResumeAts } = require("../resumeparser/service");
const {
  createAuthToken,
  requireAuth,
  requireRoles,
  requireRecruiterOwner,
} = require("../middleware/auth");

const router = express.Router();
const uploadResume = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

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
  if (normalized === "job creator" || normalized === "job adder" || normalized === "job_adder") {
    return "job adder";
  }
  if (normalized === "recruiter") {
    return "recruiter";
  }
  return Boolean(addjobValue) ? "job adder" : "recruiter";
};

const normalizeAccessMode = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "restricted") return "restricted";
  return "open";
};

const toPositiveInt = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const toNonNegativeInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return parsed;
};

const escapeLike = (value) => String(value || "").replace(/[\\%_]/g, "\\$&");

const authorizeRecruiterResourceView = (req, res, rid) => {
  const role = String(req.auth?.role || "").trim().toLowerCase();
  const authRid = String(req.auth?.rid || "").trim();

  if (role === "recruiter" && authRid !== rid) {
    res.status(403).json({ message: "You can only access your own recruiter resources." });
    return false;
  }

  if (role === "job adder" || role === "job_adder") {
    return true;
  }

  if (role !== "recruiter") {
    res.status(403).json({ message: "You do not have access to this resource." });
    return false;
  }

  return true;
};

const checkJobAccess = async (recruiterId, jobId) => {
  const safeJobId = toPositiveInt(jobId);
  if (!safeJobId) {
    return { canAccess: false, reason: "job_jid must be a positive integer." };
  }

  const hasAccessModeColumn = await columnExists("jobs", "access_mode");
  const [jobRows] = await pool.query(
    `SELECT
      jid,
      company_name,
      ${hasAccessModeColumn ? "access_mode" : "'open'"} AS access_mode
    FROM jobs
    WHERE jid = ?
    LIMIT 1`,
    [safeJobId]
  );

  if (jobRows.length === 0) {
    return { canAccess: false, reason: "Job not found", jobDetails: null };
  }

  const job = jobRows[0];
  const accessMode = normalizeAccessMode(job.access_mode);
  const jobDetails = {
    jid: Number(job.jid),
    company_name: job.company_name || "",
    access_mode: accessMode,
  };

  if (accessMode === "open") {
    return {
      canAccess: true,
      reason: "Job is open to all recruiters",
      jobDetails,
    };
  }

  const [accessRows] = await pool.query(
    `SELECT id
     FROM job_recruiter_access
     WHERE job_jid = ? AND recruiter_rid = ? AND is_active = TRUE
     LIMIT 1`,
    [safeJobId, recruiterId]
  );

  if (accessRows.length > 0) {
    return {
      canAccess: true,
      reason: "You have been granted access to this job",
      jobDetails,
    };
  }

  return {
    canAccess: false,
    reason: "This job is restricted and you don't have access",
    jobDetails,
  };
};

const runResumeUpload = (req, res) =>
  new Promise((resolve, reject) => {
    uploadResume.single("resume_file")(req, res, (error) => {
      if (error) return reject(error);
      return resolve();
    });
  });

const getRecruiterSummary = async (rid) => {
  const hasSuccessColumn = await columnExists("recruiter", "success");
  const hasPointsColumn = await columnExists("recruiter", "points");
  let success = 0;
  let points = 0;
  let thisMonth = 0;
  let monthlyTrend = [];

  if (hasSuccessColumn) {
    const [rows] = await pool.query(
      "SELECT COALESCE(success, 0) AS success FROM recruiter WHERE rid = ? LIMIT 1",
      [rid]
    );
    success = Number(rows?.[0]?.success) || 0;
  }

  if (hasPointsColumn) {
    const [rows] = await pool.query(
      "SELECT COALESCE(points, 0) AS points FROM recruiter WHERE rid = ? LIMIT 1",
      [rid]
    );
    points = Number(rows?.[0]?.points) || 0;
  }

  const hasClicksTable = await tableExists("recruiter_candidate_clicks");
  if (hasClicksTable) {
    const recruiterIdColumn = await getRecruiterIdColumn("recruiter_candidate_clicks");
    if (!recruiterIdColumn) {
      return { success, points, thisMonth, monthlyTrend };
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

  return { success, points, thisMonth, monthlyTrend };
};


router.post("/api/recruiters", requireAuth, requireRoles("admin"), async (req, res) => {
  const { name, email, password, role } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({
      message: "name, email, and password are required.",
    });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(normalizedEmail)) {
    return res.status(400).json({
      message: "Email must be a valid email address.",
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existing] = await connection.query(
      `SELECT rid
       FROM recruiter
       WHERE LOWER(email) = ?
       LIMIT 1`,
      [normalizedEmail]
    );
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        message: "Recruiter email already exists.",
      });
    }

    const [rows] = await connection.query(
      "SELECT rid FROM recruiter WHERE rid LIKE 'hnr-%' ORDER BY CAST(SUBSTRING(rid, 5) AS UNSIGNED) DESC LIMIT 1 FOR UPDATE"
    );

    const lastRid = rows.length > 0 ? rows[0].rid : null;
    const nextNumber = lastRid ? Number.parseInt(lastRid.replace("hnr-", ""), 10) + 1 : 1;
    const rid = `hnr-${nextNumber}`;

    const normalizedRole = String(role || "recruiter").trim().toLowerCase();
    const allowedRoles = new Set(["job creator", "job adder", "job_adder", "recruiter"]);
    if (!allowedRoles.has(normalizedRole)) {
      await connection.rollback();
      return res.status(400).json({
        message: "role must be one of 'job creator', 'job adder', 'job_adder', or 'recruiter'.",
      });
    }

    const canAddJob =
      normalizedRole === "job creator" ||
      normalizedRole === "job adder" ||
      normalizedRole === "job_adder";
    const hasRoleColumn = await columnExists("recruiter", "role");
    const hasAddJobColumn = await columnExists("recruiter", "addjob");
    const hasPointsColumn = await columnExists("recruiter", "points");

    if (hasRoleColumn && hasAddJobColumn && hasPointsColumn) {
      await connection.query(
        "INSERT INTO recruiter (rid, name, email, password, role, addjob, points) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [rid, name.trim(), normalizedEmail, password, normalizedRole, canAddJob, 0]
      );
    } else if (hasRoleColumn && hasAddJobColumn) {
      await connection.query(
        "INSERT INTO recruiter (rid, name, email, password, role, addjob) VALUES (?, ?, ?, ?, ?, ?)",
        [rid, name.trim(), normalizedEmail, password, normalizedRole, canAddJob]
      );
    } else if (hasRoleColumn && hasPointsColumn) {
      await connection.query(
        "INSERT INTO recruiter (rid, name, email, password, role, points) VALUES (?, ?, ?, ?, ?, ?)",
        [rid, name.trim(), normalizedEmail, password, normalizedRole, 0]
      );
    } else if (hasRoleColumn) {
      await connection.query(
        "INSERT INTO recruiter (rid, name, email, password, role) VALUES (?, ?, ?, ?, ?)",
        [rid, name.trim(), normalizedEmail, password, normalizedRole]
      );
    } else if (hasAddJobColumn && hasPointsColumn) {
      await connection.query(
        "INSERT INTO recruiter (rid, name, email, password, addjob, points) VALUES (?, ?, ?, ?, ?, ?)",
        [rid, name.trim(), normalizedEmail, password, canAddJob, 0]
      );
    } else if (hasAddJobColumn) {
      await connection.query(
        "INSERT INTO recruiter (rid, name, email, password, addjob) VALUES (?, ?, ?, ?, ?)",
        [rid, name.trim(), normalizedEmail, password, canAddJob]
      );
    } else if (hasPointsColumn) {
      await connection.query(
        "INSERT INTO recruiter (rid, name, email, password, points) VALUES (?, ?, ?, ?, ?)",
        [rid, name.trim(), normalizedEmail, password, 0]
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

    const token = createAuthToken({
      role: recruiterRole,
      rid: recruiter.rid,
      email: recruiter.email,
      name: recruiter.name,
    });

    return res.status(200).json({
      message: "Login successful.",
      token,
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

router.get(
  "/api/recruiters/list",
  requireAuth,
  requireRoles("job adder", "job_adder"),
  async (req, res) => {
    const rawSearch = String(req.query?.search || "").trim();
    const safeLike = `%${rawSearch.replace(/[%_]/g, "\\$&")}%`;

    try {
      const hasPointsColumn = await columnExists("recruiter", "points");
      const hasRoleColumn = await columnExists("recruiter", "role");
      const pointsSelect = hasPointsColumn ? "COALESCE(points, 0)" : "0";
      const roleFilter = hasRoleColumn ? "AND LOWER(TRIM(role)) = 'recruiter'" : "";

      const query = rawSearch
        ? `SELECT rid, name, email, ${pointsSelect} AS points
           FROM recruiter
           WHERE 1 = 1
             ${roleFilter}
             AND (name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR rid LIKE ? ESCAPE '\\')
           ORDER BY name ASC, rid ASC`
        : `SELECT rid, name, email, ${pointsSelect} AS points
           FROM recruiter
           WHERE 1 = 1
             ${roleFilter}
           ORDER BY name ASC, rid ASC`;

      const params = rawSearch ? [safeLike, safeLike, safeLike] : [];
      const [rows] = await pool.query(query, params);

      return res.status(200).json({
        recruiters: rows.map((row) => ({
          rid: row.rid,
          name: row.name,
          email: row.email,
          points: Number(row.points) || 0,
        })),
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to fetch recruiters list.",
        error: error.message,
      });
    }
  }
);

router.get(
  "/api/recruiters/:rid/accessible-jobs",
  requireAuth,
  requireRoles("recruiter", "job adder", "job_adder"),
  async (req, res) => {
    const rid = String(req.params.rid || "").trim();
    if (!rid) {
      return res.status(400).json({ message: "rid is required." });
    }

    if (!authorizeRecruiterResourceView(req, res, rid)) return;

    const locationFilter = String(req.query?.location || "").trim();
    const companyFilter = String(req.query?.company || "").trim();
    const searchFilter = String(req.query?.search || "").trim();
    const limit = Math.min(toNonNegativeInt(req.query?.limit, 10), 100);
    const offset = toNonNegativeInt(req.query?.offset, 0);

    try {
      const hasAccessModeColumn = await columnExists("jobs", "access_mode");

      const whereClauses = [
        hasAccessModeColumn
          ? "(j.access_mode = 'open' OR (j.access_mode = 'restricted' AND jra.id IS NOT NULL))"
          : "1 = 1",
      ];
      const whereParams = [rid];

      if (locationFilter) {
        const safeLocation = `%${escapeLike(locationFilter)}%`;
        whereClauses.push("j.city LIKE ? ESCAPE '\\\\'");
        whereParams.push(safeLocation);
      }

      if (companyFilter) {
        const safeCompany = `%${escapeLike(companyFilter)}%`;
        whereClauses.push("j.company_name LIKE ? ESCAPE '\\\\'");
        whereParams.push(safeCompany);
      }

      if (searchFilter) {
        const safeSearch = `%${escapeLike(searchFilter)}%`;
        whereClauses.push("(j.company_name LIKE ? ESCAPE '\\\\' OR j.role_name LIKE ? ESCAPE '\\\\')");
        whereParams.push(safeSearch, safeSearch);
      }

      const whereSql = whereClauses.join(" AND ");

      const [jobs] = await pool.query(
        `SELECT DISTINCT
          j.jid,
          j.company_name,
          j.role_name,
          j.city,
          j.state,
          j.salary,
          j.positions_open,
          ${hasAccessModeColumn ? "j.access_mode" : "'open'"} AS access_mode,
          j.skills,
          j.created_at
        FROM jobs j
        LEFT JOIN job_recruiter_access jra
          ON j.jid = jra.job_jid
         AND jra.recruiter_rid = ?
         AND jra.is_active = TRUE
        WHERE ${whereSql}
        ORDER BY j.created_at DESC
        LIMIT ? OFFSET ?`,
        [...whereParams, limit, offset]
      );

      const [countRows] = await pool.query(
        `SELECT COUNT(DISTINCT j.jid) AS total
         FROM jobs j
         LEFT JOIN job_recruiter_access jra
           ON j.jid = jra.job_jid
          AND jra.recruiter_rid = ?
          AND jra.is_active = TRUE
         WHERE ${whereSql}`,
        whereParams
      );

      const total = Number(countRows?.[0]?.total) || 0;
      return res.status(200).json({
        jobs: jobs.map((job) => ({
          jid: Number(job.jid),
          company_name: job.company_name || "",
          role_name: job.role_name || "",
          city: job.city || "",
          state: job.state || "",
          salary: job.salary || null,
          positions_open: Number(job.positions_open) || 0,
          access_mode: normalizeAccessMode(job.access_mode),
          skills: job.skills || "",
          created_at: job.created_at,
        })),
        total,
        hasMore: offset + jobs.length < total,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to fetch accessible jobs.",
        error: error.message,
      });
    }
  }
);

router.get(
  "/api/recruiters/:rid/can-access/:jid",
  requireAuth,
  requireRoles("recruiter", "job adder", "job_adder"),
  async (req, res) => {
    const rid = String(req.params.rid || "").trim();
    const safeJobId = toPositiveInt(req.params.jid);
    if (!rid) {
      return res.status(400).json({ message: "rid is required." });
    }
    if (!safeJobId) {
      return res.status(400).json({ message: "jid must be a positive integer." });
    }

    if (!authorizeRecruiterResourceView(req, res, rid)) return;

    try {
      const access = await checkJobAccess(rid, safeJobId);
      return res.status(200).json({
        canAccess: Boolean(access.canAccess),
        reason: access.reason,
        jobDetails: access.jobDetails || null,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to validate job access.",
        error: error.message,
      });
    }
  }
);

router.post("/api/resumes/submit", requireAuth, requireRoles("recruiter"), async (req, res) => {
  try {
    await runResumeUpload(req, res);
  } catch (error) {
    if (error?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "Resume file size must be 5MB or less.",
      });
    }
    return res.status(400).json({
      success: false,
      error: "Invalid resume upload payload.",
    });
  }

  const recruiterRid = String(req.body?.recruiter_rid || "").trim();
  const authRid = String(req.auth?.rid || "").trim();
  const safeJobId = toPositiveInt(req.body?.job_jid);

  if (!authRid || !recruiterRid || authRid !== recruiterRid) {
    return res.status(403).json({
      success: false,
      error: "recruiter_rid must match logged-in recruiter.",
    });
  }

  if (!safeJobId) {
    return res.status(400).json({
      success: false,
      error: "job_jid must be a positive integer.",
    });
  }

  try {
    const access = await checkJobAccess(recruiterRid, safeJobId);
    if (!access.canAccess) {
      return res.status(403).json({
        success: false,
        error: "You don't have permission to submit resumes for this job",
        canAccess: false,
      });
    }

    const requiredFields = [
      "candidate_name",
      "phone",
      "email",
      "latest_education_level",
      "board_university",
      "institution_name",
      "grading_system",
      "score",
      "age",
    ];

    for (const field of requiredFields) {
      if (!String(req.body?.[field] || "").trim()) {
        return res.status(400).json({
          success: false,
          error: `${field} is required.`,
        });
      }
    }

    const email = String(req.body?.email || "").trim().toLowerCase();
    const phone = String(req.body?.phone || "").trim();
    const candidateName = String(req.body?.candidate_name || "").trim();
    const latestEducationLevel = String(req.body?.latest_education_level || "").trim();
    const boardUniversity = String(req.body?.board_university || "").trim();
    const institutionName = String(req.body?.institution_name || "").trim();
    const gradingSystem = String(req.body?.grading_system || "").trim();
    const score = String(req.body?.score || "").trim();
    const age = Number(req.body?.age);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: "email must be valid.",
      });
    }

    if (!Number.isFinite(age) || age < 18 || age > 100) {
      return res.status(400).json({
        success: false,
        error: "age must be between 18 and 100.",
      });
    }

    const resumeFile = req.file;
    if (!resumeFile || !resumeFile.buffer || resumeFile.buffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: "resume_file is required.",
      });
    }

    const originalName = String(resumeFile.originalname || "").trim();
    const extensionMatch = originalName.match(/\.([a-z0-9]+)$/i);
    const extension = extensionMatch ? extensionMatch[1].toLowerCase() : "";
    const allowedExtensions = new Set(["pdf", "doc", "docx"]);

    if (!allowedExtensions.has(extension)) {
      return res.status(400).json({
        success: false,
        error: "Only PDF, DOC, DOCX files are allowed.",
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [sequenceResult] = await connection.query("INSERT INTO resume_id_sequence VALUES ()");
      const sequenceValue = Number(sequenceResult.insertId);
      const resId = `res_${sequenceValue}`;

      await connection.query(
        `INSERT INTO applications
          (
            job_jid,
            candidate_name,
            phone,
            email,
            latest_education_level,
            board_university,
            institution_name,
            grading_system,
            score,
            age,
            resume_filename
          )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          safeJobId,
          candidateName,
          phone,
          email,
          latestEducationLevel,
          boardUniversity,
          institutionName,
          gradingSystem,
          score,
          age,
          originalName,
        ]
      );

      await connection.query(
        `INSERT INTO resumes_data
          (
            res_id,
            rid,
            applicant_name,
            job_jid,
            resume,
            resume_filename,
            resume_type,
            submitted_by_role
          )
         VALUES (?, ?, ?, ?, ?, ?, ?, 'recruiter')`,
        [
          resId,
          recruiterRid,
          candidateName,
          safeJobId,
          resumeFile.buffer,
          originalName,
          extension,
        ]
      );

      await connection.query(
        `INSERT INTO status (recruiter_rid, submitted, last_updated)
         VALUES (?, 1, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE
           submitted = COALESCE(submitted, 0) + 1,
           last_updated = CURRENT_TIMESTAMP`,
        [recruiterRid]
      );

      const [statusRows] = await connection.query(
        `SELECT COALESCE(submitted, 0) AS submittedCount
         FROM status
         WHERE recruiter_rid = ?
         LIMIT 1`,
        [recruiterRid]
      );

      await connection.commit();
      return res.status(201).json({
        success: true,
        message: "Resume submitted successfully",
        resumeId: resId,
        submittedCount: Number(statusRows?.[0]?.submittedCount) || 0,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Failed to submit resume.",
      details: error.message,
    });
  }
});

router.post(
  "/api/recruiters/:rid/resumes",
  requireAuth,
  requireRoles("recruiter"),
  requireRecruiterOwner,
  async (req, res) => {
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
    const hasSubmittedByRoleColumn = await columnExists("resumes_data", "submitted_by_role");
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

      if (hasSubmittedByRoleColumn) {
        insertColumns.push("submitted_by_role");
        insertValues.push("recruiter");
      }

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
  }
);

router.get(
  "/api/recruiters/:rid/resumes",
  requireAuth,
  requireRoles("recruiter"),
  requireRecruiterOwner,
  async (req, res) => {
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
  }
);

router.get(
  "/api/recruiters/:rid/resumes/:resId/file",
  requireAuth,
  requireRoles("recruiter"),
  requireRecruiterOwner,
  async (req, res) => {
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
  }
);

router.get(
  "/api/recruiters/:rid/dashboard",
  requireAuth,
  requireRoles("recruiter"),
  requireRecruiterOwner,
  async (req, res) => {
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
        points: summary.points,
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
  }
);

router.post(
  "/api/recruiters/:rid/candidate-click",
  requireAuth,
  requireRoles("recruiter"),
  requireRecruiterOwner,
  async (req, res) => {
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
        points: summary.points,
        thisMonth: summary.thisMonth,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update completion count.",
      error: error.message,
    });
  }
  }
);

router.get(
  "/api/recruiters/:rid/applications",
  requireAuth,
  requireRoles("recruiter", "job creator", "job adder"),
  requireRecruiterOwner,
  async (req, res) => {
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
  }
);

module.exports = router;

