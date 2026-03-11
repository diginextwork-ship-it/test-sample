import { useEffect, useState } from "react";
import { fetchTeamLeaderDashboard } from "../../services/performanceService";
import DashboardOverview from "./DashboardOverview";
import RecruiterPerformanceTable from "./RecruiterPerformanceTable";
import ResumeStatusManager from "./ResumeStatusManager";

export default function TeamLeaderDashboard({ jobsManagementContent }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [overviewData, setOverviewData] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [performanceRefreshKey, setPerformanceRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const loadOverview = async () => {
      setLoadingOverview(true);
      setOverviewError("");
      try {
        const data = await fetchTeamLeaderDashboard();
        if (!active) return;
        setOverviewData(data);
      } catch (error) {
        if (!active) return;
        setOverviewError(error.message || "Failed to load team leader overview.");
      } finally {
        if (active) setLoadingOverview(false);
      }
    };
    loadOverview();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="team-leader-dashboard">
      <div className="dashboard-tabs">
        <button
          type="button"
          className={activeTab === "overview" ? "active" : ""}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={activeTab === "jobs" ? "active" : ""}
          onClick={() => setActiveTab("jobs")}
        >
          Jobs Management
        </button>
        <button
          type="button"
          className={activeTab === "performance" ? "active" : ""}
          onClick={() => setActiveTab("performance")}
        >
          Recruiter Performance
        </button>
      </div>

      {activeTab === "overview" ? (
        <>
          {overviewError ? <p className="job-message job-message-error">{overviewError}</p> : null}
          <DashboardOverview data={overviewData} loading={loadingOverview} />
        </>
      ) : null}

      {activeTab === "jobs" ? jobsManagementContent : null}
      {activeTab === "performance" ? (
        <>
          <ResumeStatusManager onStatusUpdated={() => setPerformanceRefreshKey((prev) => prev + 1)} />
          <RecruiterPerformanceTable refreshKey={performanceRefreshKey} />
        </>
      ) : null}
    </section>
  );
}
