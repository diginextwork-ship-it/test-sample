import { getAuthToken } from "../../auth/session";
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

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
      `Server returned non-JSON response (${response.status}) for ${response.url}. ${fallbackMessage}`
    );
  }
};
