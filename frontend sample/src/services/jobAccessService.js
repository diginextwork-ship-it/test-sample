import { getAuthToken } from "../auth/session";
import { API_BASE_URL } from "../config/api";

const readJsonResponse = async (response) => {
  const rawBody = await response.text();
  if (!rawBody) return {};

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error(`Server returned non-JSON response (${response.status}).`);
  }
};

const getAuthHeaders = (extraHeaders = {}) => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}`, ...extraHeaders } : extraHeaders;
};

const fetchWithAuth = async (url, options = {}, fallbackMessage) => {
  const response = await fetch(url, {
    ...options,
    headers: getAuthHeaders(options.headers || {}),
  });
  const data = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(data?.message || fallbackMessage || "Request failed.");
  }
  return data;
};

export const fetchMyJobs = () =>
  fetchWithAuth(`${API_BASE_URL}/api/jobs/my`, {}, "Failed to fetch your jobs.");

export const fetchJobAccess = (jobId) =>
  fetchWithAuth(`${API_BASE_URL}/api/jobs/${jobId}/access`, {}, "Failed to fetch job access.");

export const assignJobAccess = (jobId, recruiterIds, notes = "") =>
  fetchWithAuth(
    `${API_BASE_URL}/api/jobs/${jobId}/access`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recruiterIds, notes }),
    },
    "Failed to assign recruiters."
  );

export const revokeJobAccess = (jobId, recruiterRid) =>
  fetchWithAuth(
    `${API_BASE_URL}/api/jobs/${jobId}/access/${encodeURIComponent(recruiterRid)}`,
    { method: "DELETE" },
    "Failed to revoke recruiter access."
  );

export const updateJobAccessMode = (jobId, accessMode) =>
  fetchWithAuth(
    `${API_BASE_URL}/api/jobs/${jobId}/access-mode`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessMode }),
    },
    "Failed to update access mode."
  );

export const fetchRecruitersList = (search = "") => {
  const query = String(search || "").trim();
  const suffix = query ? `?search=${encodeURIComponent(query)}` : "";
  return fetchWithAuth(
    `${API_BASE_URL}/api/recruiters/list${suffix}`,
    {},
    "Failed to fetch recruiters list."
  );
};

export const fetchAccessibleJobs = (recruiterId, options = {}) => {
  const params = new URLSearchParams();
  const location = String(options.location || "").trim();
  const company = String(options.company || "").trim();
  const search = String(options.search || "").trim();
  const limit = Number(options.limit);
  const offset = Number(options.offset);

  if (location) params.set("location", location);
  if (company) params.set("company", company);
  if (search) params.set("search", search);
  if (Number.isInteger(limit) && limit >= 0) params.set("limit", String(limit));
  if (Number.isInteger(offset) && offset >= 0) params.set("offset", String(offset));

  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchWithAuth(
    `${API_BASE_URL}/api/recruiters/${encodeURIComponent(recruiterId)}/accessible-jobs${query}`,
    {},
    "Failed to fetch accessible jobs."
  );
};

export const checkRecruiterJobAccess = (recruiterId, jobId) =>
  fetchWithAuth(
    `${API_BASE_URL}/api/recruiters/${encodeURIComponent(recruiterId)}/can-access/${encodeURIComponent(jobId)}`,
    {},
    "Failed to verify job access."
  );

export const submitRecruiterResume = async (formData) => {
  const response = await fetch(`${API_BASE_URL}/api/resumes/submit`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });
  const data = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(data?.error || data?.message || "Failed to submit resume.");
  }
  return data;
};
