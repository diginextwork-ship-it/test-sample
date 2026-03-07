export default function PerformanceMetricCard({ title, value, color = "blue", comingSoon = false }) {
  return (
    <article className={`metric-card ${color}`}>
      <h4>{title}</h4>
      <p className={`metric-value ${comingSoon ? "pending" : ""}`}>
        {value}
        {comingSoon ? <span className="coming-soon">Coming Soon</span> : null}
      </p>
    </article>
  );
}
