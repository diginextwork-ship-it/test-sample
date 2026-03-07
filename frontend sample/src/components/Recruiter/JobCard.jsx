const formatDate = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

export default function JobCard({ job, onSubmitResume }) {
  return (
    <article className="recruiter-job-card-item">
      <header className="recruiter-job-card-head">
        <h3>{job.role_name || "Untitled Role"}</h3>
        <span className={`job-access-badge ${job.access_mode === "restricted" ? "restricted" : "open"}`}>
          {job.access_mode === "restricted" ? "Restricted Access" : "Open to All"}
        </span>
      </header>

      <p className="job-company">{job.company_name || "Unknown company"}</p>
      <p className="job-location">
        {job.city || "Unknown city"}
        {job.state ? `, ${job.state}` : ""}
      </p>

      <div className="job-details">
        <span>{job.salary || "Salary not specified"}</span>
        <span>{Number(job.positions_open) || 0} positions</span>
      </div>

      {job.skills ? (
        <div className="job-skills">
          {String(job.skills)
            .split(",")
            .map((skill) => skill.trim())
            .filter(Boolean)
            .map((skill) => (
              <span key={skill} className="skill-tag">
                {skill}
              </span>
            ))}
        </div>
      ) : null}

      <div className="job-actions">
        <button type="button" className="btn-primary" onClick={() => onSubmitResume(job.jid)}>
          Submit Resume
        </button>
      </div>

      <footer className="job-footer">Posted {formatDate(job.created_at)}</footer>
    </article>
  );
}
