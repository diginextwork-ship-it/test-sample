import { useMemo } from "react";

export default function SearchFilters({ filters, onFilterChange }) {
  const locationOptions = useMemo(() => {
    const known = ["", "Bengaluru", "Mumbai", "Delhi", "Pune", "Hyderabad", "Chennai"];
    return known;
  }, []);

  const updateField = (field, value) => {
    onFilterChange((prev) => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    onFilterChange({ location: "", company: "", search: "" });
  };

  return (
    <div className="recruiter-filters">
      <input
        type="text"
        value={filters.search}
        onChange={(event) => updateField("search", event.target.value)}
        placeholder="Search company or role"
      />
      <input
        type="text"
        value={filters.company}
        onChange={(event) => updateField("company", event.target.value)}
        placeholder="Filter by company"
      />
      <select
        value={filters.location}
        onChange={(event) => updateField("location", event.target.value)}
      >
        {locationOptions.map((option) => (
          <option key={option || "all"} value={option}>
            {option || "All locations"}
          </option>
        ))}
      </select>
      <button type="button" className="btn-secondary" onClick={clearFilters}>
        Clear
      </button>
    </div>
  );
}
