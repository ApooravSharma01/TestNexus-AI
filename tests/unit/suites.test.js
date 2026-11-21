import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { request as httpRequest } from "node:http";

import { createSuiteServer } from "../../src/server/suite-server.js";
import {
  readZipEntry,
  summarizePlaywrightResults,
  summarizeSelection
} from "../../src/suites/results-reader.js";
import { toPullRequestRows } from "../../src/suites/pull-request-rows.js";
import { loadSuites, validateSuites } from "../../src/suites/suite-registry.js";
import { createSuiteService } from "../../src/suites/suite-service.js";

// Builds a one-file zip so the reader can be checked without a real download.
function buildZip(name, content, method = 8) {
  const raw = Buffer.from(content);
  const data = method === 8 ? deflateRawSync(raw) : raw;
  const fileName = Buffer.from(name);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(fileName.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(fileName.length, 28);
  central.writeUInt32LE(0, 42);

  const localPart = Buffer.concat([local, fileName, data]);
  const centralPart = Buffer.concat([central, fileName]);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralPart.length, 12);
  end.writeUInt32LE(localPart.length, 16);

  return Buffer.concat([localPart, centralPart, end]);
}

const playwrightReport = {
  suites: [
    {
      title: "auth.setup.js",
      specs: [{ title: "authenticate", file: "auth.setup.js", tests: [{ projectName: "setup", status: "expected", results: [{ duration: 900 }] }] }]
    },
    {
      title: "api-order.spec.js",
      suites: [{
        title: "Independent API Tests",
        specs: [
          { title: "reads orders @api", file: "api-order.spec.js", tests: [{ projectName: "chromium", status: "expected", results: [{ duration: 120 }] }] },
          {
            title: "rejects without auth @api",
            file: "api-order.spec.js",
            tests: [{
              projectName: "chromium",
              status: "unexpected",
              results: [{ duration: 80, error: { message: "\u001b[31mExpected: 401\u001b[39m\nReceived: 200" } }]
            }]
          }
        ]
      }]
    }
  ]
};

const testnexusReport = {
  selectedTests: [{ id: "SALE-ORDER-007" }, { id: "SALE-ORDER-008" }],
  skippedTests: [{ id: "SALE-ORDER-001" }, { id: "SALE-ORDER-002" }, { id: "SALE-ORDER-003" }],
  risk: { level: "low", score: 0 },
  intelligence: { mode: "deterministic" }
};

const suites = [{
  id: "sale-order-regression",
  label: "Sale order regression",
  repository: { owner: "acme", name: "oms" },
  workflow: "order.yml",
  ref: "main",
  inputs: { suite: "sale-order-regression", grep: "@regression" },
  resultsArtifact: "playwright-results",
  pullRequestReport: { artifact: "testnexus-report", file: "openoms.json" }
}];

function fakeRun(overrides = {}) {
  return {
    id: 1,
    name: "OpenOMS Order Creation E2E",
    event: "workflow_dispatch",
    display_title: "Order E2E - sale-order-regression (@regression)",
    status: "completed",
    conclusion: "success",
    created_at: "2026-11-21T07:50:54Z",
    run_started_at: "2026-11-21T07:50:56Z",
    updated_at: "2026-11-21T07:55:06Z",
    html_url: "https://github.com/acme/oms/actions/runs/1",
    pull_requests: [],
    ...overrides
  };
}

// Simulates the GitHub calls the service makes. Each option is optional.
function fakeClient({ runs = [], artifacts = {}, jobs = [], pulls = {} } = {}) {
  const calls = { dispatch: [] };

  return {
    calls,
    rest: {
      actions: {
        listWorkflowRuns: async ({ event }) => ({
          data: { workflow_runs: runs.filter((run) => (run.event || "workflow_dispatch") === event) }
        }),
        createWorkflowDispatch: async (args) => { calls.dispatch.push(args); },
        listWorkflowRunArtifacts: async ({ run_id: runId }) => ({
          data: {
            artifacts: (artifacts[runId] || []).map((item) => ({ id: item.id, name: item.name, expired: false }))
          }
        }),
        downloadArtifact: async ({ artifact_id: artifactId }) => {
          const match = Object.values(artifacts).flat().find((item) => item.id === artifactId);
          return { data: match.zip };
        },
        listJobsForWorkflowRun: async () => ({ data: { jobs } })
      },
      pulls: {
        get: async ({ pull_number: number }) => {
          if (!pulls[number]) {
            throw Object.assign(new Error("Not Found"), { status: 404 });
          }
          return { data: pulls[number] };
        }
      }
    }
  };
}

