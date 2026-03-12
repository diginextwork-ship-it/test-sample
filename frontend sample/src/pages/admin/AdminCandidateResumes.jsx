import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import { API_BASE_URL, getAdminHeaders, readJsonResponse } from "./adminApi";
import "../../styles/admin-panel.css";

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
};

export default function AdminCandidateResumes({ setCurrentPage }) {
  const [resumes, setResumes] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadCandidateResumes = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/candidate-resumes`, {
        headers: getAdminHeaders(),
      });
      const data = await readJsonResponse(
        response,
        "Check VITE_API_BASE_URL and ensure the admin candidate resumes route is available."
      );
      if (!response.ok) {
        throw new Error(data?.message || "Failed to fetch candidate submitted resumes.");
      }

      setResumes(Array.isArray(data?.resumes) ? data.resumes : []);
      setTotalCount(Number(data?.totalCount) || 0);
    } catch (error) {
      setResumes([]);
      setTotalCount(0);
      setErrorMessage(error.message || "Failed to fetch candidate submitted resumes.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCandidateResumes();
  }, []);

  return (
    <AdminLayout
      title="Candidate's submitted resumes"
      subtitle="See resumes submitted by normal users from the job search flow, along with JD and ATS details."
      setCurrentPage={setCurrentPage}
      actions={
        <button
          type="button"
          className="admin-refresh-btn"
          onClick={loadCandidateResumes}
          disabled={isLoading}
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      }
    >
      {errorMessage ? <div className="admin-alert admin-alert-error">{errorMessage}</div> : null}

      <div className="admin-dashboard-card" style={{ marginBottom: "16px" }}>
        <div className="admin-muted">Candidate resume submissions</div>
        <h3 style={{ margin: "8px 0 0" }}>{totalCount}</h3>
      </div>

      <div className="admin-dashboard-card admin-card-large">
        {resumes.length === 0 ? (
          <p className="admin-chart-empty">
            {isLoading ? "Loading candidate resumes..." : "No candidate-submitted resumes found yet."}
          </p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table-wide">
              <thead>
                <tr>
                  <th>Resume ID</th>
                  <th>Candidate</th>
                  <th>Job</th>
                  <th>JD</th>
                  <th>ATS Score</th>
                  <th>ATS Match</th>
                  <th>File</th>
                  <th>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {resumes.map((resume) => (
                  <tr key={resume.resId}>
                    <td>{resume.resId || "N/A"}</td>
                    <td>{resume.applicantName || "Name not found"}</td>
                    <td className="admin-job-cell">
                      <strong>{resume.jobJid ? `#${resume.jobJid}` : "No job"}</strong>
                      <div>{resume.job?.roleName || "N/A"}</div>
                      <div className="admin-muted">{resume.job?.companyName || "N/A"}</div>
                    </td>
                    <td style={{ minWidth: "260px", whiteSpace: "normal" }}>
                      {resume.job?.jobDescription || resume.job?.skills || "N/A"}
                    </td>
                    <td>{resume.atsScore === null ? "N/A" : `${resume.atsScore}%`}</td>
                    <td>
                      {resume.atsMatchPercentage === null ? "N/A" : `${resume.atsMatchPercentage}%`}
                    </td>
                    <td>
                      {resume.resumeFilename || "N/A"}
                      {resume.resumeType ? ` (${String(resume.resumeType).toUpperCase()})` : ""}
                    </td>
                    <td>{formatDateTime(resume.uploadedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
