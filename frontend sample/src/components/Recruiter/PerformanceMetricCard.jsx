export default function PerformanceMetricCard({
  title,
  value,
  color = "blue",
  onClick,
  clickable = false,
}) {
  const className = `metric-card ${color}${clickable ? " metric-card-button" : ""}`;

  if (clickable) {
    return (
      <button type="button" className={className} onClick={onClick}>
        <h4>{title}</h4>
        <p className="metric-value">{value}</p>
      </button>
    );
  }

  return (
    <article className={className}>
      <h4>{title}</h4>
      <p className="metric-value">{value}</p>
    </article>
  );
}