test("zip reader extracts stored and compressed files", () => {
  for (const method of [0, 8]) {
    const zip = buildZip("results.json", '{"ok":true}', method);
    assert.equal(readZipEntry(zip, "results.json").toString(), '{"ok":true}');
  }
});

test("zip reader reports missing files and bad input", () => {
  assert.throws(() => readZipEntry(buildZip("a.json", "{}"), "results.json"), /not in the zip/);
  assert.throws(() => readZipEntry(Buffer.from("not a zip file at all, just text"), "x"), /Not a zip/);
});

test("results summary skips the login setup step, counts failures and strips colour codes", () => {
  const summary = summarizePlaywrightResults(playwrightReport);

  assert.equal(summary.total, 2);
  assert.equal(summary.passed, 1);
  assert.equal(summary.failed, 1);
  assert.deepEqual(summary.failures, [{ title: "rejects without auth @api", message: "Expected: 401" }]);
});

test("selection summary reads what TestNexus picked out of the total", () => {
  const selection = summarizeSelection(testnexusReport);

  assert.equal(selection.pickedCount, 2);
  assert.equal(selection.total, 5);
  assert.deepEqual(selection.risk, { level: "low", score: 0 });
  assert.equal(selection.mode, "deterministic");
});

test("pull request rows keep only the latest run per pull request", () => {
  const runs = [
    { id: 9, kind: "pull-request", pullRequest: { number: 7, title: "Newest", state: "open", url: "u7" }, state: "running", currentStep: "Start OpenOMS API", selection: { pickedCount: 2, total: 8, risk: { level: "low", score: 3 } }, results: null, startedAt: "t9", url: "r9" },
    { id: 8, kind: "pull-request", pullRequest: { number: 7, title: "Older", state: "open", url: "u7" }, state: "failed", selection: null, results: null, startedAt: "t8", url: "r8" },
    { id: 7, kind: "suite", pullRequest: null, state: "passed" },
    { id: 6, kind: "pull-request", pullRequest: { number: 5, title: "Other", state: "merged", url: "u5" }, state: "passed", selection: { pickedCount: 8, total: 8, risk: { level: "high", score: 95 } }, results: { total: 8, failures: [] }, startedAt: "t6", url: "r6" }
  ];

  const rows = toPullRequestRows(runs, { limit: 10 });

  assert.deepEqual(rows.map((row) => row.number), [7, 5]);
  assert.equal(rows[0].title, "Newest");
  assert.equal(rows[0].ci.state, "running");
  assert.equal(rows[0].picked, 2);
  assert.equal(rows[1].risk.level, "high");
  assert.equal(rows[1].testsRun, 8);
});

test("registry rejects broken suites and the shipped registry is valid", async () => {
  assert.throws(() => validateSuites([]), /at least one/);
  assert.throws(() => validateSuites([{ id: "x", label: "X", workflow: "w.yml", ref: "main" }]), /repository/);
  assert.throws(() => validateSuites([...suites, ...suites]), /Duplicate/);
  assert.throws(
    () => validateSuites([{ ...suites[0], id: "y", pullRequestReport: { artifact: "a" } }]),
    /pullRequestReport/
  );

  const shipped = await loadSuites();
  assert.ok(shipped.length >= 1);
});

test("runSuite dispatches the registered workflow with the registered inputs", async () => {
  const client = fakeClient();
  const service = createSuiteService({ suites, client });

  const result = await service.runSuite("sale-order-regression");

  assert.equal(result.suiteId, "sale-order-regression");
  assert.deepEqual(client.calls.dispatch, [{
    owner: "acme",
    repo: "oms",
    workflow_id: "order.yml",
    ref: "main",
    inputs: { suite: "sale-order-regression", grep: "@regression" }
  }]);
});

