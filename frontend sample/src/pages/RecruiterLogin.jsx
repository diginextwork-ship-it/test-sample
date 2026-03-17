import { useEffect, useState } from "react";
import "../styles/recruiter-login.css";
import {
  clearAuthSession,
  getAuthSession,
  saveAuthSession,
} from "../auth/session";
import { API_BASE_URL, BACKEND_CONNECTION_ERROR } from "../config/api";
import JobsListTable from "../components/JobAdder/JobsListTable";
import JobAccessControlModal from "../components/JobAdder/JobAccessControlModal";
import RecruiterMultiSelect from "../components/JobAdder/RecruiterMultiSelect";
import RecruiterJobsBoard from "../components/Recruiter/RecruiterJobsBoard";
import RecruiterDashboard from "../components/Recruiter/RecruiterDashboard";
import TeamLeaderDashboard from "../components/JobAdder/JobAdderDashboard";
import ReimbursementButton from "../components/ReimbursementButton";
import PasswordChangeModal from "../components/PasswordChangeModal";
import { fetchMyJobs, fetchRecruitersList } from "../services/jobAccessService";
import "../styles/recruiter-jobs-board.css";
import "../styles/performance-dashboard.css";
import "../styles/reimbursement.css";

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
      `Server returned non-JSON response (${response.status}) for ${response.url}. ${fallbackMessage}`,
    );
  }
};

const toUiJob = (job) => ({
  id: job.jid,
  recruiterRid: job.recruiter_rid || null,
  company: job.company_name || "Unknown company",
  title: job.role_name || "Untitled role",
  positionsOpen: Number(job.positions_open) || 1,
  revenue:
    job.revenue === null || job.revenue === undefined
      ? null
      : Number(job.revenue),
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
  accessMode:
    String(job.access_mode || "open")
      .trim()
      .toLowerCase() === "restricted"
      ? "restricted"
      : "open",
  recruiterCount: Number(job.recruiterCount) || 0,
});

const isTeamLeaderRole = (role) => {
  const normalized = String(role || "")
    .trim()
    .toLowerCase();
  return (
    normalized === "team leader" ||
    normalized === "team_leader" ||
    normalized === "job adder" ||
    normalized === "job_adder"
  );
};

