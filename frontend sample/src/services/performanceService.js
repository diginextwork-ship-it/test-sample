import { getAuthToken } from "../auth/session";
import { API_BASE_URL } from "../config/api";

const readJsonResponse = async (response) => {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Server returned non-JSON response (${response.status}).`);
  }
};

const withAuthHeaders = (extra = {}) => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}`, ...extra } : extra;
};

const request = async (url, options = {}, fallbackMessage = "Request failed.") => {
  const response = await fetch(url, {
    ...options,
    headers: withAuthHeaders(options.headers || {}),
  });
  const data = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(data?.error || data?.message || fallbackMessage);
  }
  return data;
};

export const fetchRecruiterStatus = (rid) =>
  request(`${API_BASE_URL}/api/status/recruiter/${encodeURIComponent(rid)}`, {}, "Failed to fetch recruiter stats.");

export const fetchAllRecruiterStatuses = ({ sortBy = "submitted", sortOrder = "desc", search = "" } = {}) => {
  const params = new URLSearchParams();
  params.set("sortBy", sortBy);
  params.set("sortOrder", sortOrder);
  if (String(search || "").trim()) params.set("search", String(search).trim());
  return request(
    `${API_BASE_URL}/api/status/all?${params.toString()}`,
    {},
    "Failed to fetch all recruiter stats."
  );
};

export const fetchTeamLeaderDashboard = () =>
  request(`${API_BASE_URL}/api/dashboard/team-leader`, {}, "Failed to fetch team leader dashboard.");

export const fetchRecruiterDashboard = (rid, { startDate = "", endDate = "" } = {}) => {
  const params = new URLSearchParams();
  if (String(startDate || "").trim()) params.set("startDate", String(startDate).trim());
  if (String(endDate || "").trim()) params.set("endDate", String(endDate).trim());
  const query = params.toString();

  return request(
    `${API_BASE_URL}/api/dashboard/recruiter/${encodeURIComponent(rid)}${query ? `?${query}` : ""}`,
    {},
    "Failed to fetch recruiter dashboard."
  );
};

export const fetchJobResumeStatuses = (jobId) =>
  request(
    `${API_BASE_URL}/api/jobs/${encodeURIComponent(jobId)}/resume-statuses`,
    {},
    "Failed to fetch job resumes."
  );

export const updateJobResumeStatus = (jobId, payload) =>
  request(
    `${API_BASE_URL}/api/jobs/${encodeURIComponent(jobId)}/resume-statuses`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    },
    "Failed to update resume status."
  );
