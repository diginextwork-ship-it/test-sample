const mysql = require("mysql2/promise");

const parseBooleanEnv = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

const resolveSslConfig = (host) => {
  const explicitSsl = process.env.DB_SSL ?? process.env.MYSQL_SSL;
  const useSsl = explicitSsl != null ? parseBooleanEnv(explicitSsl) : /aivencloud\.com$/i.test(host);
  if (!useSsl) return undefined;

  const rawCa = String(process.env.DB_SSL_CA || process.env.AIVEN_CA_CERT || "").trim();
  if (!rawCa) {
    return { rejectUnauthorized: true };
  }

  return {
    ca: rawCa.replace(/\\n/g, "\n"),
    rejectUnauthorized: true,
  };
};

const getDbConfig = () => {
  const connectionUrl = String(
    process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.JAWSDB_URL || ""
  ).trim();

  if (connectionUrl) {
    const parsedUrl = new URL(connectionUrl);
    const host = parsedUrl.hostname;
    return {
      host,
      port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
      user: decodeURIComponent(parsedUrl.username || ""),
      password: decodeURIComponent(parsedUrl.password || ""),
      database: decodeURIComponent(String(parsedUrl.pathname || "").replace(/^\//, "")),
      ssl: resolveSslConfig(host),
    };
  }

  const requiredEnvVars = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
  const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);
  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing required database environment variables: ${missingEnvVars.join(", ")}`
    );
  }

  const host = process.env.DB_HOST;
  return {
    host,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: resolveSslConfig(host),
  };
};

const dbConfig = getDbConfig();

const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

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

const indexExists = async (tableName, indexName) => {
  const [rows] = await pool.query(
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
     LIMIT 1`,
    [tableName, indexName]
  );
  return rows.length > 0;
};

const tableExists = async (tableName) => {
  const [rows] = await pool.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?
     LIMIT 1`,
    [tableName]
  );
  return rows.length > 0;
};

const getColumnMetadata = async (tableName, columnName) => {
  const [rows] = await pool.query(
    `SELECT
      COLUMN_TYPE AS columnType,
      DATA_TYPE AS dataType,
      CHARACTER_SET_NAME AS characterSetName,
      COLLATION_NAME AS collationName
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0 ? rows[0] : null;
};

const buildColumnSql = (metadata, fallbackSql) => {
  if (!metadata || !metadata.columnType) return fallbackSql;
  const baseType = String(metadata.columnType).trim();
  const isCharLike = ["char", "varchar", "tinytext", "text", "mediumtext", "longtext"].includes(
    String(metadata.dataType || "").toLowerCase()
  );
  const collationClause =
    isCharLike && metadata.collationName ? ` COLLATE ${metadata.collationName}` : "";
  return `${baseType}${collationClause}`;
};

const ensureJobsTableColumns = async () => {
  if (!(await tableExists("jobs"))) return;

  if (!(await columnExists("jobs", "positions_open"))) {
    await pool.query(
      "ALTER TABLE jobs ADD COLUMN positions_open INT NOT NULL DEFAULT 1 AFTER role_name"
    );
  }

  if (!(await columnExists("jobs", "created_at"))) {
    await pool.query(
      "ALTER TABLE jobs ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"
    );
  }

  if (!(await columnExists("jobs", "revenue"))) {
    await pool.query("ALTER TABLE jobs ADD COLUMN revenue DECIMAL(12,2) NULL");
  }

  if (!(await columnExists("jobs", "points_per_joining"))) {
    await pool.query(
      "ALTER TABLE jobs ADD COLUMN points_per_joining INT NOT NULL DEFAULT 0"
    );
  }

  if (!(await indexExists("jobs", "idx_jobs_created_at"))) {
    await pool.query("CREATE INDEX idx_jobs_created_at ON jobs (created_at)");
  }

  if (await columnExists("jobs", "qualification")) {
    const qualificationMetadata = await getColumnMetadata("jobs", "qualification");
    const qualificationType = String(qualificationMetadata?.dataType || "").toLowerCase();
    if (qualificationType !== "longtext") {
      await pool.query("ALTER TABLE jobs MODIFY COLUMN qualification LONGTEXT NULL");
    }
  }
};