test("runSuite refuses unknown suites and double starts", async () => {
  const idle = createSuiteService({ suites, client: fakeClient() });
  await assert.rejects(() => idle.runSuite("nope"), { code: "SUITE_NOT_FOUND", statusCode: 404 });

  const busyClient = fakeClient({ runs: [fakeRun({ status: "in_progress", conclusion: null })] });
  const busy = createSuiteService({ suites, client: busyClient });
  await assert.rejects(() => busy.runSuite("sale-order-regression"), { code: "SUITE_ALREADY_RUNNING", statusCode: 409 });
  assert.equal(busyClient.calls.dispatch.length, 0);
});

test("runSuite turns GitHub permission errors into a clear message", async () => {
  const client = fakeClient();
  client.rest.actions.createWorkflowDispatch = async () => {
    throw Object.assign(new Error("Resource not accessible"), { status: 403 });
  };
  const service = createSuiteService({ suites, client });

  await assert.rejects(() => service.runSuite("sale-order-regression"), { code: "GITHUB_AUTHENTICATION_FAILED" });
});

test("listAutomation maps runs to suites and reads results from the artifact", async () => {
  const zip = buildZip("results.json", JSON.stringify(playwrightReport));
  const client = fakeClient({
    runs: [
      fakeRun({ id: 2, status: "in_progress", conclusion: null, created_at: "2026-11-21T09:00:00Z" }),
      fakeRun({ id: 1 }),
      fakeRun({ id: 3, display_title: "Someone else's run", created_at: "2026-11-20T09:00:00Z" })
    ],
    artifacts: { 1: [{ id: 91, name: "playwright-results", zip }] }
  });
  const service = createSuiteService({ suites, client });

  const { runs } = await service.listAutomation();

  assert.deepEqual(runs.map((run) => run.id), [2, 1, 3]);
  assert.equal(runs[0].state, "running");
  assert.equal(runs[0].results, null);
  assert.equal(runs[1].state, "passed");
  assert.equal(runs[1].kind, "suite");
  assert.equal(runs[1].suiteId, "sale-order-regression");
  assert.equal(runs[1].durationMs, 250000);
  assert.equal(runs[1].results.passed, 1);
  assert.equal(runs[1].results.failed, 1);
  assert.equal(runs[1].results.failures[0].title, "rejects without auth @api");
  assert.equal(runs[2].kind, "manual");
  assert.equal(runs[2].suiteId, null);
});

test("an active run shows the step it is on", async () => {
  const client = fakeClient({
    runs: [fakeRun({ id: 5, status: "in_progress", conclusion: null })],
    jobs: [{ name: "order-creation-e2e", steps: [{ name: "Checkout", status: "completed" }, { name: "Start OpenOMS API", status: "in_progress" }] }]
  });
  const service = createSuiteService({ suites, client });

  const { runs } = await service.listAutomation();

  assert.equal(runs[0].currentStep, "Start OpenOMS API");
});

test("pull request runs are listed with TestNexus's decision and the PR title", async () => {
  const zip = buildZip("results.json", JSON.stringify(playwrightReport));
  const reportZip = buildZip("openoms.json", JSON.stringify(testnexusReport));
  const client = fakeClient({
    runs: [
      fakeRun({
        id: 40,
        event: "pull_request",
        display_title: "Order E2E - pull request (all tests)",
        created_at: "2026-11-21T10:00:00Z",
        pull_requests: [{ number: 1 }]
      })
    ],
    artifacts: {
      40: [
        { id: 401, name: "playwright-results", zip },
        { id: 402, name: "testnexus-report", zip: reportZip }
      ]
    },
    pulls: { 1: { title: "Demo: edit only the API order spec", state: "closed", merged_at: "2026-11-21T10:30:00Z", html_url: "https://github.com/acme/oms/pull/1" } }
  });
  const pulledRequests = [];
  const originalGet = client.rest.pulls.get;
  client.rest.pulls.get = async (args) => {
    pulledRequests.push(args);
    return originalGet(args);
  };
  const service = createSuiteService({ suites, client });

  const { runs, pullRequests } = await service.listAutomation();

  assert.equal(runs[0].kind, "pull-request");
  assert.equal(runs[0].suiteLabel, "Pull request #1");
  assert.equal(runs[0].pullRequest.state, "merged");
  assert.equal(pullRequests.length, 1);
  assert.equal(pullRequests[0].title, "Demo: edit only the API order spec");
  assert.equal(pullRequests[0].picked, 2);
  assert.equal(pullRequests[0].total, 5);
  assert.equal(pullRequests[0].risk.level, "low");
  assert.equal(pullRequests[0].failures[0].title, "rejects without auth @api");
  assert.equal(pulledRequests.length, 1);
});

