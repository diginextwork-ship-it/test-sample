import { useEffect, useMemo, useState } from "react";
import { fetchAllRecruiterStatuses } from "../../services/performanceService";

const metricDisplay = (value) => (value === null || value === undefined ? "-" : value);

export default function RecruiterPerformanceTable() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("submitted");
  const [sortOrder, setSortOrder] = useState("desc");

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchAllRecruiterStatuses({ sortBy, sortOrder, search });
        if (!active) return;
        setRows(Array.isArray(data.recruiters) ? data.recruiters : []);
        setSummary(data.summary || null);
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || "Failed to load recruiter performance.");
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [sortBy, sortOrder, search]);

  const derived = useMemo(() => {
    const totalSubmitted = rows.reduce((sum, item) => sum + (item?.stats?.submitted || 0), 0);
    const avg = rows.length ? Number((totalSubmitted / rows.length).toFixed(2)) : 0;
    return { totalSubmitted, avg };
  }, [rows]);

  const toggleSort = (column) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortOrder(column === "name" ? "asc" : "desc");
  };

  return (
    <section className="recruiter-performance-wrap">
      <div className="recruiter-performance-head">
        <h2>Recruiter Performance</h2>
        <input
          type="text"
          placeholder="Search recruiter by name or email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {loading ? <p className="chart-empty">Loading recruiter stats...</p> : null}
      {error ? <p className="job-message job-message-error">{error}</p> : null}

      {!loading && !error ? (
        <>
          <div className="ui-table-wrap">
            <table className="performance-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="table-sort-btn" onClick={() => toggleSort("name")}>
                      Name
                    </button>
                  </th>
                  <th>Email</th>
                  <th>
                    <button type="button" className="table-sort-btn" onClick={() => toggleSort("submitted")}>
                      Submitted
                    </button>
                  </th>
                  <th>Verified</th>
                  <th>Walk-in</th>
                  <th>Selected</th>
                  <th>Rejected</th>
                  <th>Joined</th>
                  <th>Dropout</th>
                  <th>
                    <button type="button" className="table-sort-btn" onClick={() => toggleSort("points")}>
                      Points
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.rid}>
                    <td>{item.name}</td>
                    <td>{item.email}</td>
                    <td className="metric-value">{item.stats?.submitted || 0}</td>
                    <td className="metric-value">{metricDisplay(item.stats?.verified)}</td>
                    <td className="metric-value">{metricDisplay(item.stats?.walk_in)}</td>
                    <td className="metric-value">{metricDisplay(item.stats?.select)}</td>
                    <td className="metric-value">{metricDisplay(item.stats?.reject)}</td>
                    <td className="metric-value">{metricDisplay(item.stats?.joined)}</td>
                    <td className="metric-value">{metricDisplay(item.stats?.dropout)}</td>
                    <td>{item.points || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-summary">
            <p>Total Submissions: {summary?.totalSubmitted ?? derived.totalSubmitted}</p>
            <p>Average per Recruiter: {summary?.avgSubmittedPerRecruiter ?? derived.avg}</p>
          </div>
        </>
      ) : null}
    </section>
  );
}