const ensureRecruiterTableColumns = async () => {
  if (!(await tableExists("recruiter"))) return;

  if (!(await columnExists("recruiter", "points"))) {
    await pool.query("ALTER TABLE recruiter ADD COLUMN points INT NOT NULL DEFAULT 0");
    return;
  }

  await pool.query("UPDATE recruiter SET points = 0 WHERE points IS NULL");
  await pool.query("ALTER TABLE recruiter MODIFY COLUMN points INT NOT NULL DEFAULT 0");
};

const ensureResumesDataTable = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS resumes_data (
      res_id VARCHAR(30) PRIMARY KEY,
      rid VARCHAR(20) NOT NULL,
      applicant_name VARCHAR(255) NULL,
      job_jid INT NULL,
      resume LONGBLOB NOT NULL,
      resume_filename VARCHAR(255) NOT NULL,
      resume_type VARCHAR(10) NOT NULL,
      ats_score DECIMAL(5,2) NULL,
      ats_match_percentage DECIMAL(5,2) NULL,
      ats_raw_json JSON NULL,
      uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_resumes_data_rid (rid),
      INDEX idx_resumes_data_job_jid (job_jid),
      INDEX idx_resumes_data_uploaded_at (uploaded_at),
      CONSTRAINT fk_resumes_data_recruiter
        FOREIGN KEY (rid) REFERENCES recruiter(rid)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      CONSTRAINT fk_resumes_data_job
        FOREIGN KEY (job_jid) REFERENCES jobs(jid)
        ON DELETE SET NULL
        ON UPDATE CASCADE
    )`
  );

  if (!(await columnExists("resumes_data", "job_jid"))) {
    await pool.query("ALTER TABLE resumes_data ADD COLUMN job_jid INT NULL");
  }

  if (!(await columnExists("resumes_data", "applicant_name"))) {
    await pool.query("ALTER TABLE resumes_data ADD COLUMN applicant_name VARCHAR(255) NULL");
  }

  if (!(await columnExists("resumes_data", "ats_score"))) {
    await pool.query("ALTER TABLE resumes_data ADD COLUMN ats_score DECIMAL(5,2) NULL");
  }

  if (!(await columnExists("resumes_data", "ats_match_percentage"))) {
    await pool.query(
      "ALTER TABLE resumes_data ADD COLUMN ats_match_percentage DECIMAL(5,2) NULL"
    );
  }

  if (!(await columnExists("resumes_data", "ats_raw_json"))) {
    await pool.query("ALTER TABLE resumes_data ADD COLUMN ats_raw_json JSON NULL");
  }

  if (!(await columnExists("resumes_data", "submitted_by_role"))) {
    await pool.query(
      "ALTER TABLE resumes_data ADD COLUMN submitted_by_role VARCHAR(30) NULL DEFAULT 'recruiter'"
    );
  }

  if (!(await columnExists("resumes_data", "is_accepted"))) {
    await pool.query(
      "ALTER TABLE resumes_data ADD COLUMN is_accepted BOOLEAN NOT NULL DEFAULT FALSE"
    );
  }

  if (!(await columnExists("resumes_data", "accepted_at"))) {
    await pool.query("ALTER TABLE resumes_data ADD COLUMN accepted_at TIMESTAMP NULL DEFAULT NULL");
  }

  if (!(await columnExists("resumes_data", "accepted_by_admin"))) {
    await pool.query("ALTER TABLE resumes_data ADD COLUMN accepted_by_admin VARCHAR(50) NULL");
  }
};

const ensureResumeIdSequenceTable = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS resume_id_sequence (
      seq_id BIGINT AUTO_INCREMENT PRIMARY KEY
    )`
  );
};

const ensureApplicationColumns = async () => {
  const hasApplicationsTable = await pool
    .query(
      `SELECT 1
       FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'applications'
       LIMIT 1`
    )
    .then(([rows]) => rows.length > 0)
    .catch(() => false);

  if (!hasApplicationsTable) return;

  if (!(await columnExists("applications", "resume_filename"))) {
    await pool.query("ALTER TABLE applications ADD COLUMN resume_filename VARCHAR(255) NULL");
  }

  if (!(await columnExists("applications", "resume_parsed_data"))) {
    await pool.query("ALTER TABLE applications ADD COLUMN resume_parsed_data JSON NULL");
  }

  if (!(await columnExists("applications", "ats_score"))) {
    await pool.query("ALTER TABLE applications ADD COLUMN ats_score DECIMAL(5,2) NULL");
  }

  if (!(await columnExists("applications", "ats_match_percentage"))) {
    await pool.query(
      "ALTER TABLE applications ADD COLUMN ats_match_percentage DECIMAL(5,2) NULL"
    );
  }

  if (!(await columnExists("applications", "ats_raw_json"))) {
    await pool.query("ALTER TABLE applications ADD COLUMN ats_raw_json JSON NULL");
  }
};

