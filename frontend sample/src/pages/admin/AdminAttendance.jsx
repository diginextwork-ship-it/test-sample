import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { API_BASE_URL, getAdminHeaders, readJsonResponse } from "./adminApi";
import "../../styles/admin-panel.css";

const toCurrency = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });

const formatDateTime = (value) => {
  if (!value) return "Not marked";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
};

const getTodayValue = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
};

const STATUS_OPTIONS = [
  { value: "present", label: "Present" },
  { value: "half_day", label: "Half Day" },
  { value: "absent", label: "Absent" },
];

export default function AdminAttendance({ setCurrentPage }) {
  const [attendanceDate, setAttendanceDate] = useState(getTodayValue);
  const [staff, setStaff] = useState([]);
  const [summary, setSummary] = useState({
    totalStaff: 0,
    presentCount: 0,
    absentCount: 0,
    halfDayCount: 0,
    dailyExpense: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [savingRid, setSavingRid] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const loadAttendance = async (selectedDate = attendanceDate) => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/attendance?date=${encodeURIComponent(selectedDate)}`,
        {
          headers: getAdminHeaders(),
        }
      );
      const data = await readJsonResponse(response, "Failed to parse attendance response.");
      if (!response.ok) {
        throw new Error(data?.message || "Failed to fetch attendance.");
      }

      setStaff(Array.isArray(data.staff) ? data.staff : []);
      setSummary({
        totalStaff: Number(data?.summary?.totalStaff) || 0,
        presentCount: Number(data?.summary?.presentCount) || 0,
        absentCount: Number(data?.summary?.absentCount) || 0,
        halfDayCount: Number(data?.summary?.halfDayCount) || 0,
        dailyExpense: Number(data?.summary?.dailyExpense) || 0,
      });
    } catch (error) {
      setErrorMessage(error.message || "Failed to fetch attendance.");
      setStaff([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance(attendanceDate);
  }, [attendanceDate]);

  const totals = useMemo(
    () => [
      { label: "Total Staff", value: summary.totalStaff, color: "#1f2937" },
      { label: "Present", value: summary.presentCount, color: "#166534" },
      { label: "Half Day", value: summary.halfDayCount, color: "#b45309" },
      { label: "Absent", value: summary.absentCount, color: "#b91c1c" },
      { label: "Salary Expense", value: toCurrency(summary.dailyExpense), color: "#1d4ed8" },
    ],
    [summary]
  );

  const handleMarkAttendance = async (recruiterRid, status) => {
    setSavingRid(recruiterRid);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/attendance`, {
        method: "PUT",
        headers: getAdminHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          recruiterRid,
          attendanceDate,
          status,
          markedBy: "admin-panel",
        }),
      });
      const data = await readJsonResponse(response, "Failed to parse attendance update response.");
      if (!response.ok) {
        throw new Error(data?.message || "Failed to update attendance.");
      }

      setStatusMessage(`Attendance updated for ${recruiterRid}.`);
      await loadAttendance(attendanceDate);
    } catch (error) {
      setErrorMessage(error.message || "Failed to update attendance.");
    } finally {
      setSavingRid("");
    }
  };

  return (
    <AdminLayout
      title="Attendance system"
      subtitle="Mark recruiters and team leaders daily. Salary expense is synced into money_sum automatically."
      setCurrentPage={setCurrentPage}
      actions={
        <button
          type="button"
          className="admin-refresh-btn"
          onClick={() => loadAttendance(attendanceDate)}
          disabled={isLoading}
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      }
    >
      {errorMessage ? <div className="admin-alert admin-alert-error">{errorMessage}</div> : null}
      {statusMessage ? <div className="admin-alert">{statusMessage}</div> : null}

      <div className="admin-dashboard-card admin-card-large">
        <div className="admin-attendance-toolbar">
          <div>
            <label htmlFor="attendanceDate">Attendance date</label>
            <input
              id="attendanceDate"
              type="date"
              value={attendanceDate}
              onChange={(event) => setAttendanceDate(event.target.value)}
            />
          </div>
          <div className="admin-muted">
            Changing a status from `present` to `absent` removes that linked salary expense.
          </div>
        </div>
      </div>

      <div className="admin-attendance-summary-grid">
        {totals.map((item) => (
          <div key={item.label} className="admin-dashboard-card">
            <div className="admin-muted">{item.label}</div>
            <h3 style={{ margin: "8px 0 0", color: item.color }}>{item.value}</h3>
          </div>
        ))}
      </div>

      <div className="admin-dashboard-card admin-card-large">
        <h2 style={{ marginTop: 0 }}>Daily attendance</h2>
        {staff.length === 0 ? (
          <p className="admin-chart-empty">No recruiters or team leaders found.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table-wide">
              <thead>
                <tr>
                  <th>RID</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Daily Salary</th>
                  <th>Status</th>
                  <th>Expense Posted</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr key={member.rid}>
                    <td>{member.rid}</td>
                    <td>{member.name || "Unknown"}</td>
                    <td style={{ textTransform: "capitalize" }}>{member.role}</td>
                    <td>{toCurrency(member.dailySalary)}</td>
                    <td>
                      <span className={`admin-attendance-badge admin-attendance-${member.status}`}>
                        {member.status === "half_day" ? "Half Day" : member.status}
                      </span>
                    </td>
                    <td>{toCurrency(member.salaryAmount)}</td>
                    <td>{formatDateTime(member.updatedAt || member.markedAt)}</td>
                    <td>
                      <div className="admin-attendance-actions">
                        {STATUS_OPTIONS.map((option) => {
                          const isActive = member.status === option.value;
                          const isSaving = savingRid === member.rid;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              className={`admin-attendance-btn ${isActive ? "is-active" : ""}`}
                              onClick={() => handleMarkAttendance(member.rid, option.value)}
                              disabled={isSaving}
                            >
                              {isSaving && isActive ? "Saving..." : option.label}
                            </button>
                          );
                        })}
                      </div>
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
