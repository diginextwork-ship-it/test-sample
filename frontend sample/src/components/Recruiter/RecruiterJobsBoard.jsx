import { useEffect, useMemo, useState } from "react";
import JobCard from "./JobCard";
import ResumeSubmissionModal from "./ResumeSubmissionModal";
import SearchFilters from "./SearchFilters";
import { fetchAccessibleJobs } from "../../services/jobAccessService";

const PAGE_SIZE = 12;

export default function RecruiterJobsBoard({ recruiterId, onResumeSubmitted }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [filters, setFilters] = useState({ location: "", company: "", search: "" });
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [activeJobId, setActiveJobId] = useState(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const currentPage = useMemo(() => Math.floor(offset / PAGE_SIZE) + 1, [offset]);

  useEffect(() => {
    setOffset(0);
  }, [filters.location, filters.company, filters.search]);

  useEffect(() => {
    if (!recruiterId) return;
    let active = true;

    const loadJobs = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const data = await fetchAccessibleJobs(recruiterId, {
          location: filters.location,
          company: filters.company,
          search: filters.search,
          limit: PAGE_SIZE,
          offset,
        });
        if (!active) return;
        setJobs(Array.isArray(data.jobs) ? data.jobs : []);
        setTotal(Number(data.total) || 0);
      } catch (error) {
        if (!active) return;
        setErrorMessage(error.message || "Failed to fetch jobs.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadJobs();
    return () => {
      active = false;
    };
  }, [recruiterId, filters.location, filters.company, filters.search, offset]);

  const openSubmitModal = (jobId) => {
    setActiveJobId(jobId);
    setIsSubmitModalOpen(true);
  };

  const closeSubmitModal = () => {
    setIsSubmitModalOpen(false);
    setActiveJobId(null);
  };

  return (
    <section className="recruiter-jobs-board">
      <div className="recruiter-jobs-board-head">
        <h2>Available Jobs</h2>
        <p>
          Showing {jobs.length} of {total} accessible jobs.
        </p>
      </div>

      <SearchFilters filters={filters} onFilterChange={setFilters} />

      {loading ? <p className="chart-empty">Loading jobs...</p> : null}
      {errorMessage ? <p className="job-message job-message-error">{errorMessage}</p> : null}

      {!loading && !errorMessage && jobs.length === 0 ? (
        <p className="chart-empty">No jobs available matching your criteria.</p>
      ) : null}

      {!loading && jobs.length > 0 ? (
        <div className="recruiter-jobs-grid">
          {jobs.map((job) => (
            <JobCard key={job.jid} job={job} onSubmitResume={openSubmitModal} />
          ))}
        </div>
      ) : null}

      {total > PAGE_SIZE ? (
        <div className="recruiter-pagination">
          <button
            type="button"
            className="btn-secondary"
            disabled={currentPage <= 1}
            onClick={() => setOffset((prev) => Math.max(prev - PAGE_SIZE, 0))}
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            className="btn-secondary"
            disabled={currentPage >= totalPages}
            onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
          >
            Next
          </button>
        </div>
      ) : null}

      <ResumeSubmissionModal
        recruiterId={recruiterId}
        jobId={activeJobId}
        isOpen={isSubmitModalOpen}
        onClose={closeSubmitModal}
        onSuccess={onResumeSubmitted}
      />
    </section>
  );
}
