import { formatDate } from "../format.js";
import { STATE, resultText } from "../automation.js";
import { STARTING_WINDOW_MS } from "../useAutomation.js";
import { EmptyState } from "./EmptyState.jsx";
import { Panel } from "./Panel.jsx";
import { RecentRuns } from "./RecentRuns.jsx";

const CONNECTION = {
  loading: { label: "Connecting", tone: "neutral" },
  online: { label: "Connected", tone: "good" },
  snapshot: { label: "Saved copy", tone: "warn" },
  offline: { label: "Not connected", tone: "bad" },
  error: { label: "GitHub error", tone: "bad" }
};

function SuiteCard({ suite, automation }) {
  const { connection, runs, busy, startedAt, start } = automation;
  const live = connection === "online";
  const realRuns = runs.filter((run) => run.kind !== "pull-request" && run.suiteId === suite.id);
  const active = live ? realRuns.find((run) => run.state === "queued" || run.state === "running") : null;
  const last = realRuns.find((run) => run.state !== "queued" && run.state !== "running");
  const starting = startedAt[suite.id] && Date.now() - startedAt[suite.id] < STARTING_WINDOW_MS;

  let label = "Run suite";
  let disabled = false;

  if (!live) {
    label = "Runner offline";
    disabled = true;
  } else if (active) {
    label = active.state === "queued" ? "Queued..." : "Running...";
    disabled = true;
  } else if (busy[suite.id]) {
    label = "Sending...";
    disabled = true;
  } else if (starting) {
    label = "Starting...";
    disabled = true;
  }

  return (
    <article className="suite-card">
      <div className="suite-head">
        <h3>{suite.label}</h3>
        {suite.filter && <span className="pill tone-neutral mono">{suite.filter}</span>}
      </div>
      <p className="suite-description">{suite.description}</p>
      <p className="suite-meta mono" title={`${suite.repository} - ${suite.workflow} - ${suite.ref}`}>
        {suite.repository}
      </p>
      <p className="suite-last">
        {last ? (
          <>
            <span className={`status tone-${STATE[last.state].tone}`}>{STATE[last.state].label}</span>
            <span className="muted">{resultText(last.results)}</span>
          </>
        ) : (
          <span className="muted">No run yet</span>
        )}
      </p>
      {active && (
        <p className="suite-progress">
          <span>{active.currentStep || "Starting"}</span>
          <a href={active.url} target="_blank" rel="noreferrer">Watch on GitHub</a>
        </p>
      )}
      <button
        type="button"
        className="button button-primary suite-button"
        disabled={disabled}
        onClick={() => start(suite)}
      >
        {label}
      </button>
    </article>
  );
}

export function SuiteRunner({ automation }) {
  const { connection, suites, runs, savedAt, error, message } = automation;
  const status = CONNECTION[connection];
  const showRuns = connection === "online" || connection === "snapshot";

  return (
    <Panel
      title="Run an automation suite"
      subtitle="Starts a real GitHub Actions run on the product repository and reports back here."
      action={<span className={`status tone-${status.tone}`}>{status.label}</span>}
    >
      {connection === "loading" && <p className="muted">Connecting to the suite runner...</p>}

      {connection === "offline" && (
        <EmptyState title="Suite runner not connected">
          <p>
            Suites run on GitHub Actions, and this page talks to them through the TestNexus suite runner.
            Once it is connected you can start suites here and watch them finish. This page reconnects by itself.
          </p>
          <details className="empty-details">
            <summary>How to connect it</summary>
            <p>On the machine that holds your GitHub token, run:</p>
            <code className="mono">npm run dev:all</code>
          </details>
        </EmptyState>
      )}

      {connection === "error" && (
        <EmptyState title="GitHub did not answer">
          <p>The suite runner is running, but GitHub returned an error:</p>
          <p className="muted">{error}</p>
        </EmptyState>
      )}

      {connection === "snapshot" && (
        <p className="notice suite-saved" role="status">
          Showing the saved results from {formatDate(savedAt)}. The runner is off, so the buttons are disabled.
          Start it with <code className="mono">npm run dev:all</code>.
        </p>
      )}

      {(connection === "online" || connection === "snapshot") && (
        <div className="suite-grid">
          {suites.map((suite) => (
            <SuiteCard key={suite.id} suite={suite} automation={automation} />
          ))}
        </div>
      )}

      {message && <p className={`notice tone-${message.tone} suite-message`} role="status">{message.text}</p>}

      {showRuns && (
        <>
          <h3 className="suite-subhead">Recent runs</h3>
          <RecentRuns runs={runs} />
        </>
      )}
    </Panel>
  );
}
