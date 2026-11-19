import { ratioPercent } from "../format.js";
import { Panel } from "./Panel.jsx";

function Metric({ label, value }) {
  const tone = value === 1 ? "good" : value >= 0.8 ? "warn" : "bad";

  return (
    <article className="quality-metric">
      <p className="stat-label">{label}</p>
      <p className={`stat-value text-${tone}`}>{ratioPercent(value)}</p>
    </article>
  );
}

export function QualityPanel({ evaluation, runName, runMetrics }) {
  if (!evaluation) {
    return null;
  }

  return (
    <Panel
      title="Selection quality"
      subtitle="Measured against the labeled changes. Precision is relevant tests among those selected. Recall is relevant tests that were selected. Critical recall is the same, for critical tests only."
    >
      <div className="quality-metrics">
        <Metric label="Precision" value={evaluation.averagePrecision} />
        <Metric label="Recall" value={evaluation.averageRecall} />
        <Metric label="Critical recall" value={evaluation.averageCriticalRecall} />
      </div>
      <ul className="quality-cases">
        {evaluation.cases.map((item) => (
          <li key={item.name} className={item.name === runName ? "is-current" : ""}>
            <span>{item.name}</span>
            <span className="mono">
              {ratioPercent(item.metrics.precision)} / {ratioPercent(item.metrics.recall)} / {ratioPercent(item.metrics.criticalRecall)}
            </span>
            {item.metrics.falseNegatives.length > 0 && (
              <span className="text-bad">Missed {item.metrics.falseNegatives.join(", ")}</span>
            )}
          </li>
        ))}
      </ul>
      {runMetrics && (
        <p className="panel-footnote">
          {runName}: precision {ratioPercent(runMetrics.precision)}, recall {ratioPercent(runMetrics.recall)}, critical recall {ratioPercent(runMetrics.criticalRecall)}.
          {runMetrics.falseNegatives.length > 0
            ? ` Missed ${runMetrics.falseNegatives.join(", ")}.`
            : " No relevant test was missed."}
        </p>
      )}
    </Panel>
  );
}
