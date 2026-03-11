const express = require("express");
const pool = require("../config/db");
const {
  SUPPORTED_RESUME_TYPES,
  getResumeExtension,
  decodeResumeBuffer,
  parseResumeWithAts,
  extractApplicantName,
} = require("../resumeparser/service");
const { normalizeRoleAlias, requireAuth, requireRoles } = require("../middleware/auth");
const { validateResumeFile } = require("../middleware/uploadValidation");

const router = express.Router();

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

const getColumnMaxLength = async (tableName, columnName) => {
  const [rows] = await pool.query(
    `SELECT CHARACTER_MAXIMUM_LENGTH AS maxLength
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  if (rows.length === 0) return null;
  const parsed = Number(rows[0].maxLength);
  return Number.isFinite(parsed) ? parsed : null;
};

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toPositiveIntOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const toNonNegativeIntOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
};

const toNonNegativeNumberOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

const safeJsonOrNull = (value) => {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
};

const normalizePhoneForStorage = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length > 10) return digits.slice(-10);
  return digits;
};

const buildAutofillFromParsedData = (parsedData) => {
  const safeData =
    parsedData && typeof parsedData === "object" && !Array.isArray(parsedData) ? parsedData : {};
  const educationCandidates = Array.isArray(safeData.education)
    ? safeData.education.filter((item) => item && typeof item === "object")
    : safeData.education && typeof safeData.education === "object"
    ? [safeData.education]
    : [];

  const pickString = (...values) => {
    for (const value of values) {
      const candidate = value === undefined || value === null ? "" : String(value).trim();
      if (candidate) return candidate;
    }
    return "";
  };

  const pickFromEducation = (...keys) => {
    for (const education of educationCandidates) {
      for (const key of keys) {
        const candidate = pickString(education[key]);
        if (candidate) return candidate;
      }
    }
    return "";
  };

  const toAgeFromDob = (dobValue) => {
    const dobText = pickString(dobValue);
    if (!dobText) return "";
    const dob = new Date(dobText);
    if (Number.isNaN(dob.getTime())) return "";
    const now = new Date();
    let ageYears = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    const dayDiff = now.getDate() - dob.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      ageYears -= 1;
    }
    if (ageYears < 16 || ageYears > 100) return "";
    return String(ageYears);
  };

  const ageValue = pickString(safeData.age, safeData.current_age);
  const derivedAge = ageValue || toAgeFromDob(safeData.dob || safeData.date_of_birth);

  return {
    name: pickString(safeData.full_name, safeData.fullName, safeData.name),
    phone: normalizePhoneForStorage(pickString(safeData.phone, safeData.phone_number)),
    email: pickString(safeData.email, safeData.mail).toLowerCase(),
    latestEducationLevel: pickFromEducation(
      "latest_education_level",
      "latestEducationLevel",
      "education_level",
      "degree",
      "qualification"
    ),
    boardUniversity: pickFromEducation(
      "board_university",
      "boardUniversity",
      "university",
      "university_name",
      "board"
    ),
    institutionName: pickFromEducation(
      "institution_name",
      "institutionName",
      "college_name",
      "college",
      "school_name",
      "school"
    ),
    age: derivedAge,
  };
};

const buildJobAtsContext = (jobRow) => {
  if (!jobRow || typeof jobRow !== "object") return "";
  const parts = [
    `Role: ${String(jobRow.role_name || "").trim()}`,
    `Company: ${String(jobRow.company_name || "").trim()}`,
    `Job Description: ${String(jobRow.job_description || "").trim()}`,
    `Required Skills: ${String(jobRow.skills || "").trim()}`,
    `Qualification: ${String(jobRow.qualification || "").trim()}`,
    `Benefits: ${String(jobRow.benefits || "").trim()}`,
    `Experience: ${String(jobRow.experience || "").trim()}`,
    `Location: ${[jobRow.city, jobRow.state, jobRow.pincode]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join(", ")}`,
  ];

  return parts.filter((line) => !line.endsWith(":")).join("\n");
};

const toTrimmedString = (value) => String(value || "").trim();
const normalizeJobJid = (value) => {
  const normalized = toTrimmedString(value);
  return normalized || null;
};

const normalizeAccessMode = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "open" || normalized === "restricted") {
    return normalized;
  }
  return "";
};

const dedupeStringList = (values) => {
  const unique = new Set();
  const result = [];
  for (const raw of Array.isArray(values) ? values : []) {
    const normalized = String(raw || "").trim();
    if (!normalized || unique.has(normalized)) continue;
    unique.add(normalized);
    result.push(normalized);
  }
  return result;
};

const ensureJobIdSequenceTable = async (connection) => {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS job_id_sequence (
      seq_id BIGINT AUTO_INCREMENT PRIMARY KEY
    )`
  );
};

