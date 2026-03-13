import { useEffect, useState } from "react";
import emailjs from "@emailjs/browser";
import AdminLayout from "./AdminLayout";
import {
  API_BASE_URL,
  getAdminHeaders,
  readJsonResponse,
  updateTeamLeaderNote,
} from "./adminApi";
import "../../styles/admin-panel.css";

const shortlistEmailServiceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const shortlistEmailTemplateId = import.meta.env
  .VITE_EMAILJS_SHORTLIST_TEMPLATE_ID;
const shortlistEmailPublicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
};

const formatMoney = (value) => {
  if (value === null || value === undefined || value === "") return "N/A";
  return Number(value).toLocaleString("en-IN");
};

export default function AdminCandidateResumes({ setCurrentPage }) {
  const [resumes, setResumes] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isShortlisting, setIsShortlisting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [pendingResume, setPendingResume] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [noteValue, setNoteValue] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  const loadCandidateResumes = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/candidate-resumes`,
        {
          headers: getAdminHeaders(),
        },
      );
      const data = await readJsonResponse(
        response,
        "Check VITE_API_BASE_URL and ensure the admin candidate resumes route is available.",
      );
      if (!response.ok) {
        throw new Error(
          data?.message || "Failed to fetch candidate submitted resumes.",
        );
      }

      setResumes(Array.isArray(data?.resumes) ? data.resumes : []);
      setTotalCount(Number(data?.totalCount) || 0);
    } catch (error) {
      setResumes([]);
      setTotalCount(0);
      setErrorMessage(
        error.message || "Failed to fetch candidate submitted resumes.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCandidateResumes();
  }, []);

  const openShortlistModal = (resume) => {
    setErrorMessage("");
    setStatusMessage("");
    setPendingResume(resume);
  };

  const closeShortlistModal = () => {
    if (isShortlisting) return;
    setPendingResume(null);
  };

  const openNoteEditor = (resume) => {
    setEditingNote(resume.resId);
    setNoteValue(resume.verifiedReason || "");
    setErrorMessage("");
  };

  const closeNoteEditor = () => {
    if (isSavingNote) return;
    setEditingNote(null);
    setNoteValue("");
  };

  const saveTeamLeaderNote = async () => {
    if (!editingNote) return;

    setIsSavingNote(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      await updateTeamLeaderNote(editingNote, noteValue);
      setStatusMessage("Team leader note updated successfully.");
      setEditingNote(null);
      setNoteValue("");
      await loadCandidateResumes();
    } catch (error) {
      setErrorMessage(error.message || "Failed to update team leader note.");
    } finally {
      setIsSavingNote(false);
    }
  };

  const sendShortlistEmail = async (resume) => {
    if (
      !shortlistEmailServiceId ||
      !shortlistEmailTemplateId ||
      !shortlistEmailPublicKey
    ) {
      throw new Error(
        "Email service is not configured. Set VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_SHORTLIST_TEMPLATE_ID, and VITE_EMAILJS_PUBLIC_KEY.",
      );
    }

    if (!resume?.applicantEmail) {
      throw new Error("Candidate email is not available for this resume.");
    }

    const templateParams = {
      to_email: resume.applicantEmail,
      candidate_email: resume.applicantEmail,
      candidate_name: resume.applicantName || "Candidate",
      resume_id: resume.resId || "",
      job_id: resume.jobJid || "",
      job_role: resume.job?.roleName || "",
      company_name: resume.job?.companyName || "",
      resume_filename: resume.resumeFilename || "",
      shortlisted_at: new Date().toLocaleString(),
      shortlist_status: "shortlisted",
      admin_name: "admin-panel",
      message:
        "Your profile has been shortlisted. Our team will reach out with the next steps soon.",
    };

    await emailjs.send(
      shortlistEmailServiceId,
      shortlistEmailTemplateId,
      templateParams,
      { publicKey: shortlistEmailPublicKey },
    );
  };

  const confirmShortlist = async () => {
    if (!pendingResume?.resId || !pendingResume?.jobJid) {
      setErrorMessage(
        "This resume is not linked to a valid job, so it cannot be shortlisted.",
      );
      setPendingResume(null);
      return;
    }

    setIsShortlisting(true);
    setErrorMessage("");
    setStatusMessage("");

    let selectionSaved = false;
    try {
      const selectionResponse = await fetch(
        `${API_BASE_URL}/api/admin/jobs/${pendingResume.jobJid}/resume-selections`,
        {
          method: "POST",
          headers: getAdminHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            resId: pendingResume.resId,
            selection_status: "selected",
            selection_note:
              "Shortlisted from candidate submitted resumes panel.",
            selected_by_admin: "admin-panel",
          }),
        },
      );
      const selectionData = await readJsonResponse(
        selectionResponse,
        "Failed to parse shortlist update response.",
      );
      if (!selectionResponse.ok) {
        throw new Error(
          selectionData?.message || "Failed to shortlist this resume.",
        );
      }
      selectionSaved = true;

      await sendShortlistEmail(pendingResume);
      setStatusMessage(
        `Shortlisted ${pendingResume.applicantName || pendingResume.resId} and triggered the EmailJS notification.`,
      );
      setPendingResume(null);
      await loadCandidateResumes();
    } catch (error) {
      if (selectionSaved) {
        setPendingResume(null);
        await loadCandidateResumes();
        setErrorMessage(
          `Resume was shortlisted, but the email could not be sent. ${error.message || "EmailJS failed."}`,
        );
      } else {
        setErrorMessage(error.message || "Failed to shortlist this resume.");
      }
    } finally {
      setIsShortlisting(false);
    }
  };

  return (
    <AdminLayout
      title="Candidate's submitted resumes"
      subtitle="See resumes submitted by normal users from the job search flow, along with JD and ATS details."
      setCurrentPage={setCurrentPage}
      actions={
        <button
          type="button"
          className="admin-refresh-btn"
          onClick={loadCandidateResumes}
          disabled={isLoading}
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      }
    >
      {errorMessage ? (
        <div className="admin-alert admin-alert-error">{errorMessage}</div>
      ) : null}
      {statusMessage ? (
        <div className="admin-alert">{statusMessage}</div>
      ) : null}

      <div className="admin-dashboard-card" style={{ marginBottom: "16px" }}>
        <div className="admin-muted">Candidate resume submissions</div>
        <h3 style={{ margin: "8px 0 0" }}>{totalCount}</h3>
      </div>

      <div className="admin-dashboard-card admin-card-large">
        {resumes.length === 0 ? (
          <p className="admin-chart-empty">
            {isLoading
              ? "Loading candidate resumes..."
              : "No candidate-submitted resumes found yet."}
          </p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table-wide">
              <thead>
                <tr>
                  <th>Resume ID</th>
                  <th>Candidate</th>
                  <th>Job</th>
                  <th>JD</th>
                  <th>ATS Score</th>
                  <th>ATS Match</th>
                  <th>Recruiter Note</th>
                  <th>Team Leader Note</th>
                  <th>Experience</th>
                  <th>File</th>
                  <th>Submitted At</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {resumes.map((resume) => (
                  <tr key={resume.resId}>
                    <td>{resume.resId || "N/A"}</td>
                    <td>{resume.applicantName || "Name not found"}</td>
                    <td className="admin-job-cell">
                      <strong>
                        {resume.jobJid ? `#${resume.jobJid}` : "No job"}
                      </strong>
                      <div>{resume.job?.roleName || "N/A"}</div>
                      <div className="admin-muted">
                        {resume.job?.companyName || "N/A"}
                      </div>
                    </td>
                    <td style={{ minWidth: "260px", whiteSpace: "normal" }}>
                      {resume.job?.jobDescription ||
                        resume.job?.skills ||
                        "N/A"}
                    </td>
                    <td>
                      {resume.atsScore === null ? "N/A" : `${resume.atsScore}%`}
                    </td>
                    <td>
                      {resume.atsMatchPercentage === null
                        ? "N/A"
                        : `${resume.atsMatchPercentage}%`}
                    </td>
                    <td
                      className="table-cell-wrap"
                      style={{ maxWidth: "200px" }}
                    >
                      {resume.submittedReason || "-"}
                    </td>
                    <td
                      className="table-cell-wrap"
                      style={{ maxWidth: "200px" }}
                    >
                      {resume.verifiedReason || "-"}
                      <button
                        type="button"
                        className="admin-refresh-btn"
                        onClick={() => openNoteEditor(resume)}
                        disabled={isLoading || isSavingNote}
                        style={{
                          marginLeft: "8px",
                          padding: "4px 8px",
                          fontSize: "12px",
                        }}
                      >
                        Edit
                      </button>
                    </td>
                    <td style={{ minWidth: "240px", whiteSpace: "normal" }}>
                      {resume.hasPriorExperience === null ? (
                        "N/A"
                      ) : resume.hasPriorExperience ? (
                        <>
                          <div>
                            <strong>Industry:</strong>{" "}
                            {resume.experience?.industry === "others"
                              ? resume.experience?.industryOther || "Others"
                              : resume.experience?.industry || "N/A"}
                          </div>
                          <div>
                            <strong>Current:</strong>{" "}
                            {formatMoney(resume.experience?.currentSalary)}
                          </div>
                          <div>
                            <strong>Expected:</strong>{" "}
                            {formatMoney(resume.experience?.expectedSalary)}
                          </div>
                          <div>
                            <strong>Notice:</strong>{" "}
                            {resume.experience?.noticePeriod || "N/A"}
                          </div>
                          <div>
                            <strong>Years:</strong>{" "}
                            {resume.experience?.yearsOfExperience ?? "N/A"}
                          </div>
                        </>
                      ) : (
                        "No prior experience"
                      )}
                    </td>
                    <td>
                      {resume.resumeFilename || "N/A"}
                      {resume.resumeType
                        ? ` (${String(resume.resumeType).toUpperCase()})`
                        : ""}
                    </td>
                    <td>{formatDateTime(resume.uploadedAt)}</td>
                    <td>{resume.selection?.status || "pending"}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-refresh-btn admin-shortlist-btn"
                        onClick={() => openShortlistModal(resume)}
                        disabled={
                          isShortlisting ||
                          !resume.jobJid ||
                          String(
                            resume.selection?.status || "",
                          ).toLowerCase() === "selected"
                        }
                      >
                        {String(
                          resume.selection?.status || "",
                        ).toLowerCase() === "selected"
                          ? "Shortlisted"
                          : "Shortlist"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pendingResume ? (
        <div
          className="admin-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortlist-modal-title"
        >
          <div className="admin-modal-card">
            <h3
              id="shortlist-modal-title"
              style={{ marginTop: 0, marginBottom: "10px" }}
            >
              Confirm shortlist
            </h3>
            <p style={{ marginTop: 0 }}>
              An email will be sent to{" "}
              <strong>
                {pendingResume.applicantEmail || "this candidate"}
              </strong>{" "}
              after you confirm the shortlist action.
            </p>
            <p className="admin-muted" style={{ marginTop: 0 }}>
              Candidate: {pendingResume.applicantName || "Name not found"} |
              Job: {pendingResume.job?.roleName || "N/A"} at{" "}
              {pendingResume.job?.companyName || "N/A"}
            </p>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-back-btn"
                onClick={closeShortlistModal}
                disabled={isShortlisting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-refresh-btn"
                onClick={confirmShortlist}
                disabled={isShortlisting}
              >
                {isShortlisting ? "Confirming..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingNote ? (
        <div
          className="admin-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="note-modal-title"
        >
          <div className="admin-modal-card">
            <h3
              id="note-modal-title"
              style={{ marginTop: 0, marginBottom: "10px" }}
            >
              Edit Team Leader Note
            </h3>
            <p className="admin-muted" style={{ marginTop: 0 }}>
              Resume ID: {editingNote}
            </p>
            <textarea
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              placeholder="Add or edit team leader note..."
              rows={5}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                fontFamily: "inherit",
                marginBottom: "10px",
              }}
            />
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-back-btn"
                onClick={closeNoteEditor}
                disabled={isSavingNote}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-refresh-btn"
                onClick={saveTeamLeaderNote}
                disabled={isSavingNote}
              >
                {isSavingNote ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
