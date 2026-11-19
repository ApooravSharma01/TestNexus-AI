import { percent } from "../format.js";
import { Panel } from "./Panel.jsx";

export function SelectionFunnel({ comparison, mode, addedCount = 0 }) {
  const full = comparison.fullRegressionCount;
  const rows = [
    { label: "Full regression suite", value: full, tone: "neutral" },
    { label: "Rule-based selection", value: comparison.deterministicCount, tone: "accent-soft" },
    {
      label: mode === "ai" ? "Final selection (AI-reviewed)" : "Final selection",
      value: comparison.intelligentCount,
      tone: "accent"
    }
  ];

  return (
    <Panel
      title="Test selection"
      subtitle="How many tests each stage keeps, out of the full suite"
    >
      <div className="funnel">
        {rows.map((row) => (
          <div className="funnel-row" key={row.label}>
            <div className="funnel-meta">
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
            <div className="bar-track">
              <div
                className={`bar-fill fill-${row.tone}`}
                style={{ width: full ? `${Math.max(2, (row.value / full) * 100)}%` : "0%" }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="panel-footnote">
        {comparison.testsSaved} of {full} tests not run, {percent(comparison.testsSaved, full)} less execution.
        {" "}
        {addedCount > 0
          ? `AI added ${addedCount} ${addedCount === 1 ? "test" : "tests"} on top of the rules.`
          : "The rules made the final selection. AI did not add a test."}
      </p>
    </Panel>
  );
}
