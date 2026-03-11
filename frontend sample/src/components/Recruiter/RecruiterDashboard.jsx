import { useEffect, useState } from "react";
import PerformanceMetricCard from "./PerformanceMetricCard";
import { fetchRecruiterDashboard } from "../../services/performanceService";

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
  const [filters, setFilters] = useState({ startDate: "", endDate: "" });
  const [appliedFilters, setAppliedFilters] = useState({ startDate: "", endDate: "" });
  const [filterError, setFilterError] = useState("");

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
          title="Rejected"
          color="red"
          value={toDisplay(data.stats?.reject)}
        />
        <PerformanceMetricCard
          title="Joined"
          color="gold"
          value={toDisplay(data.stats?.joined)}
        />
        <PerformanceMetricCard
          title="Dropout"
          color="pink"
          value={toDisplay(data.stats?.dropout)}
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
    </section>
  );
}
