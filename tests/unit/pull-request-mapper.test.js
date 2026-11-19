import test from "node:test";
import assert from "node:assert/strict";

import { mapPullRequest } from "../../src/integrations/github/pull-request-mapper.js";

test("should map a GitHub pull request into a TestNexus change summary", () => {
  const summary = mapPullRequest({
    pullRequest: {
      number: 12,
      title: "Add login validation",
      state: "open",
      html_url: "https://github.com/example/repo/pull/12",
      user: { login: "octocat" }
    },
    changedFiles: [
      {
        filename: "src/auth/login.js",
        status: "modified",
        additions: 10,
        deletions: 2,
        patch: "@@ -1 +1 @@"
      },
      {
        filename: "src/auth/login-form.js",
        previous_filename: "src/auth/form.js",
        status: "renamed",
        additions: 0,
        deletions: 0
      }
    ]
  });

  assert.deepEqual(summary, {
    number: 12,
    title: "Add login validation",
    state: "open",
    changedFiles: [
      {
        path: "src/auth/login.js",
        previousPath: null,
        status: "modified",
        additions: 10,
        deletions: 2,
        patch: "@@ -1 +1 @@"
      },
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
});
