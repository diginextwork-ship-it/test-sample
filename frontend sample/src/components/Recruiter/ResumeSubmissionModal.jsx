import { useEffect, useState } from "react";
import { checkRecruiterJobAccess, submitRecruiterResume } from "../../services/jobAccessService";
import { API_BASE_URL, BACKEND_CONNECTION_ERROR } from "../../config/api";

const initialFormState = {
  candidate_name: "",
  phone: "",
  email: "",
  latest_education_level: "",
  board_university: "",
  institution_name: "",
  age: "",
  submitted_reason: "",
  resume_file: null,
};

const allowedFilePattern = /\.(pdf|doc|docx)$/i;

export default function ResumeSubmissionModal({ recruiterId, jobId, isOpen, onClose, onSuccess }) {
  const [hasAccess, setHasAccess] = useState(null);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [parseMessage, setParseMessage] = useState("");
  const [parseMessageType, setParseMessageType] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [formData, setFormData] = useState(initialFormState);
  const [resumeBase64, setResumeBase64] = useState("");
  const [parsedPayload, setParsedPayload] = useState(null);

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
      setIsParsingResume(false);
      setParseMessage("");
      setParseMessageType("");
      setErrorMessage("");
      setResumeBase64("");
      setParsedPayload(null);
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

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read resume file."));
      reader.readAsDataURL(file);
    });

  const parseResumeAndAutofill = async (file, base64Override) => {
    if (!file || !jobId) return;

    setIsParsingResume(true);
    setParseMessage("");
    setParseMessageType("");

    try {
      const encodedResume = base64Override || (await fileToDataUrl(file));
      const jid = String(jobId || "").trim();
      const response = await fetch(`${API_BASE_URL}/api/applications/parse-resume`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jid,
          resumeBase64: encodedResume,
          resumeFilename: file.name,
          resumeMimeType: file.type,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to parse resume.");
      }

      const autofill = data?.autofill || {};
      setFormData((prev) => ({
        ...prev,
        candidate_name: autofill.name || prev.candidate_name,
        phone: String(autofill.phone || prev.phone).replace(/\D/g, "").slice(0, 10),
        email: autofill.email || prev.email,
        latest_education_level: autofill.latestEducationLevel || prev.latest_education_level,
        board_university: autofill.boardUniversity || prev.board_university,
        institution_name: autofill.institutionName || prev.institution_name,
        age: autofill.age || prev.age,
      }));
      setParseMessageType("success");
      setParseMessage("Resume parsed and form auto-filled successfully.");
      setParsedPayload({
        parsedData: data?.parsedData || null,
        atsScore: data?.atsScore ?? null,
        atsMatchPercentage: data?.atsMatchPercentage ?? null,
        atsRawJson: data?.atsRawJson || null,
      });
    } catch (error) {
      setParseMessageType("error");
      if (error instanceof TypeError) {
        setParseMessage(BACKEND_CONNECTION_ERROR);
      } else {
        setParseMessage(error.message || "Resume parsing failed.");
      }
    } finally {
      setIsParsingResume(false);
    }
  };

  const handleResumeFileChange = async (event) => {
    const file = event.target.files?.[0] || null;
    setErrorMessage("");
    setParseMessage("");
    setParseMessageType("");
    setField("resume_file", file);
    setResumeBase64("");
    setParsedPayload(null);

    if (!file) return;
    const fileError = validateFile(file);
    if (fileError) {
      setErrorMessage(fileError);
      return;
    }

    try {
      const encodedResume = await fileToDataUrl(file);
      setResumeBase64(encodedResume);
      await parseResumeAndAutofill(file, encodedResume);
    } catch (error) {
      setErrorMessage(error.message || "Failed to read resume file.");
    }
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

    const resumeFilename = String(formData.resume_file?.name || "").trim();
    const jid = String(jobId || "").trim();
    if (!jid || !resumeBase64 || !resumeFilename) {
      setErrorMessage("jid, resumeBase64, and resumeFilename are required.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const payload = new FormData();
      payload.append("job_jid", String(jobId));
      payload.append("recruiter_rid", String(recruiterId));
      payload.append("jid", jid);
      payload.append("resumeBase64", resumeBase64);
      payload.append("resumeFilename", resumeFilename);
      if (parsedPayload) {
        if (parsedPayload.parsedData) {
          payload.append("parsedData", JSON.stringify(parsedPayload.parsedData));
        }
        if (parsedPayload.atsScore !== null && parsedPayload.atsScore !== undefined) {
          payload.append("atsScore", String(parsedPayload.atsScore));
        }
        if (
          parsedPayload.atsMatchPercentage !== null &&
          parsedPayload.atsMatchPercentage !== undefined
        ) {
          payload.append("atsMatchPercentage", String(parsedPayload.atsMatchPercentage));
        }
        if (parsedPayload.atsRawJson) {
          payload.append("atsRawJson", JSON.stringify(parsedPayload.atsRawJson));
        }
      }
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
              onChange={handleResumeFileChange}
              required
            />
            <div className="resume-modal-field">
              <label htmlFor="submitted_reason">Any brief about candidate&apos;s availability?</label>
              <textarea
                id="submitted_reason"
                placeholder="Add a short availability note"
                value={formData.submitted_reason}
                onChange={(event) => setField("submitted_reason", event.target.value)}
                rows={3}
              />
            </div>
            {isParsingResume ? <p>Parsing resume and calculating ATS...</p> : null}
            {parseMessage ? (
              <p className={parseMessageType === "success" ? "job-message" : "job-message job-message-error"}>
                {parseMessage}
              </p>
            ) : null}

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
