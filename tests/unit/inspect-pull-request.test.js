import test from "node:test";
import assert from "node:assert/strict";

import { inspectPullRequest } from "../../src/commands/inspect-pull-request.js";

test("should analyze the pull request returned by GitHub", async () => {
  const analysis = await inspectPullRequest(12, {
    service: {
      getPullRequestWithFiles: async (pullNumber) => ({
        number: pullNumber,
        title: "Add login validation",
        state: "open",
        changedFiles: [
          {
            path: "src/auth/login.js",
            previousPath: null,
            status: "modified",
            additions: 10,
            deletions: 2,
            patch: null
          }
        ]
      })
    }
  });

  assert.equal(analysis.number, 12);
  assert.equal(analysis.files[0].path, "src/auth/login.js");
  assert.equal(analysis.files[0].category, "source");
  assert.equal(analysis.signals.sourceChanged, true);
});
