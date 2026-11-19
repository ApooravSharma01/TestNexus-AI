export function StatCard({ label, value, detail, tone = "neutral" }) {
  return (
    <article className="stat-card">
      <p className="stat-label">{label}</p>
      <p className={`stat-value text-${tone}`}>{value}</p>
      {detail && <p className="stat-detail">{detail}</p>}
    </article>
  );
}
