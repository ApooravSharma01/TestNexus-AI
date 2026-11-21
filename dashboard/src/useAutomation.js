import { useCallback, useEffect, useRef, useState } from "react";

// GitHub needs a few seconds to show a run that was just started.
export const STARTING_WINDOW_MS = 45000;
const FAST_POLL_MS = 8000;
const SLOW_POLL_MS = 30000;
const AFTER_START_MS = 3000;

async function readJson(url, options) {
  let response;

  try {
    response = await fetch(url, options);
  } catch {
    // The request never got an answer, so the runner is not reachable.
    const error = new Error("The suite runner is not reachable.");
    error.unreachable = true;
    throw error;
  }

  const body = await response.json().catch(() => null);

  // A static host answers unknown paths with its home page. That is not the runner either.
  if (response.ok && body === null) {
    const error = new Error("The suite runner is not reachable.");
    error.unreachable = true;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(body?.error?.message || `Request failed (${response.status})`);
    error.status = response.status;
    // No JSON body means the suite runner itself did not answer.
    error.unreachable = !body;
    throw error;
  }

  return body;
}

// The copy the suite runner saves each time it answers. Used when it is switched off.
async function readSavedCopy() {
  const response = await fetch("/suite-runs.json", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("No saved copy");
  }

  return response.json();
}

const EMPTY = {
  connection: "loading",
  suites: [],
  runs: [],
  pullRequests: [],
  savedAt: null,
  error: null
};

// What to show when the runner cannot be reached. In local development the last saved answer is shown
// (read-only). A hosted site starts clean instead of showing results from some earlier day.
async function offlineState() {
  if (import.meta.env.DEV) {
    try {
      const saved = await readSavedCopy();

      return {
        connection: "snapshot",
        suites: saved.suites,
        runs: saved.runs,
        pullRequests: saved.pullRequests,
        savedAt: saved.savedAt,
        error: null
      };
    } catch {
      // No saved copy yet.
    }
  }

  return { ...EMPTY, connection: "offline" };
}

// connection is one of:
//   loading   first request not answered yet
//   online    the suite runner answered with live GitHub data
//   snapshot  the runner is off, showing the saved copy (buttons disabled)
//   offline   the runner is off and there is no saved copy
//   error     the runner answered, but GitHub did not
export function useAutomation() {
  const [data, setData] = useState(EMPTY);
  const [busy, setBusy] = useState({});
  const [message, setMessage] = useState(null);
  const [startedAt, setStartedAt] = useState({});
  const timer = useRef(null);
  const refreshRef = useRef(() => {});
  const startedRef = useRef({});

  // There is only ever one pending timer. Every refresh and every start replaces it,
  // so the polling loop cannot be cut off by a button click.
  const scheduleNext = useCallback((delay) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => refreshRef.current(), delay);
  }, []);

  const refresh = useCallback(async () => {
    let next;

    try {
      const body = await readJson("/api/suite-runs");
      next = {
        connection: "online",
        suites: body.suites,
        runs: body.runs,
        pullRequests: body.pullRequests,
        savedAt: body.savedAt,
        error: null
      };
    } catch (error) {
      if (error.unreachable) {
        next = await offlineState();
      } else {
        next = { ...EMPTY, connection: "error", error: error.message };
      }
    }

    setData(next);

    const active = next.runs.some((run) => run.state === "queued" || run.state === "running");
    const starting = Object.values(startedRef.current).some((time) => Date.now() - time < STARTING_WINDOW_MS);
    const fast = next.connection === "online" && (active || starting);
    scheduleNext(fast ? FAST_POLL_MS : SLOW_POLL_MS);
  }, [scheduleNext]);

  useEffect(() => {
    refreshRef.current = refresh;
    refresh();

    return () => {
      clearTimeout(timer.current);
      refreshRef.current = () => {};
    };
  }, [refresh]);

  const start = useCallback(async (suite) => {
    setBusy((current) => ({ ...current, [suite.id]: true }));
    setMessage(null);

    try {
      await readJson(`/api/suites/${suite.id}/run`, { method: "POST" });
      startedRef.current = { ...startedRef.current, [suite.id]: Date.now() };
      setStartedAt(startedRef.current);
      setMessage({
        tone: "good",
        text: `${suite.label} was sent to GitHub Actions. It appears in Recent runs in a few seconds.`
      });
      scheduleNext(AFTER_START_MS);
    } catch (error) {
      setMessage({ tone: "bad", text: error.message });
    } finally {
      setBusy((current) => ({ ...current, [suite.id]: false }));
    }
  }, [scheduleNext]);

  return { ...data, busy, message, startedAt, start };
}
