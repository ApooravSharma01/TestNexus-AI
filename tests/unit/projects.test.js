import test from "node:test";
import assert from "node:assert/strict";

import { runPipeline } from "../../src/core/pipeline.js";
import { buildGrepPattern } from "../../src/execution/playwright-runner.js";
import { loadProject } from "../../src/projects/project-registry.js";

function change(path, status = "modified") {
  return { path, status, additions: 4, deletions: 1, patch: null };
}

async function selectedIds(paths) {
  const project = await loadProject("openoms");
  const report = await runPipeline({
    summary: { number: 1, title: "Change", state: "open", changedFiles: paths.map((path) => change(path)) },
    registry: project.registry,
    features: project.features
  });

  return report.selectedTests.map((item) => item.id);
}

test("loadProject reads the OpenOMS profile", async () => {
  const project = await loadProject("openoms");

  assert.equal(project.repository.name, "openoms");
  assert.equal(project.execution, "github-actions");
  assert.equal(project.registry.length, 8);
  assert.ok(project.registry.every((item) => project.features.some((feature) => feature.id === item.featureId)));
});

test("loadProject refuses unsafe and unknown ids", async () => {
  await assert.rejects(() => loadProject("../secrets"), { code: "INVALID_PROJECT_ID" });
  await assert.rejects(() => loadProject("nope"), { code: "PROJECT_NOT_FOUND" });
});

test("an order handler change selects the whole sale-order suite", async () => {
  const ids = await selectedIds(["apps/api-server/internal/handler/order_handler.go"]);

  assert.equal(ids.length, 8);
});

test("editing only the API spec selects only the API tests", async () => {
  const ids = await selectedIds(["qa-automation/order-creation/tests/api-order.spec.js"]);

  assert.deepEqual(ids.sort(), ["SALE-ORDER-007", "SALE-ORDER-008"]);
});

test("a Go file outside the feature map runs every critical test", async () => {
  const ids = await selectedIds(["apps/api-server/internal/handler/product_handler.go"]);
  const project = await loadProject("openoms");
  const critical = project.registry.filter((item) => item.critical).map((item) => item.id);

  assert.deepEqual(ids.sort(), critical.sort());
});

test("a documentation-only change selects nothing", async () => {
  assert.deepEqual(await selectedIds(["docs/getting-started.md"]), []);
});

test("buildGrepPattern escapes regex characters and anchors each title", () => {
  const pattern = buildGrepPattern([
    { title: "validates API + DB (smoke) @smoke" },
    { title: "plain title" }
  ]);

  assert.equal(pattern, "validates API \\+ DB \\(smoke\\) @smoke$|plain title$");
  assert.equal(buildGrepPattern([]), "");
  assert.ok(new RegExp(pattern).test("validates API + DB (smoke) @smoke"));
});
