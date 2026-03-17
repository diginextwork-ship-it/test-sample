import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import { API_BASE_URL, getAdminHeaders, readJsonResponse } from "./adminApi";
import "../../styles/admin-panel.css";

const toCurrency = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const REASON_OPTIONS = [
  { value: "electricity bill", label: "Electricity bill" },
  { value: "salary", label: "Salary" },
  { value: "rent", label: "Rent" },
  { value: "extras", label: "Extras" },
  { value: "others", label: "Others" },
];

export default function AdminRevenue({ setCurrentPage }) {
  const [entries, setEntries] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [reimbursements, setReimbursements] = useState([]);
  const [summary, setSummary] = useState({ totalIntake: 0, totalExpense: 0, netProfit: 0 });
  const [searchFilters, setSearchFilters] = useState({
    fromDate: "",
    toDate: "",
    reason: "",
  });
  const [formData, setFormData] = useState({
    entryType: "expense",
    amount: "",
    reasonCategory: "electricity bill",
    otherReason: "",
    recruiterRid: "",
    photoFile: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState(null);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [decisionBusyId, setDecisionBusyId] = useState(null);

  const loadRevenue = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/revenue`, {
        headers: getAdminHeaders(),
      });
      const data = await readJsonResponse(
        response,
        "Check VITE_API_BASE_URL and ensure backend admin revenue routes are running."
      );
      if (!response.ok) {
        throw new Error(data?.message || "Failed to fetch revenue dashboard.");
      }

      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setSummary({
        totalIntake: Number(data?.summary?.totalIntake) || 0,
        totalExpense: Number(data?.summary?.totalExpense) || 0,
        netProfit: Number(data?.summary?.netProfit) || 0,
      });
    } catch (error) {
      setErrorMessage(error.message || "Failed to fetch revenue dashboard.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadReimbursements = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/reimbursements`, {
        headers: getAdminHeaders(),
      });
      const data = await readJsonResponse(response, "Failed to parse reimbursements response.");
      if (!response.ok) {
        throw new Error(data?.message || "Failed to fetch reimbursements.");
      }
      setReimbursements(Array.isArray(data.reimbursements) ? data.reimbursements : []);
    } catch (error) {
      setReimbursements([]);
      setErrorMessage(error.message || "Failed to fetch reimbursements.");
    }
  };

  const loadRecruiters = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/recruiters/list`, {
        headers: getAdminHeaders(),
      });
      const data = await readJsonResponse(response, "Failed to parse recruiters list.");
      if (!response.ok) {
        throw new Error(data?.message || "Failed to fetch recruiters list.");
      }
      setRecruiters(Array.isArray(data.recruiters) ? data.recruiters : []);
    } catch (error) {
      setRecruiters([]);
      setErrorMessage(error.message || "Failed to fetch recruiters list.");
    }
  };

  useEffect(() => {
    loadRevenue();
    loadRecruiters();
    loadReimbursements();
  }, []);

  const filteredEntries = entries.filter((item) => {
    const fromDateQuery = searchFilters.fromDate.trim();
    const toDateQuery = searchFilters.toDate.trim();
    const reasonQuery = searchFilters.reason.trim().toLowerCase();
    const itemReason = String(item.reason || "").toLowerCase();
    const itemDate = item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : "";

    const matchesFromDate = fromDateQuery ? itemDate >= fromDateQuery : true;
    const matchesToDate = toDateQuery ? itemDate <= toDateQuery : true;
    const matchesReason = reasonQuery ? itemReason.includes(reasonQuery) : true;

    return matchesFromDate && matchesToDate && matchesReason;
  });

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => {
      if (name === "reasonCategory") {
        return {
          ...prev,
          reasonCategory: value,
          otherReason: value === "others" ? prev.otherReason : "",
          recruiterRid: value === "salary" ? prev.recruiterRid : "",
        };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleSearchChange = (event) => {
    const { name, value } = event.target;
    setSearchFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setFormData((prev) => ({ ...prev, photoFile: file }));
  };

  const handleAddEntry = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const payload = new FormData();
      payload.append("entryType", formData.entryType);
      payload.append("amount", String(Number(formData.amount)));
      payload.append("reasonCategory", formData.reasonCategory);
      if (formData.reasonCategory === "others") {
        payload.append("otherReason", formData.otherReason.trim());
      }
      if (formData.reasonCategory === "salary" && formData.recruiterRid) {
        payload.append("recruiterRid", formData.recruiterRid);
      }
      if (formData.photoFile) {
        payload.append("photo", formData.photoFile);
      }

      const response = await fetch(`${API_BASE_URL}/api/admin/revenue/entries`, {
        method: "POST",
        headers: getAdminHeaders(),
        body: payload,
      });
      const data = await readJsonResponse(
        response,
        "Failed to parse add revenue entry response."
      );
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Failed to add revenue entry.");
      }

      setStatusMessage("Revenue entry added.");
      setFormData((prev) => ({
        ...prev,
        amount: "",
        reasonCategory: "electricity bill",
        otherReason: "",
        recruiterRid: "",
        photoFile: null,
      }));
      setUploadInputKey((prev) => prev + 1);
      try {
        await loadRevenue();
      } catch {}
    } catch (error) {
      setErrorMessage(error.message || "Failed to add revenue entry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntry = async (entryId) => {
    const confirmed = window.confirm(`Remove revenue entry #${entryId}?`);
    if (!confirmed) return;

    setIsDeletingId(entryId);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/revenue/entries/${entryId}`, {
        method: "DELETE",
        headers: getAdminHeaders(),
      });
      const data = await readJsonResponse(
        response,
        "Failed to parse delete revenue entry response."
      );
      if (!response.ok) {
        throw new Error(data?.message || "Failed to remove revenue entry.");
      }

      setStatusMessage(`Revenue entry #${entryId} removed.`);
      await loadRevenue();
    } catch (error) {
      setErrorMessage(error.message || "Failed to remove revenue entry.");
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleReimbursementDecision = async (id, decision) => {
    setDecisionBusyId(id);
    setStatusMessage("");
    setErrorMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/reimbursements/${id}/decision`, {
        method: "POST",
        headers: { ...getAdminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await readJsonResponse(response, "Failed to parse reimbursement decision response.");
      if (!response.ok) {
        throw new Error(data?.message || "Failed to update reimbursement.");
      }
      setStatusMessage(`Reimbursement #${id} marked as ${decision}.`);
      await Promise.all([loadReimbursements(), loadRevenue()]);
    } catch (error) {
      setErrorMessage(error.message || "Failed to update reimbursement.");
    } finally {
      setDecisionBusyId(null);
    }
  };

  return (
    <AdminLayout
      title="Revenue dashboard"
      subtitle="Track money intake and expenses including salaries, electricity bills, and client payments."
      setCurrentPage={setCurrentPage}
      actions={
        <button type="button" className="admin-refresh-btn" onClick={loadRevenue} disabled={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      }
    >
      {errorMessage ? <div className="admin-alert admin-alert-error">{errorMessage}</div> : null}
      {statusMessage ? <div className="admin-alert">{statusMessage}</div> : null}

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div className="admin-dashboard-card">
          <div className="admin-muted">Total Intake</div>
          <h3 style={{ margin: "8px 0 0", color: "#166534" }}>{toCurrency(summary.totalIntake)}</h3>
        </div>
        <div className="admin-dashboard-card">
          <div className="admin-muted">Total Expense</div>
          <h3 style={{ margin: "8px 0 0", color: "#b91c1c" }}>{toCurrency(summary.totalExpense)}</h3>
        </div>
        <div className="admin-dashboard-card">
          <div className="admin-muted">Net Profit</div>
          <h3 style={{ margin: "8px 0 0", color: summary.netProfit >= 0 ? "#1d4ed8" : "#b91c1c" }}>
            {toCurrency(summary.netProfit)}
          </h3>
        </div>
      </div>

      <div className="admin-dashboard-card admin-card-large">
        <form onSubmit={handleAddEntry} className="admin-form">
          <h2 style={{ marginTop: 0 }}>Add revenue entry</h2>
          <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div>
              <label htmlFor="entryType">Entry Type</label>
              <select
                id="entryType"
                name="entryType"
                value={formData.entryType}
                onChange={handleInputChange}
                required
              >
                <option value="expense">Expense (money going out)</option>
                <option value="intake">Intake (money coming in)</option>
              </select>
            </div>
            <div>
              <label htmlFor="amount">Amount</label>
              <input
                id="amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={formData.amount}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <label htmlFor="reasonCategory">Reason</label>
              <select
                id="reasonCategory"
                name="reasonCategory"
                value={formData.reasonCategory}
                onChange={handleInputChange}
                required
              >
                {REASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {formData.reasonCategory === "salary" ? (
              <div>
                <label htmlFor="recruiterRid">RID and staff member</label>
                <select
                  id="recruiterRid"
                  name="recruiterRid"
                  value={formData.recruiterRid}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select recruiter</option>
                  {recruiters.map((recruiter) => (
                    <option key={recruiter.rid} value={recruiter.rid}>
                      {recruiter.rid} - {recruiter.name || "Unknown"}{recruiter.role ? ` (${recruiter.role})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {formData.reasonCategory === "others" ? (
              <div>
                <label htmlFor="otherReason">Specify reason</label>
                <input
                  id="otherReason"
                  name="otherReason"
                  value={formData.otherReason}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter custom reason"
                />
              </div>
            ) : null}
            <div>
              <label htmlFor="photo">Attachment (optional image/PDF)</label>
              <input
                key={uploadInputKey}
                id="photo"
                name="photo"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/*,application/pdf"
                onChange={handleFileChange}
              />
            </div>
          </div>
          <button type="submit" className="admin-create-btn" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Add Entry"}
          </button>
        </form>
      </div>

      <div className="admin-dashboard-card admin-card-large">
        <h2 style={{ marginTop: 0 }}>Reimbursement requests</h2>
        {reimbursements.length === 0 ? (
          <p className="admin-chart-empty">No reimbursement requests yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table-wide">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>RID</th>
                  <th>Role</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reimbursements.map((item) => (
                  <tr key={item.id}>
                    <td>#{item.id}</td>
                    <td>{item.rid}</td>
                    <td>{item.role}</td>
                    <td>{toCurrency(item.amount)}</td>
                    <td>{item.description || "N/A"}</td>
                    <td>{item.status}</td>
                    <td>{formatDate(item.updatedAt || item.createdAt)}</td>
                    <td>
                      {item.status === "pending" ? (
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            className="admin-create-btn"
                            onClick={() => handleReimbursementDecision(item.id, "accepted")}
                            disabled={decisionBusyId === item.id}
                          >
                            {decisionBusyId === item.id ? "Saving..." : "Accept"}
                          </button>
                          <button
                            type="button"
                            className="admin-back-btn"
                            onClick={() => handleReimbursementDecision(item.id, "rejected")}
                            disabled={decisionBusyId === item.id}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className={`status-pill status-${item.status}`}>{item.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-dashboard-card admin-card-large">
        <h2 style={{ marginTop: 0 }}>Revenue entries</h2>
        <div
          style={{
            display: "grid",
            gap: "12px",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            marginBottom: "16px",
          }}
        >
          <div>
            <label htmlFor="expenseSearchFromDate">From date</label>
            <input
              id="expenseSearchFromDate"
              name="fromDate"
              type="date"
              value={searchFilters.fromDate}
              onChange={handleSearchChange}
            />
          </div>
          <div>
            <label htmlFor="expenseSearchToDate">To date</label>
            <input
              id="expenseSearchToDate"
              name="toDate"
              type="date"
              value={searchFilters.toDate}
              onChange={handleSearchChange}
            />
          </div>
          <div>
            <label htmlFor="expenseSearchReason">Search by reason</label>
            <input
              id="expenseSearchReason"
              name="reason"
              type="text"
              value={searchFilters.reason}
              onChange={handleSearchChange}
              placeholder="e.g. salary, rent, electricity"
            />
          </div>
        </div>
        {entries.length === 0 ? (
          <p className="admin-chart-empty">No entries recorded yet.</p>
        ) : filteredEntries.length === 0 ? (
          <p className="admin-chart-empty">No revenue entries match the current search.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table-wide">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Intake</th>
                  <th>Expense</th>
                  <th>Profit (running)</th>
                  <th>Reason</th>
                  <th>Attachment</th>
                  <th>Created At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((item) => (
                  <tr key={item.id}>
                    <td>#{item.id}</td>
                    <td>{item.entryType}</td>
                    <td>{toCurrency(item.companyRev)}</td>
                    <td>{toCurrency(item.expense)}</td>
                    <td>{toCurrency(item.profit)}</td>
                    <td>{item.reason || "N/A"}</td>
                    <td>
                      {item.photo ? (
                        <a href={item.photo} target="_blank" rel="noreferrer">
                          View
                        </a>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-back-btn"
                        onClick={() => handleDeleteEntry(item.id)}
                        disabled={isDeletingId === item.id}
                      >
                        {isDeletingId === item.id ? "Removing..." : "Remove"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
