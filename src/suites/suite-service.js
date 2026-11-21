import { AppError } from "../utils/app-error.js";
import { logger } from "../utils/logger.js";
import { createGitHubClient } from "../integrations/github/github-client.js";
import { describeSuite } from "./suite-registry.js";
import { readZipEntry, summarizePlaywrightResults, summarizeSelection } from "./results-reader.js";
import { toPullRequestRows } from "./pull-request-rows.js";

const PULL_REQUEST_CACHE_MS = 60 * 1000;
const QUEUED_STATUSES = ["queued", "waiting", "pending", "requested"];
const PULL_REQUEST_SCAN_LIMIT = 30;
const PULL_REQUEST_ROW_LIMIT = 10;
const RUN_LIST_LIMIT = 20;

function toRunState(run) {
  if (run.status === "completed") {
    if (run.conclusion === "success") {
      return "passed";
    }

    return run.conclusion === "cancelled" ? "cancelled" : "failed";
  }

  return QUEUED_STATUSES.includes(run.status) ? "queued" : "running";
}

function toAppError(error, fallbackMessage) {
  if (error instanceof AppError) {
    return error;
  }

  const status = error.status || 500;

  if (status === 401 || status === 403) {
    return new AppError(
      "GitHub refused the request. The token needs repo and workflow access to this repository.",
      status,
      "GITHUB_AUTHENTICATION_FAILED"
    );
  }

  if (status === 404) {
    return new AppError("The repository or workflow was not found on GitHub", 404, "GITHUB_RESOURCE_NOT_FOUND");
  }

  if (status === 422) {
    return new AppError(
      "GitHub could not start the workflow. Check that it has a workflow_dispatch trigger and accepts these inputs.",
      422,
      "WORKFLOW_DISPATCH_REJECTED"
    );
  }

  logger.error("GitHub request failed", { statusCode: status, reason: error.message });
  return new AppError(fallbackMessage, status, "GITHUB_API_ERROR");
}

function workflowKey(suite) {
  return `${suite.repository.owner}/${suite.repository.name}/${suite.workflow}`;
}

