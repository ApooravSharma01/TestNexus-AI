import { Panel } from "./Panel.jsx";

export function Explanation({ report }) {
  const { intelligence, selectionReason, rejectedTestIds } = report;

  return (
    <Panel
      title="Why these tests"
      subtitle={intelligence.mode === "ai" ? "Rules first, then reviewed by AI" : "Explained by the selection rules"}
    >
      <p className="explanation">{intelligence.explanation}</p>
      <div className="callout tone-accent">
        <strong>Selection rule</strong>
        <p>{selectionReason}</p>
      </div>
      {rejectedTestIds?.length > 0 && (
        <div className="callout tone-warn">
          <strong>Rejected test ids</strong>
          <p>These ids are not in the registry, so they were dropped: {rejectedTestIds.join(", ")}.</p>
        </div>
      )}
    </Panel>
  );
}