const syncJobIdSequenceWithJobs = async (connection) => {
  const [maxRows] = await connection.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(jid, 5) AS UNSIGNED)), 0) AS maxJidNumber
     FROM jobs
     WHERE jid REGEXP '^JID-[0-9]+$'`
  );
  const maxJidNumber = Number(maxRows?.[0]?.maxJidNumber) || 0;

  const [autoIncrementRows] = await connection.query(
    `SELECT COALESCE(AUTO_INCREMENT, 1) AS autoIncrementValue
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = 'job_id_sequence'
     LIMIT 1`
  );
  const autoIncrementValue = Number(autoIncrementRows?.[0]?.autoIncrementValue) || 1;

  if (autoIncrementValue <= maxJidNumber) {
    await connection.query(`ALTER TABLE job_id_sequence AUTO_INCREMENT = ${maxJidNumber + 1}`);
  }
};

const allocateNextJobJid = async (connection) => {
  await ensureJobIdSequenceTable(connection);
  await syncJobIdSequenceWithJobs(connection);
  const [sequenceResult] = await connection.query("INSERT INTO job_id_sequence VALUES ()");
  const sequenceValue = Number(sequenceResult.insertId);
  if (!Number.isInteger(sequenceValue) || sequenceValue <= 0) {
    throw new Error("Failed to allocate next job jid.");
  }
  return `JID-${sequenceValue}`;
};

const getActiveAccessCount = async (jobId) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM job_recruiter_access
     WHERE job_jid = ? AND is_active = TRUE`,
    [jobId]
  );
  return Number(rows?.[0]?.total) || 0;
};

const requireOwnedJob = async (req, res, next) => {
  const safeJobId = normalizeJobJid(req.params.jid);
  if (!safeJobId) {
    return res.status(400).json({ message: "jid is required." });
  }

  try {
    const hasAccessModeColumn = await columnExists("jobs", "access_mode");
    const [rows] = await pool.query(
      `SELECT
        jid,
        recruiter_rid AS recruiterRid,
        ${hasAccessModeColumn ? "access_mode" : "'open'"} AS accessMode
      FROM jobs
      WHERE jid = ?
      LIMIT 1`,
      [safeJobId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Job not found." });
    }

    const authRid = toTrimmedString(req.auth?.rid);
    if (!authRid || toTrimmedString(rows[0].recruiterRid) !== authRid) {
      return res.status(403).json({ message: "You can only manage access for your own jobs." });
    }

    req.ownedJob = {
      jid: safeJobId,
      recruiterRid: toTrimmedString(rows[0].recruiterRid),
      accessMode: normalizeAccessMode(rows[0].accessMode) || "open",
    };
    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate job ownership.",
      error: error.message,
    });
  }
};

const validateRecruiterIds = async (recruiterIds) => {
  const uniqueRecruiterIds = dedupeStringList(recruiterIds);
  if (uniqueRecruiterIds.length === 0) {
    return { validRecruiterIds: [], invalidRecruiterIds: [] };
  }

  const hasRoleColumn = await columnExists("recruiter", "role");
  const [rows] = hasRoleColumn
    ? await pool.query(
        `SELECT rid
         FROM recruiter
         WHERE rid IN (?) AND LOWER(TRIM(role)) = 'recruiter'`,
        [uniqueRecruiterIds]
      )
    : await pool.query(
        `SELECT rid
         FROM recruiter
         WHERE rid IN (?)`,
        [uniqueRecruiterIds]
      );

  const validRecruiterSet = new Set(rows.map((row) => String(row.rid)));
  const invalidRecruiterIds = uniqueRecruiterIds.filter((rid) => !validRecruiterSet.has(rid));
  return {
    validRecruiterIds: uniqueRecruiterIds.filter((rid) => validRecruiterSet.has(rid)),
    invalidRecruiterIds,
  };
};

const allowedManualResumeStatuses = new Set([
  "verified",
  "walk_in",
  "selected",
  "rejected",
  "joined",
  "dropout",
  "on_hold",
  "pending",
]);

router.get("/api/jobs", async (_req, res) => {
  try {
    const hasCityColumn = await columnExists("jobs", "city");
    const hasStateColumn = await columnExists("jobs", "state");
    const hasPincodeColumn = await columnExists("jobs", "pincode");
    const hasPositionsOpenColumn = await columnExists("jobs", "positions_open");
    const hasRevenueColumn = await columnExists("jobs", "revenue");
    const hasPointsPerJoiningColumn = await columnExists("jobs", "points_per_joining");
    const hasSkillsColumn = await columnExists("jobs", "skills");
    const hasExperienceColumn = await columnExists("jobs", "experience");
    const hasSalaryColumn = await columnExists("jobs", "salary");
    const hasQualificationColumn = await columnExists("jobs", "qualification");
    const hasBenefitsColumn = await columnExists("jobs", "benefits");
    const hasCreatedAtColumn = await columnExists("jobs", "created_at");
    const hasAccessModeColumn = await columnExists("jobs", "access_mode");

    const [rows] = await pool.query(
      `SELECT
        jid,
        recruiter_rid,
        ${hasCityColumn ? "city" : "NULL AS city"},
        ${hasStateColumn ? "state" : "NULL AS state"},
        ${hasPincodeColumn ? "pincode" : "NULL AS pincode"},
        company_name,
        role_name,
        ${hasPositionsOpenColumn ? "positions_open" : "1 AS positions_open"},
        ${hasRevenueColumn ? "revenue" : "NULL AS revenue"},
        ${hasPointsPerJoiningColumn ? "points_per_joining" : "0 AS points_per_joining"},
        ${hasSkillsColumn ? "skills" : "NULL AS skills"},
        job_description,
        ${hasExperienceColumn ? "experience" : "NULL AS experience"},
        ${hasSalaryColumn ? "salary" : "NULL AS salary"},
        ${hasQualificationColumn ? "qualification" : "NULL AS qualification"},
        ${hasBenefitsColumn ? "benefits" : "NULL AS benefits"},
        ${hasCreatedAtColumn ? "created_at" : "NULL AS created_at"},
        ${hasAccessModeColumn ? "access_mode" : "'open' AS access_mode"}
      FROM jobs
      ORDER BY jid DESC`
    );

    return res.status(200).json({ jobs: rows });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch jobs.",
      error: error.message,
    });
  }
});