// Keeps the first item for each key, so each workflow is queried once.
function firstPerKey(items, keyOf) {
  const map = new Map();

  for (const item of items) {
    const key = keyOf(item);

    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return [...map.values()];
}

function pullRequestNumber(run) {
  return run.pull_requests?.[0]?.number ?? null;
}

export function createSuiteService({ suites, client } = {}) {
  if (!Array.isArray(suites)) {
    throw new AppError("Suites must be provided", 500, "SUITE_REGISTRY_INVALID");
  }

  const github = client || createGitHubClient();
  // A finished run never changes, so its results are read once.
  const finishedCache = new Map();
  const pullRequestCache = new Map();
  const dispatchTargets = firstPerKey(suites, (suite) => `${workflowKey(suite)}@${suite.ref}`);
  const pullRequestTargets = firstPerKey(suites, workflowKey);

  function findSuite(id) {
    const suite = suites.find((candidate) => candidate.id === id);

    if (!suite) {
      throw new AppError(`Unknown suite "${id}"`, 404, "SUITE_NOT_FOUND");
    }

    return suite;
  }

  function suiteForRun(run) {
    return suites.find((suite) => {
      const { suite: name, grep } = suite.inputs || {};
      return name && run.display_title?.includes(`${name} (${grep || "all tests"})`);
    });
  }

  async function fetchRuns(suite, params) {
    const { owner, name: repo } = suite.repository;

    try {
      const response = await github.rest.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id: suite.workflow,
        ...params
      });

      return response.data.workflow_runs;
    } catch (error) {
      throw toAppError(error, "Could not read workflow runs from GitHub");
    }
  }

  // Manual suite runs and pull-request runs, newest first, each paired with the suite that owns its workflow.
  async function collectRuns() {
    const dispatched = await Promise.all(dispatchTargets.map(async (suite) => {
      const runs = await fetchRuns(suite, {
        event: "workflow_dispatch",
        branch: suite.ref,
        per_page: RUN_LIST_LIMIT
      });
      return runs.map((run) => ({ run, suite }));
    }));
    const pulled = await Promise.all(pullRequestTargets.map(async (suite) => {
      const runs = await fetchRuns(suite, {
        event: "pull_request",
        per_page: PULL_REQUEST_SCAN_LIMIT
      });
      return runs.map((run) => ({ run, suite }));
    }));

    return firstPerKey(
      [...dispatched.flat(), ...pulled.flat()],
      (item) => item.run.id
    ).sort((a, b) => new Date(b.run.created_at) - new Date(a.run.created_at));
  }

  // A run's pull request can live in another repository (a fork's branch can be a pull request
  // into the upstream repo), so the owner and repo come from the pull request's own API link.
  function pullRequestTarget(run, suite) {
    const link = run.pull_requests?.[0]?.url;
    const match = link && link.match(/\/repos\/([^/]+)\/([^/]+)\/pulls\/(\d+)$/);

    if (match) {
      return { owner: match[1], repo: match[2], number: Number(match[3]) };
    }

    const number = pullRequestNumber(run);
    return number ? { owner: suite.repository.owner, repo: suite.repository.name, number } : null;
  }

  async function pullRequestInfo(target) {
    if (!target) {
      return null;
    }

    const { owner, repo, number } = target;
    const key = `${owner}/${repo}#${number}`;
    const cached = pullRequestCache.get(key);

    if (cached && Date.now() - cached.at < PULL_REQUEST_CACHE_MS) {
      return cached.value;
    }

    try {
      const { data } = await github.rest.pulls.get({ owner, repo, pull_number: number });
      const value = {
        number,
        title: data.title,
        state: data.merged_at ? "merged" : data.state,
        url: data.html_url
      };

      pullRequestCache.set(key, { at: Date.now(), value });
      return value;
    } catch (error) {
      // Cached too, so a pull request GitHub cannot show is not asked for again on every refresh.
      logger.warn("Could not read pull request", { pullRequest: key, reason: error.message });
      const fallback = { number, title: "Title unavailable", state: "unknown", url: `https://github.com/${owner}/${repo}/pull/${number}` };
      pullRequestCache.set(key, { at: Date.now(), value: fallback });
      return fallback;
    }
  }

  async function readArtifact(suite, run, artifactName, fileName, summarize) {
    const { owner, name: repo } = suite.repository;
    const list = await github.rest.actions.listWorkflowRunArtifacts({ owner, repo, run_id: run.id });
    const artifact = list.data.artifacts.find((item) => item.name === artifactName && !item.expired);

    if (!artifact) {
      return null;
    }

    const download = await github.rest.actions.downloadArtifact({
      owner,
      repo,
      artifact_id: artifact.id,
      archive_format: "zip"
    });
    const json = readZipEntry(Buffer.from(download.data), fileName).toString("utf8");
    return summarize(JSON.parse(json));
  }

  async function finishedDetails(run, suite, kind) {
    if (finishedCache.has(run.id)) {
      return finishedCache.get(run.id);
    }

    try {
      const results = suite.resultsArtifact
        ? await readArtifact(suite, run, suite.resultsArtifact, "results.json", summarizePlaywrightResults)
        : null;
      const report = suite.pullRequestReport;
      const selection = kind === "pull-request" && report
        ? await readArtifact(suite, run, report.artifact, report.file, summarizeSelection)
        : null;
      const value = { results, selection };

      finishedCache.set(run.id, value);
      return value;
    } catch (error) {
      // Not cached, so the next refresh tries again.
      logger.warn("Could not read run results", { runId: run.id, reason: error.message });
      return { results: null, selection: null };
    }
  }

  async function currentStepOf(run, suite, state) {
    if (state === "queued") {
      return "Waiting for a runner";
    }

    const { owner, name: repo } = suite.repository;

    try {
      const { data } = await github.rest.actions.listJobsForWorkflowRun({
        owner,
        repo,
        run_id: run.id,
        filter: "latest"
      });

      for (const job of data.jobs) {
        const step = job.steps?.find((item) => item.status === "in_progress");

        if (step) {
          return step.name;
        }
      }

      return "Starting";
    } catch (error) {
      logger.warn("Could not read run steps", { runId: run.id, reason: error.message });
      return null;
    }
  }

  async function describeRun({ run, suite }) {
    const matched = suiteForRun(run);
    const kind = run.event === "pull_request" ? "pull-request" : matched ? "suite" : "manual";
    const state = toRunState(run);
    const finished = run.status === "completed";
    const number = pullRequestNumber(run);
    const startedAt = run.run_started_at || run.created_at;
    const [details, currentStep, pullRequest] = await Promise.all([
      finished ? finishedDetails(run, suite, kind) : null,
      finished ? null : currentStepOf(run, suite, state),
      kind === "pull-request" ? pullRequestInfo(pullRequestTarget(run, suite)) : null
    ]);

    // A pull request run GitHub cannot tie to a number keeps its workflow title.
    const fallbackLabel = kind === "pull-request" && number
      ? `Pull request #${number}`
      : run.display_title || run.name;

    return {
      id: run.id,
      kind,
      suiteId: matched?.id || null,
      suiteLabel: matched?.label || fallbackLabel,
      title: run.display_title,
      state,
      currentStep,
      startedAt,
      durationMs: finished ? Math.max(0, new Date(run.updated_at) - new Date(startedAt)) : null,
      url: run.html_url,
      branch: run.head_branch || null,
      pullRequest,
      results: details?.results || null,
      selection: details?.selection || null
    };
  }

  // Everything the dashboard needs in one call.
  async function listAutomation({ limit = 10 } = {}) {
    const collected = await collectRuns();
    const recent = collected.slice(0, limit);
    const pullRequestItems = [];
    const seenPullRequests = new Set();

    for (const item of collected) {
      if (item.run.event !== "pull_request") {
        continue;
      }

      const key = pullRequestNumber(item.run) ?? `run-${item.run.id}`;

      if (seenPullRequests.has(key)) {
        continue;
      }

      seenPullRequests.add(key);
      pullRequestItems.push(item);

      if (pullRequestItems.length >= PULL_REQUEST_ROW_LIMIT) {
        break;
      }
    }

    const unique = firstPerKey([...recent, ...pullRequestItems], (item) => item.run.id);
    const described = await Promise.all(unique.map(describeRun));
    const byId = new Map(described.map((run) => [run.id, run]));

    return {
      savedAt: new Date().toISOString(),
      suites: suites.map(describeSuite),
      runs: recent.map((item) => byId.get(item.run.id)),
      pullRequests: toPullRequestRows(
        pullRequestItems.map((item) => byId.get(item.run.id)),
        { limit: PULL_REQUEST_ROW_LIMIT }
      )
    };
  }

  async function runSuite(id) {
    const suite = findSuite(id);
    const recent = await fetchRuns(suite, {
      event: "workflow_dispatch",
      branch: suite.ref,
      per_page: RUN_LIST_LIMIT
    });
    const active = recent.some((run) => {
      return suiteForRun(run)?.id === suite.id && ["queued", "running"].includes(toRunState(run));
    });

    if (active) {
      throw new AppError(`${suite.label} is already running`, 409, "SUITE_ALREADY_RUNNING");
    }

    const { owner, name: repo } = suite.repository;

    try {
      await github.rest.actions.createWorkflowDispatch({
        owner,
        repo,
        workflow_id: suite.workflow,
        ref: suite.ref,
        inputs: suite.inputs || {}
      });
    } catch (error) {
      throw toAppError(error, "Could not start the workflow on GitHub");
    }

    logger.info("Suite dispatched", { suite: suite.id, repository: `${owner}/${repo}`, ref: suite.ref });

    return { suiteId: suite.id, dispatchedAt: new Date().toISOString() };
  }

  return {
    getSuites: () => suites.map(describeSuite),
    listAutomation,
    runSuite
  };
}
