// Turns run records into one row per pull request, newest first.
// Input runs must already be sorted newest first, so the first run seen for a
// pull request is its latest run. A run GitHub cannot tie to a pull request
// number still gets a row, labelled with its branch.
export function toPullRequestRows(runs, { limit = 10 } = {}) {
  const rows = [];
  const seen = new Set();

  for (const run of runs) {
    if (run.kind !== "pull-request") {
      continue;
    }

    const number = run.pullRequest?.number ?? null;
    const key = number ?? `run-${run.id}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    const selection = run.selection;
    const failures = run.results?.failures || [];

    rows.push({
      number,
      title: run.pullRequest?.title || `Branch ${run.branch || "unknown"}`,
      prState: run.pullRequest?.state || "unknown",
      prUrl: run.pullRequest?.url || run.url,
      ci: {
        state: run.state,
        currentStep: run.currentStep,
        url: run.url,
        startedAt: run.startedAt
      },
      picked: selection ? selection.pickedCount : null,
      total: selection ? selection.total : null,
      risk: selection ? selection.risk : null,
      testsRun: run.results ? run.results.total : null,
      failures
    });

    if (rows.length >= limit) {
      break;
    }
  }

  return rows;
}
