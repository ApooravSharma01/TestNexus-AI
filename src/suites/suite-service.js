import { AppError } from "../utils/app-error.js";
import { logger } from "../utils/logger.js";
import { createGitHubClient } from "../integrations/github/github-client.js";
import { describeSuite } from "./suite-registry.js";
import { readZipEntry, summarizePlaywrightResults } from "./results-reader.js";

const ACTIVE_STATES = ["queued", "running"];

function toRunState(run) {
  if (run.status === "completed") {
    if (run.conclusion === "success") {
      return "passed";
    }

    return run.conclusion === "cancelled" ? "cancelled" : "failed";
  }

  return run.status === "queued" || run.status === "waiting" || run.status === "pending"
    ? "queued"
    : "running";
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

export function createSuiteService({ suites, client } = {}) {
  if (!Array.isArray(suites)) {
    throw new AppError("Suites must be provided", 500, "SUITE_REGISTRY_INVALID");
  }

  const github = client || createGitHubClient();
  // A finished run never changes, so its results are fetched once.
  const resultsCache = new Map();

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

  async function fetchResults(suite, run) {
    if (!suite?.resultsArtifact || run.status !== "completed") {
      return null;
    }

    if (resultsCache.has(run.id)) {
      return resultsCache.get(run.id);
    }

    const { owner, name: repo } = suite.repository;

    try {
      const list = await github.rest.actions.listWorkflowRunArtifacts({ owner, repo, run_id: run.id });
      const artifact = list.data.artifacts.find((item) => item.name === suite.resultsArtifact && !item.expired);

      if (!artifact) {
        resultsCache.set(run.id, null);
        return null;
      }

      const download = await github.rest.actions.downloadArtifact({
        owner,
        repo,
        artifact_id: artifact.id,
        archive_format: "zip"
      });
      const json = readZipEntry(Buffer.from(download.data), "results.json").toString("utf8");
      const summary = summarizePlaywrightResults(JSON.parse(json));

      resultsCache.set(run.id, summary);
      return summary;
    } catch (error) {
      // Results are a bonus. A missing artifact must not hide the run itself.
      logger.warn("Could not read run results", { runId: run.id, reason: error.message });
      return null;
    }
  }

  async function listWorkflowRuns(suite, limit) {
    const { owner, name: repo } = suite.repository;

    try {
      const response = await github.rest.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id: suite.workflow,
        branch: suite.ref,
        event: "workflow_dispatch",
        per_page: limit
      });

      return response.data.workflow_runs;
    } catch (error) {
      throw toAppError(error, "Could not read workflow runs from GitHub");
    }
  }

  async function listRuns({ limit = 10 } = {}) {
    const seenWorkflows = new Map();

    for (const suite of suites) {
      const key = `${suite.repository.owner}/${suite.repository.name}/${suite.workflow}/${suite.ref}`;

      if (!seenWorkflows.has(key)) {
        seenWorkflows.set(key, suite);
      }
    }

    const groups = await Promise.all(
      [...seenWorkflows.values()].map((suite) => listWorkflowRuns(suite, limit))
    );
    const rawRuns = groups
      .flat()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);

    return Promise.all(rawRuns.map(async (run) => {
      const suite = suiteForRun(run);
      const startedAt = run.run_started_at || run.created_at;
      const finished = run.status === "completed";

      return {
        id: run.id,
        suiteId: suite?.id || null,
        suiteLabel: suite?.label || run.display_title || run.name,
        title: run.display_title,
        state: toRunState(run),
        startedAt,
        durationMs: finished ? Math.max(0, new Date(run.updated_at) - new Date(startedAt)) : null,
        url: run.html_url,
        results: await fetchResults(suite, run)
      };
    }));
  }

  async function runSuite(id) {
    const suite = findSuite(id);
    const recent = await listWorkflowRuns(suite, 20);
    const active = recent.some((run) => suiteForRun(run)?.id === suite.id && ACTIVE_STATES.includes(toRunState(run)));

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
    listRuns,
    runSuite
  };
}
