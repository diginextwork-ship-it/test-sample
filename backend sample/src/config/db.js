const mysql = require("mysql2/promise");

const requiredEnvVars = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required database environment variables: ${missingEnvVars.join(", ")}`
  );
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
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

const initDatabase = async () => {
  await ensureResumeIdSequenceTable();
  await ensureResumesDataTable();
  await ensureApplicationColumns();
};

pool.initDatabase = initDatabase;

module.exports = pool;
