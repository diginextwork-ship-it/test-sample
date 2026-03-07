import { useEffect, useState } from "react";
import { fetchJobAdderDashboard } from "../../services/performanceService";
import DashboardOverview from "./DashboardOverview";
import RecruiterPerformanceTable from "./RecruiterPerformanceTable";
import ResumeStatusManager from "./ResumeStatusManager";

export default function JobAdderDashboard({ jobsManagementContent }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [overviewData, setOverviewData] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState("");

  useEffect(() => {
    let active = true;
    const loadOverview = async () => {
      setLoadingOverview(true);
      setOverviewError("");
      try {
        const data = await fetchJobAdderDashboard();
        if (!active) return;
        setOverviewData(data);
      } catch (error) {
        if (!active) return;
        setOverviewError(error.message || "Failed to load job adder overview.");
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
    <section className="job-adder-dashboard">
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
          <ResumeStatusManager />
          <RecruiterPerformanceTable />
        </>
      ) : null}
    </section>
  );
}
