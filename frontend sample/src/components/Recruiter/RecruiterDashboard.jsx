import { useEffect, useState } from "react";
import PerformanceMetricCard from "./PerformanceMetricCard";
import { fetchRecruiterDashboard } from "../../services/performanceService";

const formatDateTime = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
};

const toDisplay = (value) => (value === null || value === undefined ? "-" : value);
const getPointsProgressColor = (points) => {
  if (points <= 25) return "danger";
  if (points <= 75) return "warning";
  return "success";
};

export default function RecruiterDashboard({ recruiterId, onViewJobs }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!recruiterId) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetchRecruiterDashboard(recruiterId);
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
  }, [recruiterId]);

  if (loading) return <p className="chart-empty">Loading performance dashboard...</p>;
  if (error) return <p className="job-message job-message-error">{error}</p>;
  if (!data) return <p className="chart-empty">No dashboard data available.</p>;

  const totalPoints = Number(data.recruiter?.points) || 0;
  const cappedPoints = Math.max(0, Math.min(100, totalPoints));
  const progressWidth = totalPoints > 100 ? 100 : cappedPoints;
  const pointsProgressColor = getPointsProgressColor(totalPoints);

  return (
    <section className="recruiter-performance-dashboard">
      <h2>My Performance Dashboard</h2>

      <div className="metric-grid">
        <PerformanceMetricCard
          title="Submitted"
          color="blue"
          value={data.stats?.submitted || 0}
        />
        <PerformanceMetricCard
          title="Verified"
          color="green"
          value={toDisplay(data.stats?.verified)}
        />
        <PerformanceMetricCard
          title="Selected"
          color="purple"
          value={toDisplay(data.stats?.select)}
        />
        <PerformanceMetricCard
          title="Joined"
          color="gold"
          value={toDisplay(data.stats?.joined)}
        />
        <PerformanceMetricCard
          title="Dropout"
          color="pink"
          value={toDisplay(data.stats?.Dropout)}
        />
        <PerformanceMetricCard
          title="Rejected"
          color="red"
          value={toDisplay(data.stats?.Rejected)}
        />
      </div>

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

      <div className="status-breakdown">
        <h3>Status Breakdown</h3>
        <div className="ui-table-wrap">
           <table className="performance-table">
            <thead>
              <tr>
                <th>Verified</th>
                <th>Walk-in</th>
                <th>Selected</th>
                <th>Rejected</th>
                <th>Joined</th>
                <th>Dropout</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{toDisplay(data.stats?.verified)}</td>
                <td>{toDisplay(data.stats?.walk_in)}</td>
                <td>{toDisplay(data.stats?.select)}</td>
                <td>{toDisplay(data.stats?.reject)}</td>
                <td>{toDisplay(data.stats?.joined)}</td>
                <td>{toDisplay(data.stats?.dropout)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="recent-submissions">
        <h3>Recent Submissions</h3>
        {Array.isArray(data.recentSubmissions) &&
        data.recentSubmissions.length > 0 ? (
          <div className="ui-table-wrap">
            <table className="performance-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Candidate</th>
                  <th>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSubmissions.map((item, idx) => (
                  <tr key={`${item.submittedAt || "t"}-${idx}`}>
                    <td>{item.job || "Job details unavailable"}</td>
                    <td>{item.candidate || "Candidate"}</td>
                    <td>{formatDateTime(item.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">
            No submissions yet. Start by browsing available jobs.
          </p>
        )}
      </div>
    </section>
  );
}