export default function RecruiterLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [recruiter, setRecruiter] = useState(null);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [applications, setApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [activeAccessJobId, setActiveAccessJobId] = useState(null);
  const [availableRecruiters, setAvailableRecruiters] = useState([]);
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
    access_mode: "open",
    recruiterIds: [],
    accessNotes: "",
  });
  const [jobMessage, setJobMessage] = useState("");
  const [jobMessageType, setJobMessageType] = useState("");
  const [uploadedResumes, setUploadedResumes] = useState([]);
  const [jdFile, setJdFile] = useState(null);
  const [isParsingJD, setIsParsingJD] = useState(false);
  const [jdParseMessage, setJdParseMessage] = useState("");
  const [jdParseMessageType, setJdParseMessageType] = useState("");
  const normalizedRole = String(recruiter?.role || "")
    .trim()
    .toLowerCase();
  const canCreateJobs =
    normalizedRole === "job creator" ||
    isTeamLeaderRole(normalizedRole) ||
    Boolean(recruiter?.addjob);
  const canManageJobAccess = isTeamLeaderRole(normalizedRole);
  const canUploadResumes = normalizedRole === "recruiter";
  const getAuthHeaders = (extraHeaders = {}) => {
    const token = getAuthSession()?.token || "";
    return token
      ? { Authorization: `Bearer ${token}`, ...extraHeaders }
      : extraHeaders;
  };

  const fetchApplications = async (rid) => {
    setIsLoadingApplications(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/recruiters/${rid}/applications`,
        {
          headers: getAuthHeaders(),
        },
      );
      const data = await readJsonResponse(
        response,
        "Check VITE_API_BASE_URL and backend route setup.",
      );
      if (!response.ok) {
        throw new Error(
          data?.message || "Failed to fetch recruiter applications.",
        );
      }
      setApplications(
        Array.isArray(data.applications) ? data.applications : [],
      );
    } finally {
      setIsLoadingApplications(false);
    }
  };

  const fetchAllJobs = async () => {
    setIsLoadingJobs(true);
    try {
      const data = await fetchMyJobs();
      const allJobs = Array.isArray(data.jobs) ? data.jobs.map(toUiJob) : [];
      setJobs(allJobs);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const fetchAvailableRecruiters = async () => {
    const data = await fetchRecruitersList();
    setAvailableRecruiters(
      Array.isArray(data.recruiters) ? data.recruiters : [],
    );
  };

  const fetchRecruiterResumes = async (rid) => {
    const response = await fetch(
      `${API_BASE_URL}/api/recruiters/${rid}/resumes`,
      {
        headers: getAuthHeaders(),
      },
    );
    const data = await readJsonResponse(
      response,
      "Check VITE_API_BASE_URL and backend route setup.",
    );
    if (!response.ok) {
      throw new Error(data?.message || "Failed to fetch resumes.");
    }

    setUploadedResumes(Array.isArray(data.resumes) ? data.resumes : []);
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

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
        "Check VITE_API_BASE_URL and backend route setup.",
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

      // Show password change modal if this is first login (passwordChanged is false)
      if (data?.recruiter?.passwordChanged === false) {
        setShowPasswordChangeModal(true);
      }

      setEmail("");
      setPassword("");
    } catch (error) {
      if (error instanceof TypeError) {
        alert(BACKEND_CONNECTION_ERROR);
        return;
      }
      alert("Unable to login right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordChanged = () => {
    // Update the recruiter state to mark password as changed
    setRecruiter((prevRecruiter) => ({
      ...prevRecruiter,
      passwordChanged: true,
    }));
  };

  useEffect(() => {
    if (recruiter) return;
    const session = getAuthSession();
    if (!session) return;
    const sessionRole = String(session.role || "").toLowerCase();
    if (
      sessionRole === "recruiter" ||
      sessionRole === "job creator" ||
      isTeamLeaderRole(sessionRole)
    ) {
      setRecruiter({
        rid: session.rid,
        name: session.name || "Recruiter",
        role: session.role,
        addjob: sessionRole === "job creator" || isTeamLeaderRole(sessionRole),
      });
    }
  }, [recruiter]);

  useEffect(() => {
    if (!recruiter?.rid) return;

    const loadDashboard = async () => {
      try {
        const tasks = [fetchApplications(recruiter.rid)];
        if (canCreateJobs) {
          tasks.push(fetchAllJobs());
          if (canManageJobAccess) {
            tasks.push(fetchAvailableRecruiters());
          }
        }
        if (canUploadResumes) tasks.push(fetchRecruiterResumes(recruiter.rid));
        await Promise.all(tasks);
      } catch {
        // Dashboard sections fetch their own data; keep this page resilient if one list fails.
      }
    };

    loadDashboard();
  }, [recruiter?.rid, canCreateJobs, canManageJobAccess, canUploadResumes]);

  const handleJobInputChange = (event) => {
    const { name, value } = event.target;
    setJobData((prev) => ({ ...prev, [name]: value }));
  };

  const handleJDFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setJdFile(selectedFile);
      setJdParseMessage("");
      setJdParseMessageType("");
    }
  };

  const handleJDUploadAndParse = async () => {
    if (!jdFile) {
      setJdParseMessageType("error");
      setJdParseMessage("Please select a JD file first.");
      return;
    }

    setIsParsingJD(true);
    setJdParseMessage("");
    setJdParseMessageType("");

    try {
      const formData = new FormData();
      formData.append("jdFile", jdFile);

      const response = await fetch(`${API_BASE_URL}/api/jd/upload`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      const data = await readJsonResponse(
        response,
        "Failed to parse JD file. Check backend connection.",
      );

      if (!response.ok) {
        throw new Error(data?.error || "Failed to parse JD file.");
      }

      const parsed = data.data;
      setJobData((prev) => ({
        ...prev,
        company_name: parsed.company_name || prev.company_name,
        role_name: parsed.role_name || prev.role_name,
        city: parsed.city || prev.city,
        state: parsed.state || prev.state,
        pincode:
          parsed.pincode && parsed.pincode !== "000000"
            ? parsed.pincode
            : prev.pincode,
        positions_open: parsed.positions_open || prev.positions_open,
        skills: parsed.skills || prev.skills,
        job_description: parsed.job_description || prev.job_description,
        experience: parsed.experience || prev.experience,
        salary: parsed.salary || prev.salary,
        qualification: parsed.qualification || prev.qualification,
        benefits: parsed.benefits || prev.benefits,
      }));

      setJdParseMessageType("success");
      setJdParseMessage(
        "JD parsed successfully! Fields have been auto-filled. Review and adjust before submitting.",
      );
    } catch (error) {
      if (error instanceof TypeError) {
        setJdParseMessageType("error");
        setJdParseMessage(BACKEND_CONNECTION_ERROR);
        return;
      }
      setJdParseMessageType("error");
      setJdParseMessage(error.message || "Failed to parse JD file.");
    } finally {
      setIsParsingJD(false);
    }
  };

  const handleCreateJobRecruiterSelectionChange = (recruiterIds) => {
    setJobData((prev) => ({ ...prev, recruiterIds }));
  };

  const handleOpenAccessModal = (jobId) => {
    setActiveAccessJobId(jobId);
    setIsAccessModalOpen(true);
  };

  const handleCloseAccessModal = () => {
    setIsAccessModalOpen(false);
    setActiveAccessJobId(null);
  };

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
        body: JSON.stringify({
          ...jobData,
          recruiter_rid: recruiter.rid,
          recruiterIds:
            jobData.access_mode === "restricted" ? jobData.recruiterIds : [],
          accessNotes:
            jobData.access_mode === "restricted" ? jobData.accessNotes : "",
        }),
      });

      const data = await readJsonResponse(
        response,
        "Check VITE_API_BASE_URL and backend route setup.",
      );

      if (!response.ok) {
        throw new Error(data?.message || "Failed to create job.");
      }

      setJobMessageType(data?.warning ? "error" : "success");
      setJobMessage(
        data?.warning
          ? `Job created (JID: ${data.job.jid}). ${data.warning}`
          : `Job created successfully. Generated JID: ${data.job.jid}`,
      );
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
        access_mode: "open",
        recruiterIds: [],
        accessNotes: "",
      });
      try {
        await fetchAllJobs();
      } catch {
        // Keep create success visible even if list refresh fails on older schemas.
      }
    } catch (error) {
      if (error instanceof TypeError) {
        setJobMessageType("error");
        setJobMessage(BACKEND_CONNECTION_ERROR);
        return;
      }
      setJobMessageType("error");
      setJobMessage(error.message || "Failed to create job.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResumeSubmitted = async () => {
    if (!recruiter?.rid) return;
    await fetchRecruiterResumes(recruiter.rid);
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
      <main className="recruiter-login-page ui-page">
        <section className="recruiter-login-shell recruiter-job-shell ui-shell">
          <div className="recruiter-login-card recruiter-job-card">
            <h1>recruiter dashboard</h1>
            <p>
              Logged in as <strong>{recruiter.name}</strong>.
            </p>
            <button
              type="button"
              className="admin-back-btn"
              onClick={handleLogout}
            >
              Logout
            </button>

            <ReimbursementButton
              visible={canUploadResumes || canManageJobAccess}
            />

            {canUploadResumes ? (
              <RecruiterDashboard recruiterId={recruiter.rid} />
            ) : null}

            {canManageJobAccess ? (
              <TeamLeaderDashboard
                jobsManagementContent={
                  <>
                    <JobsListTable
                      jobs={jobs}
                      isLoading={isLoadingJobs}
                      onRefresh={fetchAllJobs}
                      onEditAccess={handleOpenAccessModal}
                      canEditAccess={canManageJobAccess}
                    />
                    <JobAccessControlModal
                      jobId={activeAccessJobId}
                      isOpen={isAccessModalOpen}
                      onClose={handleCloseAccessModal}
                      onSave={fetchAllJobs}
                    />
                  </>
                }
              />
            ) : null}

            {canCreateJobs && !canManageJobAccess ? (
              <>
                <JobsListTable
                  jobs={jobs}
                  isLoading={isLoadingJobs}
                  onRefresh={fetchAllJobs}
                  onEditAccess={handleOpenAccessModal}
                  canEditAccess={canManageJobAccess}
                />
                {canManageJobAccess ? (
                  <JobAccessControlModal
                    jobId={activeAccessJobId}
                    isOpen={isAccessModalOpen}
                    onClose={handleCloseAccessModal}
                    onSave={fetchAllJobs}
                  />
                ) : null}
              </>
            ) : null}

            <div className="chart-card ui-mt-md">
              <div className="ui-row-between ui-row-wrap">
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
                <div className="ui-table-wrap ui-mt-xs">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>Candidate</th>
                        <th>Email</th>
                        <th>Job ID</th>
                        <th>Job</th>
                        <th>ATS Score</th>
                        <th>ATS Match</th>
                        <th>Resume</th>
                        <th>Applied At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map((item) => (
                        <tr key={item.id}>
                          <td>{item.candidateName}</td>
                          <td>{item.email}</td>
                          <td>{item.jobJid ?? "N/A"}</td>
                          <td>
                            {item.job?.roleName} ({item.job?.companyName})
                          </td>
                          <td>
                            {item.atsScore === null
                              ? "N/A"
                              : `${item.atsScore}%`}
                          </td>
                          <td>
                            {item.atsMatchPercentage === null
                              ? "N/A"
                              : `${item.atsMatchPercentage}%`}
                          </td>
                          <td>{item.resumeFilename || "N/A"}</td>
                          <td>{formatDateTime(item.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {canUploadResumes ? (
              <div className="chart-card ui-mt-md">
                <RecruiterJobsBoard
                  recruiterId={recruiter.rid}
                  onResumeSubmitted={handleResumeSubmitted}
                />

                <div className="ui-table-wrap ui-mt-sm">
                  <h2 className="ui-title-sm">My uploaded resumes</h2>
                  {uploadedResumes.length === 0 ? (
                    <p className="chart-empty">No resumes uploaded yet.</p>
                  ) : (
                    <table className="ui-table">
                      <thead>
                        <tr>
                          <th>Resume ID</th>
                          <th>Job ID</th>
                          <th>Filename</th>
                          <th>Type</th>
                          <th>ATS Score</th>
                          <th>Submitted Note</th>
                          <th>Timing Info</th>
                          <th>Status</th>
                          <th>Uploaded At</th>
                          <th>File</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadedResumes.map((item) => (
                          <tr key={item.resId}>
                            <td>{item.resId}</td>
                            <td>{item.jobJid ?? "N/A"}</td>
                            <td>{item.resumeFilename}</td>
                            <td>
                              {String(item.resumeType || "").toUpperCase()}
                            </td>
                            <td>
                              {item.atsScore === null ||
                              item.atsScore === undefined
                                ? "N/A"
                                : `${item.atsScore}%`}
                            </td>
                            <td className="table-cell-wrap">
                              {item.submittedReason || "-"}
                            </td>
                            <td className="table-cell-wrap">
                              {item.verifiedReason || "-"}
                            </td>
                            <td>
                              {String(item.workflowStatus || "pending").replace(
                                /_/g,
                                " ",
                              )}
                            </td>
                            <td>{formatDateTime(item.uploadedAt)}</td>
                            <td>
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
                                    "noopener,noreferrer",
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

                <div className="jd-upload-section">
                  <h3 className="jd-upload-heading">
                    Auto-fill from Job Description
                  </h3>
                  <p className="jd-upload-hint">
                    Upload a JD file (PDF, DOCX, or TXT) and AI will extract job
                    details automatically.
                  </p>
                  <div className="jd-upload-row">
                    <label htmlFor="jdFileUpload" className="jd-file-label">
                      {jdFile ? jdFile.name : "Choose JD file..."}
                      <input
                        id="jdFileUpload"
                        type="file"
                        accept=".pdf,.docx,.txt"
                        onChange={handleJDFileChange}
                        className="jd-file-input"
                      />
                    </label>
                    <button
                      type="button"
                      className="click-here-btn jd-parse-btn"
                      onClick={handleJDUploadAndParse}
                      disabled={!jdFile || isParsingJD}
                    >
                      {isParsingJD ? "Parsing..." : "Parse & Auto-fill"}
                    </button>
                    {jdFile ? (
                      <button
                        type="button"
                        className="jd-clear-btn"
                        onClick={() => {
                          setJdFile(null);
                          setJdParseMessage("");
                          setJdParseMessageType("");
                          const fileInput =
                            document.getElementById("jdFileUpload");
                          if (fileInput) fileInput.value = "";
                        }}
                        aria-label="Clear selected file"
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                  {jdParseMessage ? (
                    <p
                      className={`job-message ${
                        jdParseMessageType === "success"
                          ? "job-message-success"
                          : "job-message-error"
                      }`}
                    >
                      {jdParseMessage}
                    </p>
                  ) : null}
                </div>
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
                    <label htmlFor="positions_open">
                      Number of Positions Open *
                    </label>
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
                    <label htmlFor="points_per_joining">
                      Points Per Joining *
                    </label>
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

                  {canManageJobAccess ? (
                    <div className="job-field">
                      <label htmlFor="access_mode">Access Mode *</label>
                      <select
                        id="access_mode"
                        name="access_mode"
                        value={jobData.access_mode}
                        onChange={handleJobInputChange}
                      >
                        <option value="open">Open (All Recruiters)</option>
                        <option value="restricted">
                          Restricted (Selected Recruiters Only)
                        </option>
                      </select>
                    </div>
                  ) : null}
                </div>

                {canManageJobAccess && jobData.access_mode === "restricted" ? (
                  <div className="job-field">
                    <label>Assign Recruiters</label>
                    <RecruiterMultiSelect
                      allRecruiters={availableRecruiters}
                      selectedRecruiters={jobData.recruiterIds}
                      onSelectionChange={
                        handleCreateJobRecruiterSelectionChange
                      }
                    />
                    <label htmlFor="accessNotes">
                      Assignment Notes (optional)
                    </label>
                    <textarea
                      id="accessNotes"
                      name="accessNotes"
                      value={jobData.accessNotes}
                      onChange={(event) =>
                        setJobData((prev) => ({
                          ...prev,
                          accessNotes: event.target.value,
                        }))
                      }
                      rows={2}
                    />
                    {jobData.recruiterIds.length === 0 ? (
                      <p className="job-message job-message-error">
                        Restricted jobs without assigned recruiters will not
                        receive submissions.
                      </p>
                    ) : null}
                  </div>
                ) : null}

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
                  <div className="job-form-grid ui-mt-sm">
                    <div className="job-field">
                      <label htmlFor="city">City</label>
                      <input
                        id="city"
                        name="city"
                        value={jobData.city}
                        onChange={handleJobInputChange}
                      />
                    </div>
                    <div className="job-field">
                      <label htmlFor="state">State</label>
                      <input
                        id="state"
                        name="state"
                        value={jobData.state}
                        onChange={handleJobInputChange}
                      />
                    </div>
                    <div className="job-field">
                      <label htmlFor="pincode">Pincode</label>
                      <input
                        id="pincode"
                        name="pincode"
                        value={jobData.pincode}
                        onChange={handleJobInputChange}
                      />
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
                      <input
                        id="salary"
                        name="salary"
                        value={jobData.salary}
                        onChange={handleJobInputChange}
                      />
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

                <button
                  type="submit"
                  className="recruiter-login-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Create Job Alert"}
                </button>

                {jobMessage ? (
                  <p
                    className={`job-message ${
                      jobMessageType === "success"
                        ? "job-message-success"
                        : "job-message-error"
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
    <main className="recruiter-login-page ui-page">
      <section className="recruiter-login-shell ui-shell">
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
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
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
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
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

            <button
              type="submit"
              className="recruiter-login-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </section>

      {recruiter && (
        <PasswordChangeModal
          isOpen={showPasswordChangeModal}
          onClose={() => setShowPasswordChangeModal(false)}
          onPasswordChanged={handlePasswordChanged}
          recruiterName={recruiter.name}
          recruiterId={recruiter.rid}
        />
      )}
    </main>
  );
}
