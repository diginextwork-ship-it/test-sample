import { useMemo, useState } from "react";
import "../styles/job-application.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const initialFormData = {
  name: "",
  phone: "",
  email: "",
  latestEducationLevel: "",
  boardUniversity: "",
  institutionName: "",
  gradingSystem: "",
  score: "",
  age: "",
};

export default function JobApplication({ setCurrentPage }) {
  const [formData, setFormData] = useState(initialFormData);
  const [resumeFile, setResumeFile] = useState(null);
  const [parsedResume, setParsedResume] = useState(null);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [resumeMessage, setResumeMessage] = useState("");
  const [resumeMessageType, setResumeMessageType] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");

  const selectedJob = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("selectedJob");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);
  const selectedJobId = Number(selectedJob?.id ?? selectedJob?.jid ?? 0);

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === "phone") {
      const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
      setPhoneError("");
      setFormData((prev) => ({ ...prev, [name]: digitsOnly }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read resume file."));
      reader.readAsDataURL(file);
    });

  const parseResumeAndAutofill = async (file) => {
    if (!Number.isInteger(selectedJobId) || selectedJobId <= 0) {
      setResumeMessageType("error");
      setResumeMessage("Select a job first, then upload resume.");
      return;
    }

    setIsParsingResume(true);
    setResumeMessage("");
    setResumeMessageType("");

    try {
      const resumeBase64 = await fileToDataUrl(file);
      const response = await fetch(`${API_BASE_URL}/api/applications/parse-resume`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jid: selectedJobId,
          resumeBase64,
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
        name: autofill.name || prev.name,
        phone: String(autofill.phone || prev.phone).replace(/\D/g, "").slice(0, 10),
        email: autofill.email || prev.email,
        latestEducationLevel: autofill.latestEducationLevel || prev.latestEducationLevel,
        boardUniversity: autofill.boardUniversity || prev.boardUniversity,
        institutionName: autofill.institutionName || prev.institutionName,
        gradingSystem: autofill.gradingSystem || prev.gradingSystem,
        score: autofill.score || prev.score,
        age: autofill.age || prev.age,
      }));

      const parsedPayload = {
        resumeBase64,
        resumeFilename: file.name,
        resumeMimeType: file.type,
        parsedData: data?.parsedData || null,
      };
      setParsedResume(parsedPayload);
      setResumeMessageType("success");
      setResumeMessage("Resume parsed and form auto-filled successfully.");
      return parsedPayload;
    } catch (error) {
      if (error instanceof TypeError) {
        setResumeMessageType("error");
        setResumeMessage("Cannot connect to backend. Ensure API is running on port 5000.");
      } else {
        setResumeMessageType("error");
        setResumeMessage(error.message || "Resume parsing failed.");
      }
      setParsedResume(null);
      return null;
    } finally {
      setIsParsingResume(false);
    }
  };

  const handleResumeFileChange = async (event) => {
    const file = event.target.files?.[0] || null;
    setResumeMessage("");
    setResumeMessageType("");
    setParsedResume(null);

    if (!file) {
      setResumeFile(null);
      return;
    }

    const isSupportedType = /\.(pdf|docx)$/i.test(file.name);
    if (!isSupportedType) {
      setResumeFile(null);
      setResumeMessageType("error");
      setResumeMessage("Only PDF and DOCX resumes are supported.");
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setResumeFile(null);
      setResumeMessageType("error");
      setResumeMessage("Resume file size must be 10MB or less.");
      event.target.value = "";
      return;
    }

    setResumeFile(file);
    await parseResumeAndAutofill(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(false);
    setSubmitMessage("");

    if (!Number.isInteger(selectedJobId) || selectedJobId <= 0) {
      setSubmitMessage("No job selected. Please go back and choose a job first.");
      return;
    }

    if (!resumeFile) {
      setSubmitMessage("Please upload your resume before submitting.");
      return;
    }

    let parsedResumePayload = parsedResume;
    if (!parsedResumePayload) {
      parsedResumePayload = await parseResumeAndAutofill(resumeFile);
      if (!parsedResumePayload) {
        setSubmitMessage("Resume parsing failed. Please re-upload and try again.");
        return;
      }
    }

    if (!/^\d{10}$/.test(formData.phone)) {
      setPhoneError("Phone number must be exactly 10 digits.");
      return;
    }

    setIsSubmitting(true);
    setPhoneError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/applications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jid: selectedJobId,
          ...formData,
          resumeBase64: parsedResumePayload.resumeBase64,
          resumeFilename: parsedResumePayload.resumeFilename || resumeFile.name,
          resumeMimeType: parsedResumePayload.resumeMimeType || resumeFile.type,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to submit application.");
      }

      setSubmitted(true);
      setSubmitMessage("Application submitted successfully.");
      setFormData(initialFormData);
      setResumeFile(null);
      setParsedResume(null);
      setResumeMessage("");
      setResumeMessageType("");
    } catch (error) {
      if (error instanceof TypeError) {
        setSubmitMessage("Cannot connect to backend. Ensure API is running on port 5000.");
      } else {
        setSubmitMessage(error.message || "Application submission failed.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="job-application-page">
      <section className="job-application-shell">
        <div className="job-application-card">
          <h1>Job application form</h1>
          <p>Complete the form below to submit your application.</p>

          {selectedJob ? (
            <p>
              Applying for <strong>{selectedJob.title}</strong> at <strong>{selectedJob.company}</strong>
            </p>
          ) : (
            <p className="application-error-message">
              No job selected. Use Back to jobs and click Apply now on a job.
            </p>
          )}

          <form className="job-application-form" onSubmit={handleSubmit}>
            <div className="application-field">
              <label htmlFor="resumeUpload">Upload resume (PDF/DOCX) *</label>
              <input
                id="resumeUpload"
                name="resumeUpload"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleResumeFileChange}
                required
              />
              {isParsingResume ? <p>Parsing resume and calculating ATS...</p> : null}
              {resumeMessage ? (
                <p
                  className={
                    resumeMessageType === "success"
                      ? "application-success-message"
                      : "application-error-message"
                  }
                >
                  {resumeMessage}
                </p>
              ) : null}
            </div>

            <div className="application-field">
              <label htmlFor="applicantName">Name *</label>
              <input
                id="applicantName"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="application-field">
              <label htmlFor="applicantPhone">Phone *</label>
              <input
                id="applicantPhone"
                name="phone"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]{10}"
                minLength={10}
                maxLength={10}
                title="Phone number must be exactly 10 digits"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Enter 10-digit phone number"
                required
              />
              {phoneError ? <p className="application-error-message">{phoneError}</p> : null}
            </div>

            <div className="application-field">
              <label htmlFor="applicantEmail">Email *</label>
              <input
                id="applicantEmail"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="application-field">
              <label htmlFor="latestEducationLevel">Add your latest education *</label>
              <select
                id="latestEducationLevel"
                name="latestEducationLevel"
                value={formData.latestEducationLevel}
                onChange={handleChange}
                required
              >
                <option value="">Select highest level of completed education</option>
                <option value="10th">10th</option>
                <option value="12th">12th</option>
                <option value="bachelors">Bachelors</option>
                <option value="masters">Masters</option>
              </select>
            </div>

            <div className="application-field">
              <label htmlFor="boardUniversity">Enter your board/university *</label>
              <input
                id="boardUniversity"
                name="boardUniversity"
                type="text"
                value={formData.boardUniversity}
                onChange={handleChange}
                placeholder="Board or university name"
                required
              />
            </div>

            <div className="application-field">
              <label htmlFor="institutionName">Enter school/college name *</label>
              <input
                id="institutionName"
                name="institutionName"
                type="text"
                value={formData.institutionName}
                onChange={handleChange}
                placeholder="School or college name"
                required
              />
            </div>

            <div className="application-field">
              <label htmlFor="gradingSystem">Grading system *</label>
              <select
                id="gradingSystem"
                name="gradingSystem"
                value={formData.gradingSystem}
                onChange={handleChange}
                required
              >
                <option value="">Select grading system</option>
                <option value="percentage">Percentage (out of 100)</option>
                <option value="gpa">GPA (out of 10)</option>
              </select>
            </div>

            <div className="application-field">
              <label htmlFor="score">Enter your score *</label>
              <input
                id="score"
                name="score"
                type="text"
                value={formData.score}
                onChange={handleChange}
                placeholder={
                  formData.gradingSystem === "gpa"
                    ? "Enter GPA out of 10"
                    : "Enter percentage out of 100"
                }
                required
              />
            </div>

            <div className="application-field">
              <label htmlFor="applicantAge">Age *</label>
              <input
                id="applicantAge"
                name="age"
                type="number"
                min="16"
                max="100"
                value={formData.age}
                onChange={handleChange}
                placeholder="Enter your age"
                required
              />
            </div>

            <div className="application-actions">
              <button type="submit" className="apply-submit-btn" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Application"}
              </button>
              <button
                type="button"
                className="application-back-btn"
                onClick={() => setCurrentPage("jobs")}
              >
                Back to jobs
              </button>
            </div>
          </form>

          {submitted ? <p className="application-success-message">Application submitted successfully.</p> : null}
          {submitMessage && !submitted ? <p className="application-error-message">{submitMessage}</p> : null}
        </div>
      </section>
    </main>
  );
}
