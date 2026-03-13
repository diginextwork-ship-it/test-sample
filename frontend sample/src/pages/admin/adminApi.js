import { getAuthToken } from "../../auth/session";
import { API_BASE_URL } from "../../config/api";

export { API_BASE_URL };

export const getAdminHeaders = (extraHeaders = {}) => ({
  Authorization: `Bearer ${getAuthToken()}`,
  ...extraHeaders,
});

export const readJsonResponse = async (response, fallbackMessage) => {
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

export const updateTeamLeaderNote = async (resId, verifiedReason) => {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/resumes/${encodeURIComponent(resId)}/verified-reason`,
    {
      method: "PUT",
      headers: getAdminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ verified_reason: verifiedReason || null }),
    },
  );

  const data = await readJsonResponse(
    response,
    "Failed to parse team leader note update response.",
  );

  if (!response.ok) {
    throw new Error(data?.message || "Failed to update team leader note.");
  }

  return data;
};
