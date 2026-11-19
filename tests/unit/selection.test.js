import test from "node:test";
import assert from "node:assert/strict";

import { analyzePullRequest } from "../../src/analyzers/change-analyzer.js";
import { analyzeImpact } from "../../src/impact/impact-analyzer.js";
import { scoreRisk } from "../../src/test-intelligence/risk-engine.js";
import { validateSelection } from "../../src/test-intelligence/selection-validator.js";
import { selectTests } from "../../src/test-intelligence/selector.js";
import { mapTests } from "../../src/test-intelligence/mapper.js";
import { readJson } from "../../src/utils/read-json.js";

const features = [
  { id: "authentication", name: "Authentication", critical: true, paths: ["src/auth/"] },
  { id: "catalog", name: "Product catalog", critical: false, paths: ["src/catalog/"] }
];

const registry = [
  { id: "AUTH-LOGIN-001", title: "login", featureId: "authentication", file: "tests/e2e/auth.spec.js", critical: true },
  { id: "AUTH-LOGIN-002", title: "empty password", featureId: "authentication", file: "tests/e2e/auth.spec.js", critical: false },
  { id: "CATALOG-001", title: "catalog", featureId: "catalog", file: "tests/e2e/catalog.spec.js", critical: false }
];

function analyze(changedFiles) {
  return analyzePullRequest({
    number: 1,
    title: "Change",
    state: "open",
    changedFiles
  });
}

test("should map a login change to the authentication tests", () => {
  const analysis = analyze([
    { path: "src/auth/login.js", previousPath: null, status: "modified", additions: 10, deletions: 2, patch: null }
  ]);
  const impact = analyzeImpact(analysis, features);
  const mapped = mapTests(analysis, impact, registry);
  const selection = selectTests({ registry, impact, mappedTests: mapped });

  assert.equal(impact.features[0].id, "authentication");
  assert.deepEqual(selection.tests.map((item) => item.id), ["AUTH-LOGIN-001", "AUTH-LOGIN-002"]);
  assert.equal(scoreRisk(analysis, impact).score, 42);
  assert.equal(scoreRisk(analysis, impact).level, "medium");
});

test("should include critical tests when a source file has no feature", async () => {
  const storedFeatures = await readJson("registry/feature-map.json");
  const storedTests = await readJson("registry/tests.json");
  const analysis = analyze([
    { path: "src/billing/tax.js", previousPath: null, status: "added", additions: 20, deletions: 0, patch: null }
  ]);
  const impact = analyzeImpact(analysis, storedFeatures);
  const selection = selectTests({
    registry: storedTests,
    impact,
    mappedTests: mapTests(analysis, impact, storedTests)
  });

  assert.deepEqual(impact.unmatchedSourceFiles, ["src/billing/tax.js"]);
  assert.deepEqual(selection.tests.map((item) => item.id), ["AUTH-LOGIN-001", "CHECKOUT-001"]);
});

test("should reject a test id that is not in the registry", () => {
  const result = validateSelection(["AUTH-LOGIN-001", "MADE-UP"], registry);

  assert.deepEqual(result.accepted, ["AUTH-LOGIN-001"]);
  assert.deepEqual(result.rejected, ["MADE-UP"]);
});
