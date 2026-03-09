import { useState } from "react";
import { API_BASE_URL, readJsonResponse } from "./admin/adminApi";
import { saveAuthSession } from "../auth/session";
import "../styles/recruiter-login.css";

export default function AdminLogin({ onLoginSuccess }) {
  const [adminKey, setAdminKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey }),
      });
      const data = await readJsonResponse(response, "Check VITE_API_BASE_URL and backend route setup.");
      if (!response.ok) {
        throw new Error(data?.message || "Invalid admin credentials.");
      }

      saveAuthSession({
        token: data.token,
        role: "admin",
        name: data?.admin?.name || "Admin",
      });
      onLoginSuccess?.();
    } catch (error) {
      setMessage(error.message || "Unable to login right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="recruiter-login-page ui-page">
      <section className="recruiter-login-shell ui-shell">
        <div className="recruiter-login-card">
          <h1>admin login</h1>
          <p>Sign in to access protected admin pages.</p>
          <form onSubmit={handleSubmit}>
            <label htmlFor="adminKey">Admin Key</label>
            <input
              id="adminKey"
              type="password"
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              placeholder="Enter admin key"
              required
            />
            <button type="submit" className="recruiter-login-btn" disabled={isSubmitting}>
              {isSubmitting ? "Logging in..." : "Login"}
            </button>
            {message ? <p className="job-message job-message-error">{message}</p> : null}
          </form>
        </div>
      </section>
    </main>
  );
}
