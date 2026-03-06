const FALLBACK_API_BASE_URL = "http://localhost:5000";

const normalizeApiBaseUrl = (rawBaseUrl) => {
  const trimmed = String(rawBaseUrl || "").trim();
  const candidate = trimmed || FALLBACK_API_BASE_URL;
  const withProtocol = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;

  const parsed = new URL(withProtocol);
  const pathname = parsed.pathname.replace(/\/+$/, "");
  const normalizedPath = pathname.endsWith("/api")
    ? pathname.slice(0, -4)
    : pathname;

  parsed.pathname = normalizedPath || "/";
  return parsed.toString().replace(/\/+$/, "");
};

export const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL
);

export const BACKEND_CONNECTION_ERROR =
  "Cannot connect to backend. Check VITE_API_URL and backend deployment.";

export const buildApiUrl = (endpointPath) => {
  const normalizedEndpointPath = endpointPath.startsWith("/")
    ? endpointPath
    : `/${endpointPath}`;
  const baseUrl = new URL(API_BASE_URL);
  const basePath = (baseUrl.pathname || "").replace(/\/+$/, "");
  const endpointPathWithoutDuplicateApi =
    basePath.endsWith("/api") && normalizedEndpointPath.startsWith("/api/")
      ? normalizedEndpointPath.slice(4)
      : normalizedEndpointPath;

  baseUrl.pathname = `${basePath}${endpointPathWithoutDuplicateApi}`.replace(
    /\/{2,}/g,
    "/"
  );

  return baseUrl.toString();
};