router.post(
  "/api/jobs",
  requireAuth,
  requireRoles("job creator", "team leader", "team_leader", "recruiter"),
  async (req, res) => {
  const {
    recruiter_rid,
    city,
    state,
    pincode,
    company_name,
    role_name,
    positions_open,
    revenue,
    points_per_joining,
    skills,
    job_description,
    experience,
    salary,
    qualification,
    benefits,
    access_mode,
    recruiterIds,
    accessNotes,
  } = req.body || {};

  const safePositionsOpen = toPositiveIntOrNull(positions_open);
  const safeRevenue = toNonNegativeNumberOrNull(revenue);
  const safePointsPerJoining = toNonNegativeIntOrNull(points_per_joining);
  const normalizedAccessMode = normalizeAccessMode(access_mode || "open") || "open";
  const requestedRecruiterIds = dedupeStringList(recruiterIds);
  const normalizedAccessNotes = toTrimmedString(accessNotes) || null;

  const hasCityColumn = await columnExists("jobs", "city");
  const hasStateColumn = await columnExists("jobs", "state");
  const hasPincodeColumn = await columnExists("jobs", "pincode");
  const hasJobDescriptionColumn = await columnExists("jobs", "job_description");
  const hasSkillsColumn = await columnExists("jobs", "skills");
  const hasExperienceColumn = await columnExists("jobs", "experience");
  const hasSalaryColumn = await columnExists("jobs", "salary");
  const hasQualificationColumn = await columnExists("jobs", "qualification");
  const hasBenefitsColumn = await columnExists("jobs", "benefits");
  const hasPositionsOpenColumn = await columnExists("jobs", "positions_open");
  const hasRevenueColumn = await columnExists("jobs", "revenue");
  const hasPointsPerJoiningColumn = await columnExists("jobs", "points_per_joining");
  const hasAccessModeColumn = await columnExists("jobs", "access_mode");

  if (
    !recruiter_rid ||
    !company_name ||
    !role_name
  ) {
    return res.status(400).json({
      message:
        "recruiter_rid, company_name, and role_name are required.",
    });
  }

  const authRid = String(req.auth?.rid || "").trim();
  if (!authRid || authRid !== String(recruiter_rid).trim()) {
    return res.status(403).json({
      message: "You can only create jobs for your own recruiter ID.",
    });
  }

  if (access_mode !== undefined && !normalizeAccessMode(access_mode)) {
    return res.status(400).json({
      message: "access_mode must be either 'open' or 'restricted'.",
    });
  }

  if (hasJobDescriptionColumn && !job_description) {
    return res.status(400).json({
      message: "job_description is required.",
    });
  }
  if (hasPositionsOpenColumn && safePositionsOpen === null) {
    return res.status(400).json({
      message: "positions_open must be a positive integer.",
    });
  }
  if (hasRevenueColumn && revenue !== undefined && revenue !== null && revenue !== "" && safeRevenue === null) {
    return res.status(400).json({
      message: "revenue must be a non-negative number.",
    });
  }
  if (
    hasPointsPerJoiningColumn &&
    points_per_joining !== undefined &&
    points_per_joining !== null &&
    points_per_joining !== "" &&
    safePointsPerJoining === null
  ) {
    return res.status(400).json({
      message: "points_per_joining must be a non-negative integer.",
    });
  }

  if (hasQualificationColumn && qualification !== undefined && qualification !== null) {
    const maxLength = await getColumnMaxLength("jobs", "qualification");
    const qualificationText = String(qualification).trim();
    if (maxLength && qualificationText.length > maxLength) {
      return res.status(400).json({
        message: `qualification is too long (max ${maxLength} characters).`,
      });
    }
  }

  try {
    const hasRoleColumn = await columnExists("recruiter", "role");
    const hasAddJobColumn = await columnExists("recruiter", "addjob");
    const fields = [];
    if (hasRoleColumn) fields.push("role");
    if (hasAddJobColumn) fields.push("addjob");

    if (fields.length === 0) {
      return res.status(403).json({ message: "Recruiter is not authorized." });
    }

    const [recruiters] = await pool.query(
      `SELECT ${fields.join(", ")} FROM recruiter WHERE rid = ? LIMIT 1`,
      [recruiter_rid]
    );

    if (recruiters.length === 0) {
      return res.status(403).json({ message: "Recruiter is not authorized." });
    }

    const recruiterRole = normalizeRoleAlias(recruiters[0].role);
    const canCreateJobs = hasRoleColumn
      ? recruiterRole === "job creator" ||
        recruiterRole === "team leader" ||
        Boolean(recruiters[0].addjob)
      : Boolean(recruiters[0].addjob);

    if (!canCreateJobs) {
      return res.status(403).json({ message: "Only job creator/team leader can add jobs." });
    }

    const { validRecruiterIds, invalidRecruiterIds } = await validateRecruiterIds(
      requestedRecruiterIds
    );
    if (invalidRecruiterIds.length > 0) {
      return res.status(400).json({
        message: "Some recruiterIds are invalid or not recruiter role users.",
        invalidRecruiterIds,
      });
    }

    const insertColumns = ["jid", "recruiter_rid", "company_name", "role_name"];
    const insertValues = [null, recruiter_rid.trim(), company_name.trim(), role_name.trim()];

    if (hasCityColumn) {
      insertColumns.push("city");
      insertValues.push(String(city || "N/A").trim() || "N/A");
    }
    if (hasStateColumn) {
      insertColumns.push("state");
      insertValues.push(String(state || "N/A").trim() || "N/A");
    }
    if (hasPincodeColumn) {
      insertColumns.push("pincode");
      insertValues.push(String(pincode || "N/A").trim() || "N/A");
    }
    if (hasPositionsOpenColumn) {
      insertColumns.push("positions_open");
      insertValues.push(safePositionsOpen === null ? 1 : safePositionsOpen);
    }
    if (hasRevenueColumn) {
      insertColumns.push("revenue");
      insertValues.push(safeRevenue);
    }
    if (hasPointsPerJoiningColumn) {
      insertColumns.push("points_per_joining");
      insertValues.push(safePointsPerJoining === null ? 0 : safePointsPerJoining);
    }
    if (hasSkillsColumn) {
      insertColumns.push("skills");
      insertValues.push(skills?.trim() || null);
    }
    if (hasJobDescriptionColumn) {
      insertColumns.push("job_description");
      insertValues.push(job_description?.trim() || null);
    }
    if (hasExperienceColumn) {
      insertColumns.push("experience");
      insertValues.push(experience?.trim() || null);
    }
    if (hasSalaryColumn) {
      insertColumns.push("salary");
      insertValues.push(salary?.trim() || null);
    }
    if (hasQualificationColumn) {
      insertColumns.push("qualification");
      insertValues.push(qualification?.trim() || null);
    }
    if (hasBenefitsColumn) {
      insertColumns.push("benefits");
      insertValues.push(benefits?.trim() || null);
    }
    if (hasAccessModeColumn) {
      insertColumns.push("access_mode");
      insertValues.push(normalizedAccessMode);
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const generatedJobJid = await allocateNextJobJid(connection);
      insertValues[0] = generatedJobJid;

      const placeholders = insertColumns.map(() => "?").join(", ");
      await connection.query(
        `INSERT INTO jobs (${insertColumns.join(", ")}) VALUES (${placeholders})`,
        insertValues
      );

      if (normalizedAccessMode === "restricted" && validRecruiterIds.length > 0) {
        for (const recruiterId of validRecruiterIds) {
          await connection.query(
            `INSERT INTO job_recruiter_access
              (job_jid, recruiter_rid, granted_by, notes, is_active)
             VALUES (?, ?, ?, ?, TRUE)
             ON DUPLICATE KEY UPDATE
               is_active = TRUE,
               granted_by = VALUES(granted_by),
               granted_at = CURRENT_TIMESTAMP,
               notes = VALUES(notes)`,
            [generatedJobJid, recruiterId, authRid, normalizedAccessNotes]
          );
        }
      }

      await connection.commit();

      const safeCity = String(city || "").trim();
      const safeState = String(state || "").trim();
      const safePincode = String(pincode || "").trim();
      const warning =
        normalizedAccessMode === "restricted" && validRecruiterIds.length === 0
          ? "Job is restricted but no recruiters are assigned yet."
          : null;

      return res.status(201).json({
        message: "Job created successfully.",
        warning,
        job: {
          jid: generatedJobJid,
          recruiter_rid: recruiter_rid.trim(),
          city: safeCity,
          state: safeState,
          pincode: safePincode,
          company_name: company_name.trim(),
          role_name: role_name.trim(),
          positions_open: safePositionsOpen,
          revenue: safeRevenue,
          points_per_joining: safePointsPerJoining,
          access_mode: hasAccessModeColumn ? normalizedAccessMode : "open",
          recruiterCount: validRecruiterIds.length,
        },
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    if (error && error.code === "ER_DATA_TOO_LONG") {
      return res.status(400).json({
        message: "One of the text fields is too long for the database column.",
        error: error.message,
      });
    }

    return res.status(500).json({
      message: "Failed to create job.",
      error: error.message,
    });
  }
  }
);

router.post("/api/applications/parse-resume", async (req, res) => {
  try {
    const { jid, resumeBase64, resumeFilename, resumeMimeType } = req.body || {};
    if (!jid || !resumeBase64 || !resumeFilename) {
      return res.status(400).json({
        message: "jid, resumeBase64, and resumeFilename are required.",
      });
    }

    const safeJobId = normalizeJobJid(jid);
    if (!safeJobId) {
      return res.status(400).json({ message: "jid is required." });
    }

    const extension = getResumeExtension(resumeFilename);
    if (!SUPPORTED_RESUME_TYPES.has(extension)) {
      return res.status(400).json({
        message: "Only PDF and DOCX resumes are supported.",
      });
    }

    const [jobs] = await pool.query(
      `SELECT
        jid,
        role_name,
        company_name,
        job_description,
        skills,
        qualification,
        benefits,
        experience,
        city,
        state,
        pincode
      FROM jobs
      WHERE jid = ?
      LIMIT 1`,
      [safeJobId]
    );
    if (jobs.length === 0) {
      return res.status(404).json({ message: "Job not found." });
    }

    const resumeBuffer = decodeResumeBuffer(resumeBase64);
    const validation = validateResumeFile({
      filename: resumeFilename,
      mimetype: resumeMimeType,
      buffer: resumeBuffer,
      maxBytes: 5 * 1024 * 1024,
    });
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    const parsed = await parseResumeWithAts({
      resumeBuffer,
      resumeFilename: String(resumeFilename).trim(),
      jobDescription: buildJobAtsContext(jobs[0]),
    });

    if (!parsed.ok) {
      return res.status(503).json({ message: parsed.message });
    }

    return res.status(200).json({
      message: "Resume parsed successfully.",
      parsedData: parsed.parsedData,
      autofill: buildAutofillFromParsedData(parsed.parsedData),
      parser_meta: parsed.parserMeta || null,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to parse resume.",
      error: error.message,
    });
  }
});

router.get(
  "/api/jobs/my",
  requireAuth,
  requireRoles("job creator", "team leader", "team_leader"),
  async (req, res) => {
    try {
      const authRid = toTrimmedString(req.auth?.rid);
      if (!authRid) {
        return res.status(401).json({ message: "Authentication required." });
      }

      const hasAccessModeColumn = await columnExists("jobs", "access_mode");
      const [rows] = await pool.query(
        `SELECT
          j.jid,
          j.recruiter_rid,
          j.company_name,
          j.role_name,
          j.city,
          j.state,
          j.pincode,
          j.created_at,
          ${hasAccessModeColumn ? "j.access_mode" : "'open' AS access_mode"},
          COUNT(jra.id) AS recruiterCount
        FROM jobs j
        LEFT JOIN job_recruiter_access jra
          ON j.jid = jra.job_jid
         AND jra.is_active = TRUE
        WHERE j.recruiter_rid = ?
        GROUP BY
          j.jid, j.recruiter_rid, j.company_name, j.role_name, j.city, j.state, j.pincode, j.created_at
          ${hasAccessModeColumn ? ", j.access_mode" : ""}
        ORDER BY j.created_at DESC, j.jid DESC`,
        [authRid]
      );

      return res.status(200).json({
        jobs: rows.map((row) => ({
          ...row,
          recruiterCount: Number(row.recruiterCount) || 0,
          access_mode: normalizeAccessMode(row.access_mode) || "open",
        })),
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to fetch your jobs.",
        error: error.message,
      });
    }
  }
);

router.get(
  "/api/jobs/:jid/resume-statuses",
  requireAuth,
  requireRoles("job creator", "team leader", "team_leader"),
  requireOwnedJob,
  async (req, res) => {
    try {
      const hasAtsScoreColumn = await columnExists("resumes_data", "ats_score");
      const hasAtsMatchColumn = await columnExists("resumes_data", "ats_match_percentage");

      const atsScoreSelection = hasAtsScoreColumn ? "rd.ats_score AS atsScore," : "NULL AS atsScore,";
      const atsMatchSelection = hasAtsMatchColumn
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
          ${atsScoreSelection}
          ${atsMatchSelection}
          rd.uploaded_at AS uploadedAt,
          jrs.selection_status AS workflowStatus,
          jrs.selection_note AS workflowNote,
          jrs.selected_by_admin AS updatedBy,
          jrs.selected_at AS updatedAt
        FROM resumes_data rd
        INNER JOIN recruiter r ON r.rid = rd.rid
        LEFT JOIN job_resume_selection jrs
          ON jrs.job_jid = rd.job_jid
         AND jrs.res_id = rd.res_id
        WHERE rd.job_jid = ?
          AND COALESCE(rd.submitted_by_role, 'recruiter') = 'recruiter'
        ORDER BY rd.uploaded_at DESC, rd.res_id ASC`,
        [req.ownedJob.jid]
      );

      return res.status(200).json({
        jobId: req.ownedJob.jid,
        resumes: rows.map((row) => ({
          resId: row.resId,
          rid: row.rid,
          recruiterName: row.recruiterName || "Unknown",
          recruiterEmail: row.recruiterEmail || null,
          resumeFilename: row.resumeFilename || null,
          resumeType: row.resumeType || null,
          atsScore: row.atsScore === null ? null : Number(row.atsScore),
          atsMatchPercentage: row.atsMatchPercentage === null ? null : Number(row.atsMatchPercentage),
          uploadedAt: row.uploadedAt || null,
          status: row.workflowStatus || "pending",
          note: row.workflowNote || null,
          updatedBy: row.updatedBy || null,
          updatedAt: row.updatedAt || null,
        })),
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to fetch recruiter resume statuses.",
        error: error.message,
      });
    }
  }
);

router.post(
  "/api/jobs/:jid/resume-statuses",
  requireAuth,
  requireRoles("job creator", "team leader", "team_leader"),
  requireOwnedJob,
  async (req, res) => {
    const normalizedResId = toTrimmedString(req.body?.resId);
    const normalizedStatus = toTrimmedString(req.body?.status).toLowerCase();
    const normalizedNote =
      req.body?.note === undefined || req.body?.note === null
        ? null
        : toTrimmedString(req.body.note);
    const actorRid = toTrimmedString(req.auth?.rid);

    if (!normalizedResId || !allowedManualResumeStatuses.has(normalizedStatus)) {
      return res.status(400).json({
        message: "resId and a valid status are required.",
      });
    }

    try {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        const [resumeRows] = await connection.query(
          `SELECT res_id AS resId, job_jid AS jobJid, rid AS recruiterRid
           FROM resumes_data
           WHERE res_id = ?
           LIMIT 1`,
          [normalizedResId]
        );

        if (resumeRows.length === 0) {
          await connection.rollback();
          return res.status(404).json({ message: "Resume not found." });
        }

        if (toTrimmedString(resumeRows[0].jobJid) !== req.ownedJob.jid) {
          await connection.rollback();
          return res.status(400).json({
            message: "The provided resume does not belong to this job.",
          });
        }

        const recruiterRid = toTrimmedString(resumeRows[0].recruiterRid);
        const [existingSelectionRows] = await connection.query(
          `SELECT selection_status AS selectionStatus
           FROM job_resume_selection
           WHERE job_jid = ? AND res_id = ?
           LIMIT 1`,
          [req.ownedJob.jid, normalizedResId]
        );
        const previousStatus = toTrimmedString(existingSelectionRows[0]?.selectionStatus).toLowerCase() || "pending";

        if (normalizedStatus === "pending") {
          await connection.query(
            `DELETE FROM job_resume_selection
             WHERE job_jid = ? AND res_id = ?`,
            [req.ownedJob.jid, normalizedResId]
          );
        } else {
          await connection.query(
            `INSERT INTO job_resume_selection
              (job_jid, res_id, selected_by_admin, selection_status, selection_note)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               selected_by_admin = VALUES(selected_by_admin),
               selection_status = VALUES(selection_status),
               selection_note = VALUES(selection_note),
               selected_at = CURRENT_TIMESTAMP`,
            [
              req.ownedJob.jid,
              normalizedResId,
              actorRid || "team-leader",
              normalizedStatus,
              normalizedNote || null,
            ]
          );
        }

        if (recruiterRid && previousStatus !== normalizedStatus) {
          const selectDelta =
            (normalizedStatus === "selected" ? 1 : 0) - (previousStatus === "selected" ? 1 : 0);
          const rejectDelta =
            (normalizedStatus === "rejected" ? 1 : 0) - (previousStatus === "rejected" ? 1 : 0);

          if (selectDelta !== 0 || rejectDelta !== 0) {
            await connection.query(
              `INSERT INTO status (recruiter_rid, submitted, \`select\`, reject, last_updated)
               VALUES (?, 0, ?, ?, CURRENT_TIMESTAMP)
               ON DUPLICATE KEY UPDATE
                 \`select\` = GREATEST(0, COALESCE(\`select\`, 0) + ?),
                 reject = GREATEST(0, COALESCE(reject, 0) + ?),
                 last_updated = CURRENT_TIMESTAMP`,
              [
                recruiterRid,
                Math.max(0, selectDelta),
                Math.max(0, rejectDelta),
                selectDelta,
                rejectDelta,
              ]
            );
          }
        }

        await connection.commit();
        return res.status(200).json({
          message: "Resume status updated successfully.",
          data: {
            jobId: req.ownedJob.jid,
            resId: normalizedResId,
            status: normalizedStatus,
            note: normalizedNote || null,
            updatedBy: actorRid || "team-leader",
          },
        });
      } catch (innerError) {
        await connection.rollback();
        throw innerError;
      } finally {
        connection.release();
      }
    } catch (error) {
      return res.status(500).json({
        message: "Failed to update resume status.",
        error: error.message,
      });
    }
  }
);

