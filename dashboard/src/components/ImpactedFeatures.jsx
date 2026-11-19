import { Panel } from "./Panel.jsx";

export function ImpactedFeatures({ impact }) {
  return (
    <Panel title="Impacted features" subtitle="Features matched from the changed file paths">
      {impact.features.length > 0 ? (
        <ul className="feature-list">
          {impact.features.map((feature) => (
            <li key={feature.id} className="feature-item">
              <div className="feature-head">
                <strong>{feature.name}</strong>
                {feature.critical && <span className="pill tone-bad">Critical</span>}
              </div>
              <ul className="file-chips">
                {feature.files.map((file) => <li key={file} className="mono">{file}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          {impact.documentationOnly
            ? "Only documentation changed, so no product feature is affected."
            : "No changed file matched a feature in the feature map."}
        </p>
      )}
      {impact.unmatchedSourceFiles.length > 0 && (
        <div className="callout tone-warn">
          <strong>Outside the feature map</strong>
          <p>Every critical test was added because these files belong to no known feature.</p>
          <ul className="file-chips">
            {impact.unmatchedSourceFiles.map((file) => <li key={file} className="mono">{file}</li>)}
          </ul>
        </div>
      )}
    </Panel>
  );
}
