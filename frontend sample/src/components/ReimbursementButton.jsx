import { useEffect, useState } from "react";
import {
  submitReimbursement,
  fetchMyReimbursements,
} from "../services/reimbursementService";
import { useNotification } from "../context/NotificationContext";
import "../styles/reimbursement.css";

export default function ReimbursementButton({ visible = true }) {
  const { addNotification } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [statusList, setStatusList] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      setLoadingStatus(true);
      try {
        const data = await fetchMyReimbursements();
        setStatusList(
          Array.isArray(data.reimbursements) ? data.reimbursements : [],
        );
      } catch (err) {
        setError(err.message || "Failed to load reimbursements.");
      } finally {
        setLoadingStatus(false);
      }
    };
    load();
  }, [isOpen]);

  const resetForm = () => {
    setAmount("");
    setDescription("");
    setError("");
  };

  const handleSubmit = async () => {
    setError("");
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a positive amount.");
      return;
    }

    setSubmitting(true);
    try {
      await submitReimbursement(value, description);
      addNotification(
        `Reimbursement of Rs. ${value.toFixed(2)} submitted successfully`,
        "success",
        5000,
      );
      resetForm();
      const data = await fetchMyReimbursements();
      setStatusList(
        Array.isArray(data.reimbursements) ? data.reimbursements : [],
      );
    } catch (err) {
      setError(err.message || "Failed to submit reimbursement.");
      addNotification(
        err.message || "Failed to submit reimbursement.",
        "error",
        5000,
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="reimbursement-card">
      <button
        type="button"
        className="btn-reimb"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        Apply for rembruisement
      </button>

      {isOpen ? (
        <div className="reimb-form">
          <div className="reimb-fields">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Add amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <input
              type="text"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {error ? <p className="reimb-error">{error}</p> : null}
          <div className="reimb-actions">
            <button
              type="button"
              className="btn-reimb-submit"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>

          <div className="reimb-status">
            <h4>My requests</h4>
            {loadingStatus ? <p className="reimb-muted">Loading...</p> : null}
            {!loadingStatus && statusList.length === 0 ? (
              <p className="reimb-muted">No requests yet.</p>
            ) : null}
            {!loadingStatus && statusList.length > 0 ? (
              <table className="reimb-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {statusList.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>Rs. {Number(item.amount || 0).toFixed(2)}</td>
                      <td className={`status-pill status-${item.status}`}>
                        {item.status}
                      </td>
                      <td>
                        {new Date(
                          item.updatedAt || item.createdAt,
                        ).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
