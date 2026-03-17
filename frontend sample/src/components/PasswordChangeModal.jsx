import { useState } from "react";
import "../styles/password-change-modal.css";
import { API_BASE_URL } from "../config/api";
import { getAuthSession } from "../auth/session";

export default function PasswordChangeModal({
  isOpen,
  onClose,
  recruiterName,
  recruiterId,
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const validatePasswords = () => {
    if (!newPassword) {
      setMessageType("error");
      setMessage("Please enter a new password.");
      return false;
    }

    if (newPassword.length < 6) {
      setMessageType("error");
      setMessage("Password must be at least 6 characters long.");
      return false;
    }

    if (newPassword !== confirmPassword) {
      setMessageType("error");
      setMessage("Passwords do not match.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setMessageType("");

    if (!validatePasswords()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const session = getAuthSession();
      const token = session?.token || "";

      const response = await fetch(
        `${API_BASE_URL}/api/recruiters/${recruiterId}/change-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            newPassword,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to change password");
      }

      setMessageType("success");
      setMessage("Password changed successfully!");

      // Clear form after success
      setNewPassword("");
      setConfirmPassword("");

      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      setMessageType("error");
      setMessage(
        error.message || "Unable to change password. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="password-change-modal-overlay">
      <div className="password-change-modal">
        <div className="password-change-modal-header">
          <h2>Change Your Password</h2>
          <p className="password-change-modal-subtitle">
            Hello <strong>{recruiterName}</strong>, please create a new password
            for your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="password-change-form">
          <div className="password-field-group">
            <label htmlFor="new-password">New Password</label>
            <div className="password-input-wrapper">
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (minimum 6 characters)"
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isSubmitting}
                tabIndex="-1"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="password-field-group">
            <label htmlFor="confirm-password">Confirm Password</label>
            <div className="password-input-wrapper">
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isSubmitting}
                tabIndex="-1"
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {message && (
            <div className={`password-change-message ${messageType}`}>
              {message}
            </div>
          )}

          <button
            type="submit"
            className="password-change-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Changing Password..." : "Change Password"}
          </button>
        </form>

        <p className="password-change-modal-note">
          This is required on your first login. Please make sure to remember
          your new password.
        </p>
      </div>
    </div>
  );
}
