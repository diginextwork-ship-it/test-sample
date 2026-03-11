import AdminLayout from "./AdminLayout";
import useAdminDashboard from "./useAdminDashboard";
import "../../styles/admin-panel.css";

export default function AdminRidPerformance({ setCurrentPage }) {
  const {
    dashboard,
    isLoadingDashboard,
    errorMessage,
    refreshDashboard,
  } = useAdminDashboard();

  return (
    <AdminLayout
      title="Resumes by recruiter ID"
      subtitle="See which recruiters are submitting the most resumes."
      setCurrentPage={setCurrentPage}
      actions={
        <button
          type="button"
          className="admin-refresh-btn"
          onClick={refreshDashboard}
          disabled={isLoadingDashboard}
        >
          {isLoadingDashboard ? "Refreshing..." : "Refresh"}
        </button>
      }
    >
      {errorMessage ? (
        <div className="admin-alert admin-alert-error">{errorMessage}</div>
      ) : null}

      <div className="admin-dashboard-card admin-card-large">
        {dashboard.recruiterPerformance.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>RID</th>
                  <th>Recruiter Name</th>
                  <th>Resumes Submitted</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recruiterPerformance.map((item) => (
                  <tr key={item.rid || item.recruiterName}>
                    <td>{item.rid || "N/A"}</td>
                    <td>{item.recruiterName || "N/A"}</td>
                    <td>{Number(item.resumeCount) || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-chart-empty">No resume submissions found in resumes_data yet.</p>
        )}
      </div>
    </AdminLayout>
  );
}
