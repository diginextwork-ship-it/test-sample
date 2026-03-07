import { useEffect, useState } from "react";
import PerformanceMetricCard from "./PerformanceMetricCard";
import { fetchRecruiterDashboard } from "../../services/performanceService";

const formatDateTime = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
};

const toDisplay = (value) => (value === null || value === undefined ? "—" : value);

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

  return (
    <section className="recruiter-performance-dashboard">
      <h2>My Performance Dashboard</h2>

      <div className="metric-grid">
        <PerformanceMetricCard title="Submitted" color="blue" value={data.stats?.submitted || 0} />
        <PerformanceMetricCard
          title="Verified"
          color="green"
          value={toDisplay(data.stats?.verified)}
          comingSoon={data.stats?.verified === null}
        />
        <PerformanceMetricCard
          title="Selected"
          color="purple"
          value={toDisplay(data.stats?.select)}
          comingSoon={data.stats?.select === null}
        />
        <PerformanceMetricCard
          title="Joined"
          color="gold"
          value={toDisplay(data.stats?.joined)}
          comingSoon={data.stats?.joined === null}
        />
      </div>

      <div className="dashboard-info-grid">
        <article className="info-card">
          <h3>Accessible Jobs</h3>
          <p className="big-number">{Number(data.accessibleJobsCount) || 0}</p>
          <button type="button" className="btn-secondary" onClick={onViewJobs}>
            Browse Jobs
          </button>
        </article>
        <article className="info-card">
          <h3>Total Points</h3>
          <p className="big-number">{Number(data.recruiter?.points) || 0}</p>
          <p className="recruiter-stat-caption">Points will grow when downstream workflow is active.</p>
        </article>
      </div>

      <div className="recent-submissions">
        <h3>Recent Submissions</h3>
        {Array.isArray(data.recentSubmissions) && data.recentSubmissions.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
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
          <p className="empty-state">No submissions yet. Start by browsing available jobs.</p>
        )}
      </div>
    </section>
  );
}