test("a pull request from a fork is looked up in the repository it targets", async () => {
  const zip = buildZip("results.json", JSON.stringify(playwrightReport));
  const client = fakeClient({
    runs: [
      fakeRun({
        id: 50,
        event: "pull_request",
        created_at: "2026-11-21T11:00:00Z",
        pull_requests: [{ number: 729, url: "https://api.github.com/repos/upstream-org/upstream/pulls/729" }]
      })
    ],
    artifacts: { 50: [{ id: 501, name: "playwright-results", zip }] },
    pulls: { 729: { title: "Upstream change", state: "open", merged_at: null, html_url: "https://github.com/upstream-org/upstream/pull/729" } }
  });
  const lookups = [];
  const original = client.rest.pulls.get;
  client.rest.pulls.get = async (args) => {
    lookups.push(`${args.owner}/${args.repo}#${args.pull_number}`);
    return original(args);
  };
  const service = createSuiteService({ suites, client });

  const { pullRequests } = await service.listAutomation();

  assert.deepEqual(lookups, ["upstream-org/upstream#729"]);
  assert.equal(pullRequests[0].prUrl, "https://github.com/upstream-org/upstream/pull/729");
  assert.equal(pullRequests[0].title, "Upstream change");
});

test("listAutomation still returns the run when the artifact is missing", async () => {
  const client = fakeClient({ runs: [fakeRun({ conclusion: "failure" })], artifacts: {} });
  const service = createSuiteService({ suites, client });

  const { runs } = await service.listAutomation();

  assert.equal(runs[0].state, "failed");
  assert.equal(runs[0].results, null);
});

async function withServer(server, callback) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("suite server exposes suites, runs and a start endpoint", async () => {
  const client = fakeClient({ runs: [fakeRun()] });
  const service = createSuiteService({ suites, client });

  await withServer(createSuiteServer({ service }), async (base) => {
    const list = await (await fetch(`${base}/api/suites`)).json();
    assert.equal(list.suites[0].id, "sale-order-regression");
    assert.equal(list.suites[0].repository, "acme/oms");
    assert.equal(JSON.stringify(list).includes("resultsArtifact"), false);

    const automation = await (await fetch(`${base}/api/suite-runs`)).json();
    assert.equal(automation.runs.length, 1);
    assert.equal(automation.suites.length, 1);
    assert.ok(automation.savedAt);
    assert.equal(JSON.stringify(automation).includes("ghp_"), false);

    const started = await fetch(`${base}/api/suites/sale-order-regression/run`, { method: "POST" });
    assert.equal(started.status, 202);
    assert.equal(client.calls.dispatch.length, 1);

    const missing = await fetch(`${base}/api/suites/not-real/run`, { method: "POST" });
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, "SUITE_NOT_FOUND");
  });
});

test("suite server refuses requests from other websites", async () => {
  const client = fakeClient();
  const service = createSuiteService({ suites, client });

  await withServer(createSuiteServer({ service }), async (base) => {
    const blocked = await fetch(`${base}/api/suites/sale-order-regression/run`, {
      method: "POST",
      headers: { Origin: "https://evil.example" }
    });

    assert.equal(blocked.status, 403);
    assert.equal(client.calls.dispatch.length, 0);

    const allowed = await fetch(`${base}/api/health`, { headers: { Origin: "http://localhost:5173" } });
    assert.equal(allowed.status, 200);

    // fetch() will not let us fake a Host header, so use a raw request for that.
    const status = await new Promise((resolve, reject) => {
      const rebinding = httpRequest({
        host: "127.0.0.1",
        port: new URL(base).port,
        path: "/api/health",
        headers: { Host: "attacker.example" }
      }, (response) => {
        response.resume();
        resolve(response.statusCode);
      });
      rebinding.on("error", reject);
      rebinding.end();
    });

    assert.equal(status, 403);
  });
});
