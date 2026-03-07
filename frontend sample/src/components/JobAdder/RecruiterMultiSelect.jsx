import { useMemo, useState } from "react";

export default function RecruiterMultiSelect({
  allRecruiters,
  selectedRecruiters,
  onSelectionChange,
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRecruiters = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return allRecruiters;
    return allRecruiters.filter((recruiter) => {
      const name = String(recruiter.name || "").toLowerCase();
      const email = String(recruiter.email || "").toLowerCase();
      const rid = String(recruiter.rid || "").toLowerCase();
      return (
        name.includes(normalizedSearch) ||
        email.includes(normalizedSearch) ||
        rid.includes(normalizedSearch)
      );
    });
  }, [allRecruiters, searchTerm]);

  const selectedSet = useMemo(() => new Set(selectedRecruiters), [selectedRecruiters]);
  const allVisibleSelected = filteredRecruiters.length > 0 &&
    filteredRecruiters.every((recruiter) => selectedSet.has(recruiter.rid));

  const toggleRecruiter = (rid) => {
    if (selectedSet.has(rid)) {
      onSelectionChange(selectedRecruiters.filter((id) => id !== rid));
      return;
    }
    onSelectionChange([...selectedRecruiters, rid]);
  };

  const handleToggleAll = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(filteredRecruiters.map((recruiter) => recruiter.rid));
      onSelectionChange(selectedRecruiters.filter((rid) => !visibleIds.has(rid)));
      return;
    }

    const next = [...selectedRecruiters];
    for (const recruiter of filteredRecruiters) {
      if (!selectedSet.has(recruiter.rid)) next.push(recruiter.rid);
    }
    onSelectionChange(next);
  };

  return (
    <div className="recruiter-multiselect">
      <input
        type="text"
        placeholder="Search recruiters by name/email/RID"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
      />

      <button
        type="button"
        className="recruiter-multiselect-selectall"
        onClick={handleToggleAll}
        disabled={filteredRecruiters.length === 0}
      >
        {allVisibleSelected ? "Deselect visible" : "Select visible"}
      </button>

      <div className="recruiter-multiselect-list">
        {filteredRecruiters.length === 0 ? (
          <p className="chart-empty">No recruiters found.</p>
        ) : (
          filteredRecruiters.map((recruiter) => (
            <label key={recruiter.rid} className="recruiter-multiselect-item">
              <input
                type="checkbox"
                checked={selectedSet.has(recruiter.rid)}
                onChange={() => toggleRecruiter(recruiter.rid)}
              />
              <span>
                <strong>{recruiter.name || recruiter.rid}</strong>
                <small>{recruiter.email}</small>
              </span>
              <span className="recruiter-points">{Number(recruiter.points) || 0} pts</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
