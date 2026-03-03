const express = require("express");
const pool = require("../config/db");
const {
  SUPPORTED_RESUME_TYPES,
  getResumeExtension,
  decodeResumeBuffer,
  parseResumeWithAts,
  extractApplicantName,
} = require("../resumeparser/service");
const { requireAuth, requireRoles } = require("../middleware/auth");

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
    gradingSystem: pickFromEducation(
      "grading_system",
      "gradingSystem",
      "grade_type"
    ),
    score: pickFromEducation("score", "percentage", "gpa"),
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
        ${hasCreatedAtColumn ? "created_at" : "NULL AS created_at"}
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
  requireRoles("job creator", "job adder", "recruiter"),
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
  } = req.body || {};

  const safePositionsOpen = toPositiveIntOrNull(positions_open);
  const safeRevenue = toNonNegativeNumberOrNull(revenue);
  const safePointsPerJoining = toNonNegativeIntOrNull(points_per_joining);

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

    const recruiterRole = String(recruiters[0].role || "").trim().toLowerCase();
    const canCreateJobs = hasRoleColumn
      ? recruiterRole === "job creator" ||
        recruiterRole === "job adder" ||
        Boolean(recruiters[0].addjob)
      : Boolean(recruiters[0].addjob);

    if (!canCreateJobs) {
      return res.status(403).json({ message: "Only job creator/job adder can add jobs." });
    }

    const insertColumns = ["recruiter_rid", "company_name", "role_name"];
    const insertValues = [recruiter_rid.trim(), company_name.trim(), role_name.trim()];

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

    const placeholders = insertColumns.map(() => "?").join(", ");
    const [result] = await pool.query(
      `INSERT INTO jobs (${insertColumns.join(", ")}) VALUES (${placeholders})`,
      insertValues
    );

    const safeCity = String(city || "").trim();
    const safeState = String(state || "").trim();
    const safePincode = String(pincode || "").trim();

    return res.status(201).json({
      message: "Job created successfully.",
      job: {
        jid: result.insertId,
        recruiter_rid: recruiter_rid.trim(),
        city: safeCity,
        state: safeState,
        pincode: safePincode,
        company_name: company_name.trim(),
        role_name: role_name.trim(),
        positions_open: safePositionsOpen,
        revenue: safeRevenue,
        points_per_joining: safePointsPerJoining,
      },
    });
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

    const safeJobId = Number(jid);
    if (!Number.isInteger(safeJobId) || safeJobId <= 0) {
      return res.status(400).json({ message: "jid must be a positive integer." });
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
    if (!resumeBuffer || resumeBuffer.length === 0) {
      return res.status(400).json({ message: "Resume file content is invalid." });
    }
    if (resumeBuffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ message: "Resume file size must be 10MB or less." });
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

router.post("/api/applications", async (req, res) => {
  try {
    const mergedBody = req.body || {};
    const { jid, resumeBase64, resumeFilename, resumeMimeType } = mergedBody;
    if (!jid || !resumeBase64 || !resumeFilename) {
      return res.status(400).json({
        message: "jid, resumeBase64, and resumeFilename are required.",
      });
    }

    const safeJobId = Number(jid);
    if (!Number.isInteger(safeJobId) || safeJobId <= 0) {
      return res.status(400).json({ message: "jid must be a positive integer." });
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
    if (!resumeBuffer || resumeBuffer.length === 0) {
      return res.status(400).json({ message: "Resume file content is invalid." });
    }
    if (resumeBuffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ message: "Resume file size must be 10MB or less." });
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
      gradingSystem,
      score,
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
    const finalGradingSystem = String(gradingSystem || autofill.gradingSystem || "").trim();
    const finalScore = String(score ?? autofill.score ?? "").trim();
    const finalAge = toNumberOrNull(age ?? autofill.age);
    const parsedApplicantName = extractApplicantName(parsed.parsedData) || finalName || null;

    if (
      !finalName ||
      !finalPhone ||
      !finalEmail ||
      !finalLatestEducationLevel ||
      !finalBoardUniversity ||
      !finalInstitutionName ||
      !finalGradingSystem ||
      !finalScore ||
      finalAge === null
    ) {
      return res.status(400).json({
        message:
          "jid, name, phone, email, latestEducationLevel, boardUniversity, institutionName, gradingSystem, score, and age are required.",
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
            grading_system,
            score,
            age,
            resume_filename,
            resume_parsed_data,
            ats_score,
            ats_match_percentage,
            ats_raw_json
          )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          safeJobId,
          finalName,
          finalPhone,
          finalEmail,
          finalLatestEducationLevel,
          finalBoardUniversity,
          finalInstitutionName,
          finalGradingSystem,
          finalScore,
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
