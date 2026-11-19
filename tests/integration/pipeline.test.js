import test from "node:test";
import assert from "node:assert/strict";

import { runPipeline } from "../../src/core/pipeline.js";
import { readJson } from "../../src/utils/read-json.js";
import { evaluateSelections } from "../../src/commands/evaluate.js";

test("should select the authentication tests for a login change", async () => {
  const summary = await readJson("tests/fixtures/login-change.json");
  const report = await runPipeline({
    summary,
    execute: async () => ({
      passed: 1,
      failed: 1,
      skipped: 0,
      durationMs: 30,
      results: [
        { title: "user can log in with valid credentials", status: "passed", durationMs: 10, error: "" },
        { title: "login rejects an empty password", status: "failed", durationMs: 20, error: "expect(locator).toHaveText failed" }
      ]
    })
  });

  assert.deepEqual(report.selectedTests.map((testCase) => testCase.id), ["AUTH-LOGIN-001", "AUTH-LOGIN-002"]);
  assert.equal(report.comparison.fullRegressionCount, 4);
  assert.equal(report.comparison.testsSaved, 2);
  assert.equal(report.intelligence.mode, "deterministic");
  assert.equal(report.risk.score, 42);
  assert.equal(report.diagnosis[0].kind, "product");
  assert.equal(report.impact.features[0].name, "Authentication");
});

test("should score the labeled fixtures", async () => {
  const evaluation = await evaluateSelections();

  assert.equal(evaluation.averagePrecision, 1);
  assert.equal(evaluation.averageRecall, 1);
  assert.equal(evaluation.averageCriticalRecall, 1);
  assert.equal(evaluation.cases.length, 5);
});
