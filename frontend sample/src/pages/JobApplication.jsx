import { useMemo, useState } from "react";
import "../styles/job-application.css";
import { API_BASE_URL, BACKEND_CONNECTION_ERROR } from "../config/api";
import PageBackButton from "../components/PageBackButton";

const initialFormData = {
  name: "",
  phone: "",
  email: "",
  hasPriorExperience: "",
  experienceIndustry: "",
  experienceIndustryOther: "",
  currentSalary: "",
  expectedSalary: "",
  noticePeriod: "",
  yearsOfExperience: "",
  latestEducationLevel: "",
  boardUniversity: "",
  institutionName: "",
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
  const selectedJobId = String(selectedJob?.id ?? selectedJob?.jid ?? "").trim();

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === "phone") {
      const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
      setPhoneError("");
      setFormData((prev) => ({ ...prev, [name]: digitsOnly }));
      return;
    }

    if (name === "hasPriorExperience") {
      setFormData((prev) => ({
        ...prev,
        hasPriorExperience: value,
        experienceIndustry: value === "yes" ? prev.experienceIndustry : "",
        experienceIndustryOther: value === "yes" ? prev.experienceIndustryOther : "",
        currentSalary: value === "yes" ? prev.currentSalary : "",
        expectedSalary: value === "yes" ? prev.expectedSalary : "",
        noticePeriod: value === "yes" ? prev.noticePeriod : "",
        yearsOfExperience: value === "yes" ? prev.yearsOfExperience : "",
      }));
      return;
    }

    if (name === "experienceIndustry") {
      setFormData((prev) => ({
        ...prev,
        experienceIndustry: value,
        experienceIndustryOther: value === "others" ? prev.experienceIndustryOther : "",
      }));
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
    if (!selectedJobId) {
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
        age: autofill.age || prev.age,
      }));

      const parsedPayload = {
        resumeBase64,
        resumeFilename: file.name,
        resumeMimeType: file.type,
        parsedData: data?.parsedData || null,
        atsScore: data?.atsScore ?? null,
        atsMatchPercentage: data?.atsMatchPercentage ?? null,
        atsRawJson: data?.atsRawJson || null,
      };
      setParsedResume(parsedPayload);
      setResumeMessageType("success");
      setResumeMessage("Resume parsed and form auto-filled successfully.");
      return parsedPayload;
    } catch (error) {
      if (error instanceof TypeError) {
        setResumeMessageType("error");
        setResumeMessage(BACKEND_CONNECTION_ERROR);
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

    if (!selectedJobId) {
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

    if (!["yes", "no"].includes(formData.hasPriorExperience)) {
      setSubmitMessage("Please select whether you have prior experience.");
      return;
    }

    if (formData.hasPriorExperience === "yes") {
      if (
        !formData.experienceIndustry ||
        !formData.currentSalary ||
        !formData.expectedSalary ||
        !formData.noticePeriod ||
        !formData.yearsOfExperience
      ) {
        setSubmitMessage("Please complete all prior experience fields.");
        return;
      }

      if (
        formData.experienceIndustry === "others" &&
        !String(formData.experienceIndustryOther || "").trim()
      ) {
        setSubmitMessage("Please specify the industry when selecting others.");
        return;
      }
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
          parsedData: parsedResumePayload.parsedData || null,
          atsScore: parsedResumePayload.atsScore ?? null,
          atsMatchPercentage: parsedResumePayload.atsMatchPercentage ?? null,
          atsRawJson: parsedResumePayload.atsRawJson || null,
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
        setSubmitMessage(BACKEND_CONNECTION_ERROR);
      } else {
        setSubmitMessage(error.message || "Application submission failed.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="job-application-page ui-page">
      <section className="job-application-shell ui-shell">
        <div className="ui-page-back">
          <PageBackButton setCurrentPage={setCurrentPage} fallbackPage="jobs" />
        </div>
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
              {isParsingResume ? (
                <p>Kindly be patient as the process may take a while.</p>
              ) : null}
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
              <label htmlFor="hasPriorExperience">Do you have any prior experience? *</label>
              <select
                id="hasPriorExperience"
                name="hasPriorExperience"
                value={formData.hasPriorExperience}
                onChange={handleChange}
                required
              >
                <option value="">Select</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            {formData.hasPriorExperience === "yes" ? (
              <div className="application-experience-block">
                <div className="application-field">
                  <label htmlFor="experienceIndustry">Industry *</label>
                  <select
                    id="experienceIndustry"
                    name="experienceIndustry"
                    value={formData.experienceIndustry}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select industry</option>
                    <option value="it">IT</option>
                    <option value="marketing">Marketing</option>
                    <option value="sales">Sales</option>
                    <option value="finance">Finance</option>
                    <option value="others">Others</option>
                  </select>
                </div>

                {formData.experienceIndustry === "others" ? (
                  <div className="application-field">
                    <label htmlFor="experienceIndustryOther">Please specify industry *</label>
                    <input
                      id="experienceIndustryOther"
                      name="experienceIndustryOther"
                      type="text"
                      value={formData.experienceIndustryOther}
                      onChange={handleChange}
                      placeholder="Enter industry name"
                      required
                    />
                  </div>
                ) : null}

                <div className="application-grid">
                  <div className="application-field">
                    <label htmlFor="currentSalary">Current salary *</label>
                    <input
                      id="currentSalary"
                      name="currentSalary"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.currentSalary}
                      onChange={handleChange}
                      placeholder="Enter current salary"
                      required
                    />
                  </div>

                  <div className="application-field">
                    <label htmlFor="expectedSalary">Expected salary *</label>
                    <input
                      id="expectedSalary"
                      name="expectedSalary"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.expectedSalary}
                      onChange={handleChange}
                      placeholder="Enter expected salary"
                      required
                    />
                  </div>
                </div>

                <div className="application-grid">
                  <div className="application-field">
                    <label htmlFor="noticePeriod">Notice period *</label>
                    <input
                      id="noticePeriod"
                      name="noticePeriod"
                      type="text"
                      value={formData.noticePeriod}
                      onChange={handleChange}
                      placeholder="Immediate / 30 days / 60 days"
                      required
                    />
                  </div>

                  <div className="application-field">
                    <label htmlFor="yearsOfExperience">Years of experience *</label>
                    <input
                      id="yearsOfExperience"
                      name="yearsOfExperience"
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.yearsOfExperience}
                      onChange={handleChange}
                      placeholder="Enter years of experience"
                      required
                    />
                  </div>
                </div>
              </div>
            ) : null}

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
            </div>
          </form>

          {submitted ? <p className="application-success-message">Application submitted successfully.</p> : null}
          {submitMessage && !submitted ? <p className="application-error-message">{submitMessage}</p> : null}
        </div>
      </section>
    </main>
  );
}
