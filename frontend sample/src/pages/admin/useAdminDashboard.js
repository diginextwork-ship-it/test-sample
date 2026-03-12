import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL, getAdminHeaders, readJsonResponse } from "./adminApi";

export default function useAdminDashboard() {
  const [dashboard, setDashboard] = useState({
    totalResumeCount: 0,
    candidateResumeCount: 0,
    recruiterResumeUploads: [],
    topResumesByJob: [],
  });
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const refreshDashboard = useCallback(async () => {
    setIsLoadingDashboard(true);
    setErrorMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/dashboard`, {
        headers: getAdminHeaders(),
      });
      const data = await readJsonResponse(
        response,
        "Check VITE_API_BASE_URL and backend route setup."
      );
      if (!response.ok) {
        throw new Error(data?.message || "Failed to fetch admin dashboard.");
      }

      setDashboard({
        totalResumeCount: Number(data.totalResumeCount) || 0,
        candidateResumeCount: Number(data.candidateResumeCount) || 0,
        recruiterResumeUploads: Array.isArray(data.recruiterResumeUploads)
          ? data.recruiterResumeUploads
          : [],
        topResumesByJob: Array.isArray(data.topResumesByJob) ? data.topResumesByJob : [],
      });
    } catch (error) {
      setErrorMessage(error.message || "Failed to fetch admin dashboard.");
    } finally {
      setIsLoadingDashboard(false);
    }
  }, []);

  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  return {
    dashboard,
    isLoadingDashboard,
    errorMessage,
    refreshDashboard,
  };
}
