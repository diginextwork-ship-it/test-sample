-- Run this file after selecting the target database/schema.
-- Example (MySQL): USE hirenext;

CREATE TABLE IF NOT EXISTS recruiter (
  rid VARCHAR(20) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'recruiter',
  addjob BOOLEAN NOT NULL DEFAULT FALSE,
  success INT NOT NULL DEFAULT 0,
  points INT NOT NULL DEFAULT 0
);

UPDATE recruiter
SET role = CASE WHEN addjob = TRUE THEN 'job creator' ELSE 'recruiter' END
WHERE role IS NULL OR TRIM(role) = '';

CREATE TABLE IF NOT EXISTS jobs (
  jid INT AUTO_INCREMENT PRIMARY KEY,
  recruiter_rid VARCHAR(20) NOT NULL,
  city VARCHAR(120) NOT NULL,
  state VARCHAR(120) NOT NULL,
  pincode VARCHAR(20) NOT NULL,
  company_name VARCHAR(190) NOT NULL,
  role_name VARCHAR(190) NOT NULL,
  positions_open INT NOT NULL DEFAULT 1,
  revenue DECIMAL(12,2) NULL,
  points_per_joining INT NOT NULL DEFAULT 0,
  skills TEXT NULL,
  job_description TEXT NULL,
  experience VARCHAR(80) NULL,
  salary VARCHAR(120) NULL,
  qualification LONGTEXT NULL,
  benefits TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_jobs_recruiter
    FOREIGN KEY (recruiter_rid) REFERENCES recruiter(rid)
    ON UPDATE CASCADE ON DELETE CASCADE
);

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS positions_open INT NOT NULL DEFAULT 1;
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS revenue DECIMAL(12,2) NULL;
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS points_per_joining INT NOT NULL DEFAULT 0;
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS access_mode ENUM('open', 'restricted') NOT NULL DEFAULT 'open';

ALTER TABLE recruiter
  ADD COLUMN IF NOT EXISTS points INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_jid INT NOT NULL,
  candidate_name VARCHAR(190) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(190) NOT NULL,
  latest_education_level VARCHAR(100) NOT NULL,
  board_university VARCHAR(190) NOT NULL,
  institution_name VARCHAR(190) NOT NULL,
  grading_system VARCHAR(40) NOT NULL,
  score VARCHAR(40) NOT NULL,
  age INT NOT NULL,
  resume_filename VARCHAR(255) NULL,
  resume_parsed_data JSON NULL,
  ats_score DECIMAL(5,2) NULL,
  ats_match_percentage DECIMAL(5,2) NULL,
  ats_raw_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_applications_job
    FOREIGN KEY (job_jid) REFERENCES jobs(jid)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recruiter_candidate_clicks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recruiter_rid VARCHAR(20) NOT NULL,
  candidate_name VARCHAR(190) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_recruiter_clicks_rid_created (recruiter_rid, created_at),
  CONSTRAINT fk_clicks_recruiter
    FOREIGN KEY (recruiter_rid) REFERENCES recruiter(rid)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS resumes_data (
  res_id VARCHAR(30) PRIMARY KEY,
  rid VARCHAR(20) NOT NULL,
  job_jid INT NULL,
  submitted_by_role VARCHAR(30) NULL DEFAULT 'recruiter',
  is_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  accepted_at TIMESTAMP NULL DEFAULT NULL,
  accepted_by_admin VARCHAR(50) NULL,
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
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_resumes_data_job
    FOREIGN KEY (job_jid) REFERENCES jobs(jid)
    ON UPDATE CASCADE ON DELETE SET NULL
);

ALTER TABLE resumes_data
  ADD COLUMN IF NOT EXISTS submitted_by_role VARCHAR(30) NULL DEFAULT 'recruiter';
ALTER TABLE resumes_data
  ADD COLUMN IF NOT EXISTS is_accepted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE resumes_data
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE resumes_data
  ADD COLUMN IF NOT EXISTS accepted_by_admin VARCHAR(50) NULL;

CREATE TABLE IF NOT EXISTS resume_id_sequence (
  seq_id BIGINT AUTO_INCREMENT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS job_resume_selection (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  job_jid INT NOT NULL,
  res_id VARCHAR(30) NOT NULL,
  selected_by_admin VARCHAR(50) NOT NULL,
  selection_status ENUM('selected', 'rejected', 'on_hold') NOT NULL DEFAULT 'selected',
  selection_note TEXT NULL,
  selected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_job_resume_selection (job_jid, res_id),
  INDEX idx_job_resume_selection_job_status_time (job_jid, selection_status, selected_at),
  CONSTRAINT fk_job_resume_selection_job
    FOREIGN KEY (job_jid) REFERENCES jobs(jid)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_job_resume_selection_resume
    FOREIGN KEY (res_id) REFERENCES resumes_data(res_id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS money_sum (
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
);

CREATE TABLE IF NOT EXISTS job_recruiter_access (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_jid INT UNSIGNED NOT NULL,
  recruiter_rid VARCHAR(20) NOT NULL,
  granted_by VARCHAR(20) NOT NULL,
  granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NULL,
  UNIQUE KEY uniq_job_recruiter_access (job_jid, recruiter_rid),
  INDEX idx_job_recruiter_access_job_active (job_jid, is_active),
  INDEX idx_job_recruiter_access_recruiter_active (recruiter_rid, is_active),
  CONSTRAINT fk_job_recruiter_access_job
    FOREIGN KEY (job_jid) REFERENCES jobs(jid)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_job_recruiter_access_recruiter
    FOREIGN KEY (recruiter_rid) REFERENCES recruiter(rid)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_job_recruiter_access_granted_by
    FOREIGN KEY (granted_by) REFERENCES recruiter(rid)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS status (
  recruiter_rid VARCHAR(20) PRIMARY KEY,
  submitted INT NOT NULL DEFAULT 0,
  verified INT NULL,
  walk_in INT NULL,
  `select` INT NULL,
  reject INT NULL,
  joined INT NULL,
  dropout INT NULL,
  last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_status_recruiter
    FOREIGN KEY (recruiter_rid) REFERENCES recruiter(rid)
    ON UPDATE CASCADE ON DELETE CASCADE
);
