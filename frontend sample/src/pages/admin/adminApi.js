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
      `Server returned non-JSON response (${response.status}) for ${response.url}. ${fallbackMessage}`
    );
  }
};