const ensureJobResumeSelectionTable = async () => {
  const jobJidMetadata = await getColumnMetadata("jobs", "jid");
  const resumeIdMetadata = await getColumnMetadata("resumes_data", "res_id");
  const jobJidColumnSql = buildColumnSql(jobJidMetadata, "INT");
  const resumeIdColumnSql = buildColumnSql(resumeIdMetadata, "VARCHAR(30)");

  await pool.query(
    `CREATE TABLE IF NOT EXISTS job_resume_selection (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      job_jid ${jobJidColumnSql} NOT NULL,
      res_id ${resumeIdColumnSql} NOT NULL,
      selected_by_admin VARCHAR(50) NOT NULL,
      selection_status ENUM('selected', 'rejected', 'on_hold') NOT NULL DEFAULT 'selected',
      selection_note TEXT NULL,
      selected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_job_resume_selection (job_jid, res_id),
      INDEX idx_job_resume_selection_job_status_time (job_jid, selection_status, selected_at),
      CONSTRAINT fk_job_resume_selection_job
        FOREIGN KEY (job_jid) REFERENCES jobs(jid)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      CONSTRAINT fk_job_resume_selection_resume
        FOREIGN KEY (res_id) REFERENCES resumes_data(res_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
    )`
  );
};

const ensureMoneySumTable = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS money_sum (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      company_rev DECIMAL(14,2) NOT NULL DEFAULT 0,
      expense DECIMAL(14,2) NOT NULL DEFAULT 0,
      profit DECIMAL(14,2) NOT NULL DEFAULT 0,
      reason TEXT NULL,
      entry_type VARCHAR(20) NOT NULL DEFAULT 'expense',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_money_sum_created_at (created_at),
      INDEX idx_money_sum_entry_type (entry_type)
    )`
  );

  if (!(await columnExists("money_sum", "company_rev"))) {
    await pool.query("ALTER TABLE money_sum ADD COLUMN company_rev DECIMAL(14,2) NOT NULL DEFAULT 0");
  }

  if (!(await columnExists("money_sum", "expense"))) {
    await pool.query("ALTER TABLE money_sum ADD COLUMN expense DECIMAL(14,2) NOT NULL DEFAULT 0");
  }

  if (!(await columnExists("money_sum", "profit"))) {
    await pool.query("ALTER TABLE money_sum ADD COLUMN profit DECIMAL(14,2) NOT NULL DEFAULT 0");
  }

  if (!(await columnExists("money_sum", "reason"))) {
    await pool.query("ALTER TABLE money_sum ADD COLUMN reason TEXT NULL");
  }

  if (!(await columnExists("money_sum", "entry_type"))) {
    await pool.query("ALTER TABLE money_sum ADD COLUMN entry_type VARCHAR(20) NOT NULL DEFAULT 'expense'");
  }

  if (!(await columnExists("money_sum", "created_at"))) {
    await pool.query(
      "ALTER TABLE money_sum ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"
    );
  }

  if (!(await columnExists("money_sum", "updated_at"))) {
    await pool.query(
      "ALTER TABLE money_sum ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
    );
  }

  if (!(await columnExists("money_sum", "id"))) {
    await pool.query(
      "ALTER TABLE money_sum ADD COLUMN id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST"
    );
  }

  if (!(await indexExists("money_sum", "idx_money_sum_created_at"))) {
    await pool.query("CREATE INDEX idx_money_sum_created_at ON money_sum (created_at)");
  }

  if (!(await indexExists("money_sum", "idx_money_sum_entry_type"))) {
    await pool.query("CREATE INDEX idx_money_sum_entry_type ON money_sum (entry_type)");
  }
};

const initDatabase = async () => {
  await ensureResumeIdSequenceTable();
  await ensureRecruiterTableColumns();
  await ensureJobsTableColumns();
  await ensureResumesDataTable();
  await ensureApplicationColumns();
  await ensureJobResumeSelectionTable();
  await ensureMoneySumTable();
};

pool.initDatabase = initDatabase;

module.exports = pool;
