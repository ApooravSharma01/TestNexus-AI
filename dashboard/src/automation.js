// Labels shared by the suite runner, recent runs and pull request views.

export const STATE = {
  queued: { label: "Queued", tone: "neutral" },
  running: { label: "Running", tone: "accent" },
  passed: { label: "Passed", tone: "good" },
  failed: { label: "Failed", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "neutral" }
};

export function resultText(results) {
  if (!results || results.total === 0) {
    return "-";
  }

  return `${results.passed} / ${results.total} passed`;
}

// Says what started a run: a suite button, a pull request, or someone running the workflow by hand.
export function kindLabel(kind) {
  return { suite: "Suite", "pull-request": "Pull request", manual: "Manual" }[kind] || "Manual";
}

export function kindTone(kind) {
  return kind === "pull-request" ? "neutral" : kind === "suite" ? "accent" : "neutral";
}

export function runTitle(run) {
  if (run.kind === "pull-request" && run.pullRequest) {
    return `#${run.pullRequest.number} ${run.pullRequest.title}`;
  }

  return run.suiteLabel;
}
