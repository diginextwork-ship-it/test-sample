import { useEffect, useMemo, useState } from "react";
import PerformanceMetricCard from "./PerformanceMetricCard";
import { fetchRecruiterDashboard } from "../../services/performanceService";
import { getAuthToken } from "../../auth/session";
import { API_BASE_URL } from "../../config/api";

const toDisplay = (value) => (value === null || value === undefined ? "-" : value);
const getPointsProgressColor = (points) => {
  if (points <= 25) return "danger";
  if (points <= 75) return "warning";
  return "success";
};

export default function RecruiterDashboard({ recruiterId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ startDate: "", endDate: "" });
  const [appliedFilters, setAppliedFilters] = useState({ startDate: "", endDate: "" });
  const [filterError, setFilterError] = useState("");
  const [statusResumes, setStatusResumes] = useState([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [activeStatus, setActiveStatus] = useState("");

  useEffect(() => {
    if (!recruiterId) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetchRecruiterDashboard(recruiterId, appliedFilters);
        if (!active) return;
        setData(response);
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || "Failed to load recruiter dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [recruiterId, appliedFilters]);

  const handleFilterChange = (field) => (event) => {
    const nextValue = event.target.value;
    setFilters((prev) => ({ ...prev, [field]: nextValue }));
    if (filterError) setFilterError("");
  };

  const handleApplyFilters = () => {
    const startDate = String(filters.startDate || "").trim();
    const endDate = String(filters.endDate || "").trim();

    if ((startDate && !endDate) || (!startDate && endDate)) {
      setFilterError("Select both start date and end date.");
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      setFilterError("Start date cannot be after end date.");
      return;
    }

    setFilterError("");
    setAppliedFilters({ startDate, endDate });
  };

  const handleClearFilters = () => {
    setFilterError("");
    setFilters({ startDate: "", endDate: "" });
    setAppliedFilters({ startDate: "", endDate: "" });
  };

  const readJsonResponse = async (response) => {
    const raw = await response.text();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(`Server returned non-JSON response (${response.status}).`);
    }
  };

  const fetchRecruiterResumes = async () => {
    const token = getAuthToken();
    if (!token) throw new Error("Authentication required.");
    const response = await fetch(
      `${API_BASE_URL}/api/recruiters/${encodeURIComponent(recruiterId)}/resumes`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const payload = await readJsonResponse(response);
    if (!response.ok) {
      throw new Error(
        payload?.error || payload?.message || "Failed to fetch recruiter resumes."
      );
    }
    return Array.isArray(payload.resumes) ? payload.resumes : [];
  };

  const normalizeStatus = (value) => String(value || "").trim().toLowerCase();
  const mapStatusToFilter = (status) => {
    const normalized = normalizeStatus(status);
    if (normalized === "submitted") return "submitted";
    if (normalized === "verified") return "verified";
    if (normalized === "walk in" || normalized === "walk_in") return "walk_in";
    if (normalized === "selected" || normalized === "select") return "selected";
    if (normalized === "rejected" || normalized === "reject") return "rejected";
    if (normalized === "joined") return "joined";
    if (normalized === "dropout") return "dropout";
    return "";
  };

  const handleStatusCardClick = async (statusKey) => {
    const nextStatus = mapStatusToFilter(statusKey);
    setActiveStatus(nextStatus);
    setStatusError("");
    setStatusLoading(true);
    try {
      const resumes = await fetchRecruiterResumes();
      setStatusResumes(resumes);
    } catch (loadError) {
      setStatusError(loadError.message || "Failed to load resumes.");
      setStatusResumes([]);
    } finally {
      setStatusLoading(false);
    }
  };

  const activeStatusLabel = useMemo(() => {
    if (!activeStatus) return "";
    return activeStatus.replace(/_/g, " ");
  }, [activeStatus]);

  const filteredStatusResumes = useMemo(() => {
    const normalizedStatus = normalizeStatus(activeStatus);
    let resumes = Array.isArray(statusResumes) ? statusResumes : [];
    if (normalizedStatus && normalizedStatus !== "submitted") {
      resumes = resumes.filter(
        (resume) => normalizeStatus(resume.workflowStatus) === normalizedStatus
      );
    }
    const { startDate, endDate } = appliedFilters;
    if (startDate && endDate) {
      const start = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T23:59:59.999`);
      resumes = resumes.filter((resume) => {
        const raw = resume.workflowUpdatedAt || resume.uploadedAt;
        if (!raw) return false;
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) return false;
        return parsed >= start && parsed <= end;
      });
    }
    return resumes;
  }, [activeStatus, statusResumes, appliedFilters]);

  if (loading) return <p className="chart-empty">Loading performance dashboard...</p>;
  if (error) return <p className="job-message job-message-error">{error}</p>;
  if (!data) return <p className="chart-empty">No dashboard data available.</p>;

  const totalPoints = Number(data.recruiter?.points) || 0;
  const cappedPoints = Math.max(0, Math.min(100, totalPoints));
  const progressWidth = totalPoints > 100 ? 100 : cappedPoints;
  const pointsProgressColor = getPointsProgressColor(totalPoints);
  const formatDateTime = (value) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString();
  };

  return (
    <section className="recruiter-performance-dashboard">
      <h2>My Performance Dashboard</h2>
      <div className="dashboard-date-filter">
        <div className="dashboard-date-input">
          <label htmlFor="recruiterDashboardStartDate">Start date</label>
          <input
            id="recruiterDashboardStartDate"
            type="date"
            value={filters.startDate}
            onChange={handleFilterChange("startDate")}
          />
        </div>
        <div className="dashboard-date-input">
          <label htmlFor="recruiterDashboardEndDate">End date</label>
          <input
            id="recruiterDashboardEndDate"
            type="date"
            value={filters.endDate}
            onChange={handleFilterChange("endDate")}
          />
        </div>
        <div className="dashboard-date-actions">
          <button
            type="button"
            className="dashboard-date-btn"
            onClick={handleApplyFilters}
          >
            Apply
          </button>
          <button
            type="button"
            className="dashboard-date-btn dashboard-date-btn-secondary"
            onClick={handleClearFilters}
          >
            Clear
          </button>
        </div>
      </div>
      {filterError ? (
        <p className="job-message job-message-error">{filterError}</p>
      ) : null}
      {appliedFilters.startDate && appliedFilters.endDate ? (
        <p className="dashboard-filter-summary">
          Showing statistics from <strong>{appliedFilters.startDate}</strong> to{" "}
          <strong>{appliedFilters.endDate}</strong>.
        </p>
      ) : null}
      <h3>Status Breakdown</h3>
      <div className="metric-grid">
        <PerformanceMetricCard
          title="Submitted"
          color="blue"
          value={data.stats?.submitted || 0}
          clickable
          onClick={() => handleStatusCardClick("submitted")}
        />
        <PerformanceMetricCard
          title="Verified"
          color="green"
          value={toDisplay(data.stats?.verified)}
          clickable
          onClick={() => handleStatusCardClick("verified")}
        />
        <PerformanceMetricCard
          title="Walk in"
          color="green"
          value={toDisplay(data.stats?.walk_in)}
          clickable
          onClick={() => handleStatusCardClick("walk_in")}
        />
        <PerformanceMetricCard
          title="Selected"
          color="purple"
          value={toDisplay(data.stats?.select)}
          clickable
          onClick={() => handleStatusCardClick("selected")}
        />
        <PerformanceMetricCard
          title="Rejected"
          color="red"
          value={toDisplay(data.stats?.reject)}
          clickable
          onClick={() => handleStatusCardClick("rejected")}
        />
        <PerformanceMetricCard
          title="Joined"
          color="gold"
          value={toDisplay(data.stats?.joined)}
          clickable
          onClick={() => handleStatusCardClick("joined")}
        />
        <PerformanceMetricCard
          title="Dropout"
          color="pink"
          value={toDisplay(data.stats?.dropout)}
          clickable
          onClick={() => handleStatusCardClick("dropout")}
        />
      </div>

      {activeStatus ? (
        <section className="chart-card ui-mt-md">
          <div className="ui-row-between ui-row-wrap">
            <h3>
              {activeStatusLabel} resumes ({filteredStatusResumes.length})
            </h3>
            <button
              type="button"
              className="dashboard-date-btn dashboard-date-btn-secondary"
              onClick={() => setActiveStatus("")}
            >
              Close
            </button>
          </div>
          {statusLoading ? <p className="chart-empty">Loading resumes...</p> : null}
          {statusError ? <p className="job-message job-message-error">{statusError}</p> : null}
          {!statusLoading && !statusError && filteredStatusResumes.length === 0 ? (
            <p className="chart-empty">No resumes found for this status.</p>
          ) : null}
          {!statusLoading && !statusError && filteredStatusResumes.length > 0 ? (
            <div className="ui-table-wrap ui-mt-xs">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Job ID</th>
                    <th>Recruiter Note</th>
                    <th>Team Leader Note</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStatusResumes.map((resume) => (
                    <tr key={resume.resId}>
                      <td>{resume.candidateName || "N/A"}</td>
                      <td>{resume.jobJid ?? "N/A"}</td>
                      <td className="table-cell-wrap">{resume.submittedReason || "-"}</td>
                      <td className="table-cell-wrap">{resume.verifiedReason || "-"}</td>
                      <td>{String(resume.workflowStatus || "pending").replace(/_/g, " ")}</td>
                      <td>{formatDateTime(resume.workflowUpdatedAt || resume.uploadedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      <article className="points-progress-card">
        <div className="points-progress-head">
          <h3>Total Points Progress</h3>
          <p className="points-progress-label">
            <strong>{totalPoints}</strong>
            {totalPoints <= 100 ? " / 100" : ""}
          </p>
        </div>
        <div
          className="points-progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={cappedPoints}
        >
          <div
            className={`points-progress-fill ${pointsProgressColor}`}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
        <div className="points-progress-actions"></div>
      </article>
    </section>
  );
}
