const formatDateTime = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
};

const SummaryCard = ({ title, value }) => (
  <article className="summary-card">
    <h4>{title}</h4>
    <p>{value}</p>
  </article>
);

export default function DashboardOverview({ data, loading }) {
  if (loading) return <p className="chart-empty">Loading overview...</p>;
  if (!data) return <p className="chart-empty">No overview data available.</p>;

  const overview = data.overview || {};
  return (
    <section className="dashboard-overview">
      <div className="summary-cards">
        <SummaryCard title="Total Jobs" value={Number(overview.totalJobs) || 0} />
        <SummaryCard title="Open Jobs" value={Number(overview.openJobs) || 0} />
        <SummaryCard title="Restricted Jobs" value={Number(overview.restrictedJobs) || 0} />
        <SummaryCard title="Total Recruiters" value={Number(overview.totalRecruiters) || 0} />
        <SummaryCard title="Active Recruiters" value={Number(overview.activeRecruiters) || 0} />
        <SummaryCard title="Total Submissions" value={Number(overview.totalSubmissions) || 0} />
      </div>

      <div className="dashboard-panels">
        <article className="dashboard-panel">
          <h3>Top Performers</h3>
          {Array.isArray(data.topPerformers) && data.topPerformers.length ? (
            data.topPerformers.map((item) => (
              <div className="performer-row" key={item.rid}>
                <span>{item.name}</span>
                <span>{item.submitted || 0} submitted</span>
                <span>{item.points || 0} points</span>
              </div>
            ))
          ) : (
            <p className="empty-state">No top performers yet.</p>
          )}
        </article>

        <article className="dashboard-panel">
          <h3>Recent Activity</h3>
          {Array.isArray(data.recentActivity) && data.recentActivity.length ? (
            data.recentActivity.map((item, idx) => (
              <div className="activity-row" key={`${item.timestamp || "t"}-${idx}`}>
                <span>{item.recruiter}</span>
                <span>{item.type}</span>
                <span>{item.job}</span>
                <span>{formatDateTime(item.timestamp)}</span>
              </div>
            ))
          ) : (
            <p className="empty-state">No recent activity available.</p>
          )}
        </article>
      </div>
    </section>
  );
}
