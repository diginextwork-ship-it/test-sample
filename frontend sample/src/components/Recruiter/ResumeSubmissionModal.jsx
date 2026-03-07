import { useEffect, useState } from "react";
import { checkRecruiterJobAccess, submitRecruiterResume } from "../../services/jobAccessService";

const initialFormState = {
  candidate_name: "",
  phone: "",
  email: "",
  latest_education_level: "",
  board_university: "",
  institution_name: "",
  grading_system: "",
  score: "",
  age: "",
  resume_file: null,
};

const allowedFilePattern = /\.(pdf|doc|docx)$/i;

export default function ResumeSubmissionModal({ recruiterId, jobId, isOpen, onClose, onSuccess }) {
  const [hasAccess, setHasAccess] = useState(null);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    if (!isOpen || !jobId || !recruiterId) return;
    let active = true;

    const loadAccess = async () => {
      setCheckingAccess(true);
      setErrorMessage("");
      try {
        const data = await checkRecruiterJobAccess(recruiterId, jobId);
        if (!active) return;
        setHasAccess(Boolean(data?.canAccess));
        if (!data?.canAccess) setErrorMessage(data?.reason || "Access denied for this job.");
      } catch (error) {
        if (!active) return;
        setHasAccess(false);
        setErrorMessage(error.message || "Failed to validate job access.");
      } finally {
        if (active) setCheckingAccess(false);
      }
    };

    loadAccess();
    return () => {
      active = false;
    };
  }, [isOpen, recruiterId, jobId]);

  useEffect(() => {
    if (!isOpen) {
      setFormData(initialFormState);
      setHasAccess(null);
      setCheckingAccess(false);
      setSubmitting(false);
      setErrorMessage("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const setField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateFile = (file) => {
    if (!file) return "Please upload a resume file.";
    if (!allowedFilePattern.test(file.name || "")) {
      return "Only PDF, DOC, DOCX files are allowed.";
    }
    if (file.size > 5 * 1024 * 1024) {
      return "Resume file size must be 5MB or less.";
    }
    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!hasAccess) {
      setErrorMessage("You don't have permission to submit resumes for this job.");
      return;
    }

    const fileError = validateFile(formData.resume_file);
    if (fileError) {
      setErrorMessage(fileError);
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const payload = new FormData();
      payload.append("job_jid", String(jobId));
      payload.append("recruiter_rid", String(recruiterId));
      Object.entries(formData).forEach(([key, value]) => {
        if (key === "resume_file") payload.append(key, value);
        else payload.append(key, String(value ?? "").trim());
      });

      const data = await submitRecruiterResume(payload);
      onSuccess?.(data);
      onClose?.();
    } catch (error) {
      setErrorMessage(error.message || "Failed to submit resume.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="resume-modal-overlay" role="presentation">
      <div className="resume-modal" role="dialog" aria-modal="true" aria-labelledby="resume-modal-title">
        <div className="resume-modal-header">
          <h2 id="resume-modal-title">Submit Resume</h2>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {checkingAccess ? <p>Checking access...</p> : null}
        {!checkingAccess && hasAccess === false ? (
          <p className="job-message job-message-error">{errorMessage || "Access denied."}</p>
        ) : null}

        {!checkingAccess && hasAccess ? (
          <form className="resume-modal-form" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Candidate Name"
              value={formData.candidate_name}
              onChange={(event) => setField("candidate_name", event.target.value)}
              required
            />
            <input
              type="tel"
              placeholder="Phone"
              value={formData.phone}
              onChange={(event) => setField("phone", event.target.value)}
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(event) => setField("email", event.target.value)}
              required
            />
            <select
              value={formData.latest_education_level}
              onChange={(event) => setField("latest_education_level", event.target.value)}
              required
            >
              <option value="">Education Level</option>
              <option value="High School">High School</option>
              <option value="Bachelor's">Bachelor&apos;s</option>
              <option value="Master's">Master&apos;s</option>
              <option value="PhD">PhD</option>
            </select>
            <input
              type="text"
              placeholder="Board / University"
              value={formData.board_university}
              onChange={(event) => setField("board_university", event.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Institution Name"
              value={formData.institution_name}
              onChange={(event) => setField("institution_name", event.target.value)}
              required
            />
            <select
              value={formData.grading_system}
              onChange={(event) => setField("grading_system", event.target.value)}
              required
            >
              <option value="">Grading System</option>
              <option value="Percentage">Percentage</option>
              <option value="CGPA">CGPA</option>
              <option value="GPA">GPA</option>
            </select>
            <input
              type="text"
              placeholder="Score"
              value={formData.score}
              onChange={(event) => setField("score", event.target.value)}
              required
            />
            <input
              type="number"
              min="18"
              max="100"
              placeholder="Age"
              value={formData.age}
              onChange={(event) => setField("age", event.target.value)}
              required
            />
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => setField("resume_file", event.target.files?.[0] || null)}
              required
            />

            <div className="resume-modal-actions">
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Resume"}
              </button>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {errorMessage && hasAccess !== false ? (
          <p className="job-message job-message-error">{errorMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
