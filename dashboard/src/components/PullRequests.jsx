import { capitalize, formatDate, riskTone } from "../format.js";
import { STATE } from "../automation.js";
import { EmptyState } from "./EmptyState.jsx";
import { FailureList } from "./FailureList.jsx";
import { Panel } from "./Panel.jsx";

const PR_TONE = { open: "good", merged: "accent", closed: "neutral", unknown: "neutral" };

export function PullRequests({ automation }) {
  const { connection, pullRequests, error } = automation;
  const hasRows = connection === "online" || connection === "snapshot";

  return (
    <Panel
      title="Pull requests"
      subtitle="Each pull request TestNexus looked at: what it chose to run, how CI went, and what failed."
    >
      {connection === "loading" && <p className="muted">Loading pull requests...</p>}

      {connection === "offline" && (
        <EmptyState title="Waiting for the suite runner">
          <p>
            Pull request activity appears here once the suite runner is connected. It shows each pull request,
            the tests TestNexus picked for it, and how CI went.
          </p>
        </EmptyState>
      )}

      {connection === "error" && (
        <EmptyState title="GitHub did not answer">
          <p className="muted">{error}</p>
        </EmptyState>
      )}

      {connection === "snapshot" && (
        <p className="notice" role="status">Showing saved results. Start the runner to refresh.</p>
      )}

      {hasRows && pullRequests.length === 0 && (
        <EmptyState title="No pull requests yet">
          <p>When a pull request changes the order code, its TestNexus decision appears here.</p>
        </EmptyState>
      )}

      {hasRows && pullRequests.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pull request</th>
                <th>CI</th>
                <th>TestNexus picked</th>
                <th>Risk</th>
                <th>Failures</th>
                <th>Last run</th>
              </tr>
            </thead>
            <tbody>
              {pullRequests.map((row) => {
                const ci = STATE[row.ci.state] || STATE.failed;
                const running = row.ci.state === "queued" || row.ci.state === "running";

                return (
                  <tr key={row.number}>
                    <td>
                      {row.number !== null && (
                        <a href={row.prUrl} target="_blank" rel="noreferrer">#{row.number}</a>
                      )} {row.title}
                      <div>
                        {row.number !== null && (
                          <span className={`pill tone-${PR_TONE[row.prState] || "neutral"}`}>{capitalize(row.prState)}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`status tone-${ci.tone}`}>{ci.label}</span>
                      {running && row.ci.currentStep && <div className="muted step">{row.ci.currentStep}</div>}
                      {row.ci.url && <div><a href={row.ci.url} target="_blank" rel="noreferrer">Open run</a></div>}
                    </td>
                    <td className="mono">{row.picked === null ? "-" : `${row.picked} of ${row.total}`}</td>
                    <td>
                      {row.risk?.level ? (
                        <span className={`pill tone-${riskTone(row.risk.level)}`}>
                          {capitalize(row.risk.level)}{row.risk.score !== null ? ` ${row.risk.score}` : ""}
                        </span>
                      ) : "-"}
                    </td>
                    <td>{row.testsRun === null ? "-" : <FailureList failures={row.failures} />}</td>
                    <td>{formatDate(row.ci.startedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
