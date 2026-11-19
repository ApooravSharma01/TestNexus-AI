import { useState } from "react";

import { duration } from "../format.js";
import { Panel } from "./Panel.jsx";

const STATUS = {
  passed: { label: "Passed", tone: "good" },
  failed: { label: "Failed", tone: "bad" },
  timedOut: { label: "Timed out", tone: "bad" },
  skipped: { label: "Not run", tone: "neutral" },
  selected: { label: "Selected", tone: "accent" }
};

function buildRows(report) {
  const results = new Map((report.execution?.results || []).map((result) => [result.title, result]));
  const addedByAi = new Set(report.intelligence?.addedTestIds || []);
  const selected = report.selectedTests.map((test) => {
    const result = results.get(test.title);

    return {
      ...test,
      selected: true,
      source: addedByAi.has(test.id) ? "Added by AI" : "Rules",
      status: result ? result.status : "selected",
      durationMs: result?.durationMs
    };
  });
  const skipped = report.skippedTests.map((test) => ({
    ...test,
    selected: false,
    status: "skipped"
  }));

  return [...selected, ...skipped];
}

export function TestResults({ report }) {
  const [filter, setFilter] = useState("all");
  const rows = buildRows(report);
  const visible = rows.filter((row) => {
    if (filter === "selected") {
      return row.selected;
    }

    if (filter === "skipped") {
      return !row.selected;
    }

    return true;
  });
  const tabs = [
    { id: "all", label: "All", count: rows.length },
    { id: "selected", label: "Selected", count: rows.filter((row) => row.selected).length },
    { id: "skipped", label: "Not run", count: rows.filter((row) => !row.selected).length }
  ];

  return (
    <Panel
      title="Regression tests"
      subtitle={report.execution ? "Selected tests and their Playwright results" : "Selected and skipped tests from the registry"}
      action={(
        <div className="tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              className={`tab ${filter === tab.id ? "is-active" : ""}`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
              <span className="tab-count">{tab.count}</span>
            </button>
          ))}
        </div>
      )}
    >
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Test</th>
              <th>Feature</th>
              <th>Priority</th>
              <th>Chosen by</th>
              <th>Status</th>
              {report.execution && <th className="align-right">Duration</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const status = STATUS[row.status] || { label: row.status, tone: "neutral" };

              return (
                <tr key={row.id} className={row.selected ? "" : "row-muted"}>
                  <td>
                    <div className="test-cell">
                      <span className="mono test-id">{row.id}</span>
                      <span>{row.title}</span>
                    </div>
                  </td>
                  <td>{row.featureId || "-"}</td>
                  <td>
                    {row.critical
                      ? <span className="pill tone-bad">Critical</span>
                      : <span className="pill tone-neutral">Standard</span>}
                  </td>
                  <td>
                    {row.source
                      ? <span className={`pill ${row.source === "Added by AI" ? "tone-accent" : "tone-neutral"}`}>{row.source}</span>
                      : <span className="muted">-</span>}
                  </td>
                  <td><span className={`status tone-${status.tone}`}>{status.label}</span></td>
                  {report.execution && (
                    <td className="align-right mono">{row.selected ? duration(row.durationMs) : "-"}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
