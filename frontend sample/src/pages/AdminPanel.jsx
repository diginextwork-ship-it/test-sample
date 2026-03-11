import useAdminDashboard from "./admin/useAdminDashboard";
import "../styles/admin-panel.css";

export default function AdminPanel({ setCurrentPage, onLogout }) {
  const { dashboard, isLoadingDashboard, errorMessage, refreshDashboard } =
    useAdminDashboard();

  const cards = [
    {
      title: "Create Recruiter",
      description: "Add a new recruiter account and assign a role.",
      stat: "Access management",
      page: "admincreate",
    },
    {
      title: "Resumes by RID",
      description: "Track resumes submitted per recruiter ID.",
      stat: `${dashboard.recruiterPerformance.length} recruiters`,
      page: "adminridstats",
    },
    {
      title: "Top ATS Resumes",
      description: "Review top-matched resumes per job.",
      stat: `${dashboard.topResumesByJob.length} jobs`,
      page: "admintopresumes",
    },
    {
      title: "Recruiter Uploads",
      description: "Audit recruiter resume uploads.",
      stat: `${dashboard.totalResumeCount} total uploads`,
      page: "adminuploads",
    },
    {
      title: "Manual Resume Selection",
      description: "Select resumes for each job against open positions.",
      stat: `${dashboard.topResumesByJob.length} active jobs`,
      page: "adminmanualselection",
    },
    {
      title: "Revenue",
      description:
        "Track intake and expenses (salaries, electricity bills, client payments) with charts and table.",
      stat: "Finance tracking",
      page: "adminrevenue",
    },
  ];

  return (
    <main className="admin-page admin-panel-page">
      <section className="admin-hero">
        <div>
          <p className="admin-kicker">Admin Control Center</p>
          <h1>Admin dashboard</h1>
          <p className="admin-hero-subtitle">
            Organize recruiter access, track resume activity, and monitor ATS insights.
          </p>
        </div>
        <div className="admin-page-actions">
          <button
            type="button"
            className="admin-back-btn"
            onClick={onLogout}
          >
            Logout
          </button>
          <button
            type="button"
            className="admin-refresh-btn"
            onClick={refreshDashboard}
            disabled={isLoadingDashboard}
          >
            {isLoadingDashboard ? "Refreshing..." : "Refresh data"}
          </button>
        </div>
      </section>

      {errorMessage ? (
        <div className="admin-alert admin-alert-error">{errorMessage}</div>
      ) : null}

      <section className="admin-cards-grid">
        {cards.map((card) => (
          <button
            key={card.title}
            type="button"
            className="admin-card-link"
            onClick={() => setCurrentPage(card.page)}
          >
            <div className="admin-card">
              <div className="admin-card-top">
                <h2>{card.title}</h2>
                <span className="admin-card-stat">{card.stat}</span>
              </div>
              <p>{card.description}</p>
              <span className="admin-card-action">Open</span>
            </div>
          </button>
        ))}
      </section>
    </main>
  );
}
