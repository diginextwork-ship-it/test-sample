import { useRef, useState } from "react";
import emailjs from "@emailjs/browser";
import "../styles/schedule-call.css";

const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export default function ScheduleCall() {
  const formRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!serviceId || !templateId || !publicKey) {
      setStatus({
        type: "error",
        message:
          "Email service is not configured. Please set EmailJS keys in .env before submitting.",
      });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: "", message: "" });

    try {
      await emailjs.sendForm(serviceId, templateId, formRef.current, {
        publicKey,
      });
      formRef.current.reset();
      setStatus({
        type: "success",
        message: "Your details were sent successfully. We will contact you soon.",
      });
    } catch (error) {
      const message =
        error?.text ||
        error?.message ||
        "Failed to send details. Please try again.";
      setStatus({
        type: "error",
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="schedule-call-page ui-page">
      <section className="schedule-call-container ui-shell">
        <div className="schedule-call-header">
          <h1>schedule a call</h1>
          <p>Share your details and resume, and our team will reach out.</p>
        </div>

        <form ref={formRef} className="schedule-call-form" onSubmit={handleSubmit}>
          <div className="schedule-field">
            <label htmlFor="user_name">Name</label>
            <input id="user_name" name="user_name" type="text" required />
          </div>

          <div className="schedule-grid">
            <div className="schedule-field">
              <label htmlFor="user_age">Age</label>
              <input id="user_age" name="user_age" type="number" min="14" max="100" required />
            </div>
            <div className="schedule-field">
              <label htmlFor="passing_year">Passing Year</label>
              <input
                id="passing_year"
                name="passing_year"
                type="number"
                min="1980"
                max="2100"
                required
              />
            </div>
          </div>

          <div className="schedule-grid">
            <div className="schedule-field">
              <label htmlFor="qualification_type">Qualification Status</label>
              <select id="qualification_type" name="qualification_type" required>
                <option value="">Select</option>
                <option value="Latest">Latest</option>
                <option value="Pursuing">Pursuing</option>
              </select>
            </div>
            <div className="schedule-field">
              <label htmlFor="qualification_name">Latest/Pursuing Qualification</label>
              <input id="qualification_name" name="qualification_name" type="text" required />
            </div>
          </div>

          <button className="btn btn-primary schedule-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Submit"}
          </button>

          {status.message ? (
            <p className={`schedule-status ${status.type === "error" ? "error" : "success"}`}>
              {status.message}
            </p>
          ) : null}
        </form>
      </section>
    </main>
  );
}
