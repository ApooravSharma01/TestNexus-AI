import test from "node:test";
import assert from "node:assert/strict";

import { analyzePullRequest } from "../../src/analyzers/change-analyzer.js";

const loginPatch = [
  "@@ -2,2 +2,3 @@ function login(user)",
  " const user = input;",
  "-return user;",
  "+if (!user) {",
  "+  throw new Error(\"missing user\");",
  "+}"
].join("\n");

test("should describe a product change and the lines inside it", () => {
  const analysis = analyzePullRequest({
    number: 12,
    title: "Add login validation",
    state: "open",
    changedFiles: [
      {
        path: "src/auth/login.js",
        previousPath: null,
        status: "modified",
        additions: 3,
        deletions: 1,
        patch: loginPatch
      },
      {
        path: "tests/unit/login.test.js",
        previousPath: null,
        status: "added",
        additions: 8,
        deletions: 0,
        patch: null
      },
      {
        path: "package.json",
        previousPath: null,
        status: "modified",
        additions: 1,
        deletions: 0,
        patch: null
      }
    ]
  });

  assert.equal(analysis.files[0].category, "source");
  assert.equal(analysis.files[0].directory, "src/auth");
  assert.equal(analysis.files[0].extension, ".js");
  assert.equal(analysis.files[0].churn, 4);
  assert.equal(analysis.files[0].hunks[0].heading, "function login(user)");
  assert.deepEqual(analysis.files[0].hunks[0].addedLines, [
    "if (!user) {",
    "  throw new Error(\"missing user\");",
    "}"
  ]);
  assert.equal(analysis.files[1].category, "test");
  assert.equal(analysis.files[2].category, "configuration");
  assert.deepEqual(analysis.totals, {
    files: 3,
    additions: 12,
    deletions: 1,
    churn: 13
  });
  assert.equal(analysis.signals.sourceChanged, true);
  assert.equal(analysis.signals.testsChanged, true);
  assert.equal(analysis.signals.configurationChanged, true);
  assert.equal(analysis.signals.documentationOnly, false);
});

test("should mark a documentation-only pull request", () => {
  const analysis = analyzePullRequest({
    number: 4,
    title: "Update readme",
    state: "open",
    changedFiles: [
      {
        path: "README.md",
        previousPath: null,
        status: "modified",
        additions: 2,
        deletions: 1,
        patch: null
      }
    ]
  });

  assert.equal(analysis.files[0].category, "documentation");
  assert.equal(analysis.signals.sourceChanged, false);
  assert.equal(analysis.signals.documentationOnly, true);
});

test("should keep the old path when a file is renamed", () => {
  const analysis = analyzePullRequest({
    number: 5,
    title: "Rename login form",
    state: "open",
    changedFiles: [
      {
        path: "src/auth/login-form.js",
        previousPath: "src/auth/form.js",
        status: "renamed",
        additions: 0,
        deletions: 0,
        patch: null
      }
    ]
  });

  assert.equal(analysis.files[0].path, "src/auth/login-form.js");
  assert.equal(analysis.files[0].previousPath, "src/auth/form.js");
  assert.equal(analysis.files[0].category, "source");
});
