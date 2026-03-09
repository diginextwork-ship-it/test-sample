export default function JobsListTable({
  jobs,
  isLoading,
  onRefresh,
  onEditAccess,
  canEditAccess = true,
}) {
  return (
    <div className="chart-card ui-mt-md">
      <div className="jobs-header-row">
        <h2>My jobs</h2>
        <button
          type="button"
          className="click-here-btn"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {jobs.length === 0 ? (
        <p className="chart-empty">{isLoading ? "Loading jobs..." : "No jobs found."}</p>
      ) : (
        <div className="jobs-list-table-wrap">
          <table className="jobs-list-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Company</th>
                <th>Role</th>
                <th>Location</th>
                <th>Access Mode</th>
                <th>Assigned Recruiters</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const isRestricted = job.accessMode === "restricted";
                const location = [job.city, job.state, job.pincode].filter(Boolean).join(", ") || "N/A";
                return (
                  <tr key={job.id}>
                    <td>{job.id}</td>
                    <td>{job.company}</td>
                    <td>{job.title}</td>
                    <td>{location}</td>
                    <td>
                      <span
                        className={`access-badge ${isRestricted ? "access-badge-restricted" : "access-badge-open"}`}
                      >
                        {isRestricted ? "Restricted" : "Open"}
                      </span>
                    </td>
                    <td>{isRestricted ? `${job.recruiterCount} recruiters` : "All recruiters"}</td>
                    <td>
                      {canEditAccess ? (
                        <button
                          type="button"
                          className="click-here-btn"
                          onClick={() => onEditAccess(job.id)}
                        >
                          Edit Access
                        </button>
                      ) : (
                        <span className="chart-empty">N/A</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
