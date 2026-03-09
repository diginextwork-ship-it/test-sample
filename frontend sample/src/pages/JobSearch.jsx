import { useEffect, useMemo, useState } from "react";
import "../styles/job-search.css";
import {
  BACKEND_CONNECTION_ERROR,
  buildApiUrl,
} from "../config/api";

const readJsonResponse = async (response, fallbackMessage) => {
  const rawBody = await response.text();
  if (!rawBody) return {};

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error(
      `Jobs API returned non-JSON response (${response.status}) from ${response.url}. ${fallbackMessage}`
    );
  }
};

const toUiJob = (job) => {
  const city = job.city?.trim() || "";
  const state = job.state?.trim() || "";
  const location = [city, state].filter(Boolean).join(", ") || "Location not specified";
  const skills = (job.skills || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    id: job.jid,
    recruiterRid: job.recruiter_rid || null,
    title: job.role_name || "Untitled role",
    company: job.company_name || "Unknown company",
    location,
    salary: job.salary || "Salary not specified",
    type: job.qualification || "Qualification not specified",
    experience: job.experience || "Experience not specified",
    description: job.job_description || "No description provided.",
    tags: skills,
    easyApply: false,
  };
};

export default function JobSearch({ setCurrentPage }) {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [experience, setExperience] = useState("");
  const [selectedJobId, setSelectedJobId] = useState(null);

  useEffect(() => {
    const fetchJobs = async () => {
      setIsLoading(true);
      setLoadError("");

      try {
        const jobsUrl = buildApiUrl("/api/jobs");
        const response = await fetch(jobsUrl, {
          headers: {
            Accept: "application/json",
          },
        });
        const data = await readJsonResponse(
          response,
          "Check VITE_API_BASE_URL and ensure backend is restarted with GET /api/jobs route."
        );

        if (!response.ok) {
          throw new Error(data?.message || "Failed to fetch jobs.");
        }

        const mappedJobs = (data.jobs || []).map(toUiJob);
        setJobs(mappedJobs);
        setSelectedJobId(mappedJobs[0]?.id ?? null);
      } catch (error) {
        if (error instanceof TypeError) {
          setLoadError(BACKEND_CONNECTION_ERROR);
        } else {
          setLoadError(error.message || "Unable to load jobs right now.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobs();
  }, []);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesQuery =
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.company.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLocation =
        !locationQuery ||
        job.location.toLowerCase().includes(locationQuery.toLowerCase());
      const matchesExperience = !experience || job.experience === experience;
      return matchesQuery && matchesLocation && matchesExperience;
    });
  }, [jobs, searchQuery, locationQuery, experience]);

  useEffect(() => {
    if (!filteredJobs.length) return;
    const exists = filteredJobs.some((job) => job.id === selectedJobId);
    if (!exists) {
      setSelectedJobId(filteredJobs[0].id);
    }
  }, [filteredJobs, selectedJobId]);

  const selectedJob =
    filteredJobs.find((job) => job.id === selectedJobId) || filteredJobs[0];

  const handleApplyNow = () => {
    if (selectedJob) {
      sessionStorage.setItem("selectedJob", JSON.stringify(selectedJob));
    }
    setCurrentPage("applyjob");
  };

  return (
    <main className="job-search-page ui-page">
      <section className="job-search-shell ui-shell">
        <div className="job-search-topbar">
          <div className="search-field">
            <span className="search-icon" aria-hidden="true">
              o
            </span>
            <input
              type="text"
              placeholder="Job title, keywords, or company"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="search-divider" />
          <div className="search-field">
            <span className="search-icon" aria-hidden="true">
              *
            </span>
            <input
              type="text"
              placeholder='City, state, zip code, or "remote"'
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
            />
          </div>
          <div className="search-divider" />
          <div className="search-field search-field-select">
            <span className="search-icon" aria-hidden="true">
              exp
            </span>
            <select
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              aria-label="Filter by experience"
            >
              <option value="">Experience</option>
              <option value="Internship">Internship</option>
              <option value="0-2 years">0-2 years</option>
              <option value="3-5 years">3-5 years</option>
              <option value="5-7+ years">5-7+ years</option>
            </select>
          </div>
          <button className="job-search-btn ui-btn-primary">Find jobs</button>
        </div>

        <div className="job-results-layout">
          <section className="job-list-column">
            <h1>Jobs for you</h1>
            <p className="results-subtitle">
              Open positions based on your search
            </p>

            {isLoading ? (
              <div className="empty-results">
                <p>Loading jobs...</p>
              </div>
            ) : loadError ? (
              <div className="empty-results">
                <p>{loadError}</p>
              </div>
            ) : filteredJobs.length ? (
              <div className="job-cards">
                {filteredJobs.map((job) => (
                  <article
                    key={job.id}
                    className={`job-list-card ${
                      selectedJobId === job.id ? "active" : ""
                    }`}
                    onClick={() => setSelectedJobId(job.id)}
                  >
                    <h3>{job.title}</h3>
                    <p className="job-company">{job.company}</p>
                    <p className="job-location">{job.location}</p>

                    <div className="job-tags">
                      <span>{job.salary}</span>
                      <span>{job.type}</span>
                      <span>{job.experience}</span>
                      {job.tags.slice(0, 3).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>

                    {job.easyApply ? (
                      <p className="easy-apply">Quick apply available</p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-results">
                <p>No jobs match your current search. Try broader keywords.</p>
              </div>
            )}
          </section>

          <aside className="job-detail-column">
            {selectedJob ? (
              <div className="job-detail-card">
                <h2>{selectedJob.title}</h2>
                <p className="job-detail-company">{selectedJob.company}</p>
                <p>{selectedJob.location}</p>
                <p className="job-detail-salary">{selectedJob.salary}</p>
                <p className="job-detail-description">{selectedJob.description}</p>

                <div className="job-detail-actions">
                  <button className="apply-btn ui-btn-primary" onClick={handleApplyNow}>Apply now</button>
                </div>
              </div>
            ) : (
              <div className="job-detail-card">
                <h2>No job selected</h2>
                <p>Pick a role from the list to see full details.</p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

