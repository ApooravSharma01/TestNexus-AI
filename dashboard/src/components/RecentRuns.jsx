import { useState } from "react";

import { clock, formatDate } from "../format.js";
import { STATE, kindLabel, kindTone, resultText, runTitle } from "../automation.js";
import { FailureList } from "./FailureList.jsx";

function durationOf(run) {
  if (run.durationMs !== null && run.durationMs !== undefined) {
    return clock(run.durationMs);
  }

  if (run.startedAt) {
    return clock(Math.max(0, Date.now() - new Date(run.startedAt)));
  }

  return "-";
}

export function RecentRuns({ runs }) {
  // Cancelled runs are usually someone stopping a run they did not need, so they are hidden by default.
  const [showCancelled, setShowCancelled] = useState(false);
  const cancelledCount = runs.filter((run) => run.state === "cancelled").length;
  const visible = showCancelled ? runs : runs.filter((run) => run.state !== "cancelled");
  const isActive = (run) => run.state === "queued" || run.state === "running";

  return (
    <>
      {cancelledCount > 0 && (
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={showCancelled}
            onChange={(event) => setShowCancelled(event.target.checked)}
          />
          <span>Show cancelled runs ({cancelledCount})</span>
        </label>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Run</th>
              <th>Type</th>
              <th>Status</th>
              <th>Tests</th>
              <th className="align-right">Duration</th>
              <th>Started</th>
              <th>GitHub</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">No runs yet. Press Run suite to start one.</td>
              </tr>
            )}
            {visible.map((run) => {
              const status = STATE[run.state] || STATE.failed;

              return (
                <tr key={run.id}>
                  <td>{runTitle(run)}</td>
                  <td><span className={`pill tone-${kindTone(run.kind)}`}>{kindLabel(run.kind)}</span></td>
                  <td>
                    <span className={`status tone-${status.tone}`}>{status.label}</span>
                    {isActive(run) && run.currentStep && <div className="muted step">{run.currentStep}</div>}
                  </td>
                  <td className="mono">
                    {resultText(run.results)}
                    {run.results?.failures?.length > 0 && <FailureList failures={run.results.failures} />}
                  </td>
                  <td className="align-right mono">{durationOf(run)}</td>
                  <td>{formatDate(run.startedAt)}</td>
                  <td><a href={run.url} target="_blank" rel="noreferrer">Open run</a></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
