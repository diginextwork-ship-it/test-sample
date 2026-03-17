import { useEffect, useMemo, useState } from "react";
import { fetchMyJobs } from "../../services/jobAccessService";
import {
  fetchJobResumeStatuses,
  updateJobResumeStatus,
} from "../../services/performanceService";
import { useNotification } from "../../context/NotificationContext";

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

export default function ResumeStatusManager({ onStatusUpdated }) {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [verifyingResumeId, setVerifyingResumeId] = useState("");
  const [verifyNote, setVerifyNote] = useState("");
  const { addNotification } = useNotification();

  const selectedJob = useMemo(
    () => jobs.find((job) => String(job.jid) === String(selectedJobId)) || null,
    [jobs, selectedJobId],
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
    setVerifyingResumeId("");
    setVerifyNote("");
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
            ? {
                ...item,
                status,
                updatedAt: new Date().toISOString(),
                updatedBy: "You",
              }
            : item,
        ),
      );
      const statusLabel = formatLabel(status);
      const notificationMessage = `Status updated to ${statusLabel} for Resume ID: ${resume.resId} (Job ID: ${selectedJobId})`;
      addNotification(notificationMessage, "success", 5000);
      setMessage(`Updated ${resume.resId} to ${formatLabel(status)}.`);
      onStatusUpdated?.();
    } catch (updateError) {
      setError(updateError.message || "Failed to update status.");
    }
  };

  const openVerifyComposer = (resume) => {
    setVerifyingResumeId(resume?.resId || "");
    setVerifyNote(resume?.verifiedReason || "");
    setMessage("");
    setError("");
  };

  const handleVerifyResume = async (resume) => {
    if (!selectedJobId || !resume?.resId) return;
    setMessage("");
    setError("");
    try {
      const normalizedNote = verifyNote.trim();
      await updateJobResumeStatus(selectedJobId, {
        resId: resume.resId,
        status: "verified",
        note: normalizedNote,
      });
      setResumes((prev) =>
        prev.map((item) =>
          item.resId === resume.resId
            ? {
                ...item,
                status: "verified",
                updatedAt: new Date().toISOString(),
                updatedBy: "You",
                verifiedReason: normalizedNote || null,
              }
            : item,
        ),
      );
      setVerifyingResumeId("");
      setVerifyNote("");

      const notificationMessage = `Status updated to Verified for Resume ID: ${resume.resId} (Job ID: ${selectedJobId})`;
      addNotification(notificationMessage, "success", 5000);

      setMessage(`Verified ${resume.resId}.`);
      onStatusUpdated?.();
    } catch (updateError) {
      setError(updateError.message || "Failed to verify resume.");
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
              #{job.jid} - {job.role_name || "Role"} (
              {job.company_name || "Company"})
            </option>
          ))}
        </select>
      </div>

      {selectedJob ? (
        <p className="job-message">
          Managing resumes for job #{selectedJob.jid}:{" "}
          {selectedJob.role_name || "Role"} at{" "}
          {selectedJob.company_name || "Company"}
        </p>
      ) : null}

      {message ? (
        <p className="job-message job-message-success">{message}</p>
      ) : null}
      {error ? <p className="job-message job-message-error">{error}</p> : null}
      {loading ? <p className="chart-empty">Loading resumes...</p> : null}

      {!loading && resumes.length === 0 && selectedJobId ? (
        <p className="chart-empty">
          No recruiter resumes submitted for this job yet.
        </p>
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
                <th>Recruiter Note</th>
                <th>Timing Info</th>
                <th>Status</th>
                <th>Action</th>
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
                    {resume.atsMatchPercentage === null ||
                    resume.atsMatchPercentage === undefined
                      ? "N/A"
                      : `${resume.atsMatchPercentage}%`}
                  </td>
                  <td className="table-cell-wrap">
                    {resume.submittedReason || "-"}
                  </td>
                  <td className="table-cell-wrap">
                    {resume.verifiedReason || "-"}
                  </td>
                  <td>
                    <span
                      className={`status-pill status-${resume.status || "pending"}`}
                    >
                      {formatLabel(resume.status || "pending")}
                    </span>
                  </td>
                  <td>
                    <div className="resume-status-actions">
                      <button
                        type="button"
                        className={`resume-action-btn resume-action-verify ${
                          resume.status === "verified" ? "active" : ""
                        }`}
                        onClick={() => openVerifyComposer(resume)}
                      >
                        Verify
                      </button>
                      <button
                        type="button"
                        className={`resume-action-btn resume-action-select ${
                          resume.status === "selected" ? "active" : ""
                        }`}
                        onClick={() => handleStatusChange(resume, "selected")}
                      >
                        Select
                      </button>
                      <button
                        type="button"
                        className={`resume-action-btn resume-action-reject ${
                          resume.status === "rejected" ? "active" : ""
                        }`}
                        onClick={() => handleStatusChange(resume, "rejected")}
                      >
                        Reject
                      </button>
                    </div>
                    {verifyingResumeId === resume.resId ? (
                      <div className="resume-verify-box">
                        <label htmlFor={`verify-note-${resume.resId}`}>
                          Any information about timing?
                        </label>
                        <textarea
                          id={`verify-note-${resume.resId}`}
                          value={verifyNote}
                          onChange={(event) =>
                            setVerifyNote(event.target.value)
                          }
                          rows={3}
                          placeholder="Optional timing information"
                        />
                        <div className="resume-status-actions">
                          <button
                            type="button"
                            className="resume-action-btn resume-action-verify active"
                            onClick={() => handleVerifyResume(resume)}
                          >
                            Save Verify
                          </button>
                          <button
                            type="button"
                            className="resume-action-btn"
                            onClick={() => {
                              setVerifyingResumeId("");
                              setVerifyNote("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {formatDateTime(resume.updatedAt || resume.uploadedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
