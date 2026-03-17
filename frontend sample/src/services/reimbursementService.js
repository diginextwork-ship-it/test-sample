import { API_BASE_URL } from "../config/api";
import { getAuthToken } from "../auth/session";

const readJsonResponse = async (response) => {
  const $raw = await response.text();
  if (!$raw) return {};
  try {
    return JSON.parse($raw);
  } catch {
    throw new Error(`Server returned non-JSON response (${response.status}).`);
  }
};

const withAuthHeaders = (extra = {}) => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}`, ...extra } : extra;
};

const request = async (
  url,
  options = {},
  fallbackMessage = "Request failed.",
) => {
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

export const submitReimbursement = (amount, description) =>
  request(
    `${API_BASE_URL}/api/reimbursements`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, description }),
    },
    "Failed to submit reimbursement.",
  );

export const fetchMyReimbursements = () =>
  request(
    `${API_BASE_URL}/api/reimbursements/my`,
    {},
    "Failed to fetch reimbursements.",
  );

export const fetchAdminReimbursements = () =>
  request(
    `${API_BASE_URL}/api/admin/reimbursements`,
    {},
    "Failed to fetch reimbursements.",
  );

export const decideReimbursement = (id, decision, adminNote = "") =>
  request(
    `${API_BASE_URL}/api/admin/reimbursements/${encodeURIComponent(id)}/decision`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, adminNote }),
    },
    "Failed to update reimbursement.",
  );
