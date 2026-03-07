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
