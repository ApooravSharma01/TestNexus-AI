import { useCallback, useEffect, useRef, useState } from "react";

import { clock, formatDate } from "../format.js";
import { Panel } from "./Panel.jsx";

const STATE = {
  queued: { label: "Queued", tone: "neutral" },
  running: { label: "Running", tone: "accent" },
  passed: { label: "Passed", tone: "good" },
  failed: { label: "Failed", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "neutral" }
};

// GitHub needs a few seconds to show a run that was just started.
const STARTING_WINDOW_MS = 45000;
const FAST_POLL_MS = 8000;
const SLOW_POLL_MS = 30000;

async function readJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(body?.error?.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.unreachable = !body;
    throw error;
  }

  return body;
}

function resultText(results) {
  if (!results || results.total === 0) {
    return "-";
  }

  return `${results.passed} / ${results.total} passed`;
}

export function SuiteRunner() {
  const [connection, setConnection] = useState("loading");
  const [suites, setSuites] = useState([]);
  const [runs, setRuns] = useState([]);
  const [startedAt, setStartedAt] = useState({});
  const [busy, setBusy] = useState({});
  const [message, setMessage] = useState(null);
  const timer = useRef(null);
  const runsRef = useRef([]);
  const startedRef = useRef({});

  const refresh = useCallback(async () => {
    try {
      const suiteBody = await readJson("/api/suites");
      setSuites(suiteBody.suites);
      setConnection("online");

      try {
        const runBody = await readJson("/api/suite-runs");
        setRuns(runBody.runs);
        runsRef.current = runBody.runs;
        setMessage((current) => (current?.tone === "bad" && current.sticky ? current : null));
      } catch (error) {
        setMessage({ tone: "bad", text: error.message });
      }
    } catch (error) {
      setConnection(error.unreachable || error.name === "TypeError" ? "offline" : "error");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loop() {
      await refresh();

      if (cancelled) {
        return;
      }

      const active = runsRef.current.some((run) => run.state === "queued" || run.state === "running");
      const starting = Object.values(startedRef.current).some((time) => Date.now() - time < STARTING_WINDOW_MS);
      timer.current = setTimeout(loop, active || starting ? FAST_POLL_MS : SLOW_POLL_MS);
    }

    loop();

    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
  }, [refresh]);

  async function start(suite) {
    setBusy((current) => ({ ...current, [suite.id]: true }));
    setMessage(null);

    try {
      await readJson(`/api/suites/${suite.id}/run`, { method: "POST" });
      const now = Date.now();
      startedRef.current = { ...startedRef.current, [suite.id]: now };
      setStartedAt(startedRef.current);
      setMessage({ tone: "good", text: `${suite.label} was sent to GitHub Actions. It will show up below in a few seconds.` });
      clearTimeout(timer.current);
      timer.current = setTimeout(refresh, 4000);
    } catch (error) {
      setMessage({ tone: "bad", sticky: true, text: error.message });
    } finally {
      setBusy((current) => ({ ...current, [suite.id]: false }));
    }
  }

  function cardState(suite) {
    const active = runs.find((run) => run.suiteId === suite.id && (run.state === "queued" || run.state === "running"));

    if (active) {
      return { disabled: true, label: STATE[active.state].label + "...", run: active };
    }

    if (busy[suite.id]) {
      return { disabled: true, label: "Sending..." };
    }

    if (startedAt[suite.id] && Date.now() - startedAt[suite.id] < STARTING_WINDOW_MS) {
      return { disabled: true, label: "Starting..." };
    }

    return { disabled: false, label: "Run suite" };
  }

  const online = connection === "online";

  return (
    <Panel
      title="Run an automation suite"
      subtitle="Starts a real GitHub Actions run on the product repository and reports back here."
      action={(
        <span className={`status tone-${online ? "good" : connection === "loading" ? "neutral" : "bad"}`}>
          {online ? "Connected" : connection === "loading" ? "Connecting" : "Not connected"}
        </span>
      )}
    >
      {(connection === "offline" || connection === "error") && (
        <div className="suite-offline">
          <p>The suite runner is not reachable, so the buttons are off.</p>
          <p className="muted">Start it in another terminal, then this page reconnects by itself:</p>
          <code className="mono">npm run suites:server</code>
        </div>
      )}

      {online && (
        <div className="suite-grid">
          {suites.map((suite) => {
            const state = cardState(suite);
            const last = runs.find((run) => run.suiteId === suite.id && run.state !== "queued" && run.state !== "running");

            return (
              <article key={suite.id} className="suite-card">
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
                <button
                  type="button"
                  className="button button-primary suite-button"
                  disabled={state.disabled}
                  onClick={() => start(suite)}
                >
                  {state.label}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {message && <p className={`notice tone-${message.tone} suite-message`} role="status">{message.text}</p>}

      {online && (
        <>
          <h3 className="suite-subhead">Recent runs</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Suite</th>
                  <th>Status</th>
                  <th>Tests</th>
                  <th className="align-right">Duration</th>
                  <th>Started</th>
                  <th>GitHub</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">No runs yet. Press Run suite to start one.</td>
                  </tr>
                )}
                {runs.map((run) => {
                  const status = STATE[run.state];

                  return (
                    <tr key={run.id}>
                      <td>{run.suiteLabel}</td>
                      <td><span className={`status tone-${status.tone}`}>{status.label}</span></td>
                      <td className="mono">{resultText(run.results)}</td>
                      <td className="align-right mono">{run.durationMs === null ? "-" : clock(run.durationMs)}</td>
                      <td>{formatDate(run.startedAt)}</td>
                      <td><a href={run.url} target="_blank" rel="noreferrer">Open run</a></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}
