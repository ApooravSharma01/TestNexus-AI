import { capitalize } from "../format.js";
import { Panel } from "./Panel.jsx";

export function Failures({ diagnosis }) {
  return (
    <Panel title="Failure analysis" subtitle="Each failure labeled as a product defect or an infrastructure problem">
      <ul className="failure-list">
        {diagnosis.map((finding) => (
          <li key={finding.title} className="failure-item">
            <div className="feature-head">
              <strong>{finding.title}</strong>
              <span className={`pill ${finding.kind === "product" ? "tone-bad" : "tone-warn"}`}>
                {capitalize(finding.kind)}
              </span>
            </div>
            <p>{finding.summary}</p>
            {finding.error && <pre className="error-block">{finding.error}</pre>}
            {finding.aiNote && <p className="muted">AI note: {finding.aiNote}</p>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
