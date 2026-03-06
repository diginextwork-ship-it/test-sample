import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "../styles/recruiter-login.css";
import { clearAuthSession, getAuthSession, saveAuthSession } from "../auth/session";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const formatTrendDate = (dateValue) => {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue);
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
};

const formatDateTime = (dateValue) => {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue);
  return date.toLocaleString();
};

const readJsonResponse = async (response, fallbackMessage) => {
  const rawBody = await response.text();
  if (!rawBody) return {};

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error(
      `Server returned non-JSON response (${response.status}) for ${response.url}. ${fallbackMessage}`
    );
  }
};

const toUiJob = (job) => ({
  id: job.jid,
  recruiterRid: job.recruiter_rid || null,
  company: job.company_name || "Unknown company",
  title: job.role_name || "Untitled role",
  positionsOpen: Number(job.positions_open) || 1,
  revenue: job.revenue === null || job.revenue === undefined ? null : Number(job.revenue),
  pointsPerJoining: Number(job.points_per_joining) || 0,
  createdAt: job.created_at || null,
  city: job.city || "",
  state: job.state || "",
  pincode: job.pincode || "",
  skills: job.skills || "",
  description: job.job_description || "",
  experience: job.experience || "",
  salary: job.salary || "",
  qualification: job.qualification || "",
  benefits: job.benefits || "",
});

