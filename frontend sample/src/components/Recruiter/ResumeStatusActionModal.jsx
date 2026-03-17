import { useState, useEffect } from "react";
import { getAuthToken } from "../../auth/session";
import { API_BASE_URL } from "../../config/api";
import { useNotification } from "../../context/NotificationContext";

export default function ResumeStatusActionModal({
  isOpen,
  onClose,
  resume,
  onSuccess,
  currentStatus,
}) {
  const [selectedAction, setSelectedAction] = useState(null);
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const { addNotification } = useNotification();

  useEffect(() => {
    if (!isOpen) {
      setSelectedAction(null);
      setAdditionalInfo("");
      setErrorMessage("");
      setSuccessMessage("");
    }
  }, [isOpen]);

  if (!isOpen || !resume) return null;

  const getAvailableActions = () => {
    const normalized = String(currentStatus || "")
      .trim()
      .toLowerCase();
    if (normalized === "verified") {
      return [
        { value: "walk_in", label: "Walk In", color: "success" },
        { value: "rejected", label: "Reject", color: "danger" },
      ];
    }
    if (normalized === "walk_in") {
      return [
        { value: "selected", label: "Selected", color: "primary" },
        { value: "rejected", label: "Reject", color: "danger" },
      ];
    }
    if (normalized === "selected") {
      return [
        { value: "joined", label: "Joined", color: "success" },
        { value: "dropout", label: "Dropout", color: "warning" },
        { value: "rejected", label: "Reject", color: "danger" },
      ];
    }
    return [];
  };

  const getReasonFieldLabel = () => {
    if (selectedAction === "walk_in") return "Walk In Reason";
    if (selectedAction === "selected") return "Selection Reason";
    if (selectedAction === "joined") return "Joining Reason";
    if (selectedAction === "dropout") return "Dropout Reason";
    if (selectedAction === "rejected") return "Rejection Reason";
    return "Additional Information";
  };

  const handleSubmitAction = async () => {
    if (!selectedAction) {
      setErrorMessage("Please select an action.");
      return;
    }

    if (!additionalInfo.trim()) {
      setErrorMessage(
        `Please provide a ${getReasonFieldLabel().toLowerCase()}.`,
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token = getAuthToken();
      if (!token) throw new Error("Authentication required.");

      const response = await fetch(
        `${API_BASE_URL}/api/recruiters/${encodeURIComponent(
          resume.recruiterRid || "",
        )}/resumes/${encodeURIComponent(resume.resId)}/advance-status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: selectedAction,
            reason: additionalInfo.trim(),
          }),
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.message ||
            payload?.error ||
            `Failed to advance resume status.`,
        );
      }

      const statusLabel = selectedAction.replace(/_/g, " ");
      const candidateName = resume.candidateName || "Unknown";
      const jobId = resume.jobJid || "N/A";
      const notificationMessage = `Status updated to ${statusLabel} for ${candidateName} (Job ID: ${jobId})`;

      addNotification(notificationMessage, "success", 5000);
      setSuccessMessage(
        `Resume status updated to ${selectedAction.replace(/_/g, " ")}.`,
      );
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (error) {
      setErrorMessage(error.message || "Failed to update resume status.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableActions = getAvailableActions();

  return (
    <div className="modal-overlay" onClick={() => !isSubmitting && onClose()}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "500px" }}
      >
        <div className="modal-header">
          <h3>Resume Status Action</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="resume-info-preview">
            <p>
              <strong>Candidate:</strong> {resume.candidateName || "N/A"}
            </p>
            <p>
              <strong>Current Status:</strong>{" "}
              {String(currentStatus || "").replace(/_/g, " ")}
            </p>
            <p>
              <strong>Job ID:</strong> {resume.jobJid || "N/A"}
            </p>
          </div>

          {availableActions.length === 0 ? (
            <div className="job-message job-message-warning">
              No actions available for this status.
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>Select Action</label>
                <div className="action-buttons-group">
                  {availableActions.map((action) => (
                    <button
                      key={action.value}
                      type="button"
                      className={`action-btn action-btn-${action.color} ${
                        selectedAction === action.value ? "active" : ""
                      }`}
                      onClick={() => {
                        setSelectedAction(action.value);
                        setAdditionalInfo("");
                        setErrorMessage("");
                      }}
                      disabled={isSubmitting}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>

              {selectedAction && (
                <div className="form-group">
                  <label htmlFor="reason-input">{getReasonFieldLabel()}</label>
                  <textarea
                    id="reason-input"
                    className="form-control"
                    rows="4"
                    placeholder={`Enter ${getReasonFieldLabel().toLowerCase()}...`}
                    value={additionalInfo}
                    onChange={(e) => setAdditionalInfo(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <small className="form-text-muted">
                    This information will be saved for reference.
                  </small>
                </div>
              )}

              {errorMessage && (
                <div className="job-message job-message-error">
                  {errorMessage}
                </div>
              )}
              {successMessage && (
                <div className="job-message job-message-success">
                  {successMessage}
                </div>
              )}
            </>
          )}
        </div>

        {availableActions.length > 0 && (
          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            {selectedAction && (
              <button
                type="button"
                className="btn-primary"
                onClick={handleSubmitAction}
                disabled={isSubmitting || !additionalInfo.trim()}
              >
                {isSubmitting ? "Updating..." : "Confirm Action"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
