import test from "node:test";
import assert from "node:assert/strict";

import { diagnoseFailures } from "../../src/execution/failure-analyzer.js";
import { createPlaywrightRunner, parsePlaywrightReport } from "../../src/execution/playwright-runner.js";
import { buildReport, renderMarkdown } from "../../src/reporting/report-builder.js";
import { measureSelection } from "../../src/reporting/evaluation.js";

test("should count passed and failed Playwright specs", () => {
  const execution = parsePlaywrightReport({
    suites: [
      {
        specs: [
          {
            title: "user can log in with valid credentials",
            ok: true,
            tests: [{ results: [{ status: "passed", duration: 40 }] }]
          }
        ],
        suites: [
          {
            specs: [
              {
                title: "user can place an order",
                ok: false,
                tests: [{ results: [{ status: "failed", duration: 20, error: { message: "Expected order" } }] }]
              }
            ]
          }
        ]
      }
    ]
  });

  assert.equal(execution.passed, 1);
  assert.equal(execution.failed, 1);
  assert.equal(execution.results[1].error, "Expected order");
});

test("should run only the selected test titles", async () => {
  let receivedArgs = [];
  const run = createPlaywrightRunner({
    runCommand: async (args) => {
      receivedArgs = args;
      return {
        stdout: JSON.stringify({
          suites: [
            {
              specs: [
                {
                  title: "user can log in with valid credentials",
                  ok: true,
                  tests: [{ results: [{ status: "passed", duration: 5 }] }]
                }
              ]
            }
          ]
        }),
        stderr: ""
      };
    }
  });

  const execution = await run([
    { title: "user can log in with valid credentials" }
  ]);

  assert.deepEqual(receivedArgs, [
    "test",
    "--reporter=json",
    "--grep",
    "user can log in with valid credentials$"
  ]);
  assert.equal(execution.passed, 1);
});

test("should escape special characters in a test title", async () => {
  let pattern = "";
  const run = createPlaywrightRunner({
    runCommand: async (args) => {
      pattern = args[3];
      return { stdout: "{\"suites\":[]}", stderr: "" };
    }
  });

  await run([{ title: "price (USD) is 1.5" }]);

  assert.equal(pattern, "price \\(USD\\) is 1\\.5$");
});

test("should report a clear error when Playwright prints no report", async () => {
  const run = createPlaywrightRunner({
    runCommand: async () => ({
      stdout: "",
      stderr: "Error: browserType.launch: Executable doesn't exist"
    })
  });

  await assert.rejects(run([{ title: "login" }]), (error) => {
    assert.equal(error.code, "PLAYWRIGHT_RUN_FAILED");
    assert.match(error.message, /Executable doesn't exist/);
    return true;
  });
});

test("should separate a product failure from an infrastructure failure", async () => {
  const findings = await diagnoseFailures({
    results: [
      { title: "login", status: "failed", error: "expect(locator).toHaveText failed" },
      { title: "checkout", status: "failed", error: "Test timeout of 30000ms exceeded" },
      { title: "catalog", status: "passed", error: "" }
    ]
  });

  assert.equal(findings[0].kind, "product");
  assert.equal(findings[1].kind, "infrastructure");
  assert.equal(findings.length, 2);
});

test("should build a report that shows the tests which were not run", () => {
  const registry = [
    { id: "AUTH-LOGIN-001", title: "login", featureId: "authentication", critical: true, file: "tests/e2e/auth.spec.js" },
    { id: "CATALOG-001", title: "catalog", featureId: "catalog", critical: false, file: "tests/e2e/catalog.spec.js" }
  ];
  const report = buildReport({
    analysis: { number: 12, title: "Add login validation", state: "open" },
    impact: { features: [], unmatchedSourceFiles: [], documentationOnly: false },
    risk: { score: 42, level: "medium", reasons: [] },
    selection: { tests: [registry[0]], reason: "Tests were selected for the impacted features." },
    intelligence: { mode: "deterministic", explanation: "Risk is medium (42/100)." },
    selectedTests: [registry[0]],
    rejectedTestIds: [],
    registry,
    execution: null,
    diagnosis: []
  });

  assert.equal(report.comparison.testsSaved, 1);
  assert.equal(report.skippedTests[0].id, "CATALOG-001");
  assert.deepEqual(report.intelligence.addedTestIds, []);
  assert.deepEqual(report.missedCriticalTests, []);
  assert.match(renderMarkdown(report), /AUTH-LOGIN-001/);
});

test("should record a test the AI added and a missed critical test", () => {
  const registry = [
    { id: "AUTH-LOGIN-001", title: "login", featureId: "authentication", critical: true, file: "a.js" },
    { id: "CHECKOUT-001", title: "checkout", featureId: "checkout", critical: true, file: "b.js" }
  ];
  const report = buildReport({
    analysis: {
      number: 3,
      title: "Login",
      state: "open",
      files: [
        {
          path: "src/auth/login.js",
          previousPath: null,
          status: "modified",
          category: "source",
          additions: 1,
          deletions: 1,
          hunks: [{ heading: "function login", addedLines: ["if (!user) {"], removedLines: ["return user;"] }]
        }
      ]
    },
    impact: {
      features: [{ id: "authentication", name: "Authentication", critical: true, files: ["src/auth/login.js"] }],
      unmatchedSourceFiles: [],
      documentationOnly: false
    },
    risk: { score: 40, level: "medium", reasons: [] },
    selection: { tests: [], reason: "No mapped feature changed, so no regression tests were selected." },
    intelligence: { mode: "ai", explanation: "Added the login test." },
    selectedTests: [registry[1]],
    rejectedTestIds: ["MADE-UP"],
    registry,
    execution: null,
    diagnosis: []
  });

  assert.deepEqual(report.intelligence.addedTestIds, ["CHECKOUT-001"]);
  assert.deepEqual(report.missedCriticalTests.map((test) => test.id), ["AUTH-LOGIN-001"]);
  assert.equal(report.changedFiles[0].hunks[0].heading, "function login");
  assert.deepEqual(report.changedFiles[0].hunks[0].addedLines, ["if (!user) {"]);
});

test("should calculate precision, recall, and critical recall", () => {
  const metrics = measureSelection(
    ["AUTH-LOGIN-001", "CATALOG-001"],
    ["AUTH-LOGIN-001", "AUTH-LOGIN-002"],
    ["AUTH-LOGIN-001", "AUTH-LOGIN-002"]
  );

  assert.equal(metrics.precision, 0.5);
  assert.equal(metrics.recall, 0.5);
  assert.equal(metrics.criticalRecall, 0.5);
  assert.deepEqual(metrics.falseNegatives, ["AUTH-LOGIN-002"]);
});