router.get(
  "/api/jobs/:jid/access",
  requireAuth,
  requireRoles("job creator", "team leader", "team_leader"),
  requireOwnedJob,
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT
          r.rid,
          r.name,
          r.email,
          jra.granted_at AS grantedAt,
          jra.granted_by AS grantedBy,
          jra.is_active AS isActive,
          jra.notes
        FROM job_recruiter_access jra
        INNER JOIN recruiter r ON r.rid = jra.recruiter_rid
        WHERE jra.job_jid = ?
          AND jra.is_active = TRUE
        ORDER BY r.name ASC, r.rid ASC`,
        [req.ownedJob.jid]
      );

      return res.status(200).json({
        jobId: req.ownedJob.jid,
        accessMode: req.ownedJob.accessMode,
        recruiters: rows.map((row) => ({
          rid: row.rid,
          name: row.name,
          email: row.email,
          grantedAt: row.grantedAt,
          grantedBy: row.grantedBy,
          isActive: Boolean(row.isActive),
          notes: row.notes || null,
        })),
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to fetch job access list.",
        error: error.message,
      });
    }
  }
);

router.post(
  "/api/jobs/:jid/access",
  requireAuth,
  requireRoles("job creator", "team leader", "team_leader"),
  requireOwnedJob,
  async (req, res) => {
    const { recruiterIds, notes } = req.body || {};
    const normalizedNotes = toTrimmedString(notes) || null;
    const uniqueRecruiterIds = dedupeStringList(recruiterIds);

    if (uniqueRecruiterIds.length === 0) {
      return res.status(400).json({ message: "recruiterIds must contain at least one recruiter ID." });
    }

    try {
      const { validRecruiterIds, invalidRecruiterIds } = await validateRecruiterIds(
        uniqueRecruiterIds
      );
      if (invalidRecruiterIds.length > 0) {
        return res.status(400).json({
          message: "Some recruiterIds are invalid or not recruiter role users.",
          invalidRecruiterIds,
        });
      }

      const authRid = toTrimmedString(req.auth?.rid);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        for (const recruiterId of validRecruiterIds) {
          await connection.query(
            `INSERT INTO job_recruiter_access
              (job_jid, recruiter_rid, granted_by, notes, is_active)
             VALUES (?, ?, ?, ?, TRUE)
             ON DUPLICATE KEY UPDATE
               is_active = TRUE,
               granted_by = VALUES(granted_by),
               granted_at = CURRENT_TIMESTAMP,
               notes = VALUES(notes)`,
            [req.ownedJob.jid, recruiterId, authRid, normalizedNotes]
          );
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

      return res.status(200).json({ success: true, assigned: validRecruiterIds.length });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to assign recruiters for this job.",
        error: error.message,
      });
    }
  }
);

router.delete(
  "/api/jobs/:jid/access/:rid",
  requireAuth,
  requireRoles("job creator", "team leader", "team_leader"),
  requireOwnedJob,
  async (req, res) => {
    const recruiterRid = toTrimmedString(req.params.rid);
    if (!recruiterRid) {
      return res.status(400).json({ message: "rid is required." });
    }

    try {
      const [existingRecruiters] = await pool.query(
        "SELECT rid FROM recruiter WHERE rid = ? LIMIT 1",
        [recruiterRid]
      );
      if (existingRecruiters.length === 0) {
        return res.status(404).json({ message: "Recruiter not found." });
      }

      await pool.query(
        `UPDATE job_recruiter_access
         SET is_active = FALSE
         WHERE job_jid = ? AND recruiter_rid = ?`,
        [req.ownedJob.jid, recruiterRid]
      );

      return res.status(200).json({
        success: true,
        message: `Access revoked for ${recruiterRid}`,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to revoke recruiter access.",
        error: error.message,
      });
    }
  }
);

router.put(
  "/api/jobs/:jid/access-mode",
  requireAuth,
  requireRoles("job creator", "team leader", "team_leader"),
  requireOwnedJob,
  async (req, res) => {
    const normalizedAccessMode = normalizeAccessMode(req.body?.accessMode);
    if (!normalizedAccessMode) {
      return res.status(400).json({
        message: "accessMode must be either 'open' or 'restricted'.",
      });
    }

    try {
      const hasAccessModeColumn = await columnExists("jobs", "access_mode");
      if (!hasAccessModeColumn) {
        return res.status(500).json({
          message: "jobs.access_mode column is not initialized.",
        });
      }

      await pool.query(
        `UPDATE jobs
         SET access_mode = ?
         WHERE jid = ? AND recruiter_rid = ?`,
        [normalizedAccessMode, req.ownedJob.jid, req.ownedJob.recruiterRid]
      );

      const warning =
        normalizedAccessMode === "restricted" && (await getActiveAccessCount(req.ownedJob.jid)) === 0
          ? "No recruiters are currently assigned to this restricted job."
          : null;

      return res.status(200).json({
        success: true,
        accessMode: normalizedAccessMode,
        warning,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to update job access mode.",
        error: error.message,
      });
    }
  }
);

router.post("/api/applications", async (req, res) => {
  try {
    const mergedBody = req.body || {};
    const { jid, resumeBase64, resumeFilename, resumeMimeType } = mergedBody;
    if (!jid || !resumeBase64 || !resumeFilename) {
      return res.status(400).json({
        message: "jid, resumeBase64, and resumeFilename are required.",
      });
    }

    const safeJobId = normalizeJobJid(jid);
    if (!safeJobId) {
      return res.status(400).json({ message: "jid is required." });
    }

    const extension = getResumeExtension(resumeFilename);
    if (!SUPPORTED_RESUME_TYPES.has(extension)) {
      return res.status(400).json({
        message: "Only PDF and DOCX resumes are supported.",
      });
    }

    const [jobs] = await pool.query(
      `SELECT
        jid,
        recruiter_rid,
        role_name,
        company_name,
        job_description,
        skills,
        qualification,
        benefits,
        experience,
        city,
        state,
        pincode
      FROM jobs
      WHERE jid = ?
      LIMIT 1`,
      [safeJobId]
    );
    if (jobs.length === 0) {
      return res.status(404).json({ message: "Job not found." });
    }
    const selectedJob = jobs[0];

    const resumeBuffer = decodeResumeBuffer(resumeBase64);
    const validation = validateResumeFile({
      filename: resumeFilename,
      mimetype: resumeMimeType,
      buffer: resumeBuffer,
      maxBytes: 5 * 1024 * 1024,
    });
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    const parsed = await parseResumeWithAts({
      resumeBuffer,
      resumeFilename: String(resumeFilename).trim(),
      jobDescription: buildJobAtsContext(selectedJob),
    });
    if (!parsed.ok) {
      return res.status(503).json({ message: parsed.message });
    }
    const autofill = buildAutofillFromParsedData(parsed.parsedData);

  const {
      name,
      phone,
      email,
      latestEducationLevel,
      boardUniversity,
      institutionName,
      age,
    } = mergedBody;

    const finalName = String(name || autofill.name || "").trim();
    const finalPhone = normalizePhoneForStorage(phone || autofill.phone || "");
    const finalEmail = String(email || autofill.email || "").trim().toLowerCase();
    const finalLatestEducationLevel = String(
      latestEducationLevel || autofill.latestEducationLevel || ""
    ).trim();
    const finalBoardUniversity = String(boardUniversity || autofill.boardUniversity || "").trim();
    const finalInstitutionName = String(institutionName || autofill.institutionName || "").trim();
    const finalAge = toNumberOrNull(age ?? autofill.age);
    const parsedApplicantName = extractApplicantName(parsed.parsedData) || finalName || null;

    if (
      !finalName ||
      !finalPhone ||
      !finalEmail ||
      !finalLatestEducationLevel ||
      !finalBoardUniversity ||
      !finalInstitutionName ||
      finalAge === null
    ) {
      return res.status(400).json({
        message:
          "jid, name, phone, email, latestEducationLevel, boardUniversity, institutionName, and age are required.",
      });
    }

    if (!/^\d{10}$/.test(finalPhone)) {
      return res.status(400).json({
        message: "Phone number must be exactly 10 digits.",
      });
    }

    const hasJobJidColumn = await columnExists("resumes_data", "job_jid");
    const hasSubmittedByRoleColumn = await columnExists("resumes_data", "submitted_by_role");
    const hasApplicantNameColumn = await columnExists("resumes_data", "applicant_name");
    const hasAtsScoreColumn = await columnExists("resumes_data", "ats_score");
    const hasAtsMatchColumn = await columnExists("resumes_data", "ats_match_percentage");
    const hasAtsRawColumn = await columnExists("resumes_data", "ats_raw_json");
    const normalizedFilename = String(resumeFilename).trim();
    const normalizedMimeType = String(resumeMimeType || "").trim().toLowerCase();

    const atsPayload = {
      ats_score: parsed.atsScore,
      ats_match_percentage: parsed.atsMatchPercentage,
      ats_details: parsed.atsRawJson,
      parsed_data: parsed.parsedData,
    };

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [applicationResult] = await connection.query(
        `INSERT INTO applications
          (
            job_jid,
            candidate_name,
            phone,
            email,
            latest_education_level,
            board_university,
            institution_name,
            age,
            resume_filename,
            resume_parsed_data,
            ats_score,
            ats_match_percentage,
            ats_raw_json
          )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          safeJobId,
          finalName,
          finalPhone,
          finalEmail,
          finalLatestEducationLevel,
          finalBoardUniversity,
          finalInstitutionName,
          finalAge,
          normalizedFilename,
          safeJsonOrNull(parsed.parsedData),
          parsed.atsScore,
          parsed.atsMatchPercentage,
          safeJsonOrNull(atsPayload),
        ]
      );

      const [sequenceResult] = await connection.query("INSERT INTO resume_id_sequence VALUES ()");
      const sequenceValue = Number(sequenceResult.insertId);
      const resId = `res_${sequenceValue}`;

      const insertColumns = ["res_id", "rid"];
      const insertValues = [resId, selectedJob.recruiter_rid];

      if (hasJobJidColumn) {
        insertColumns.push("job_jid");
        insertValues.push(safeJobId);
      }

      insertColumns.push("resume", "resume_filename", "resume_type");
      insertValues.push(resumeBuffer, normalizedFilename, extension);

      if (hasSubmittedByRoleColumn) {
        insertColumns.push("submitted_by_role");
        insertValues.push("candidate");
      }

      if (hasApplicantNameColumn) {
        insertColumns.push("applicant_name");
        insertValues.push(parsedApplicantName);
      }

      if (hasAtsScoreColumn) {
        insertColumns.push("ats_score");
        insertValues.push(parsed.atsScore);
      }

      if (hasAtsMatchColumn) {
        insertColumns.push("ats_match_percentage");
        insertValues.push(parsed.atsMatchPercentage);
      }

      if (hasAtsRawColumn) {
        insertColumns.push("ats_raw_json");
        insertValues.push(safeJsonOrNull(atsPayload));
      }

      const placeholders = insertColumns.map(() => "?").join(", ");
      await connection.query(
        `INSERT INTO resumes_data (${insertColumns.join(", ")}) VALUES (${placeholders})`,
        insertValues
      );

      await connection.commit();
      return res.status(201).json({
        message: "Application submitted successfully.",
        application: {
          id: applicationResult.insertId,
          job_jid: safeJobId,
          candidate_name: finalName,
          resume_id: resId,
          resume_filename: normalizedFilename,
          resume_type: extension,
          resume_mime_type: normalizedMimeType || null,
        },
        parser_meta: parsed.parserMeta || null,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return res.status(500).json({
      message: "Failed to submit application.",
      error: error.message,
    });
  }
});

module.exports = router;