export default function RecruiterLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingCounter, setIsUpdatingCounter] = useState(false);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [recruiter, setRecruiter] = useState(null);
  const [dashboard, setDashboard] = useState({
    summary: { success: 0, points: 0, thisMonth: 0 },
    monthlyTrend: [],
  });
  const [applications, setApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [dashboardMessage, setDashboardMessage] = useState("");
  const [dashboardMessageType, setDashboardMessageType] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [jobData, setJobData] = useState({
    city: "",
    state: "",
    pincode: "",
    company_name: "",
    role_name: "",
    positions_open: 1,
    revenue: "",
    points_per_joining: 0,
    skills: "",
    job_description: "",
    experience: "",
    salary: "",
    qualification: "",
    benefits: "",
  });
  const [jobMessage, setJobMessage] = useState("");
  const [jobMessageType, setJobMessageType] = useState("");
  const [uploadedResumes, setUploadedResumes] = useState([]);
  const [resumeData, setResumeData] = useState({
    job_jid: "",
    file: null,
  });
  const [isSubmittingResume, setIsSubmittingResume] = useState(false);
  const [resumeMessage, setResumeMessage] = useState("");
  const [resumeMessageType, setResumeMessageType] = useState("");
  const normalizedRole = String(recruiter?.role || "").trim().toLowerCase();
  const canCreateJobs =
    normalizedRole === "job creator" ||
    normalizedRole === "job adder" ||
    Boolean(recruiter?.addjob);
  const canUploadResumes = normalizedRole === "recruiter";
  const showRecruiterPerformance = normalizedRole === "recruiter";
  const getAuthHeaders = (extraHeaders = {}) => {
    const token = getAuthSession()?.token || "";
    return token ? { Authorization: `Bearer ${token}`, ...extraHeaders } : extraHeaders;
  };

  const fetchRecruiterDashboard = async (rid) => {
    const response = await fetch(`${API_BASE_URL}/api/recruiters/${rid}/dashboard`, {
      headers: getAuthHeaders(),
    });
    const data = await readJsonResponse(
      response,
      "Check VITE_API_BASE_URL and backend route setup."
    );
    if (!response.ok) {
      throw new Error(data?.message || "Failed to fetch recruiter dashboard.");
    }
    setDashboard({
      summary: data.summary || { success: 0, points: 0, thisMonth: 0 },
      monthlyTrend: Array.isArray(data.monthlyTrend) ? data.monthlyTrend : [],
    });
  };

  const fetchApplications = async (rid) => {
    setIsLoadingApplications(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/recruiters/${rid}/applications`, {
        headers: getAuthHeaders(),
      });
      const data = await readJsonResponse(
        response,
        "Check VITE_API_BASE_URL and backend route setup."
      );
      if (!response.ok) {
        throw new Error(data?.message || "Failed to fetch recruiter applications.");
      }
      setApplications(Array.isArray(data.applications) ? data.applications : []);
    } finally {
      setIsLoadingApplications(false);
    }
  };

  const fetchAllJobs = async () => {
    setIsLoadingJobs(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/jobs`);
      const data = await readJsonResponse(
        response,
        "Check VITE_API_BASE_URL and backend route setup."
      );
      if (!response.ok) {
        throw new Error(data?.message || "Failed to fetch jobs.");
      }

      const allJobs = Array.isArray(data.jobs) ? data.jobs.map(toUiJob) : [];
      setJobs(allJobs);
      if (allJobs.length > 0 && !allJobs.some((job) => job.id === expandedJobId)) {
        setExpandedJobId(allJobs[0].id);
      }
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const fetchRecruiterResumes = async (rid) => {
    const response = await fetch(`${API_BASE_URL}/api/recruiters/${rid}/resumes`, {
      headers: getAuthHeaders(),
    });
    const data = await readJsonResponse(
      response,
      "Check VITE_API_BASE_URL and backend route setup."
    );
    if (!response.ok) {
      throw new Error(data?.message || "Failed to fetch resumes.");
    }

    setUploadedResumes(Array.isArray(data.resumes) ? data.resumes : []);
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setDashboardMessage("");
    setDashboardMessageType("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/recruiters/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await readJsonResponse(
        response,
        "Check VITE_API_BASE_URL and backend route setup."
      );

      if (!response.ok) {
        alert(data?.message || "Invalid credentials");
        return;
      }

      setRecruiter(data.recruiter);
      saveAuthSession({
        token: data.token,
        role: data?.recruiter?.role || "recruiter",
        rid: data?.recruiter?.rid,
        name: data?.recruiter?.name,
      });
      setEmail("");
      setPassword("");
    } catch (error) {
      if (error instanceof TypeError) {
        alert("Cannot connect to backend. Ensure API is running on port 5000.");
        return;
      }
      alert("Unable to login right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (recruiter) return;
    const session = getAuthSession();
    if (!session) return;
    const sessionRole = String(session.role || "").toLowerCase();
    if (sessionRole === "recruiter" || sessionRole === "job creator" || sessionRole === "job adder") {
      setRecruiter({
        rid: session.rid,
        name: session.name || "Recruiter",
        role: session.role,
        addjob: sessionRole === "job creator" || sessionRole === "job adder",
      });
    }
  }, [recruiter]);

  useEffect(() => {
    if (!recruiter?.rid) return;

    const loadDashboard = async () => {
      try {
        const tasks = [fetchApplications(recruiter.rid)];
        if (showRecruiterPerformance) tasks.push(fetchRecruiterDashboard(recruiter.rid));
        if (canCreateJobs) tasks.push(fetchAllJobs());
        if (canUploadResumes) tasks.push(fetchRecruiterResumes(recruiter.rid));
        await Promise.all(tasks);
      } catch (error) {
        setDashboardMessageType("error");
        setDashboardMessage(error.message || "Failed to load recruiter dashboard.");
      }
    };

    loadDashboard();
  }, [recruiter?.rid, canCreateJobs, canUploadResumes, showRecruiterPerformance]);

  const recruiterTrendData = useMemo(
    () =>
      dashboard.monthlyTrend.map((entry) => ({
        date: formatTrendDate(entry.date),
        clicks: Number(entry.clicks) || 0,
      })),
    [dashboard.monthlyTrend]
  );

  const handleCompleteCandidate = async () => {
    if (!recruiter?.rid) return;
    setIsUpdatingCounter(true);
    setDashboardMessage("");
    setDashboardMessageType("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/recruiters/${recruiter.rid}/candidate-click`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ candidateName }),
        }
      );
      const data = await readJsonResponse(
        response,
        "Check VITE_API_BASE_URL and backend route setup."
      );
      if (!response.ok) {
        throw new Error(data?.message || "Failed to update completion count.");
      }

      setDashboard((prev) => ({
        ...prev,
        summary: data.summary || prev.summary,
      }));
      setCandidateName("");
      await fetchRecruiterDashboard(recruiter.rid);
      setDashboardMessageType("success");
      setDashboardMessage("Candidate completion updated.");
    } catch (error) {
      if (error instanceof TypeError) {
        setDashboardMessageType("error");
        setDashboardMessage("Cannot connect to backend. Ensure API is running on port 5000.");
        return;
      }
      setDashboardMessageType("error");
      setDashboardMessage(error.message || "Failed to update completion count.");
    } finally {
      setIsUpdatingCounter(false);
    }
  };

  const handleJobInputChange = (event) => {
    const { name, value } = event.target;
    setJobData((prev) => ({ ...prev, [name]: value }));
  };

  const handleResumeInputChange = (event) => {
    const { name, value, files } = event.target;

    if (name === "file") {
      const file = files?.[0] || null;
      if (!file) {
        setResumeData((prev) => ({ ...prev, file: null }));
        return;
      }

      const allowedExtensions = /\.(pdf|doc|docx)$/i;
      if (!allowedExtensions.test(file.name)) {
        setResumeMessageType("error");
        setResumeMessage("Only PDF, DOC, or DOCX files are allowed.");
        event.target.value = "";
        setResumeData((prev) => ({ ...prev, file: null }));
        return;
      }

      setResumeData((prev) => ({ ...prev, file }));
      return;
    }

    setResumeData((prev) => ({ ...prev, [name]: value }));
  };

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsDataURL(file);
    });

  const handleJobSubmit = async (event) => {
    event.preventDefault();
    if (!recruiter?.rid) return;

    setIsSubmitting(true);
    setJobMessage("");
    setJobMessageType("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ ...jobData, recruiter_rid: recruiter.rid }),
      });

      const data = await readJsonResponse(
        response,
        "Check VITE_API_BASE_URL and backend route setup."
      );

      if (!response.ok) {
        throw new Error(data?.message || "Failed to create job.");
      }

      setJobMessageType("success");
      setJobMessage(`Job created successfully. Generated JID: ${data.job.jid}`);
      setJobData({
        city: "",
        state: "",
        pincode: "",
        company_name: "",
        role_name: "",
        positions_open: 1,
        revenue: "",
        points_per_joining: 0,
        skills: "",
        job_description: "",
        experience: "",
        salary: "",
        qualification: "",
        benefits: "",
      });
      try {
        await fetchAllJobs();
      } catch {
        // Keep create success visible even if list refresh fails on older schemas.
      }
    } catch (error) {
      if (error instanceof TypeError) {
        setJobMessageType("error");
        setJobMessage("Cannot connect to backend. Ensure API is running on port 5000.");
        return;
      }
      setJobMessageType("error");
      setJobMessage(error.message || "Failed to create job.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResumeSubmit = async (event) => {
    event.preventDefault();
    if (!recruiter?.rid || !canUploadResumes) return;
    if (!resumeData.file) {
      setResumeMessageType("error");
      setResumeMessage("Please select a resume file.");
      return;
    }

    setIsSubmittingResume(true);
    setResumeMessage("");
    setResumeMessageType("");

    try {
      const resumeBase64 = await fileToDataUrl(resumeData.file);
      const response = await fetch(`${API_BASE_URL}/api/recruiters/${recruiter.rid}/resumes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          job_jid: Number(resumeData.job_jid),
          resumeBase64,
          resumeFilename: resumeData.file.name,
          resumeMimeType: resumeData.file.type,
        }),
      });

      const data = await readJsonResponse(
        response,
        "Check VITE_API_BASE_URL and backend route setup."
      );

      if (!response.ok) {
        throw new Error(data?.message || "Failed to add resume.");
      }

      setResumeMessageType("success");
      setResumeMessage(`Resume added successfully. Generated ID: ${data.resume.resId}`);
      setResumeData({ job_jid: "", file: null });
      await fetchRecruiterResumes(recruiter.rid);
    } catch (error) {
      if (error instanceof TypeError) {
        setResumeMessageType("error");
        setResumeMessage("Cannot connect to backend. Ensure API is running on port 5000.");
        return;
      }
      setResumeMessageType("error");
      setResumeMessage(error.message || "Failed to add resume.");
    } finally {
      setIsSubmittingResume(false);
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    setRecruiter(null);
    setApplications([]);
    setJobs([]);
    setUploadedResumes([]);
  };

  if (recruiter) {
    return (
      <main className="recruiter-login-page">
        <section className="recruiter-login-shell recruiter-job-shell">
          <div className="recruiter-login-card recruiter-job-card">
            <h1>recruiter dashboard</h1>
            <p>
              Logged in as <strong>{recruiter.name}</strong>.
            </p>
            <button type="button" className="admin-back-btn" onClick={handleLogout}>
              Logout
            </button>

            {showRecruiterPerformance ? (
              <>
                <div className="recruiter-dashboard-grid">
                  <div className="recruiter-stat-card">
                    <h2>Monthly completion</h2>
                    <p className="recruiter-stat-value">{dashboard.summary.thisMonth}</p>
                    <p className="recruiter-stat-caption">
                      Number of candidates you completed this month.
                    </p>
                  </div>

                  <div className="recruiter-stat-card">
                    <h2>Total success</h2>
                    <p className="recruiter-stat-value">{dashboard.summary.success}</p>
                    <p className="recruiter-stat-caption">Stored in recruiter.success.</p>
                  </div>

                  <div className="recruiter-stat-card">
                    <h2>Total points</h2>
                    <p className="recruiter-stat-value">{dashboard.summary.points}</p>
                    <p className="recruiter-stat-caption">Awarded when admin marks resumes accepted.</p>
                  </div>
                </div>

                <div className="candidate-click-panel">
                  <label htmlFor="candidateName">Candidate Name (optional)</label>
                  <input
                    id="candidateName"
                    type="text"
                    value={candidateName}
                    onChange={(event) => setCandidateName(event.target.value)}
                    placeholder="Candidate name for performance chart"
                  />
                  <button
                    type="button"
                    className="click-here-btn"
                    onClick={handleCompleteCandidate}
                    disabled={isUpdatingCounter}
                  >
                    {isUpdatingCounter ? "Updating..." : "Click Here"}
                  </button>
                  {dashboardMessage ? (
                    <p
                      className={`job-message ${
                        dashboardMessageType === "success"
                          ? "job-message-success"
                          : "job-message-error"
                      }`}
                    >
                      {dashboardMessage}
                    </p>
                  ) : null}
                </div>

                <div className="chart-card">
                  <h2>Your candidate completions this month</h2>
                  {recruiterTrendData.length > 0 ? (
                    <div className="chart-wrap">
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={recruiterTrendData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="clicks"
                            stroke="#c62828"
                            strokeWidth={3}
                            dot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="chart-empty">No candidate completions recorded this month yet.</p>
                  )}
                </div>
              </>
            ) : null}

            {canCreateJobs ? (
              <div className="chart-card" style={{ marginTop: "16px" }}>
                <div className="jobs-header-row">
                  <h2>All jobs</h2>
                  <button
                    type="button"
                    className="click-here-btn"
                    onClick={fetchAllJobs}
                    disabled={isLoadingJobs}
                  >
                    {isLoadingJobs ? "Refreshing..." : "Refresh"}
                  </button>
                </div>

                {jobs.length === 0 ? (
                  <p className="chart-empty">{isLoadingJobs ? "Loading jobs..." : "No jobs found."}</p>
                ) : (
                  <div className="recruiter-job-list">
                    {jobs.map((job) => {
                      const isExpanded = expandedJobId === job.id;
                      return (
                        <article key={job.id} className="recruiter-job-item">
                          <button
                            type="button"
                            className="recruiter-job-item-head"
                            onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                          >
                            <span>Job ID: {job.id}</span>
                            <span>{job.company}</span>
                            <span>{job.title}</span>
                          </button>

                          {isExpanded ? (
                            <div className="recruiter-job-item-body">
                              <p>
                                <strong>Location:</strong>{" "}
                                {[job.city, job.state, job.pincode].filter(Boolean).join(", ") || "N/A"}
                              </p>
                              <p>
                                <strong>Experience:</strong> {job.experience || "N/A"}
                              </p>
                              <p>
                                <strong>Salary:</strong> {job.salary || "N/A"}
                              </p>
                              <p>
                                <strong>Qualification:</strong> {job.qualification || "N/A"}
                              </p>
                              <p>
                                <strong>Skills:</strong> {job.skills || "N/A"}
                              </p>
                              <p>
                                <strong>Description:</strong> {job.description || "N/A"}
                              </p>
                              <p>
                                <strong>Positions Open:</strong> {job.positionsOpen}
                              </p>
                              <p>
                                <strong>Estimated Revenue:</strong>{" "}
                                {job.revenue === null ? "N/A" : job.revenue}
                              </p>
                              <p>
                                <strong>Points Per Joining:</strong> {job.pointsPerJoining}
                              </p>
                              <p>
                                <strong>Benefits:</strong> {job.benefits || "N/A"}
                              </p>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            <div className="chart-card" style={{ marginTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                <h2>Applicants and ATS score</h2>
                <button
                  type="button"
                  className="click-here-btn"
                  onClick={() => fetchApplications(recruiter.rid)}
                  disabled={isLoadingApplications}
                >
                  {isLoadingApplications ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              {applications.length === 0 ? (
                <p className="chart-empty">
                  {isLoadingApplications
                    ? "Loading applications..."
                    : "No applications found yet for your jobs."}
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "8px" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "8px" }}>Candidate</th>
                        <th style={{ textAlign: "left", padding: "8px" }}>Email</th>
                        <th style={{ textAlign: "left", padding: "8px" }}>Job ID</th>
                        <th style={{ textAlign: "left", padding: "8px" }}>Job</th>
                        <th style={{ textAlign: "left", padding: "8px" }}>ATS Score</th>
                        <th style={{ textAlign: "left", padding: "8px" }}>ATS Match</th>
                        <th style={{ textAlign: "left", padding: "8px" }}>Resume</th>
                        <th style={{ textAlign: "left", padding: "8px" }}>Applied At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map((item) => (
                        <tr key={item.id}>
                          <td style={{ padding: "8px" }}>{item.candidateName}</td>
                          <td style={{ padding: "8px" }}>{item.email}</td>
                          <td style={{ padding: "8px" }}>{item.jobJid ?? "N/A"}</td>
                          <td style={{ padding: "8px" }}>
                            {item.job?.roleName} ({item.job?.companyName})
                          </td>
                          <td style={{ padding: "8px" }}>
                            {item.atsScore === null ? "N/A" : `${item.atsScore}%`}
                          </td>
                          <td style={{ padding: "8px" }}>
                            {item.atsMatchPercentage === null
                              ? "N/A"
                              : `${item.atsMatchPercentage}%`}
                          </td>
                          <td style={{ padding: "8px" }}>{item.resumeFilename || "N/A"}</td>
                          <td style={{ padding: "8px" }}>{formatDateTime(item.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {canUploadResumes ? (
              <div className="chart-card" style={{ marginTop: "16px" }}>
                <form onSubmit={handleResumeSubmit} className="job-form">
                  <h2 className="add-job-title">add resume</h2>
                  <p className="recruiter-stat-caption">
                    Enter Job ID and upload resume (PDF, DOC, DOCX).
                  </p>

                  <div className="job-form-grid">
                    <div className="job-field">
                      <label htmlFor="resume_job_jid">Job ID *</label>
                      <input
                        id="resume_job_jid"
                        name="job_jid"
                        type="number"
                        min="1"
                        value={resumeData.job_jid}
                        onChange={handleResumeInputChange}
                        required
                      />
                    </div>

                    <div className="job-field">
                      <label htmlFor="resume_file">Resume File *</label>
                      <input
                        id="resume_file"
                        name="file"
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleResumeInputChange}
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" className="recruiter-login-btn" disabled={isSubmittingResume}>
                    {isSubmittingResume ? "Uploading..." : "Add Resume"}
                  </button>

                  {resumeMessage ? (
                    <p
                      className={`job-message ${
                        resumeMessageType === "success" ? "job-message-success" : "job-message-error"
                      }`}
                    >
                      {resumeMessage}
                    </p>
                  ) : null}
                </form>

                <div style={{ marginTop: "12px", overflowX: "auto" }}>
                  <h2 style={{ marginBottom: "8px" }}>My uploaded resumes</h2>
                  {uploadedResumes.length === 0 ? (
                    <p className="chart-empty">No resumes uploaded yet.</p>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "8px" }}>Resume ID</th>
                          <th style={{ textAlign: "left", padding: "8px" }}>Job ID</th>
                          <th style={{ textAlign: "left", padding: "8px" }}>Filename</th>
                          <th style={{ textAlign: "left", padding: "8px" }}>Type</th>
                          <th style={{ textAlign: "left", padding: "8px" }}>ATS Score</th>
                          <th style={{ textAlign: "left", padding: "8px" }}>Uploaded At</th>
                          <th style={{ textAlign: "left", padding: "8px" }}>File</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadedResumes.map((item) => (
                          <tr key={item.resId}>
                            <td style={{ padding: "8px" }}>{item.resId}</td>
                            <td style={{ padding: "8px" }}>{item.jobJid ?? "N/A"}</td>
                            <td style={{ padding: "8px" }}>{item.resumeFilename}</td>
                            <td style={{ padding: "8px" }}>{String(item.resumeType || "").toUpperCase()}</td>
                            <td style={{ padding: "8px" }}>
                              {item.atsScore === null || item.atsScore === undefined
                                ? "N/A"
                                : `${item.atsScore}%`}
                            </td>
                            <td style={{ padding: "8px" }}>{formatDateTime(item.uploadedAt)}</td>
                            <td style={{ padding: "8px" }}>
                              <a
                                href={`${API_BASE_URL}/api/recruiters/${recruiter.rid}/resumes/${item.resId}/file`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(event) => {
                                  event.preventDefault();
                                  const token = getAuthSession()?.token;
                                  if (!token) return;
                                  window.open(
                                    `${API_BASE_URL}/api/recruiters/${recruiter.rid}/resumes/${item.resId}/file?token=${encodeURIComponent(token)}`,
                                    "_blank",
                                    "noopener,noreferrer"
                                  );
                                }}
                              >
                                View
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : null}
            {canCreateJobs ? (
              <form onSubmit={handleJobSubmit} className="job-form">
                <h2 className="add-job-title">create job alert</h2>
                <div className="job-form-grid">
                  <div className="job-field">
                    <label htmlFor="company_name">Company Name *</label>
                    <input
                      id="company_name"
                      name="company_name"
                      value={jobData.company_name}
                      onChange={handleJobInputChange}
                      required
                    />
                  </div>

                  <div className="job-field">
                    <label htmlFor="role_name">Job Title *</label>
                    <input
                      id="role_name"
                      name="role_name"
                      value={jobData.role_name}
                      onChange={handleJobInputChange}
                      required
                    />
                  </div>

                  <div className="job-field">
                    <label htmlFor="positions_open">Number of Positions Open *</label>
                    <input
                      id="positions_open"
                      name="positions_open"
                      type="number"
                      min="1"
                      value={jobData.positions_open}
                      onChange={handleJobInputChange}
                      required
                    />
                  </div>

                  <div className="job-field">
                    <label htmlFor="revenue">Estimated Revenue *</label>
                    <input
                      id="revenue"
                      name="revenue"
                      type="number"
                      min="0"
                      step="0.01"
                      value={jobData.revenue}
                      onChange={handleJobInputChange}
                      required
                    />
                  </div>

                  <div className="job-field">
                    <label htmlFor="points_per_joining">Points Per Joining *</label>
                    <input
                      id="points_per_joining"
                      name="points_per_joining"
                      type="number"
                      min="0"
                      step="1"
                      value={jobData.points_per_joining}
                      onChange={handleJobInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="job-field">
                  <label htmlFor="job_description">Job Description *</label>
                  <textarea
                    id="job_description"
                    name="job_description"
                    value={jobData.job_description}
                    onChange={handleJobInputChange}
                    rows={4}
                    required
                  />
                </div>

                <details className="job-field">
                  <summary>Optional fields</summary>
                  <div className="job-form-grid" style={{ marginTop: "10px" }}>
                    <div className="job-field">
                      <label htmlFor="city">City</label>
                      <input id="city" name="city" value={jobData.city} onChange={handleJobInputChange} />
                    </div>
                    <div className="job-field">
                      <label htmlFor="state">State</label>
                      <input id="state" name="state" value={jobData.state} onChange={handleJobInputChange} />
                    </div>
                    <div className="job-field">
                      <label htmlFor="pincode">Pincode</label>
                      <input id="pincode" name="pincode" value={jobData.pincode} onChange={handleJobInputChange} />
                    </div>
                    <div className="job-field">
                      <label htmlFor="experience">Experience</label>
                      <input
                        id="experience"
                        name="experience"
                        value={jobData.experience}
                        onChange={handleJobInputChange}
                      />
                    </div>
                    <div className="job-field">
                      <label htmlFor="salary">Salary</label>
                      <input id="salary" name="salary" value={jobData.salary} onChange={handleJobInputChange} />
                    </div>
                    <div className="job-field">
                      <label htmlFor="qualification">Qualification</label>
                      <input
                        id="qualification"
                        name="qualification"
                        value={jobData.qualification}
                        onChange={handleJobInputChange}
                      />
                    </div>
                  </div>
                  <div className="job-field">
                    <label htmlFor="skills">Skills</label>
                    <textarea
                      id="skills"
                      name="skills"
                      value={jobData.skills}
                      onChange={handleJobInputChange}
                      rows={3}
                    />
                  </div>
                  <div className="job-field">
                    <label htmlFor="benefits">Benefits</label>
                    <textarea
                      id="benefits"
                      name="benefits"
                      value={jobData.benefits}
                      onChange={handleJobInputChange}
                      rows={3}
                    />
                  </div>
                </details>

                <button type="submit" className="recruiter-login-btn" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Create Job Alert"}
                </button>

                {jobMessage ? (
                  <p
                    className={`job-message ${
                      jobMessageType === "success" ? "job-message-success" : "job-message-error"
                    }`}
                  >
                    {jobMessage}
                  </p>
                ) : null}
              </form>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="recruiter-login-page">
      <section className="recruiter-login-shell">
        <div className="recruiter-login-card">
          <h1>recruiter login</h1>
          <p>Sign in to manage openings and candidate pipelines.</p>

          <form onSubmit={handleLoginSubmit}>
            <label htmlFor="recruiterEmail">Email</label>
            <input
              id="recruiterEmail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              required
            />

            <label htmlFor="recruiterPassword">Password</label>
            <div className="password-input-wrap">
              <input
                id="recruiterPassword"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path
                      d="M3 3l18 18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M10.58 10.58a2 2 0 1 0 2.83 2.83"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9.88 5.08A10.9 10.9 0 0 1 12 4.9c5.25 0 8.85 3.97 10 7.1a12.64 12.64 0 0 1-3.12 4.49M6.6 6.6A13.4 13.4 0 0 0 2 12c1.15 3.13 4.75 7.1 10 7.1 1.87 0 3.5-.5 4.94-1.27"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path
                      d="M2 12s3.6-7.1 10-7.1S22 12 22 12s-3.6 7.1-10 7.1S2 12 2 12z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                  </svg>
                )}
              </button>
            </div>

            <button type="submit" className="recruiter-login-btn" disabled={isSubmitting}>
              {isSubmitting ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

