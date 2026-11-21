import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";

import { createSuiteServer } from "../../src/server/suite-server.js";
import { readZipEntry, summarizePlaywrightResults } from "../../src/suites/results-reader.js";
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
          { title: "rejects without auth @api", file: "api-order.spec.js", tests: [{ projectName: "chromium", status: "unexpected", results: [{ duration: 80 }] }] }
        ]
      }]
    }
  ]
};

const suites = [{
  id: "sale-order-regression",
  label: "Sale order regression",
  repository: { owner: "acme", name: "oms" },
  workflow: "order.yml",
  ref: "main",
  inputs: { suite: "sale-order-regression", grep: "@regression" },
  resultsArtifact: "playwright-results"
}];

function fakeRun(overrides = {}) {
  return {
    id: 1,
    name: "OpenOMS Order Creation E2E",
    display_title: "Order E2E - sale-order-regression (@regression)",
    status: "completed",
    conclusion: "success",
    created_at: "2026-11-21T07:50:54Z",
    run_started_at: "2026-11-21T07:50:56Z",
    updated_at: "2026-11-21T07:55:06Z",
    html_url: "https://github.com/acme/oms/actions/runs/1",
    ...overrides
  };
}

function fakeClient({ runs = [], artifacts = [], zip = null } = {}) {
  const calls = { dispatch: [] };

  return {
    calls,
    rest: {
      actions: {
        listWorkflowRuns: async () => ({ data: { workflow_runs: runs } }),
        createWorkflowDispatch: async (args) => { calls.dispatch.push(args); },
        listWorkflowRunArtifacts: async () => ({ data: { artifacts } }),
        downloadArtifact: async () => ({ data: zip })
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

test("results summary skips the login setup step and counts failures", () => {
  const summary = summarizePlaywrightResults(playwrightReport);

  assert.equal(summary.total, 2);
  assert.equal(summary.passed, 1);
  assert.equal(summary.failed, 1);
  assert.deepEqual(summary.tests.map((item) => item.status), ["passed", "failed"]);
});

test("registry rejects broken suites and the shipped registry is valid", async () => {
  assert.throws(() => validateSuites([]), /at least one/);
  assert.throws(() => validateSuites([{ id: "x", label: "X", workflow: "w.yml", ref: "main" }]), /repository/);
  assert.throws(() => validateSuites([...suites, ...suites]), /Duplicate/);

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

test("listRuns maps runs to suites and reads results from the artifact", async () => {
  const zip = buildZip("results.json", JSON.stringify(playwrightReport));
  const client = fakeClient({
    runs: [
      fakeRun({ id: 2, status: "in_progress", conclusion: null, created_at: "2026-11-21T09:00:00Z" }),
      fakeRun({ id: 1 }),
      fakeRun({ id: 3, display_title: "Someone else's run", created_at: "2026-11-20T09:00:00Z" })
    ],
    artifacts: [{ id: 9, name: "playwright-results", expired: false }],
    zip
  });
  const service = createSuiteService({ suites, client });

  const runs = await service.listRuns();

  assert.deepEqual(runs.map((run) => run.id), [2, 1, 3]);
  assert.equal(runs[0].state, "running");
  assert.equal(runs[0].results, null);
  assert.equal(runs[1].state, "passed");
  assert.equal(runs[1].suiteId, "sale-order-regression");
  assert.equal(runs[1].durationMs, 250000);
  assert.equal(runs[1].results.passed, 1);
  assert.equal(runs[1].results.failed, 1);
  assert.equal(runs[2].suiteId, null);
});

test("listRuns still returns the run when the artifact is missing", async () => {
  const client = fakeClient({ runs: [fakeRun({ conclusion: "failure" })], artifacts: [] });
  const service = createSuiteService({ suites, client });

  const [run] = await service.listRuns();

  assert.equal(run.state, "failed");
  assert.equal(run.results, null);
});

async function withServer(service, callback) {
  const server = createSuiteServer({ service });
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

  await withServer(service, async (base) => {
    const list = await (await fetch(`${base}/api/suites`)).json();
    assert.equal(list.suites[0].id, "sale-order-regression");
    assert.equal(list.suites[0].repository, "acme/oms");
    assert.equal(JSON.stringify(list).includes("resultsArtifact"), false);

    const runs = await (await fetch(`${base}/api/suite-runs`)).json();
    assert.equal(runs.runs.length, 1);

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

  await withServer(service, async (base) => {
    const blocked = await fetch(`${base}/api/suites/sale-order-regression/run`, {
      method: "POST",
      headers: { Origin: "https://evil.example" }
    });

    assert.equal(blocked.status, 403);
    assert.equal(client.calls.dispatch.length, 0);

    const allowed = await fetch(`${base}/api/health`, { headers: { Origin: "http://localhost:5173" } });
    assert.equal(allowed.status, 200);

    // fetch() will not let us fake a Host header, so use a raw request for that.
    const { request } = await import("node:http");
    const status = await new Promise((resolve, reject) => {
      const rebinding = request({
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
