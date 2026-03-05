import { useState } from "react";
import AdminLayout from "./AdminLayout";
import { API_BASE_URL, getAdminHeaders, readJsonResponse } from "./adminApi";
import "../../styles/admin-panel.css";

export default function AdminCreateRecruiter({ setCurrentPage }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("recruiter");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/recruiters`, {
        method: "POST",
        headers: getAdminHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await readJsonResponse(response, `Check API base URL: ${API_BASE_URL}`);

      if (!response.ok) {
        throw new Error(data?.message || "Failed to create recruiter.");
      }

      setMessageType("success");
      setMessage(`Recruiter created successfully. Generated RID: ${data.recruiter.rid}`);
      setName("");
      setEmail("");
      setPassword("");
      setRole("recruiter");
    } catch (error) {
      if (error instanceof TypeError) {
        setMessageType("error");
        setMessage("Cannot connect to backend. Ensure API is running on port 8080.");
        return;
      }
      setMessageType("error");
      setMessage(error.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout
      title="Create recruiter"
      subtitle="Provision new recruiter access with the right permissions."
      setCurrentPage={setCurrentPage}
    >
      <div className="admin-panel-card admin-card-large">
        <form onSubmit={handleSubmit} className="admin-form">
          <label htmlFor="newRecruiterName">Recruiter Name</label>
          <input
            id="newRecruiterName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Recruiter full name"
            required
          />

          <label htmlFor="newRecruiterEmail">Recruiter Email</label>
          <input
            id="newRecruiterEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="recruiter@company.com"
            required
          />

          <label htmlFor="newRecruiterPassword">Temporary Password</label>
          <div className="admin-password-input-wrap">
            <input
              id="newRecruiterPassword"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Set temporary password"
              required
            />
            <button
              type="button"
              className="admin-password-toggle-btn"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M3 3l18 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M10.58 10.58a2 2 0 1 0 2.83 2.83"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9.88 5.08A10.9 10.9 0 0 1 12 4.9c5.25 0 8.85 3.97 10 7.1a12.64 12.64 0 0 1-3.12 4.49M6.6 6.6A13.4 13.4 0 0 0 2 12c1.15 3.13 4.75 7.1 10 7.1 1.87 0 3.5-.5 4.94-1.27"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M2 12s3.6-7.1 10-7.1S22 12 22 12s-3.6 7.1-10 7.1S2 12 2 12z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                </svg>
              )}
            </button>
          </div>

          <label htmlFor="recruiterRole">Role</label>
          <select
            id="recruiterRole"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
          >
            <option value="job creator">Job Creator</option>
            <option value="recruiter">Recruiter</option>
          </select>

          <button type="submit" className="admin-create-btn" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Recruiter"}
          </button>

          {message ? (
            <p
              className={`admin-form-message ${
                messageType === "success" ? "admin-form-success" : "admin-form-error"
              }`}
            >
              {message}
            </p>
          ) : null}
        </form>
      </div>
    </AdminLayout>
  );
}
