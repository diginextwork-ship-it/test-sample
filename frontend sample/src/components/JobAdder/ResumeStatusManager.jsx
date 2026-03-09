import { useEffect, useMemo, useState } from "react";
import { fetchMyJobs } from "../../services/jobAccessService";
import { fetchJobResumeStatuses, updateJobResumeStatus } from "../../services/performanceService";

const STATUS_OPTIONS = [
  "pending",
  "verified",
  "walk_in",
  "selected",
  "rejected",
  "joined",
  "dropout",
  "on_hold",
];

const formatLabel = (value) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatDateTime = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
};

export default function ResumeStatusManager() {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedJob = useMemo(
    () => jobs.find((job) => String(job.jid) === String(selectedJobId)) || null,
    [jobs, selectedJobId]
  );

  const loadJobResumes = async (jobId) => {
    if (!jobId) {
      setResumes([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await fetchJobResumeStatuses(jobId);
      setResumes(Array.isArray(data.resumes) ? data.resumes : []);
    } catch (loadError) {
      setError(loadError.message || "Failed to fetch resumes.");
      setResumes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadJobs = async () => {
      setJobsLoading(true);
      setError("");
      try {
        const data = await fetchMyJobs();
        if (!active) return;
        const nextJobs = Array.isArray(data.jobs) ? data.jobs : [];
        setJobs(nextJobs);
        setSelectedJobId(nextJobs[0]?.jid ? String(nextJobs[0].jid) : "");
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || "Failed to fetch jobs.");
      } finally {
        if (active) setJobsLoading(false);
      }
    };
    loadJobs();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setMessage("");
    loadJobResumes(selectedJobId);
  }, [selectedJobId]);

  const handleStatusChange = async (resume, status) => {
    if (!selectedJobId || !resume?.resId) return;
    setMessage("");
    setError("");
    try {
      await updateJobResumeStatus(selectedJobId, {
        resId: resume.resId,
        status,
      });
      setResumes((prev) =>
        prev.map((item) =>
          item.resId === resume.resId
            ? { ...item, status, updatedAt: new Date().toISOString(), updatedBy: "You" }
            : item
        )
      );
      setMessage(`Updated ${resume.resId} to ${formatLabel(status)}.`);
    } catch (updateError) {
      setError(updateError.message || "Failed to update status.");
    }
  };

  return (
    <section className="resume-status-manager">
      <div className="recruiter-performance-head">
        <h2>Manual Resume Status</h2>
        <select
          value={selectedJobId}
          onChange={(event) => setSelectedJobId(event.target.value)}
          disabled={jobsLoading || jobs.length === 0}
        >
          {jobs.length === 0 ? <option value="">No jobs found</option> : null}
          {jobs.map((job) => (
            <option key={job.jid} value={job.jid}>
              #{job.jid} - {job.role_name || "Role"} ({job.company_name || "Company"})
            </option>
          ))}
        </select>
      </div>

      {selectedJob ? (
        <p className="job-message">
          Managing resumes for job #{selectedJob.jid}: {selectedJob.role_name || "Role"} at{" "}
          {selectedJob.company_name || "Company"}
        </p>
      ) : null}

      {message ? <p className="job-message job-message-success">{message}</p> : null}
      {error ? <p className="job-message job-message-error">{error}</p> : null}
      {loading ? <p className="chart-empty">Loading resumes...</p> : null}

      {!loading && resumes.length === 0 && selectedJobId ? (
        <p className="chart-empty">No recruiter resumes submitted for this job yet.</p>
      ) : null}

      {!loading && resumes.length > 0 ? (
        <div className="ui-table-wrap">
          <table className="performance-table">
            <thead>
              <tr>
                <th>Resume ID</th>
                <th>RID</th>
                <th>Recruiter</th>
                <th>File</th>
                <th>ATS Match</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {resumes.map((resume) => (
                <tr key={resume.resId}>
                  <td>{resume.resId}</td>
                  <td>{resume.rid}</td>
                  <td>{resume.recruiterName || "N/A"}</td>
                  <td>{resume.resumeFilename || "N/A"}</td>
                  <td>
                    {resume.atsMatchPercentage === null || resume.atsMatchPercentage === undefined
                      ? "N/A"
                      : `${resume.atsMatchPercentage}%`}
                  </td>
                  <td>
                    <select
                      value={resume.status || "pending"}
                      onChange={(event) => handleStatusChange(resume, event.target.value)}
                    >
                      {STATUS_OPTIONS.map((statusOption) => (
                        <option key={statusOption} value={statusOption}>
                          {formatLabel(statusOption)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{formatDateTime(resume.updatedAt || resume.uploadedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
