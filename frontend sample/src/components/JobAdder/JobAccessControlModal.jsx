import { useEffect, useMemo, useState } from "react";
import RecruiterMultiSelect from "./RecruiterMultiSelect";
import {
  assignJobAccess,
  fetchJobAccess,
  fetchRecruitersList,
  revokeJobAccess,
  updateJobAccessMode,
} from "../../services/jobAccessService";

export default function JobAccessControlModal({ jobId, isOpen, onClose, onSave }) {
  const [accessMode, setAccessMode] = useState("open");
  const [assignedRecruiters, setAssignedRecruiters] = useState([]);
  const [allRecruiters, setAllRecruiters] = useState([]);
  const [selectedRecruiters, setSelectedRecruiters] = useState([]);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const selectedSet = useMemo(() => new Set(selectedRecruiters), [selectedRecruiters]);

  const loadData = async () => {
    if (!jobId) return;
    setIsLoading(true);
    setMessage("");
    try {
      const [accessData, recruiterData] = await Promise.all([
        fetchJobAccess(jobId),
        fetchRecruitersList(),
      ]);
      const recruiters = Array.isArray(accessData.recruiters) ? accessData.recruiters : [];
      setAccessMode(String(accessData.accessMode || "open").toLowerCase() === "restricted" ? "restricted" : "open");
      setAssignedRecruiters(recruiters);
      setSelectedRecruiters(recruiters.map((recruiter) => recruiter.rid));
      setAllRecruiters(Array.isArray(recruiterData.recruiters) ? recruiterData.recruiters : []);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Failed to load access controls.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !jobId) return;
    loadData();
  }, [isOpen, jobId]);

  const handleRemoveRecruiter = async (rid) => {
    if (!jobId || !rid) return;
    setIsSaving(true);
    setMessage("");
    try {
      await revokeJobAccess(jobId, rid);
      setAssignedRecruiters((prev) => prev.filter((recruiter) => recruiter.rid !== rid));
      setSelectedRecruiters((prev) => prev.filter((id) => id !== rid));
      setMessageType("success");
      setMessage(`Access revoked for ${rid}.`);
      if (onSave) onSave();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Failed to revoke recruiter access.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!jobId) return;
    setIsSaving(true);
    setMessage("");

    try {
      const modeResult = await updateJobAccessMode(jobId, accessMode);
      if (accessMode === "restricted" && selectedRecruiters.length > 0) {
        await assignJobAccess(jobId, selectedRecruiters, notes);
      }

      await loadData();
      setMessageType("success");
      setMessage(modeResult?.warning || "Job access updated successfully.");
      if (onSave) onSave();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Failed to save access settings.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Manage job access">
      <div className="modal-card">
        <div className="modal-card-head">
          <h2>Manage Job Access (Job #{jobId})</h2>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            Close
          </button>
        </div>

        {isLoading ? (
          <p className="chart-empty">Loading access settings...</p>
        ) : (
          <>
            <div className="job-field">
              <label htmlFor="accessModeSelect">Access Mode</label>
              <select
                id="accessModeSelect"
                value={accessMode}
                onChange={(event) => setAccessMode(event.target.value)}
              >
                <option value="open">Open (All Recruiters)</option>
                <option value="restricted">Restricted (Selected Recruiters Only)</option>
              </select>
            </div>

            {accessMode === "restricted" ? (
              <div className="modal-body-stack">
                <h3>Assign Recruiters</h3>
                <RecruiterMultiSelect
                  allRecruiters={allRecruiters}
                  selectedRecruiters={selectedRecruiters}
                  onSelectionChange={setSelectedRecruiters}
                />

                <div className="job-field">
                  <label htmlFor="accessNotes">Notes (optional)</label>
                  <textarea
                    id="accessNotes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={3}
                    placeholder="Optional note for the assignment"
                  />
                </div>

                <div>
                  <h4>Currently Assigned</h4>
                  {assignedRecruiters.length === 0 ? (
                    <p className="chart-empty">No recruiters assigned yet.</p>
                  ) : (
                    <div className="assigned-recruiter-list">
                      {assignedRecruiters.map((recruiter) => (
                        <div key={recruiter.rid} className="assigned-recruiter-item">
                          <span>
                            <strong>{recruiter.name || recruiter.rid}</strong> ({recruiter.email})
                          </span>
                          <button
                            type="button"
                            className="click-here-btn"
                            onClick={() => handleRemoveRecruiter(recruiter.rid)}
                            disabled={isSaving}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedSet.size === 0 ? (
                  <p className="job-message job-message-error">
                    Warning: restricted mode with no assigned recruiters will block submissions.
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}

        {message ? (
          <p className={`job-message ${messageType === "success" ? "job-message-success" : "job-message-error"}`}>
            {message}
          </p>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="recruiter-login-btn" onClick={handleSave} disabled={isLoading || isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
          <button type="button" className="modal-secondary-btn" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
